const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkEsf7() {
  try {
    const res = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'esf7_database'
    `);
    console.log(JSON.stringify(res.rows.map(r => r.column_name), null, 2));
    
    const sample = await pool.query(`SELECT school_id, status FROM esf7_database LIMIT 5`);
    console.log("Sample Data:", JSON.stringify(sample.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkEsf7();
