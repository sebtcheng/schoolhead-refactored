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

    console.log('--- Phase 1: Creating third_level_officials_profiles table ---');
    await client.query(`
      CREATE TABLE IF NOT EXISTS third_level_officials_profiles (
        tlid                          TEXT PRIMARY KEY REFERENCES third_level_officials_masterlist(tlid) ON DELETE CASCADE,
        -- Personal Info
        last_name                     TEXT,
        first_name                    TEXT,
        middle_name                   TEXT,
        suffix                        TEXT,
        gender                        TEXT,
        date_of_birth                 DATE,
        age                           SMALLINT,
        civil_status                  TEXT,
        -- Appointment Details
        position_title                TEXT,
        appointment_date              DATE,
        -- Eligibility
        emt_passer                    BOOLEAN,
        emt_date                      DATE,
        ces_stage                     TEXT,
        ces_conferment_date           DATE,
        -- Experience & Lists (Stored as JSONB for simplicity in single table)
        total_years_third_level       NUMERIC(5,2),
        previous_positions            JSONB DEFAULT '[]',
        relevant_trainings            JSONB DEFAULT '[]',
        -- Contact & Education
        permanent_address             TEXT,
        highest_education             TEXT,
        education_program             TEXT,
        education_year_graduated      SMALLINT,
        -- Performance
        notable_achievements          TEXT,
        performance_rating_ipcrf      TEXT,
        performance_rating_cespes     TEXT,
        -- Documents (UUID references to unified_binaries)
        photo_binary_id               UUID,
        pds_binary_id                 UUID,
        profile_word_binary_id        UUID,
        profile_ppt_binary_id         UUID,
        service_records_binary_id     UUID,
        -- Legal Status
        pending_admin_case            TEXT,
        ombudsman_case                TEXT,
        created_at                    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at                    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Profiles table created.');

    console.log('--- Phase 2: Adding profiling snapshot columns to UPDATES table (Ledger) ---');
    // We add the same columns to the updates table so every "Append" captures a full profile snapshot.
    const columns = [
      ['last_name', 'TEXT'],
      ['first_name', 'TEXT'],
      ['middle_name', 'TEXT'],
      ['suffix', 'TEXT'],
      ['gender', 'TEXT'],
      ['date_of_birth', 'DATE'],
      ['age', 'SMALLINT'],
      ['civil_status', 'TEXT'],
      ['position_title', 'TEXT'],
      ['appointment_date', 'DATE'],
      ['emt_passer', 'BOOLEAN'],
      ['emt_date', 'DATE'],
      ['ces_stage', 'TEXT'],
      ['ces_conferment_date', 'DATE'],
      ['total_years_third_level', 'NUMERIC(5,2)'],
      ['previous_positions', "JSONB DEFAULT '[]'"],
      ['relevant_trainings', "JSONB DEFAULT '[]'"],
      ['permanent_address', 'TEXT'],
      ['highest_education', 'TEXT'],
      ['education_program', 'TEXT'],
      ['education_year_graduated', 'SMALLINT'],
      ['notable_achievements', 'TEXT'],
      ['performance_rating_ipcrf', 'TEXT'],
      ['performance_rating_cespes', 'TEXT']
    ];

    for (const [name, type] of columns) {
      await client.query(`ALTER TABLE third_level_officials_updates ADD COLUMN IF NOT EXISTS ${name} ${type};`);
    }
    console.log('✅ Updates table expanded with history snapshot columns.');

    await client.query('COMMIT');
    console.log('\n✅ TLM Profile Schema Foundation completed successfully.');
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
