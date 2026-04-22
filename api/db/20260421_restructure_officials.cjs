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

    console.log('--- Phase 1: Renaming Master Table ---');
    // Check if third_level_officials exists and third_level_officials_masterlist does NOT
    const masterExists = await client.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'third_level_officials_masterlist')");
    
    if (!masterExists.rows[0].exists) {
      console.log('Renaming third_level_officials to third_level_officials_masterlist...');
      await client.query(`ALTER TABLE third_level_officials RENAME TO third_level_officials_masterlist;`);
    } else {
      console.log('third_level_officials_masterlist already exists. Skipping rename.');
    }

    console.log('--- Phase 2: Creating Updates Ledger Table ---');
    await client.query(`
      CREATE TABLE IF NOT EXISTS third_level_officials_updates (
        update_id SERIAL PRIMARY KEY,
        tlid TEXT REFERENCES third_level_officials_masterlist(tlid),
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
        change_type TEXT, -- e.g., 'INITIAL', 'INFO_UPDATE', 'REASSIGNMENT', 'EXCLUSION'
        updated_by TEXT,  -- Email/UID of the editor
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log('--- Phase 3: Creating Indices ---');
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tlou_tlid ON third_level_officials_updates(tlid);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tlou_created ON third_level_officials_updates(created_at);`);

    console.log('--- Phase 4: Backfilling INITIAL records ---');
    // We only backfill if the updates table is empty for that tlid to avoid duplicates
    await client.query(`
      INSERT INTO third_level_officials_updates (
        tlid, sort_index, strand, office, name, position, 
        email, alt_email_1, alt_email_2, 
        contact_details, alt_contact_details_1, alt_contact_details_2, 
        status, change_type, updated_by
      )
      SELECT 
        tlid, sort_index, strand, office, name, position, 
        email, alt_email_1, alt_email_2, 
        contact_details, alt_contact_details_1, alt_contact_details_2, 
        status, 'INITIAL_MIGRATION', 'SYSTEM_ADMIN'
      FROM third_level_officials_masterlist
      WHERE tlid NOT IN (SELECT DISTINCT tlid FROM third_level_officials_updates);
    `);

    await client.query('COMMIT');
    console.log('\n✅ Database restructure completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Restructure failed — rolled back:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
