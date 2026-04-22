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
        COUNT(*) as total_rows,
        COUNT(DISTINCT ipc) as total_unique_ipcs
      FROM engineer_form 
      WHERE project_category = 'New Construction'
    `);
    
    const matchRes = await client.query(`
      SELECT COUNT(DISTINCT e.ipc)
      FROM engineer_form e
      INNER JOIN import_beff_projects i ON e.ipc = i.ipc
      WHERE e.project_category = 'New Construction'
    `);

    const total = parseInt(res.rows[0].total_unique_ipcs, 10);
    const matches = parseInt(matchRes.rows[0].count, 10);
    const pct = (matches / total) * 100;

    console.log("Total Unique IPCs (NC): " + total);
    console.log("Matching Unique IPCs (NC): " + matches);
    console.log("Percentage: " + pct.toFixed(2) + "%");

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
