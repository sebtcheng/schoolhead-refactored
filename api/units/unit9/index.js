import express from 'express';
import { pool, safeQuery, updateSchoolTotalCompletion } from '../../utils/db.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// [QUEST] UNIT 9: INFRASTRUCTURE & SAFETY
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/ph_schools/unit9/:id
router.get('/api/ph_schools/unit9/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await safeQuery('SELECT * FROM ph_schools WHERE school_id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'School not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(`❌ [API] GET /api/ph_schools/unit9/${req.params.id} ERROR:`, {
        message: err.message,
        stack: err.stack,
        pool: { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount }
    });
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// PUT /api/ph_schools/unit9/:id
router.put('/api/ph_schools/unit9/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    
    const toBool = (v) => {
        if (v === 1 || v === true || v === 'true' || v === '1') return true;
        if (v === 0 || v === false || v === 'false' || v === '0') return false;
        return null; 
    };

    await safeQuery(
      `UPDATE ph_schools SET
       unit9 = 100, unit9_completed = TRUE, unit9_updated_at = CURRENT_TIMESTAMP,
       u9_general = $1, u9_wiring = $2, u9_cords_cctv = $3, u9_final = $4,
       u9_fire_exit_exists = $5, u9_backup_light_exists = $6, u9_ecart_load_ready = $7,
       u9_has_surge_protection = $8, u9_remarks = $9,
       u9_cctv_working = $10, u9_cctv_broken = $11, u9_cctv_spares = $12,
       u9_fire_ext_working = $13, u9_fire_ext_broken = $14, u9_fire_ext_spares = $15,
       u9_first_aid_working = $16, u9_first_aid_broken = $17, u9_first_aid_spares = $18,
       u9_bullhorns_working = $19, u9_bullhorns_broken = $20, u9_bullhorns_spares = $21,
       u9_radios_working = $22, u9_radios_broken = $23, u9_radios_spares = $24,
       u9_flashlight_working = $25, u9_flashlight_broken = $26, u9_flashlight_spares = $27,
       u9_whistles_quantity = $28, u9_bulbs_working = $29, u9_bulbs_broken = $30,
       u9_bulbs_spares = $31, u9_covers_working = $32, u9_covers_broken = $33,
       u9_covers_spares = $34, u9_breakers_working = $35, u9_breakers_broken = $36,
       u9_breakers_spares = $37, u9_ext_cords_working = $38, u9_ext_cords_broken = $39,
       u9_ext_cords_spares = $40, u9_tape_quantity = $41
       WHERE school_id = $42`,
      [
        body.u9_general, body.u9_wiring, body.u9_cords_cctv, body.u9_final,
        toBool(body.u9_fire_exit_exists), toBool(body.u9_backup_light_exists), toBool(body.u9_ecart_load_ready),
        toBool(body.u9_has_surge_protection), body.u9_remarks,
        body.u9_cctv_working, body.u9_cctv_broken, body.u9_cctv_spares,
        body.u9_fire_ext_working, body.u9_fire_ext_broken, body.u9_fire_ext_spares,
        body.u9_first_aid_working, body.u9_first_aid_broken, body.u9_first_aid_spares,
        body.u9_bullhorns_working, body.u9_bullhorns_broken, body.u9_bullhorns_spares,
        body.u9_radios_working, body.u9_radios_broken, body.u9_radios_spares,
        body.u9_flashlight_working, body.u9_flashlight_broken, body.u9_flashlight_spares,
        body.u9_whistles_quantity, body.u9_bulbs_working, body.u9_bulbs_broken,
        body.u9_bulbs_spares, body.u9_covers_working, body.u9_covers_broken,
        body.u9_covers_spares, body.u9_breakers_working, body.u9_breakers_broken,
        body.u9_breakers_spares, body.u9_ext_cords_working, body.u9_ext_cords_broken,
        body.u9_ext_cords_spares, body.u9_tape_quantity, id
      ]
    );

    const schoolRes = await safeQuery('SELECT iern FROM ph_schools WHERE school_id = $1', [id]);
    if (schoolRes.rowCount > 0) {
        await updateSchoolTotalCompletion(schoolRes.rows[0].iern).catch(() => {});
    }
    res.json({ success: true, message: 'Unit 9 data updated successfully' });
  } catch (err) {
    console.error(`❌ [API] PUT /api/ph_schools/unit9/${req.params.id} ERROR:`, {
        message: err.message,
        stack: err.stack,
        payload: req.body,
        pool: { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount }
    });
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

export { router as unit9Router };
export default router;
