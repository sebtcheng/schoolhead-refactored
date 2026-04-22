const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  const client = await pool.connect();
  try {
    console.log("--- FINAL IPC VERIFICATION REPORT ---");
    
    // 1. Unique NC IPCs in engineer_form
    const efRes = await client.query(`
      SELECT COUNT(DISTINCT ipc) as count 
      FROM engineer_form 
      WHERE project_category = 'New Construction' 
      AND ipc LIKE 'INF-%'
    `);
    
    // 2. Total projects in beff table
    const beffRes = await client.query(`SELECT COUNT(*) as count FROM import_beff_projects`);
    
    // 3. Orphans remaining (Should be 0)
    const orphanRes = await client.query(`
      SELECT COUNT(DISTINCT ipc) as count 
      FROM engineer_form e 
      WHERE project_category = 'New Construction' 
      AND ipc LIKE 'INF-%' 
      AND NOT EXISTS (SELECT 1 FROM import_beff_projects i WHERE i.ipc = e.ipc)
    `);

    // 4. Matches Found (Intersection)
    const matchRes = await client.query(`
      SELECT COUNT(DISTINCT e.ipc) as count
      FROM engineer_form e
      JOIN import_beff_projects i ON e.ipc = i.ipc
      WHERE e.project_category = 'New Construction'
    `);

    console.log(`Unique NC IPCs in engineer_form: ${efRes.rows[0].count}`);
    console.log(`Total Projects in import_beff_projects: ${beffRes.rows[0].count}`);
    console.log(`Remaining Orphans in engineer_form: ${orphanRes.rows[0].count}`);
    console.log(`Matched IPCs (Post-Migration): ${matchRes.rows[0].count}`);

    if (parseInt(efRes.rows[0].count) === parseInt(matchRes.rows[0].count)) {
       console.log("\nVERIFICATION SUCCESS: All New Construction IPCs in engineer_form now exist in beff master list.");
    } else {
       console.log("\nVERIFICATION FAILED: Mismatch between engineer_form unique IPCs and master list matches.");
    }

  } finally {
    client.release();
    await pool.end();
  }
}

main();
