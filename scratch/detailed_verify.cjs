const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT 
        (ipc IS NULL OR ipc = '') as is_empty,
        (EXISTS (SELECT 1 FROM import_beff_projects i WHERE i.ipc = e.ipc)) as has_match,
        COUNT(*) 
      FROM engineer_form e
      WHERE project_category = 'New Construction'
      GROUP BY is_empty, has_match
    `);
    console.table(res.rows);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
