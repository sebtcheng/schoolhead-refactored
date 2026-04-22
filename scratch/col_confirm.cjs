const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    console.log("=== DEFINITIVE ALTERNATIVE MATCH COUNT ===");

    // Step 1: Get exact budget column names for both tables
    const efBudget = await client.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'engineer_form' 
       AND (lower(column_name) LIKE '%abc%' OR lower(column_name) LIKE '%budget%' OR lower(column_name) LIKE '%amount%' OR lower(column_name) LIKE '%contract%')
       ORDER BY ordinal_position`
    );
    console.log("engineer_form budget-like cols:");
    efBudget.rows.forEach(r => console.log("  " + r.column_name));

    const beffBudget = await client.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'import_beff_projects' 
       AND (lower(column_name) LIKE '%abc%' OR lower(column_name) LIKE '%budget%' OR lower(column_name) LIKE '%amount%' OR lower(column_name) LIKE '%contract%' OR lower(column_name) LIKE '%school%' OR lower(column_name) LIKE '%fund%' OR lower(column_name) LIKE '%year%')
       ORDER BY ordinal_position`
    );
    console.log("import_beff_projects budget/school/year cols:");
    beffBudget.rows.forEach(r => console.log("  " + r.column_name));

    // Step 2: Sample a few orphans to see their actual column values
    console.log("\nSample orphan from engineer_form:");
    const sampleOrphan = await client.query(
      `SELECT * FROM engineer_form e
       WHERE e.project_category ILIKE '%New Con%'
       AND NOT EXISTS (SELECT 1 FROM import_beff_projects i WHERE i.ipc = e.ipc)
       LIMIT 1`
    );
    if (sampleOrphan.rows.length > 0) {
      const row = sampleOrphan.rows[0];
      console.log("  ipc:", row.ipc);
      console.log("  school_id:", row.school_id);
      console.log("  funding_year:", row.funding_year);
      // print all keys
      Object.keys(row).forEach(k => {
        const val = row[k];
        if (typeof val === 'number' && val > 10000) console.log(`  ${k}: ${val}`);
      });
    }

    // Step 3: Sample from beff to see matching columns
    console.log("\nSample from import_beff_projects:");
    const sampleBeff = await client.query(`SELECT * FROM import_beff_projects LIMIT 1`);
    if (sampleBeff.rows.length > 0) {
      const row = sampleBeff.rows[0];
      Object.keys(row).forEach(k => console.log(`  ${k}: ${row[k]}`));
    }

  } catch(e) {
    console.error(e.message);
  } finally {
    client.release();
    await pool.end();
  }
}
main();
