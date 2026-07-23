import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') });

const { Pool } = pg;

// --- DATABASE CONNECTION ---
let dbUrl = process.env.DATABASE_URL || 'postgres://Administrator1:pRZTbQ2T1JD7@127.0.0.1:6432/insightEd';

// Auto-redirect local development connections from production (insightEd) to staging (insighted-staging)
const isLocalMachine = process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'staging';
if (isLocalMachine) {
  try {
    const urlObj = new URL(dbUrl);
    if (urlObj.pathname === '/insightEd') {
      console.log('🛡️ [DB] Local environment detected. Redirecting connection from production "insightEd" to "insighted-staging" for safety.');
      urlObj.pathname = '/insighted-staging';
      dbUrl = urlObj.toString();
    }
  } catch (e) {
    if (dbUrl.includes('/insightEd')) {
      console.log('🛡️ [DB] Local environment detected. Redirecting connection from production "insightEd" to "insighted-staging" for safety.');
      dbUrl = dbUrl.replace('/insightEd', '/insighted-staging');
    }
  }
}

const isLoopback = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
const isVmProxy = dbUrl.includes('20.24.58.49') || dbUrl.includes('stride.deped.gov.ph') || dbUrl.includes(':6432') || dbUrl.includes('127.0.0.1');
const isLocal = isLoopback && process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'staging';

console.log(`🔌 Database Connection: ${isVmProxy ? 'Remote VM (Azure Proxy)' : (isLoopback ? 'Local Loopback' : 'Remote')} (${dbUrl.replace(/:[^:@]*@/, ':****@')}) [ENV: ${process.env.NODE_ENV || 'dev'}]`);

// Main pool configuration
export const pool = new Pool({
  connectionString: dbUrl,
  ssl: (isLoopback || isVmProxy) ? false : { rejectUnauthorized: false },
  max: isLocal ? 20 : 12,
  min: isLocal ? 1 : 5,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 10000,
  maxUses: 1500,
  keepAlive: true,
  allowExitOnIdle: true,
  application_name: isLocal ? 'InsightEd_Local_Dev' : 'InsightEd_API_Cluster'
});

pool.on('connect', (client) => {
  // console.log('✅ [DB-POOL] New connection established');
});

pool.on('error', (err) => {
  console.error('💥 [DB-POOL] Unexpected error on idle database client:', err.message);
});

// Secondary pool configuration (Dual-Write)
export let poolNew = null;
if (process.env.NEW_DATABASE_URL) {
  console.log('🔌 Initializing Secondary Database Connection...');
  poolNew = new Pool({
    connectionString: process.env.NEW_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 2,
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
      console.log('🔌 Connected to Secondary Database (ICTS) successfully!');
      client.release();
    }).catch(err => console.error("Secondary database connection failed:", err.message));
}

/**
 * [DB-RETRY] Execute a pool query with a one-shot retry on "terminated unexpectedly".
 */
export async function safeQuery(text, params) {
  try {
    return await pool.query(text, params);
  } catch (err) {
    if (err.message && err.message.includes('terminated unexpectedly')) {
      console.warn(`♻️ [DB-RETRY] "terminated unexpectedly", retrying (${text.slice(0, 70).replace(/\n/g, '◻')})…`);
      return await pool.query(text, params);
    }
    throw err;
  }
}

// Proactive Pool Telemetry
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

// --- [Hawkeye Protocol] IN-MEMORY TTL CACHE ---
const _cache = new Map();
const _inflight = new Map();
const CACHE_TTL_MS = 90_000;

function cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { _cache.delete(key); return null; }
  return entry.data;
}

function cacheSet(key, data) {
  _cache.set(key, { data, ts: Date.now() });
}

export async function cachedQuery(key, fn) {
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

// Sync completion percentage
export async function updateSchoolTotalCompletion(iern, schoolYr = 'SY 26-27') {
  if (!iern) return;
  try {
    const res = await safeQuery(
      `SELECT ps.school_id,
              COALESCE(u1.unit1_completed, FALSE) AS unit1_completed,
              CASE WHEN u1.unit1_completed = TRUE THEN 1.00 ELSE COALESCE(u1.unit1, 0)::numeric / 100.00 END AS unit1,
              COALESCE(u2.unit2_completed = 100.00, FALSE) AS unit2_completed,
              CASE WHEN COALESCE(u2.unit2_completed = 100.00, FALSE) = TRUE THEN 1.00 ELSE 0.00 END AS unit2,
              COALESCE(u3.unit3_completed = 100.00, FALSE) AS unit3_completed,
              CASE WHEN COALESCE(u3.unit3_completed = 100.00, FALSE) = TRUE THEN 1.00 ELSE 0.00 END AS unit3,
              COALESCE(u4.unit4_completed = 100.00, FALSE) AS unit4_completed,
              CASE WHEN COALESCE(u4.unit4_completed = 100.00, FALSE) = TRUE THEN 1.00 ELSE 0.00 END AS unit4,
              COALESCE(u5.unit5_completed, FALSE) AS unit5_completed,
              CASE WHEN COALESCE(u5.unit5_completed, FALSE) = TRUE THEN 1.00 ELSE COALESCE(u5.unit5, 0)::numeric / 100.00 END AS unit5,
              COALESCE(u6.unit6_completed, FALSE) AS unit6_completed,
              CASE WHEN COALESCE(u6.unit6_completed, FALSE) = TRUE THEN 1.00 ELSE 0.00 END AS unit6,
              COALESCE(u7.unit7_completed, FALSE) AS unit7_completed,
              CASE WHEN COALESCE(u7.unit7_completed, FALSE) = TRUE THEN 1.00 ELSE COALESCE(u7.unit7, 0)::numeric / 100.00 END AS unit7,
              COALESCE(u8.unit8_completed, FALSE) AS unit8_completed,
              CASE WHEN COALESCE(u8.unit8_completed, FALSE) = TRUE THEN 1.00 ELSE COALESCE(u8.unit8, 0)::numeric / 100.00 END AS unit8,
              COALESCE(u9.unit9_completed, FALSE) AS unit9_completed,
              CASE WHEN COALESCE(u9.unit9_completed, FALSE) = TRUE THEN 1.00 ELSE COALESCE(u9.unit9, 0)::numeric / 100.00 END AS unit9
       FROM ph_schools ps
       LEFT JOIN unit1_school_identity u1 ON ps.iern = u1.iern AND u1.school_yr = $2
       LEFT JOIN unit2_school_learners u2 ON ps.iern = u2.iern AND u2.school_yr = $2
       LEFT JOIN unit3_organized_classes u3 ON ps.iern = u3.iern AND u3.school_yr = $2
       LEFT JOIN unit4_learner_profile u4 ON ps.iern = u4.iern AND u4.school_yr = $2
       LEFT JOIN unit5_shifting_modality u5 ON ps.iern = u5.iern AND u5.school_yr = $2
       LEFT JOIN unit6_school_resources u6 ON ps.school_id = u6.school_id AND u6.school_yr = $2
       LEFT JOIN unit7_facilities u7 ON ps.school_id = u7.school_id AND u7.school_yr = $2
       LEFT JOIN unit8_location u8 ON ps.school_id = u8.school_id AND u8.school_yr = $2
       LEFT JOIN unit9_safety u9 ON ps.school_id = u9.school_id AND u9.school_yr = $2
       WHERE ps.iern = $1`,
      [iern, schoolYr]
    );
    if (res.rows.length === 0) return;

    const row = res.rows[0];
    const schoolId = row.school_id;
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
        unitProgress = val;
      }

      completedCount += unitProgress;
      boolValues.push(isDone);
    }

    const percentage = parseFloat(((completedCount / 9) * 100).toFixed(2));

    await safeQuery(
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

    await safeQuery(
      'UPDATE ph_schools SET unit_completion=$1 WHERE iern=$2',
      [percentage, iern]
    );

    console.log(`[SYNC] Updated completion for ${iern}: ${percentage}% (${completedCount}/9)`);
  } catch (err) {
    console.error(`[ERROR] updateSchoolTotalCompletion failed for ${iern}:`, err.message);
  }
}
