const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const client = await pool.connect();
  try {
    console.log("--- Post-Migration Project Sampling ---");
    
    // Get 10 projects that were just updated (not in the legacy list but have INF- prefix)
    const res = await client.query(`
      SELECT ipc, project_id, project_category
      FROM engineer_form
      WHERE ipc LIKE 'INF-%'
      AND project_category = 'New Construction'
      LIMIT 10
    `);
    console.table(res.rows);

    for (const row of res.rows) {
      const matchRes = await client.query(`
        SELECT COUNT(*) FROM import_beff_projects WHERE ipc = $1
      `, [row.ipc]);
      console.log(`IPC ${row.ipc} matches in Import Table: ${matchRes.rows[0].count}`);
    }

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
