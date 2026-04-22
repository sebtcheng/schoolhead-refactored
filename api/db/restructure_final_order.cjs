const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function restructureAgain() {
  const client = await pool.connect();
  try {
    console.log('🚀 Finalizing DB Structure: Moving assignment_date and remarks before status...');
    await client.query('BEGIN');

    // 1. Create the final target structure
    await client.query(`
      CREATE TABLE IF NOT EXISTS third_level_officials_updates_final (
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
        assignment_date DATE,
        remarks TEXT,
        status TEXT,
        change_type TEXT,
        updated_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Migrate data
    await client.query(`
      INSERT INTO third_level_officials_updates_final (
        tlid, sort_index, strand, office, name, position, 
        email, alt_email_1, alt_email_2, contact_details, 
        alt_contact_details_1, alt_contact_details_2,
        assignment_date, remarks, status, change_type, 
        updated_by, created_at
      )
      SELECT 
        tlid, sort_index, strand, office, name, position, 
        email, alt_email_1, alt_email_2, contact_details, 
        alt_contact_details_1, alt_contact_details_2,
        assignment_date, remarks, status, change_type, 
        updated_by, created_at
      FROM third_level_officials_updates
    `);

    // 3. Swap
    await client.query('DROP TABLE third_level_officials_updates');
    await client.query('ALTER TABLE third_level_officials_updates_final RENAME TO third_level_officials_updates');

    await client.query('COMMIT');
    console.log('✨ Database structure successfully finalized according to requested order.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

restructureAgain();
