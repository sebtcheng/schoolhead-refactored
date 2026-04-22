const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT COUNT(*) 
      FROM engineer_form 
      WHERE ipc LIKE 'Legacy-%' 
      AND project_category = 'New Construction'
    `);
    console.log("Legacy IPC count in EF: " + res.rows[0].count);
    
    const totRes = await client.query(`
      SELECT COUNT(*) 
      FROM engineer_form 
      WHERE project_category = 'New Construction'
    `);
    console.log("Total NC in EF: " + totRes.rows[0].count);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
