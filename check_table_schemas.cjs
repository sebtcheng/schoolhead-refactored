const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const tables = ['engineer_image', 'engineer_documents', 'project_documents', 'hrodi_project', 'co_finance'];
    
    console.log("🔍 Checking columns for relevant tables...");

    for (const table of tables) {
      const res = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1;
      `, [table]);
      const columns = res.rows.map(r => r.column_name);
      console.log(`Table: ${table} | Columns: ${columns.join(', ')}`);
    }

  } catch (e) {
    console.error("❌ ERROR:", e.message);
  } finally {
    await pool.end();
  }
}

run();
