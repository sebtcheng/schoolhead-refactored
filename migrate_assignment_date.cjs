const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('--- STARTING MIGRATION: ASSIGNMENT DATE ---');
    
    // 1. Add column to masterlist
    console.log('Adding column to third_level_officials_masterlist...');
    await client.query(`
      ALTER TABLE third_level_officials_masterlist 
      ADD COLUMN IF NOT EXISTS assignment_date DATE;
    `);

    // 2. Add column to updates ledger
    console.log('Adding column to third_level_officials_updates...');
    await client.query(`
      ALTER TABLE third_level_officials_updates 
      ADD COLUMN IF NOT EXISTS assignment_date DATE;
    `);

    // 3. Populate existing data
    console.log('Populating assignment_date from updated_at for existing records...');
    await client.query(`
      UPDATE third_level_officials_masterlist 
      SET assignment_date = updated_at::DATE 
      WHERE assignment_date IS NULL;
    `);

    console.log('Populating assignment_date for updates ledger...');
    await client.query(`
      UPDATE third_level_officials_updates 
      SET assignment_date = created_at::DATE 
      WHERE assignment_date IS NULL;
    `);

    console.log('--- MIGRATION COMPLETED SUCCESSFULLY ---');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
