const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/insighted',
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false
});

async function checkDates() {
  try {
    const res = await pool.query(`
      SELECT id, created_at, TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS TZ') as raw_at 
      FROM engineer_image 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    console.log('--- Engineer Image Dates ---');
    console.table(res.rows.map(row => ({
      id: row.id,
      created_at: row.created_at, // This will show as a JS Date object
      raw_at: row.raw_at,           // This will show how Postgres sees it
      iso: row.created_at ? new Date(row.created_at).toISOString() : 'null'
    })));
    
    const timeRes = await pool.query('SELECT CURRENT_TIMESTAMP, NOW();');
    console.log('--- DB Time ---');
    console.table(timeRes.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkDates();
