import express from 'express';
import { safeQuery } from '@shared/db';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// [QUEST] UNIT 4: LEARNER PROFILE
// ─────────────────────────────────────────────────────────────────────────────
router.put('/api/ph_schools/unit4/:id', async (req, res) => {
    const schoolId = req.params.id;
    const data = req.body;

    try {
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
            'selected_learner_groups', 'bmi_severely_wasted', 'bmi_wasted', 'bmi_overweight_obese', 'bmi_normal',
            'als_kinder', 'als_g1', 'als_g2', 'als_g3', 'als_g4', 'als_g5', 'als_g6', 'als_g7', 'als_g8', 'als_g9', 'als_g10', 'als_g11', 'als_g12', 'als_total',
            'fourps_kinder', 'fourps_g1', 'fourps_g2', 'fourps_g3', 'fourps_g4', 'fourps_g5', 'fourps_g6', 'fourps_g7', 'fourps_g8', 'fourps_g9', 'fourps_g10', 'fourps_g11', 'fourps_g12',
            'muslim_kinder', 'muslim_g1', 'muslim_g2', 'muslim_g3', 'muslim_g4', 'muslim_g5', 'muslim_g6', 'muslim_g7', 'muslim_g8', 'muslim_g9', 'muslim_g10', 'muslim_g11', 'muslim_g12',
            'ip_kinder', 'ip_g1', 'ip_g2', 'ip_g3', 'ip_g4', 'ip_g5', 'ip_g6', 'ip_g7', 'ip_g8', 'ip_g9', 'ip_g10', 'ip_g11', 'ip_g12',
            'displaced_kinder', 'displaced_g1', 'displaced_g2', 'displaced_g3', 'displaced_g4', 'displaced_g5', 'displaced_g6', 'displaced_g7', 'displaced_g8', 'displaced_g9', 'displaced_g10', 'displaced_g11', 'displaced_g12',
            'overage_kinder', 'overage_g1', 'overage_g2', 'overage_g3', 'overage_g4', 'overage_g5', 'overage_g6', 'overage_g7', 'overage_g8', 'overage_g9', 'overage_g10', 'overage_g11', 'overage_g12',
            'dropout_kinder', 'dropout_g1', 'dropout_g2', 'dropout_g3', 'dropout_g4', 'dropout_g5', 'dropout_g6', 'dropout_g7', 'dropout_g8', 'dropout_g9', 'dropout_g10', 'dropout_g11', 'dropout_g12',
            'repeater_kinder', 'repeater_g1', 'repeater_g2', 'repeater_g3', 'repeater_g4', 'repeater_g5', 'repeater_g6', 'repeater_g7', 'repeater_g8', 'repeater_g9', 'repeater_g10', 'repeater_g11', 'repeater_g12',
            'lwd_kinder', 'lwd_g1', 'lwd_g2', 'lwd_g3', 'lwd_g4', 'lwd_g5', 'lwd_g6', 'lwd_g7', 'lwd_g8', 'lwd_g9', 'lwd_g10', 'lwd_g11', 'lwd_g12',
            'sned_kinder', 'sned_g1', 'sned_g2', 'sned_g3', 'sned_g4', 'sned_g5', 'sned_g6', 'sned_g7', 'sned_g8', 'sned_g9', 'sned_g10', 'sned_g11', 'sned_g12',
            'unit4', 'unit4_completed', 'updated_at'
        ];

        const values = fields.map(f => {
            if (f === 'unit4') return true;
            if (f === 'unit4_completed') return 100.00;
            if (f === 'updated_at') return new Date();
            if (f === 'selected_learner_groups' && data[f] && typeof data[f] === 'object') {
                return JSON.stringify(data[f]);
            }
            return data[f] !== undefined ? data[f] : null;
        });

        const school_yr = data.school_yr || 'SY 26-27';

        const colList = ['iern', 'school_id', 'school_yr', ...fields].join(', ');
        const valPlaceholders = ['iern', 'school_id', 'school_yr', ...fields].map((_, i) => `$${i + 1}`).join(', ');
        const updateClause = fields.map((f, i) => `${f} = $${i + 4}`).join(', ');

        const query = `
            INSERT INTO unit4_learner_profile (${colList})
            VALUES (${valPlaceholders})
            ON CONFLICT (iern, school_yr) DO UPDATE SET ${updateClause}
            RETURNING *
        `;

        const result = await safeQuery(query, [iern, school_id, school_yr, ...values]);
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error("❌ [API] Unit 4 Update Error:", {
            message: err.message,
            stack: err.stack,
            schoolId: schoolId,
            payloadKeys: Object.keys(data || {})
        });
        res.status(500).json({ error: err.message, detail: "JSON syntax error or data mismatch in Unit 4 profile" });
    }
});

export { router as unit4Router };
export default router;
