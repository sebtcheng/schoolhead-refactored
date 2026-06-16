const { Pool } = require('pg');
const staging = new Pool({ connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging' });
const prod    = new Pool({ connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd' });

const DDL = `
  DROP TABLE IF EXISTS unit9_safety;

  CREATE TABLE unit9_safety (
    school_id TEXT PRIMARY KEY,
    iern TEXT,

    -- Page 1: General Power Info
    u9_main_power_source TEXT,
    u9_active_meters INTEGER,
    u9_wiring_age TEXT,
    u9_last_inspection_year TEXT,
    u9_panel_clear TEXT,
    u9_panel_labeled TEXT,
    u9_panel_locked TEXT,

    -- Page 2: Fixed Wiring & Lights (yes/no/n/a)
    u9_lights_working_chk TEXT,
    u9_outlet_covers_unbroken TEXT,
    u9_child_safety_covered TEXT,
    u9_water_splash_safe TEXT,
    u9_bare_wires_visible TEXT,
    u9_enough_outlets TEXT,

    -- Page 3: Cords, Appliances & CCTV (yes/no/n/a)
    u9_ext_cord_temp_only TEXT,
    u9_no_trip_hazards TEXT,
    u9_appliance_cords_good TEXT,
    u9_plugs_feel_cool TEXT,
    u9_cctv_recording_clear TEXT,
    u9_dvr_room_cool_locked TEXT,
    u9_cctv_wires_protected TEXT,

    -- Page 4: Safety Booleans
    u9_fire_exit_exists BOOLEAN DEFAULT FALSE,
    u9_backup_light_exists BOOLEAN DEFAULT FALSE,
    u9_ecart_load_ready BOOLEAN DEFAULT FALSE,
    u9_has_surge_protection BOOLEAN DEFAULT FALSE,
    u9_remarks TEXT,

    -- Equipment Inventory (Security) - all INTEGER counts
    u9_cctv_working INTEGER DEFAULT 0,
    u9_cctv_broken INTEGER DEFAULT 0,
    u9_cctv_spares INTEGER DEFAULT 0,
    u9_fire_ext_working INTEGER DEFAULT 0,
    u9_fire_ext_broken INTEGER DEFAULT 0,
    u9_fire_ext_spares INTEGER DEFAULT 0,
    u9_first_aid_working INTEGER DEFAULT 0,
    u9_first_aid_broken INTEGER DEFAULT 0,
    u9_first_aid_spares INTEGER DEFAULT 0,
    u9_bullhorns_working INTEGER DEFAULT 0,
    u9_bullhorns_broken INTEGER DEFAULT 0,
    u9_bullhorns_spares INTEGER DEFAULT 0,
    u9_radios_working INTEGER DEFAULT 0,
    u9_radios_broken INTEGER DEFAULT 0,
    u9_radios_spares INTEGER DEFAULT 0,
    u9_flashlight_working INTEGER DEFAULT 0,
    u9_flashlight_broken INTEGER DEFAULT 0,
    u9_flashlight_spares INTEGER DEFAULT 0,
    u9_whistles_quantity INTEGER DEFAULT 0,

    -- Equipment Inventory (Electrical) - all INTEGER counts
    u9_bulbs_working INTEGER DEFAULT 0,
    u9_bulbs_broken INTEGER DEFAULT 0,
    u9_bulbs_spares INTEGER DEFAULT 0,
    u9_covers_working INTEGER DEFAULT 0,
    u9_covers_broken INTEGER DEFAULT 0,
    u9_covers_spares INTEGER DEFAULT 0,
    u9_breakers_working INTEGER DEFAULT 0,
    u9_breakers_broken INTEGER DEFAULT 0,
    u9_breakers_spares INTEGER DEFAULT 0,
    u9_ext_cords_working INTEGER DEFAULT 0,
    u9_ext_cords_broken INTEGER DEFAULT 0,
    u9_ext_cords_spares INTEGER DEFAULT 0,
    u9_tape_quantity INTEGER DEFAULT 0,

    -- Status
    unit9 INTEGER DEFAULT 0,
    unit9_completed BOOLEAN DEFAULT FALSE,
    unit9_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

async function create(pool, label) {
  try {
    await pool.query(DDL);
    const r = await pool.query(`SELECT count(*) FROM unit9_safety`);
    console.log(`✅ [${label}] unit9_safety recreated — ${r.rows[0].count} rows`);
  } catch (err) {
    console.error(`❌ [${label}] Error:`, err.message);
  } finally {
    await pool.end();
  }
}

Promise.all([
  create(staging, 'STAGING'),
  create(prod,    'PRODUCTION'),
]);
