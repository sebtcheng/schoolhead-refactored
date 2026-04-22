const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function getExactCounts() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT 
        COUNT(*) as total_rows,
        COUNT(DISTINCT ipc) as unique_ipcs
      FROM engineer_form 
      WHERE project_category = 'New Construction'
    `);
    
    // Also get the match count (Unique IPCs)
    const matchRes = await client.query(`
      SELECT COUNT(DISTINCT e.ipc)
      FROM engineer_form e
      INNER JOIN import_beff_projects i ON e.ipc = i.ipc
      WHERE e.project_category = 'New Construction'
    `);

    console.log(JSON.stringify({
      engineer_form_new_construction: res.rows[0],
      matching_unique_ipcs: matchRes.rows[0].count
    }, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

getExactCounts();
