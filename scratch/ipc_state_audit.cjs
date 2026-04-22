const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    console.log("=== IPC RECONCILIATION STATE AUDIT ===");

    // 1. Total NC orphans currently
    const orphans = await client.query(`
      SELECT count(*) FROM engineer_form e
      WHERE e.project_category ILIKE '%New Con%'
      AND NOT EXISTS (SELECT 1 FROM import_beff_projects i WHERE i.ipc = e.ipc)
    `);
    console.log(`Current NC orphans in engineer_form: ${orphans.rows[0].count}`);

    // 2. Sample orphans - check if they have INF- prefix (meaning they WERE updated) or old-format IPCs
    const sample = await client.query(`
      SELECT ipc, school_id, funding_year 
      FROM engineer_form e
      WHERE e.project_category ILIKE '%New Con%'
      AND NOT EXISTS (SELECT 1 FROM import_beff_projects i WHERE i.ipc = e.ipc)
      LIMIT 20
    `);
    console.log("\nSample orphan IPCs:");
    sample.rows.forEach(r => console.log(`  [${r.ipc}] school: ${r.school_id} year: ${r.funding_year}`));

    // 3. How many orphans have old-style IPC (not INF- prefix)?
    const oldStyle = await client.query(`
      SELECT count(*) FROM engineer_form e
      WHERE e.project_category ILIKE '%New Con%'
      AND e.ipc NOT LIKE 'INF-%'
      AND NOT EXISTS (SELECT 1 FROM import_beff_projects i WHERE i.ipc = e.ipc)
    `);
    console.log(`\nOrphans with NON-INF prefix (old IPC format): ${oldStyle.rows[0].count}`);

    // 4. How many orphans DO have INF- prefix (were updated but still not in beff)?
    const infStyle = await client.query(`
      SELECT count(*) FROM engineer_form e
      WHERE e.project_category ILIKE '%New Con%'
      AND e.ipc LIKE 'INF-%'
      AND NOT EXISTS (SELECT 1 FROM import_beff_projects i WHERE i.ipc = e.ipc)
    `);
    console.log(`Orphans WITH INF prefix (in beff but no match): ${infStyle.rows[0].count}`);

  } catch(e) {
    console.error(e.message);
  } finally {
    client.release();
    await pool.end();
  }
}
main();
