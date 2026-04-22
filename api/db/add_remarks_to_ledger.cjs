const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🚀 Starting migration: Adding remarks to third_level_officials_updates...');
    
    // Add the column if it doesn't exist
    await client.query(`
      ALTER TABLE third_level_officials_updates 
      ADD COLUMN IF NOT EXISTS remarks TEXT;
    `);

    console.log('✅ Migration successful: remarks column added.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
