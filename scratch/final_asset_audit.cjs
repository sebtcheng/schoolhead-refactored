const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const client = await pool.connect();
  try {
    console.log("--- FINAL ASSET INTEGRITY AUDIT ---");
    
    // 1. Photos in Active Outbox
    const photoRes = await client.query(`
      SELECT COUNT(*) 
      FROM engineer_image im 
      JOIN engineer_create ec ON im.project_id = ec.project_id
    `);
    console.log(`Photos linked to active outbox (engineer_create): ${photoRes.rows[0].count}`);

    // 2. Documents in Active Outbox
    const docRes = await client.query(`
      SELECT COUNT(*) 
      FROM engineer_documents doc 
      JOIN engineer_create ec ON doc.project_id = ec.project_id
    `);
    console.log(`Docs linked to active outbox (engineer_create): ${docRes.rows[0].count}`);

    // 3. Orphans in engineer_form (Should be 0)
    const orphanRes = await client.query(`
      SELECT COUNT(*) FROM engineer_form e
      WHERE project_category = 'New Construction'
      AND ipc LIKE 'INF-%'
      AND NOT EXISTS (SELECT 1 FROM import_beff_projects i WHERE i.ipc = e.ipc)
    `);
    console.log(`Remaining orphans in engineer_form: ${orphanRes.rows[0].count}`);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
