const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  const client = await pool.connect();
  try {
    console.log("--- PINPOINT COUNT VERIFICATION ---");
    
    // 1. Exact query from user's screenshot
    const userQueryRes = await client.query(`
       SELECT count(*) FROM engineer_form ef WHERE ef.project_category ILIKE '%New Con%'
    `);
    console.log(`User query [count(*)]: ${userQueryRes.rows[0].count}`);

    // 2. Unique IPCs for the same set
    const uniqueIpcRes = await client.query(`
       SELECT count(DISTINCT ipc) FROM engineer_form ef WHERE ef.project_category ILIKE '%New Con%'
    `);
    console.log(`User query [unique IPC]: ${uniqueIpcRes.rows[0].count}`);

    // 3. Master List Total
    const masterRes = await client.query(`SELECT count(*) FROM import_beff_projects`);
    console.log(`Master List Total: ${masterRes.rows[0].count}`);

    // 4. Orphan check
    const orphanRes = await client.query(`
       SELECT count(*) FROM engineer_form e 
       WHERE e.project_category ILIKE '%New Con%'
       AND NOT EXISTS (SELECT 1 FROM import_beff_projects i WHERE i.ipc = e.ipc)
    `);
    console.log(`Orphans remaining in engineer_form: ${orphanRes.rows[0].count}`);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
