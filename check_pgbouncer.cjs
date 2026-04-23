const pg = require('pg');

const dbUrl = 'postgres://pgbouncer:<REDACTED_PGB_PASS>@20.24.58.49:6432/pgbouncer';
const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: false
});

async function checkBouncer() {
  try {
    console.log("🔍 Checking PgBouncer POOLS...");
    const pools = await pool.query('SHOW POOLS');
    console.log("POOLS_JSON:" + JSON.stringify(pools.rows));

    console.log("\n🔍 Checking PgBouncer CLIENTS...");
    const clients = await pool.query('SHOW CLIENTS');
    console.log("CLIENTS_JSON:" + JSON.stringify(clients.rows));

  } catch (err) {
    console.error("BOUNCER_ERROR:" + err.message);
  } finally {
    await pool.end();
  }
}

checkBouncer();
