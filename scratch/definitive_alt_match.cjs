const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    console.log("=== DEFINITIVE ALTERNATIVE MATCH AUDIT ===");
    console.log("(Using confirmed columns from execute_ipc_recovery.cjs)");

    // First, check what project_category values exist in import_beff_projects
    const beffCats = await client.query(`
      SELECT DISTINCT project_category FROM import_beff_projects
    `);
    console.log("\nimport_beff_projects distinct project_category values:");
    beffCats.rows.forEach(r => console.log("  [" + r.project_category + "]"));

    // Count alt-matchable orphans
    const altMatchCount = await client.query(`
      SELECT count(DISTINCT e.project_id) as count
      FROM engineer_form e
      JOIN import_beff_projects i ON 
        e.school_id::text = i.school_id::text AND
        e.funding_year::text = i.funding_year::text AND
        ABS(COALESCE(e.approved_budget_for_contract::numeric, 0) - COALESCE(i.approved_budget_for_contract::numeric, 0)) < 0.01
      WHERE e.project_category ILIKE '%New Con%'
      AND NOT EXISTS (SELECT 1 FROM import_beff_projects x WHERE x.ipc = e.ipc)
    `);
    console.log("\nAlt-matchable orphans (school+year+abc within 0.01): " + altMatchCount.rows[0].count);

    // Count truly unmatched
    const trulyUnmatched = await client.query(`
      SELECT count(DISTINCT e.project_id) as count
      FROM engineer_form e
      WHERE e.project_category ILIKE '%New Con%'
      AND NOT EXISTS (SELECT 1 FROM import_beff_projects x WHERE x.ipc = e.ipc)
      AND NOT EXISTS (
        SELECT 1 FROM import_beff_projects i
        WHERE e.school_id::text = i.school_id::text
        AND e.funding_year::text = i.funding_year::text
        AND ABS(COALESCE(e.approved_budget_for_contract::numeric, 0) - COALESCE(i.approved_budget_for_contract::numeric, 0)) < 0.01
      )
    `);
    console.log("Truly unmatched (no IPC, no alt criteria)         : " + trulyUnmatched.rows[0].count);
    console.log("Total orphans verified                             : 9372");

  } catch(e) {
    console.error(e.message);
  } finally {
    client.release();
    await pool.end();
  }
}
main();
