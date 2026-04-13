const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const tables = ['engineer_image', 'engineer_documents', 'project_documents', 'hrodi_project', 'co_finance'];
    
    console.log("🔍 Checking for orphaned records (not found in newest engineer_form)...");

    for (const table of tables) {
      const res = await pool.query(`
        SELECT COUNT(*) as count 
        FROM ${table} t 
        WHERE NOT EXISTS (
          SELECT 1 FROM engineer_form e WHERE e.project_id = t.project_id
        );
      `);
      console.log(`Table: ${table} | Orphans: ${res.rows[0].count}`);
    }

    // Let's also check if they exist in the backup
    console.log("\n🔍 Checking if orphans exist in engineer_form_messy_backup...");
    for (const table of tables) {
      const res = await pool.query(`
        SELECT COUNT(*) as count 
        FROM ${table} t 
        WHERE EXISTS (
          SELECT 1 FROM engineer_form_messy_backup b WHERE b.project_id = t.project_id
        ) AND NOT EXISTS (
          SELECT 1 FROM engineer_form e WHERE e.project_id = t.project_id
        );
      `);
      console.log(`Table: ${table} | Found in Backup: ${res.rows[0].count}`);
    }

  } catch (e) {
    console.error("❌ ERROR:", e.message);
  } finally {
    await pool.end();
  }
}

run();
