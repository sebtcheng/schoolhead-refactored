import express from 'express';
import { safeQuery } from '../../utils/db.js';

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

        const colList = ['iern', 'school_id', ...fields].join(', ');
        const valPlaceholders = ['iern', 'school_id', ...fields].map((_, i) => `$${i + 1}`).join(', ');
        const updateClause = fields.map((f, i) => `${f} = $${i + 3}`).join(', ');

        const query = `
            INSERT INTO unit3_organized_classes (${colList})
            VALUES (${valPlaceholders})
            ON CONFLICT (iern) DO UPDATE SET ${updateClause}
            RETURNING *
        `;

        const result = await safeQuery(query, [iern, school_id, ...values]);
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
