const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd', ssl: { rejectUnauthorized: false } });

async function listAllTables() {
  try {
    const res = await pool.query(`SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('information_schema', 'pg_catalog')`);
    console.log(JSON.stringify(res.rows));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

listAllTables();
