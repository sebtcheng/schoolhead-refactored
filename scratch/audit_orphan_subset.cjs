const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runAudit() {
  const client = await pool.connect();
  try {
    console.log("--- Refined Forensic Audit: Standard IPC Orphans (5,105 Subset) ---");

    // Define Orphan Set (Standard INF- IPC in EF, not in Master 44,456 list)
    const orphansQuery = `
      SELECT project_id, ipc, engineer_id, validation_status
      FROM engineer_form e
      WHERE project_category = 'New Construction'
      AND ipc LIKE 'INF-%'
      AND NOT EXISTS (SELECT 1 FROM import_beff_projects i WHERE i.ipc = e.ipc)
    `;

    const orphanRows = (await client.query(orphansQuery)).rows;
    const totalOrphans = orphanRows.length;
    console.log(`\nTotal Standard IPC Orphans identified: ${totalOrphans}`);

    // Audit assets
    let withPhotos = 0;
    let withDocs = 0;
    let createdByEngineer = 0;

    for (const row of orphanRows) {
      const photoRes = await client.query(`SELECT 1 FROM engineer_image WHERE project_id = $1 LIMIT 1`, [row.project_id]);
      if (photoRes.rows.length > 0) withPhotos++;

      const docRes = await client.query(`SELECT 1 FROM engineer_documents WHERE project_id = $1 LIMIT 1`, [row.project_id]);
      if (docRes.rows.length > 0) withDocs++;

      if (row.engineer_id) createdByEngineer++;
    }

    console.log("\n--- Audit Results (5,105 Subset) ---");
    console.log(`With Photos:         ${withPhotos} (${((withPhotos/totalOrphans)*100).toFixed(2)}%)`);
    console.log(`With Documents:      ${withDocs} (${((withDocs/totalOrphans)*100).toFixed(2)}%)`);
    console.log(`Created by Engineer: ${createdByEngineer} (${((createdByEngineer/totalOrphans)*100).toFixed(2)}%)`);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

runAudit();
