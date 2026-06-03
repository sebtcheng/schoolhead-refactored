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
        const fields = [
            'has_multigrade', 'multigrade_sections_count', 'unit3_simplified_counts',
            'grade_kinder_size', 'grade_1_size', 'grade_2_size', 'grade_3_size',
            'grade_4_size', 'grade_5_size', 'grade_6_size', 'grade_7_size',
            'grade_8_size', 'grade_9_size', 'grade_10_size', 'grade_11_size',
            'grade_12_size', 'multigrade_size_1', 'multigrade_size_2', 'multigrade_size_3',
            'unit3', 'unit3_completed', 'unit3_updated_at'
        ];

        const values = fields.map(f => {
            if (f === 'unit3') return 100;
            if (f === 'unit3_completed') return true;
            if (f === 'unit3_updated_at') return new Date();
            if (f === 'unit3_simplified_counts' && data[f] && typeof data[f] === 'object') {
                return JSON.stringify(data[f]);
            }
            return data[f];
        });

        const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
        const query = `UPDATE ph_schools SET ${setClause} WHERE school_id = $${fields.length + 1} OR iern = $${fields.length + 1} RETURNING *`;

        const result = await safeQuery(query, [...values, schoolId]);
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
