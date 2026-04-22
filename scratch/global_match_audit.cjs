const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT COUNT(*) 
      FROM engineer_form e 
      WHERE project_category = 'New Construction' 
      AND ipc LIKE 'INF-%' 
      AND EXISTS (SELECT 1 FROM import_beff_projects i WHERE i.ipc = e.ipc)
    `);
    console.log("Projects in EF (New Construction) with ANY IPC match in Master: " + res.rows[0].count);

    const totalNC = await client.query(`
      SELECT COUNT(*) FROM engineer_form WHERE project_category = 'New Construction' AND ipc LIKE 'INF-%'
    `);
    console.log("Total NC Projects in EF with INF- IPC: " + totalNC.rows[0].count);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
