import dotenv from 'dotenv';
import express from 'express';
console.log("📌 >>> RUNNING: [ROOT]/api/index.js <<< 📌");
// Robust Login Fix v1.1 - Optimized teachers_list connections removed.

import { google } from 'googleapis';
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
const { PgBoss } = require('pg-boss');
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
import XLSX from 'xlsx';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

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
const dbUrl = process.env.DATABASE_URL || 'postgres://Administrator1:<REDACTED_PGB_PASS>@20.24.58.49:6432/insightEd';
const isLoopback = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
const isVmProxy = dbUrl.includes('20.24.58.49');
// [Hawkeye Protocol] Throttling is only for local dev machines (localhost/loopback) NOT in staging/production modes.
const isLocal = isLoopback && process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'staging';

console.log(`🔌 Database Connection: ${isVmProxy ? 'Remote VM (Azure Proxy)' : (isLoopback ? 'Local Loopback' : 'Remote')} (${dbUrl.replace(/:[^:@]*@/, ':****@')}) [ENV: ${process.env.NODE_ENV || 'dev'}]`);

// [Job Queue Architecture] Initialize PgBoss for ESF7 scaling
// Use the existing pool via db.executeSql so pg-boss never opens its own
// connection — this sidesteps the PgBouncer database-alias mismatch where
// port 5432 does not recognise the name that PgBouncer exposes on port 6432.
// pg-boss falls back to SQL polling instead of LISTEN/NOTIFY which is fine
// for async scan jobs.
let bossReady = false;
let bossStartError = null;

const boss = new PgBoss({
  db: {
    executeSql: (text, values) => pool.query(text, values),
  },
  schedule: false, // [Fix] correctly disables timekeeper in pg-boss v12
});

boss.on('error', error => console.error('💥 [PG-BOSS] Global Error:', error));
boss.on('monitor-states', states => {
    const q = states.queues['esf7-local-scan'];
    if (q) {
        console.log(`📊 [PG-BOSS] Queue '${q.name}': [Active: ${q.active}, Pending: ${q.pending}, Completed: ${q.completed}]`);
    }
});

// [Job Queue Architecture] Initialize Worker for ESF7 Scans



// Shared Helper for Excel Parsing
async function processEsf7Buffer(buffer, onProgress) {
    const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' }); 
    const sheetName = workbook.SheetNames.find(n => n.toUpperCase() === 'DB_USER');
    if (!sheetName) throw new Error("Missing 'DB_USER' sheet.");
    const worksheet = workbook.Sheets[sheetName];

    // Quick Audit Range (A-Z, 1000 rows)
    const allRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null, range: 'A1:Z1001' });
    let headerRowIdx = -1;
    let colMap = { first: -1, last: -1, pos: -1, fund: -1 };
    
    for (let i = 0; i < Math.min(allRows.length, 100); i++) {
        const row = allRows[i] || [];
        const lowerRow = row.map(c => String(c || "").trim().toUpperCase());
        if (lowerRow.includes("FIRST") && lowerRow.includes("LAST")) {
            headerRowIdx = i;
            colMap.last = lowerRow.indexOf("LAST");
            colMap.first = lowerRow.indexOf("FIRST");
            colMap.pos = lowerRow.findIndex(c => c === "POSITION" || c.includes("POS"));
            colMap.fund = lowerRow.findIndex(c => c === "FUND SOURCE" || c.includes("FUND"));
            break;
        }
    }

    if (headerRowIdx === -1) throw new Error("Could not identify standard ESF7 headers.");

    let teachingCount = 0;
    let relatedCount = 0;
    let nonTeachingCount = 0;
    let schoolHead = { name: "N/A", position: "N/A", rank: -1 };

    const scannedPersonnel = {
        teaching: [],
        related: [],
        nonTeaching: []
    };

    const rowsToProcess = allRows.slice(headerRowIdx + 1);
    const totalRows = rowsToProcess.length;

    for (let i = 0; i < totalRows; i++) {
        const row = rowsToProcess[i];
        const hasName = (row[colMap.first] && String(row[colMap.first]).trim() !== "") || 
                      (row[colMap.last] && String(row[colMap.last]).trim() !== "");

        if (hasName) {
            const pos = String(row[colMap.pos] || "").trim().toUpperCase();
            const first = String(row[colMap.first] || "").trim();
            const last = String(row[colMap.last] || "").trim();
            const fullName = `${first} ${last}`;
            const fund = String(row[colMap.fund] || "LOCAL").trim().toUpperCase();
            
            const staffObj = { first, last, position: row[colMap.pos], fund_source: fund };

            if (TEACHING_POSITIONS.some(tp => pos.includes(tp))) {
                teachingCount++;
                scannedPersonnel.teaching.push(staffObj);
            }
            else if (RELATED_TEACHING_POSITIONS.some(rp => pos.includes(rp))) {
                relatedCount++;
                scannedPersonnel.related.push(staffObj);
            }
            else {
                nonTeachingCount++;
                scannedPersonnel.nonTeaching.push(staffObj);
            }

            const rank = getPositionRank(pos);
            if (rank > schoolHead.rank) schoolHead = { name: fullName, position: row[colMap.pos] || pos, rank };
        }

        // Progress heartbeat (every 10% or at least every 50 rows)
        if (onProgress && totalRows > 0 && (i % Math.max(1, Math.floor(totalRows / 10)) === 0)) {
            const pct = Math.min(98, 10 + Math.round((i / totalRows) * 85));
            await onProgress(pct).catch(() => {});
        }
    }

    return {
        summary: {
            schoolHead: schoolHead.name,
            schoolHeadPosition: schoolHead.position,
            teaching: teachingCount,
            relatedTeaching: relatedCount,
            nonTeaching: nonTeachingCount,
            total: teachingCount + relatedCount + nonTeachingCount
        },
        scannedPersonnel
    };
}

const logActivity = (userUid, userName, role, actionType, targetEntity, details, superUserContext = null) => {
  if (!boss) return;
  
  let dbDetails = details;
  if (superUserContext) {
    dbDetails = `[SUPER USER VIEW] ${details} (Context: ${superUserContext})`;
  }

  boss.send('activity-log', {
    user_uid: userUid,
    user_name: userName || 'System',
    role: role || 'User',
    action_type: actionType,
    details: dbDetails,
    target_entity: targetEntity,
    timestamp: new Date().toISOString()
  }).catch(err => console.error("⚠️ [AsyncLog-Fail] Could not queue log:", err.message));
};


const { Pool } = pg;
// [Hawkeye Protocol v4.0 — Unified Cloud Scaling]
// Azure DB supports 1718 connections. PgBouncer supports 2000 clients & 500 pool size.
// Following the root cause fix (restoring 6432 proxy), we scale to 100 connections per worker.
// 8 workers × 100 = 800 clients multiplexed by PgBouncer (500) into Azure (1718).
const pool = new Pool({
  connectionString: dbUrl,
  ssl: (isLoopback || isVmProxy) ? false : { rejectUnauthorized: false }, // Maintain SSL: false for Proxy
  max: isLocal ? 20 : 100, // Throttled ONLY on dev machines; full scale for VM Proxy
  min: isLocal ? 2 : 10,
  idleTimeoutMillis: isLocal ? 30000 : 15000, // More patient locally for network latency
  connectionTimeoutMillis: 10000, 
  maxUses: 7500,
  application_name: isLocal ? 'InsightEd_Local_Dev' : 'InsightEd_API_Cluster'
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

// Inject pool into chatbot module
setPool(pool);

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
let drive;
try {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
    });
    drive = google.drive({ version: 'v3', auth });
    console.log("✅ Google Drive API Initialized");
  }
} catch (error) {
  console.error("❌ Failed to initialize Google Drive API:", error.message);
}

// --- PDF OPTIMIZATION PIPELINE (Hydra Transformation Engine) ---
const compressBufferTo96Dpi = async (buffer) => {
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

        // PROJECT HYDRA: If file is > 1.5MB, attempt Hydra Transformation (PDF to Image Sequence)
        if (buffer.length > 1.5 * 1024 * 1024) {
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

        const cmd = (py) => `${py} "${scriptPath.replace(/\\/g, '/')}" "${tempInput.replace(/\\/g, '/')}" "${tempOutput.replace(/\\/g, '/')}" 96`;
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
            console.warn(`⚠️ [PDF-Compress] Compression unavailable — storing original.`);
        }

        if (fs.existsSync(tempOutput)) {
            result.buffer = fs.readFileSync(tempOutput);
            fs.unlinkSync(tempOutput);
        }
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
const initESF7Tables = async () => {
    try {
        const lockRes = await pool.query('SELECT pg_try_advisory_lock(5555555) as lock_granted');
        if (!lockRes.rows[0].lock_granted) {
            console.log("⚠️ [ESF7-Init] Tables already being initialized by another worker.");
            return;
        }

        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS esf7_link (
                    school_id TEXT PRIMARY KEY,
                    link TEXT NOT NULL,
                    row_count INTEGER,
                    preview_data JSONB,
                    summary JSONB,
                    status TEXT DEFAULT 'PENDING_SDO',
                    uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );
                ALTER TABLE esf7_link ADD COLUMN IF NOT EXISTS summary JSONB;
                ALTER TABLE esf7_link ADD COLUMN IF NOT EXISTS audit_remarks TEXT;
                ALTER TABLE esf7_link ADD COLUMN IF NOT EXISTS file_path TEXT;
                CREATE TABLE IF NOT EXISTS ESF7_Database (
                    id SERIAL PRIMARY KEY,
                    school_id TEXT,
                    iern TEXT,
                    esf7_id TEXT UNIQUE,
                    first TEXT,
                    last TEXT,
                    middle TEXT,
                    position TEXT,
                    fund_source TEXT,
                    gender TEXT,
                    major__specialization TEXT,
                    teaching_load TEXT,
                    appt_mm TEXT,
                    appt_yyyy TEXT,
                    submitted_at TIMESTAMPTZ,
                    status TEXT,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );
                ALTER TABLE ESF7_Database ADD COLUMN IF NOT EXISTS iern TEXT;
                ALTER TABLE ESF7_Database ADD COLUMN IF NOT EXISTS esf7_id TEXT;
                ALTER TABLE ESF7_Database ADD COLUMN IF NOT EXISTS first TEXT;
                ALTER TABLE ESF7_Database ADD COLUMN IF NOT EXISTS last TEXT;
                ALTER TABLE ESF7_Database ADD COLUMN IF NOT EXISTS position TEXT;
                ALTER TABLE ESF7_Database ADD COLUMN IF NOT EXISTS fund_source TEXT;
                ALTER TABLE ESF7_Database ADD COLUMN IF NOT EXISTS gender TEXT;
                ALTER TABLE ESF7_Database ADD COLUMN IF NOT EXISTS major__specialization TEXT;
                ALTER TABLE ESF7_Database ADD COLUMN IF NOT EXISTS teaching_load TEXT;
                ALTER TABLE ESF7_Database ADD COLUMN IF NOT EXISTS appt_mm TEXT;
                ALTER TABLE ESF7_Database ADD COLUMN IF NOT EXISTS appt_yyyy TEXT;
                ALTER TABLE ESF7_Database ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
                ALTER TABLE ESF7_Database ADD COLUMN IF NOT EXISTS middle TEXT;
                ALTER TABLE ESF7_Database ADD COLUMN IF NOT EXISTS data JSONB;
                
                CREATE TABLE IF NOT EXISTS esf7_scan_results (
                    job_id UUID PRIMARY KEY,
                    school_id TEXT,
                    result JSONB,
                    error TEXT,
                    status TEXT DEFAULT 'PENDING',
                    progress INTEGER DEFAULT 0,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                ALTER TABLE esf7_scan_results ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;
                CREATE INDEX IF NOT EXISTS idx_esf7_scan_job ON esf7_scan_results(job_id);

                CREATE TABLE IF NOT EXISTS esf7_resubmission_request (
                    id SERIAL PRIMARY KEY,
                    school_id TEXT UNIQUE,
                    status TEXT DEFAULT 'PENDING',
                    can_resubmit BOOLEAN DEFAULT false,
                    request_reason TEXT,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS esf_link (
                    id SERIAL PRIMARY KEY,
                    school_id TEXT UNIQUE,
                    link TEXT,
                    status TEXT,
                    row_count INTEGER,
                    summary JSONB,
                    audit_remarks TEXT,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS ESF7_Staging (
                    id SERIAL PRIMARY KEY,
                    school_id TEXT,
                    data JSONB,
                    status TEXT,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );
                ALTER TABLE ESF7_Staging ADD COLUMN IF NOT EXISTS data JSONB;
            `);
            console.log("✅ ESF7 link/database tables verified.");
        } finally {
            await pool.query('SELECT pg_advisory_unlock(5555555)');
        }
    } catch (err) {
        console.error("❌ Failed to init ESF7 tables:", err.message);
    }
};

app.get('/api/esf7/heartbeat', (req, res) => res.json({ status: 'alive' }));







// 1. QUICK SCAN (Verify Access & Metadata)
const TEACHING_POSITIONS = [
    "TEACHER", "MASTER TEACHER", "SPED TEACHER", "SPECIAL SCIENCE TEACHER", "ALS TR", "IP TR", "MADRASAH TR", "ALIVE TEACHER", "TIC"
];

const RELATED_TEACHING_POSITIONS = [
    "HEAD TEACHER", "PRINCIPAL", "ASSISTANT SCHOOL PRINCIPAL", "GUIDANCE COUNSELOR", "LIBRARIAN", "REGISTRAR", "SCHOOL HEAD"
];

const NON_TEACHING_POSITIONS = [
    "ACCOUNTANT", "ACCOUNTING CLERK", "ADMINISTRATIVE AIDE", "ADMINISTRATIVE ASSISTANT", "ADMINISTRATIVE OFFICER", "AGRICULTURIST",
    "AQUACULTURAL TECHNICIAN", "AQUACULTURST", "BOOKKEEPER", "CASHIER", "CHIEF ADMINISTRATIVE OFFICER", "CLERK", "COLLEGE LIBRARIAN",
    "COMMUNICATIONS EQUIPMENT OPERATOR", "COMPUTER MAINTENANCE TECHNOLOGIST", "CONSTRUCTION AND MAINTENANCE MAN", "COOK", "COXSWAIN",
    "DENTAL AIDE", "DENTIST", "DISBURSING OFFICER", "DRIVER", "ENGINEER", "FARM WORKER", "FISCAL CLERK", "FISHERMAN", "HANDICRAFT WORKER",
    "HEAVY EQUIPMENT OPERATOR", "HOUSEPARENT", "INFORMATION SYSTEMS ANALYST", "INFORMATION TECHNOLOGY OFFICER", "LABORATORY TECHNICIAN",
    "LIBRARIAN", "LIGHT EQUIPMENT OPERATOR", "LINEMAN", "MARINE ENGINEMAN", "MASTER FISHERMAN", "MECHANIC", "MECHANICAL PLANT OPERATOR",
    "MEDICAL OFFICER", "NURSE", "NURSE MAID", "NURSING ATTENDANT", "NUTRITIONIST-DIETITIAN", "PLANNING OFFICER", "PROJECT DEVELOPMENT OFFICER",
    "PSYCHOLOGIST", "REGISTRAR", "REPRODUCTION MACHINE OPERATOR", "SCHOOL LIBRARIAN", "SCHOOLS DIVISION SUPERINTENDENT", "SECURITY GUARD",
    "SECURITY OFFICER", "SENIOR BOOKKEEPER", "SOCIAL WELFARE OFFICER", "STATISTICIAN AIDE", "SUPPLY OFFICER",
    "TECHNICAL EDUCATION AND SKILLS DEVELOPMENT SPECIALIST", "TELEGRAM CARRIER", "UTILITY FOREMAN", "UTILITY WORKER", "VOCATIONAL PLACEMENT COORDINATOR",
    "WATCHMAN", "LEARNING SUPPORT AIDE", "INTERN", "OTHERS"
];

const getPositionRank = (pos) => {
    if (!pos) return -1;
    const p = pos.toUpperCase();
    if (p.includes("PRINCIPAL IV")) return 100;
    if (p.includes("PRINCIPAL III")) return 90;
    if (p.includes("PRINCIPAL II")) return 80;
    if (p.includes("PRINCIPAL I")) return 70;
    if (p.includes("HEAD TEACHER VI")) return 60;
    if (p.includes("HEAD TEACHER V")) return 55;
    if (p.includes("HEAD TEACHER IV")) return 50;
    if (p.includes("HEAD TEACHER III")) return 45;
    if (p.includes("HEAD TEACHER II")) return 40;
    if (p.includes("HEAD TEACHER I")) return 35;
    if (p.includes("TIC") || p.includes("OIC")) return 30;
    if (p.includes("MASTER TEACHER")) return 20;
    if (p.includes("TEACHER III")) return 15;
    if (p.includes("TEACHER II")) return 10;
    if (p.includes("TEACHER I")) return 5;
    return 1;
};

const ESF7_DRAFT_DIR = path.join(UPLOAD_BASE_PATH, 'esf7_drafts');
if (!fs.existsSync(ESF7_DRAFT_DIR)) {
    try {
        fs.mkdirSync(ESF7_DRAFT_DIR, { recursive: true });
        console.log(`📁 [ESF7] Created Local Draft Directory: ${ESF7_DRAFT_DIR}`);
    } catch (err) {
        console.error(`❌ [ESF7] Critical Error: Could not create draft directory:`, err.message);
    }
}

const esf7Storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, ESF7_DRAFT_DIR);
    },
    filename: (req, file, cb) => {
        const school_id = req.body.school_id || 'unknown';
        cb(null, `${school_id}_ESF7_${Date.now()}.xlsb`);
    }
});
const esf7Upload = multer({ storage: esf7Storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit

app.post('/api/esf7/upload', esf7Upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded." });
        if (!bossReady) {
            return res.status(503).json({ error: `Job queue not ready. Reason: ${bossStartError || 'still starting'}` });
        }
        const { school_id } = req.body;
        
        // Push scan job
        console.log(`📤 [ESF7-Upload] Received file for school ${school_id}`);
        console.log(`📤 [ESF7-Upload] Absolute Path: ${req.file.path}`);
        
        const jobId = await boss.send('esf7-local-scan', { school_id, filePath: req.file.path });
        console.log(`📤 [ESF7-Upload] Job queued successfully. JobID: ${jobId}`);
        
        await pool.query(`
          INSERT INTO esf7_scan_results (job_id, school_id, status)
          VALUES ($1, $2, 'PENDING')
        `, [jobId, school_id]);

        res.json({ success: true, jobId, fileName: req.file.filename });
    } catch (err) {
        console.error('💥 [ESF7-Upload] Unexpected error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/esf7/link-check', async (req, res) => {
    const { driveLink } = req.body;
    try {
        const fileId = driveLink.match(/[-\w]{25,}/)?.[0];
        if (!fileId) return res.status(400).json({ error: "Invalid Link Format", details: "The provided URL does not appear to be a valid Google Drive link." });

        if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
            return res.status(500).json({ error: "Infrastructure Error", details: "Google Cloud Service Account is not configured on the server." });
        }

        const credentialsObj = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        const auth = new google.auth.GoogleAuth({
            credentials: { client_email: credentialsObj.client_email, private_key: credentialsObj.private_key },
            scopes: ['https://www.googleapis.com/auth/drive.readonly']
        });
        const drive = google.drive({ version: 'v3', auth });
        
        // Fetch metadata to check name and access
        const file = await drive.files.get({ fileId, fields: 'id, name, mimeType' });
        
        if (!file.data.name.toLowerCase().endsWith('.xlsb')) {
            return res.status(400).json({ 
                error: "Incorrect File Type", 
                details: `Detected file: "${file.data.name}". Only .XLSB files are supported for ESF7 audits. Please upload the correct binary template to your Drive.` 
            });
        }

        res.json({ success: true, message: "Link verified and accessible.", fileName: file.data.name });
    } catch (err) {
        console.error("Link Verification Error:", err.message);
        res.status(403).json({ 
            error: "Access Denied / Not Found", 
            details: "Ensure the file is shared with the InsightEd Service Account as a 'Viewer'. Double check if the link is correct and accessible." 
        });
    }
});


app.get('/api/esf7/job-status/:jobId', async (req, res) => {
    const { jobId } = req.params;
    if (!jobId || jobId === 'null' || jobId === 'undefined') {
        return res.status(400).json({ error: "Invalid Job ID" });
    }

    try {
        const result = await pool.query("SELECT * FROM esf7_scan_results WHERE job_id = $1", [jobId]);
        if (result.rows.length === 0) return res.json({ status: 'QUEUED' });
        res.json(result.rows[0]);
    } catch (err) { 
        console.error("❌ Job Status Error:", err.message);
        res.status(500).json({ error: err.message }); 
    }
});

app.post('/api/esf7/submit', async (req, res) => {
    const { school_id, driveLink, fileName, summary } = req.body;
    try {
        await pool.query(`
            INSERT INTO esf7_link (school_id, link, file_path, summary, row_count, status, updated_at)
            VALUES ($1, $2, $3, $4, $5, 'QUEUED', CURRENT_TIMESTAMP)
            ON CONFLICT (school_id) DO UPDATE SET 
                link = $2, 
                file_path = $3, 
                summary = $4,
                row_count = $5,
                status = 'QUEUED',
                updated_at = CURRENT_TIMESTAMP
        `, [school_id, driveLink || 'LOCAL_BINARY', fileName, JSON.stringify(summary), summary?.total || 0]);



        
        await pool.query("UPDATE ph_schools SET unit7 = 1.0, unit7_status = 'QUEUED' WHERE school_id = $1", [school_id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


app.post('/api/esf7/link-submit', async (req, res) => {
    const { school_id, driveLink, rowCount, previewData, summary } = req.body;
    try {
        // DELETE previous data to ensure clean ingestion
        await pool.query("DELETE FROM ESF7_Database WHERE school_id = $1", [school_id]);
        
        await pool.query(`
            INSERT INTO esf7_link (school_id, link, row_count, preview_data, summary, status, uploaded_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, 'QUEUED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (school_id) DO UPDATE SET 
                link = $2, 
                row_count = $3, 
                preview_data = $4,
                summary = NULL,
                status = 'QUEUED',
                updated_at = CURRENT_TIMESTAMP
        `, [school_id, driveLink, rowCount, JSON.stringify(previewData), JSON.stringify(summary)]);
        await pool.query("UPDATE ph_schools SET unit7 = 0.5, unit7_status = 'QUEUED', updated_at = CURRENT_TIMESTAMP WHERE school_id = $1", [school_id]);
        res.json({ success: true });
    } catch (err) { 
        console.error("Clean-Slate Error:", err);
        res.status(500).json({ error: err.message }); 
    }
});

app.get('/api/esf7/status/:school_id', async (req, res) => {
    try {
        const result = await pool.query("SELECT status FROM esf7_link WHERE school_id = $1", [req.params.school_id]);
        if (result.rows.length === 0) {
            return res.json({ success: true, status: 'NOT_STARTED' });
        }
        res.json({ success: true, status: result.rows[0].status });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/esf7/link-status/:school_id', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT el.status, el.row_count, el.link, el.audit_remarks, el.summary,
                   el.uploaded_at AT TIME ZONE 'UTC' as uploaded_at,
                   rr.can_resubmit, rr.status as request_status
            FROM esf7_link el
            LEFT JOIN esf7_resubmission_request rr ON el.school_id = rr.school_id
            WHERE el.school_id = $1
        `, [req.params.school_id]);
        res.json({ success: true, data: result.rows[0] || { status: 'NOT_STARTED' } });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/esf7/link-detail/:school_id', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT *, uploaded_at AT TIME ZONE 'UTC' as submitted_at 
            FROM esf7_link WHERE school_id = $1
        `, [req.params.school_id]);
        if (result.rows.length === 0) return res.status(404).json({ error: "No link submitted." });
        res.json({ success: true, data: result.rows[0] });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/esf7/enqueue-harvest', async (req, res) => {
    try {
        await pool.query("UPDATE esf7_link SET status = 'QUEUED', updated_at = CURRENT_TIMESTAMP WHERE school_id = $1", [req.body.school_id]);
        await pool.query("UPDATE ph_schools SET unit7_status = 'QUEUED', updated_at = CURRENT_TIMESTAMP WHERE school_id = $1", [req.body.school_id]);
        res.json({ success: true, message: "Enqueued for harvesting." });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/esf7/data/:school_id', async (req, res) => {
    try {
        // First get the verified IERn for this school_id
        const schoolInfo = await pool.query('SELECT iern FROM ph_schools WHERE school_id = $1', [req.params.school_id]);
        const iern = schoolInfo.rows[0]?.iern;

        if (!iern) return res.status(404).json({ error: "School not found." });

        const result = await pool.query(`
            SELECT 
                "first", "last", "middle", "position", "fund_source", "major__specialization", 
                "birthday_mm", "birthday_dd", "birthday_yyyy",
                "appt_mm", "1" as appt_dd, "appt_yyyy", "gender", "tin", "employee_no", "civil_status", "status__item_", "esf7_id", "source_id"
            FROM ESF7_Database 
            WHERE iern = $1 
            ORDER BY "last" ASC, "first" ASC
        `, [iern]);
        res.json({ success: true, data: result.rows });
    } catch (err) { 
        console.error("Fetch ESF7 Data Error:", err);
        res.status(500).json({ error: err.message }); 
    }
});

app.get('/api/esf7/stats', async (req, res) => {
    const { region, division } = req.query;
    let whereClause = ' WHERE 1=1';
    const params = [];
    if (region && region !== 'All') {
        params.push(region);
        whereClause += ` AND UPPER(TRIM(ps.region)) = UPPER(TRIM($${params.length}))`;
    }
    if (division && division !== 'All Divisions') {
        params.push(division);
        whereClause += ` AND UPPER(TRIM(ps.division)) = UPPER(TRIM($${params.length}))`;
    }
    try {
        const query = `
            SELECT 
                COUNT(DISTINCT i."SchoolID")::int as total_registered,
                COUNT(DISTINCT CASE WHEN el.status IN ('PENDING_SDO', 'QUEUED') THEN i."SchoolID" END)::int as pending_sdo,
                COUNT(DISTINCT CASE WHEN el.status = 'VERIFIED' THEN i."SchoolID" END)::int as verified,
                COUNT(DISTINCT CASE WHEN el.status = 'NEEDS_RESUBMISSION' THEN i."SchoolID" END)::int as needs_resubmission,
                COUNT(DISTINCT i."SchoolID") - COUNT(DISTINCT el.school_id)::int as missing_esf7
            FROM "schools_IERN" i
            JOIN ph_schools ps ON i."SchoolID" = ps.school_id
            LEFT JOIN esf7_link el ON i."SchoolID" = el.school_id
            ${whereClause}
        `;
        const result = await pool.query(query, params);
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error("Fetch ESF7 Stats Error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get('/api/esf7/regional-summary', async (req, res) => {
    const { region } = req.query;
    if (!region) return res.status(400).json({ error: "Region is required" });
    try {
        const query = `
            SELECT 
                ps.division,
                COUNT(DISTINCT i."SchoolID")::int as total_schools,
                COUNT(DISTINCT CASE WHEN el.status IN ('VERIFIED', 'PENDING_SDO', 'QUEUED', 'NEEDS_RESUBMISSION') THEN i."SchoolID" END)::int as harvested_schools,
                COUNT(DISTINCT CASE WHEN el.status IN ('PENDING_SDO', 'QUEUED') THEN i."SchoolID" END)::int as pending_sdo,
                COUNT(DISTINCT CASE WHEN el.status = 'VERIFIED' THEN i."SchoolID" END)::int as verified,
                COUNT(DISTINCT CASE WHEN el.status = 'NEEDS_RESUBMISSION' THEN i."SchoolID" END)::int as needs_resubmission,
                COUNT(DISTINCT i."SchoolID") - COUNT(DISTINCT el.school_id)::int as missing_esf7
            FROM "schools_IERN" i
            JOIN ph_schools ps ON i."SchoolID" = ps.school_id
            LEFT JOIN esf7_link el ON i."SchoolID" = el.school_id
            WHERE UPPER(TRIM(ps.region)) = UPPER(TRIM($1))
            GROUP BY ps.division
            ORDER BY ps.division ASC
        `;
        const result = await pool.query(query, [region]);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error("Fetch Regional ESF7 Summary Error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get('/api/esf7/all-schools', async (req, res) => {
    const { region, division } = req.query;
    try {
        let query = `
            SELECT 
                i."SchoolID" as school_id, 
                i."School_Name" as school_name, 
                COALESCE(el.status, 'NOT_STARTED') as status, 
                COALESCE(el.updated_at, i.updated_at) as updated_at,
                el.row_count,
                el.audit_remarks,
                el.summary,
                el.uploaded_at as submitted_at
            FROM "schools_IERN" i
            LEFT JOIN ph_schools ps ON i."SchoolID" = ps.school_id
            LEFT JOIN esf7_link el ON i."SchoolID" = el.school_id
            WHERE 1=1
        `; 
        const params = [];
        if (region && region !== 'All') {
            params.push(region);
            query += ` AND UPPER(TRIM(ps.region)) = UPPER(TRIM($${params.length}))`;
        }
        if (division && division !== 'All Divisions') {
            params.push(division);
            query += ` AND UPPER(TRIM(ps.division)) = UPPER(TRIM($${params.length}))`;
        }
        query += ` ORDER BY updated_at DESC, i."School_Name" ASC`;
        console.log("DEBUG [ESF7 All-Schools] Executing:", { query, params });
        const result = await pool.query(query, params);
        console.log("DEBUG [ESF7 All-Schools] Count =", result.rows.length);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error("Fetch All Schools ESF7 Error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post('/api/esf7/audit-remark', async (req, res) => {
    const { school_id, remark, status } = req.body;
    try {
        await pool.query(`
            UPDATE esf7_link 
            SET audit_remarks = $1, 
                status = $2, 
                updated_at = CURRENT_TIMESTAMP 
            WHERE school_id = $3
        `, [remark, status || 'NEEDS_RESUBMISSION', school_id]);

        if (status === 'NEEDS_RESUBMISSION') {
            await pool.query("UPDATE ph_schools SET unit7 = 0, unit7_status = 'NEEDS_RESUBMISSION', updated_at = CURRENT_TIMESTAMP WHERE school_id = $1", [school_id]);
        }
        
        res.json({ success: true });
    } catch (err) {
        console.error("Audit Remark Error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/esf7/reject-link', async (req, res) => {
    try {
        await pool.query("UPDATE esf7_link SET status = 'REJECTED' WHERE school_id = $1", [req.body.school_id]);
        await pool.query("UPDATE ph_schools SET unit7 = 0 WHERE school_id = $1", [req.body.school_id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/esf7/request-resubmission', async (req, res) => {
    try {
        await pool.query("UPDATE esf7_link SET status = 'PENDING_RESUBMISSION', updated_at = CURRENT_TIMESTAMP WHERE school_id = $1", [req.body.school_id]);
        res.json({ success: true, message: "Resubmission request sent to SDO." });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/esf7/specialization-summary/:school_id', async (req, res) => {
    try {
        const { school_id } = req.params;
        const result = await pool.query(`
            SELECT * 
            FROM ESF7_Database 
            WHERE school_id = $1 
        `, [school_id]);
        
        const counts = {};
        const LIST = [
            "GENERAL EDUCATION", "FAMILY LIFE AND CHILD DEVELOPMENT", "SPECIAL NEEDS EDUCATION",
            "EARLY CHILDHOOD EDUCATION", "FILIPINO", "ENGLISH", "MATHEMATICS", "SCIENCE",
            "ARALING PANLIPUNAN", "TLE/EPP", "MAPEH", "ESP/VALUES EDUCATION", "BIOLOGICAL SCIENCES",
            "PHYSICAL SCIENCES", "AGRICULTURE AND FISHERY ARTS"
        ];
        
        LIST.forEach(s => counts[s] = 0);
        counts["OTHERS"] = 0;

        let teaching = 0, related = 0, nonTeaching = 0;
        const TEACHING = ["TEACHER I", "TEACHER II", "TEACHER III", "MASTER TEACHER I", "MASTER TEACHER II", "MASTER TEACHER III", "MASTER TEACHER IV", "SPET I", "SPET II", "SPET III", "SPET IV", "SST I", "SST II", "SST III"];
        const RELATED = ["PRINCIPAL I", "PRINCIPAL II", "PRINCIPAL III", "PRINCIPAL IV", "HEAD TEACHER I", "HEAD TEACHER II", "HEAD TEACHER III", "HEAD TEACHER IV", "HEAD TEACHER V", "HEAD TEACHER VI", "GUIDANCE COUNSELOR I", "GUIDANCE COUNSELOR II", "GUIDANCE COUNSELOR III", "LIBRARIAN I", "LIBRARIAN II", "LIBRARIAN III"];


        result.rows.forEach(row => {
            // Check for National Funding
            const fundSource = (row.fund_source || row.funding_source || row.funding__source || "").toUpperCase();
            if (fundSource !== "NATIONAL" && fundSource !== "DEPED" && fundSource !== "DEPED-NATIONAL") return;

            // Categories
            const pos = (row.position || "").toUpperCase();
            if (TEACHING.some(t => pos.includes(t))) teaching++;
            else if (RELATED.some(r => pos.includes(r))) related++;
            else nonTeaching++;

            // Specializations
            const spec = (row.major__specialization || "").toUpperCase().trim();
            if (LIST.includes(spec)) counts[spec] = (counts[spec] || 0) + 1;
            else if (spec) counts["OTHERS"] += 1;
        });

        res.json({ 
            success: true, 
            data: counts,
            personnel: {
                teaching,
                relatedTeaching: related,
                nonTeaching: nonTeaching,
                total: teaching + related + nonTeaching
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/esf7/force-harvest', async (req, res) => {
    try {
        const { school_id } = req.body;
        await pool.query("UPDATE esf7_link SET status = 'QUEUED', updated_at = CURRENT_TIMESTAMP WHERE school_id = $1", [school_id]);
        await pool.query("UPDATE ph_schools SET unit7 = 0.5, unit7_status = 'QUEUED', updated_at = CURRENT_TIMESTAMP WHERE school_id = $1", [school_id]);
        res.json({ success: true, message: "School enqueued for immediate re-harvest." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/esf7/approve-resubmission', async (req, res) => {
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        const school_id = req.body.school_id;

        // Get IERn first
        const iernRes = await client.query('SELECT iern FROM ph_schools WHERE school_id = $1', [school_id]);
        const iern = iernRes.rows[0]?.iern;

        // 1. Reset link status
        await client.query("UPDATE esf7_link SET status = 'NOT_STARTED', link = NULL, row_count = NULL, updated_at = CURRENT_TIMESTAMP WHERE school_id = $1", [school_id]);
        
        // 2. Reset school progress
        await client.query("UPDATE ph_schools SET unit7 = 0, unit7_status = 'NOT_STARTED', updated_at = CURRENT_TIMESTAMP WHERE school_id = $1", [school_id]);

        // 3. Delete ESF7_Database entries for this IERn to allow clean re-harvest
        if (iern) {
            await client.query("DELETE FROM ESF7_Database WHERE iern = $1", [iern]);
        }

        await client.query('COMMIT');
        res.json({ success: true, message: "Module unsealed. School can now re-submit." });
    } catch (err) { 
        if (client) await client.query('ROLLBACK');
        res.status(500).json({ error: err.message }); 
    } finally {
        if (client) client.release();
    }
});

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
        const { buffer: compressedBuffer, hydraManifest } = await compressBufferTo96Dpi(req.file.buffer);
        const { binary_id, stored_size, original_size: returnedOrigSize } = await upsertBinary(pool, compressedBuffer, 'application/pdf', req.file.size);
        
        finalBinaryId = binary_id;
        finalDocValue = `/api/asset/${binary_id}`;
        storedSize = stored_size; 
        finalHydraManifest = hydraManifest;
        originalSizeFound = returnedOrigSize || req.file.size;

        console.log(`🗄️ [SchoolDocStore] Stored ownership doc: ${binary_id} | size=${storedSize}B | hydra=${!!hydraManifest} | (orig=${originalSizeFound}B)`);
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
      `INSERT INTO school_ownership_docs (iern, school_id, file_path, file_name, doc_type, status, binary_id, file_size, original_size, hydra_manifest) 
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
      [iern, resolvedSchoolId, finalDocValue, req.file.originalname, doc_type, 'optimized', finalBinaryId, storedSize, originalSizeFound, finalHydraManifest ? JSON.stringify(finalHydraManifest) : null]
    );

    const savedRow = dbRes.rows[0];
    console.log(`✅ [SchoolDocStore] Record Saved ID=${savedRow.id} | Stored=${savedRow.file_size}B | Original=${savedRow.original_size}B`);

    res.status(200).json({ 
      success: true, 
      message: 'Upload and database storage complete.',
      data: { 
        id: savedRow.id, 
        filePath: finalDocValue, 
        fileName: req.file.originalname,
        binaryId: finalBinaryId,
        file_size: savedRow.file_size,
        original_size: savedRow.original_size
      }
    });

  } catch (err) {
    console.error('❌ [SchoolDocStore] Database Error during upload:', {
        message: err.message,
        detail: err.detail,
        table: err.table,
        constraint: err.constraint,
        code: err.code,
        stack: err.stack
    });
    res.status(500).json({ error: 'Failed to record document metadata' });
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
    await pool.query('DELETE FROM school_ownership_docs WHERE id = $1', [id]);

    // 4. Sync with ph_schools (Single Truth Cleanup)
    // We clear both the legacy ownership_document_path and the new local_file_* columns
    await pool.query(`
      UPDATE ph_schools 
      SET local_file_path = NULL, 
          local_file_name = NULL, 
          local_file_size = NULL, 
          ownership_document_path = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE iern = $1 OR school_id = $1
    `, [iern]).catch(err => console.error("⚠️ ph_schools Sync Delete Error:", err.message));

    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (err) {
    console.error('Delete Error:', err);
    res.status(500).json({ error: 'Failed to delete document' });
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
        unit1, unit2, unit3, unit4, unit5, unit6, unit7, unit9, unit10,
        unit1_completed, unit2_completed, unit3_completed, unit4_completed,
        unit5_completed, unit6_completed, unit7_completed, unit9_completed, unit10_completed,
        unit_completion, region, division
       FROM ph_schools WHERE school_id = $1`,
      [schoolId]
    );
    if (schoolRes.rows.length === 0) return res.status(404).json({ error: "School not found" });

    const row = schoolRes.rows[0];
    const totalUnits = 9;
    let completedUnitsCount = 0;
    let completedFlags = {};

    // Maps DB column index to display unit ID (unit9=Terrain, unit10=Infrastructure)
    const unitMapping = [1, 2, 3, 4, 5, 6, 7, 9, 10]; // DB column -> new display ID
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
      `SELECT school_id, unit1, unit2, unit3, unit4, unit5, unit6, unit7, unit8, unit9, unit10,
              unit1_completed, unit2_completed, unit3_completed, unit4_completed,
              unit5_completed, unit6_completed, unit7_completed, unit8_completed, unit9_completed, unit10_completed
       FROM ph_schools WHERE iern = $1`,
      [iern]
    );
    if (res.rows.length === 0) return;

    const row = res.rows[0];
    const schoolId = row.school_id;
    // Mapping: Explicit 1-10 mapping to ph_school_completion columns.
    const dbCols = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
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

    const percentage = parseFloat(((completedCount / 10) * 100).toFixed(2));

    // Upsert booleans + total to ph_school_completion.
    await pool.query(
      `INSERT INTO ph_school_completion
         (iern, school_id, unit1_completion, unit2_completion, unit3_completion, unit4_completion,
          unit5_completion, unit6_completion, unit7_completion, unit8_completion, unit9_completion, unit10_completion, total_completion, updated_at)
       VALUES ($12, $13, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $1, CURRENT_TIMESTAMP)
       ON CONFLICT (school_id) DO UPDATE SET
         iern = EXCLUDED.iern, unit1_completion=$2, unit2_completion=$3, unit3_completion=$4, unit4_completion=$5,
         unit5_completion=$6, unit6_completion=$7, unit7_completion=$8, unit8_completion=$9,
         unit9_completion=$10, unit10_completion=$11, total_completion=$1, updated_at=CURRENT_TIMESTAMP`,
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
    .catch(err => console.error('âŒ Failed to connect to Secondary Database:', err.message));
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
      ADD COLUMN IF NOT EXISTS unit10_completed BOOLEAN DEFAULT FALSE,
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
    await unit4MigrateCols();

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
    for (let i = 1; i <= 10; i++) {
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
    await checkAndAddColumn('school_documents', 'binary_id', 'UUID', pool);
    await checkAndAddColumn('school_documents', 'file_path', 'TEXT', pool);
    await checkAndAddColumn('school_documents', 'file_size', 'BIGINT', pool);
    await checkAndAddColumn('school_documents', 'original_size', 'BIGINT', pool);
    await checkAndAddColumn('school_documents', 'hydra_manifest', 'JSONB', pool);
    if (poolNew) {
      await checkAndAddColumn('school_documents', 'binary_id', 'UUID', poolNew);
      await checkAndAddColumn('school_documents', 'file_path', 'TEXT', poolNew);
      await checkAndAddColumn('school_documents', 'file_size', 'BIGINT', poolNew);
      await checkAndAddColumn('school_documents', 'original_size', 'BIGINT', poolNew);
      await checkAndAddColumn('school_documents', 'hydra_manifest', 'JSONB', poolNew);
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

          );
        `);


      } catch (poolErr) {
        console.error(`❌ [initDB] ${dbLabel} Initialization Failed at [${currentSegment}]:`, poolErr.message);
        if (dbLabel === "Primary") throw poolErr; 
      }
    }


    currentSegment = "Segment 12: buildable_spaces and facility tables";
    await pool.query(`
      CREATE TABLE IF NOT EXISTS buildable_spaces (
        space_id SERIAL PRIMARY KEY,
        school_id TEXT,
        iern TEXT,
        space_number INTEGER,
        latitude NUMERIC,
        longitude NUMERIC,
        length NUMERIC,
        width NUMERIC,
        total_area NUMERIC,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

    await checkAndAddColumn('ph_teachers_list', 'designations', 'TEXT');

    console.log("✅ DB Init: All migrations completed successfully.");

  } catch (err) {
    console.error(`❌ DB Init Error in segment [${currentSegment}]:`, err.message);
  }
};

// initDB(); // Moved to awaited startup

// initMasterlistDB(); // Moved to awaited startup


// --- REFERENCE API ENDPOINTS ---







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
    console.log(`[AUTH DEBUG] Migrate-Login: ${identifier} (isSchoolId: ${isSchoolId}, isEmail: ${isEmail})`);

    // 1. Fetch user from PostgreSQL
    console.log(`[MIGRATE LOGIN] Running SQL query...`);
    const SELECT_COLS = `uid, email, role, region, division, office, account_category, passcode, password_hash, password_salt, hash_version, first_name, last_name, school_id, province, city`;

    console.log(`[DEBUG LOGIN] Reached handler for: ${identifier}`);
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

    let user;
    try {
      console.log(`[DEBUG LOGIN] Query prepared. Waiting for pool...`);
      const userRes = await pool.query(query, [isSchoolId ? identifier : identifier.toLowerCase()]);
      console.log(`[DEBUG LOGIN] Query completed! Rows found: ${userRes.rowCount}`);
      user = processUserRes(userRes);
    } catch (err) {
      console.error(`💥 [MIGRATE LOGIN] DB Error for ${identifier}:`, err.message);
      if (err.message.includes('terminated unexpectedly')) {
        console.warn(`♻️ [RECOVERY] Attempting immediate retry for terminated connection...`);
        try {
          const retryRes = await pool.query(query, [isSchoolId ? identifier : identifier.toLowerCase()]);
          user = processUserRes(retryRes);
        } catch (retryErr) {
          console.error(`💥 [RECOVERY FAILED]:`, retryErr.message);
          throw err;
        }
      } else {
        throw err;
      }
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

      // --- THE LAZY UPGRADE ---
      if (isValid) {
        console.log(`[LAZY MIGRATION] Upgrading hash for user: ${user.email}`);
        const saltRounds = 10;
        const newBcryptHash = await bcrypt.hash(password, saltRounds);

        await pool.query(
          `UPDATE users SET password_hash = $1, password_salt = NULL, hash_version = 'bcrypt' WHERE uid = $2`,
          [newBcryptHash, user.uid]
        );
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

      // Lazy update the DB if it changed or was null
      if (finalCategory !== user.account_category) {
        console.log(`[MIGRATE LOGIN] Normalizing category for ${identifier}: ${finalCategory}`);
        await pool.query('UPDATE users SET account_category = $1 WHERE uid = $2', [finalCategory, user.uid]);
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


app.post('/api/auth/setup-pin', async (req, res) => {
  const { uid, school_id, email, pin } = req.body;
  const identifier = uid || school_id || email;

  if (!identifier || !pin || pin.length !== 6) {
    return res.status(400).json({ success: false, error: "Valid 6-digit PIN and identifier are required." });
  }

  try {
    // Determine which column to match on
    let whereClause, param;
    if (uid) {
      whereClause = 'uid = $2';
      param = uid;
    } else if (school_id) {
      whereClause = 'school_id = $2';
      param = school_id.trim();
    } else {
      whereClause = 'LOWER(email) = $2';
      param = email.trim().toLowerCase();
    }

    // Hash PIN before storing
    const saltRounds = 10;
    const hashedPin = await bcrypt.hash(pin, saltRounds);

    const result = await pool.query(
      `UPDATE users SET passcode = $1 WHERE ${whereClause} AND (registration_status = 'Valid' OR registration_status IS NULL) RETURNING uid`,
      [hashedPin, param]
    );


    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: "User not found." });
    }

    return res.json({ success: true, message: "PIN set successfully." });
  } catch (err) {
    console.error("Setup PIN Error:", err);
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

    let userRes;
    try {
      userRes = await pool.query(query, [isSchoolId ? identifier : identifier.toLowerCase()]);
    } catch (err) {
      if (err.message.includes('terminated unexpectedly')) {
        console.warn(`♻️ [RECOVERY] Attempting immediate retry for Pin-Login for: ${identifier}`);
        userRes = await pool.query(query, [isSchoolId ? identifier : identifier.toLowerCase()]);
      } else {
        throw err;
      }
    }


    if (userRes.rowCount === 0) {
      return res.status(401).json({ success: false, error: "Username does not exist. Kindly register first." });
    }

    const user = userRes.rows[0];
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

        // 1. Initialise Job Queue (pg-boss)
        await boss.start();
        bossReady = true;
        console.log("✅ [PG-BOSS] Ready to handle async tasks.");

        // 2. Database Migrations (Clustered Resilience)
        // Only the first worker (Instance 0) handles DDL to avoid AccessExclusiveLock contention.
        const isPrimaryWorker = !process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === '0';
        
        if (isPrimaryWorker) {
            console.log("🏗️ [Primary] Running boot-time migrations...");
            const migClient = await pool.connect();
            try {
                await initOtpTable(migClient);
                await runMigrations(migClient, 'Primary');
                await initESF7Tables();
                console.log("✅ [Primary] Pre-flight migrations complete.");
            } finally {
                migClient.release();
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

