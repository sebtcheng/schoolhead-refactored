import pg from 'pg';
const pool = new pg.Pool({
  connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
  ssl: { rejectUnauthorized: false }
});
async function chk() {
  try {
    const r = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'activity_logs'");
    console.log('Columns for activity_logs:');
    console.log(JSON.stringify(r.rows, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    pool.end();
  }
}
chk();
