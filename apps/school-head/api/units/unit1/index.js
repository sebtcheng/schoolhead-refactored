import express from 'express';
import { pool, safeQuery } from '@shared/db';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// [QUEST] UNIT 1: SCHOOL IDENTITY
// ─────────────────────────────────────────────────────────────────────────────
router.post('/api/ph_schools/unit1', async (req, res) => {
    const data = req.body;
    const { school_id, iern } = data;
    if (!school_id && !iern) return res.status(400).json({ error: "Missing school_id or iern" });

    try {
        let resolvedIern = iern;
        if (!resolvedIern && school_id) {
            const schoolRes = await safeQuery('SELECT iern FROM ph_schools WHERE school_id = $1 OR iern = $1 LIMIT 1', [school_id]);
            resolvedIern = schoolRes.rows[0]?.iern || null;
            if (!resolvedIern) {
                const iernRes = await safeQuery('SELECT "IERN" as iern FROM "schools_IERN" WHERE "SchoolID" = $1 LIMIT 1', [school_id]);
                resolvedIern = iernRes.rows[0]?.iern || null;
            }
        }
        if (!resolvedIern) return res.status(404).json({ error: "School not found in core registry" });

        let client;
        let colRes;
        try {
            colRes = await safeQuery(`SELECT column_name FROM information_schema.columns WHERE table_name = 'unit1_school_identity'`);
        } catch (err) {
            if (err.message && err.message.includes('terminated unexpectedly')) {
                client = await pool.connect();
                try { colRes = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'unit1_school_identity'`); }
                finally { client.release(); }
            } else { throw err; }
        }
        const existingCols = new Set(colRes.rows.map(r => r.column_name));

        const allPotentialFields = [
            'school_name', 'region', 'province', 'municipality', 'barangay', 'division', 'district', 'leg_district',
            'curricular_offering', 'latitude', 'longitude',
            'school_type', 'mother_school_id', 'extension_mother_school_name', 'established_month', 'established_year', 
            'head_first_name', 'head_middle_name', 'head_last_name', 'head_sex', 'head_position_title', 'head_date_hired',
            'ownership_na_reason', 'ownership_doc_id',
            'ownership_type', 'document_type', 'multiple_ownership', 'multiple_document_type', 'document_path', 'annexes',
            'unit1', 'unit1_completed', 'unit1_updated_at'
        ];

        const fields = allPotentialFields.filter(f => existingCols.has(f));
        const school_yr = data.school_yr || 'SY 26-27';

        const values = fields.map(f => {
            if (f === 'unit1') return 100;
            if (f === 'unit1_completed') return true;
            if (f === 'unit1_updated_at') return new Date();
            
            if (f === 'ownership_type') return data.ownership;
            if (f === 'document_type') return data.ownership_document_type;
            if (f === 'multiple_ownership') return Array.isArray(data.ownership_multiple) ? JSON.stringify(data.ownership_multiple) : null;
            if (f === 'multiple_document_type') return Array.isArray(data.ownership_document_multiple) ? JSON.stringify(data.ownership_document_multiple) : null;
            if (f === 'document_path') return data.ownership_document_path || data.local_file_path || null;
            if (f === 'annexes') return data.school_type === 'with_annex' && Array.isArray(data.annex_details) ? JSON.stringify({ count: data.annex_details.length, details: data.annex_details }) : null;

            return data[f];
        });

        if (fields.length === 0) return res.status(400).json({ error: "No valid fields to update" });

        const columnsStr = ['iern', 'school_id', 'school_yr', ...fields].map(c => `"${c}"`).join(', ');
        const placeholders = ['iern', 'school_id', 'school_yr', ...fields].map((_, idx) => `$${idx + 1}`).join(', ');
        const updateClause = fields.map(f => `"${f}" = EXCLUDED."${f}"`).join(', ');

        // ── 1. VALIDATION LOCK CHECK & HYBRID JSONB UPSERT ──────────────────────
        const checkLock = await safeQuery(
            'SELECT validation_status, validation_remarks FROM ph_school_unit_submissions WHERE iern = $1 AND unit_number = 1',
            [resolvedIern]
        );
        if (checkLock.rows[0]?.validation_status === 'validated') {
            return res.status(403).json({ error: 'This module is validated and locked.' });
        }

        const currentStatus = checkLock.rows[0]?.validation_status || 'draft';
        const isResubmission = ['returned', 'rejected'].includes(currentStatus);
        const nextStatus = isResubmission ? 'submitted' : (data.is_completed !== false ? 'submitted' : 'draft');
        const nextRemarks = isResubmission ? null : (checkLock.rows[0]?.validation_remarks || null);

        await safeQuery(`
            INSERT INTO ph_school_unit_submissions 
                (iern, unit_number, payload, is_completed, validation_status, validation_remarks, submitted_at, updated_at)
            VALUES ($1, 1, $2, TRUE, $3, $4, NOW(), NOW())
            ON CONFLICT (iern, unit_number) DO UPDATE SET
                payload = EXCLUDED.payload,
                is_completed = TRUE,
                validation_status = EXCLUDED.validation_status,
                validation_remarks = EXCLUDED.validation_remarks,
                submitted_at = NOW(),
                updated_at = NOW()
        `, [resolvedIern, JSON.stringify(data), nextStatus, nextRemarks]);

        const result = await safeQuery(query, [resolvedIern, school_id, school_yr, ...values]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Failed to save unit 1 data" });



        const ownershipDocId = data.ownership_doc_id || null;

        // Transactional update to school_ownership_records mapping
        const dbClient = await pool.connect();
        try {
            await dbClient.query('BEGIN');
            await dbClient.query('DELETE FROM school_ownership_records WHERE iern = $1 AND school_yr = $2', [resolvedIern, school_yr]);

            const owners = Array.isArray(data.ownership_multiple) ? data.ownership_multiple : [];
            const docs = Array.isArray(data.ownership_document_multiple) ? data.ownership_document_multiple : [];

            if (owners.length > 0) {
                for (let i = 0; i < owners.length; i++) {
                    const oType = owners[i];
                    const dType = docs[i] || null;
                    if (oType) {
                        await dbClient.query(
                            `INSERT INTO school_ownership_records (iern, ownership_type, document_type, ownership_doc_id, school_yr)
                             VALUES ($1, $2, $3, $4, $5)`,
                            [resolvedIern, oType, dType, ownershipDocId, school_yr]
                        );
                    }
                }
            } else if (data.ownership) {
                await dbClient.query(
                    `INSERT INTO school_ownership_records (iern, ownership_type, document_type, ownership_doc_id, school_yr)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [resolvedIern, data.ownership, data.ownership_document_type || null, ownershipDocId, school_yr]
                );
            }
            await dbClient.query('COMMIT');
        } catch (txnErr) {
            await dbClient.query('ROLLBACK');
            console.error("❌ Failed to transactionally save school_ownership_records:", txnErr.message);
        } finally {
            dbClient.release();
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error("Unit 1 Update Error:", err);
        res.status(500).json({ error: err.message });
    }
});

export { router as unit1Router };
export default router;
