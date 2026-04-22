const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function findAltMatches() {
  const client = await pool.connect();
  try {
    console.log("--- Alternative Matching Analysis ---");

    // 1. Identify non-matching projects from engineer_form (for New Construction)
    // We'll look for projects where the IPC doesn't exist in import_beff_projects
    // AND then try to match them by other criteria.
    
    const query = `
      WITH non_ipc_matches AS (
        SELECT *
        FROM engineer_form e
        WHERE NOT EXISTS (
          SELECT 1 FROM import_beff_projects i WHERE i.ipc = e.ipc
        )
        AND e.project_category = 'New Construction'
      )
      SELECT 
        e.ipc as ef_ipc,
        i.ipc as import_ipc,
        e.school_id,
        e.funding_year,
        e.project_category,
        e.approved_budget_for_contract,
        e.project_name as ef_project,
        i.project_name as import_project
      FROM non_ipc_matches e
      JOIN import_beff_projects i ON 
        e.school_id::text = i.school_id::text AND
        e.funding_year::text = i.funding_year::text AND
        e.project_category = i.project_category AND
        ABS(COALESCE(e.approved_budget_for_contract, 0) - COALESCE(i.approved_budget_for_contract, 0)) < 0.01
    `;

    const res = await client.query(query);
    console.log(`Alternative Matches Found: ${res.rows.length}`);

    if (res.rows.length > 0) {
      console.log("\nSample Alternative Matches:");
      console.table(res.rows.slice(0, 5));
      
      const fs = require('fs');
      fs.writeFileSync('scratch/alt_matches_details.json', JSON.stringify(res.rows, null, 2));
      console.log("Detailed alternative matches saved to scratch/alt_matches_details.json");
    }

    // Also get the total number of non-IPC matching 'New Construction' projects for context
    const totalNonIPC = await client.query(`
      SELECT COUNT(*) 
      FROM engineer_form e
      WHERE NOT EXISTS (
        SELECT 1 FROM import_beff_projects i WHERE i.ipc = e.ipc
      )
      AND e.project_category = 'New Construction'
    `);
    console.log(`\nTotal 'New Construction' projects without IPC match: ${totalNonIPC.rows[0].count}`);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

findAltMatches();
