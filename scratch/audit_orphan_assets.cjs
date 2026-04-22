const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runAudit() {
  const client = await pool.connect();
  try {
    console.log("--- Forensic Audit: Orphaned Project Assets ---");

    // Define Orphan Set (New Construction in EF, not in Master)
    const orphansQuery = `
      SELECT project_id, ipc, engineer_id, validation_status, pow_pdf, dupa_pdf, contract_pdf
      FROM engineer_form e
      WHERE project_category = 'New Construction'
      AND NOT EXISTS (SELECT 1 FROM import_beff_projects i WHERE i.ipc = e.ipc)
    `;

    const orphanRows = (await client.query(orphansQuery)).rows;
    const totalOrphans = orphanRows.length;
    console.log(`\nTotal Orphaned Projects identified: ${totalOrphans}`);

    // Audit assets
    let withPhotos = 0;
    let withDocs = 0;
    let createdByEngineer = 0;
    let withAttachedPDFs = 0;
    let pendingApproval = 0;

    for (const row of orphanRows) {
      // 1. Photos
      const photoRes = await client.query(`SELECT 1 FROM engineer_image WHERE project_id = $1 LIMIT 1`, [row.project_id]);
      if (photoRes.rows.length > 0) withPhotos++;

      // 2. Documents
      const docRes = await client.query(`SELECT 1 FROM engineer_documents WHERE project_id = $1 LIMIT 1`, [row.project_id]);
      if (docRes.rows.length > 0) withDocs++;

      // 3. Created by Engineer
      if (row.engineer_id) createdByEngineer++;

      // 4. Attached PDFs
      if (row.pow_pdf || row.dupa_pdf || row.contract_pdf) withAttachedPDFs++;

      // 5. Pending Approval
      if (row.validation_status === 'Pending' || row.validation_status === 'pending') pendingApproval++;
    }

    console.log("\n--- Audit Results ---");
    console.log(`With Photos:         ${withPhotos} (${((withPhotos/totalOrphans)*100).toFixed(2)}%)`);
    console.log(`With Documents:      ${withDocs} (${((withDocs/totalOrphans)*100).toFixed(2)}%)`);
    console.log(`With Inline PDF:     ${withAttachedPDFs} (${((withAttachedPDFs/totalOrphans)*100).toFixed(2)}%)`);
    console.log(`Created by Engineer: ${createdByEngineer} (${((createdByEngineer/totalOrphans)*100).toFixed(2)}%)`);
    console.log(`Pending Approval:    ${pendingApproval} (${((pendingApproval/totalOrphans)*100).toFixed(2)}%)`);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

runAudit();
