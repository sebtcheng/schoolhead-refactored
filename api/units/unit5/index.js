import express from 'express';
import { safeQuery } from '../../utils/db.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// [QUEST] UNIT 5: SHIFTING & MODALITY
// ─────────────────────────────────────────────────────────────────────────────
router.put('/api/ph_schools/unit5/:id', async (req, res) => {
    const schoolId = req.params.id;
    const data = req.body;

    try {
        const fields = [
            'has_standard_shifting', 'adm_mdl', 'adm_odl', 'adm_tvi', 'adm_blended', 'shifting_modality',
            'shift_kinder', 'shift_g1', 'shift_g2', 'shift_g3', 'shift_g4', 'shift_g5', 'shift_g6', 'shift_g7', 'shift_g8', 'shift_g9', 'shift_g10', 'shift_g11', 'shift_g12', 'shift_mg_1', 'shift_mg_2', 'shift_mg_3',
            'mode_kinder', 'mode_g1', 'mode_g2', 'mode_g3', 'mode_g4', 'mode_g5', 'mode_g6', 'mode_g7', 'mode_g8', 'mode_g9', 'mode_g10', 'mode_g11', 'mode_g12', 'mode_mg_1', 'mode_mg_2', 'mode_mg_3',
            'unit5', 'unit5_completed', 'unit5_updated_at'
        ];

        const values = fields.map(f => {
            if (f === 'unit5') return 100;
            if (f === 'unit5_completed') return true;
            if (f === 'unit5_updated_at') return new Date();
            return data[f];
        });

        const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
        const query = `UPDATE ph_schools SET ${setClause} WHERE school_id = $${fields.length + 1} OR iern = $${fields.length + 1} RETURNING *`;

        const result = await safeQuery(query, [...values, schoolId]);
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export { router as unit5Router };
export default router;
