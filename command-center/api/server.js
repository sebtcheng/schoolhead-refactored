import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pg from 'pg';
import winston from 'winston';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// --- CONFIGURATION ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const PORT = process.env.CC_SCRIPT_PORT || 3006;
const DB_URL = process.env.DATABASE_URL;

// --- LOGGING ---
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `[COMMAND-CENTER] ${timestamp} ${level.toUpperCase()}: ${message}`)
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'cc-scripts.log' }),
  ],
});

// --- DATABASE ---
const pool = new pg.Pool({
  connectionString: DB_URL,
  ssl: DB_URL.includes('localhost') ? false : { rejectUnauthorized: false },
});

// --- APP SETUP ---
const app = express();
app.use(cors());
app.use(express.json());

// --- SCRIPT DIRECTORIES ---
const SCRIPT_PATHS = {
  'new_fave': path.resolve(__dirname, '../../fave_scripts/new_fave'),
  'crisis': path.resolve(__dirname, '../../fave_scripts/db-nginx-fixes')
};

// --- AUTH (Simplified for demo, but checks table) ---
app.post('/api/login', async (req, res) => {
  const { uid } = req.body;
  try {
    const userRes = await pool.query('SELECT * FROM command_center_user WHERE uid = $1', [uid]);
    if (userRes.rows.length > 0) {
      res.json({ success: true, user: userRes.rows[0] });
    } else {
      res.status(401).json({ error: 'Unauthorized executive access' });
    }
  } catch (err) {
    logger.error('Login error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// --- LIST SCRIPTS ---
app.get('/api/scripts', (req, res) => {
  const newFave = fs.readdirSync(SCRIPT_PATHS.new_fave).filter(f => f.endsWith('.py'));
  const crisis = fs.readdirSync(SCRIPT_PATHS.crisis).filter(f => f.endsWith('.py'));
  
  res.json({
    new_fave: newFave,
    crisis: crisis
  });
});

// --- EXECUTE & STREAM (SSE) ---
app.get('/api/run-script', (req, res) => {
  const { name, category } = req.query;
  const scriptDir = SCRIPT_PATHS[category];
  
  if (!scriptDir || !name) {
    return res.status(400).send('Invalid script parameters');
  }

  const scriptPath = path.join(scriptDir, name);
  if (!fs.existsSync(scriptPath)) {
    return res.status(404).send('Script not found');
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  logger.info(`🚀 Starting script: ${name} [${category}]`);

  const pythonProcess = spawn('python', [scriptPath]);

  pythonProcess.stdout.on('data', (data) => {
    res.write(`data: ${data.toString()}\n\n`);
  });

  pythonProcess.stderr.on('data', (data) => {
    res.write(`data: [ERROR] ${data.toString()}\n\n`);
  });

  pythonProcess.on('close', (code) => {
    res.write(`data: [FINISH] Process exited with code ${code}\n\n`);
    res.end();
  });
});

app.listen(PORT, () => {
  logger.info(`🚀 Command Center Scripts listening on port ${PORT}`);
});
