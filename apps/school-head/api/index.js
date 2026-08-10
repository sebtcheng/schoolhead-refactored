import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';

import { initOtpTable, runMigrations, initChatSchema } from '@shared/db/db_init';

// Import Database & Utilities
import { pool, poolChat } from '@shared/db';

// Import Helpers & Uploads
import { UPLOAD_BASE_PATH } from '@shared/io';

// Import Unit Modular Routers
import unit1Router from './units/unit1/index.js';
import unit2Router from './units/unit2/index.js';
import unit3Router from './units/unit3/index.js';
import unit4Router from './units/unit4/index.js';
import unit5Router from './units/unit5/index.js';
import unit6Router from './units/unit6/index.js';
import unit7Router from './units/unit7/index.js';
import unit8Router from './units/unit8/index.js';
import unit9Router from './units/unit9/index.js';
import authRouter from './units/auth/index.js';

// Import New Modular Routers
import pushRouter from './units/push/index.js';
import docsRouter from './units/docs/index.js';
import dashboardRouter from './units/dashboard/index.js';
import locationRouter from './units/location/index.js';
import settingsRouter from './units/settings/index.js';
import chatRouter from './units/chat/index.js'; // Chat Backend Unit
import siifRouter from '../../siif/api/index.js'; // SIIF Module Unit

// Chat cleanup function logic (purges messages older than 90 days with Nuclear-Lock compliance)
const autoCleanOldChats = async () => {
  const client = await poolChat.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL internal.authorized_app_deletion = 'true'");
    const res = await client.query("DELETE FROM chat_messages WHERE created_at < NOW() - INTERVAL '90 days'");
    await client.query('COMMIT');
    if (res.rowCount > 0) {
      console.log(`🧹 [CLEANUP SERVICE] Purged ${res.rowCount} chat messages older than 90 days.`);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ [CLEANUP SERVICE] autoCleanOldChats error:', err.message);
  } finally {
    client.release();
  }
};

console.log("📌 >>> RUNNING: [apps/school-head/api/index.js] <<< 📌");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

// --- Global Safety Handlers ---
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception thrown:', err);
});

const app = express();

// --- CRITICAL DEBUG PING (TOP PRIORITY) ---
app.get('/api/ping', (req, res) => res.json({ 
  status: 'pong', 
  version: 'v1.2.5-STAGING-OMEGA-TOP',
  mode: 'API (/api/ping)',
  path: req.path
}));
app.get('/ping', (req, res) => res.json({ status: 'pong-root' }));

// --- URL NORMALIZATION FOR VERCEL SUBPATH ---
app.use((req, res, next) => {
  if (req.url.startsWith('/insighted-schoolhead')) {
    req.url = req.url.replace('/insighted-schoolhead', '');
  }
  next();
});

// --- CORS & BODY PARSERS ---
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://insight-ed-mobile-pwa.vercel.app',
  'https://insight-ed-frontend.vercel.app',
  'https://insighted-portal.onrender.com',
  ...(process.env.CORS_ORIGIN_VM ? [process.env.CORS_ORIGIN_VM] : []),
];
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// --- GLOBAL SCHOOL YEAR LOCK GUARD ---
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const targetSchoolYr = req.body?.school_yr || req.query?.school_yr || req.headers['x-school-year'];
    if (targetSchoolYr === 'SY 25-26') {
      console.warn(`⚠️ [Lock-Guard] Blocked ${req.method} request targeting read-only SY 25-26: ${req.path}`);
      return res.status(403).json({
        success: false,
        error: 'LOCKED_SCHOOL_YEAR: Modifying historical data for SY 25-26 is prohibited.'
      });
    }
  }
  next();
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

// --- Event Loop Delay Monitoring & Load Shedding ---
let eventLoopDelay = 0;
setInterval(() => {
  const start = Date.now();
  setImmediate(() => {
    eventLoopDelay = Date.now() - start;
  });
}, 1000);

app.use((req, res, next) => {
  const heapUsage = process.memoryUsage().heapUsed;
  const HEAP_THRESHOLD = 950 * 1024 * 1024;
  const DELAY_THRESHOLD = 400;

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

// Serve static uploads
app.use('/uploads', express.static(UPLOAD_BASE_PATH));

// SMART FALLBACK PROXY: Staging Asset Proxy during dev
import https from 'https';
import http from 'http';
if (process.env.NODE_ENV !== 'production' || !process.env.NODE_ENV) {
    app.use('/uploads', (req, res) => {
        const stagingRoot = 'https://20.24.58.49/uploads'; 
        const altPaths = [
            `${stagingRoot}${req.url}`,
            `${stagingRoot}/${path.basename(req.url)}`,
            `https://20.24.58.49${req.url}`,
            `https://20.24.58.49/${path.basename(req.url)}`
        ];
        
        const options = { rejectUnauthorized: false };

        const tryPath = (index) => {
            if (index >= altPaths.length) {
                console.warn(`[Asset-Proxy] Exhausted all fallback paths for: ${req.url}`);
                return res.status(404).json({ error: 'Asset not found on any staging path' });
            }

            const targetUrl = altPaths[index];
            https.get(targetUrl, options, (proxyRes) => {
                if (proxyRes.statusCode === 200) {
                    res.setHeader('Content-Type', proxyRes.headers['content-type']);
                    proxyRes.pipe(res);
                } else if (proxyRes.statusCode === 301 || proxyRes.statusCode === 302) {
                    https.get(proxyRes.headers.location, options, (redirRes) => {
                        if (redirRes.statusCode === 200) {
                            res.setHeader('Content-Type', redirRes.headers['content-type']);
                            redirRes.pipe(res);
                        } else {
                            tryPath(index + 1);
                        }
                    });
                } else {
                    tryPath(index + 1);
                }
            }).on('error', (err) => {
                tryPath(index + 1);
            });
        };

        tryPath(0);
    });
}

// REGISTER UNIT MODULAR ROUTERS
app.use(unit1Router);
app.use(unit2Router);
app.use(unit3Router);
app.use(unit4Router);
app.use(unit5Router);
app.use(unit6Router);
app.use(unit7Router);
app.use(unit8Router);
app.use(unit9Router);
app.use(authRouter);

// Register New Modular Routers
app.use(pushRouter);
app.use(docsRouter);
app.use(dashboardRouter);
app.use(locationRouter);
app.use(settingsRouter);
app.use(chatRouter);
app.use('/api/siif', siifRouter);

// --- COMPREHENSIVE SERVER STARTUP ---
const startServer = async () => {
    try {
        console.log("🚀 Initializing InsightEd Master Services...");

        const isVercel = process.env.VERCEL === '1';
        const isPrimaryWorker = !process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === '0';
        
        if (isPrimaryWorker && !isVercel) {
            console.log("🏗️ [Primary] Running boot-time migrations...");
            try {
                const migClient = await pool.connect();
                try {
                    await initOtpTable(migClient);
                    await runMigrations(migClient, 'Primary');
                    console.log("✅ [Primary] Pre-flight migrations complete.");
                } finally {
                    migClient.release();
                }

                try {
                    const chatClient = await poolChat.connect();
                    try {
                        await initChatSchema(chatClient, 'Chat-DB');
                    } finally {
                        chatClient.release();
                    }
                } catch (chatMigErr) {
                    console.warn(`⚠️ [Primary] Chat schema boot initialization warning: ${chatMigErr.message}`);
                }
            } catch (migErr) {
                console.warn(`⚠️ [Primary] Boot-time migration skipped (pool pressure): ${migErr.message}. Will retry on next restart.`);
            }
        } else if (isVercel) {
            console.log("⚡ Running as Vercel Serverless Function (migrations skipped).");
        } else {
            console.log(`📡 [Worker ${process.env.NODE_APP_INSTANCE || 'DEV'}] Migrations skipped (handled by Primary).`);
        }

        if (!isVercel) {
            const PORT = process.env.SCHOOL_HEAD_PORT || process.env.PORT || 3000;
            const HOST = process.env.HOST || '127.0.0.1';
            app.listen(PORT, HOST, () => {
                console.log(`✨ InsightEd Master Server active on http://${HOST}:${PORT}`);
                
                // Run cleanup on startup (delay 10s to let server stabilize)
                setTimeout(() => {
                    autoCleanOldChats().catch(err => console.error('[CLEANUP SERVICE] Startup cleaner run failed:', err));
                }, 10000);
                
                // Run cleanup every 24 hours
                setInterval(() => {
                    autoCleanOldChats().catch(err => console.error('[CLEANUP SERVICE] Scheduled cleaner run failed:', err));
                }, 24 * 60 * 60 * 1000);

                if (process.send) {
                    process.send('ready');
                }
            });
        }

    } catch (error) {
        console.error("❌ CRITICAL: Master startup sequence failed!");
        console.error(error);
        if (process.env.VERCEL !== '1') {
            process.exit(1);
        }
    }
};

startServer();

export default app;
