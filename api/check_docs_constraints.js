
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const res = await pool.query(`
      SELECT conname, contype 
      FROM pg_constraint 
      WHERE conrelid = 'engineer_documents'::regclass
    `);
    console.log("Constraints:", JSON.stringify(res.rows, null, 2));

    const idxRes = await pool.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'engineer_documents'
    `);
    console.log("Indexes:", JSON.stringify(idxRes.rows, null, 2));

  } catch (e) {
    console.error(e.message);
  } finally {
    await pool.end();
  }
}

run();
