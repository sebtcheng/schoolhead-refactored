const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const tables = ['engineer_image', 'engineer_documents', 'project_documents', 'hrodi_project', 'co_finance'];
    
    console.log("🔍 Checking for re-linkable orphans (using IPC)...");

    for (const table of tables) {
      const res = await pool.query(`
        SELECT COUNT(*) as count 
        FROM ${table} t 
        WHERE NOT EXISTS (
          SELECT 1 FROM engineer_form e WHERE e.project_id = t.project_id
        ) AND EXISTS (
          SELECT 1 FROM engineer_form e WHERE e.ipc = t.ipc
        );
      `);
      console.log(`Table: ${table} | Re-linkable via IPC: ${res.rows[0].count}`);
      
      const resTotal = await pool.query(`
        SELECT COUNT(*) as count 
        FROM ${table} t 
        WHERE NOT EXISTS (
          SELECT 1 FROM engineer_form e WHERE e.project_id = t.project_id
        );
      `);
      console.log(`Table: ${table} | Total Orphans: ${resTotal.rows[0].count}`);
    }

  } catch (e) {
    console.error("❌ ERROR:", e.message);
  } finally {
    await pool.end();
  }
}

run();
