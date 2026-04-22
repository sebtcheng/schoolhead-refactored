const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  const client = await pool.connect();
  try {
    console.log("--- FINAL CROSS-TABLE IPC ANALYSIS ---");
    
    const tables = [
      { name: 'engineer_form', category: "project_category ILIKE '%New Con%'" },
      { name: 'engineer_create', category: "project_category ILIKE '%New Con%'" },
      { name: 'engineer_form_outbox', category: "1=1" } // Outbox is already filtered to orphans
    ];

    for (const t of tables) {
      const res = await client.query(`SELECT count(DISTINCT ipc) FROM ${t.name} WHERE ${t.category}`);
      console.log(`${t.name.padEnd(25)}: ${res.rows[0].count} unique IPCs`);
    }

    const totalUniqueRes = await client.query(`
      SELECT count(DISTINCT ipc) FROM (
        SELECT ipc FROM engineer_form WHERE project_category ILIKE '%New Con%'
        UNION ALL
        SELECT ipc FROM engineer_create WHERE project_category ILIKE '%New Con%'
        UNION ALL
        SELECT ipc FROM engineer_form_outbox
      ) combined
    `);
    console.log(`\nGrand Total Unique IPCs: ${totalUniqueRes.rows[0].count}`);
    
    const masterRes = await client.query(`SELECT count(*) FROM import_beff_projects`);
    console.log(`Master List (BEFF) Total: ${masterRes.rows[0].count}`);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
