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

    console.log('Checking for existing third_level_officials table...');
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'third_level_officials'
      );
    `);

    if (tableExists.rows[0].exists) {
      console.log('Table exists. Checking schema...');
      const columnCheck = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'third_level_officials' AND column_name = 'sort_index';
      `);
      
      if (columnCheck.rows.length === 0) {
        console.log('Old schema detected. Renaming table to third_level_officials_legacy...');
        // Drop legacy if it exists to avoid conflict on rename
        await client.query(`DROP TABLE IF EXISTS third_level_officials_legacy CASCADE;`);
        await client.query(`ALTER TABLE third_level_officials RENAME TO third_level_officials_legacy;`);
      }
    }

    console.log('Creating third_level_officials table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS third_level_officials (
        tlid TEXT PRIMARY KEY,
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
        status TEXT DEFAULT 'Active',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log('Creating officials_movement_log table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS officials_movement_log (
        id SERIAL PRIMARY KEY,
        tlid TEXT REFERENCES third_level_officials(tlid),
        movement_type TEXT,
        details JSONB,
        remarks TEXT,
        effective_date DATE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        created_by TEXT
      );
    `);

    console.log('Creating indices...');
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tlo_status ON third_level_officials(status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tlo_name ON third_level_officials(name);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_oml_tlid ON officials_movement_log(tlid);`);

    await client.query('COMMIT');
    console.log('\n✅ Officials Directory tables created successfully.');
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
