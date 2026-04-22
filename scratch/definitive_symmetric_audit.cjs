const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const client = await pool.connect();
  try {
    console.log("--- DEFINITIVE SYMMETRIC IPC AUDIT ---");

    // 1. Get unique IPCs from import_beff_projects (Combined NC + New Construction)
    const importRes = await client.query(`
      SELECT DISTINCT ipc 
      FROM import_beff_projects 
      WHERE project_category IN ('NC', 'New Construction')
      AND ipc IS NOT NULL AND ipc != ''
    `);
    const importIPCs = new Set(importRes.rows.map(r => r.ipc));
    console.log(`Unique IPCs in Import (NC + New Construction): ${importIPCs.size}`);

    // 2. Get unique IPCs from engineer_form (New Construction)
    const efRes = await client.query(`
      SELECT DISTINCT ipc 
      FROM engineer_form 
      WHERE project_category = 'New Construction'
      AND ipc IS NOT NULL AND ipc != ''
    `);
    const efIPCs = new Set(efRes.rows.map(r => r.ipc));
    console.log(`Unique IPCs in Engineer Form (New Construction): ${efIPCs.size}`);

    // 3. Comparison
    const missingInEF = [...importIPCs].filter(ipc => !efIPCs.has(ipc));
    const rogueInEF = [...efIPCs].filter(ipc => !importIPCs.has(ipc));

    console.log(`\nDiscrepancy Details:`);
    console.log(`- Missing in EF: ${missingInEF.length}`);
    console.log(`- Rogue in EF: ${rogueInEF.length}`);

    if (rogueInEF.length > 0) {
      console.log("\nSample Rogue IPCs in EF (e.g., untracked or duplicates):");
      console.table(rogueInEF.slice(0, 10));
    }

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
