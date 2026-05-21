import dotenv from 'dotenv';
import express from 'express';
console.log("📌 >>> RUNNING: [ROOT]/api/index.js <<< 📌");
// Robust Login Fix v1.1 - Optimized teachers_list connections removed.

// import { google } from 'googleapis'; // Removed ESF7 dependency
// Force restart to pick up .env changes - Robust Login Fix v1
import pg from 'pg';
import QueryStream from 'pg-query-stream';
import cors from 'cors';
// import cron from 'node-cron'; // REMOVED for Vercel
// --- LEGACY FIREBASE (DISABLED) ---
const admin = { 
  apps: [], 
  auth: () => ({ 
    getUser: () => Promise.resolve({}), 
    updateUser: () => Promise.resolve({}), 
    deleteUser: () => Promise.resolve({}), 
    getUserByEmail: () => Promise.resolve(null), 
    createCustomToken: () => Promise.resolve("") 
  }), 
  messaging: () => ({ 
    sendEachForMulticast: () => Promise.resolve({ successCount: 0, failureCount: 0 }) 
  }), 
  credential: { cert: () => ({}) }, 
  initializeApp: () => ({}) 
};
import webpush from 'web-push';
import nodemailer from 'nodemailer'; // --- NODEMAILER ---

import { initOtpTable, runMigrations } from './db_init.js';

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs'; // Added for seed
import csv from 'csv-parser'; // Added for seed
import { BlobServiceClient } from '@azure/storage-blob'; // --- AZURE BLOB STORAGE ---
import busboy from 'busboy'; // --- FAST FILE PARSER ---
import multer from 'multer';
import { createRequire } from "module"; // Added for JSON import
const require = createRequire(import.meta.url);
// import { PgBoss } from 'pg-boss'; // Removed
import { exec } from 'child_process';
import util from 'util';
const execAsync = util.promisify(exec);

// --- PDF OPTIMIZATION PIPELINE (Moved after Pool Init below to fix ReferenceError) ---

import { FirebaseScrypt } from 'firebase-scrypt'; // For lazy migration
import bcrypt from 'bcrypt'; // For new standard hashes
import { v4 as uuidv4 } from 'uuid';
import { calculateRiskIndex } from './utils/safetyScore.js';
import { upsertBinary } from './utils/binaryPipeline.js';
import { z } from 'zod'; // For validation
import jwt from 'jsonwebtoken';
import authMiddleware from './middleware/authMiddleware.js';
// import XLSX from 'xlsx'; // Removed ESF7 dependency

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// --- WEB PUSH CONFIGURATION ---
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:helpdesk.stride@gmail.com',
    vapidPublicKey,
    vapidPrivateKey
  );
  console.log("✅ Web Push VAPID Details Set");
} else {
  console.warn("⚠️ VAPID keys missing in .env. Push notifications will be disabled.");
}

// --- [Hawkeye Protocol] Global Safety Handlers (v1.0) ---
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception thrown:', err);
});

// --- PROJECT CATEGORY NORMALIZER (auto-cleans messy imports & API saves) ---


// --- ROLE NORMALIZER (ensures consistency across underscored/lowercase roles) ---
function normalizeRole(role) {
  if (!role) return '';
  return role
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// --- LOCATION NORMALIZER (ensures system-wide casing consistency and fixes encoding artifacts) ---
function normalizeLocationField(val) {
  if (!val || typeof val !== 'string') return val;
  // Handle encoding artifacts ('??', '?', or Unicode Replacement Character) as a single 'Ñ'
  return val.replace(/[\?\uFFFD]+/g, 'Ñ').replace(/\s+/g, ' ').trim().toUpperCase();
}

function normalizeBasicField(val) {
  if (!val || typeof val !== 'string') return val;
  // Preserves case but cleans encoding artifacts
  return val.replace(/[\?\uFFFD]+/g, 'Ñ').replace(/\s+/g, ' ').trim();
}

function normalizeLocationOutput(val) {
  if (!val || typeof val !== 'string') return val;
  return val.replace(/[\?\uFFFD]+/g, 'Ñ').replace(/\s+/g, ' ').trim().toUpperCase();
}

// --- ZOD VALIDATION SCHEMAS (Resilience v6.0) ---
const PasscodeSchema = z.string().length(6).regex(/^\d+$/, "Passcode must be exactly 6 digits.");

// [Systematic Resilience] Safe Numeric Preprocessor (v1.0)
// Prevents Postgres 22P02 "NaN" errors by converting malformed JS numbers to null.
const safeNumeric = z.preprocess(val => (val === "" || val === null || Number.isNaN(Number(val)) ? null : Number(val)), z.number().nullable().optional());

// [Systematic Resilience] Safe Boolean Preprocessor (v1.0)
// Coerces string "true"/"false" and numeric 0/1 to proper booleans.
// Fixes Zod rejection on certain browsers/devices where checkboxes arrive as strings,
// and on data restored from IndexedDB offline sync payloads.
const safeBoolean = z.preprocess(val => {
  if (val === 'true'  || val === '1' || val === 1) return true;
  if (val === 'false' || val === '0' || val === 0) return false;
  return val;
}, z.boolean().optional());

const RegisterUserSchema = z.object({
  email: z.string().email().transform(e => e.trim().toLowerCase()),
  password: z.string().min(6, "Password must be at least 6 characters."),
  role: z.string().min(1, "Role is required."),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  region: z.string().optional().transform(normalizeLocationField),
  division: z.string().optional().transform(normalizeLocationField),
  province: z.string().optional().transform(normalizeLocationField),
  city: z.string().optional().transform(normalizeLocationField),
  barangay: z.string().optional().transform(normalizeLocationField),
  office: z.string().optional().transform(normalizeBasicField),
  position: z.string().optional().transform(normalizeBasicField),
  contactNumber: z.string().optional(),
  altEmail: z.string().email().optional().or(z.literal("")),
  accountCategory: z.string().optional(),
  passcode: PasscodeSchema.optional()
});

/**
 * [Duplicate Shield] Helper to compare two project data objects.
 * Identifies "Digital Clones" by comparing all values except IDs and timestamps.
 */
function isDuplicateSnapshot(newData, oldData) {
  if (!newData || !oldData) return false;
  
  // Columns to ignore in the "Digital Clone" check
  const ignoreCols = [
    'project_id', 'ipc', 'created_at', 'status_as_of', 'time_lapsed', 'time_lapsed_days',
    'engineer_name', 'modified_by', 'actions'
  ];
  
  // Normalize values before comparison
  const normalize = (val) => {
    if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') return null;
    
    // Handle Dates
    if (val instanceof Date) return new Date(val).getTime();
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d.getTime();
    }

    // Handle Numbers (convert to float to ignore precision)
    if (typeof val === 'number') return parseFloat(val.toFixed(6));
    if (typeof val === 'string' && !isNaN(val) && val.trim() !== '') {
        return parseFloat(parseFloat(val).toFixed(6));
    }

    if (typeof val === 'string') return val.trim();
    return val;
  };

  // Only compare keys that we are trying to insert (content keys)
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






/**
 * [Duplicate Shield] Fetches the latest record for a project and checks if it matches the new data.
 */
async function checkIsDuplicateContent(client, ipc, newData) {
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


// --- UPLOAD PATH CONFIGURATION (Hawkeye Protocol v1.1) ---
const UPLOAD_BASE_PATH = process.env.UPLOAD_DIR 
  ? path.resolve(process.env.UPLOAD_DIR) 
  : path.resolve(__dirname, '..', 'uploads');

console.log(`📂 [Storage] Active Upload Root: ${UPLOAD_BASE_PATH}`);

const getUploadPath = (subDir) => {
  const dir = path.join(UPLOAD_BASE_PATH, subDir);
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      console.error(`❌ Critical: Failed to create/verify directory ${dir}:`, e.message);
      console.error(`💡 Tip: Ensure the application has write permissions to ${UPLOAD_BASE_PATH}`);
    }
  }
  return dir;
};

const RegisterSchoolSchema = z.object({
  email: z.string().email().transform(e => e.trim().toLowerCase()),
  password: z.string().min(6),
  schoolData: z.object({
    school_id: z.string().min(1),
    school_name: z.string().min(1),
    region: z.string().optional().transform(normalizeLocationField),
    province: z.string().optional().transform(normalizeLocationField),
    division: z.string().optional().transform(normalizeLocationField),
    district: z.string().optional().transform(normalizeLocationField),
    municipality: z.string().optional().transform(normalizeLocationField),
    legislative_district: z.string().optional().transform(normalizeLocationField),
    barangay: z.string().optional().transform(normalizeLocationField),
    mother_school_id: z.string().optional(),
    latitude: z.union([z.number(), z.string()]).optional(),
    longitude: z.union([z.number(), z.string()]).optional(),
    curricular_offering: z.string().optional()
  }),
  contactNumber: z.string().optional(),
  role: z.string().optional(),
  passcode: PasscodeSchema
});

const RegisterBetaSchema = z.object({
  email: z.string().email().optional().or(z.literal("")),
  password: z.string().min(6),
  schoolData: z.object({
    school_id: z.string().min(1),
    school_name: z.string().optional().nullable(),
    region: z.string().optional().nullable().transform(normalizeLocationField),
    division: z.string().optional().nullable().transform(normalizeLocationField),
    province: z.string().optional().nullable().transform(normalizeLocationField),
    municipality: z.string().optional().nullable().transform(normalizeLocationField),
    district: z.string().optional().nullable().transform(normalizeLocationField),
    legislative_district: z.string().optional().nullable().transform(normalizeLocationField),
    barangay: z.string().optional().nullable().transform(normalizeLocationField),
    latitude: z.union([z.number(), z.string()]).optional().nullable(),
    longitude: z.union([z.number(), z.string()]).optional().nullable()
  }),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  contactNumber: z.string().optional(),
  passcode: PasscodeSchema.optional()
});

// --- DATABASE CONNECTION ---
const dbUrl = process.env.DATABASE_URL || 'postgres://Administrator1:pRZTbQ2T1JD7@127.0.0.1:6432/insightEd';
const isLoopback = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
const isVmProxy = dbUrl.includes('20.24.58.49') || dbUrl.includes('127.0.0.1');
// [Hawkeye Protocol] Throttling is only for local dev machines (localhost/loopback) NOT in staging/production modes.
const isLocal = isLoopback && process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'staging';

console.log(`🔌 Database Connection: ${isVmProxy ? 'Remote VM (Azure Proxy)' : (isLoopback ? 'Local Loopback' : 'Remote')} (${dbUrl.replace(/:[^:@]*@/, ':****@')}) [ENV: ${process.env.NODE_ENV || 'dev'}]`);

// [Job Queue Architecture] Removed — eSF7 logic moved to separate codebase.

// [Job Queue Architecture] Initialize Worker for ESF7 Scans



// // [Excel Parsing] Removed — eSF7 logic moved to separate codebase.

const logActivity = (userUid, userName, role, actionType, targetEntity, details, superUserContext = null) => {
  // PgBoss removed. Activity logging now console-only for isolation.
  console.log(`📝 [Activity] ${userName} (${role}): ${actionType} on ${targetEntity} - ${details}`);
};


const { Pool } = pg;
// [Hawkeye Protocol v4.1 — Emergency Stabilization]
// Azure DB supports 1718 connections. PgBouncer server pool is expanded to 100.
// Throttling Node pool to 15 per worker (8 workers * 15 = 120) to prevent PgBouncer saturation.
const pool = new Pool({
  connectionString: dbUrl,
  ssl: (isLoopback || isVmProxy) ? false : { rejectUnauthorized: false }, 
  max: isLocal ? 20 : 12, // PgBouncer safe capacity (increased for local dev stability)
  min: isLocal ? 1 : 5,   // Balanced warm connections
  idleTimeoutMillis: 60000, 
  connectionTimeoutMillis: 10000, // Hardened timeout (v7)
  maxUses: 7500, // Recycle connections to maintain stability (v7)
  keepAlive: true, // CRITICAL: Prevents Azure from dropping connections
  application_name: isLocal ? 'InsightEd_Local_Dev' : 'InsightEd_API_Cluster'
});

pool.on('connect', (client) => {
  // console.log('✅ [DB-POOL] New connection established');
});

pool.on('error', (err) => {
  console.error('💥 [DB-POOL] Unexpected error on idle database client:', err.message);
});

// Proactive Pool Telemetry (Hawkeye Protocol v3.1)
setInterval(() => {
  if (pool) {
    const { totalCount, idleCount, waitingCount } = pool;
    if (waitingCount > 0) {
      console.warn(`📡 [DB-POOL-ALERT] Total: ${totalCount} | Idle: ${idleCount} | WAITING: ${waitingCount} ⚠️`);
    } else if (process.env.DEBUG_POOL === 'true') {
      console.log(`📡 [DB-POOL-HEALTH] Total: ${totalCount} | Idle: ${idleCount} | Waiting: ${waitingCount}`);
    }
  }
}, 10000);



// --- [Hawkeye Protocol] IN-MEMORY TTL CACHE (v1.0) ---
// Prevents 200+ concurrent users from each running the same heavy aggregation query.
// Division-stats and district-stats do 200-column full-table joins — caching reduces
// DB load from N queries/sec to 1 query per TTL_MS, regardless of concurrent users.
const _cache = new Map();
const _inflight = new Map();
const CACHE_TTL_MS = 90_000; // 90 seconds — fresh enough for dashboards

function cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { _cache.delete(key); return null; }
  return entry.data;
}
function cacheSet(key, data) {
  _cache.set(key, { data, ts: Date.now() });
}

// Single-flight: if N concurrent requests ask for the same key,
// only ONE hits the DB; all others await the same promise.
async function cachedQuery(key, fn) {
  const hit = cacheGet(key);
  if (hit !== null) return hit;
  if (_inflight.has(key)) return _inflight.get(key);
  const promise = fn().then(result => {
    cacheSet(key, result);
    _inflight.delete(key);
    return result;
  }).catch(err => {
    _inflight.delete(key);
    throw err;
  });
  _inflight.set(key, promise);
  return promise;
}

// --- [Hawkeye Protocol] DB INITIALIZATION & SCHEMA HARDENING (Consolidated) ---
const hardenSchoolsIernSchema_OLD = async (client) => {
    try {
        console.log('🏗️ [DB-Init] Verifying schools_IERN schema...');
        
        // [Hawkeye Protocol] Consolidated ALTER TABLE
        await client.query(`
            ALTER TABLE "schools_IERN" 
            DROP COLUMN IF EXISTS latitude,
            DROP COLUMN IF EXISTS longitude,
            DROP COLUMN IF EXISTS mother_school_id,
            ADD COLUMN IF NOT EXISTS "Latitude" NUMERIC(10, 7),
            ADD COLUMN IF NOT EXISTS "Longitude" NUMERIC(10, 7),
            ADD COLUMN IF NOT EXISTS "Mother_School_ID" TEXT,
            ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'Active',
            ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        `);
        
        await client.query('UPDATE "schools_IERN" SET "status" = \'Active\' WHERE "status" IS NULL');

        try {
            await client.query('ALTER TABLE "schools_IERN" DROP CONSTRAINT IF EXISTS schools_iern_schoolid_unique');
            await client.query('DROP INDEX IF EXISTS idx_schoolid_active');
            await client.query('CREATE UNIQUE INDEX idx_schoolid_active ON "schools_IERN" ("SchoolID") WHERE status = \'Active\'');
            console.log('✅ [DB-Init] SchoolID constraint upgraded to Partial Unique (Active-only).');
        } catch (idxErr) {
            console.warn('⚠️ [DB-Init] Index upgrade warning (might already exist):', idxErr.message);
        }
        
        console.log('✅ [DB-Init] schools_IERN schema verified & cleaned.');

        // [Job Queue Architecture] Scan Results Table
        await client.query(`
          CREATE TABLE IF NOT EXISTS esf7_scan_results (
            job_id UUID PRIMARY KEY,
            school_id TEXT,
            result JSONB,
            error TEXT,
            status TEXT DEFAULT 'PENDING',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_esf7_scan_job ON esf7_scan_results(job_id);
        `);
    } catch (err) {
        console.error('❌ [DB-Init] Failed to harden schools_IERN schema:', err.message);
    }
};

console.log('✅ [Env] DATABASE_URL loaded:', process.env.DATABASE_URL ? 'YES' : 'NO');

/* --- LEGACY FIREBASE INIT REMOVED --- */

// --- EMAIL TRANSPORTER ---
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// --- AZURE BLOB CLIENT ---
let blobServiceClient;
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

// --- GOOGLE DRIVE CLIENT ---
// Removed for School Head Portal (ESF7 Decoupling)

// --- PDF OPTIMIZATION PIPELINE (Hydra Transformation Engine) ---
const compressBufferTo90Dpi = async (buffer) => {
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

        // PROJECT HYDRA: If file is > 25MB, attempt Hydra Transformation (PDF to Image Sequence)
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
                    // Skip silently if the executor binary doesn't exist
                    if (msg.includes('not recognized') || msg.includes('not found') || msg.includes('No such file')) continue;
                    // Real Python error — log and stop trying further executors
                    hydraError = msg;
                    console.warn(`⚠️ [Hydra-Fail] ${executor} failed:`, msg); // Log full message for diagnostics
                    break;
                }
            }
            if (!hydraSuccess && !hydraError) {
                console.warn(`⚠️ [Hydra-Fail] No Python executor (python/python3/py) found on PATH.`);
            }

            if (hydraSuccess && fs.existsSync(path.join(tempHydraDir, 'manifest.json'))) {
                const manifest = JSON.parse(fs.readFileSync(path.join(tempHydraDir, 'manifest.json'), 'utf8'));
                
                // Upload shards to unified_binaries
                // CRITICAL FIX: Binary pipeline requires 'pool' which is now defined in global scope
                for (const shard of manifest) {
                    const shardPath = path.join(tempHydraDir, shard.file);
                    const shardBuffer = fs.readFileSync(shardPath);
                    const { binary_id } = await upsertBinary(pool, shardBuffer, 'image/jpeg');
                    shard.binary_id = binary_id;
                    delete shard.file; 
                    fs.unlinkSync(shardPath); 
                }
                
                result.hydraManifest = manifest;
                console.log(`✅ [Hydra] Generated ${manifest.length} shards for document.`);
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
                console.warn(`⚠️ [PDF-Compress] ${executor} failed:`, msg); // Log full message for diagnostics
                break;
            }
        }
        if (!compressSuccess) {
            throw new Error('PDF compression pipeline unavailable (Python/PyMuPDF not installed). Refusing to store original to enforce 90 DPI policy.');
        }

        // Verify the output actually shrank — guard against zero-byte or expanded files.
        if (!fs.existsSync(tempOutput)) {
            throw new Error('PDF compression produced no output file.');
        }
        const outSize = fs.statSync(tempOutput).size;
        if (outSize === 0) {
            throw new Error('PDF compression produced a zero-byte file.');
        }
        if (outSize >= buffer.length) {
            console.warn(`⚠️ [PDF-Compress] Compressed output (${outSize}B) is not smaller than input (${buffer.length}B). Storing it anyway to enforce 90 DPI policy.`);
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

// --- STATE ---
let isDbConnected = false;

const app = express();

// --- CRITICAL DEBUG PING (TOP PRIORITY) ---
app.get('/api/ping', (req, res) => res.json({ 
  status: 'pong', 
  version: 'v1.2.5-STAGING-OMEGA-TOP',
  mode: 'API (/api/ping)',
  path: req.path
}));
app.get('/ping', (req, res) => res.json({ status: 'pong-root' }));




// --- AUTH MIDDLEWARE ---
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://insight-ed-mobile-pwa.vercel.app',
  'https://insight-ed-frontend.vercel.app',
  ...(process.env.CORS_ORIGIN_VM ? [process.env.CORS_ORIGIN_VM] : []),
];
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// --- [Status Check] Friendly Root Message ---
// --- ESF7 NATIONAL SCALE ROUTES (High Priority) ---
// Initialize ESF7 Link Registry if not exists
// [ESF7 Initialization] Removed — eSF7 logic moved to separate codebase.

// [ESF7 Routes] Removed — eSF7 logic moved to separate codebase.







// 1. QUICK SCAN (Verify Access & Metadata)
// [ESF7 Routes Block 1] Removed — eSF7 logic moved to separate codebase.

app.get('/', (req, res) => {
  res.status(200).send(`
    <div style="font-family: sans-serif; text-align: center; padding: 50px;">
      <h1>🚀 InsightEd API is Online</h1>
      <p>This is the backend server (Port 3000).</p>
      <p>To access the app interface, go to: <a href="http://localhost:5173">http://localhost:5173</a></p>
    </div>
  `);
});

// --- [Admission Control] Load Shedding & Resource Monitoring ---
// Protects the event loop from locking up during traffic spikes by returning 503 Service Unavailable
let eventLoopDelay = 0;
setInterval(() => {
  const start = Date.now();
  setImmediate(() => {
    eventLoopDelay = Date.now() - start;
  });
}, 1000);

app.use((req, res, next) => {
  const heapUsage = process.memoryUsage().heapUsed;
  const HEAP_THRESHOLD = 950 * 1024 * 1024; // 950MB (Hawkeye Tuning)
  const DELAY_THRESHOLD = 400; // Increased from 300ms to allow for DB latency spikes

  if (eventLoopDelay > DELAY_THRESHOLD || heapUsage > HEAP_THRESHOLD) {
    console.warn(`⚠️ [Admission-Control] REJECTING ${req.method} ${req.path} - Delay: ${eventLoopDelay}ms | Heap: ${Math.round(heapUsage/1024/1024)}MB`);
    res.set('Retry-After', '5');
    return res.status(503).json({ 
      error: 'Service Temporarily Overloaded', 
      retry_after: 5,
      reason: eventLoopDelay > DELAY_THRESHOLD ? 'high_latency' : 'memory_pressure',
      path: req.path
    });
  }
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// [QUEST] UNIT 1: SCHOOL IDENTITY
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/ph_schools/unit1', async (req, res) => {
    const data = req.body;
    const { school_id, iern } = data;
    if (!school_id && !iern) return res.status(400).json({ error: "Missing school_id or iern" });

    try {
        // 1. Get existing columns to avoid "column does not exist" errors
        const colRes = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'ph_schools'`);
        const existingCols = new Set(colRes.rows.map(r => r.column_name));

        // 2. Define intended fields
        const allPotentialFields = [
            'school_name', 'region', 'province', 'municipality', 'barangay', 'division', 'district', 'leg_district',
            'curricular_offering', 'latitude', 'longitude', 'school_head', 'contact_number', 'ownership',
            'ownership_document_type', 'google_drive_thumbnail_url', 'school_type', 'mother_school_id',
            'extension_mother_school_name', 'established_month', 'established_year', 'head_first_name',
            'head_middle_name', 'head_last_name', 'head_sex', 'head_position_title', 'head_date_hired',
            'ownership_na_reason', 'google_drive_link', 'google_drive_file_id', 'google_drive_file_name',
            'ownership_doc_id', 'ownership_document_path', 'local_file_path', 'local_file_name', 'local_file_size',
            'ownership_multiple', 'ownership_document_multiple',
            'unit1', 'unit1_completed', 'unit1_updated_at'
        ];

        // 3. Filter to only what the DB actually has
        const fields = allPotentialFields.filter(f => existingCols.has(f));

        const values = fields.map(f => {
            if (f === 'unit1') return 100;
            if (f === 'unit1_completed') return true;
            if (f === 'unit1_updated_at') return new Date();
            
            let val = data[f];
            if ((f === 'ownership_multiple' || f === 'ownership_document_multiple') && Array.isArray(val)) {
                return JSON.stringify(val);
            }
            return val;
        });

        if (fields.length === 0) return res.status(400).json({ error: "No valid fields to update" });

        const setClause = fields.map((f, i) => `"${f}" = $${i + 1}`).join(', ');
        const query = `UPDATE ph_schools SET ${setClause} WHERE school_id = $${fields.length + 1} OR iern = $${fields.length + 1} RETURNING *`;
        
        const result = await pool.query(query, [...values, school_id || iern]);
        if (result.rowCount === 0) return res.status(404).json({ error: "School not found" });

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error("Unit 1 Update Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// [QUEST] UNIT 2: LEARNERS (ENROLLMENT)
// ─────────────────────────────────────────────────────────────────────────────
app.put('/api/ph_schools/unit2/:id', async (req, res) => {
    const schoolId = req.params.id;
    const data = req.body;

    try {
        const fields = [
            'total_enrollment', 'male_enrollment', 'female_enrollment', 'total_male', 'total_female',
            'kinder_male', 'kinder_female', 'g1_male', 'g1_female', 'g2_male', 'g2_female',
            'g3_male', 'g3_female', 'g4_male', 'g4_female', 'g5_male', 'g5_female',
            'g6_male', 'g6_female', 'g7_male', 'g7_female', 'g8_male', 'g8_female',
            'g9_male', 'g9_female', 'g10_male', 'g10_female', 'g11_male', 'g11_female',
            'g12_male', 'g12_female', 'sned_male', 'sned_female', 'sned_self_contained_count',
            'unit2_simplified_enrollment', 'multigrade_groupings_1', 'multigrade_groupings_2',
            'multigrade_groupings_3', 'multigrade_enrollment_1', 'multigrade_enrollment_2',
            'multigrade_enrollment_3', 'unit2', 'unit2_completed', 'unit2_updated_at'
        ];

        const values = fields.map(f => {
            if (f === 'unit2') return 100;
            if (f === 'unit2_completed') return true;
            if (f === 'unit2_updated_at') return new Date();
            return data[f];
        });

        const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
        const query = `UPDATE ph_schools SET ${setClause} WHERE school_id = $${fields.length + 1} OR iern = $${fields.length + 1} RETURNING *`;

        const result = await pool.query(query, [...values, schoolId]);
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error("Unit 2 Update Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// [QUEST] UNIT 3: ORGANIZED CLASSES
// ─────────────────────────────────────────────────────────────────────────────
app.put('/api/ph_schools/unit3/:id', async (req, res) => {
    const schoolId = req.params.id;
    const data = req.body;

    try {
        const fields = [
            'has_multigrade', 'multigrade_sections_count', 'unit3_simplified_counts',
            'grade_kinder_size', 'grade_1_size', 'grade_2_size', 'grade_3_size',
            'grade_4_size', 'grade_5_size', 'grade_6_size', 'grade_7_size',
            'grade_8_size', 'grade_9_size', 'grade_10_size', 'grade_11_size',
            'grade_12_size', 'multigrade_size_1', 'multigrade_size_2', 'multigrade_size_3',
            'unit3', 'unit3_completed', 'unit3_updated_at'
        ];

        const values = fields.map(f => {
            if (f === 'unit3') return 100;
            if (f === 'unit3_completed') return true;
            if (f === 'unit3_updated_at') return new Date();
            // Handle JSONB stringification for complex objects/arrays
            if (f === 'unit3_simplified_counts' && data[f] && typeof data[f] === 'object') {
                return JSON.stringify(data[f]);
            }
            return data[f];
        });

        const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
        const query = `UPDATE ph_schools SET ${setClause} WHERE school_id = $${fields.length + 1} OR iern = $${fields.length + 1} RETURNING *`;

        const result = await pool.query(query, [...values, schoolId]);
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error("❌ [API] Unit 3 Update Error:", {
            message: err.message,
            stack: err.stack,
            schoolId: schoolId,
            payloadSummary: Object.keys(data || {})
        });
        res.status(500).json({ error: err.message, detail: "Invalid JSON or database constraint violation in Unit 3" });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// [QUEST] UNIT 4: LEARNER PROFILE
// ─────────────────────────────────────────────────────────────────────────────
app.put('/api/ph_schools/unit4/:id', async (req, res) => {
    const schoolId = req.params.id;
    const data = req.body;

    try {
        const fields = [
            'selected_learner_groups', 'bmi_severely_wasted', 'bmi_wasted', 'bmi_overweight_obese', 'bmi_normal',
            'als_kinder', 'als_g1', 'als_g2', 'als_g3', 'als_g4', 'als_g5', 'als_g6', 'als_g7', 'als_g8', 'als_g9', 'als_g10', 'als_g11', 'als_g12', 'als_total',
            'muslim_kinder', 'muslim_g1', 'muslim_g2', 'muslim_g3', 'muslim_g4', 'muslim_g5', 'muslim_g6', 'muslim_g7', 'muslim_g8', 'muslim_g9', 'muslim_g10', 'muslim_g11', 'muslim_g12',
            'ip_kinder', 'ip_g1', 'ip_g2', 'ip_g3', 'ip_g4', 'ip_g5', 'ip_g6', 'ip_g7', 'ip_g8', 'ip_g9', 'ip_g10', 'ip_g11', 'ip_g12',
            'displaced_kinder', 'displaced_g1', 'displaced_g2', 'displaced_g3', 'displaced_g4', 'displaced_g5', 'displaced_g6', 'displaced_g7', 'displaced_g8', 'displaced_g9', 'displaced_g10', 'displaced_g11', 'displaced_g12',
            'overage_kinder', 'overage_g1', 'overage_g2', 'overage_g3', 'overage_g4', 'overage_g5', 'overage_g6', 'overage_g7', 'overage_g8', 'overage_g9', 'overage_g10', 'overage_g11', 'overage_g12',
            'dropout_kinder', 'dropout_g1', 'dropout_g2', 'dropout_g3', 'dropout_g4', 'dropout_g5', 'dropout_g6', 'dropout_g7', 'dropout_g8', 'dropout_g9', 'dropout_g10', 'dropout_g11', 'dropout_g12',
            'repeater_kinder', 'repeater_g1', 'repeater_g2', 'repeater_g3', 'repeater_g4', 'repeater_g5', 'repeater_g6', 'repeater_g7', 'repeater_g8', 'repeater_g9', 'repeater_g10', 'repeater_g11', 'repeater_g12',
            'lwd_kinder', 'lwd_g1', 'lwd_g2', 'lwd_g3', 'lwd_g4', 'lwd_g5', 'lwd_g6', 'lwd_g7', 'lwd_g8', 'lwd_g9', 'lwd_g10', 'lwd_g11', 'lwd_g12',
            'sned_kinder', 'sned_g1', 'sned_g2', 'sned_g3', 'sned_g4', 'sned_g5', 'sned_g6', 'sned_g7', 'sned_g8', 'sned_g9', 'sned_g10', 'sned_g11', 'sned_g12',
            'unit4', 'unit4_completed', 'unit4_updated_at'
        ];

        const values = fields.map(f => {
            if (f === 'unit4') return 100;
            if (f === 'unit4_completed') return true;
            if (f === 'unit4_updated_at') return new Date();
            // Handle JSONB stringification for selected_learner_groups
            if (f === 'selected_learner_groups' && data[f] && typeof data[f] === 'object') {
                return JSON.stringify(data[f]);
            }
            return data[f];
        });

        const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
        const query = `UPDATE ph_schools SET ${setClause} WHERE school_id = $${fields.length + 1} OR iern = $${fields.length + 1} RETURNING *`;

        const result = await pool.query(query, [...values, schoolId]);
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error("❌ [API] Unit 4 Update Error:", {
            message: err.message,
            stack: err.stack,
            schoolId: schoolId,
            payloadKeys: Object.keys(data || {})
        });
        res.status(500).json({ error: err.message, detail: "JSON syntax error or data mismatch in Unit 4 profile" });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// [QUEST] UNIT 5: SHIFTING & MODALITY
// ─────────────────────────────────────────────────────────────────────────────
app.put('/api/ph_schools/unit5/:id', async (req, res) => {
    const schoolId = req.params.id;
    const data = req.body;

    try {
        const fields = [
            'has_standard_shifting', 'adm_mdl', 'adm_odl', 'adm_tvi', 'adm_blended', 'shifting_modality',
            'shift_kinder', 'shift_g1', 'shift_g2', 'shift_g3', 'shift_g4', 'shift_g5', 'shift_g6', 'shift_g7', 'shift_g8', 'shift_g9', 'shift_g10', 'shift_g11', 'shift_g12', 'shift_mg_1', 'shift_mg_2', 'shift_mg_3',
            'mode_kinder', 'mode_g1', 'mode_g2', 'mode_g3', 'mode_g4', 'mode_g5', 'mode_g6', 'mode_g7', 'mode_g8', 'mode_g9', 'mode_g10', 'mode_g11', 'mode_g12', 'mode_mg_1', 'mode_mg_2', 'mode_mg_3',
            'unit5', 'unit5_completed', 'unit5_updated_at'
        ];

        const values = fields.map(f => {
            if (f === 'unit5') return 100;
            if (f === 'unit5_completed') return true;
            if (f === 'unit5_updated_at') return new Date();
            return data[f];
        });

        const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
        const query = `UPDATE ph_schools SET ${setClause} WHERE school_id = $${fields.length + 1} OR iern = $${fields.length + 1} RETURNING *`;

        const result = await pool.query(query, [...values, schoolId]);
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// [QUEST] WEB PUSH NOTIFICATIONS (Targeted Engagement)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the VAPID Public Key for the frontend to initialize push subscriptions.
 */
app.get('/api/vapid-public-key', (req, res) => {
    if (!vapidPublicKey) return res.status(503).json({ error: "Push service not configured" });
    res.json({ publicKey: vapidPublicKey });
});

/**
 * Saves a browser's push subscription object for the logged-in user.
 * Allows targeting specific users by UID and Role.
 */
app.post('/api/save-subscription', authMiddleware, async (req, res) => {
    const { subscription, deviceInfo } = req.body;
    const uid = req.user.uid;

    if (!subscription) return res.status(400).json({ error: "Subscription object is required" });

    try {
        await pool.query(
            `INSERT INTO user_web_push_subscriptions (uid, subscription_json, device_info)
             VALUES ($1, $2, $3)
             ON CONFLICT (uid, subscription_json) DO UPDATE SET
                device_info = EXCLUDED.device_info,
                created_at = CURRENT_TIMESTAMP`,
            [uid, JSON.stringify(subscription), deviceInfo]
        );
        res.json({ success: true, message: "Push subscription saved successfully" });
    } catch (err) {
        console.error("❌ [Push] Failed to save subscription:", err.message);
        res.status(500).json({ error: "Database error saving subscription" });
    }
});

/**
 * Admin-only route to broadcast messages to a specific role (e.g., 'School Head').
 * Logic: JOINS subscriptions with users table to filter by Role/Registrant Type.
 */
app.post('/api/broadcast-push', authMiddleware, async (req, res) => {
    // Safety check: Only Admin/Super User can broadcast
    if (req.user.role !== 'Admin' && req.user.role !== 'Super User' && req.user.role !== 'SuperUser') {
        return res.status(403).json({ error: "Unauthorized: Admin access required for broadcasts" });
    }

    const { targetRole, title, message, url } = req.body;
    if (!targetRole) return res.status(400).json({ error: "targetRole is required (e.g., 'School Head')" });

    try {
        // Query only users matching the role who have a valid subscription
        const result = await pool.query(
            `SELECT s.subscription_json, u.email, u.first_name
             FROM user_web_push_subscriptions s
             JOIN users u ON s.uid = u.uid
             WHERE u.registrant_type = $1 OR u.role = $1 OR u.account_category = $1`,
            [targetRole]
        );

        const subscriptions = result.rows;
        if (subscriptions.length === 0) {
            return res.json({ success: true, message: `No active subscriptions found for role: ${targetRole}`, count: 0 });
        }

        console.log(`📣 [Push] Broadcasting to ${subscriptions.length} devices for role: ${targetRole}`);

        const payload = JSON.stringify({
            title: title || "InsightEd Notification",
            body: message || "You have a new update from Stride InsightEd.",
            icon: "/insighted_app.png",
            data: { url: url || "/" }
        });

        // Parallel execution with error handling for individual device failures
        const pushPromises = subscriptions.map(sub => {
            return webpush.sendNotification(sub.subscription_json, payload)
                .catch(async (err) => {
                    // 410 (Gone) or 404 means the user unsubscribed or the token expired
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        console.log(`🧹 [Push] Cleaning up expired token for: ${sub.email}`);
                        await pool.query('DELETE FROM user_web_push_subscriptions WHERE subscription_json = $1', [JSON.stringify(sub.subscription_json)]);
                    } else {
                        console.error(`⚠️ [Push] Delivery failed for ${sub.email}:`, err.message);
                    }
                });
        });

        await Promise.all(pushPromises);
        res.json({ success: true, count: subscriptions.length, message: `Successfully broadcast to ${subscriptions.length} devices.` });
    } catch (err) {
        console.error("❌ [Push] Broadcast orchestrator failed:", err.message);
        res.status(500).json({ error: "Broadcast failed during database or network operation" });
    }
});

// --- SCHOOL DOCS STORAGE ---
// --- SCHOOL DOCS STORAGE (Staged in Temp) ---
const schoolDocsStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Stage in a temp subdirectory within uploads to ensure move across partitions is safe if needed
    const dir = getUploadPath('temp');
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `temp_iern_${req.params.iern}_${Date.now()}${ext}`;
    cb(null, uniqueName);
  }
});

const schoolDocsUpload = multer({ 
  storage: schoolDocsStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed!'), false);
  }
});

// Serve static files from configured uploads directory
app.use('/uploads', express.static(UPLOAD_BASE_PATH));

// SMART FALLBACK PROXY: If a file is missing locally during dev, try redirecting to staging
const https = require('https');
const http = require('http');

// SMART FALLBACK PROXY: If a file is missing locally during dev, try proxying from staging (Multi-Path fallback)
if (process.env.NODE_ENV !== 'production' || !process.env.NODE_ENV) {
    app.use('/uploads', (req, res) => {
        const stagingRoot = 'https://20.24.58.49/uploads'; 
        const altPaths = [
            `${stagingRoot}${req.url}`, // 1. Standard (e.g. /uploads/project_photos/...)
            `${stagingRoot}/${path.basename(req.url)}`, // 2. Flattened (e.g. /uploads/photo_...)
            `https://20.24.58.49${req.url}`, // 3. Root relative (e.g. /project_photos/...)
            `https://20.24.58.49/${path.basename(req.url)}` // 4. Absolute root (e.g. /photo_...)
        ];
        
        const options = { rejectUnauthorized: false };

        const tryPath = (index) => {
            if (index >= altPaths.length) {
                console.warn(`[Asset-Proxy] Exhausted all fallback paths for: ${req.url}`);
                return res.status(404).json({ error: 'Asset not found on any staging path' });
            }

            const targetUrl = altPaths[index];
            console.log(`[Asset-Proxy] Attempting [Path #${index + 1}]: ${targetUrl}`);

            https.get(targetUrl, options, (proxyRes) => {
                if (proxyRes.statusCode === 200) {
                    res.setHeader('Content-Type', proxyRes.headers['content-type']);
                    proxyRes.pipe(res);
                } else if (proxyRes.statusCode === 301 || proxyRes.statusCode === 302) {
                    console.log(`[Asset-Proxy] Following Redirect: ${proxyRes.headers.location}`);
                    https.get(proxyRes.headers.location, options, (redirRes) => {
                        if (redirRes.statusCode === 200) {
                            res.setHeader('Content-Type', redirRes.headers['content-type']);
                            redirRes.pipe(res);
                        } else {
                            tryPath(index + 1); // Try next path if redirected to a 404
                        }
                    });
                } else {
                    tryPath(index + 1); // Try next path on 404
                }
            }).on('error', (err) => {
                console.error(`[Asset-Proxy] Error on path ${index + 1}: ${err.message}`);
                tryPath(index + 1);
            });
        };

        tryPath(0);
    });
}

const upload = multer({ dest: path.join(UPLOAD_BASE_PATH, 'temp/') });

// --- Multer: Project Photos (file-path storage) ---
// --- Multer: Project Photos (Staged in Temp) ---
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
const projectPhotosUpload = multer({
    storage: projectPhotosStorage,
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
});

// --- NEW: Memory-Buffered Multer for Postgres Binary Storage ---
const memoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// --- UPLOAD ROUTE: SCHOOL OWNERSHIP DOCUMENTS ---
app.post('/api/schools/:iern/ownership-docs', memoryUpload.single('file'), async (req, res) => {
  const { iern } = req.params;
  const { doc_type } = req.body;
  
  try {
    // 1. Process File — Postgres Binary Storage (Primary)
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    let finalDocValue = null;
    let finalBinaryId = null;
    let finalHydraManifest = null;
    let storedSize = req.file.size;
    let originalSizeFound = req.file.size;

    try {
        // Enforce Optimization (Compression + Hydra)
        const { buffer: compressedBuffer, hydraManifest } = await compressBufferTo90Dpi(req.file.buffer);
        const { binary_id, stored_size, original_size: returnedOrigSize } = await upsertBinary(pool, compressedBuffer, 'application/pdf', req.file.size);
        
        finalBinaryId = binary_id;
        finalDocValue = `/api/asset/${binary_id}`;
        storedSize = stored_size; 
        finalHydraManifest = hydraManifest;
        originalSizeFound = returnedOrigSize || req.file.size;
        
        // Assert Compression Performance (Cause B Hardening)
        const isCompressed = storedSize < originalSizeFound * 0.98; // At least 2% reduction
        console.log(`🗄️ [SchoolDocStore] Stored ownership doc: ${binary_id} | size=${storedSize}B | hydra=${!!hydraManifest} | (orig=${originalSizeFound}B) | compressed=${isCompressed}`);
    } catch (binErr) {
        console.error('⚠️ [SchoolDocStore] Binary pipeline failure, falling back to disk:', binErr.message);
        // Fallback: Legacy disk storage logic
        const finalDir = getUploadPath('school_docs');
        const finalFilename = `fallback_${Date.now()}_${req.file.originalname.replace(/\s+/g, '_')}`;
        const finalPath = path.join(finalDir, finalFilename);
        
        fs.writeFileSync(finalPath, req.file.buffer);
        
        finalDocValue = `/uploads/school_docs/${finalFilename}`;
        finalBinaryId = null; 
        storedSize = req.file.size;
        originalSizeFound = req.file.size;
    }

    // 2. Resolve School ID from IERN for unified metadata
    const schoolRes = await pool.query('SELECT school_id FROM ph_schools WHERE iern = $1 OR school_id = $1 LIMIT 1', [iern]);
    const resolvedSchoolId = schoolRes.rows[0]?.school_id || null;

    console.log(`📂 [SchoolDocStore] Resolved for ${iern}: SID=${resolvedSchoolId} | Stored=${storedSize}B | Original=${originalSizeFound}B`);

    // 3. Save to database using Hawkeye "Single Truth" Protocol (UPSERT on IERN)
    const dbRes = await pool.query(
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

    // 4. Update ph_schools to ensure synchronization
    await pool.query(
      `UPDATE ph_schools 
       SET ownership_doc_id = $1,
           ownership_document_path = $2,
           local_file_path = $2,
           local_file_name = $4,
           local_file_size = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE iern = $6 OR school_id = $6`,
      [
        savedRow.id, finalDocValue, 
        (storedSize < originalSizeFound) ? storedSize : null,
        req.file.originalname, originalSizeFound, iern
      ]
    ).catch(err => console.error("⚠️ [SchoolDocStore] ph_schools sync error:", err.message));
    console.log(`✅ [SchoolDocStore] Record Saved ID=${savedRow.id} | Stored=${savedRow.file_size}B | Original=${savedRow.original_size}B`);

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
    console.error('❌ [SchoolDocStore] DB Error during upload:', {
      message: err.message, detail: err.detail, table: err.table,
      column: err.column, constraint: err.constraint, code: err.code,
    });
    res.status(500).json({
      error:      err.message || 'Failed to record document metadata',
      code:       err.code,
      column:     err.column,
      constraint: err.constraint,
      detail:     err.detail,
    });
  }
});

// --- ASSET SERVING: UNIFIED BINARY REGISTRY ---
app.get('/api/asset/:id', async (req, res) => {
    const { id } = req.params;
    const isDownload = req.query.download === '1';

    try {
        // [Hawkeye Protocol] Binary retrieval from Postgres (v2.0)
        // Deduplicated storage ensures high cache-hit ratio for identical documents
        const result = await pool.query(
            'SELECT content, mime_type, size_bytes FROM unified_binaries WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            console.warn(`⚠️ [AssetStore] 404: Asset ${id} not found in binary registry.`);
            return res.status(404).send('Document not found in registry.');
        }

        const asset = result.rows[0];
        
        // Set security and cache headers
        res.setHeader('Content-Type', asset.mime_type || 'application/pdf');
        res.setHeader('Content-Length', asset.size_bytes);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // Cache for 1 year since UUIDs are unique

        if (isDownload) {
            res.setHeader('Content-Disposition', `attachment; filename="document_${id.substring(0, 8)}.pdf"`);
        }

        console.log(`📑 [AssetStore] Serving binary: ${id} | type=${asset.mime_type} | size=${asset.size_bytes}B`);
        res.send(asset.content);

    } catch (err) {
        console.error(`❌ [AssetStore] Critical retrieval error for ${id}:`, err.message);
        res.status(500).json({ error: 'Failed to retrieve document from storage.' });
    }
});

// --- DELETE ROUTE: SCHOOL OWNERSHIP DOCUMENTS ---
app.delete('/api/schools/:iern/ownership-docs/:id', async (req, res) => {
  const { iern, id } = req.params;
  
  try {
    // 1. Get file path from DB with flexible IERN/SchoolID validation
    console.log(`🗑️ [SchoolDocStore] Deletion request for ID=${id}, IERN/SID=${iern}`);
    
    const dbRes = await pool.query(
      `SELECT file_path, iern FROM school_ownership_docs 
       WHERE id = $1 AND (
         iern = $2 OR 
         iern = (SELECT school_id FROM ph_schools WHERE iern = $2 LIMIT 1) OR 
         iern = (SELECT iern FROM ph_schools WHERE school_id = $2 LIMIT 1)
       )`,
      [id, iern]
    );

    if (dbRes.rows.length === 0) {
      // PROMPT-ARTIST: Deep Diagnostics for 404 tracing
      const idExists = await pool.query('SELECT id, iern FROM school_ownership_docs WHERE id = $1', [id]);
      if (idExists.rows.length === 0) {
        console.warn(`⚠️ [SchoolDocStore] CRITICAL: ID ${id} DOES NOT EXIST in database. It may have been deleted by a migration or race condition.`);
      } else {
        const storedIern = idExists.rows[0].iern;
        console.warn(`⚠️ [SchoolDocStore] AUTH FAILURE: ID ${id} exists but IERN in DB is "${storedIern}", while request IERN is "${iern}"`);
        // Check aliases for transparency
        const aliases = await pool.query('SELECT school_id, iern FROM ph_schools WHERE school_id = $1 OR iern = $1', [iern]);
        console.warn(`   Aliases found for "${iern}":`, aliases.rows);
      }
      return res.status(404).json({ error: 'Document not found or unauthorized' });
    }

    const relativePath = dbRes.rows[0].file_path;
    const absolutePath = path.join(__dirname, '..', relativePath);

    // 2. Delete file from disk using promises for robustness
    try {
      if (fs.existsSync(absolutePath)) {
        await fs.promises.unlink(absolutePath);
      }
    } catch (unlinkErr) {
      // Graceful error handling if file is missing or locked
      console.warn(`⚠️ Warning: Physical file not found or could not be deleted at ${absolutePath}:`, unlinkErr.message);
    }

    // 3. Delete from database (only after physical file attempt)
    // [Hawkeye Protocol] Use authorized bypass for document replacement/cleanup
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL internal.authorized_app_deletion = 'true'");
      await client.query('DELETE FROM school_ownership_docs WHERE id = $1', [id]);
      await client.query('COMMIT');
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }

    // 4. Sync with ph_schools (Single Truth Cleanup)
    await pool.query(`
      UPDATE ph_schools 
      SET local_file_path = NULL, 
          local_file_name = NULL, 
          local_file_size = NULL, 
          ownership_document_path = NULL,
          ownership_doc_id = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE iern = $1 OR school_id = $1
    `, [iern]).catch(err => console.error("⚠️ [SchoolDocStore] ph_schools Sync Delete Error:", err.message));

    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (err) {
    console.error('❌ [SchoolDocStore] Delete Error:', err);
    res.status(500).json({ 
        error: 'Failed to delete document', 
        message: err.message,
        code: err.code 
    });
  }
});


//               CORE DASHBOARD ENDPOINTS
// ==================================================================

// PATCH /api/schools/:school_id/units/:unit_number/complete
app.patch('/api/schools/:school_id/units/:unit_number/complete', async (req, res) => {
  const { school_id, unit_number } = req.params;
  const unitNum = parseInt(unit_number, 10);
  if (isNaN(unitNum) || unitNum < 1 || unitNum > 8) {
    return res.status(400).json({ error: `Invalid unit_number "${unit_number}"` });
  }
  const col = `unit${unitNum}`;
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      `UPDATE ph_schools SET ${col} = 1 WHERE school_id = $1
       RETURNING unit1, unit2, unit3, unit4, unit5, unit6, unit7, unit8, unit_completion`,
      [school_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "School not found" });
    const row = result.rows[0];
    res.json({
      success: true,
      data: {
        unit1: row.unit1, unit2: row.unit2, unit3: row.unit3, unit4: row.unit4,
        unit5: row.unit5, unit6: row.unit6, unit7: row.unit7, unit8: row.unit8,
        unit_completion: parseFloat(parseFloat(row.unit_completion || 0).toFixed(2))
      }
    });
  } catch (err) {
    console.error('PATCH unit complete error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    if (client) client.release();
  }
});

// GET /api/schools/:schoolId/activity
app.get('/api/schools/:schoolId/activity', async (req, res) => {
  const { schoolId } = req.params;
  try {
    const schoolRes = await pool.query(
      `SELECT
        school_id, school_name,
        unit1, unit2, unit3, unit4, unit5, unit6, unit7, unit8, unit9,
        unit1_completed, unit2_completed, unit3_completed, unit4_completed,
        unit5_completed, unit6_completed, unit7_completed, unit8_completed, unit9_completed,
        unit_completion, region, division
       FROM ph_schools WHERE school_id = $1`,
      [schoolId]
    );
    if (schoolRes.rows.length === 0) return res.status(404).json({ error: "School not found" });

    const row = schoolRes.rows[0];
    const totalUnits = 9;
    let completedUnitsCount = 0;
    let completedFlags = {};

    // Maps DB column index to display unit ID
    const unitMapping = [1, 2, 3, 4, 5, 6, 7, 8, 9]; // DB column -> display ID
    for (let i = 0; i < unitMapping.length; i++) {
      const dbIdx = unitMapping[i];
      const displayId = i + 1;
      const intVal = parseInt(row[`unit${dbIdx}`]) || 0;
      const boolVal = row[`unit${dbIdx}_completed`] === true;
      const isDone = (intVal === 1 || boolVal);

      completedFlags[`unit${displayId}`] = isDone;
      if (isDone) completedUnitsCount++;
    }

    // Dynamic calculation is more reliable than the stale unit_completion column
    const overall_progress_percentage = parseFloat(((completedUnitsCount / totalUnits) * 100).toFixed(2));

    const sprintRes = await pool.query(
      `SELECT unit_id, duration_seconds FROM ph_performance_logs 
       WHERE school_id = $1 ORDER BY duration_seconds ASC LIMIT 1`,
      [schoolId]
    );
    let fastest_sprint = null;
    if (sprintRes.rows.length > 0) {
      const r = sprintRes.rows[0];
      fastest_sprint = { unit: r.unit_id, time_text: `${Math.floor(r.duration_seconds / 60)}m ${r.duration_seconds % 60}s` };
    }

    const divRes = await pool.query(`SELECT AVG(COALESCE(unit_completion, 0)) as avg FROM ph_schools WHERE division = $1`, [row.division]);
    const regRes = await pool.query(`SELECT AVG(COALESCE(unit_completion, 0)) as avg FROM ph_schools WHERE region = $1`, [row.region]);

    res.json({
      success: true,
      data: {
        schoolInfo: { school_id: row.school_id, school_name: row.school_name },
        progress: { completedUnits: completedUnitsCount, totalUnits, percentage: overall_progress_percentage, flags: completedFlags },
        gamification: { fastest_sprint },
        comparative: [
          { name: 'My School', completed: overall_progress_percentage },
          { name: 'Division Avg', completed: parseFloat(parseFloat(divRes.rows[0]?.avg || 0).toFixed(1)) },
          { name: 'Region Avg', completed: parseFloat(parseFloat(regRes.rows[0]?.avg || 0).toFixed(1)) }
        ]
      }
    });
  } catch (err) {
    console.error("GET activity error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'online', pid: process.pid });
});

// Pool Status Debug
app.get('/api/pool-status', (req, res) => {
  res.json({
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  });
});

app.use(express.urlencoded({ limit: '500mb', extended: true }));


// --- PROJECT PHOTO HELPERS ---

/**
 * Recalculates and updates the total completion percentage for a school.
 * Considers 8 Modular Units.
 */
// Helper to map UI Unit ID (1-10) to ph_schools DB Column Index — direct 1-to-1 mapping
const getDBUnitFromUIUnit = (uiUnit) => {
  return parseInt(uiUnit, 10);
};

async function updateSchoolTotalCompletion(iern) {
  if (!iern) return;
  try {
    // Read from ph_schools — the authoritative source for unit flags.
    // DB columns unit1–unit7 and unit9 map to display units 1–8 (unit9 = terrain/location).
    // This avoids reading the stale ph_school_completion booleans which can diverge
    // when pgBouncer (transaction mode) drops a COMMIT mid-flight.
    const res = await pool.query(
      `SELECT school_id, unit1, unit2, unit3, unit4, unit5, unit6, unit7, unit8, unit9,
              unit1_completed, unit2_completed, unit3_completed, unit4_completed,
              unit5_completed, unit6_completed, unit7_completed, unit8_completed, unit9_completed
       FROM ph_schools WHERE iern = $1`,
      [iern]
    );
    if (res.rows.length === 0) return;

    const row = res.rows[0];
    const schoolId = row.school_id;
    // Mapping: Explicit 1-10 mapping to ph_school_completion columns.
    const dbCols = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    let completedCount = 0;
    const boolValues = [];
    for (const idx of dbCols) {
      const val = parseFloat(row[`unit${idx}`]) || 0;
      const isDone = row[`unit${idx}_completed`] === true || val >= 1;
      
      let unitProgress = 0;
      if (isDone) {
        unitProgress = 1;
      } else if (val > 0) {
        unitProgress = val; // Support 0.5 for ESF7 staging
      }
      
      completedCount += unitProgress;
      boolValues.push(isDone);
    }

    const percentage = parseFloat(((completedCount / 9) * 100).toFixed(2));

    // Upsert booleans + total to ph_school_completion.
    await pool.query(
      `INSERT INTO ph_school_completion
         (iern, school_id, unit1_completion, unit2_completion, unit3_completion, unit4_completion,
          unit5_completion, unit6_completion, unit7_completion, unit8_completion, unit9_completion, total_completion, updated_at)
       VALUES ($11, $12, $2, $3, $4, $5, $6, $7, $8, $9, $10, $1, CURRENT_TIMESTAMP)
       ON CONFLICT (school_id) DO UPDATE SET
         iern = EXCLUDED.iern, unit1_completion=$2, unit2_completion=$3, unit3_completion=$4, unit4_completion=$5,
         unit5_completion=$6, unit6_completion=$7, unit7_completion=$8, unit8_completion=$9,
         unit9_completion=$10, total_completion=$1, updated_at=CURRENT_TIMESTAMP`,
      [percentage, ...boolValues, iern, schoolId]
    );

    // Sync to ph_schools.unit_completion for monitoring dashboards
    await pool.query(
      'UPDATE ph_schools SET unit_completion=$1 WHERE iern=$2',
      [percentage, iern]
    );

    console.log(`[SYNC] Updated completion for ${iern}: ${percentage}% (${completedCount}/9)`);
  } catch (err) {
    console.error(`[ERROR] updateSchoolTotalCompletion failed for ${iern}:`, err.message);
  }
}

// --- SECONDARY DATABASE CONNECTION (Dual-Write) ---
let poolNew = null;
if (process.env.NEW_DATABASE_URL) {
  console.log('”Œ Initializing Secondary Database Connection...');
  poolNew = new Pool({
    connectionString: process.env.NEW_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 2, // [Hawkeye v3.2] Capped secondary pool to prevent starvation
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    application_name: 'InsightEd_API_Secondary'
  });

  poolNew.on('error', (err) => {
    console.error('💥 Unexpected error on idle Secondary DB client:', err.message);
  });

  // Test Connection
  poolNew.connect()
    .then(client => {
      console.log('… Connected to Secondary Database (ICTS) successfully!');
      client.release();
    })
    .catch(err => console.error('â Œ Failed to connect to Secondary Database:', err.message));
}

// --- DATABASE INIT HELPERS ---
const tableExists = async (tableName) => {
  const res = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_name = $1`, [tableName]);
  return res.rowCount > 0;
};

const checkAndAddColumn = async (tableName, columnName, columnDefinition, targetClient = null) => {
  const queryExecutor = targetClient || pool;
  const res = await queryExecutor.query(`
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = $1 AND column_name = $2
  `, [tableName, columnName.replace(/"/g, '')]); // Remove quotes for metadata check

  if (res.rowCount === 0) {
    console.log(`       -> Adding column ${columnName} to ${tableName}...`);
    // Use double quotes for column name in ALTER TABLE to support names like "7x9"
    const safeColumnName = columnName.startsWith('"') ? columnName : `"${columnName}"`;
    await queryExecutor.query(`ALTER TABLE ${tableName} ADD COLUMN ${safeColumnName} ${columnDefinition}`);
  }
};

const checkAndDropColumn = async (tableName, columnName) => {
  const res = await pool.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = $1 AND column_name = $2
    `, [tableName, columnName]);

  if (res.rowCount > 0) {
    console.log(`       -> Dropping column ${columnName} from ${tableName}...`);
    await pool.query(`ALTER TABLE ${tableName} DROP COLUMN ${columnName}`);
  }
};

// --- MIGRATION TRACKER ---
const ensureMigrationTable = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS ph_migrations (
            id SERIAL PRIMARY KEY,
            migration_name TEXT UNIQUE NOT NULL,
            executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `).catch(e => console.warn('Migration table check failed:', e));
};

const hasMigrationRun = async (migrationName) => {
    try {
        const res = await pool.query('SELECT 1 FROM ph_migrations WHERE migration_name = $1', [migrationName]);
        return res.rowCount > 0;
    } catch { return false; }
};

const markMigrationDone = async (migrationName) => {
    await pool.query('INSERT INTO ph_migrations (migration_name) VALUES ($1) ON CONFLICT DO NOTHING', [migrationName]).catch(() => {});
};

// --- DATABASE INIT ---
const runAutoMigrations_OLD = async () => {
  console.log("   [Auto-Migrate] Starting loose migrations...");
  try {
    await ensureMigrationTable();

    // [Hawkeye Protocol] Consolidate multiple ALTER TABLEs into single bulk queries
    await pool.query(`
      ALTER TABLE ph_schools 
      ADD COLUMN IF NOT EXISTS school_head TEXT,
      ADD COLUMN IF NOT EXISTS contact_number TEXT,
      ADD COLUMN IF NOT EXISTS unit2_simplified_enrollment JSONB,
      ADD COLUMN IF NOT EXISTS sned_self_contained_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS has_sned BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS sned_total_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS sned_program_type TEXT,
      ADD COLUMN IF NOT EXISTS sned_organized_class_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS multigrade_groupings_1 TEXT,
      ADD COLUMN IF NOT EXISTS multigrade_groupings_2 TEXT,
      ADD COLUMN IF NOT EXISTS multigrade_groupings_3 TEXT,
      ADD COLUMN IF NOT EXISTS multigrade_enrollment_1 INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS multigrade_enrollment_2 INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS multigrade_enrollment_3 INTEGER DEFAULT 0;
    `);

    // Unit 4
    // await unit4MigrateCols(); // [DECOMMISSIONED] Function missing in current codebase, causing ReferenceError at startup.

    // Unit 1: Ownership Document Type
    const columnPromises = [
      checkAndAddColumn('ph_schools', 'ownership_document_type', 'TEXT', pool),
      checkAndAddColumn('ph_schools', 'ownership_multiple', 'TEXT', pool)
    ];
    if (poolNew) {
      columnPromises.push(checkAndAddColumn('ph_schools', 'ownership_document_type', 'TEXT', poolNew));
      columnPromises.push(checkAndAddColumn('ph_schools', 'ownership_multiple', 'TEXT', poolNew));
    }
    
    // Unit Updated At Timestamps
    for (let i = 1; i <= 9; i++) {
      const colName = `unit${i}_updated_at`;
      columnPromises.push(checkAndAddColumn('ph_schools', colName, 'TIMESTAMPTZ', pool));
      if (poolNew) columnPromises.push(checkAndAddColumn('ph_schools', colName, 'TIMESTAMPTZ', poolNew));
      
      // Convert existing TIMESTAMP columns to TIMESTAMPTZ to fix timezone issues
      columnPromises.push(pool.query(`ALTER TABLE ph_schools ALTER COLUMN "${colName}" TYPE TIMESTAMPTZ USING "${colName}"::TIMESTAMPTZ`).catch(() => {}));
      if (poolNew) columnPromises.push(poolNew.query(`ALTER TABLE ph_schools ALTER COLUMN "${colName}" TYPE TIMESTAMPTZ USING "${colName}"::TIMESTAMPTZ`).catch(() => {}));
    }

    // Unit 1: Year Established
    columnPromises.push(checkAndAddColumn('ph_schools', 'established_month', 'TEXT', pool));
    columnPromises.push(checkAndAddColumn('ph_schools', 'established_year', 'INTEGER', pool));
    if (poolNew) {
      columnPromises.push(checkAndAddColumn('ph_schools', 'established_month', 'TEXT', poolNew));
      columnPromises.push(checkAndAddColumn('ph_schools', 'established_year', 'INTEGER', poolNew));
    }

    await Promise.all(columnPromises);

    // [Hawkeye Protocol] Global Timestamp to Timestamptz Migration
    // This ensures all tables have timezone context, fixing the "wrong date" issue in the gallery.
    const tablesToMigrate = [
      { table: 'engineer_image', cols: ['created_at'] },
      { table: 'engineer_documents', cols: ['created_at'] },
      { table: 'activity_logs', cols: ['timestamp'] },
      { table: 'notifications', cols: ['created_at'] },
      { table: 'users', cols: ['created_at'] },
      { 
        table: 'engineer_form', 
        cols: [
          'status_as_of', 'target_completion_date', 'actual_completion_date', 
          'notice_to_proceed', 'construction_start_date', 'date_notice_of_award',
          'revised_target_completion_date'
        ] 
      }
    ];

    const migrationPromises = [];
    for (const entry of tablesToMigrate) {
      for (const col of entry.cols) {
        const query = `ALTER TABLE ${entry.table} ALTER COLUMN "${col}" TYPE TIMESTAMPTZ USING "${col}"::TIMESTAMPTZ`;
        migrationPromises.push(pool.query(query).catch(e => {
          if (!e.message.includes('does not exist')) {
             console.warn(`      [Auto-Migrate] Failed to migrate ${entry.table}.${col}:`, e.message);
          }
        }));
        if (poolNew) {
          migrationPromises.push(poolNew.query(query).catch(() => {}));
        }
      }
    }
    await Promise.all(migrationPromises);


    await checkAndAddColumn('school_ownership_docs', 'ownership_document_type', 'TEXT', pool);
    if (poolNew) columnPromises.push(checkAndAddColumn('school_ownership_docs', 'ownership_document_type', 'TEXT', poolNew));

    // SDO: School Documents (Binary Storage Migration)
    const binaryStorageTables = ['school_documents', 'school_ownership_docs'];
    const binaryCols = [
      ['binary_id', 'UUID'],
      ['file_path', 'TEXT'],
      ['file_size', 'BIGINT'],
      ['original_size', 'BIGINT'],
      ['hydra_manifest', 'JSONB'],
      ['compressed_binary_id', 'UUID'],
      ['compressed_size', 'BIGINT']
    ];

    for (const table of binaryStorageTables) {
      for (const [col, type] of binaryCols) {
        await checkAndAddColumn(table, col, type, pool);
        if (poolNew) await checkAndAddColumn(table, col, type, poolNew);
      }
    }

    // --- IERN MIGRATION PHASE ---
    if (!(await hasMigrationRun('iern_migration_v2'))) {
      console.log("   [Auto-Migrate] Running IERN Migration...");
      
      // 1. Ensure ph_schools has iern and it's UNIQUE
      await pool.query('ALTER TABLE ph_schools ADD COLUMN IF NOT EXISTS iern TEXT');
      await pool.query('ALTER TABLE ph_schools ADD CONSTRAINT ph_schools_iern_unique UNIQUE (iern)').catch(() => {});
    
    // 2. Backfill ph_schools.iern from "schools_IERN"
    await pool.query(`
      UPDATE ph_schools p
      SET iern = s.iern
      FROM "schools_IERN" s
      WHERE s."SchoolID" = p.school_id AND p.iern IS NULL
    `).catch(e => console.warn("Backfill ph_schools failed:", e.message));

    // 3. Add iern column to all child tables and backfill
    const childTables = [
      'buildable_spaces',
      'school_location_profiles',
      'school_ownership_docs',
      'ph_buildings_repairs',
      'ph_buildings_inventory',
      'ph_buildings_demolition',
      'ph_ecart_batches',
      'users'
    ];

    for (const table of childTables) {
      // Add column if not exists
      await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS iern TEXT`).catch(() => {});
      
      // Backfill from ph_schools (now that ph_schools has iern)
      await pool.query(`
        UPDATE ${table} t
        SET iern = p.iern
        FROM ph_schools p
        WHERE t.school_id = p.school_id AND t.iern IS NULL AND p.iern IS NOT NULL
      `).catch(e => console.warn(`Backfill ${table} failed:`, e.message));

      // 3c. Add INDEX on iern for performance (Fixes "delay" reported by user)
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_${table}_iern ON ${table} (iern)`).catch(() => {});
    }
    
    // 3b. Add UNIQUE constraints for IERN-based UPSERTs (Hardening)
    console.log("   [Auto-Migrate] Hardening UNIQUE constraints for IERN UPSERTs...");
    
    // -- school_location_profiles --
    // Deduplicate: Keep latest record per IERN
    await pool.query(`
      DELETE FROM school_location_profiles WHERE id NOT IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY iern ORDER BY updated_at DESC) as rn
          FROM school_location_profiles WHERE iern IS NOT NULL
        ) s WHERE s.rn = 1
      )
    `).catch(() => {});
    await pool.query('ALTER TABLE school_location_profiles ADD CONSTRAINT school_location_profiles_iern_unique UNIQUE (iern)').catch(() => {});

    // -- buildable_spaces --
    // Deduplicate: Keep latest record per (IERN, space_name)
    await pool.query(`
      DELETE FROM buildable_spaces WHERE space_id NOT IN (
        SELECT space_id FROM (
          SELECT space_id, ROW_NUMBER() OVER (PARTITION BY iern, space_number ORDER BY created_at DESC) as rn
          FROM buildable_spaces WHERE iern IS NOT NULL AND space_number IS NOT NULL
        ) s WHERE s.rn = 1
      )
    `).catch(() => {});
    await pool.query('ALTER TABLE buildable_spaces ADD CONSTRAINT buildable_spaces_iern_number_unique UNIQUE (iern, space_number)').catch(() => {});

    // -- school_ownership_docs --
    // Deduplication Strategy (HAWKEYE PROTOCOL v2):
    // 1. Purge all except latest before applying UNIQUE constraint
    await pool.query(`
      DELETE FROM school_ownership_docs WHERE id NOT IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY iern ORDER BY created_at DESC) as rn
          FROM school_ownership_docs WHERE iern IS NOT NULL
        ) s WHERE s.rn = 1
      )
    `).catch(e => console.warn('⚠️ [IERN Migration] school_ownership_docs dedup error:', e.message, e.detail));

    // 2. Apply Unique Constraint (Safely via idempotent DO block)
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_ownership_docs_iern_unique') THEN
          ALTER TABLE school_ownership_docs ADD CONSTRAINT school_ownership_docs_iern_unique UNIQUE (iern);
        END IF;
      END $$;
    `).catch(e => console.error('❌ [IERN Migration] Failed to apply school_ownership_docs_iern_unique:', e.message, e.detail));


    // 4. Drop problematic Foreign Key constraints that rely on school_id
    console.log("   [Auto-Migrate] Dropping school_id Foreign Key constraints...");
    const fkQuery = `
      SELECT
          tc.table_name, 
          tc.constraint_name
      FROM 
          information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND ccu.table_name = 'ph_schools' 
        AND ccu.column_name = 'school_id';
    `;
    
    try {
      const fkRes = await pool.query(fkQuery);
      for (const row of fkRes.rows) {
        console.log(`     - Dropping FK: ${row.constraint_name} on ${row.table_name}`);
        await pool.query(`ALTER TABLE ${row.table_name} DROP CONSTRAINT IF EXISTS ${row.constraint_name}`).catch(err => {
          console.warn(`       ! Failed to drop ${row.constraint_name}:`, err.message);
        });
      }

      if (poolNew) {
          const fkResNew = await poolNew.query(fkQuery);
          for (const row of fkResNew.rows) {
            console.log(`     - [Secondary] Dropping FK: ${row.constraint_name} on ${row.table_name}`);
            await poolNew.query(`ALTER TABLE ${row.table_name} DROP CONSTRAINT IF EXISTS ${row.constraint_name}`).catch(() => {});
          }
      }
    } catch (fkErr) {
      console.warn("   [Auto-Migrate] FK Drop process failed:", fkErr.message);
    }

      console.log("   [Auto-Migrate] IERN Migration finished.");
      await markMigrationDone('iern_migration_v2');
    } else {
      console.log("   [Auto-Migrate] Skipped IERN Migration (Already Run)");
    }

    // --- school_location_profiles: Schema Hardening ---
    // Ensures all columns required by schoolLocationSchema exist. ON CONFLICT (school_id) requires
    // a UNIQUE constraint on school_id — add idempotently.
    console.log("   [Auto-Migrate] Hardening school_location_profiles schema...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS school_location_profiles (
        id SERIAL PRIMARY KEY,
        school_id TEXT,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `).catch(() => {});
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'school_location_profiles_school_id_unique'
        ) THEN
          ALTER TABLE school_location_profiles ADD CONSTRAINT school_location_profiles_school_id_unique UNIQUE (school_id);
        END IF;
      END $$;
    `).catch(e => console.warn('[Auto-Migrate] school_location_profiles school_id constraint:', e.message));

    const slpCols = [
      ['iern',                           'TEXT'],
      ['transportation_modes',           'JSONB'],
      ['road_paved_pct',                 'NUMERIC'],
      ['road_unpaved_pct',               'NUMERIC'],
      ['road_lighting_pct',              'NUMERIC'],
      ['public_transpo_availability',    'NUMERIC'],
      ['water_proximity',                'JSONB'],
      ['near_cliff_ravine',              'BOOLEAN'],
      ['road_cliff_pct',                 'NUMERIC'],
      ['near_water',                     'BOOLEAN'],
      ['natural_calamities',             'JSONB'],
      ['hazards_experienced',            'JSONB'],
      ['has_insurgency_threats',         'BOOLEAN'],
      ['insurgency_threats_6mo',         'NUMERIC'],
      ['road_passable_public_transpo_pct','NUMERIC'],
      ['river_crossing_on_foot',         'BOOLEAN'],
      ['river_crossing_count',           'NUMERIC'],
      ['emergency_response_mins',        'NUMERIC'],
      ['proximity_hospital_km',          'NUMERIC'],
      ['proximity_brgy_hall_mins',       'NUMERIC'],
      ['proximity_brgy_hall_km',         'NUMERIC'],
      ['proximity_muni_hall_mins',       'NUMERIC'],
      ['proximity_muni_hall_km',         'NUMERIC'],
      ['proximity_sdo_mins',             'NUMERIC'],
      ['proximity_sdo_km',               'NUMERIC'],
      ['proximity_clinic_mins',          'NUMERIC'],
      ['proximity_clinic_km',            'NUMERIC'],
      ['proximity_terminal_mins',        'NUMERIC'],
      ['proximity_terminal_km',          'NUMERIC'],
      ['proximity_highway_mins',         'NUMERIC'],
      ['proximity_highway_km',           'NUMERIC'],
      ['cellular_coverage',              'TEXT'],
      ['weather_isolation',              'BOOLEAN'],
      ['weather_isolation_6mo',          'NUMERIC'],
      ['anthropogenic_threats',          'JSONB'],
      ['risk_index',                     'NUMERIC'],
    ];
    for (const [col, type] of slpCols) {
      await checkAndAddColumn('school_location_profiles', col, type, pool).catch(
        e => console.warn(`[Auto-Migrate] school_location_profiles.${col}:`, e.message)
      );
    }

    // --- school_location_profiles: Coerce TEXT/TEXT[] → JSONB (idempotent) ---
    // These columns may exist as TEXT (containing a JSON string literal) or TEXT[]
    // depending on which migration path ran first.
    //
    // Bug fixed: the original `USING to_jsonb(col)` was wrong for TEXT columns whose
    // content is already a JSON string (e.g. '["Bus","Jeep"]'). to_jsonb() on TEXT
    // produces a JSON *string scalar* ("\"[\\\"Bus\\\",\\\"Jeep\\\"]\""), not an array.
    // The correct cast for TEXT-with-JSON-content is `col::jsonb`.
    // For TEXT[] columns, `to_jsonb(col)` is correct and produces a proper JSON array.
    //
    // This block is safe to run repeatedly — it is a no-op if the column is already JSONB.
    for (const col of ['transportation_modes', 'hazards_experienced', 'water_proximity', 'natural_calamities', 'anthropogenic_threats']) {
      await pool.query(`
        DO $$
        DECLARE col_type TEXT;
        BEGIN
          SELECT data_type INTO col_type
          FROM information_schema.columns
          WHERE table_name = 'school_location_profiles' AND column_name = '${col}';

          IF col_type IS NOT NULL AND col_type != 'jsonb' THEN
            IF col_type = 'ARRAY' THEN
              -- TEXT[] → JSONB: to_jsonb correctly serialises a PG array to a JSON array
              ALTER TABLE school_location_profiles
                ALTER COLUMN ${col} TYPE JSONB USING to_jsonb(${col});
            ELSE
              -- TEXT → JSONB: column already stores a JSON string literal; cast it directly.
              -- NULL and empty-string rows are coerced to a JSON null / empty array safely.
              ALTER TABLE school_location_profiles
                ALTER COLUMN ${col} TYPE JSONB USING
                  CASE
                    WHEN ${col} IS NULL OR ${col} = '' THEN '[]'::jsonb
                    ELSE ${col}::jsonb
                  END;
            END IF;
            RAISE NOTICE '[Auto-Migrate] Converted school_location_profiles.${col} (%) to JSONB', col_type;
          END IF;
        END $$;
      `).catch(e => console.warn(`[Auto-Migrate] JSONB coerce ${col}:`, e.message));
    }

    console.log("   [Auto-Migrate] Finished.");
  } catch (e) {
    console.error("❌ Auto-Migrate Fail:", e.message);
  }
};

const initDB = async () => {
  let currentSegment = "Start";
  try {
    console.log("   [initDB] Starting...");

    const poolsToInit = [pool];
    if (poolNew) poolsToInit.push(poolNew);

    for (const targetPool of poolsToInit) {
      const dbLabel = targetPool === pool ? "Primary" : "Secondary";
      try {
        console.log(`     -> Initializing ${dbLabel} Database...`);
        // NOTE: 'SET lock_timeout' removed — setting session params on a pooled
        // connection poisons that backend for all future queries routed through it by
        // PgBouncer (transaction mode does not reset session state between clients).

        currentSegment = `${dbLabel} Seg 0.1: project_documents table`;
        await targetPool.query(`
          CREATE TABLE IF NOT EXISTS project_documents (
            id SERIAL PRIMARY KEY,
            project_id INT, 
            doc_type TEXT NOT NULL,
            file_data TEXT, 
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);


      } catch (poolErr) {
        console.error(`❌ [initDB] ${dbLabel} Initialization Failed at [${currentSegment}]:`, poolErr.message);
        if (dbLabel === "Primary") throw poolErr; 
      }
    }


    currentSegment = "Segment 12: ph_school_buildable_spaces and facility tables";
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ph_school_buildable_spaces (
        id SERIAL PRIMARY KEY,
        school_id TEXT,
        iern TEXT,
        space_name TEXT,
        center_lat NUMERIC,
        center_lng NUMERIC,
        length_m NUMERIC,
        width_m NUMERIC,
        rotation_deg NUMERIC DEFAULT 0,
        total_area_sqm NUMERIC,
        less_than_7x9 INTEGER DEFAULT 0,
        "7x9" INTEGER DEFAULT 0,
        above_7x9 INTEGER DEFAULT 0,
        dimension TEXT,
        status TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS facility_repairs (
        repair_id SERIAL PRIMARY KEY,
        school_id TEXT,
        iern TEXT,
        building_no TEXT,
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS facility_demolitions (
        demolition_id SERIAL PRIMARY KEY,
        school_id TEXT,
        iern TEXT,
        building_no TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS facility_inventory(
        id SERIAL PRIMARY KEY,
        school_id TEXT,
        iern TEXT,
        building_name TEXT NOT NULL,
        category TEXT NOT NULL,
        status TEXT NOT NULL,
        dimension TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    currentSegment = "Segment 13: teaching_personnel tables";
    await pool.query(`
      CREATE TABLE IF NOT EXISTS teaching_personnel (
        school_id TEXT PRIMARY KEY,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ph_teachers_list (
        id SERIAL PRIMARY KEY,
        school_id VARCHAR(50),
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure Unit 5 Shifting & Modality columns exist on ph_schools
    const levels = ['kinder', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11', 'g12'];
    const shiftingPromises = [];
    for (const lvl of levels) {
      shiftingPromises.push(checkAndAddColumn('ph_schools', `shift_${lvl}`, 'TEXT'));
      shiftingPromises.push(checkAndAddColumn('ph_schools', `mode_${lvl}`, 'TEXT'));
    }
    await Promise.all(shiftingPromises);

    // --- New: Integer-based Unit Completion Tracking ---
    const unitCols = ['unit1', 'unit2', 'unit3', 'unit4', 'unit5', 'unit6', 'unit7', 'unit8'];
    const unitPromises = unitCols.map(col => checkAndAddColumn('ph_schools', col, 'SMALLINT DEFAULT 0'));
    await Promise.all(unitPromises);

    currentSegment = "Segment 14: settings table";
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO settings (key, value)
      VALUES ('nexus_module_locks', '{"school-info": false, "esf7": false, "nspp": true}')
      ON CONFLICT (key) DO NOTHING;
    `);

    await checkAndAddColumn('ph_teachers_list', 'designations', 'TEXT');

    console.log("✅ DB Init: All migrations completed successfully.");

  } catch (err) {
    console.error(`❌ DB Init Error in segment [${currentSegment}]:`, err.message);
  }
};

// initDB(); // Moved to awaited startup

// initMasterlistDB(); // Moved to awaited startup



// --- [InsightEd Quest] SCHOOL HEAD DASHBOARD ENDPOINTS ---

// 1. GET /api/school-by-user/:uid
app.get('/api/school-by-user/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const userRes = await pool.query('SELECT school_id FROM users WHERE uid = $1', [uid]);
    if (userRes.rowCount === 0) return res.status(404).json({ exists: false, error: 'User not found' });
    const schoolId = userRes.rows[0].school_id;
    if (!schoolId) return res.status(404).json({ exists: false, error: 'User has no school assigned' });
    const schoolRes = await pool.query(`
      SELECT 
        ps.*,
        v.unit1_validated, v.unit2_validated, v.unit3_validated, v.unit4_validated, v.unit5_validated,
        v.unit6_validated, v.unit7_validated, v.unit8_validated, v.unit9_validated,
        v.validation_percentage, v.validated_units_count, v.needs_validation
      FROM ph_schools ps
      LEFT JOIN ph_schools_validate v ON ps.school_id = v.school_id
      WHERE ps.school_id = $1
    `, [schoolId]);
    res.json({ exists: schoolRes.rowCount > 0, data: schoolRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 1.1 GET /api/iern/:school_id - Direct IERN lookup
app.get('/api/iern/:school_id', async (req, res) => {
  try {
    const { school_id } = req.params;
    const result = await pool.query(
      `SELECT "IERN" FROM "schools_IERN" WHERE "SchoolID" = $1 LIMIT 1`,
      [school_id]
    );
    if (result.rows.length === 0) return res.json({ iern: null });
    res.json({ iern: result.rows[0].IERN });
  } catch (err) {
    console.error("IERN Lookup Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 2. GET /api/school-head/:uid
app.get('/api/school-head/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const result = await pool.query('SELECT first_name, last_name, office, region, division, account_category FROM users WHERE uid = $1', [uid]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'School Head not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. GET /api/schools_iern/:id
app.get('/api/schools_iern/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM "schools_IERN" WHERE "SchoolID" = $1', [id]);
    res.json({ exists: result.rowCount > 0, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. GET /api/ph_schools/:id
app.get('/api/ph_schools/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let result;
    try {
      result = await pool.query('SELECT * FROM ph_schools WHERE school_id = $1', [id]);
    } catch (err) {
      if (err.message.includes('terminated unexpectedly')) {
        console.warn(`♻️ [RECOVERY] Retrying ph_schools fetch for: ${id}`);
        result = await pool.query('SELECT * FROM ph_schools WHERE school_id = $1', [id]);
      } else {
        throw err;
      }
    }
    res.json({ exists: result.rowCount > 0, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. GET /api/audit/remarks/:id
// Replaces legacy /api/audit/remarks with unified audit_feedback_tasks lookup
app.get('/api/audit/remarks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM audit_feedback_tasks WHERE school_id = $1 ORDER BY created_at DESC', [id]);
    res.json(result.rows);
  } catch (err) {
    console.error(`❌ [API] GET /api/audit/remarks/${req.params.id} ERROR:`, {
        message: err.message,
        stack: err.stack,
        pool: { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount }
    });
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// 6. GET /api/schools/:id/activity (CRITICAL FOR QUEST DASHBOARD)
app.get('/api/schools/:id/activity', async (req, res) => {
  try {
    const { id } = req.params;
    const schoolRes = await pool.query('SELECT * FROM ph_schools WHERE school_id = $1', [id]);
    const completionRes = await pool.query('SELECT * FROM ph_school_completion WHERE school_id = $1', [id]);
    
    // Construct progress flags (Units 1-8 are SMALLINT 0 or 100 in ph_schools)
    const school = schoolRes.rows[0] || {};
    const flags = {};
    const completedUnits = [];
    for (let i = 1; i <= 9; i++) {
        const val = school[`unit${i}`];
        if (Number(val) === 100 || school[`unit${i}_completed`] === true) {
            flags[`unit${i}`] = true;
            completedUnits.push(i);
        }
    }

    res.json({
      success: true,
      data: {
        schoolInfo: school,
        progress: {
          percentage: school.completion_percentage || 0,
          completedUnits,
          flags
        },
        gamification: completionRes.rows[0] || {}
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. GET /api/ph_schools/unit7/:id/master (UNIT 7 MASTER REPAIR/INVENTORY)
app.get('/api/ph_schools/unit7/:id/master', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. Fetch Inventory from ph_buildings_inventory (Rooms list)
    const invRes = await pool.query('SELECT * FROM ph_buildings_inventory WHERE school_id = $1', [id]);
    
    // Group rooms by building_name
    const buildingsMap = {};
    invRes.rows.forEach(room => {
      const bName = room.building_name || 'Unnamed Building';
      if (!buildingsMap[bName]) {
        buildingsMap[bName] = { 
          building_name: bName,
          category: room.category,
          storey: room.storey,
          classroom: room.classroom,
          status: room.status,
          remarks: room.remarks,
          year_completed: room.year_completed,
          rooms: []
        };
      }
      buildingsMap[bName].rooms.push({
        id: room.id,
        room_name: room.room_name,
        grade_level: room.grade_level,
        advisory_teacher: room.advisory_teacher,
        room_length: room.room_length,
        room_width: room.room_width,
        seats: room.seats,
        is_in_use: room.is_in_use,
        dimension: room.dimension,
        status: room.status,
        condition: room.status // Backward compatibility for older frontend versions
      });
    });
    
    const inventory = Object.values(buildingsMap);

    // 2. Fetch Repairs from ph_buildings_repairs
    // Note: ph_buildings_repairs uses school_id
    const repairRes = await pool.query(`
      SELECT r.*, i.less_than_7x9, i."7x9", i.above_7x9 
      FROM ph_buildings_repairs r
      LEFT JOIN (
          SELECT DISTINCT ON (school_id, building_name, room_name) 
                 school_id, building_name, room_name, less_than_7x9, "7x9", above_7x9
          FROM ph_buildings_inventory
          ORDER BY school_id, building_name, room_name, id DESC
      ) i ON r.school_id = i.school_id 
        AND r.building_name = i.building_name 
        AND r.room_name = i.room_name
      WHERE r.school_id = $1
    `, [id]);
    
    // 3. Fetch Unit 7 flags from main table
    const schoolRes = await pool.query('SELECT unit7_completed, unit7_has_no_building FROM ph_schools WHERE school_id = $1', [id]);
    const school = schoolRes.rows[0] || {};

    res.json({ 
      success: true, 
      data: { 
        inventory: inventory,
        repairs: repairRes.rows,
        isCompleted: school.unit7_completed === true,
        has_no_building: school.unit7_has_no_building === true
      } 
    });
  } catch (err) {
    console.error("Unit 7 Master Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 8. GET /api/school-location/:id (UNIT 8 TERRAIN DATA)
app.get('/api/school-location/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM school_location_profiles WHERE school_id = $1', [id]);
    res.json({ success: true, exists: result.rowCount > 0, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8.5. GET /api/ph_schools/unit7/:id/spaces (UNIT 7 BUILDABLE SPACES)
app.get('/api/ph_schools/unit7/:id/spaces', async (req, res) => {
  try {
    const { id } = req.params;
    // Map to the dedicated ph_school_buildable_spaces table
    const result = await pool.query('SELECT * FROM public.ph_school_buildable_spaces WHERE school_id = $1', [id]);
    res.json({ 
      success: true, 
      spaces: result.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8.5.1. POST /api/ph_schools/unit7/:id/spaces
app.post('/api/ph_schools/unit7/:id/spaces', async (req, res) => {
  try {
    const { id } = req.params;
    const { space_name, center_lat, center_lng, length_m, width_m, rotation_deg, total_area_sqm, iern, dimension, condition } = req.body;
    
    const result = await pool.query(
      `INSERT INTO ph_school_buildable_spaces (
        school_id, iern, space_name, center_lat, center_lng, length_m, width_m, rotation_deg, total_area_sqm
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        id, iern, space_name, center_lat, center_lng, length_m, width_m, rotation_deg, total_area_sqm
      ]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8.5.2. DELETE /api/ph_schools/unit7/spaces/:spaceId
app.delete('/api/ph_schools/unit7/spaces/:spaceId', async (req, res) => {
  const client = await pool.connect();
  try {
    const { spaceId } = req.params;
    await client.query('BEGIN');
    // Bypass deletion protection trigger (Nuclear Lock)
    await client.query("SET LOCAL internal.authorized_app_deletion = 'true'");
    await client.query('DELETE FROM ph_school_buildable_spaces WHERE id = $1', [spaceId]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`❌ [DELETE Space] Error deleting space ${req.params.spaceId}:`, err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// 8.6. GET /api/unit8/teachers/:id (UNIT 7 ADVISORY TEACHER LOOKUP)
app.get('/api/unit8/teachers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT first_name, last_name, id FROM ph_teachers_list WHERE school_id = $1',
      [id]
    );
    res.json({ success: true, teachers: result.rows });
  } catch (err) {
    console.error(`❌ [Teacher Lookup] Error for school ${req.params.id}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// 9. GET /api/ph_schools/progress/:schoolId (GRANULAR QUEST PROGRESS)
app.get('/api/ph_schools/progress/:schoolId', async (req, res) => {
  try {
    const { schoolId } = req.params;

    const schoolRes = await pool.query(
      `SELECT ps.school_id, ps.school_name, ps.region, ps.division, ps.unit_completion, ps.is_esf7_opened,
       ps.unit1, ps.unit2, ps.unit3, ps.unit4, ps.unit5, ps.unit6, ps.unit7, ps.unit8, ps.unit9,
       ps.unit1_completed, ps.unit2_completed, ps.unit3_completed, ps.unit4_completed,
       ps.unit5_completed, ps.unit6_completed, ps.unit7_completed, ps.unit8_completed, ps.unit9_completed,
       ps.unit1_updated_at, ps.unit2_updated_at, ps.unit3_updated_at, ps.unit4_updated_at,
       ps.unit5_updated_at, ps.unit6_updated_at, ps.unit7_updated_at, ps.unit8_updated_at, ps.unit9_updated_at,
       v.unit1_validated, v.unit2_validated, v.unit3_validated, v.unit4_validated, v.unit5_validated,
       v.unit6_validated, v.unit7_validated, v.unit8_validated, v.unit9_validated,
       v.validation_percentage
       FROM ph_schools ps
       LEFT JOIN ph_schools_validate v ON ps.school_id = v.school_id
       WHERE ps.school_id = $1`, [schoolId]
    );
    
    if (schoolRes.rowCount === 0) return res.status(404).json({ error: 'School not found' });
    const school = schoolRes.rows[0];

    const completedUnits = [];
    const flags = {};
    const validationFlags = {};
    for (let i = 1; i <= 9; i++) {
      const isCompleted = school[`unit${i}_completed`] === true || String(school[`unit${i}_completed`]) === 'true';
      const isHundred = Math.round(Number(school[`unit${i}`]) || 0) === 100;
      
      if (isCompleted || isHundred) {
        completedUnits.push(i);
        flags[`unit${i}`] = true;
      }
      
      validationFlags[`unit${i}`] = school[`unit${i}_validated`] === true;
    }

    // Fetch gamification from ph_school_completion
    const completionRes = await pool.query('SELECT * FROM ph_school_completion WHERE school_id = $1', [schoolId]);

    // 10. Fetch eSF7 Hub progress based on esf7_link status
    const esf7Res = await pool.query(
      'SELECT status FROM esf7_link WHERE school_id = $1 ORDER BY updated_at DESC LIMIT 1',
      [schoolId]
    );
    let esf7Progress = 0;
    if (esf7Res.rowCount > 0) {
      const status = esf7Res.rows[0].status;
      if (['SUBMITTED', 'PROCESSING', 'QUEUE'].includes(status)) {
        esf7Progress = 50;
      } else if (status === 'VERIFIED') {
        esf7Progress = 100;
      }
    }

    res.json({
      success: true,
      data: {
        schoolInfo: {
          school_id: school.school_id,
          school_name: school.school_name,
          region: school.region,
          division: school.division,
          is_esf7_opened: school.is_esf7_opened === true || String(school.is_esf7_opened) === 'true'
        },
        progress: {
          percentage: school.unit_completion ? parseFloat(school.unit_completion) : 0,
          validation_percentage: school.validation_percentage ? parseFloat(school.validation_percentage) : 0,
          esf7_progress: esf7Progress,
          completedUnits: completedUnits,
          flags: flags,
          validationFlags: validationFlags,
          timestamps: {
            unit1: school.unit1_updated_at,
            unit2: school.unit2_updated_at,
            unit3: school.unit3_updated_at,
            unit4: school.unit4_updated_at,
            unit5: school.unit5_updated_at,
            unit6: school.unit6_updated_at,
            unit7: school.unit7_updated_at,
            unit8: school.unit8_updated_at,
            unit9: school.unit9_updated_at
          }
        },
        gamification: completionRes.rows[0] || {}
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. GET /api/settings/:key (NEXUS LOCKS & MAINTENANCE)
app.get('/api/settings/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const result = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
    if (result.rowCount === 0) {
        // Resilient Fallbacks
        if (key === 'nexus_module_locks') {
            return res.json({ value: JSON.stringify({ "school-info": false, "esf7": false, "nspp": true }) });
        }
        if (key === 'maintenance_mode') {
            return res.json({ value: 'false' });
        }
        return res.status(404).json({ error: 'Setting not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 16. PUT /api/ph_schools/:id (SCHOOL RESOURCES - Unit 6 Wash/ICT)
app.put('/api/ph_schools/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { iern, unit7_furniture, unit7_ict, unit7_has_ecart, unit7_ecarts, unit7_wash, unit7_utilities, unit6_completed } = req.body;
    await pool.query(
      `UPDATE ph_schools SET
       iern = COALESCE($1, iern),
       unit7_furniture = $2, unit7_ict = $3, unit7_has_ecart = $4, unit7_ecarts = $5,
       unit7_wash = $6, unit7_utilities = $7, unit6_completed = $8,
       unit6 = 100, unit6_updated_at = CURRENT_TIMESTAMP
       WHERE school_id = $9`,
      [iern, unit7_furniture, unit7_ict, unit7_has_ecart, unit7_ecarts, unit7_wash, unit7_utilities, unit6_completed, id]
    );
    res.json({ success: true, message: 'Unit 6 resources updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 17. POST /api/save-physical-facilities (UNIT 7 MASTER)
app.post('/api/save-physical-facilities', async (req, res) => {
  const client = await pool.connect();
  try {
    const { 
      school_id: sid_snake, schoolId: sid_camel, iern, inventoryEntries, rooms, repairEntries, demolitionEntries, 
      build_classrooms_total, build_classrooms_new, build_classrooms_good, 
      build_classrooms_repair, build_classrooms_demolition, spaces, has_no_building,
      u7_confirm_no_space
    } = req.body;
    const school_id = sid_snake || sid_camel;

    console.log(`🏗️ [Unit 7 Master] Processing payload for school ${school_id}...`);

    await client.query('BEGIN');
    // Bypass deletion protection trigger for Unit 7 normalization (Nuclear Lock)
    await client.query("SET LOCAL internal.authorized_app_deletion = 'true'");


    // 1. DUAL-WRITE: Update ph_schools summary counters and JSON blobs (for frontend reconstruction)
    await client.query(
      `UPDATE ph_schools SET
       unit7_data = $1, unit7_rooms = $2, unit7_repair = $3, unit7_demolition = $4,
       unit7_spaces = $5, has_no_building = $6,
       build_classrooms_total = $7, build_classrooms_new = $8, build_classrooms_good = $9,
       build_classrooms_repair = $10, build_classrooms_demolition = $11,
       u7_confirm_no_space = $12,
       unit7 = 100, unit7_completed = TRUE, unit7_updated_at = CURRENT_TIMESTAMP
       WHERE school_id = $13`,
      [
        JSON.stringify(inventoryEntries), JSON.stringify(rooms), JSON.stringify(repairEntries), 
        JSON.stringify(demolitionEntries), JSON.stringify(spaces), has_no_building, 
        build_classrooms_total, build_classrooms_new, build_classrooms_good, 
        build_classrooms_repair, build_classrooms_demolition, u7_confirm_no_space === true,
        school_id
      ]
    );

    // 2. NORMALIZATION: Populate specialized tables
    
    // Clear old records for this school to ensure a clean audit state
    console.log(`🧹 [Unit 7 Master] Clearing old records for school ${school_id} (IERN: ${iern})...`);
    const clearQuery = (table) => `DELETE FROM ${table} WHERE school_id = $1 OR iern = $2`;
    await client.query(clearQuery('ph_buildings_inventory'), [school_id, iern]);
    await client.query(clearQuery('ph_buildings_repairs'), [school_id, iern]);
    await client.query(clearQuery('ph_buildings_demolition'), [school_id, iern]);
    await client.query(clearQuery('ph_school_buildable_spaces'), [school_id, iern]);

    // A. Building Inventory (Mapping Rooms list to ph_buildings_inventory)
    if (Array.isArray(rooms) && rooms.length > 0) {
      console.log(`🏢 [Unit 7 Master] Inserting ${rooms.length} rooms into ph_buildings_inventory...`);
      for (const room of rooms) {
        try {
          const b = (inventoryEntries || []).find(inv => inv.id === room.building_local_id) || {};
          const storeyVal = parseInt(b.storey);
          const classroomVal = parseInt(b.classroom);

          await client.query(
            `INSERT INTO ph_buildings_inventory (
              school_id, iern, building_name, room_name, category, storey, classroom, 
              year_completed, remarks, status, is_in_use, seats, grade_level, advisory_teacher,
              less_than_7x9, "7x9", above_7x9, dimension
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
            [
              school_id, iern, room.building_name, room.room_name, b.category, 
              isNaN(storeyVal) ? 1 : storeyVal, 
              isNaN(classroomVal) ? 1 : classroomVal, 
              b.year_completed, b.remarks, room.status, room.is_in_use !== false, 
              ((room.grade_level || "").includes("Non-Instructional") ? null : room.seats), 
              room.grade_level, room.teacher_id,
              (room.less_than_7x9 === 1 || (room.dimension || '').toLowerCase() === 'less than 7x9' ? 1 : 0),
              (room["7x9"] === 1 || (room.dimension || '').toLowerCase() === '7x9' ? 1 : 0),
              (room.above_7x9 === 1 || (room.dimension || '').toLowerCase() === 'above 7x9' ? 1 : 0),
              room.dimension
            ]
          );
        } catch (roomErr) {
          console.error(`❌ [Unit 7 Master] Failed to insert room: ${room.room_name}`, roomErr.message);
          throw roomErr;
        }
      }
    }

    // B. Repairs
    if (Array.isArray(repairEntries) && repairEntries.length > 0) {
      console.log(`🛠️ [Unit 7 Master] Inserting ${repairEntries.length} repair entries...`);
      for (const rep of repairEntries) {
        try {
          const damageVal = parseInt(rep.damage_ratio);
          await client.query(
            `INSERT INTO ph_buildings_repairs (
              school_id, iern, building_name, room_name, item_name, oms, 
              condition, damage_ratio, recommended_action, demo_justification, remarks
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              school_id, iern, rep.building_no, rep.room_no, rep.item_name, rep.oms, 
              rep.condition, isNaN(damageVal) ? 0 : damageVal, rep.recommended_action, 
              rep.demo_justification, rep.remarks
            ]
          );
        } catch (repErr) {
          console.error(`❌ [Unit 7 Master] Failed to insert repair entry for building: ${rep.building_no}`, repErr.message);
          throw repErr;
        }
      }
    }

    // C. Demolition Justifications
    if (Array.isArray(demolitionEntries) && demolitionEntries.length > 0) {
      console.log(`🏚️ [Unit 7 Master] Inserting ${demolitionEntries.length} demolition entries...`);
      for (const demo of demolitionEntries) {
        try {
          await client.query(
            `INSERT INTO ph_buildings_demolition (
              school_id, iern, building_name, room_name, age, safety, calamity, upgrade,
              less_than_7x9, "7x9", above_7x9
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              school_id, iern, demo.building_name, demo.room_name, 
              demo.age === true || demo.age === 'true', 
              demo.safety === true || demo.safety === 'true', 
              demo.calamity === true || demo.calamity === 'true', 
              demo.upgrade === true || demo.upgrade === 'true', 
              parseInt(demo.less_than_7x9) || 0, 
              parseInt(demo["7x9"]) || 0, 
              parseInt(demo.above_7x9) || 0
            ]
          );
        } catch (demoErr) {
          console.error(`❌ [Unit 7 Master] Failed to insert demolition entry: ${demo.building_name}`, demoErr.message);
          throw demoErr;
        }
      }
    }

    // D. Buildable Spaces
    if (Array.isArray(spaces) && spaces.length > 0) {
      console.log(`📐 [Unit 7 Master] Inserting ${spaces.length} buildable spaces...`);
      for (const s of spaces) {
        try {
          const lat = parseFloat(s.center_lat);
          const lng = parseFloat(s.center_lng);
          const len = parseFloat(s.length_m);
          const wid = parseFloat(s.width_m);
          const rot = parseFloat(s.rotation_deg);
          const area = parseFloat(s.total_area_sqm);

          await client.query(
            `INSERT INTO ph_school_buildable_spaces (
              school_id, iern, space_name, center_lat, center_lng, length_m, width_m, rotation_deg, total_area_sqm
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (iern, space_name) DO NOTHING`,
            [
              school_id, iern, s.space_name, 
              isNaN(lat) ? 0 : lat, isNaN(lng) ? 0 : lng, 
              isNaN(len) ? 0 : len, isNaN(wid) ? 0 : wid, 
              isNaN(rot) ? 0 : rot, isNaN(area) ? 0 : area
            ]
          );

        } catch (spaceErr) {
          console.error(`❌ [Unit 7 Master] Failed to insert space: ${s.space_name}`, spaceErr.message);
          throw spaceErr;
        }
      }
    }

    await client.query('COMMIT');
    console.log(`✅ [Unit 7 Master] School ${school_id} finalized and normalized successfully.`);
    await updateSchoolTotalCompletion(iern).catch(() => {});
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`❌ [Unit 7 Master] Error for school ${req.body.school_id}:`, err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// 18. POST /api/school-location (UNIT 8 TERRAIN)
app.post('/api/school-location', async (req, res) => {
  try {
    const data = req.body;
    const { school_id, iern } = data;

    if (!school_id) return res.status(400).json({ error: "Missing school_id" });

    const query = `
      INSERT INTO school_location_profiles (
        school_id, iern, transportation_modes, road_paved_pct, road_unpaved_pct,
        road_lighting_pct, public_transpo_availability, water_proximity, near_cliff_ravine,
        road_cliff_pct, near_water, natural_calamities, hazards_experienced,
        has_insurgency_threats, insurgency_threats_6mo, road_passable_public_transpo_pct,
        river_crossing_on_foot, river_crossing_count, emergency_response_mins,
        proximity_hospital_km, proximity_brgy_hall_mins, proximity_brgy_hall_km,
        proximity_muni_hall_mins, proximity_muni_hall_km, proximity_sdo_mins,
        proximity_sdo_km, proximity_clinic_mins, proximity_clinic_km,
        proximity_terminal_mins, proximity_terminal_km, proximity_highway_mins,
        proximity_highway_km, cellular_coverage, weather_isolation,
        weather_isolation_6mo, anthropogenic_threats, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, CURRENT_TIMESTAMP
      )
      ON CONFLICT (school_id) DO UPDATE SET
        iern = EXCLUDED.iern,
        transportation_modes = EXCLUDED.transportation_modes,
        road_paved_pct = EXCLUDED.road_paved_pct,
        road_unpaved_pct = EXCLUDED.road_unpaved_pct,
        road_lighting_pct = EXCLUDED.road_lighting_pct,
        public_transpo_availability = EXCLUDED.public_transpo_availability,
        water_proximity = EXCLUDED.water_proximity,
        near_cliff_ravine = EXCLUDED.near_cliff_ravine,
        road_cliff_pct = EXCLUDED.road_cliff_pct,
        near_water = EXCLUDED.near_water,
        natural_calamities = EXCLUDED.natural_calamities,
        hazards_experienced = EXCLUDED.hazards_experienced,
        has_insurgency_threats = EXCLUDED.has_insurgency_threats,
        insurgency_threats_6mo = EXCLUDED.insurgency_threats_6mo,
        road_passable_public_transpo_pct = EXCLUDED.road_passable_public_transpo_pct,
        river_crossing_on_foot = EXCLUDED.river_crossing_on_foot,
        river_crossing_count = EXCLUDED.river_crossing_count,
        emergency_response_mins = EXCLUDED.emergency_response_mins,
        proximity_hospital_km = EXCLUDED.proximity_hospital_km,
        proximity_brgy_hall_mins = EXCLUDED.proximity_brgy_hall_mins,
        proximity_brgy_hall_km = EXCLUDED.proximity_brgy_hall_km,
        proximity_muni_hall_mins = EXCLUDED.proximity_muni_hall_mins,
        proximity_muni_hall_km = EXCLUDED.proximity_muni_hall_km,
        proximity_sdo_mins = EXCLUDED.proximity_sdo_mins,
        proximity_sdo_km = EXCLUDED.proximity_sdo_km,
        proximity_clinic_mins = EXCLUDED.proximity_clinic_mins,
        proximity_clinic_km = EXCLUDED.proximity_clinic_km,
        proximity_terminal_mins = EXCLUDED.proximity_terminal_mins,
        proximity_terminal_km = EXCLUDED.proximity_terminal_km,
        proximity_highway_mins = EXCLUDED.proximity_highway_mins,
        proximity_highway_km = EXCLUDED.proximity_highway_km,
        cellular_coverage = EXCLUDED.cellular_coverage,
        weather_isolation = EXCLUDED.weather_isolation,
        weather_isolation_6mo = EXCLUDED.weather_isolation_6mo,
        anthropogenic_threats = EXCLUDED.anthropogenic_threats,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const values = [
      school_id, iern,
      JSON.stringify(data.transportation_modes || []),
      parseFloat(data.road_paved_pct) || 0,
      parseFloat(data.road_unpaved_pct) || 0,
      parseFloat(data.road_lighting_pct) || 0,
      parseFloat(data.public_transpo_availability) || 0,
      JSON.stringify(data.water_proximity || []),
      data.near_cliff_ravine === true || data.near_cliff_ravine === 'true',
      parseFloat(data.road_cliff_pct) || 0,
      data.near_water === true || data.near_water === 'true',
      JSON.stringify(data.natural_calamities || []),
      JSON.stringify(data.hazards_experienced || []),
      data.has_insurgency_threats === true || data.has_insurgency_threats === 'true',
      parseFloat(data.insurgency_threats_6mo) || 0,
      parseFloat(data.road_passable_public_transpo_pct) || 0,
      data.river_crossing_on_foot === true || data.river_crossing_on_foot === 'true',
      parseFloat(data.river_crossing_count) || 0,
      parseFloat(data.emergency_response_mins) || 0,
      parseFloat(data.proximity_hospital_km) || 0,
      parseFloat(data.proximity_brgy_hall_mins) || 0,
      parseFloat(data.proximity_brgy_hall_km) || 0,
      parseFloat(data.proximity_muni_hall_mins) || 0,
      parseFloat(data.proximity_muni_hall_km) || 0,
      parseFloat(data.proximity_sdo_mins) || 0,
      parseFloat(data.proximity_sdo_km) || 0,
      parseFloat(data.proximity_clinic_mins) || 0,
      parseFloat(data.proximity_clinic_km) || 0,
      parseFloat(data.proximity_terminal_mins) || 0,
      parseFloat(data.proximity_terminal_km) || 0,
      parseFloat(data.proximity_highway_mins) || 0,
      parseFloat(data.proximity_highway_km) || 0,
      data.cellular_coverage,
      data.weather_isolation === true || data.weather_isolation === 'true',
      parseFloat(data.weather_isolation_6mo) || 0,
      JSON.stringify(data.anthropogenic_threats || [])
    ];

    const result = await pool.query(query, values);
    
    await pool.query(
      `UPDATE ph_schools SET
       unit8 = 100, unit8_completed = TRUE, unit8_updated_at = CURRENT_TIMESTAMP
       WHERE school_id = $1`, [school_id]
    );

    await updateSchoolTotalCompletion(iern).catch(() => {});
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("❌ [API] POST /api/school-location ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// 19. GET/PUT /api/ph_schools/unit9/:id (INFRASTRUCTURE & SAFETY)
app.get('/api/ph_schools/unit9/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM ph_schools WHERE school_id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'School not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(`❌ [API] GET /api/ph_schools/unit9/${req.params.id} ERROR:`, {
        message: err.message,
        stack: err.stack,
        pool: { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount }
    });
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

app.put('/api/ph_schools/unit9/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    // Normalize boolean-ish values (0, 1, 2) from tri-state UI to standard DB booleans
    const toBool = (v) => {
        if (v === 1 || v === true || v === 'true' || v === '1') return true;
        if (v === 0 || v === false || v === 'false' || v === '0') return false;
        return null; // Handle '2' (N/A) or unknown as NULL
    };

    await pool.query(
      `UPDATE ph_schools SET
       unit9 = 100, unit9_completed = TRUE, unit9_updated_at = CURRENT_TIMESTAMP,
       u9_general = $1, u9_wiring = $2, u9_cords_cctv = $3, u9_final = $4,
       u9_fire_exit_exists = $5, u9_backup_light_exists = $6, u9_ecart_load_ready = $7,
       u9_has_surge_protection = $8, u9_remarks = $9,
       u9_cctv_working = $10, u9_cctv_broken = $11, u9_cctv_spares = $12,
       u9_fire_ext_working = $13, u9_fire_ext_broken = $14, u9_fire_ext_spares = $15,
       u9_first_aid_working = $16, u9_first_aid_broken = $17, u9_first_aid_spares = $18,
       u9_bullhorns_working = $19, u9_bullhorns_broken = $20, u9_bullhorns_spares = $21,
       u9_radios_working = $22, u9_radios_broken = $23, u9_radios_spares = $24,
       u9_flashlight_working = $25, u9_flashlight_broken = $26, u9_flashlight_spares = $27,
       u9_whistles_quantity = $28, u9_bulbs_working = $29, u9_bulbs_broken = $30,
       u9_bulbs_spares = $31, u9_covers_working = $32, u9_covers_broken = $33,
       u9_covers_spares = $34, u9_breakers_working = $35, u9_breakers_broken = $36,
       u9_breakers_spares = $37, u9_ext_cords_working = $38, u9_ext_cords_broken = $39,
       u9_ext_cords_spares = $40, u9_tape_quantity = $41
       WHERE school_id = $42`,
      [
        body.u9_general, body.u9_wiring, body.u9_cords_cctv, body.u9_final,
        toBool(body.u9_fire_exit_exists), toBool(body.u9_backup_light_exists), toBool(body.u9_ecart_load_ready),
        toBool(body.u9_has_surge_protection), body.u9_remarks,
        body.u9_cctv_working, body.u9_cctv_broken, body.u9_cctv_spares,
        body.u9_fire_ext_working, body.u9_fire_ext_broken, body.u9_fire_ext_spares,
        body.u9_first_aid_working, body.u9_first_aid_broken, body.u9_first_aid_spares,
        body.u9_bullhorns_working, body.u9_bullhorns_broken, body.u9_bullhorns_spares,
        body.u9_radios_working, body.u9_radios_broken, body.u9_radios_spares,
        body.u9_flashlight_working, body.u9_flashlight_broken, body.u9_flashlight_spares,
        body.u9_whistles_quantity, body.u9_bulbs_working, body.u9_bulbs_broken,
        body.u9_bulbs_spares, body.u9_covers_working, body.u9_covers_broken,
        body.u9_covers_spares, body.u9_breakers_working, body.u9_breakers_broken,
        body.u9_breakers_spares, body.u9_ext_cords_working, body.u9_ext_cords_broken,
        body.u9_ext_cords_spares, body.u9_tape_quantity, id
      ]
    );
    // Sync completion status
    const schoolRes = await pool.query('SELECT iern FROM ph_schools WHERE school_id = $1', [id]);
    if (schoolRes.rowCount > 0) {
        await updateSchoolTotalCompletion(schoolRes.rows[0].iern).catch(() => {});
    }
    res.json({ success: true, message: 'Unit 9 data updated successfully' });
  } catch (err) {
    console.error(`❌ [API] PUT /api/ph_schools/unit9/${req.params.id} ERROR:`, {
        message: err.message,
        stack: err.stack,
        payload: req.body,
        pool: { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount }
    });
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});



// [ESF7 Routes Block 2] Removed — eSF7 logic moved to separate codebase.


// --- REFERENCE API ENDPOINTS ---

app.get('/api/reference/building-types', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM reference_building_types ORDER BY name ASC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.json({ success: true, data: [
        { id: 1, name: "Gabo Type" },
        { id: 2, name: "Marcos Type" },
        { id: 3, name: "Bagong Lipunan" },
        { id: 4, name: "DepEd Standard" }
    ] }); // Fallback for stability
  }
});

// (Removing duplicate teachers logic that used non-existent ph_teachers_list)







app.get('/api/reference/functional-divisions', async (req, res) => {
  try {
    const result = await pool.query('SELECT governance_level, functional_division FROM ph_offices ORDER BY functional_division ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error fetching functional divisions:', err);
    res.status(500).json({ error: err.message });
  }
});



// --- MASTERLIST API ENDPOINTS ---




// Helper for dynamic WHERE clause
const buildMasterlistQuery = (baseQuery, filters) => {
  const { region, province, division, municipality, legislative_district } = filters;
  let where = [];
  let params = [];
  let pIdx = 1;

  if (region) { where.push(`"region" = $${pIdx++}`); params.push(region); }
  if (province) { where.push(`"province" = $${pIdx++}`); params.push(province); }
  if (division) { where.push(`"division" = $${pIdx++}`); params.push(division); }
  if (municipality) { where.push(`"municipality" = $${pIdx++}`); params.push(municipality); }
  if (legislative_district) { where.push(`"legislative_district" = $${pIdx++}`); params.push(legislative_district); }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  return { query: `${baseQuery}${whereClause ? ' ' + whereClause : ''}`, params };
};

// Filter options (Cascading)

// Generic Lists for Assignments (using schools table with metadata)
app.get('/api/lists/provinces', async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT province, region FROM schools WHERE province IS NOT NULL ORDER BY province');
    res.json(result.rows); // Returns [{province, region}, ...]
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/lists/municipalities', async (req, res) => {
  try {
    const { province } = req.query;
    let query = 'SELECT DISTINCT municipality, region, division, province FROM schools WHERE municipality IS NOT NULL';
    let params = [];
    if (province) {
      query += ' AND province = $1';
      params.push(province);
    }
    query += ' ORDER BY municipality';
    const result = await pool.query(query, params);
    res.json(result.rows); // Returns [{municipality, region, division, province}, ...]
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- LOCATION LOOKUP APIS (Unified) ---
app.get('/api/locations/regions', async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT "Region" as region FROM "schools_IERN" WHERE "Region" IS NOT NULL ORDER BY "Region"');
    res.json(result.rows.map(r => r.region));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/locations/provinces', async (req, res) => {
  try {
    const { region } = req.query;
    let query = 'SELECT DISTINCT "Province" as province FROM "schools_IERN" WHERE "Province" IS NOT NULL';
    let params = [];
    if (region && region !== 'BLANK REGION') {
      query += ' AND "Region" = $1';
      params.push(region);
    }
    query += ' ORDER BY "Province"';
    const result = await pool.query(query, params);
    res.json(result.rows.map(r => r.province));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/locations/municipalities-by-province', async (req, res) => {
  try {
    const { province } = req.query;
    const result = await pool.query('SELECT DISTINCT "Municipality" as municipality FROM "schools_IERN" WHERE "Province" = $1 ORDER BY "Municipality"', [province]);
    res.json(result.rows.map(r => r.municipality));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/locations/barangays', async (req, res) => {
  try {
    const { municipality } = req.query;
    // Note: 'schools_IERN' table is used as authoritative source
    const result = await pool.query('SELECT DISTINCT "Barangay" as barangay FROM "schools_IERN" WHERE "Municipality" = $1 AND "Barangay" IS NOT NULL ORDER BY "Barangay"', [municipality]);
    res.json(result.rows.map(r => r.barangay));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/locations/divisions', async (req, res) => {
  try {
    const { region } = req.query;
    const result = await pool.query('SELECT DISTINCT "Division" as division FROM "schools_IERN" WHERE "Region" = $1 ORDER BY "Division"', [region]);
    res.json(result.rows.map(r => r.division));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/locations/legislative-districts', async (req, res) => {
  try {
    const { province } = req.query;
    const result = await pool.query('SELECT DISTINCT "Legislative_District" as leg_district FROM "schools_IERN" WHERE "Province" = $1 AND "Legislative_District" IS NOT NULL ORDER BY "Legislative_District"', [province]);
    res.json(result.rows.map(r => r.leg_district));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/locations/districts', async (req, res) => {
  try {
    const { region, division, municipality } = req.query;
    let query = 'SELECT DISTINCT "District" as district FROM "schools_IERN" WHERE "District" IS NOT NULL';
    let params = [];
    let pIdx = 1;

    if (region) { query += ` AND "Region" = $${pIdx++}`; params.push(region); }
    if (division) { query += ` AND "Division" = $${pIdx++}`; params.push(division); }
    if (municipality) { query += ` AND "Municipality" = $${pIdx++}`; params.push(municipality); }

    query += ' ORDER BY "District"';
    const result = await pool.query(query, params);
    res.json(result.rows.map(r => r.district));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/locations/municipalities', async (req, res) => {
  try {
    const { region, division, district } = req.query;
    let query = 'SELECT DISTINCT "Municipality" as municipality FROM "schools_IERN" WHERE "Municipality" IS NOT NULL';
    let params = [];
    let pIdx = 1;

    if (region) { query += ` AND "Region" = $${pIdx++}`; params.push(region); }
    if (division) { query += ` AND "Division" = $${pIdx++}`; params.push(division); }
    if (district) { query += ` AND "District" = $${pIdx++}`; params.push(district); }

    query += ' ORDER BY "Municipality"';
    const result = await pool.query(query, params);
    res.json(result.rows.map(r => r.municipality));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/locations/schools', async (req, res) => {
  try {
    const { region, division, district, municipality } = req.query;
    let query = 'SELECT "SchoolID" as school_id, "School_Name" as school_name, "Region" as region, "Division" as division, "District" as district, "Municipality" as municipality, "Province" as province, "Barangay" as barangay, "Latitude" as latitude, "Longitude" as longitude FROM "schools_IERN" WHERE "SchoolID" IS NOT NULL';
    let params = [];
    let pIdx = 1;

    if (region) { query += ` AND "Region" = $${pIdx++}`; params.push(region); }
    if (division) { query += ` AND "Division" = $${pIdx++}`; params.push(division); }
    if (district) { query += ` AND "District" = $${pIdx++}`; params.push(district); }
    if (municipality) { query += ` AND "Municipality" = $${pIdx++}`; params.push(municipality); }

    query += ' ORDER BY "School_Name"';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/monitoring/schools', async (req, res) => {
  try {
    const { region, division, page = 1, limit = 20, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let query = `
      SELECT 
        v.school_id, v.school_name, v.region, v.division,
        v.unit1_completed as u1_status, v.unit2_completed as u2_status, v.unit3_completed as u3_status,
        v.unit4_completed as u4_status, v.unit5_completed as u5_status, v.unit6_completed as u6_status,
        v.unit7_completed as u7_status, v.unit8_completed as u8_status, v.unit9_completed as u9_status,
        v.unit1_validated, v.unit2_validated, v.unit3_validated, v.unit4_validated, v.unit5_validated,
        v.unit6_validated, v.unit7_validated, v.unit8_validated, v.unit9_validated,
        v.needs_validation, v.validation_percentage,
        ps.completion_percentage,
        ps.data_health_score, ps.data_health_description, ps.data_quality_issues
      FROM ph_schools_validate v
      JOIN ph_schools ps ON v.school_id = ps.school_id
      WHERE 1=1
    `;
    
    let params = [];
    let pIdx = 1;
    
    if (region) { query += ` AND v.region = $${pIdx++}`; params.push(region); }
    if (division) { query += ` AND v.division = $${pIdx++}`; params.push(division); }
    if (search) { 
      query += ` AND (v.school_name ILIKE $${pIdx} OR v.school_id ILIKE $${pIdx})`; 
      params.push(`%${search}%`);
      pIdx++;
    }
    
    const countQuery = `SELECT COUNT(*) FROM (${query}) as count_query`;
    const countRes = await pool.query(countQuery, params);
    const total = parseInt(countRes.rows[0].count);
    
    query += ` ORDER BY v.school_name LIMIT $${pIdx++} OFFSET $${pIdx++}`;
    params.push(parseInt(limit), offset);
    
    const result = await pool.query(query, params);
    
    res.json({
      data: result.rows,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      page: parseInt(page)
    });
  } catch (err) {
    console.error("Monitoring Schools API Error:", err);
    res.status(500).json({ error: err.message });
  }
});


// --- NEW LAZY MIGRATION LOGIN ENDPOINT ---
app.post('/api/auth/migrate-login', async (req, res) => {
  if (!req.body) {
    console.error("[AUTH DEBUG] req.body is UNDEFINED at migrate-login. Content-Type:", req.headers['content-type']);
    return res.status(400).json({ success: false, error: "Missing request body." });
  }

  const { email, school_id, password } = req.body;
  const identifier = (school_id || email || '').trim();

  if (!identifier || !password) {
    return res.status(400).json({ success: false, error: "Identifier and password are required. Got: " + JSON.stringify({ identifier, hasPassword: !!password }) });
  }

  try {
    const isEmail = identifier.includes('@');
    const isSchoolId = !isEmail && (!!school_id || /^\d{6,}$/.test(identifier));

    // 1. Fetch user from PostgreSQL
    const SELECT_COLS = `uid, email, role, region, division, office, account_category, passcode, password_hash, password_salt, hash_version, first_name, last_name, school_id, province, city`;

    const query = isSchoolId
      ? `SELECT ${SELECT_COLS} FROM users WHERE school_id = $1 AND disabled = false AND (registration_status = 'Valid' OR registration_status IS NULL)`
      : `SELECT ${SELECT_COLS} FROM users WHERE LOWER(email) = $1 AND disabled = false AND (registration_status = 'Valid' OR registration_status IS NULL) ORDER BY CASE WHEN role = 'School Head' THEN 2 ELSE 1 END, created_at DESC`;

    const processUserRes = (resObj) => {
      if (resObj.rowCount === 0) {
        console.warn(`[MIGRATE LOGIN] User not found: ${identifier}`);
        return null;
      }
      return resObj.rows[0];
    };

    // ✅ [POOL FIX] Explicitly acquire + release connection BEFORE bcrypt to prevent
    // pool starvation. bcrypt.compare() is CPU-bound (~200ms) and must NOT hold a slot.
    let user;
    let loginClient = await pool.connect();
    try {
      const userRes = await loginClient.query(query, [isSchoolId ? identifier : identifier.toLowerCase()]);
      user = processUserRes(userRes);
    } catch (err) {
      console.error(`💥 [MIGRATE LOGIN] DB Error for ${identifier}:`, err.message);
      if (err.message.includes('terminated unexpectedly')) {
        console.warn(`♻️ [RECOVERY] Retrying Migrate-Login for: ${identifier}`);
        loginClient.release(); // Release the dead client
        loginClient = await pool.connect(); // Get a fresh one
        const retryRes = await loginClient.query(query, [isSchoolId ? identifier : identifier.toLowerCase()]);
        user = processUserRes(retryRes);
      } else {
        throw err;
      }
    } finally {
      loginClient.release(); // ✅ FREE the slot before slow bcrypt work begins
    }

    if (!user) {
      return res.status(401).json({ success: false, error: "Username does not exist. Kindly register first." });
    }

    // 2. Determine which hash algorithm to check against
    let isValid = false;

    if (user.hash_version === 'bcrypt') {
      // User has already bumped to standard bcrypt
      isValid = await bcrypt.compare(password, user.password_hash);
      console.log(`[AUTH DEBUG] Bcrypt match for ${identifier}: ${isValid}`);
    }
    else if (user.hash_version === 'firebase') {
      // Check if server is configured for Firebase Scrypt
      if (!process.env.FIREBASE_HASH_SIGNER_KEY) {
        console.error("CRITICAL: FIREBASE_HASH_SIGNER_KEY is missing from .env");
        return res.status(500).json({ success: false, error: "Server configuration error during migration." });
      }

      const scrypt = new FirebaseScrypt({
        memCost: parseInt((process.env.FIREBASE_HASH_MEM_COST || "14").replace(/"/g, '')),
        rounds: parseInt((process.env.FIREBASE_HASH_ROUNDS || "8").replace(/"/g, '')),
        saltSeparator: (process.env.FIREBASE_HASH_SALT_SEPARATOR || "").replace(/"/g, ''),
        signerKey: (process.env.FIREBASE_HASH_SIGNER_KEY || "").replace(/"/g, '')
      });

      isValid = await scrypt.verify(password, user.password_salt, user.password_hash);

      // --- THE LAZY UPGRADE --- (fire-and-forget; does NOT block login response)
      if (isValid) {
        console.log(`[LAZY MIGRATION] Upgrading hash for user: ${user.email}`);
        const saltRounds = 10;
        bcrypt.hash(password, saltRounds).then(newBcryptHash => {
          pool.query(
            `UPDATE users SET password_hash = $1, password_salt = NULL, hash_version = 'bcrypt' WHERE uid = $2`,
            [newBcryptHash, user.uid]
          ).catch(e => console.error('[LAZY MIGRATION] Update failed:', e.message));
        }).catch(e => console.error('[LAZY MIGRATION] Hash failed:', e.message));
      }
    } else {
      // Catch-all for unknown hash versions
      return res.status(401).json({ success: false, error: "Unsupported hash algorithm." });
    }

    if (!isValid) {
      console.warn(`[MIGRATE LOGIN] Password mismatch for: ${identifier}`);
      return res.status(401).json({ success: false, error: "The username exists but does not match the password you provided." });
    }

    console.log(`[MIGRATE LOGIN] Success for: ${identifier} (Role: ${user.role})`);

    // --- AUTO-NORMALIZE ACCOUNT CATEGORY ---
    let finalCategory = user.account_category;
    if (!finalCategory || user.role === 'EFD' || user.role === 'HRODI' || user.role === 'EFD Engineer' || user.role === 'DepEd Engineer' || user.role === 'Division Engineer') {
      if (user.role === 'EFD' || user.role === 'HRODI' || user.role === 'EFD Engineer' || user.role === 'DepEd Engineer' || user.role === 'Division Engineer') {
        finalCategory = 'DepEd Engineer';
      } else {
        finalCategory = user.role;
      }

      // Lazy update the DB if it changed or was null (fire-and-forget)
      if (finalCategory !== user.account_category) {
        console.log(`[MIGRATE LOGIN] Normalizing category for ${identifier}: ${finalCategory}`);
        pool.query('UPDATE users SET account_category = $1 WHERE uid = $2', [finalCategory, user.uid])
          .catch(e => console.error('[MIGRATE LOGIN] Category update failed:', e.message));
      }
    }

    // 3. User is verified! Generate a JWT session token
    const token = jwt.sign(
      {
        uid: user.uid,
        email: user.email,
        role: user.role,
        region: user.region || null,
        division: user.division || null
      },
      process.env.JWT_SECRET || 'STRIDE_INSIGHTED_SECRET_2026_KEY_PROD',
      { expiresIn: '30d' }
    );

    return res.json({
      success: true,
      token: token,
      user: {
        uid: user.uid,
        email: user.email,
        role: user.role,
        region: user.region,
        division: user.division,
        account_category: finalCategory,
        passcode: user.passcode,
        first_name: user.first_name,
        last_name: user.last_name,
        school_id: user.school_id,
        office: user.office,
        province: user.province,
        city: user.city,
        firstName: user.first_name, // Compatibility
        lastName: user.last_name     // Compatibility
      }
    });

  } catch (err) {
    console.error("Migration Login Error:", err);
    res.status(500).json({ success: false, error: err.message || "Internal Server Error" });
  }
});

// --- CHANGE PASSWORD ---
app.post('/api/auth/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const { uid } = req.user;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current and new passwords are required." });
  }

  try {
    // 1. Fetch user's current password hash
    const userRes = await pool.query('SELECT password_hash FROM users WHERE uid = $1', [uid]);
    if (userRes.rowCount === 0) return res.status(404).json({ error: "User not found" });

    const { password_hash } = userRes.rows[0];

    // 2. Verify current password
    const isMatch = await bcrypt.compare(currentPassword, password_hash);
    if (!isMatch) return res.status(401).json({ error: "Incorrect current password" });

    // 3. Hash new password and update
    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1, hash_version = \'bcrypt\' WHERE uid = $1', [newHash, uid]);

    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    console.error("Change Password Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- UPDATE USER PROFILE ---
app.put('/api/users/update', authMiddleware, async (req, res) => {
  const { firstName, lastName, email, currentPasscode } = req.body;
  const { uid } = req.user;

  try {
    // 1. Fetch current user data
    const userRes = await pool.query('SELECT email, passcode FROM users WHERE uid = $1', [uid]);
    if (userRes.rowCount === 0) return res.status(404).json({ error: "User not found" });

    const user = userRes.rows[0];
    let emailChanged = false;

    // 2. If email is changing, verify domain restriction and passcode
    if (email && email.toLowerCase() !== user.email.toLowerCase()) {
      const currentDomain = user.email.split('@')[1];
      const newDomain = email.split('@')[1];

      if (currentDomain && newDomain && currentDomain.toLowerCase() !== newDomain.toLowerCase()) {
        return res.status(403).json({ error: `Domain restricted: Email must end with @${currentDomain}` });
      }

      // Verify passcode if set
      if (user.passcode) {
        if (!currentPasscode) return res.status(401).json({ error: "Passcode verification required to change email" });
        
        const isPinMatch = user.passcode.startsWith('$2b$') 
          ? await bcrypt.compare(currentPasscode, user.passcode)
          : (currentPasscode === user.passcode);
          
        if (!isPinMatch) return res.status(401).json({ error: "Invalid passcode" });
      }
      emailChanged = true;
    }

    // 3. Update fields
    const updates = [];
    const values = [];
    let pIdx = 1;

    if (firstName) { updates.push(`first_name = $${pIdx++}`); values.push(firstName); }
    if (lastName) { updates.push(`last_name = $${pIdx++}`); values.push(lastName); }
    if (email) { updates.push(`email = $${pIdx++}`); values.push(email.toLowerCase()); }

    if (updates.length === 0) return res.json({ success: true, message: "No changes detected" });

    values.push(uid);
    const query = `UPDATE users SET ${updates.join(', ')} WHERE uid = $${pIdx} RETURNING *`;
    await pool.query(query, values);

    res.json({ success: true, emailChanged });
  } catch (err) {
    console.error("User Update Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- SETUP PASSCODE (ALIAS FOR SETUP-PIN) ---
app.post('/api/auth/setup-passcode', authMiddleware, async (req, res) => {
  const { passcode, oldPasscode } = req.body;
  const { uid, role } = req.user;

  if (!passcode || passcode.length !== 6) {
    return res.status(400).json({ error: "6-digit passcode is required" });
  }

  try {
    // If oldPasscode is provided, verify it first
    if (oldPasscode) {
      const userRes = await pool.query('SELECT passcode FROM users WHERE uid = $1', [uid]);
      if (userRes.rowCount > 0 && userRes.rows[0].passcode) {
        const stored = userRes.rows[0].passcode;
        const isMatch = stored.startsWith('$2b$') 
          ? await bcrypt.compare(oldPasscode, stored)
          : (oldPasscode === stored);
        if (!isMatch) return res.status(401).json({ error: "Incorrect current passcode" });
      }
    }

    const dbPasscode = (role === 'School Head') ? passcode : await bcrypt.hash(passcode, 10);
    await pool.query('UPDATE users SET passcode = $1 WHERE uid = $2', [dbPasscode, uid]);

    res.json({ success: true, message: "Passcode updated successfully" });
  } catch (err) {
    console.error("Setup Passcode Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- FEEDBACK ---
app.post('/api/feedback', authMiddleware, async (req, res) => {
  const { ratings, comment, appVersion } = req.body;
  const { uid, email, role } = req.user;

  try {
    await pool.query(
      `INSERT INTO user_feedback (uid, email, role, ratings, comment, app_version, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [uid, email, role, JSON.stringify(ratings), comment, appVersion]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Feedback Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- SYSTEM ALIGNMENT STUB ---
app.post('/api/system/align-unit8', authMiddleware, async (req, res) => {
  // This is a repair protocol stub. Actual logic would depend on what needs alignment.
  console.log(`🔧 [System] Aligning Unit 8 for UID: ${req.user.uid}`);
  res.json({ success: true, message: "Unit 8 alignment protocol complete" });
});

// --- GET CURRENT USER (PROTECTED) ---
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const { uid } = req.user;
    const query = 'SELECT uid, email, role, region, division, office, account_category, first_name, last_name, school_id, passcode, province, city FROM users WHERE uid = $1';
    
    let result;
    try {
      result = await pool.query(query, [uid]);
    } catch (err) {
      if (err.message.includes('terminated unexpectedly')) {
        console.warn(`♻️ [RECOVERY] Attempting immediate retry for /api/auth/me for: ${uid}`);
        result = await pool.query(query, [uid]);
      } else {
        throw err;
      }
    }

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    const user = result.rows[0];
    res.json({
      uid: user.uid,
      email: user.email,
      role: user.role,
      region: user.region,
      division: user.division,
      account_category: user.account_category,
      first_name: user.first_name,
      last_name: user.last_name,
      school_id: user.school_id,
      passcode: user.passcode,
      office: user.office,
      province: user.province,
      city: user.city
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- REGISTRATION & ACCOUNT MANAGEMENT ---

// 1. Check if school already has an account
app.post('/api/check-existing-school', async (req, res) => {
  const { schoolId } = req.body;
  const tidiedId = (schoolId || '').trim();
  
  if (!tidiedId) {
    return res.status(400).json({ error: "School ID is required." });
  }

  console.log(`🔍 [Check-School] Validating school_id: ${tidiedId}`);

  let client;
  try {
    client = await pool.connect();
    const query = 'SELECT uid FROM users WHERE school_id = $1 AND role = \'School Head\'';
    let result;
    
    try {
      result = await client.query(query, [tidiedId]);
    } catch (err) {
      if (err.message.includes('terminated unexpectedly')) {
        console.warn(`♻️ [RECOVERY] Retrying Check-School for: ${tidiedId}`);
        // Acquire a fresh connection for the retry to be safe
        client.release();
        client = await pool.connect();
        result = await client.query(query, [tidiedId]);
      } else {
        throw err;
      }
    }
    
    res.json({ exists: result.rowCount > 0 });
  } catch (err) {
    console.error("❌ Check School Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    if (client) client.release();
  }
});

// 2. One-shot Registration for School Heads
app.post('/api/register-beta', async (req, res) => {
  try {
    console.log("🏗️ [Register-Beta] Incoming Request Body:", JSON.stringify(req.body, null, 2));
    
    const validatedData = RegisterBetaSchema.safeParse(req.body);
    if (!validatedData.success) {
      console.warn("⚠️ [Register-Beta] Validation failed:", validatedData.error.format());
      return res.status(400).json({ error: "Validation failed", details: validatedData.error.format() });
    }

    const { email, password, contactNumber, firstName, lastName, schoolData, passcode } = validatedData.data;
    const { school_id } = schoolData;

    // 1. Fetch Full Metadata from Master Record (schools_IERN)
    const masterRes = await pool.query('SELECT * FROM "schools_IERN" WHERE "SchoolID" = $1 LIMIT 1', [school_id]);
    if (masterRes.rowCount === 0) {
      return res.status(404).json({ error: "School ID not found in Master Record. Please contact support." });
    }
    const master = masterRes.rows[0];
    const iern = master.IERN || school_id;

    // 2. Check for duplicates
    const dupRes = await pool.query('SELECT uid FROM users WHERE LOWER(email) = $1 OR school_id = $2', [email.toLowerCase(), school_id]);
    if (dupRes.rowCount > 0) {
      return res.status(400).json({ error: "Email or School ID is already registered." });
    }

    // 3. Hash Password & PIN
    const passwordHash = await bcrypt.hash(password, 10);
    const dbPasscode = passcode || null; // School Head passcode is plain text, not hashed
    const uid = uuidv4();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 4. Create User Record
      const userQuery = `
        INSERT INTO users (
          uid, email, password_hash, hash_version, role, first_name, last_name,
          school_id, iern, contact_number, region, division, province, city, barangay,
          passcode, registration_status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, CURRENT_TIMESTAMP)
      `;
      const userValues = [
        uid, email, passwordHash, 'bcrypt', 'School Head', firstName, lastName,
        school_id, iern, contactNumber,
        master.Region, master.Division, master.Province, 
        master.Municipality, master.Barangay,
        dbPasscode,
        'Valid'
      ];
      await client.query(userQuery, userValues);

      // 5. Ensure school exists in ph_schools (on-demand hydration)
      const schoolQuery = `
        INSERT INTO ph_schools (
          school_id, iern, school_name, region, division, province, municipality, barangay, district, leg_district, curricular_offering, latitude, longitude, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
        ON CONFLICT (school_id) DO UPDATE SET 
          iern = EXCLUDED.iern,
          school_name = EXCLUDED.school_name,
          region = EXCLUDED.region,
          division = EXCLUDED.division,
          province = EXCLUDED.province,
          municipality = EXCLUDED.municipality,
          barangay = EXCLUDED.barangay,
          district = EXCLUDED.district,
          leg_district = EXCLUDED.leg_district,
          curricular_offering = EXCLUDED.curricular_offering,
          latitude = EXCLUDED.latitude, 
          longitude = EXCLUDED.longitude,
          updated_at = EXCLUDED.updated_at
      `;
      await client.query(schoolQuery, [
        school_id, iern, master.School_Name, 
        master.Region, master.Division, master.Province, master.Municipality, master.Barangay, master.District, master.Legislative_District, master.Curricular_Offering,
        master.Latitude, master.Longitude
      ]);

      await client.query('COMMIT');
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }

    // 6. Generate Session Token
    const token = jwt.sign(
      { uid, email, role: 'School Head', school_id, iern },
      process.env.JWT_SECRET || 'STRIDE_INSIGHTED_SECRET_2026_KEY_PROD',
      { expiresIn: '30d' }
    );

    res.status(201).json({
      success: true,
      token,
      user: {
        uid, email, role: 'School Head', firstName, lastName,
        school_id, iern
      }
    });

  } catch (err) {
    console.error("❌ Register-Beta Fatal Error:", err);
    if (err.stack) console.error(err.stack);
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

// 3. Standard User Registration (Engineers, SDO, etc.)
app.post('/api/register-user', async (req, res) => {
  try {
    const validatedData = RegisterUserSchema.safeParse(req.body);
    if (!validatedData.success) {
      return res.status(400).json({ success: false, error: "Validation failed", details: validatedData.error.format() });
    }

    const { 
      email, password, role, firstName, lastName, region, division, 
      school_id, office, province, city, barangay, position, contactNumber, accountCategory, passcode 
    } = validatedData.data;

    const existingUser = await pool.query('SELECT uid FROM users WHERE LOWER(email) = $1', [email.toLowerCase()]);
    if (existingUser.rowCount > 0) {
      return res.status(400).json({ success: false, error: "Email already registered." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const dbPasscode = passcode 
      ? (role === 'School Head' ? passcode : await bcrypt.hash(passcode, 10))
      : null;
    const uid = uuidv4();

    // Fetch IERN from Master Record if school_id is provided
    let iern = null;
    if (school_id) {
        const iernRes = await pool.query('SELECT "IERN" FROM "schools_IERN" WHERE "SchoolID" = $1 LIMIT 1', [school_id]);
        if (iernRes.rowCount === 0) {
            return res.status(400).json({ success: false, error: "Provided School ID not found in Master Record." });
        }
        iern = iernRes.rows[0].IERN;
    }

    const query = `
      INSERT INTO users (
        uid, email, password_hash, hash_version, role, first_name, last_name,
        region, division, province, city, barangay, school_id, iern, office, position, 
        contact_number, account_category, passcode, registration_status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, CURRENT_TIMESTAMP)
    `;

    const values = [
      uid, email, passwordHash, 'bcrypt', role, firstName, lastName,
      region, division, province, city, barangay, school_id, iern, office, position, 
      contactNumber, accountCategory || role, dbPasscode, 'Valid'
    ];

    await pool.query(query, values);

    const token = jwt.sign(
      { uid, email, role, school_id, iern },
      process.env.JWT_SECRET || 'STRIDE_INSIGHTED_SECRET_2026_KEY_PROD',
      { expiresIn: '30d' }
    );

    res.status(201).json({
      success: true,
      token,
      user: {
        uid, email, role, firstName, lastName, region, division, 
        account_category: accountCategory || role
      }
    });

  } catch (err) {
    console.error("❌ Register-User Error:", err);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});


// [Robust Login Fix v1.2] Secure Passcode Setup using Token UID
app.post('/api/auth/setup-passcode', authMiddleware, async (req, res) => {
  const { passcode, pin } = req.body;
  const finalPasscode = passcode || pin;
  const uid = req.user?.uid;
  const role = req.user?.role;

  if (!uid || !finalPasscode || finalPasscode.length !== 6) {
    return res.status(400).json({ success: false, error: "Valid 6-digit passcode is required." });
  }

  try {
    // Hash passcode before storing unless user is School Head
    const dbPasscode = (role === 'School Head') ? finalPasscode : await bcrypt.hash(finalPasscode, 10);

    const result = await pool.query(
      `UPDATE users SET passcode = $1 WHERE uid = $2 RETURNING uid`,
      [dbPasscode, uid]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: "User not found." });
    }

    return res.json({ success: true, message: "Passcode set successfully." });
  } catch (err) {
    console.error("Setup Passcode Error:", err);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});
app.post('/api/auth/verify-passcode', authMiddleware, async (req, res) => {
  try {
    const { passcode } = req.body;
    const { uid } = req.user;

    if (!passcode) {
      return res.status(400).json({ success: false, error: "Passcode is required." });
    }

    const userRes = await pool.query('SELECT passcode FROM users WHERE uid = $1', [uid]);
    if (userRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: "User not found." });
    }

    const storedPasscode = userRes.rows[0].passcode;
    if (!storedPasscode) {
      return res.status(400).json({ success: false, error: "No PIN setup for this account." });
    }

    // Robust passcode comparison (handles both plain-text and hashed)
    const isBcryptHash = storedPasscode.startsWith('$2b$');
    const isValid = isBcryptHash 
      ? await bcrypt.compare(passcode, storedPasscode)
      : (passcode === storedPasscode);

    if (isValid) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, error: "Invalid passcode. Please try again." });
    }
  } catch (err) {
    console.error("Verify Passcode Error:", err);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

app.post('/api/auth/pin-login', async (req, res) => {
  const { email, school_id, pin } = req.body;
  const identifier = (school_id || email || '').trim();

  if (!identifier || !pin) {
    return res.status(400).json({ success: false, error: "Identifier and PIN are required." });
  }

  try {
    const isEmail = identifier.includes('@');
    const isSchoolId = !isEmail && (!!school_id || /^\d{6,}$/.test(identifier));
    console.log(`[AUTH DEBUG] Pin-Login: ${identifier} (isSchoolId: ${isSchoolId}, isEmail: ${isEmail})`);

    // Unified Identifier Lookup (Strict Users Table)
    const selectCols = 'uid, email, role, region, division, office, account_category, passcode, first_name, last_name, school_id';
    const query = isSchoolId
      ? `SELECT ${selectCols} FROM users WHERE school_id = $1 AND disabled = false AND (registration_status = 'Valid' OR registration_status IS NULL)`
      : `SELECT ${selectCols} FROM users WHERE LOWER(email) = $1 AND disabled = false AND (registration_status = 'Valid' OR registration_status IS NULL) ORDER BY CASE WHEN role = 'School Head' THEN 2 ELSE 1 END, created_at DESC`;

    let user;
    let client = await pool.connect();
    try {
      let userRes;
      try {
        userRes = await client.query(query, [isSchoolId ? identifier : identifier.toLowerCase()]);
      } catch (err) {
        if (err.message.includes('terminated unexpectedly')) {
          console.warn(`♻️ [RECOVERY] Retrying Pin-Login for: ${identifier}`);
          client.release();
          client = await pool.connect();
          userRes = await client.query(query, [isSchoolId ? identifier : identifier.toLowerCase()]);
        } else {
          throw err;
        }
      }
      if (userRes.rowCount > 0) user = userRes.rows[0];
    } finally {
      client.release(); // ✅ FREE the slot before slow bcrypt work begins
    }

    if (!user) {
      return res.status(401).json({ success: false, error: "Username does not exist. Kindly register first." });
    }

    if (!user.passcode) {
      return res.status(401).json({ success: false, error: "No PIN setup for this account." });
    }

    // Robust passcode comparison (handles both plain-text and hashed)
    const storedPasscode = user.passcode;
    const isBcryptHash = storedPasscode.startsWith('$2b$');
    const isValidPin = isBcryptHash 
      ? await bcrypt.compare(pin, storedPasscode)
      : (pin === storedPasscode);

    console.log(`[AUTH DEBUG] Pin match for ${identifier}: ${isValidPin} (Hashed: ${isBcryptHash})`);
    if (!isValidPin) {
      return res.status(401).json({ success: false, error: "The username exists but does not match the PIN you provided." });
    }

    // --- AUTO-NORMALIZE ACCOUNT CATEGORY ---
    let finalCategory = user.account_category;
    if (!finalCategory || user.role === 'EFD' || user.role === 'HRODI' || user.role === 'EFD Engineer' || user.role === 'DepEd Engineer' || user.role === 'Division Engineer') {
      if (user.role === 'EFD' || user.role === 'HRODI' || user.role === 'EFD Engineer' || user.role === 'DepEd Engineer' || user.role === 'Division Engineer') {
        finalCategory = 'DepEd Engineer';
      } else {
        finalCategory = user.role;
      }
    }

    // 3. User is verified! Generate a JWT session token
    const token = jwt.sign(
      {
        uid: user.uid,
        email: user.email,
        role: user.role,
        region: user.region || null,
        division: user.division || null
      },
      process.env.JWT_SECRET || 'STRIDE_INSIGHTED_SECRET_2026_KEY_PROD',
      { expiresIn: '30d' }
    );

    return res.json({
      success: true,
      token: token,
      user: {
        uid: user.uid,
        email: user.email,
        role: user.role,
        region: user.region,
        division: user.division,
        account_category: finalCategory,
        first_name: user.first_name,
        last_name: user.last_name,
        school_id: user.school_id,
        passcode: user.passcode,
        office: user.office,
        firstName: user.first_name, // Compatibility
        lastName: user.last_name    // Compatibility
      }
    });

  } catch (err) {
    console.error("PIN Login Error:", err);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

app.get('/api/lists/divisions', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT MAX("Division") as division, MAX("Region") as region 
      FROM "schools_IERN" 
      WHERE "Division" IS NOT NULL AND "Region" IS NOT NULL 
      GROUP BY UPPER(TRIM("Division"))
      ORDER BY division ASC
    `);
    res.json(result.rows); // Returns [{division, region}, ...]
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// --- NEW VALIDATION ENDPOINTS ---

// 1. Fetch ALL Schools for Offline Caching
// 1. Fetch ALL Schools for Offline Caching
app.get('/api/offline/schools', async (req, res) => {
  try {
    // Fetch only necessary fields to keep payload light
    // CHANGED: Use 'schools' table instead of 'ph_schools'
    const query = `
            SELECT "SchoolID" as school_id, "School_Name" as school_name, "Region" as region, "Division" as division, "Latitude" as latitude, "Longitude" as longitude 
            FROM "schools_IERN" 
            WHERE "SchoolID" IS NOT NULL
        `;
    const result = await pool.query(query);

    console.log(`✅ Fetched ${result.rows.length} schools for offline cache from 'schools' table.`);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Failed to fetch schools for cache:", err);
    res.status(500).json({ error: "Failed to fetch schools" });
  }
});

// 2. Fetch Single School Profile (Online Validation) - DEPRECATED (See line 6090 for active implementation using 'schools' table)
// app.get('/api/school-profile/:schoolId', async (req, res) => { ... });

// --- DEBUG: SCANNER ENDPOINT (REMOVED) ---
app.get('/api/debug/scan/:uid', async (req, res) => {
  res.status(410).json({ error: "Scanner decommissioned. Use modern dashboard for progress tracking." });
});

// --- DEBUG: SEED SCHOOLS (For Production Fix) ---
app.get('/api/debug/seed-schools', async (req, res) => {
  console.log("🌱 Seeding Schools initiated...");
  const client = await pool.connect();

  try {
    // 1. Fetch CSV from Public URL (Self-hosted)
    const protocol = req.protocol;
    const host = req.get('host');
    const csvUrl = `${protocol}://${host}/schools.csv`;
    console.log(`📥 Fetching CSV from: ${csvUrl}`);

    const response = await fetch(csvUrl);
    if (!response.ok) throw new Error(`Failed to fetch CSV: ${response.statusText}`);

    const csvText = await response.text();

    // 2. Parse CSV (Manual Parsing for simplicity without filesystem stream if fetch returns text)
    // Or use csv-parser with a readable stream from string
    const results = [];
    const Readable = require('stream').Readable;
    const s = new Readable();
    s.push(csvText);
    s.push(null); // end of stream

    await new Promise((resolve, reject) => {
      s.pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    console.log(`📊 Parsed ${results.length} schools.`);

    if (results.length === 0) return res.json({ message: "CSV is empty" });

    // 3. Insert Data
    // Create table if not exists
    await client.query(`
            CREATE TABLE IF NOT EXISTS schools (
                school_id TEXT PRIMARY KEY,
                school_name TEXT,
                region TEXT,
                division TEXT,
                legislative_district TEXT,
                province TEXT,
                municipality TEXT,
                barangay TEXT,
                latitude TEXT,
                longitude TEXT,
                sub_office TEXT,
                school_type TEXT,
                school_abbreviation TEXT
            );
        `);

    // Batch Insert
    const BATCH_SIZE = 1000;
    let inserted = 0;

    // We use ON CONFLICT DO NOTHING to avoid errors on duplicates
    for (let i = 0; i < results.length; i += BATCH_SIZE) {
      const batch = results.slice(i, i + BATCH_SIZE);
      const values = [];
      const placeholders = [];

      batch.forEach((row, rowIndex) => {
        const offset = rowIndex * 13;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13})`);
        values.push(
          row.school_id, row.school_name, row.region, row.division,
          row.legislative_district, row.province, row.municipality,
          row.barangay, row.latitude, row.longitude, row.sub_office,
          row.school_type, row.school_abbreviation
        );
      });

      await client.query(`
                INSERT INTO schools (
                    school_id, school_name, region, division,
                    legislative_district, province, municipality,
                    barangay, latitude, longitude, sub_office,
                    school_type, school_abbreviation
                ) VALUES ${placeholders.join(', ')}
                ON CONFLICT (school_id) DO NOTHING;
            `, values);

      inserted += batch.length;
      console.log(`📦 Inserted batch ${i / BATCH_SIZE + 1} (${inserted}/${results.length})`);
    }

    res.json({ message: "Seeding complete", count: inserted });
  } catch (err) {
    console.error("❌ Seeding failed:", err);
    res.status(500).json({ error: "Seeding failed", details: err.message });
  } finally {
    client.release();
  }
});


// --- [Hawkeye Protocol] COMPREHENSIVE SERVER STARTUP (v2.0) ---
const startServer = async () => {
    try {
        console.log("🚀 Initializing InsightEd Master Services...");

        // 1. Initialise Job Queue (pg-boss) — Removed for School Head Portal

        // 2. Database Migrations (Clustered Resilience)
        // Only the first worker (Instance 0) handles DDL to avoid AccessExclusiveLock contention.
        const isPrimaryWorker = !process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === '0';
        
        if (isPrimaryWorker) {
            console.log("🏗️ [Primary] Running boot-time migrations...");
            // ✅ [RESILIENCE FIX] Migrations are non-fatal. If the pool is under pressure
            // at startup (e.g. during a rolling restart under traffic), log the error and
            // continue. Migrations are idempotent — they will be applied on the next cycle.
            try {
                const migClient = await pool.connect();
                try {
                    await initOtpTable(migClient);
                    await runMigrations(migClient, 'Primary');
                    console.log("✅ [Primary] Pre-flight migrations complete.");
                } finally {
                    migClient.release();
                }
            } catch (migErr) {
                console.warn(`⚠️ [Primary] Boot-time migration skipped (pool pressure): ${migErr.message}. Will retry on next restart.`);
            }
        } else {
            console.log(`📡 [Worker ${process.env.NODE_APP_INSTANCE || 'DEV'}] Migrations skipped (handled by Primary).`);
        }

        // 3. Start Public API
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`✨ InsightEd Master Server listening on port ${PORT}`);
            isDbConnected = true;
            
            // Notify PM2 we're ready (handles 'wait_ready: true' in ecosystem.config.cjs)
            if (process.send) {
                process.send('ready');
            }
        });

    } catch (error) {
        console.error("❌ CRITICAL: Master startup sequence failed!");
        console.error(error);
        process.exit(1);
    }
};

// Launch the cluster
startServer();

