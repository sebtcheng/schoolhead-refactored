import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, safeQuery } from '@shared/db';
import { 
  upsertBinary,
  compressBufferTo90Dpi, 
  getUploadPath, 
  memoryUpload 
} from '@shared/io';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// [QUEST] SCHOOL DOCS STORAGE & ASSETS
// ─────────────────────────────────────────────────────────────────────────────

router.post('/api/schools/:iern/ownership-docs', memoryUpload.single('file'), async (req, res) => {
  const { iern } = req.params;
  const { doc_type } = req.body;
  
  try {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    let finalDocValue = null;
    let finalBinaryId = null;
    let finalHydraManifest = null;
    let storedSize = req.file.size;
    let originalSizeFound = req.file.size;

    try {
        const { buffer: compressedBuffer, hydraManifest } = await compressBufferTo90Dpi(req.file.buffer);
        const { binary_id, stored_size, original_size: returnedOrigSize } = await upsertBinary(pool, compressedBuffer, 'application/pdf', req.file.size);
        
        finalBinaryId = binary_id;
        finalDocValue = `/api/asset/${binary_id}`;
        storedSize = stored_size; 
        finalHydraManifest = hydraManifest;
        originalSizeFound = returnedOrigSize || req.file.size;
        
        const isCompressed = storedSize < originalSizeFound * 0.98;
        console.log(`🗄️ [SchoolDocStore] Stored ownership doc: ${binary_id} | size=${storedSize}B | hydra=${!!hydraManifest} | (orig=${originalSizeFound}B) | compressed=${isCompressed}`);
    } catch (binErr) {
        console.error('⚠️ [SchoolDocStore] Binary pipeline failure, falling back to disk:', binErr.message);
        const finalDir = getUploadPath('school_docs');
        const finalFilename = `fallback_${Date.now()}_${req.file.originalname.replace(/\s+/g, '_')}`;
        const finalPath = path.join(finalDir, finalFilename);
        
        fs.writeFileSync(finalPath, req.file.buffer);
        
        finalDocValue = `/uploads/school_docs/${finalFilename}`;
        finalBinaryId = null; 
        storedSize = req.file.size;
        originalSizeFound = req.file.size;
    }

    const schoolRes = await safeQuery('SELECT school_id FROM ph_schools WHERE iern = $1 OR school_id = $1 LIMIT 1', [iern]);
    const resolvedSchoolId = schoolRes.rows[0]?.school_id || null;

    console.log(`📂 [SchoolDocStore] Resolved for ${iern}: SID=${resolvedSchoolId} | Stored=${storedSize}B | Original=${originalSizeFound}B`);

    const dbRes = await safeQuery(
      `INSERT INTO school_ownership_docs (
          iern, school_id, file_path, file_name, doc_type, status, binary_id, 
          file_size, original_size, hydra_manifest
       ) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (iern) DO UPDATE SET
          school_id = EXCLUDED.school_id,
          file_path = EXCLUDED.file_path,
          file_name = EXCLUDED.file_name,
          doc_type = EXCLUDED.doc_type,
          status = EXCLUDED.status,
          binary_id = EXCLUDED.binary_id,
          file_size = EXCLUDED.file_size,
          original_size = EXCLUDED.original_size,
          hydra_manifest = EXCLUDED.hydra_manifest,
          created_at = CURRENT_TIMESTAMP
       RETURNING id, file_size, original_size`,
      [
        iern, resolvedSchoolId, finalDocValue, req.file.originalname, doc_type, 'optimized', 
        finalBinaryId, storedSize, originalSizeFound, 
        finalHydraManifest ? JSON.stringify(finalHydraManifest) : null
      ]
    );

    const savedRow = dbRes.rows[0];



    res.status(200).json({ 
      success: true, 
      message: 'Upload and database storage complete.',
      data: { 
        id: savedRow.id, 
        filePath: finalDocValue, 
        fileName: req.file.originalname,
        binaryId: finalBinaryId,
        file_size: storedSize,
        original_size: originalSizeFound,
        ownership_document_path: finalDocValue
      }
    });

  } catch (err) {
    console.error('❌ [SchoolDocStore] DB Error during upload:', err);
    res.status(500).json({
      error:      err.message || 'Failed to record document metadata',
      code:       err.code,
      column:     err.column,
      constraint: err.constraint,
      detail:     err.detail,
    });
  }
});

router.get('/api/asset/:id', async (req, res) => {
    const { id } = req.params;
    const isDownload = req.query.download === '1';

    try {
        const result = await safeQuery(
            'SELECT content, mime_type, size_bytes FROM unified_binaries WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).send('Document not found in registry.');
        }

        const asset = result.rows[0];
        res.setHeader('Content-Type', asset.mime_type || 'application/pdf');
        res.setHeader('Content-Length', asset.size_bytes);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); 

        if (isDownload) {
            res.setHeader('Content-Disposition', `attachment; filename="document_${id.substring(0, 8)}.pdf"`);
        }

        res.send(asset.content);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve document from storage.' });
    }
});

router.delete('/api/schools/:iern/ownership-docs/:id', async (req, res) => {
  const { iern, id } = req.params;
  
  try {
    const dbRes = await safeQuery(
      `SELECT file_path, iern FROM school_ownership_docs 
       WHERE id = $1 AND (
          iern = $2 OR 
          iern = (SELECT school_id FROM ph_schools WHERE iern = $2 LIMIT 1) OR 
          iern = (SELECT iern FROM ph_schools WHERE school_id = $2 LIMIT 1)
       )`,
      [id, iern]
    );

    if (dbRes.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found or unauthorized' });
    }

    const relativePath = dbRes.rows[0].file_path;
    // Go up two directories from api/units/docs to reach project root
    const absolutePath = path.join(__dirname, '..', '..', relativePath);

    try {
      if (fs.existsSync(absolutePath)) {
        await fs.promises.unlink(absolutePath);
      }
    } catch (unlinkErr) {
      console.warn(`⚠️ Warning: Physical file not found or could not be deleted:`, unlinkErr.message);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL internal.authorized_app_deletion = 'true'");
      await client.query('DELETE FROM school_ownership_docs WHERE id = $1', [id]);
      await client.query('COMMIT');
    } catch (dbErr) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('❌ [Docs Delete] ROLLBACK failed:', rollbackErr.message);
      }
      throw dbErr;
    } finally {
      client.release();
    }



    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (err) {
    res.status(500).json({ 
        error: 'Failed to delete document', 
        message: err.message,
        code: err.code 
    });
  }
});

export { router as docsRouter };
export default router;
