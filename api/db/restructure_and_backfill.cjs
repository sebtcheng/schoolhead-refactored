const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function restructureAndBackfill() {
  const client = await pool.connect();
  try {
    console.log('🚀 Starting Database Restructuring & Forensic Backfill...');
    await client.query('BEGIN');

    // 1. Create the new structure
    console.log('--- Creating temporary table with target column order...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS third_level_officials_updates_new (
        id SERIAL PRIMARY KEY,
        tlid TEXT,
        sort_index INTEGER,
        strand TEXT,
        office TEXT,
        name TEXT,
        position TEXT,
        email TEXT,
        alt_email_1 TEXT,
        alt_email_2 TEXT,
        contact_details TEXT,
        alt_contact_details_1 TEXT,
        alt_contact_details_2 TEXT,
        status TEXT,
        change_type TEXT,
        assignment_date DATE,
        remarks TEXT,
        updated_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Migrate existing data (mapping current columns to new positions)
    console.log('--- Migrating existing ledger data...');
    await client.query(`
      INSERT INTO third_level_officials_updates_new (
        tlid, sort_index, strand, office, name, position, 
        email, alt_email_1, alt_email_2, contact_details, 
        alt_contact_details_1, alt_contact_details_2, status, 
        change_type, assignment_date, remarks, updated_by, created_at
      )
      SELECT 
        tlid, sort_index, strand, office, name, position, 
        email, alt_email_1, alt_email_2, contact_details, 
        alt_contact_details_1, alt_contact_details_2, status, 
        change_type, assignment_date, remarks, updated_by, created_at
      FROM third_level_officials_updates
    `);

    // 3. Forensic Backfill: Recover missing remarks from movement logs
    console.log('--- Performing Forensic Backfill (recovering remarks from logs)...');
    const backfillRes = await client.query(`
      UPDATE third_level_officials_updates_new u
      SET remarks = m.remarks
      FROM officials_movement_log m
      WHERE u.tlid = m.tlid 
        AND (u.assignment_date = m.effective_date OR u.created_at::date = m.created_at::date)
        AND (u.remarks IS NULL OR u.remarks = '')
        AND m.remarks IS NOT NULL;
    `);
    console.log(`✅ Backfilled ${backfillRes.rowCount} records with movement justifications.`);

    // 4. Swap tables
    console.log('--- Swapping tables...');
    await client.query('DROP TABLE third_level_officials_updates');
    await client.query('ALTER TABLE third_level_officials_updates_new RENAME TO third_level_officials_updates');

    await client.query('COMMIT');
    console.log('✨ Data Restructuring Complete!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

restructureAndBackfill();
