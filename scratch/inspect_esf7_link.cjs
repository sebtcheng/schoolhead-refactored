
const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function check() {
  try {
    const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'esf7_link'");
    console.table(res.rows);
    
    // Also check a sample record
    const sample = await pool.query("SELECT * FROM esf7_link LIMIT 1");
    console.log('Sample record:', sample.rows[0]);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
