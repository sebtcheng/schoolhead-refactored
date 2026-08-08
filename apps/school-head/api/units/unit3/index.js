import express from 'express';
import { safeQuery } from '@shared/db';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// [QUEST] UNIT 3: ORGANIZED CLASSES
// ─────────────────────────────────────────────────────────────────────────────
router.put('/api/ph_schools/unit3/:id', async (req, res) => {
    const schoolId = req.params.id;
    const data = req.body;

    try {
        // Resolve iern and school_id from ph_schools/schools_IERN
        let schoolQuery = await safeQuery(
            `SELECT school_id, iern FROM ph_schools WHERE school_id = $1 OR iern = $1`,
            [schoolId]
        );
        if (schoolQuery.rowCount === 0) {
            schoolQuery = await safeQuery(
                `SELECT "SchoolID" as school_id, "IERN" as iern FROM "schools_IERN" WHERE "SchoolID" = $1 OR "IERN" = $1`,
                [schoolId]
            );
        }
        if (schoolQuery.rowCount === 0) {
            return res.status(404).json({ error: "School not found" });
        }
        const { school_id, iern } = schoolQuery.rows[0];

        const fields = [
            'grade_kinder_size', 'grade_1_size', 'grade_2_size', 'grade_3_size',
            'grade_4_size', 'grade_5_size', 'grade_6_size', 'grade_7_size',
            'grade_8_size', 'grade_9_size', 'grade_10_size', 'grade_11_size',
            'grade_12_size', 'multigrade_size_1', 'multigrade_size_2', 'multigrade_size_3',
            'unit3', 'unit3_completed', 'updated_at'
        ];

        const values = fields.map(f => {
            if (f === 'unit3') return true;
            if (f === 'unit3_completed') return 100.00;
            if (f === 'updated_at') return new Date();
            return data[f] !== undefined ? data[f] : null;
        });

        const school_yr = data.school_yr || 'SY 26-27';

        const colList = ['iern', 'school_id', 'school_yr', ...fields].join(', ');
        const valPlaceholders = ['iern', 'school_id', 'school_yr', ...fields].map((_, i) => `$${i + 1}`).join(', ');
        const updateClause = fields.map((f, i) => `${f} = $${i + 4}`).join(', ');

        // ── 1. VALIDATION LOCK CHECK & HYBRID JSONB UPSERT ──────────────────────
        const checkLock = await safeQuery(
            'SELECT validation_status, validation_remarks FROM ph_school_unit_submissions WHERE iern = $1 AND unit_number = 3',
            [iern]
        );
        if (checkLock.rows[0]?.validation_status === 'validated') {
            return res.status(403).json({ error: 'This module is validated and locked.' });
        }

        const currentStatus = checkLock.rows[0]?.validation_status || 'draft';
        const isResubmission = ['returned', 'rejected'].includes(currentStatus);
        const nextStatus = isResubmission ? 'submitted' : (data.is_completed !== false ? 'submitted' : 'draft');
        const nextRemarks = isResubmission ? null : (checkLock.rows[0]?.validation_remarks || null);

        await safeQuery(`
            INSERT INTO ph_school_unit_submissions 
                (iern, unit_number, payload, is_completed, validation_status, validation_remarks, submitted_at, updated_at)
            VALUES ($1, 3, $2, TRUE, $3, $4, NOW(), NOW())
            ON CONFLICT (iern, unit_number) DO UPDATE SET
                payload = EXCLUDED.payload,
                is_completed = TRUE,
                validation_status = EXCLUDED.validation_status,
                validation_remarks = EXCLUDED.validation_remarks,
                submitted_at = NOW(),
                updated_at = NOW()
        `, [iern, JSON.stringify(data), nextStatus, nextRemarks]);

        const result = await safeQuery(query, [iern, school_id, school_yr, ...values]);
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error("❌ [API] Unit 3 Update Error:", {
            message: err.message,
            stack: err.stack,
            schoolId: schoolId,
            payloadSummary: Object.keys(data || {})
        });
        res.status(500).json({ error: err.message, detail: "Invalid JSON or database constraint violation in Unit 3" });
    }
});

export { router as unit3Router };
export default router;
