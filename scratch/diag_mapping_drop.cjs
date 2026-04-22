const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function diag() {
  const client = await pool.connect();
  try {
    const totalNC = await client.query(`SELECT COUNT(*) FROM engineer_form WHERE project_category = 'New Construction'`);
    console.log("Total New Construction in EF:", totalNC.rows[0].count);

    const matchIPC = await client.query(`
      SELECT COUNT(*) 
      FROM engineer_form e
      WHERE EXISTS (SELECT 1 FROM import_beff_projects i WHERE i.ipc = e.ipc)
      AND e.project_category = 'New Construction'
    `);
    console.log("Total NC in EF with IPC match:", matchIPC.rows[0].count);

    const nonMatchIPC = await client.query(`
      SELECT COUNT(*) 
      FROM engineer_form e
      WHERE NOT EXISTS (SELECT 1 FROM import_beff_projects i WHERE i.ipc = e.ipc)
      AND e.project_category = 'New Construction'
    `);
    console.log("Total NC in EF WITHOUT IPC match:", nonMatchIPC.rows[0].count);

    // Try the join again with very loose criteria
    const looseJoin = await client.query(`
      SELECT COUNT(*)
      FROM engineer_form e
      JOIN import_beff_projects i ON e.school_id::text = i.school_id::text
      WHERE NOT EXISTS (SELECT 1 FROM import_beff_projects i2 WHERE i2.ipc = e.ipc)
      AND e.project_category = 'New Construction'
    `);
    console.log("Total Non-IPC NC matching ONLY on school_id:", looseJoin.rows[0].count);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

diag();
