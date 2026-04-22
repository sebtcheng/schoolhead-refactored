const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  const client = await pool.connect();
  try {
    console.log("--- LOW-LEVEL SERVER METADATA ---");
    
    // 1. Server Identifiers
    const meta = await client.query(`
      SELECT 
        current_setting('server_version') as version,
        current_setting('server_encoding') as encoding,
        inet_server_addr() as addr,
        current_database() as db
    `);
    console.table(meta.rows);

    // 2. Table Metadata
    const tbl = await client.query(`
      SELECT 
        c.oid, 
        c.relname, 
        c.reltuples,
        pg_size_pretty(pg_total_relation_size(c.oid)) as total_size
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = 'import_beff_projects'
      AND n.nspname = 'public'
    `);
    console.table(tbl.rows);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
