import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { BlobServiceClient } from '@azure/storage-blob';
import multer from 'multer';
import { exec } from 'child_process';
import util from 'util';
import { fileURLToPath } from 'url';
import { pool } from '@shared/db';
import { upsertBinary } from './binaryPipeline.js';
export { upsertBinary };

const execAsync = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..', '..');
dotenv.config({ path: path.join(rootDir, '.env') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

// --- ROLE NORMALIZER ---
export function normalizeRole(role) {
  if (!role) return '';
  return role
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// --- LOCATION NORMALIZER ---
export function normalizeLocationField(val) {
  if (!val || typeof val !== 'string') return val;
  return val.replace(/[\?\uFFFD]+/g, 'Ñ').replace(/\s+/g, ' ').trim().toUpperCase();
}

export function normalizeBasicField(val) {
  if (!val || typeof val !== 'string') return val;
  return val.replace(/[\?\uFFFD]+/g, 'Ñ').replace(/\s+/g, ' ').trim();
}

export function normalizeLocationOutput(val) {
  if (!val || typeof val !== 'string') return val;
  return val.replace(/[\?\uFFFD]+/g, 'Ñ').replace(/\s+/g, ' ').trim().toUpperCase();
}

// --- DUPLICATE SHIELD HELPERS ---
export function isDuplicateSnapshot(newData, oldData) {
  if (!newData || !oldData) return false;
  
  const ignoreCols = [
    'project_id', 'ipc', 'created_at', 'status_as_of', 'time_lapsed', 'time_lapsed_days',
    'engineer_name', 'modified_by', 'actions'
  ];
  
  const normalize = (val) => {
    if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') return null;
    if (val instanceof Date) return new Date(val).getTime();
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d.getTime();
    }
    if (typeof val === 'number') return parseFloat(val.toFixed(6));
    if (typeof val === 'string' && !isNaN(val) && val.trim() !== '') {
        return parseFloat(parseFloat(val).toFixed(6));
    }
    if (typeof val === 'string') return val.trim();
    return val;
  };

  const keys = Object.keys(newData);
  for (const key of keys) {
    if (ignoreCols.includes(key)) continue;
    if (key.startsWith('_') || key === 'rn' || key === 'id') continue;

    const n = normalize(newData[key]);
    const o = normalize(oldData[key]);
    
    if (n !== o) return false; 
  }
  return true;
}

export async function checkIsDuplicateContent(client, ipc, newData) {
  if (!ipc) return false;
  try {
    const res = await client.query(
      `SELECT * FROM (
         SELECT * FROM engineer_form
         UNION ALL
         SELECT * FROM engineer_create
         UNION ALL
         SELECT * FROM engineer_create_updates
       ) combined
       WHERE school_id = $1 AND project_name = $2 
       ORDER BY accomplishment_percentage DESC, project_id DESC LIMIT 1`,
      [newData.school_id, newData.project_name]
    );
    if (res.rows.length === 0) return false;
    return isDuplicateSnapshot(newData, res.rows[0]);
  } catch (err) {
    console.error("⚠️ [DuplicateCheck] Failed to verify latest record:", err.message);
    return false;
  }
}

// --- UPLOAD PATH CONFIGURATION ---
export const UPLOAD_BASE_PATH = process.env.UPLOAD_DIR 
  ? path.resolve(process.env.UPLOAD_DIR) 
  : path.resolve(__dirname, '..', '..', 'uploads');

console.log(`📂 [Storage] Active Upload Root: ${UPLOAD_BASE_PATH}`);

export const getUploadPath = (subDir) => {
  const dir = path.join(UPLOAD_BASE_PATH, subDir);
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      console.error(`❌ Critical: Failed to create/verify directory ${dir}:`, e.message);
    }
  }
  return dir;
};

// --- EMAIL TRANSPORTER ---
export const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// --- AZURE BLOB CLIENT ---
export let blobServiceClient = null;
try {
  if (process.env.AZURE_STORAGE_CONNECTION_STRING && process.env.AZURE_STORAGE_CONNECTION_STRING !== "ReplaceWithYourAzureStorageConnectionString") {
    blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
    console.log("✅ Azure Blob Storage Client Initialized");
  } else {
    console.warn("⚠️ AZURE_STORAGE_CONNECTION_STRING missing or invalid. PDF Streaming will be disabled.");
  }
} catch (error) {
  console.error("❌ Failed to initialize Azure Blob Storage:", error.message);
}

// --- PDF OPTIMIZATION PIPELINE ---
export const compressBufferTo90Dpi = async (buffer) => {
    if (!buffer || buffer.length === 0) return { buffer };
    const tempInput = path.join(UPLOAD_BASE_PATH, `comp_in_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.pdf`);
    const tempOutput = path.join(UPLOAD_BASE_PATH, `comp_out_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.pdf`);
    const tempHydraDir = path.join(UPLOAD_BASE_PATH, `hydra_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`);
    
    let result = { buffer };

    try {
        const fd = fs.openSync(tempInput, 'w');
        fs.writeFileSync(fd, buffer);
        fs.fsyncSync(fd);
        fs.closeSync(fd);

        const onDiskSize = fs.statSync(tempInput).size;
        console.log(`💾 [Storage-Verified] Temp file saved: ${tempInput} | size=${onDiskSize}B`);
        
        const scriptPath = path.resolve(process.cwd(), 'compress_pdf.py');
        if (!fs.existsSync(scriptPath)) {
            console.error(`❌ [PDF-Config] Critical: compress_pdf.py not found at ${scriptPath}`);
        }

        if (buffer.length > 25 * 1024 * 1024) {
            console.log(`🐉 [Hydra] Triggering transformation for ${buffer.length}B document...`);
            const hydraCmd = (py) => `${py} "${scriptPath.replace(/\\/g, '/')}" "${tempInput.replace(/\\/g, '/')}" "${tempHydraDir.replace(/\\/g, '/')}" 120 --hydra`;
            
            let hydraSuccess = false;
            let hydraError = null;
            
            for (const executor of ['python', 'python3', 'py']) {
                try {
                    const { stdout, stderr } = await execAsync(hydraCmd(executor));
                    if (stdout) console.log(`🐉 [Hydra-Stdout]`, stdout.trim());
                    if (stderr) console.warn(`🐉 [Hydra-Stderr]`, stderr.trim());
                    hydraSuccess = true;
                    break;
                } catch (err) {
                    const msg = err.stderr || err.stdout || err.message || '';
                    if (msg.includes('not recognized') || msg.includes('not found') || msg.includes('No such file')) continue;
                    hydraError = msg;
                    console.warn(`⚠️ [Hydra-Fail] ${executor} failed:`, msg); 
                    break;
                }
            }

            if (hydraSuccess && fs.existsSync(path.join(tempHydraDir, 'manifest.json'))) {
                const manifest = JSON.parse(fs.readFileSync(path.join(tempHydraDir, 'manifest.json'), 'utf8'));
                for (const shard of manifest) {
                    const shardPath = path.join(tempHydraDir, shard.file);
                    const shardBuffer = fs.readFileSync(shardPath);
                    const { binary_id } = await upsertBinary(pool, shardBuffer, 'image/jpeg');
                    shard.binary_id = binary_id;
                    delete shard.file; 
                    fs.unlinkSync(shardPath); 
                }
                
                result.hydraManifest = manifest;
                console.log(`[Hydra] Generated ${manifest.length} shards for document.`);
                fs.unlinkSync(path.join(tempHydraDir, 'manifest.json'));
                fs.rmdirSync(tempHydraDir);
            }
        }

        const cmd = (py) => `${py} "${scriptPath.replace(/\\/g, '/')}" "${tempInput.replace(/\\/g, '/')}" "${tempOutput.replace(/\\/g, '/')}" 90`;
        let compressSuccess = false;
        for (const executor of ['python', 'python3', 'py']) {
            try {
                await execAsync(cmd(executor));
                compressSuccess = true;
                break;
            } catch (e) {
                const msg = e.stderr || e.stdout || e.message || '';
                if (msg.includes('not recognized') || msg.includes('not found') || msg.includes('No such file')) continue;
                console.warn(`⚠️ [PDF-Compress] ${executor} failed:`, msg); 
                break;
            }
        }
        if (!compressSuccess) {
            throw new Error('PDF compression pipeline unavailable (Python/PyMuPDF not installed). Refusing to store original to enforce 90 DPI policy.');
        }

        if (!fs.existsSync(tempOutput)) {
            throw new Error('PDF compression produced no output file.');
        }
        const outSize = fs.statSync(tempOutput).size;
        if (outSize === 0) {
            throw new Error('PDF compression produced a zero-byte file.');
        }

        result.buffer = fs.readFileSync(tempOutput);
        fs.unlinkSync(tempOutput);
    } catch (err) {
        console.warn("⚠️ PDF Optimization pipeline encountered an error:", err.message);
    } finally {
        if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
        if (fs.existsSync(tempHydraDir)) {
            try { fs.rmSync(tempHydraDir, { recursive: true, force: true }); } catch (e) {}
        }
    }
    return result;
};

// --- MULTER STORAGE AND UPLOADS ---
const schoolDocsStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = getUploadPath('temp');
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `temp_iern_${req.params.iern}_${Date.now()}${ext}`;
    cb(null, uniqueName);
  }
});

export const schoolDocsUpload = multer({ 
  storage: schoolDocsStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, 
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed!'), false);
  }
});

const projectPhotosStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = getUploadPath('temp');
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `temp_photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`);
    }
});

export const projectPhotosUpload = multer({
    storage: projectPhotosStorage,
    limits: { fileSize: 20 * 1024 * 1024 } 
});

export const memoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } 
});
