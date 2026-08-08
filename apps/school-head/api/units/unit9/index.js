import express from 'express';
import { pool, safeQuery } from '@shared/db';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// [QUEST] UNIT 9: INFRASTRUCTURE & SAFETY
// Table: unit9_safety (64 flat columns)
// Checklist answers stored as: "yes" | "no" | "n/a"
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/ph_schools/unit9/:id
router.get('/api/ph_schools/unit9/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const schoolYr = req.query.school_yr || 'SY 26-27';

    const result = await safeQuery(
      'SELECT * FROM unit9_safety WHERE school_id = $1 AND school_yr = $2', [id, schoolYr]
    );
    const schoolRes = await safeQuery(
      `SELECT ps.*, u1.school_name, u1.region, u1.province, u1.municipality,
              u1.barangay, u1.division, u1.district, u1.leg_district
       FROM ph_schools ps
       LEFT JOIN unit1_school_identity u1 ON ps.iern = u1.iern AND u1.school_yr = $2
       WHERE ps.school_id = $1 OR ps.iern = $1`,
      [id, schoolYr]
    );

    if (schoolRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'School not found' });
    }

    const schoolMeta = schoolRes.rows[0];
    const unit9Data  = result.rows[0] || null;

    res.json({
      success: true,
      data: {
        ...schoolMeta,
        ...(unit9Data || {}),
        unit9:           unit9Data?.unit9           ?? schoolMeta.unit9,
        unit9_completed: unit9Data?.unit9_completed ?? schoolMeta.unit9_completed,
      }
    });
  } catch (err) {
    console.error(`❌ [API] GET /api/ph_schools/unit9/${req.params.id} ERROR:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/ph_schools/unit9/:id
router.put('/api/ph_schools/unit9/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    const schoolYr = body.school_yr || 'SY 26-27';

    // Integer count fields
    const toInt = (v) => { const n = parseInt(v); return isNaN(n) ? null : n; };

    // Boolean fields (fire exit, backup lights, etc.)
    const toBool = (v) => {
      if (v === 1 || v === true  || v === 'true'  || v === '1') return true;
      if (v === 0 || v === false || v === 'false' || v === '0') return false;
      return null;
    };

    // YesNoToggle sends: 0 = No, 1 = Yes, 2 = N/A
    const toYesNo = (v) => {
      if (v === 1  || v === 'yes') return 'yes';
      if (v === 0  || v === 'no')  return 'no';
      if (v === 2  || v === 'n/a') return 'n/a';
      return null;
    };

    // Parse the three JSON blobs from the frontend into flat fields
    const g = typeof body.u9_general    === 'string' ? JSON.parse(body.u9_general)    : (body.u9_general    || {});
    const w = typeof body.u9_wiring     === 'string' ? JSON.parse(body.u9_wiring)     : (body.u9_wiring     || {});
    const c = typeof body.u9_cords_cctv === 'string' ? JSON.parse(body.u9_cords_cctv) : (body.u9_cords_cctv || {});

    // ── 1. VALIDATION LOCK CHECK & HYBRID JSONB UPSERT ──────────────────────
    const resolvedIern = iern || id;
    const checkLock = await safeQuery(
      'SELECT validation_status, validation_remarks FROM ph_school_unit_submissions WHERE iern = $1 AND unit_number = 9',
      [resolvedIern]
    );
    if (checkLock.rows[0]?.validation_status === 'validated') {
      return res.status(403).json({ error: 'This module is validated and locked.' });
    }

    const currentStatus = checkLock.rows[0]?.validation_status || 'draft';
    const isResubmission = ['returned', 'rejected'].includes(currentStatus);
    const nextStatus = isResubmission ? 'submitted' : (body.is_completed !== false ? 'submitted' : 'draft');
    const nextRemarks = isResubmission ? null : (checkLock.rows[0]?.validation_remarks || null);

    await safeQuery(`
      INSERT INTO ph_school_unit_submissions 
        (iern, unit_number, payload, is_completed, validation_status, validation_remarks, submitted_at, updated_at)
      VALUES ($1, 9, $2, TRUE, $3, $4, NOW(), NOW())
      ON CONFLICT (iern, unit_number) DO UPDATE SET
        payload = EXCLUDED.payload,
        is_completed = TRUE,
        validation_status = EXCLUDED.validation_status,
        validation_remarks = EXCLUDED.validation_remarks,
        submitted_at = NOW(),
        updated_at = NOW()
    `, [resolvedIern, JSON.stringify(body), nextStatus, nextRemarks]);

    // ── $1–$59 parameterized + 4 hardcoded = 63 columns ──
    const values = [
      // $1–$2: identifiers
      id,   iern,

      // $3–$9: Page 1 — General power info (from u9_general blob)
      g.main_power_source   || null,                                    // $3  TEXT
      toInt(g.active_meters),                                           // $4  INTEGER
      g.wiring_age          || null,                                    // $5  TEXT
      g.last_inspection_year ? String(g.last_inspection_year) : null,  // $6  TEXT
      toYesNo(g.panel_clear),                                           // $7  TEXT yes/no/n/a
      toYesNo(g.panel_labeled),                                         // $8  TEXT yes/no/n/a
      toYesNo(g.panel_locked),                                          // $9  TEXT yes/no/n/a

      // $10–$15: Page 2 — Fixed wiring & lights (from u9_wiring blob)
      toYesNo(w.lights_working),                                        // $10 TEXT yes/no/n/a
      toYesNo(w.outlet_covers_unbroken),                                // $11
      toYesNo(w.child_safety_covered),                                  // $12
      toYesNo(w.water_splash_safe),                                     // $13
      toYesNo(w.bare_wires_visible),                                    // $14
      toYesNo(w.enough_outlets),                                        // $15

      // $16–$22: Page 3 — Cords, appliances & CCTV (from u9_cords_cctv blob)
      toYesNo(c.ext_cord_temp_only),                                    // $16
      toYesNo(c.no_trip_hazards),                                       // $17
      toYesNo(c.appliance_cords_good),                                  // $18
      toYesNo(c.plugs_feel_cool),                                       // $19
      toYesNo(c.cctv_recording_clear),                                  // $20
      toYesNo(c.dvr_room_cool_locked),                                  // $21
      toYesNo(c.cctv_wires_protected),                                  // $22

      // $23–$27: Page 4 — Safety booleans & remarks
      toBool(body.u9_fire_exit_exists),                                 // $23 BOOLEAN
      toBool(body.u9_backup_light_exists),                              // $24
      toBool(body.u9_ecart_load_ready),                                 // $25
      toBool(body.u9_has_surge_protection),                             // $26
      body.u9_remarks || null,                                          // $27 TEXT

      // $28–$46: Equipment inventory — Security counts
      toInt(body.u9_cctv_working),          // $28
      toInt(body.u9_cctv_broken),           // $29
      toInt(body.u9_cctv_spares),           // $30
      toInt(body.u9_fire_ext_working),      // $31
      toInt(body.u9_fire_ext_broken),       // $32
      toInt(body.u9_fire_ext_spares),       // $33
      toInt(body.u9_first_aid_working),     // $34
      toInt(body.u9_first_aid_broken),      // $35
      toInt(body.u9_first_aid_spares),      // $36
      toInt(body.u9_bullhorns_working),     // $37
      toInt(body.u9_bullhorns_broken),      // $38
      toInt(body.u9_bullhorns_spares),      // $39
      toInt(body.u9_radios_working),        // $40
      toInt(body.u9_radios_broken),         // $41
      toInt(body.u9_radios_spares),         // $42
      toInt(body.u9_flashlight_working),    // $43
      toInt(body.u9_flashlight_broken),     // $44
      toInt(body.u9_flashlight_spares),     // $45
      toInt(body.u9_whistles_quantity),     // $46

      // $47–$59: Equipment inventory — Electrical counts
      toInt(body.u9_bulbs_working),         // $47
      toInt(body.u9_bulbs_broken),          // $48
      toInt(body.u9_bulbs_spares),          // $49
      toInt(body.u9_covers_working),        // $50
      toInt(body.u9_covers_broken),         // $51
      toInt(body.u9_covers_spares),         // $52
      toInt(body.u9_breakers_working),      // $53
      toInt(body.u9_breakers_broken),       // $54
      toInt(body.u9_breakers_spares),       // $55
      toInt(body.u9_ext_cords_working),     // $56
      toInt(body.u9_ext_cords_broken),      // $57
      toInt(body.u9_ext_cords_spares),      // $58
      toInt(c.tape_quantity),               // $59
      schoolYr                              // $60
    ];

    await safeQuery(
      `INSERT INTO unit9_safety (
        school_id, iern,
        u9_main_power_source, u9_active_meters, u9_wiring_age, u9_last_inspection_year,
        u9_panel_clear, u9_panel_labeled, u9_panel_locked,
        u9_lights_working_chk, u9_outlet_covers_unbroken, u9_child_safety_covered,
        u9_water_splash_safe, u9_bare_wires_visible, u9_enough_outlets,
        u9_ext_cord_temp_only, u9_no_trip_hazards, u9_appliance_cords_good,
        u9_plugs_feel_cool, u9_cctv_recording_clear, u9_dvr_room_cool_locked, u9_cctv_wires_protected,
        u9_fire_exit_exists, u9_backup_light_exists, u9_ecart_load_ready,
        u9_has_surge_protection, u9_remarks,
        u9_cctv_working, u9_cctv_broken, u9_cctv_spares,
        u9_fire_ext_working, u9_fire_ext_broken, u9_fire_ext_spares,
        u9_first_aid_working, u9_first_aid_broken, u9_first_aid_spares,
        u9_bullhorns_working, u9_bullhorns_broken, u9_bullhorns_spares,
        u9_radios_working, u9_radios_broken, u9_radios_spares,
        u9_flashlight_working, u9_flashlight_broken, u9_flashlight_spares,
        u9_whistles_quantity,
        u9_bulbs_working, u9_bulbs_broken, u9_bulbs_spares,
        u9_covers_working, u9_covers_broken, u9_covers_spares,
        u9_breakers_working, u9_breakers_broken, u9_breakers_spares,
        u9_ext_cords_working, u9_ext_cords_broken, u9_ext_cords_spares,
        u9_tape_quantity, school_yr,
        unit9, unit9_completed, unit9_updated_at, updated_at
      ) VALUES (
        $1,  $2,
        $3,  $4,  $5,  $6,  $7,  $8,  $9,
        $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22,
        $23, $24, $25, $26, $27,
        $28, $29, $30, $31, $32, $33,
        $34, $35, $36, $37, $38, $39,
        $40, $41, $42, $43, $44, $45,
        $46,
        $47, $48, $49, $50, $51, $52,
        $53, $54, $55, $56, $57, $58,
        $59, $60,
        100, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT (school_id, school_yr) DO UPDATE SET
        iern                      = EXCLUDED.iern,
        u9_main_power_source      = EXCLUDED.u9_main_power_source,
        u9_active_meters          = EXCLUDED.u9_active_meters,
        u9_wiring_age             = EXCLUDED.u9_wiring_age,
        u9_last_inspection_year   = EXCLUDED.u9_last_inspection_year,
        u9_panel_clear            = EXCLUDED.u9_panel_clear,
        u9_panel_labeled          = EXCLUDED.u9_panel_labeled,
        u9_panel_locked           = EXCLUDED.u9_panel_locked,
        u9_lights_working_chk     = EXCLUDED.u9_lights_working_chk,
        u9_outlet_covers_unbroken = EXCLUDED.u9_outlet_covers_unbroken,
        u9_child_safety_covered   = EXCLUDED.u9_child_safety_covered,
        u9_water_splash_safe      = EXCLUDED.u9_water_splash_safe,
        u9_bare_wires_visible     = EXCLUDED.u9_bare_wires_visible,
        u9_enough_outlets         = EXCLUDED.u9_enough_outlets,
        u9_ext_cord_temp_only     = EXCLUDED.u9_ext_cord_temp_only,
        u9_no_trip_hazards        = EXCLUDED.u9_no_trip_hazards,
        u9_appliance_cords_good   = EXCLUDED.u9_appliance_cords_good,
        u9_plugs_feel_cool        = EXCLUDED.u9_plugs_feel_cool,
        u9_cctv_recording_clear   = EXCLUDED.u9_cctv_recording_clear,
        u9_dvr_room_cool_locked   = EXCLUDED.u9_dvr_room_cool_locked,
        u9_cctv_wires_protected   = EXCLUDED.u9_cctv_wires_protected,
        u9_fire_exit_exists       = EXCLUDED.u9_fire_exit_exists,
        u9_backup_light_exists    = EXCLUDED.u9_backup_light_exists,
        u9_ecart_load_ready       = EXCLUDED.u9_ecart_load_ready,
        u9_has_surge_protection   = EXCLUDED.u9_has_surge_protection,
        u9_remarks                = EXCLUDED.u9_remarks,
        u9_cctv_working           = EXCLUDED.u9_cctv_working,
        u9_cctv_broken            = EXCLUDED.u9_cctv_broken,
        u9_cctv_spares            = EXCLUDED.u9_cctv_spares,
        u9_fire_ext_working       = EXCLUDED.u9_fire_ext_working,
        u9_fire_ext_broken        = EXCLUDED.u9_fire_ext_broken,
        u9_fire_ext_spares        = EXCLUDED.u9_fire_ext_spares,
        u9_first_aid_working      = EXCLUDED.u9_first_aid_working,
        u9_first_aid_broken       = EXCLUDED.u9_first_aid_broken,
        u9_first_aid_spares       = EXCLUDED.u9_first_aid_spares,
        u9_bullhorns_working      = EXCLUDED.u9_bullhorns_working,
        u9_bullhorns_broken       = EXCLUDED.u9_bullhorns_broken,
        u9_bullhorns_spares       = EXCLUDED.u9_bullhorns_spares,
        u9_radios_working         = EXCLUDED.u9_radios_working,
        u9_radios_broken          = EXCLUDED.u9_radios_broken,
        u9_radios_spares          = EXCLUDED.u9_radios_spares,
        u9_flashlight_working     = EXCLUDED.u9_flashlight_working,
        u9_flashlight_broken      = EXCLUDED.u9_flashlight_broken,
        u9_flashlight_spares      = EXCLUDED.u9_flashlight_spares,
        u9_whistles_quantity      = EXCLUDED.u9_whistles_quantity,
        u9_bulbs_working          = EXCLUDED.u9_bulbs_working,
        u9_bulbs_broken           = EXCLUDED.u9_bulbs_broken,
        u9_bulbs_spares           = EXCLUDED.u9_bulbs_spares,
        u9_covers_working         = EXCLUDED.u9_covers_working,
        u9_covers_broken          = EXCLUDED.u9_covers_broken,
        u9_covers_spares          = EXCLUDED.u9_covers_spares,
        u9_breakers_working       = EXCLUDED.u9_breakers_working,
        u9_breakers_broken        = EXCLUDED.u9_breakers_broken,
        u9_breakers_spares        = EXCLUDED.u9_breakers_spares,
        u9_ext_cords_working      = EXCLUDED.u9_ext_cords_working,
        u9_ext_cords_broken       = EXCLUDED.u9_ext_cords_broken,
        u9_ext_cords_spares       = EXCLUDED.u9_ext_cords_spares,
        u9_tape_quantity          = EXCLUDED.u9_tape_quantity,
        unit9                     = 100,
        unit9_completed           = TRUE,
        unit9_updated_at          = CURRENT_TIMESTAMP,
        updated_at                = CURRENT_TIMESTAMP`,
      values
    );



    res.json({ success: true, message: 'Unit 9 data saved successfully' });
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
