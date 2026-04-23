const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ph_schools' AND column_name LIKE 'unit%'");
  console.log(JSON.stringify(res.rows, null, 2));
  await pool.end();
}
check();
