const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  const client = await pool.connect();
  try {
    console.log("--- ENVIRONMENT AUDIT ---");
    
    const dbName = await client.query("SELECT current_database()");
    const curUser = await client.query("SELECT current_user");
    const version = await client.query("SELECT version()");
    const host = await client.query("SELECT inet_server_addr(), inet_server_port()");

    console.log(`Database Name: ${dbName.rows[0].current_database}`);
    console.log(`Current User : ${curUser.rows[0].current_user}`);
    console.log(`Host Address : ${host.rows[0].inet_server_addr}:${host.rows[0].inet_server_port}`);
    console.log(`PG Version   : ${version.rows[0].version}`);

    console.log("\n--- TABLE CENSUS ---");
    const countAll = await client.query("SELECT COUNT(*) FROM public.import_beff_projects");
    console.log(`Total Rows in public.import_beff_projects: ${countAll.rows[0].count}`);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
