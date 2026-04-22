const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runAudit() {
  const client = await pool.connect();
  try {
    console.log("--- Rogue IPC Forensic Audit ---");

    const query = `
      SELECT 
        e.ipc, 
        COUNT(*) as project_count, 
        MIN(e.school_id) as example_school_id,
        MIN(e.project_name) as example_project_name
      FROM engineer_form e
      WHERE NOT EXISTS (
        SELECT 1 FROM import_beff_projects i WHERE i.ipc = e.ipc
      )
      AND e.project_category = 'New Construction'
      GROUP BY e.ipc
      ORDER BY project_count DESC
    `;

    const res = await client.query(query);
    console.log(`Total Unique Rogue IPCs discovered: ${res.rows.length}`);
    
    let totalRogueRows = 0;
    res.rows.forEach(r => totalRogueRows += parseInt(r.project_count));
    console.log(`Total project records affected by rogue IPCs: ${totalRogueRows}`);

    if (res.rows.length > 0) {
      console.log("\nTop Rogue IPCs and Impact:");
      console.table(res.rows.slice(0, 10));
      
      const fs = require('fs');
      fs.writeFileSync('scratch/rogue_ipcs_detailed.json', JSON.stringify(res.rows, null, 2));
      console.log("\nDetailed rogue IPC report saved to scratch/rogue_ipcs_detailed.json");
    }

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

runAudit();
