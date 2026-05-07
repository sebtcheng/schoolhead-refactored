import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the PROJECT root (shared config)
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const { Pool } = pg;
const app = express();
const PORT = process.env.SIIF_PORT || 3001;

console.log('[SIIF] >>> Starting SIIF Microservice <<<');

// 🔬 MASTER TINKERER: Backend Diagnostic Instrumentation
app.use((req, res, next) => {
    const start = Date.now();
    console.log(`🌐 [SIIF-API REQ] ${req.method} ${req.url}`);
    
    // Log response on finish
    res.on('finish', () => {
        const duration = Date.now() - start;
        const statusEmoji = res.statusCode >= 400 ? '⚠️' : '✅';
        console.log(`${statusEmoji} [SIIF-API RES] ${req.method} ${req.url} | Status: ${res.statusCode} | Time: ${duration}ms`);
    });
    next();
});

// ─── Database Pool ────────────────────────────────────────────────────────────
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false, // Server does not support SSL
    max: 5, // Small dedicated pool — SIIF only
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

pool.on('connect', () => console.log('✅ [SIIF-DB] Pool connection established'));
pool.on('error', (err) => console.error('🔥 [SIIF-DB] Unexpected pool error:', err));

// Test connection on startup
(async () => {
    try {
        const res = await pool.query('SELECT NOW()');
        console.log('🚀 [SIIF-DB] Database connection verified at:', res.rows[0].now);
    } catch (err) {
        console.error('❌ [SIIF-DB] Startup connection failed!', err.message);
    }
})();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
    origin: [
        'http://localhost:5174',          // local SIIF UI
        'http://localhost:5173',          // local Main InsightEd
        'https://stride.deped.gov.ph',   // production
    ],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// ─── Auth Middleware ──────────────────────────────────────────────────────────
const authenticate = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'No token provided' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('🔑 [SIIF-AUTH] Decoded Token:', decoded);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/siif/health', (req, res) => {
    res.json({ status: 'SIIF Service OK', port: PORT, ts: new Date().toISOString() });
});

// ─── Settings Endpoints ───────────────────────────────────────────────────────

// GET /api/siif/settings/deadline - Publicly accessible for UI timers
app.get('/api/siif/settings/deadline', async (req, res) => {
    try {
        const result = await pool.query("SELECT value FROM settings WHERE key = 'siif_deadline'");
        const deadline = result.rows[0]?.value;
        console.log(`⏰ [SIIF-API] Deadline request: ${deadline || 'NOT SET'}`);
        res.json({ deadline });
    } catch (err) {
        console.error('❌ [SIIF-API] Error fetching deadline:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/siif/settings/deadline - Admin only (via HQ repo)
app.put('/api/siif/settings/deadline', authenticate, async (req, res) => {
    const { deadline } = req.body;
    
    // 🛡️ [EXTREME VERBOSE] Log the attempt
    console.log(`\n🛡️ [SIIF-SETTINGS] DEADLINE UPDATE ATTEMPT`);
    console.log(`👤 User: ${req.user?.email} | Role: ${req.user?.role}`);
    console.log(`📅 Proposed Value: ${deadline}`);

    if (!deadline) {
        return res.status(400).json({ error: 'Deadline is required' });
    }

    try {
        // Validate date format
        const dateObj = new Date(deadline);
        if (isNaN(dateObj.getTime())) {
            return res.status(400).json({ error: 'Invalid date format. Use ISO 8601.' });
        }

        await pool.query(
            "INSERT INTO settings (key, value) VALUES ('siif_deadline', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
            [deadline]
        );
        console.log(`✅ [SIIF-SETTINGS] Global Deadline successfully updated to: ${deadline}`);
        res.json({ success: true, deadline });
    } catch (err) {
        console.error('🔥 [SIIF-SETTINGS] Critical failure during deadline update:', err);
        res.status(500).json({ error: 'Failed to update settings', details: err.message });
    }
});

// ─── GET /api/siif/allocation/:schoolId ───────────────────────────────────────
app.get('/api/siif/allocation/:schoolId', authenticate, async (req, res) => {
    const { schoolId } = req.params;
    const fiscalYear = req.query.year || new Date().getFullYear();
    let finalSchoolId = schoolId;

    // 🔍 [SURGICAL LOOKUP] Recover schoolId if it's invalid (undefined, GUID, etc.)
    if (!finalSchoolId || finalSchoolId === 'undefined' || finalSchoolId.length > 10) {
        console.log(`🔎 [SIIF-API] Invalid schoolId in allocation req: ${finalSchoolId}. Recovering...`);
        finalSchoolId = req.user?.school_id || req.user?.schoolId || req.user?.uid || req.user?.id || req.user?.sub;
        
        if ((!finalSchoolId || finalSchoolId.length > 10) && req.user?.email) {
            try {
                const userLookup = await pool.query(
                    'SELECT school_id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
                    [req.user.email]
                );
                if (userLookup.rows[0]?.school_id) {
                    finalSchoolId = userLookup.rows[0].school_id;
                    console.log(`✅ [SIIF-API] Recovered schoolId for allocation: ${finalSchoolId}`);
                }
            } catch (err) {
                console.error('[SIIF-API] Allocation recovery failed:', err);
            }
        }
    }

    try {
        const result = await pool.query(
            'SELECT * FROM siif_allocations WHERE school_id = $1 AND fiscal_year = $2',
            [finalSchoolId, fiscalYear]
        );
        if (result.rows.length === 0) {
            return res.json({
                school_id: finalSchoolId,
                fiscal_year: fiscalYear,
                allocation_amount: '0.00',
                spent_amount: '0.00',
                remaining_balance: '0.00'
            });
        }
        const row = result.rows[0];
        return res.json({
            ...row,
            remaining_balance: (parseFloat(row.allocation_amount) - parseFloat(row.spent_amount)).toFixed(2)
        });
    } catch (err) {
        console.error('[SIIF-API] Error fetching allocation:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─── GET /api/siif/expenses/:schoolId ────────────────────────────────────────
app.get('/api/siif/expenses/:schoolId', authenticate, async (req, res) => {
    const { schoolId } = req.params;
    try {
        const result = await pool.query(
            'SELECT * FROM siif_expenses WHERE school_id = $1 ORDER BY expense_date DESC',
            [schoolId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('[SIIF-API] Error fetching expenses:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─── GET /api/siif/submission/:schoolId ──────────────────────────────────────
app.get('/api/siif/submission/:schoolId', authenticate, async (req, res) => {
    const { schoolId } = req.params;
    const fiscalYear = new Date().getFullYear();
    let finalSchoolId = schoolId;

    // 🔍 [SURGICAL LOOKUP] If schoolId is 'undefined', a GUID, or null, try to recover it
    if (!finalSchoolId || finalSchoolId === 'undefined' || finalSchoolId.length > 10) {
        console.log(`🔎 [SIIF-API] Invalid schoolId detected: ${finalSchoolId}. Attempting recovery...`);
        finalSchoolId = req.user?.school_id || req.user?.schoolId || req.user?.uid || req.user?.id || req.user?.sub;
        
        // If still GUID-like, try to find in users table by email
        if ((!finalSchoolId || finalSchoolId.length > 10) && req.user?.email) {
            try {
                const userLookup = await pool.query(
                    'SELECT school_id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
                    [req.user.email]
                );
                if (userLookup.rows[0]?.school_id) {
                    finalSchoolId = userLookup.rows[0].school_id;
                    console.log(`✅ [SIIF-API] Recovered schoolId from database: ${finalSchoolId}`);
                }
            } catch (err) {
                console.error('[SIIF-API] Database lookup failed during recovery:', err);
            }
        }
    }

    console.log(`\n🔎 [SIIF-API] FETCHING SUBMISSION for Resolved School: ${finalSchoolId} | Year: ${fiscalYear}`);
    try {
        const subResult = await pool.query(
            `SELECT * FROM siif_submissions
             WHERE school_id = $1 AND fiscal_year = $2
             ORDER BY created_at DESC LIMIT 1`,
            [finalSchoolId, fiscalYear]
        );
        
        if (subResult.rows.length === 0) {
            console.log(`⚠️ [SIIF-API] No submission found for School: ${schoolId}`);
            return res.json(null);
        }
        
        const submission = subResult.rows[0];
        console.log(`✅ [SIIF-API] Found submission: ${submission.siif_sub_id} | Status: ${submission.submitted_at ? 'submitted' : 'draft'}`);
        
        // Fetch interventions
        const intResult = await pool.query(
            `SELECT * FROM siif_interventions WHERE siif_sub_id = $1`,
            [submission.siif_sub_id]
        );
        
        const interventions = [];
        const budgetEstimates = {};
        const interventionData = {};
        const utilization = {}; // New: { [intId]: { [quarter]: amount } }
        let aral = { planned: null, subjects: [] };
        
        for (const int of intResult.rows) {
            const intId = int.intervention_type;
            const dbIntId = int.siif_int_id; // Database ID for utilization link
            interventions.push(intId);
            budgetEstimates[intId] = int.budget_estimate;
            
            if (intId === 'remediation') {
                aral.planned = int.has_aral;
                aral.subjects = int.aral_subjects || [];
            }
            
            interventionData[intId] = {
                selectedGrades: [],
                beneficiaryCounts: {},
                selectedActivities: {},
                otherActivity: int.other_activity_details || ''
            };
            
            // Fetch beneficiaries
            const benResult = await pool.query(
                `SELECT grade_level, beneficiary_count FROM siif_beneficiaries WHERE siif_int_id = $1`,
                [dbIntId]
            );
            
            for (const ben of benResult.rows) {
                interventionData[intId].selectedGrades.push(ben.grade_level);
                interventionData[intId].beneficiaryCounts[ben.grade_level] = ben.beneficiary_count;
            }
            
            // Fetch activities
            const actResult = await pool.query(
                `SELECT activity_category, activity_specific FROM siif_activities WHERE siif_int_id = $1`,
                [dbIntId]
            );
            
            for (const act of actResult.rows) {
                if (!interventionData[intId].selectedActivities[act.activity_category]) {
                    interventionData[intId].selectedActivities[act.activity_category] = [];
                }
                interventionData[intId].selectedActivities[act.activity_category].push(act.activity_specific);
            }

            // Fetch utilization
            const utilResult = await pool.query(
                `SELECT quarter, utilized_amount FROM siif_utilization WHERE siif_int_id = $1`,
                [dbIntId]
            );
            utilization[intId] = {};
            for (const util of utilResult.rows) {
                utilization[intId][util.quarter] = util.utilized_amount;
            }
        }

        // ─── Fetch Allocation Data ──────────────────────────────────────────
        const allocResult = await pool.query(
            `SELECT allocation_amount, spent_amount, remarks 
             FROM siif_allocations 
             WHERE school_id = $1 AND fiscal_year = $2`,
            [finalSchoolId, fiscalYear]
        );
        const allocation = allocResult.rows[0] || { allocation_amount: 0, spent_amount: 0 };
        
        const submissionResponse = {
            siif_sub_id: submission.siif_sub_id,
            submissionId: submission.siif_sub_id,
            schoolId: submission.school_id,
            schoolName: submission.school_name,
            region: submission.region,
            division: submission.division,
            fiscalYear: submission.fiscal_year,
            totalBudget: submission.total_budget_estimate,
            status: submission.submitted_at ? 'submitted' : 'draft',
            interventions,
            budgetEstimates,
            interventionData,
            utilization,
            aral,
            allocation
        };

        res.json({
            success: true,
            ...submissionResponse,
            submission: submissionResponse
        });
        console.log(`📦 [SIIF-API] Sent JSON with ${interventions.length} interventions and interventionData keys:`, Object.keys(interventionData));
        
    } catch (err) {
        console.error('[SIIF-API] Error fetching submission:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});



// ─── POST /api/siif/submit ───────────────────────────────────────────────────
app.post('/api/siif/submit', authenticate, async (req, res) => {
    const { 
        schoolId, schoolName, region, division, fiscalYear,
        interventions, interventionData, budgetEstimates, aral,
        totalBudget, status = 'submitted' 
    } = req.body;

    // 🔬 MASTER TINKERER: Diagnostic logging for submission
    console.log('\n📬 [SIIF-API] Incoming Submission from:', schoolName || 'Unknown School');
    console.log('👤 [SIIF-API] Submitting User:', { 
        email: req.user?.email, 
        uid: req.user?.uid || req.user?.id,
        school_id_in_token: req.user?.school_id || req.user?.schoolId 
    });
    console.log('📦 [SIIF-API] Payload Summary:', {
        passedSchoolId: schoolId,
        interventionsCount: interventions?.length,
        hasData: !!interventionData,
        hasBudgets: !!budgetEstimates
    });
    
    // 🔍 MASTER TINKERER: Resolve final school ID with robust fallback chain
    let finalSchoolId = schoolId || req.user?.school_id || req.user?.schoolId || req.user?.uid || req.user?.id || req.user?.sub;

    // [SURGICAL LOOKUP] If schoolId is missing, 'undefined', or a long UUID, resolve to 6-digit ID
    if (!finalSchoolId || finalSchoolId === 'undefined' || finalSchoolId.length > 10) {
        console.log(`🔎 [SIIF-API] Normalizing schoolId for submission: ${finalSchoolId}. Attempting surgical lookup...`);
        
        if (req.user?.email) {
            try {
                const userLookup = await pool.query(
                    'SELECT school_id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
                    [req.user.email]
                );
                if (userLookup.rows.length > 0 && userLookup.rows[0].school_id) {
                    finalSchoolId = userLookup.rows[0].school_id;
                    console.log(`✅ [SIIF-API] Resolved to 6-digit SchoolId for submission: ${finalSchoolId}`);
                } else {
                    console.warn(`⚠️ [SIIF-API] No school_id found in users table for ${req.user.email}`);
                }
            } catch (lookupErr) {
                console.error('🔥 [SIIF-API] Surgical lookup failed:', lookupErr.message);
            }
        }
    }

    console.log('🏁 [SIIF-API] Final Submission ID Resolution:', { finalSchoolId });

    if (!finalSchoolId || !interventions || !Array.isArray(interventions)) {
        console.error('❌ [SIIF Submit] Validation Failed:', {
            hasSchoolId: !!finalSchoolId,
            hasInterventions: !!interventions,
            isInterventionsArray: Array.isArray(interventions),
            interventionsLength: interventions?.length
        });
        return res.status(400).json({ 
            error: 'Missing required fields', 
            details: { 
                schoolId: finalSchoolId || 'MISSING', 
                interventions: interventions ? (Array.isArray(interventions) ? `Array(${interventions.length})` : typeof interventions) : 'MISSING',
                user: {
                    email: req.user?.email,
                    uid: req.user?.uid || req.user?.id || req.user?.sub,
                    school_id_in_token: req.user?.school_id || req.user?.schoolId
                }
            } 
        });
    }

    const currentFiscalYear = fiscalYear || new Date().getFullYear();
    const submittedAt = status === 'submitted' ? new Date() : null;

    let client;
    try {
        console.log('🧪 [SIIF-API] Attempting to acquire DB client...');
        client = await pool.connect();
        console.log('✅ [SIIF-API] DB client acquired. Starting transaction...');
        
        await client.query('BEGIN');

        // 🛡️ ABSOLUTE LOCK: Enforcement of Global Deadline
        const settingsRes = await client.query("SELECT value FROM settings WHERE key = 'siif_deadline'");
        const deadlineStr = settingsRes.rows[0]?.value;
        
        if (deadlineStr) {
            const deadline = new Date(deadlineStr);
            const now = new Date();
            
            console.log(`⌛ [SIIF-LOCK] Checking Deadline: ${deadlineStr} | Current Time: ${now.toISOString()}`);
            
            if (now > deadline) {
                console.warn(`⛔ [SIIF-LOCK] ACCESS DENIED. Submission window closed at ${deadlineStr}`);
                await client.query('ROLLBACK');
                return res.status(403).json({ 
                    error: 'Submission Window Closed', 
                    message: 'The deadline for SIIF planning has passed. Modifications are no longer allowed.',
                    deadline: deadlineStr,
                    isExpired: true
                });
            }
            console.log('🔓 [SIIF-LOCK] Window is open. Proceeding...');
        } else {
            console.log('⚠️ [SIIF-LOCK] No global deadline set in settings table. Proceeding without temporal lock.');
        }

        // 🛡️ AUTHORIZED BYPASS: Allow deletion for this transaction (Immutability override)
        await client.query("SET LOCAL internal.authorized_app_deletion = 'true'");

        // 1. Delete previous submissions for the same school and year
        // We'll do a cascading delete if foreign keys are set up, but let's be explicit if not
        await client.query(
            `DELETE FROM siif_submissions WHERE school_id = $1 AND fiscal_year = $2`,
            [finalSchoolId, currentFiscalYear]
        );
        console.log('✅ [SIIF-API] Old records cleared');

        // 2. Insert main submission header
        const submissionResult = await client.query(
            `INSERT INTO siif_submissions
             (school_id, school_name, region, division, fiscal_year, total_budget_estimate, submitted_at, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING siif_sub_id`,
            [
                finalSchoolId,
                req.body.schoolName || 'Unknown School',
                req.body.region || 'Unknown Region',
                req.body.division || 'Unknown Division',
                currentFiscalYear,
                totalBudget,
                submittedAt,
                status || 'draft'
            ]
        );
        const submissionId = submissionResult.rows[0].siif_sub_id;
        console.log(`🆔 [SIIF-API] Submission header created. ID: ${submissionId}`);
        console.log(`✅ [SIIF-API] Submission header created. ID: ${submissionId}`);

        // 3. Insert detailed interventions
        for (const intType of interventions) {
            const data = interventionData?.[intType] || {};
            const budget = budgetEstimates?.[intType] || 0;
            
            console.log(`   - Inserting intervention: ${intType}`);
            
            // Remediation specific aral data
            let hasAral = false;
            let aralSubjects = [];
            if (intType === 'remediation' && aral) {
                hasAral = aral.planned === 'yes';
                aralSubjects = aral.subjects || [];
            }

            const intResult = await client.query(
                `INSERT INTO siif_interventions
                 (siif_sub_id, intervention_type, budget_estimate, has_aral, aral_subjects, other_activity_details)
                 VALUES ($1, $2, $3, $4, $5, $6) 
                 RETURNING siif_int_id`,
                [
                    submissionId,
                    intType,
                    budget,
                    hasAral,
                    aralSubjects,
                    data.otherActivity || ''
                ]
            );
            const siifIntId = intResult.rows[0].siif_int_id;

            // 4. Insert Beneficiaries
            const beneficiaryCounts = data.beneficiaryCounts || {};
            for (const [gradeLevel, count] of Object.entries(beneficiaryCounts)) {
                if (count > 0) {
                    await client.query(
                        `INSERT INTO siif_beneficiaries (siif_int_id, grade_level, beneficiary_count)
                         VALUES ($1, $2, $3)`,
                         [siifIntId, gradeLevel, parseInt(count) || 0]
                    );
                }
            }

            // 5. Insert Activities
            const selectedActivities = data.selectedActivities || {};
            for (const [category, specificList] of Object.entries(selectedActivities)) {
                if (Array.isArray(specificList)) {
                    for (const specific of specificList) {
                        await client.query(
                            `INSERT INTO siif_activities (siif_int_id, activity_category, activity_specific)
                             VALUES ($1, $2, $3)`,
                             [siifIntId, category, specific]
                        );
                    }
                }
            }
        }

        await client.query('COMMIT');
        console.log(`🎉 [SIIF-API] Full submission successful for ${finalSchoolId}\n`);
        res.json({ success: true, submissionId });
    } catch (error) {
        console.error('🔥 [SIIF-API] CRITICAL SUBMISSION ERROR:', error);
        if (client) {
            console.log('🔄 [SIIF-API] Rolling back transaction...');
            try {
                await client.query('ROLLBACK');
                console.log('✅ [SIIF-API] Rollback complete.');
            } catch (rollbackErr) {
                console.error('❌ [SIIF-API] Rollback failed:', rollbackErr.message);
            }
        }
        
        res.status(500).json({ 
            error: 'Internal Server Error', 
            details: error.message,
            db_detail: error.detail,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    } finally {
        if (client) {
            client.release();
            console.log('🔌 [SIIF-API] DB client released back to pool.');
        }
    }
});

// ─── POST /api/siif/utilization ──────────────────────────────────────────────
app.post('/api/siif/utilization', authenticate, async (req, res) => {
    const { submissionId, utilizationData } = req.body;
    
    console.log(`\n🔬 [SIIF-API] UTILIZATION UPDATE REQ for Submission: ${submissionId}`);
    console.log(`🌐 [SIIF-API] Payload:`, JSON.stringify(utilizationData, null, 2));

    if (!submissionId || !utilizationData) {
        console.error('❌ [SIIF-API] Missing submissionId or utilizationData');
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // We need to map intervention types back to their siif_int_id for this submission
        const intLookup = await client.query(
            'SELECT siif_int_id, intervention_type FROM siif_interventions WHERE siif_sub_id = $1',
            [submissionId]
        );
        
        const typeToIdMap = {};
        intLookup.rows.forEach(r => typeToIdMap[r.intervention_type] = r.siif_int_id);

        console.log(`🔍 [SIIF-API] Found ${intLookup.rows.length} interventions for this submission.`);

        for (const [intType, quarters] of Object.entries(utilizationData)) {
            const dbIntId = typeToIdMap[intType];
            if (!dbIntId) {
                console.warn(`⚠️ [SIIF-API] Intervention type "${intType}" not found in submission. Skipping.`);
                continue;
            }

            for (const [quarter, amount] of Object.entries(quarters)) {
                console.log(`💾 [SIIF-API] Upserting: ${intType} | ${quarter} | ₱${amount}`);
                await client.query(
                    `INSERT INTO siif_utilization (siif_int_id, quarter, utilized_amount, updated_at)
                     VALUES ($1, $2, $3, NOW())
                     ON CONFLICT (siif_int_id, quarter) 
                     DO UPDATE SET utilized_amount = EXCLUDED.utilized_amount, updated_at = NOW()`,
                    [dbIntId, quarter, parseFloat(amount) || 0]
                );
            }
        }

        await client.query('COMMIT');
        console.log(`✅ [SIIF-API] Utilization updated successfully for submission ${submissionId}\n`);
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('🔥 [SIIF-API] Utilization Update Error:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    } finally {
        client.release();
    }
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
    console.error('[SIIF] Unhandled Rejection:', reason);
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`[SIIF] Service running on http://localhost:${PORT}`);
    console.log(`[SIIF] Health: http://localhost:${PORT}/api/siif/health`);
});
