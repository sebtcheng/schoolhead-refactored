import express from 'express';
import { pool, safeQuery, updateSchoolTotalCompletion } from '../../utils/db.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// [QUEST] UNIT 8: TERRAIN / SCHOOL LOCATION PROFILE
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/school-location/:id
router.get('/api/school-location/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const schoolYr = req.query.school_yr || 'SY 26-27';
    const result = await safeQuery('SELECT * FROM unit8_location WHERE school_id = $1 AND school_yr = $2', [id, schoolYr]);
    res.json({ success: true, exists: result.rowCount > 0, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/school-location
router.post('/api/school-location', async (req, res) => {
  try {
    const data = req.body;
    const { school_id, iern } = data;

    const school_yr = data.school_yr || 'SY 26-27';

    if (!school_id) return res.status(400).json({ error: "Missing school_id" });

    const query = `
      INSERT INTO unit8_location (
        school_id, iern, transportation_modes, road_paved_pct, road_unpaved_pct,
        road_lighting_pct, public_transpo_availability, water_proximity, near_cliff_ravine,
        road_cliff_pct, near_water, natural_calamities, hazards_experienced,
        has_insurgency_threats, insurgency_threats_6mo, road_passable_public_transpo_pct,
        river_crossing_on_foot, river_crossing_count, emergency_response_mins,
        proximity_hospital_km, proximity_brgy_hall_mins, proximity_brgy_hall_km,
        proximity_muni_hall_mins, proximity_muni_hall_km, proximity_sdo_mins,
        proximity_sdo_km, proximity_clinic_mins, proximity_clinic_km,
        proximity_terminal_mins, proximity_terminal_km, proximity_highway_mins,
        proximity_highway_km, cellular_coverage, weather_isolation,
        weather_isolation_6mo, anthropogenic_threats, school_yr,
        unit8, unit8_completed, unit8_updated_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37,
        100, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT (school_id, school_yr) DO UPDATE SET
        iern = EXCLUDED.iern,
        transportation_modes = EXCLUDED.transportation_modes,
        road_paved_pct = EXCLUDED.road_paved_pct,
        road_unpaved_pct = EXCLUDED.road_unpaved_pct,
        road_lighting_pct = EXCLUDED.road_lighting_pct,
        public_transpo_availability = EXCLUDED.public_transpo_availability,
        water_proximity = EXCLUDED.water_proximity,
        near_cliff_ravine = EXCLUDED.near_cliff_ravine,
        road_cliff_pct = EXCLUDED.road_cliff_pct,
        near_water = EXCLUDED.near_water,
        natural_calamities = EXCLUDED.natural_calamities,
        hazards_experienced = EXCLUDED.hazards_experienced,
        has_insurgency_threats = EXCLUDED.has_insurgency_threats,
        insurgency_threats_6mo = EXCLUDED.insurgency_threats_6mo,
        road_passable_public_transpo_pct = EXCLUDED.road_passable_public_transpo_pct,
        river_crossing_on_foot = EXCLUDED.river_crossing_on_foot,
        river_crossing_count = EXCLUDED.river_crossing_count,
        emergency_response_mins = EXCLUDED.emergency_response_mins,
        proximity_hospital_km = EXCLUDED.proximity_hospital_km,
        proximity_brgy_hall_mins = EXCLUDED.proximity_brgy_hall_mins,
        proximity_brgy_hall_km = EXCLUDED.proximity_brgy_hall_km,
        proximity_muni_hall_mins = EXCLUDED.proximity_muni_hall_mins,
        proximity_muni_hall_km = EXCLUDED.proximity_muni_hall_km,
        proximity_sdo_mins = EXCLUDED.proximity_sdo_mins,
        proximity_sdo_km = EXCLUDED.proximity_sdo_km,
        proximity_clinic_mins = EXCLUDED.proximity_clinic_mins,
        proximity_clinic_km = EXCLUDED.proximity_clinic_km,
        proximity_terminal_mins = EXCLUDED.proximity_terminal_mins,
        proximity_terminal_km = EXCLUDED.proximity_terminal_km,
        proximity_highway_mins = EXCLUDED.proximity_highway_mins,
        proximity_highway_km = EXCLUDED.proximity_highway_km,
        cellular_coverage = EXCLUDED.cellular_coverage,
        weather_isolation = EXCLUDED.weather_isolation,
        weather_isolation_6mo = EXCLUDED.weather_isolation_6mo,
        anthropogenic_threats = EXCLUDED.anthropogenic_threats,
        unit8 = EXCLUDED.unit8,
        unit8_completed = EXCLUDED.unit8_completed,
        unit8_updated_at = EXCLUDED.unit8_updated_at,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const values = [
      school_id, iern,
      JSON.stringify(data.transportation_modes || []),
      parseFloat(data.road_paved_pct) || 0,
      parseFloat(data.road_unpaved_pct) || 0,
      parseFloat(data.road_lighting_pct) || 0,
      parseFloat(data.public_transpo_availability) || 0,
      JSON.stringify(data.water_proximity || []),
      data.near_cliff_ravine === true || data.near_cliff_ravine === 'true',
      parseFloat(data.road_cliff_pct) || 0,
      data.near_water === true || data.near_water === 'true',
      JSON.stringify(data.natural_calamities || []),
      JSON.stringify(data.hazards_experienced || []),
      data.has_insurgency_threats === true || data.has_insurgency_threats === 'true',
      parseFloat(data.insurgency_threats_6mo) || 0,
      parseFloat(data.road_passable_public_transpo_pct) || 0,
      data.river_crossing_on_foot === true || data.river_crossing_on_foot === 'true',
      parseFloat(data.river_crossing_count) || 0,
      parseFloat(data.emergency_response_mins) || 0,
      parseFloat(data.proximity_hospital_km) || 0,
      parseFloat(data.proximity_brgy_hall_mins) || 0,
      parseFloat(data.proximity_brgy_hall_km) || 0,
      parseFloat(data.proximity_muni_hall_mins) || 0,
      parseFloat(data.proximity_muni_hall_km) || 0,
      parseFloat(data.proximity_sdo_mins) || 0,
      parseFloat(data.proximity_sdo_km) || 0,
      parseFloat(data.proximity_clinic_mins) || 0,
      parseFloat(data.proximity_clinic_km) || 0,
      parseFloat(data.proximity_terminal_mins) || 0,
      parseFloat(data.proximity_terminal_km) || 0,
      parseFloat(data.proximity_highway_mins) || 0,
      parseFloat(data.proximity_highway_km) || 0,
      data.cellular_coverage,
      data.weather_isolation === true || data.weather_isolation === 'true',
      parseFloat(data.weather_isolation_6mo) || 0,
      JSON.stringify(data.anthropogenic_threats || []),
      school_yr
    ];

    const result = await safeQuery(query, values);

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("❌ [API] POST /api/school-location ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export { router as unit8Router };
export default router;
