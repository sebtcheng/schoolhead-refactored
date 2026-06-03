import express from 'express';
import { pool } from '../../utils/db.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// [QUEST] UNIT 6: SCHOOL RESOURCES (Wash/ICT)
// ─────────────────────────────────────────────────────────────────────────────
router.put('/api/ph_schools/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { iern, unit7_furniture, unit7_ict, unit7_has_ecart, unit7_ecarts, unit7_wash, unit7_utilities, unit6_completed } = req.body;
    await pool.query(
      `UPDATE ph_schools SET
       iern = COALESCE($1, iern),
       unit7_furniture = $2, unit7_ict = $3, unit7_has_ecart = $4, unit7_ecarts = $5,
       unit7_wash = $6, unit7_utilities = $7, unit6_completed = $8,
       unit6 = 100, unit6_updated_at = CURRENT_TIMESTAMP
       WHERE school_id = $9`,
      [iern, unit7_furniture, unit7_ict, unit7_has_ecart, unit7_ecarts, unit7_wash, unit7_utilities, unit6_completed, id]
    );
    res.json({ success: true, message: 'Unit 6 resources updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export { router as unit6Router };
export default router;
