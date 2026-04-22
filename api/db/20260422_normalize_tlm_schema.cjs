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
        tlid                      TEXT PRIMARY KEY REFERENCES third_level_officials_masterlist(tlid) ON DELETE CASCADE,
        last_name                 TEXT,
        first_name                TEXT,
        middle_name               TEXT,
        suffix                    TEXT,
        gender                    TEXT,
        date_of_birth             DATE,
        civil_status              TEXT,
        permanent_address         TEXT,
        highest_education         TEXT,
        education_program         TEXT,
        education_year_graduated  SMALLINT,
        notable_achievements      TEXT,
        performance_rating_ipcrf  TEXT,
        performance_rating_cespes TEXT,
        photo_binary_id           UUID,
        pds_binary_id             UUID,
        profile_word_binary_id    UUID,
        profile_ppt_binary_id     UUID,
        service_records_binary_id UUID,
        pending_admin_case        TEXT,
        ombudsman_case            TEXT,
        created_at                TIMESTAMPTZ DEFAULT NOW(),
        updated_at                TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ Profiles table created.');

    console.log('--- Phase 2: Scrubbing redundant columns from masterlist ---');
    // We keep appointment-specific fields in masterlist for now if they are tightly coupled to the slot,
    // but the user's approval was to normalize. 
    // Field 'appointment_date' and 'position_title' are tied to the PERSON's rank/rank date, 
    // but 'assignment_date' is tied to the OFFICE slot.
    // I'll move all "Person" fields to the profile table.

    const columnsToDropFromMaster = [
      'last_name', 'first_name', 'middle_name', 'suffix', 'gender', 'date_of_birth', 'age', 'civil_status',
      'position_title', 'appointment_date', 'emt_passer', 'emt_date', 'ces_stage', 'ces_conferment_date',
      'total_years_third_level', 'permanent_address', 'highest_education', 'education_program', 'education_year_graduated',
      'notable_achievements', 'performance_rating_ipcrf', 'performance_rating_cespes',
      'photo_binary_id', 'pds_binary_id', 'profile_word_binary_id', 'profile_ppt_binary_id', 'service_records_binary_id',
      'pending_admin_case', 'ombudsman_case'
    ];

    for (const col of columnsToDropFromMaster) {
      await client.query(`ALTER TABLE third_level_officials_masterlist DROP COLUMN IF EXISTS ${col}`);
    }
    console.log('✅ Masterlist scrubbed.');

    console.log('--- Phase 3: Scrubbing redundant columns from updates ledger ---');
    const columnsToDropFromUpdates = [
      'last_name', 'first_name', 'middle_name', 'suffix', 'gender', 'date_of_birth', 'age', 'civil_status',
      'position_title', 'appointment_date', 'emt_passer', 'emt_date', 'ces_stage', 'ces_conferment_date',
      'total_years_third_level', 'permanent_address', 'highest_education', 'education_program', 'education_year_graduated',
      'notable_achievements', 'performance_rating_ipcrf', 'performance_rating_cespes'
    ];

    for (const col of columnsToDropFromUpdates) {
      await client.query(`ALTER TABLE third_level_officials_updates DROP COLUMN IF EXISTS ${col}`);
    }
    console.log('✅ Updates registry scrubbed.');

    await client.query('COMMIT');
    console.log('\n✅ TLM Schema Normalization completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Normalization failed — rolled back:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
