
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const res = await pool.query(`
      SELECT * FROM engineer_documents 
      WHERE ipc = 'INF-10-2026-00059' 
      ORDER BY created_at DESC
    `);
    console.log("Documents Found:", res.rows.length);
    console.log(JSON.stringify(res.rows, null, 2));

    const pRes = await pool.query('SELECT project_id, ipc FROM engineer_form WHERE project_id = 1000345');
    console.log("Engineer Form Record:", JSON.stringify(pRes.rows[0], null, 2));

  } catch (e) {
    console.error(e.message);
  } finally {
    await pool.end();
  }
}

run();
