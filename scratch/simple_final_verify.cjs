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
      FROM engineer_form e 
      WHERE NOT EXISTS (SELECT 1 FROM import_beff_projects i WHERE i.ipc = e.ipc) 
      AND e.project_category = 'New Construction'
    `);
    console.log("Remaining non-matches: " + res.rows[0].count);
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
