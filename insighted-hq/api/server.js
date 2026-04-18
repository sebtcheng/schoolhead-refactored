import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pg from 'pg';
import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

// --- CONFIGURATION ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const PORT = process.env.CC_PORT || 3005;
const DB_URL = process.env.DATABASE_URL;

// --- LOGGING (Senior SDE Standard) ---
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `[CC-BACKEND] ${timestamp} ${level.toUpperCase()}: ${message}`)
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'cc-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'cc-combined.log' }),
  ],
});

// --- DATABASE POOL (Port 6432 Enforcement) ---
const isLocal = DB_URL.includes('localhost') || DB_URL.includes('127.0.0.1');
const pool = new pg.Pool({
  connectionString: DB_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 20, // Dedicated pool for CC
  idleTimeoutMillis: 30000,
  application_name: 'InsightEd_CommandCenter_API'
});

pool.on('error', (err) => logger.error('💥 [DB-POOL] Unexpected error:', err.message));

// --- CACHING (Single-Flight Pattern) ---
const _cache = new Map();
const _inflight = new Map();
const CACHE_TTL = 90000; // 90 seconds

async function cachedQuery(key, queryFn) {
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data;
  
  if (_inflight.has(key)) return _inflight.get(key);
  
  const promise = queryFn().then(data => {
    _cache.set(key, { data, ts: Date.now() });
    _inflight.delete(key);
    return data;
  }).catch(err => {
    _inflight.delete(key);
    throw err;
  });
  
  _inflight.set(key, promise);
  return promise;
}

// --- APP SETUP ---
const app = express();
app.use(cors());
app.use(express.json());

// --- ROUTES ---

// Health Check
app.get('/health', (req, res) => res.json({ status: 'online', timestamp: new Date().toISOString() }));

// Full Spectrum Overview
app.get('/api/overview', async (req, res) => {
  try {
    const data = await cachedQuery('cc_overview', async () => {
      const client = await pool.connect();
      try {
        // 1. Engineering Stats
        const engRes = await client.query(`
          SELECT 
            COUNT(*) as total_projects,
            SUM(contract_amount) as total_budget,
            AVG(accomplishment_actual) as avg_accomplishment
          FROM engineer_form
        `);
        
        // 2. School Stats
        const schoolRes = await client.query(`
          SELECT 
            COUNT(*) as total_schools,
            AVG(total_completion_rate) as avg_completion
          FROM ph_school_completion
        `);

        return {
          engineering: engRes.rows[0],
          schools: schoolRes.rows[0]
        };
      } finally {
        client.release();
      }
    });
    res.json(data);
  } catch (err) {
    logger.error('Failed to fetch overview:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Regional Trends
app.get('/api/regional-trends', async (req, res) => {
  try {
    const data = await cachedQuery('cc_regional_trends', async () => {
      const client = await pool.connect();
      try {
        const res = await client.query(`
          SELECT 
            region,
            COUNT(*) as project_count,
            AVG(accomplishment_actual) as avg_accomplishment,
            SUM(contract_amount) as total_budget
          FROM engineer_form
          GROUP BY region
          ORDER BY avg_accomplishment DESC
        `);
        return res.rows;
      } finally {
        client.release();
      }
    });
    res.json(data);
  } catch (err) {
    logger.error('Failed to fetch regional trends:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// START SERVER
app.listen(PORT, () => {
  logger.info(`🚀 Command Center API listening on port ${PORT}`);
  logger.info(`🔌 Connected to DB: ${DB_URL.replace(/:[^:@]*@/, ':****@')}`);
});
