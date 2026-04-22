const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const client = await pool.connect();
  try {
    const efQuery = `
      SELECT ipc, school_id, funding_year, project_category, approved_budget_for_contract, project_id, school_name
      FROM engineer_form
      WHERE NOT EXISTS (SELECT 1 FROM import_beff_projects i WHERE i.ipc = engineer_form.ipc)
      AND project_category = 'New Construction'
      LIMIT 1
    `;
    const ef = (await client.query(efQuery)).rows[0];
    console.log("EF PROJECT:", ef);

    if (ef) {
      const iQuery = `
        SELECT ipc, school_id, funding_year, project_category, approved_budget_for_contract, school_name
        FROM import_beff_projects
        WHERE school_id::text = $1
      `;
      const iRows = (await client.query(iQuery, [String(ef.school_id)])).rows;
      console.log("\nIMPORT CANDIDATES:", iRows);
      
      iRows.forEach(i => {
        console.log(`\nCandidate IPC: ${i.ipc}`);
        console.log(`Year Match: ${String(i.funding_year) === String(ef.funding_year)} (${i.funding_year} vs ${ef.funding_year})`);
        console.log(`Cat Match: ${i.project_category === 'NC'}`);
        console.log(`Budget Diff: ${Math.abs(Number(i.approved_budget_for_contract) - Number(ef.approved_budget_for_contract))}`);
      });
    }

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
