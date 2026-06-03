import express from 'express';
import { safeQuery } from '../../utils/db.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// [QUEST] UNIT 2: LEARNERS (ENROLLMENT)
// ─────────────────────────────────────────────────────────────────────────────
router.put('/api/ph_schools/unit2/:id', async (req, res) => {
    const schoolId = req.params.id;
    const data = req.body;

    try {
        const fields = [
            'total_enrollment', 'male_enrollment', 'female_enrollment', 'total_male', 'total_female',
            'kinder_male', 'kinder_female', 'g1_male', 'g1_female', 'g2_male', 'g2_female',
            'g3_male', 'g3_female', 'g4_male', 'g4_female', 'g5_male', 'g5_female',
            'g6_male', 'g6_female', 'g7_male', 'g7_female', 'g8_male', 'g8_female',
            'g9_male', 'g9_female', 'g10_male', 'g10_female', 'g11_male', 'g11_female',
            'g12_male', 'g12_female', 'sned_male', 'sned_female', 'sned_self_contained_count',
            'unit2_simplified_enrollment', 'multigrade_groupings_1', 'multigrade_groupings_2',
            'multigrade_groupings_3', 'multigrade_enrollment_1', 'multigrade_enrollment_2',
            'multigrade_enrollment_3', 'unit2', 'unit2_completed', 'unit2_updated_at'
        ];

        const values = fields.map(f => {
            if (f === 'unit2') return 100;
            if (f === 'unit2_completed') return true;
            if (f === 'unit2_updated_at') return new Date();
            return data[f];
        });

        const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
        const query = `UPDATE ph_schools SET ${setClause} WHERE school_id = $${fields.length + 1} OR iern = $${fields.length + 1} RETURNING *`;

        const result = await safeQuery(query, [...values, schoolId]);
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error("Unit 2 Update Error:", err);
        res.status(500).json({ error: err.message });
    }
});

export { router as unit2Router };
export default router;
