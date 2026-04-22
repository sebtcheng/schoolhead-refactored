const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const client = await pool.connect();
  try {
    // 1. Get totals from engineer_form (Unique IPCs)
    // Using ILIKE to be safe
    const res = await client.query(`
      SELECT 
        COUNT(DISTINCT ipc) as total_unique_ipcs
      FROM engineer_form 
      WHERE project_category ILIKE '%New Construction%'
    `);
    
    // 2. Get matches (Unique IPCs)
    const matchRes = await client.query(`
      SELECT COUNT(DISTINCT e.ipc)
      FROM engineer_form e
      INNER JOIN import_beff_projects i ON e.ipc = i.ipc
      WHERE e.project_category ILIKE '%New Construction%'
    `);

    const total = parseInt(res.rows[0].total_unique_ipcs, 10);
    const matches = parseInt(matchRes.rows[0].count, 10);
    const pct = (matches / total) * 100;

    console.log("--- FINAL RECONCILIATION ---");
    console.log("Total Unique IPCs (New Construction ILIKE): " + total);
    console.log("Matching Unique IPCs: " + matches);
    console.log("Percentage: " + pct.toFixed(2) + "%");

    // Also check the user's specific total (49,560)
    const userTotal = 49560;
    const userPct = (matches / userTotal) * 100;
    console.log("\n--- BASED ON USER REPORT (49,560) ---");
    console.log("Percentage: " + userPct.toFixed(2) + "%");

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
