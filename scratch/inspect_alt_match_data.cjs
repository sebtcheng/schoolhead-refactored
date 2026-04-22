const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function inspectData() {
  const client = await pool.connect();
  try {
    console.log("--- Inspecting Non-Matching EF Projects ---");
    const efRes = await client.query(`
      SELECT ipc, school_id, school_name, funding_year, project_category, approved_budget_for_contract, project_id
      FROM engineer_form e
      WHERE NOT EXISTS (SELECT 1 FROM import_beff_projects i WHERE i.ipc = e.ipc)
      AND project_category = 'New Construction'
      LIMIT 10
    `);
    console.table(efRes.rows);

    if (efRes.rows.length > 0) {
      const sample = efRes.rows[0];
      console.log("\n--- Checking for Potential Match for School ID:", sample.school_id, "---");
      const importRes = await client.query(`
        SELECT ipc, school_id, funding_year, project_category, approved_budget_for_contract
        FROM import_beff_projects
        WHERE school_id::text = $1
      `, [String(sample.school_id)]);
      console.table(importRes.rows);
    }

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

inspectData();
