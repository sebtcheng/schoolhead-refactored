const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function run() {
  try {
    const strands = await pool.query('SELECT DISTINCT strand FROM third_level_officials_masterlist ORDER BY strand');
    const positions = await pool.query('SELECT DISTINCT position FROM third_level_officials_masterlist ORDER BY position');
    
    console.log('--- STRANDS ---');
    console.log(JSON.stringify(strands.rows.map(r => r.strand), null, 2));
    
    console.log('--- POSITIONS (Sample) ---');
    console.log(JSON.stringify(positions.rows.map(r => r.position).slice(0, 50), null, 2));
    
  } catch (err) {
    console.error('Audit failed:', err.message);
  } finally {
    await pool.end();
  }
}

run();
