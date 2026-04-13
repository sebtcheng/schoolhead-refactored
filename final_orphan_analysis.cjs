const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const tables = [
      { name: 'engineer_image', hasIpc: true },
      { name: 'engineer_documents', hasIpc: true },
      { name: 'project_documents', hasIpc: false }, // Assume no IPC based on earlier crash
      { name: 'hrodi_project', hasIpc: false },
      { name: 'co_finance', hasIpc: false }
    ];
    
    console.log("📊 FINAL ORPHAN ANALYSIS");
    console.log("========================");

    for (const table of tables) {
      // 1. Total Orphans
      const totalRes = await pool.query(`
        SELECT COUNT(*) as count FROM ${table.name} t 
        WHERE NOT EXISTS (SELECT 1 FROM engineer_form e WHERE e.project_id = t.project_id);
      `);
      const total = parseInt(totalRes.rows[0].count);

      let relinkable = 0;
      if (table.hasIpc) {
          try {
              const relinkRes = await pool.query(`
                SELECT COUNT(*) as count FROM ${table.name} t 
                WHERE NOT EXISTS (SELECT 1 FROM engineer_form e WHERE e.project_id = t.project_id)
                AND EXISTS (SELECT 1 FROM engineer_form e WHERE e.ipc = t.ipc);
              `);
              relinkable = parseInt(relinkRes.rows[0].count);
          } catch (e) {
              console.log(`[Note] ${table.name} actually DOES NOT have IPC column.`);
              table.hasIpc = false;
          }
      }

      const unfixable = total - relinkable;
      console.log(`Table: ${table.name.padEnd(18)} | Total Orphans: ${total.toString().padEnd(5)} | Re-linkable: ${relinkable.toString().padEnd(5)} | Unfixable: ${unfixable}`);
    }

  } catch (e) {
    console.error("❌ ERROR:", e.message);
  } finally {
    await pool.end();
  }
}

run();
