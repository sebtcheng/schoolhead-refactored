const { Pool } = require('pg');
const staging = new Pool({ connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging' });
const prod    = new Pool({ connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd' });

const DDL = `
  CREATE TABLE IF NOT EXISTS unit9_safety (
    school_id TEXT PRIMARY KEY,
    iern TEXT,
    u9_general INTEGER,
    u9_wiring INTEGER,
    u9_cords_cctv INTEGER,
    u9_final INTEGER,
    u9_fire_exit_exists BOOLEAN DEFAULT FALSE,
    u9_backup_light_exists BOOLEAN DEFAULT FALSE,
    u9_ecart_load_ready BOOLEAN DEFAULT FALSE,
    u9_has_surge_protection BOOLEAN DEFAULT FALSE,
    u9_remarks TEXT,
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
    unit9 INTEGER DEFAULT 0,
    unit9_completed BOOLEAN DEFAULT FALSE,
    unit9_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

const ENSURE = `
  ALTER TABLE unit9_safety ADD COLUMN IF NOT EXISTS unit9 INTEGER DEFAULT 0;
  ALTER TABLE unit9_safety ADD COLUMN IF NOT EXISTS unit9_completed BOOLEAN DEFAULT FALSE;
  ALTER TABLE unit9_safety ADD COLUMN IF NOT EXISTS unit9_updated_at TIMESTAMPTZ;
  ALTER TABLE unit9_safety ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
  ALTER TABLE unit9_safety ADD COLUMN IF NOT EXISTS iern TEXT;
`;

async function create(pool, label) {
  try {
    await pool.query(DDL);
    await pool.query(ENSURE);
    const r = await pool.query(`SELECT count(*) FROM unit9_safety`);
    console.log(`✅ [${label}] unit9_safety created — ${r.rows[0].count} rows`);
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
