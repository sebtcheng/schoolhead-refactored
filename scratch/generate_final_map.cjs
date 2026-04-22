const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const client = await pool.connect();
  try {
    const query = `
      SELECT 
        e.project_id, e.ipc as ef_ipc, i.ipc as correct_ipc,
        e.school_name, e.funding_year, e.approved_budget_for_contract
      FROM engineer_form e
      JOIN import_beff_projects i ON 
        e.school_id::text = i.school_id::text AND
        e.funding_year::text = i.funding_year::text AND
        (i.project_category = 'NC' OR i.project_category = 'New Construction') AND
        ABS(COALESCE(e.approved_budget_for_contract, 0) - COALESCE(i.approved_budget_for_contract, 0)) < 1
      WHERE NOT EXISTS (SELECT 1 FROM import_beff_projects i2 WHERE i2.ipc = e.ipc)
      AND e.project_category = 'New Construction'
    `;
    const res = await client.query(query);
    console.log(`Mapped ${res.rows.length} projects.`);
    const fs = require('fs');
    fs.writeFileSync('scratch/final_recovery_map.json', JSON.stringify(res.rows, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
