const pg = require('pg');
const { Pool } = pg;

const dbUrl = 'postgres://Administrator1:<REDACTED_PGB_PASS>@20.24.58.49:6432/insightEd';
const pool = new Pool({
  connectionString: dbUrl,
  ssl: false
});

async function diagnose() {
  try {
    console.log("🔍 Fetching details for PID 848 (and other long queries)...");
    const res = await pool.query(`
      SELECT pid, now() - query_start AS duration, wait_event_type, wait_event, state, query 
      FROM pg_stat_activity 
      WHERE state != 'idle' 
        AND (now() - query_start) > interval '1 minute'
      ORDER BY duration DESC;
    `);
    console.log("LONG_QUERIES:" + JSON.stringify(res.rows, null, 2));

  } catch (err) {
    console.error("DIAGNOSTICS_ERROR:" + err.message);
  } finally {
    await pool.end();
  }
}

diagnose();
