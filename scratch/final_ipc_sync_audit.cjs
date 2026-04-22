const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runAudit() {
  const client = await pool.connect();
  try {
    console.log("--- FINAL SYMMETRIC IPC AUDIT (New Construction) ---");

    // 1. Get unique IPCs from import_beff_projects (New Construction)
    const importRes = await client.query(`
      SELECT DISTINCT ipc 
      FROM import_beff_projects 
      WHERE project_category IN ('New Construction', 'NC')
      AND ipc IS NOT NULL AND ipc != ''
    `);
    const importIPCs = new Set(importRes.rows.map(r => r.ipc));
    console.log(`Unique IPCs in Import Master List: ${importIPCs.size}`);

    // 2. Get unique IPCs from engineer_form (New Construction)
    const efRes = await client.query(`
      SELECT DISTINCT ipc 
      FROM engineer_form 
      WHERE project_category = 'New Construction'
      AND ipc IS NOT NULL AND ipc != ''
    `);
    const efIPCs = new Set(efRes.rows.map(r => r.ipc));
    console.log(`Unique IPCs in Engineer Form (EF): ${efIPCs.size}`);

    // 3. Symmetric difference
    const missingInEF = [...importIPCs].filter(ipc => !efIPCs.has(ipc));
    const rogueInEF = [...efIPCs].filter(ipc => !importIPCs.has(ipc));

    console.log(`\nIPCs in Master but MISSING in EF: ${missingInEF.length}`);
    console.log(`IPCs in EF but MISSING in Master: ${rogueInEF.length}`);

    if (missingInEF.length > 0) {
      console.log("\nSample Missing in EF (Master orphans):");
      console.table(missingInEF.slice(0, 5));
    }

    if (rogueInEF.length > 0) {
      console.log("\nSample Rogue in EF (Untracked orphans):");
      console.table(rogueInEF.slice(0, 5));
    }

    const fs = require('fs');
    fs.writeFileSync('scratch/final_sync_audit_results.json', JSON.stringify({
      counts: {
        import_unique_ipcs: importIPCs.size,
        ef_unique_ipcs: efIPCs.size,
        missing_in_ef: missingInEF.length,
        rogue_in_ef: rogueInEF.length
      },
      missing_in_ef_list: missingInEF,
      rogue_in_ef_list: rogueInEF
    }, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

runAudit();
