const pg = require('pg');
const { Pool } = pg;

const dbUrl = 'postgres://Administrator1:<REDACTED_PGB_PASS>@20.24.58.49:6432/insightEd';
const pool = new Pool({
  connectionString: dbUrl,
  ssl: false
});

async function diagnose() {
  try {
    const connections = await pool.query(`
      SELECT count(*), application_name, state 
      FROM pg_stat_activity 
      GROUP BY application_name, state
      ORDER BY count DESC;
    `);
    console.log("CONNECTIONS_JSON:" + JSON.stringify(connections.rows));

    const locks = await pool.query(`
      SELECT pid, now() - query_start AS duration, wait_event_type, wait_event, state, query 
      FROM pg_stat_activity 
      WHERE state != 'idle' 
        AND (now() - query_start) > interval '1 second'
      ORDER BY duration DESC;
    `);
    console.log("LOCKS_JSON:" + JSON.stringify(locks.rows));

    const backendCount = await pool.query("SELECT count(*) FROM pg_stat_activity");
    console.log("BACKEND_COUNT:" + backendCount.rows[0].count);

  } catch (err) {
    console.error("DIAGNOSTICS_ERROR:" + err.message);
  } finally {
    await pool.end();
  }
}

diagnose();
