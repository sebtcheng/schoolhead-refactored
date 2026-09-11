import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Centralized Dotenv Loading: Load root .env file
const rootDir = path.join(__dirname, '..', '..', '..');
dotenv.config({ path: path.join(rootDir, '.env') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

const { Pool } = pg;

// --- DATABASE CONNECTION ---
let dbUrl = process.env.CLOUD_DATABASE_URL || process.env.DATABASE_URL || 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insighted-staging';

// Auto-redirect local development connections from production (insightEd) to staging (insighted-staging)
const isLocalMachine = process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'staging';
if (isLocalMachine) {
  try {
    const urlObj = new URL(dbUrl);
    if (urlObj.pathname.toLowerCase() === '/insighted') {
      console.log('🛡️ [DB] Local environment detected. Redirecting connection from production "insightEd" to "insighted-staging" for safety.');
      urlObj.pathname = '/insighted-staging';
      dbUrl = urlObj.toString();
    }
  } catch (e) {
    if (dbUrl.toLowerCase().includes('/insighted')) {
      console.log('🛡️ [DB] Local environment detected. Redirecting connection from production "insightEd" to "insighted-staging" for safety.');
      dbUrl = dbUrl.replace(/\/insighted/i, '/insighted-staging');
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

// --- CENTRAL USERS DATABASE CONNECTION (users_database) ---
const usersDbUrl = process.env.USERS_DATABASE_URL || 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/users_database';
export const poolUsers = new Pool({
  connectionString: usersDbUrl,
  ssl: { rejectUnauthorized: false },
  max: isLocal ? 15 : 10,
  min: 1,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 10000,
  maxUses: 1500,
  keepAlive: true,
  allowExitOnIdle: true,
  application_name: isLocal ? 'InsightEd_Users_Local' : 'InsightEd_Users_Cluster'
});

poolUsers.on('error', (err) => {
  console.error('💥 [USERS-DB-POOL] Unexpected error on idle users database client:', err.message);
});

/**
 * [USERS-DB-RETRY] Execute a safe query on users_database with one-shot retry.
 */
export async function safeUsersQuery(text, params) {
  try {
    return await poolUsers.query(text, params);
  } catch (err) {
    if (err.message && err.message.includes('terminated unexpectedly')) {
      console.warn(`♻️ [USERS-DB-RETRY] "terminated unexpectedly", retrying (${text.slice(0, 70).replace(/\n/g, '◻')})…`);
      return await poolUsers.query(text, params);
    }
    throw err;
  }
}

// --- CENTRAL SIIF DATABASE CONNECTION (siif_database) ---
const siifDbUrl = process.env.SIIF_DATABASE_URL || 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/siif_database';
export const poolSiif = new Pool({
  connectionString: siifDbUrl,
  ssl: { rejectUnauthorized: false },
  max: isLocal ? 15 : 10,
  min: 1,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 10000,
  maxUses: 1500,
  keepAlive: true,
  allowExitOnIdle: true,
  application_name: isLocal ? 'InsightEd_SIIF_Local' : 'InsightEd_SIIF_Cluster'
});

poolSiif.on('error', (err) => {
  console.error('💥 [SIIF-DB-POOL] Unexpected error on idle siif database client:', err.message);
});

/**
 * [SIIF-DB-RETRY] Execute a safe query on siif_database with one-shot retry.
 */
export async function safeSiifQuery(text, params) {
  try {
    return await poolSiif.query(text, params);
  } catch (err) {
    if (err.message && err.message.includes('terminated unexpectedly')) {
      console.warn(`♻️ [SIIF-DB-RETRY] "terminated unexpectedly", retrying (${text.slice(0, 70).replace(/\n/g, '◻')})…`);
      return await poolSiif.query(text, params);
    }
    throw err;
  }
}

// --- CENTRAL CHAT DATABASE CONNECTION (chat_database) ---
const chatDbUrl = process.env.CHAT_DATABASE_URL || 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/chat_database';
export const poolChat = new Pool({
  connectionString: chatDbUrl,
  ssl: { rejectUnauthorized: false },
  max: isLocal ? 15 : 10,
  min: 1,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 10000,
  maxUses: 1500,
  keepAlive: true,
  allowExitOnIdle: true,
  application_name: isLocal ? 'InsightEd_Chat_Local' : 'InsightEd_Chat_Cluster'
});

export const chatDbPool = poolChat;

poolChat.on('error', (err) => {
  console.error('💥 [CHAT-DB-POOL] Unexpected error on idle chat database client:', err.message);
});

/**
 * [CHAT-DB-RETRY] Execute a safe query on chat_database with one-shot retry.
 */
export async function safeChatQuery(text, params) {
  try {
    return await poolChat.query(text, params);
  } catch (err) {
    if (err.message && err.message.includes('terminated unexpectedly')) {
      console.warn(`♻️ [CHAT-DB-RETRY] "terminated unexpectedly", retrying (${text.slice(0, 70).replace(/\n/g, '◻')})…`);
      return await poolChat.query(text, params);
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

export function cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  const ttl = entry.ttlMs || CACHE_TTL_MS;
  if (Date.now() - entry.ts > ttl) { _cache.delete(key); return null; }
  return entry.data;
}

export function cacheSet(key, data, ttlMs = CACHE_TTL_MS) {
  _cache.set(key, { data, ts: Date.now(), ttlMs });
}

export function cacheDel(key) {
  _cache.delete(key);
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
    const schoolRes = await safeQuery('SELECT school_id FROM ph_schools WHERE iern = $1 OR school_id = $1 LIMIT 1', [iern]);
    const schoolId = schoolRes.rows[0]?.school_id || iern;

    const res = await safeQuery(
      `SELECT unit_number, is_completed
       FROM ph_school_unit_submissions WHERE iern = $1 OR iern = $2`,
      [iern, schoolId]
    );

    const compMap = {};
    res.rows.forEach(r => {
      compMap[r.unit_number] = r.is_completed === true;
    });

    let completedCount = 0;
    const boolValues = [];
    for (let u = 1; u <= 9; u++) {
      const isDone = compMap[u] === true;
      if (isDone) completedCount++;
      boolValues.push(isDone);
    }

    const percentage = parseFloat(((completedCount / 9) * 100).toFixed(2));

    await safeQuery(
      `INSERT INTO ph_school_completion
         (iern, school_id, unit1_completion, unit2_completion, unit3_completion, unit4_completion,
          unit5_completion, unit6_completion, unit7_completion, unit8_completion, unit9_completion, total_completion, updated_at)
       VALUES ($11, $12, $2, $3, $4, $5, $6, $7, $8, $9, $10, $1, CURRENT_TIMESTAMP)
       ON CONFLICT (iern) DO UPDATE SET
         school_id = EXCLUDED.school_id, unit1_completion=$2, unit2_completion=$3, unit3_completion=$4, unit4_completion=$5,
         unit5_completion=$6, unit6_completion=$7, unit7_completion=$8, unit8_completion=$9,
         unit9_completion=$10, total_completion=$1, updated_at=CURRENT_TIMESTAMP`,
      [percentage, ...boolValues, iern, schoolId]
    ).catch(() => {});

    await safeQuery(
      'UPDATE ph_schools SET unit_completion=$1 WHERE iern=$2 OR school_id=$2',
      [percentage, iern]
    ).catch(() => {});

    console.log(`[SYNC] Updated completion for ${iern}: ${percentage}% (${completedCount}/9)`);
  } catch (err) {
    console.error(`[ERROR] updateSchoolTotalCompletion failed for ${iern}:`, err.message);
  }
}
