const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('--- Phase 1: Add Profile Columns to MASTERLIST ---');

    // Personal Info
    await client.query(`ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS last_name TEXT;`);
    await client.query(`ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS first_name TEXT;`);
    await client.query(`ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS middle_name TEXT;`);
    await client.query(`ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS suffix TEXT;`);
    await client.query(`ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS gender TEXT;`);
    await client.query(`ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS date_of_birth DATE;`);
    await client.query(`ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS age SMALLINT;`);
    await client.query(`ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS civil_status TEXT;`);

    // Appointment Details
    await client.query(`ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS position_title TEXT;`);
    await client.query(`ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS appointment_date DATE;`);

    // Eligibility
    await client.query(`ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS emt_passer BOOLEAN;`);
    await client.query(`ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS emt_date DATE;`);
    await client.query(`ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS ces_stage TEXT;`);
    await client.query(`ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS ces_conferment_date DATE;`);

    // Managerial Experience
    await client.query(`ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS total_years_third_level NUMERIC(5,2);`);

    // Contact Addendum
    await client.query(`ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS permanent_address TEXT;`);

    // Educational Attainment
    await client.query(`ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS highest_education TEXT;`);
    await client.query(`ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS education_program TEXT;`);
    await client.query(`ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS education_year_graduated SMALLINT;`);

    // Performance and Recognition
    await client.query(`ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS notable_achievements TEXT;`);
    await client.query(`ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS performance_rating_ipcrf TEXT;`);
    await client.query(`ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS performance_rating_cespes TEXT;`);

    // Documents (UUID refs to unified_binaries)
    await client.query(`ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS photo_binary_id UUID;`);
    await client.query(`ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS pds_binary_id UUID;`);
    await client.query(`ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS profile_word_binary_id UUID;`);
    await client.query(`ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS profile_ppt_binary_id UUID;`);
    await client.query(`ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS service_records_binary_id UUID;`);

    // Legal Status
    await client.query(`ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS pending_admin_case TEXT;`);
    await client.query(`ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS ombudsman_case TEXT;`);

    console.log('✅ Masterlist columns added.');

    console.log('--- Phase 2: Add Profile Columns to UPDATES (ledger) ---');

    // Personal Info
    await client.query(`ALTER TABLE third_level_officials_updates ADD COLUMN IF NOT EXISTS last_name TEXT;`);
    await client.query(`ALTER TABLE third_level_officials_updates ADD COLUMN IF NOT EXISTS first_name TEXT;`);
    await client.query(`ALTER TABLE third_level_officials_updates ADD COLUMN IF NOT EXISTS middle_name TEXT;`);
    await client.query(`ALTER TABLE third_level_officials_updates ADD COLUMN IF NOT EXISTS suffix TEXT;`);
    await client.query(`ALTER TABLE third_level_officials_updates ADD COLUMN IF NOT EXISTS gender TEXT;`);
    await client.query(`ALTER TABLE third_level_officials_updates ADD COLUMN IF NOT EXISTS date_of_birth DATE;`);
    await client.query(`ALTER TABLE third_level_officials_updates ADD COLUMN IF NOT EXISTS age SMALLINT;`);
    await client.query(`ALTER TABLE third_level_officials_updates ADD COLUMN IF NOT EXISTS civil_status TEXT;`);

    // Appointment Details
    await client.query(`ALTER TABLE third_level_officials_updates ADD COLUMN IF NOT EXISTS position_title TEXT;`);
    await client.query(`ALTER TABLE third_level_officials_updates ADD COLUMN IF NOT EXISTS appointment_date DATE;`);

    // Eligibility
    await client.query(`ALTER TABLE third_level_officials_updates ADD COLUMN IF NOT EXISTS emt_passer BOOLEAN;`);
    await client.query(`ALTER TABLE third_level_officials_updates ADD COLUMN IF NOT EXISTS emt_date DATE;`);
    await client.query(`ALTER TABLE third_level_officials_updates ADD COLUMN IF NOT EXISTS ces_stage TEXT;`);
    await client.query(`ALTER TABLE third_level_officials_updates ADD COLUMN IF NOT EXISTS ces_conferment_date DATE;`);

    // Experience
    await client.query(`ALTER TABLE third_level_officials_updates ADD COLUMN IF NOT EXISTS total_years_third_level NUMERIC(5,2);`);

    // Contact Addendum
    await client.query(`ALTER TABLE third_level_officials_updates ADD COLUMN IF NOT EXISTS permanent_address TEXT;`);

    // Educational Attainment
    await client.query(`ALTER TABLE third_level_officials_updates ADD COLUMN IF NOT EXISTS highest_education TEXT;`);
    await client.query(`ALTER TABLE third_level_officials_updates ADD COLUMN IF NOT EXISTS education_program TEXT;`);
    await client.query(`ALTER TABLE third_level_officials_updates ADD COLUMN IF NOT EXISTS education_year_graduated SMALLINT;`);

    // Performance
    await client.query(`ALTER TABLE third_level_officials_updates ADD COLUMN IF NOT EXISTS notable_achievements TEXT;`);
    await client.query(`ALTER TABLE third_level_officials_updates ADD COLUMN IF NOT EXISTS performance_rating_ipcrf TEXT;`);
    await client.query(`ALTER TABLE third_level_officials_updates ADD COLUMN IF NOT EXISTS performance_rating_cespes TEXT;`);

    console.log('✅ Updates ledger columns added.');

    console.log('--- Phase 3: Create Sub-Tables ---');

    await client.query(`
      CREATE TABLE IF NOT EXISTS third_level_officials_prev_positions (
        position_id   SERIAL PRIMARY KEY,
        tlid          TEXT NOT NULL REFERENCES third_level_officials_masterlist(tlid) ON DELETE CASCADE,
        position_name TEXT NOT NULL,
        office        TEXT,
        start_date    DATE,
        end_date      DATE,
        is_oic        BOOLEAN DEFAULT FALSE,
        sort_order    INTEGER DEFAULT 0
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tlpp_tlid ON third_level_officials_prev_positions(tlid);`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS third_level_officials_trainings (
        training_id    SERIAL PRIMARY KEY,
        tlid           TEXT NOT NULL REFERENCES third_level_officials_masterlist(tlid) ON DELETE CASCADE,
        training_name  TEXT NOT NULL,
        date_completed DATE,
        sort_order     INTEGER DEFAULT 0
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tltr_tlid ON third_level_officials_trainings(tlid);`);

    console.log('✅ Sub-tables created.');

    await client.query('COMMIT');
    console.log('\n✅ TLM Profile Column Migration completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed — rolled back:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
