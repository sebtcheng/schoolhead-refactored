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

    // ── PHASE 1: REORDER MASTERLIST ──────────────────────────────────────
    console.log('--- Phase 1: Reorder third_level_officials_masterlist ---');

    // Drop all FK constraints that reference the masterlist so we can rename it
    await client.query(`ALTER TABLE officials_movement_log DROP CONSTRAINT IF EXISTS officials_movement_log_tlid_fkey`);
    await client.query(`ALTER TABLE third_level_officials_prev_positions DROP CONSTRAINT IF EXISTS third_level_officials_prev_positions_tlid_fkey`);
    await client.query(`ALTER TABLE third_level_officials_trainings DROP CONSTRAINT IF EXISTS third_level_officials_trainings_tlid_fkey`);

    // Rename old table out of the way
    await client.query(`ALTER TABLE third_level_officials_masterlist RENAME TO third_level_officials_masterlist_old`);

    // Create new table with correct column order — status/created_at/updated_at at end
    await client.query(`
      CREATE TABLE third_level_officials_masterlist (
        tlid                      TEXT PRIMARY KEY,
        sort_index                INTEGER,
        strand                    TEXT,
        office                    TEXT,
        name                      TEXT,
        last_name                 TEXT,
        first_name                TEXT,
        middle_name               TEXT,
        suffix                    TEXT,
        gender                    TEXT,
        date_of_birth             DATE,
        age                       SMALLINT,
        civil_status              TEXT,
        position                  TEXT,
        position_title            TEXT,
        appointment_date          DATE,
        assignment_date           DATE,
        emt_passer                BOOLEAN,
        emt_date                  DATE,
        ces_stage                 TEXT,
        ces_conferment_date       DATE,
        total_years_third_level   NUMERIC(5,2),
        email                     TEXT,
        alt_email_1               TEXT,
        alt_email_2               TEXT,
        contact_details           TEXT,
        alt_contact_details_1     TEXT,
        alt_contact_details_2     TEXT,
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
        status                    TEXT,
        created_at                TIMESTAMPTZ DEFAULT NOW(),
        updated_at                TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Copy all existing data
    await client.query(`
      INSERT INTO third_level_officials_masterlist
      SELECT
        tlid, sort_index, strand, office, name,
        last_name, first_name, middle_name, suffix, gender, date_of_birth, age, civil_status,
        position, position_title, appointment_date, assignment_date,
        emt_passer, emt_date, ces_stage, ces_conferment_date, total_years_third_level,
        email, alt_email_1, alt_email_2,
        contact_details, alt_contact_details_1, alt_contact_details_2,
        permanent_address, highest_education, education_program, education_year_graduated,
        notable_achievements, performance_rating_ipcrf, performance_rating_cespes,
        photo_binary_id, pds_binary_id, profile_word_binary_id, profile_ppt_binary_id, service_records_binary_id,
        pending_admin_case, ombudsman_case,
        status, created_at, updated_at
      FROM third_level_officials_masterlist_old;
    `);

    // Restore FK constraints
    await client.query(`
      ALTER TABLE officials_movement_log
        ADD CONSTRAINT officials_movement_log_tlid_fkey
        FOREIGN KEY (tlid) REFERENCES third_level_officials_masterlist(tlid);
    `);
    await client.query(`
      ALTER TABLE third_level_officials_prev_positions
        ADD CONSTRAINT third_level_officials_prev_positions_tlid_fkey
        FOREIGN KEY (tlid) REFERENCES third_level_officials_masterlist(tlid) ON DELETE CASCADE;
    `);
    await client.query(`
      ALTER TABLE third_level_officials_trainings
        ADD CONSTRAINT third_level_officials_trainings_tlid_fkey
        FOREIGN KEY (tlid) REFERENCES third_level_officials_masterlist(tlid) ON DELETE CASCADE;
    `);

    // Drop old table
    await client.query(`DROP TABLE third_level_officials_masterlist_old`);
    console.log('✅ Masterlist reordered. status/created_at/updated_at are now at the end.');

    // ── PHASE 2: REORDER UPDATES TABLE ───────────────────────────────────
    console.log('--- Phase 2: Reorder third_level_officials_updates ---');

    await client.query(`ALTER TABLE third_level_officials_updates RENAME TO third_level_officials_updates_old`);

    await client.query(`
      CREATE TABLE third_level_officials_updates (
        id                        INTEGER,
        tlid                      TEXT,
        sort_index                INTEGER,
        strand                    TEXT,
        office                    TEXT,
        name                      TEXT,
        last_name                 TEXT,
        first_name                TEXT,
        middle_name               TEXT,
        suffix                    TEXT,
        gender                    TEXT,
        date_of_birth             DATE,
        age                       SMALLINT,
        civil_status              TEXT,
        position                  TEXT,
        position_title            TEXT,
        appointment_date          DATE,
        assignment_date           DATE,
        emt_passer                BOOLEAN,
        emt_date                  DATE,
        ces_stage                 TEXT,
        ces_conferment_date       DATE,
        total_years_third_level   NUMERIC(5,2),
        email                     TEXT,
        alt_email_1               TEXT,
        alt_email_2               TEXT,
        contact_details           TEXT,
        alt_contact_details_1     TEXT,
        alt_contact_details_2     TEXT,
        permanent_address         TEXT,
        highest_education         TEXT,
        education_program         TEXT,
        education_year_graduated  SMALLINT,
        notable_achievements      TEXT,
        performance_rating_ipcrf  TEXT,
        performance_rating_cespes TEXT,
        remarks                   TEXT,
        status                    TEXT,
        change_type               TEXT,
        updated_by                TEXT,
        created_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      INSERT INTO third_level_officials_updates
      SELECT
        id, tlid, sort_index, strand, office, name,
        last_name, first_name, middle_name, suffix, gender, date_of_birth, age, civil_status,
        position, position_title, appointment_date, assignment_date,
        emt_passer, emt_date, ces_stage, ces_conferment_date, total_years_third_level,
        email, alt_email_1, alt_email_2,
        contact_details, alt_contact_details_1, alt_contact_details_2,
        permanent_address, highest_education, education_program, education_year_graduated,
        notable_achievements, performance_rating_ipcrf, performance_rating_cespes,
        remarks, status, change_type, updated_by, created_at
      FROM third_level_officials_updates_old;
    `);

    // Restore the sequence for the id column
    await client.query(`
      CREATE SEQUENCE IF NOT EXISTS third_level_officials_updates_id_seq;
      SELECT setval('third_level_officials_updates_id_seq', COALESCE((SELECT MAX(id) FROM third_level_officials_updates), 0) + 1, false);
      ALTER TABLE third_level_officials_updates ALTER COLUMN id SET DEFAULT nextval('third_level_officials_updates_id_seq');
    `);

    // Restore indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tlou_tlid ON third_level_officials_updates(tlid)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tlou_created ON third_level_officials_updates(created_at)`);

    await client.query(`DROP TABLE third_level_officials_updates_old`);
    console.log('✅ Updates table reordered. status/change_type/updated_by/created_at are now at the end.');

    await client.query('COMMIT');
    console.log('\n✅ Column reorder migration completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Reorder migration failed — rolled back:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
