import express from 'express';
import { safeQuery, safeUsersQuery, updateSchoolTotalCompletion } from '@shared/db';

const router = express.Router();

async function resolveIdent(id) {
    if (!id) return { iern: null, school_id: null };
    const sRes = await safeQuery('SELECT iern, school_id FROM ph_schools WHERE school_id = $1 OR iern = $1 LIMIT 1', [id]);
    if (sRes.rows[0]) return { iern: sRes.rows[0].iern, school_id: sRes.rows[0].school_id };

    const iernRes = await safeUsersQuery('SELECT iern, school_id FROM schools_iern WHERE school_id = $1 OR iern = $1 LIMIT 1', [id]);
    if (iernRes.rows[0]) return { iern: iernRes.rows[0].iern, school_id: iernRes.rows[0].school_id };

    const fallbackIern = id.startsWith('IERN-') ? id : `IERN-${id}`;
    return { iern: fallbackIern, school_id: id };
}

// ─────────────────────────────────────────────────────────────────────────────
// [QUEST] UNIT 7: PHYSICAL FACILITIES
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/ph_schools/unit7/:id
router.get('/api/ph_schools/unit7/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { iern } = await resolveIdent(id);

        if (!iern) {
            return res.status(404).json({ success: false, error: 'School not found' });
        }

        const subRes = await safeQuery(
            'SELECT payload, is_completed, validation_status, validation_remarks FROM ph_school_unit_submissions WHERE iern = $1 AND unit_number = 7',
            [iern]
        );

        if (subRes.rowCount > 0) {
            const row = subRes.rows[0];
            return res.json({
                success: true,
                payload: row.payload || {},
                is_completed: row.is_completed || false,
                validation_status: row.validation_status || 'draft',
                validation_remarks: row.validation_remarks || null,
                data: row.payload || {}
            });
        }

        res.json({
            success: true,
            payload: {},
            is_completed: false,
            validation_status: 'draft',
            validation_remarks: null,
            data: {}
        });
    } catch (err) {
        console.error("Unit 7 Fetch Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/ph_schools/unit7/:id/master
router.get('/api/ph_schools/unit7/:id/master', async (req, res) => {
    try {
        const { id } = req.params;
        const { iern } = await resolveIdent(id);

        const subRes = await safeQuery(
            'SELECT payload, is_completed, validation_status, validation_remarks FROM ph_school_unit_submissions WHERE iern = $1 AND unit_number = 7',
            [iern]
        );

        const payload = subRes.rows[0]?.payload || {};
        res.json({
            success: true,
            data: {
                inventory: payload.inventory || payload.inventoryEntries || [],
                repairs: payload.repairs || payload.repairEntries || [],
                isCompleted: subRes.rows[0]?.is_completed === true,
                has_no_building: payload.has_no_building || false,
                facilities: payload
            }
        });
    } catch (err) {
        console.error("Unit 7 Master Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/unit8/teachers/:id (Teacher Lookup)
router.get('/api/unit8/teachers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await safeQuery(
            'SELECT first_name, last_name, id FROM ph_teachers_list WHERE school_id = $1',
            [id]
        ).catch(() => ({ rows: [] }));
        res.json({ success: true, teachers: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/save-physical-facilities
router.post('/api/save-physical-facilities', async (req, res) => {
    try {
        const body = req.body || {};
        const inputPayload = body.payload || body;
        const schoolId = body.school_id || body.schoolId || inputPayload.school_id || inputPayload.schoolId;

        let { iern, school_id: resolvedSchoolId } = await resolveIdent(schoolId || body.iern || inputPayload.iern);
        if (!iern) return res.status(400).json({ error: "Missing school_id or iern identifier" });

        // Ensure parent ph_schools record exists
        await safeQuery(
            `INSERT INTO ph_schools (iern, school_id) VALUES ($1, $2) ON CONFLICT (iern) DO NOTHING`,
            [iern, resolvedSchoolId || iern]
        );

        // Lock Check
        const checkLock = await safeQuery(
            'SELECT validation_status, validation_remarks FROM ph_school_unit_submissions WHERE iern = $1 AND unit_number = 7',
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
            VALUES ($1, 7, $2::jsonb, $3, $4, CASE WHEN $4 = 'submitted' THEN NULL ELSE $5 END, CASE WHEN $4 = 'submitted' THEN NOW() ELSE NULL END, NOW())
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
        console.error("Unit 7 Save Error:", err);
        res.status(500).json({ error: err.message });
    }
});

export { router as unit7Router };
export default router;
