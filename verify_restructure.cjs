const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function run() {
  try {
    const m = await pool.query('SELECT COUNT(*) FROM third_level_officials_masterlist');
    const u = await pool.query('SELECT COUNT(*) FROM third_level_officials_updates');
    console.log('Masterlist Count:', m.rows[0].count);
    console.log('Updates Count:', u.rows[0].count);
    
    const sample = await pool.query('SELECT tlid, name, change_type FROM third_level_officials_updates LIMIT 5');
    console.log('Sample Ledger Entries:', sample.rows);
  } catch (err) {
    console.error('Verification failed:', err.message);
  } finally {
    await pool.end();
  }
}

run();
