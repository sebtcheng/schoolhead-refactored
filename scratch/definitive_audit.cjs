const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const client = await pool.connect();
  try {
    console.log("--- FINAL POST-MIGRATION AUDIT ---");
    
    // 1. Check for Legacy IPCs
    const legacyRes = await client.query(`SELECT COUNT(*) FROM engineer_form WHERE ipc LIKE 'Legacy-%' AND project_category = 'New Construction'`);
    console.log("Legacy IPCs remaining: " + legacyRes.rows[0].count);

    // 2. Sample 5 projects that were NOT Legacy before but are now updated
    // (We know they were updated because Legacy count is 0)
    const sampleRes = await client.query(`
      SELECT ipc, school_id, funding_year, approved_budget_for_contract
      FROM engineer_form
      WHERE project_category = 'New Construction'
      LIMIT 5
    `);
    
    for (const row of sampleRes.rows) {
      const matchRes = await client.query(`SELECT COUNT(*) FROM import_beff_projects WHERE ipc = $1`, [row.ipc]);
      console.log(`IPC ${row.ipc} (School ${row.school_id}) matches in Import Table: ${matchRes.rows[0].count}`);
    }

    // 3. Count total matching vs non-matching
    const totalRes = await client.query(`
      SELECT 
        (EXISTS (SELECT 1 FROM import_beff_projects i WHERE i.ipc = e.ipc)) as has_match,
        COUNT(*) 
      FROM engineer_form e
      WHERE project_category = 'New Construction'
      GROUP BY has_match
    `);
    console.table(totalRes.rows);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
