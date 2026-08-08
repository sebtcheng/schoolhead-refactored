import express from 'express';
import { safeQuery, updateSchoolTotalCompletion } from '@shared/db';

const router = express.Router();

async function resolveIdent(id) {
    if (!id) return { iern: null, school_id: null };
    const sRes = await safeQuery('SELECT iern, school_id FROM ph_schools WHERE school_id = $1 OR iern = $1 LIMIT 1', [id]);
    if (sRes.rows[0]) return { iern: sRes.rows[0].iern, school_id: sRes.rows[0].school_id };

    const iernRes = await safeQuery('SELECT "IERN" as iern, "SchoolID" as school_id FROM "schools_IERN" WHERE "SchoolID" = $1 OR "IERN" = $1 LIMIT 1', [id]);
    if (iernRes.rows[0]) return { iern: iernRes.rows[0].iern, school_id: iernRes.rows[0].school_id };

    const fallbackIern = id.startsWith('IERN-') ? id : `IERN-${id}`;
    return { iern: fallbackIern, school_id: id };
}

// ─────────────────────────────────────────────────────────────────────────────
// [QUEST] UNIT 8: SCHOOL LOCATION & TERRAIN
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/school-location/:id or GET /api/ph_schools/unit8/:id
const getUnit8Handler = async (req, res) => {
    try {
        const { id } = req.params;
        const { iern } = await resolveIdent(id);

        if (!iern) {
            return res.status(404).json({ success: false, error: 'School not found' });
        }

        const subRes = await safeQuery(
            'SELECT payload, is_completed, validation_status, validation_remarks FROM ph_school_unit_submissions WHERE iern = $1 AND unit_number = 8',
            [iern]
        );

        if (subRes.rowCount > 0) {
            const row = subRes.rows[0];
            return res.json({
                success: true,
                exists: true,
                payload: row.payload || {},
                is_completed: row.is_completed || false,
                validation_status: row.validation_status || 'draft',
                validation_remarks: row.validation_remarks || null,
                data: row.payload || {}
            });
        }

        res.json({
            success: true,
            exists: false,
            payload: {},
            is_completed: false,
            validation_status: 'draft',
            validation_remarks: null,
            data: {}
        });
    } catch (err) {
        console.error("Unit 8 Fetch Error:", err);
        res.status(500).json({ error: err.message });
    }
};

router.get('/api/school-location/:id', getUnit8Handler);
router.get('/api/ph_schools/unit8/:id', getUnit8Handler);

// POST /api/school-location or POST /api/ph_schools/unit8
const saveUnit8Handler = async (req, res) => {
    try {
        const body = req.body || {};
        const inputPayload = body.payload || body;
        const schoolId = body.school_id || inputPayload.school_id || req.params.id;

        let { iern, school_id: resolvedSchoolId } = await resolveIdent(schoolId || body.iern || inputPayload.iern);
        if (!iern) return res.status(400).json({ error: "Missing school_id or iern identifier" });

        // Ensure parent ph_schools record exists
        await safeQuery(
            `INSERT INTO ph_schools (iern, school_id) VALUES ($1, $2) ON CONFLICT (iern) DO NOTHING`,
            [iern, resolvedSchoolId || iern]
        );

        // Lock Check
        const checkLock = await safeQuery(
            'SELECT validation_status, validation_remarks FROM ph_school_unit_submissions WHERE iern = $1 AND unit_number = 8',
            [iern]
        );
        if (checkLock.rows[0]?.validation_status === 'validated') {
            return res.status(403).json({ error: 'This module is validated and locked.' });
        }

        const isCompleted = body.is_completed !== false && inputPayload.is_completed !== false;
        const currentStatus = checkLock.rows[0]?.validation_status || 'draft';
        const isResubmission = ['returned', 'rejected'].includes(currentStatus);
        const nextStatus = isResubmission ? 'submitted' : (isCompleted ? 'submitted' : 'draft');
        const nextRemarks = isResubmission ? null : (checkLock.rows[0]?.validation_remarks || null);

        const upsertRes = await safeQuery(`
            INSERT INTO ph_school_unit_submissions 
                (iern, unit_number, payload, is_completed, validation_status, validation_remarks, submitted_at, updated_at)
            VALUES ($1, 8, $2::jsonb, $3, $4, CASE WHEN $4 = 'submitted' THEN NULL ELSE $5 END, CASE WHEN $4 = 'submitted' THEN NOW() ELSE NULL END, NOW())
            ON CONFLICT (iern, unit_number) DO UPDATE SET
                payload = EXCLUDED.payload,
                is_completed = EXCLUDED.is_completed,
                validation_status = EXCLUDED.validation_status,
                validation_remarks = CASE WHEN EXCLUDED.validation_status = 'submitted' THEN NULL ELSE ph_school_unit_submissions.validation_remarks END,
                submitted_at = CASE WHEN EXCLUDED.validation_status = 'submitted' THEN NOW() ELSE ph_school_unit_submissions.submitted_at END,
                updated_at = NOW()
            RETURNING *;
        `, [iern, JSON.stringify(inputPayload), isCompleted, nextStatus, nextRemarks]);

        await updateSchoolTotalCompletion(iern);

        res.json({
            success: true,
            data: upsertRes.rows[0],
            payload: upsertRes.rows[0].payload,
            validation_status: upsertRes.rows[0].validation_status,
            validation_remarks: upsertRes.rows[0].validation_remarks
        });
    } catch (err) {
        console.error("Unit 8 Update Error:", err);
        res.status(500).json({ error: err.message });
    }
};

router.post('/api/school-location', saveUnit8Handler);
router.post('/api/ph_schools/unit8', saveUnit8Handler);
router.put('/api/ph_schools/unit8/:id', saveUnit8Handler);

export { router as unit8Router };
export default router;
