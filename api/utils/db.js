import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

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
const isVmProxy = dbUrl.includes('20.24.58.49') || dbUrl.includes('127.0.0.1');
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
export async function updateSchoolTotalCompletion(iern) {
  if (!iern) return;
  try {
    const res = await safeQuery(
      `SELECT school_id, unit1, unit2, unit3, unit4, unit5, unit6, unit7, unit8, unit9,
              unit1_completed, unit2_completed, unit3_completed, unit4_completed,
              unit5_completed, unit6_completed, unit7_completed, unit8_completed, unit9_completed
       FROM ph_schools WHERE iern = $1`,
      [iern]
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
