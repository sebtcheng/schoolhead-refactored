// ─── Submission Routes ────────────────────────────────────────────────────────
// GET  /api/siif/submission/:schoolId  — Fetch full submission with all relations
// POST /api/siif/submit                — Create/update a draft or submitted plan

import { Router } from 'express';
import { poolSiif as pool } from '@shared/db';
import { authenticate } from '../middleware/authenticate.js';
import { resolveSchoolId } from '../helpers/resolveSchoolId.js';

const router = Router();

// ─── GET /api/siif/submission/:schoolId ──────────────────────────────────────
router.get('/submission/:schoolId', authenticate, async (req, res) => {
    const { schoolId } = req.params;
    const fiscalYear = new Date().getFullYear();
    const finalSchoolId = await resolveSchoolId(schoolId, req.user);

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
        const utilization = {};
        let aral = { planned: null, subjects: [] };

        for (const int of intResult.rows) {
            const intId = int.intervention_type;
            const dbIntId = int.siif_int_id;
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
                otherActivity: int.other_activity_details || '',
            };

            // Fetch beneficiaries
            const benResult = await pool.query(
                `SELECT grade_level, beneficiary_count, aral_sub_counts FROM siif_beneficiaries WHERE siif_int_id = $1`,
                [dbIntId]
            );
            for (const ben of benResult.rows) {
                interventionData[intId].selectedGrades.push(ben.grade_level);
                interventionData[intId].beneficiaryCounts[ben.grade_level] = ben.beneficiary_count;
                if (!interventionData[intId].aralCounts) {
                    interventionData[intId].aralCounts = {};
                }
                interventionData[intId].aralCounts[ben.grade_level] = ben.aral_sub_counts || {};
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
                `SELECT quarter, utilized_amount, implementation_status, justification FROM siif_utilization WHERE siif_int_id = $1`,
                [dbIntId]
            );
            utilization[intId] = {};
            for (const util of utilResult.rows) {
                utilization[intId][util.quarter] = {
                    amount: util.utilized_amount,
                    status: util.implementation_status || 'Not Yet Started',
                    justification: util.justification || ''
                };
            }
        }

        // Fetch allocation data
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
            status: submission.submission_status || submission.status || (submission.submitted_at ? 'submitted' : 'draft'),
            remarks: submission.remarks || submission.rejection_reason || null,
            rejection_reason: submission.remarks || submission.rejection_reason || null,
            rejectionReason: submission.remarks || submission.rejection_reason || null,
            interventions,
            budgetEstimates,
            interventionData,
            utilization,
            aral,
            allocation,
            priorityAreas: submission.priority_improvement_area || [],
        };

        console.log(`[DEBUG] mapped status: ${submissionResponse.status} | DB submission_status: ${submission.submission_status} | DB status: ${submission.status}`);

        res.json({ success: true, ...submissionResponse, submission: submissionResponse });
        console.log(`📦 [SIIF-API] Sent JSON with ${interventions.length} interventions and interventionData keys:`, Object.keys(interventionData));
    } catch (err) {
        console.error('[SIIF-API] Error fetching submission:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─── POST /api/siif/submit ────────────────────────────────────────────────────
router.post('/submit', async (req, res) => {
    const {
        schoolId, schoolName, region, division, fiscalYear,
        interventions, interventionData, budgetEstimates, aral,
        totalBudget, status = 'submitted', priorityAreas = [],
    } = req.body;

    console.log('\n📬 [SIIF-API] Incoming Submission from:', schoolName || 'Unknown School');
    console.log('👤 [SIIF-API] Submitting User:', {
        email: req.user?.email,
        uid: req.user?.uid || req.user?.id,
        school_id_in_token: req.user?.school_id || req.user?.schoolId,
    });
    console.log('📦 [SIIF-API] Payload Summary:', {
        passedSchoolId: schoolId,
        interventionsCount: interventions?.length,
        hasData: !!interventionData,
        hasBudgets: !!budgetEstimates,
    });

    const finalSchoolId = await resolveSchoolId(schoolId, req.user);
    console.log('🏁 [SIIF-API] Final Submission ID Resolution:', { finalSchoolId });

    if (!finalSchoolId || !interventions || !Array.isArray(interventions)) {
        console.error('❌ [SIIF Submit] Validation Failed:', {
            hasSchoolId: !!finalSchoolId,
            hasInterventions: !!interventions,
            isInterventionsArray: Array.isArray(interventions),
            interventionsLength: interventions?.length,
        });
        return res.status(400).json({
            error: 'Missing required fields',
            details: {
                schoolId: finalSchoolId || 'MISSING',
                interventions: interventions
                    ? Array.isArray(interventions)
                        ? `Array(${interventions.length})`
                        : typeof interventions
                    : 'MISSING',
                user: {
                    email: req.user?.email,
                    uid: req.user?.uid || req.user?.id || req.user?.sub,
                    school_id_in_token: req.user?.school_id || req.user?.schoolId,
                },
            },
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

        // ─── 🛡️ ABSOLUTE LOCK: Enforce Global Deadline Interval ─────────────
        const settingsRes = await client.query(
            "SELECT key, value FROM settings WHERE key IN ('siif_deadline', 'siif_form_start', 'siif_form_end')"
        );
        const settings = {};
        settingsRes.rows.forEach(row => (settings[row.key] = row.value));

        const deadlineStr = settings['siif_form_end'] || settings['siif_deadline'];
        const startStr = settings['siif_form_start'];
        const now = new Date();

        // 1. Check if the window hasn't opened yet
        if (startStr) {
            const startDate = new Date(startStr);
            if (now < startDate) {
                console.warn(`⛔ [SIIF-LOCK] ACCESS DENIED. Submission window opens at ${startStr}`);
                await client.query('ROLLBACK');
                return res.status(403).json({
                    error: 'Submission Window Not Open',
                    message: `The form is scheduled to open on ${new Date(startStr).toLocaleString()}.`,
                    start: startStr,
                    isScheduled: true,
                });
            }
        }

        // 2. Check if the window has closed
        if (deadlineStr) {
            const deadlineDate = new Date(deadlineStr);
            if (now > deadlineDate) {
                console.warn(`⛔ [SIIF-LOCK] ACCESS DENIED. Submission window closed at ${deadlineStr}`);
                await client.query('ROLLBACK');
                return res.status(403).json({
                    error: 'Submission Window Closed',
                    message: 'The deadline for SIIF planning has passed. Modifications are no longer allowed.',
                    deadline: deadlineStr,
                    isExpired: true,
                });
            }
            console.log('🔓 [SIIF-LOCK] Window is open. Proceeding...');
        } else {
            console.log('⚠️ [SIIF-LOCK] No global deadline set in settings table. Proceeding without temporal lock.');
        }

        // Authorized deletion for re-submission
        await client.query("SET LOCAL internal.authorized_app_deletion = 'true'");

        let existingSubmissionStatus = null;
        let existingRemarks = null;

        // Clear previous children for this school/year (interventions, beneficiaries, activities)
        const oldSubRes = await client.query('SELECT siif_sub_id, submission_status, remarks FROM siif_submissions WHERE school_id = $1 AND fiscal_year = $2', [finalSchoolId, currentFiscalYear]);
        
        let submissionId;

        if (oldSubRes.rows.length > 0) {
            const oldSub = oldSubRes.rows[0];
            submissionId = oldSub.siif_sub_id;
            existingSubmissionStatus = oldSub.submission_status;
            existingRemarks = oldSub.remarks;

            const oldIntRes = await client.query('SELECT siif_int_id FROM siif_interventions WHERE siif_sub_id = $1', [submissionId]);
            const oldIntIds = oldIntRes.rows.map(r => r.siif_int_id);
            
            if (oldIntIds.length > 0) {
                await client.query('DELETE FROM siif_beneficiaries WHERE siif_int_id = ANY($1::int[])', [oldIntIds]);
                await client.query('DELETE FROM siif_activities WHERE siif_int_id = ANY($1::int[])', [oldIntIds]);
                await client.query('DELETE FROM siif_interventions WHERE siif_sub_id = $1', [submissionId]);
            }

            // If explicit submit, update submission_status to submitted
            let finalSubmissionStatus = existingSubmissionStatus;
            if (status === 'submitted') {
                finalSubmissionStatus = 'submitted';
            }

            // Update existing submission header
            await client.query(
                `UPDATE siif_submissions 
                 SET school_name = $1, region = $2, division = $3, district = $4, total_budget_estimate = $5, 
                     submitted_at = $6, status = $7, submission_status = $8, priority_improvement_area = $9
                 WHERE siif_sub_id = $10`,
                [
                    req.body.schoolName || 'Unknown School',
                    req.body.region || 'Unknown Region',
                    req.body.division || 'Unknown Division',
                    req.body.district || '',
                    isNaN(parseFloat(totalBudget)) ? 0 : parseFloat(totalBudget),
                    submittedAt,
                    status || 'draft',
                    finalSubmissionStatus,
                    JSON.stringify(priorityAreas),
                    submissionId
                ]
            );
            console.log(`✅ [SIIF-API] Old children cleared and header updated. ID: ${submissionId}`);

        } else {
            // Insert new submission header
            const submissionResult = await client.query(
                `INSERT INTO siif_submissions
                 (school_id, school_name, region, division, district, fiscal_year, total_budget_estimate, submitted_at, status, submission_status, remarks, priority_improvement_area)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                 RETURNING siif_sub_id`,
                [
                    finalSchoolId,
                    req.body.schoolName || 'Unknown School',
                    req.body.region || 'Unknown Region',
                    req.body.division || 'Unknown Division',
                    req.body.district || '',
                    currentFiscalYear,
                    isNaN(parseFloat(totalBudget)) ? 0 : parseFloat(totalBudget),
                    submittedAt,
                    status || 'draft',
                    null,
                    null,
                    JSON.stringify(priorityAreas)
                ]
            );
            submissionId = submissionResult.rows[0].siif_sub_id;
            console.log(`🆔 [SIIF-API] Submission header created. ID: ${submissionId}`);
        }

        // Insert interventions, beneficiaries, and activities
        for (const intType of interventions) {
            const data = interventionData?.[intType] || {};
            let budget = budgetEstimates?.[intType] || 0;
            budget = parseFloat(budget);
            if (isNaN(budget)) budget = 0;

            console.log(`   - Inserting intervention: ${intType}`);

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
                [submissionId, intType, budget, hasAral, aralSubjects, data.otherActivity || '']
            );
            const siifIntId = intResult.rows[0].siif_int_id;

            // Beneficiaries
            const beneficiaryCounts = data.beneficiaryCounts || {};
            const aralCounts = data.aralCounts || {};
            for (const [gradeLevel, count] of Object.entries(beneficiaryCounts)) {
                if (count > 0 || (typeof count === 'string' && count !== '')) {
                    const gradeAralCounts = aralCounts[gradeLevel] || {};
                    await client.query(
                        `INSERT INTO siif_beneficiaries (siif_sub_id, siif_int_id, grade_level, beneficiary_count, aral_sub_counts)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [submissionId, siifIntId, gradeLevel, parseInt(count) || 0, gradeAralCounts]
                    );
                }
            }

            // Activities
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
            try {
                await client.query('ROLLBACK');
                console.log('✅ [SIIF-API] Rollback complete.');
            } catch (rollbackErr) {
                console.error('❌ [SIIF-API] Rollback failed:', rollbackErr.message);
            }
        }
        console.error('[SIIF-LOG] Error stack:', error.stack || error.message);
        res.status(500).json({
            error: 'Internal Server Error',
            details: error.message,
            db_detail: error.detail,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        });
    } finally {
        if (client) {
            client.release();
            console.log('🔌 [SIIF-API] DB client released back to pool.');
        }
    }
});

export default router;
