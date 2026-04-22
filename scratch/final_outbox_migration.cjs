const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("--- STARTING TWO-TIER ORPHAN MIGRATION ---");

    // 1. Sync Outbox Schema (Adding the 3 missing columns)
    console.log("Syncing engineer_form_outbox schema...");
    await client.query(`ALTER TABLE engineer_form_outbox ADD COLUMN IF NOT EXISTS project_id INTEGER`);
    await client.query(`ALTER TABLE engineer_form_outbox ADD COLUMN IF NOT EXISTS funding_year_justification TEXT`);
    await client.query(`ALTER TABLE engineer_form_outbox ADD COLUMN IF NOT EXISTS implementing_agency_specific TEXT`);

    // 2. Identify the 5,105 orphan projects (INF- IPC, not in master)
    console.log("Identifying orphaned projects...");
    const orphanRes = await client.query(`
      SELECT * FROM engineer_form e
      WHERE project_category = 'New Construction'
      AND ipc LIKE 'INF-%'
      AND NOT EXISTS (SELECT 1 FROM import_beff_projects i WHERE i.ipc = e.ipc)
    `);
    const orphans = orphanRes.rows;
    console.log(`Discovered ${orphans.length} orphans.`);

    // 3. Begin Transaction
    await client.query('BEGIN');
    console.log("Transaction started...");

    // Get table column names to build dynamic INSERTs
    const efColsRes = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'engineer_form'`);
    const efColumns = efColsRes.rows.map(r => r.column_name);

    let activeCount = 0;
    let inactiveCount = 0;

    for (const project of orphans) {
      // Logic for Active: engineer_id is not null OR has records in image/docs
      const hasPhotosRes = await client.query(`SELECT 1 FROM engineer_image WHERE project_id = $1 LIMIT 1`, [project.project_id]);
      const hasDocsRes = await client.query(`SELECT 1 FROM engineer_documents WHERE project_id = $1 LIMIT 1`, [project.project_id]);
      
      const isActive = project.engineer_id || hasPhotosRes.rows.length > 0 || hasDocsRes.rows.length > 0;

      const targetTable = isActive ? 'engineer_create' : 'engineer_form_outbox';
      
      // Build DYNAMIC INSERT
      // We filter columns that exist in BOTH to be safe
      const targetColsRes = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = $1`, [targetTable]);
      const targetCols = new Set(targetColsRes.rows.map(r => r.column_name));

      const commonCols = efColumns.filter(c => targetCols.has(c) && !c.toLowerCase().includes('total columns'));
      const colStr = commonCols.map(c => `"${c}"`).join(', ');
      const valStr = commonCols.map((_, i) => `$${i + 1}`).join(', ');
      const vals = commonCols.map(c => project[c]);

      // Handle Tier 2 special columns (original_project_id, outbox_reason)
      if (!isActive) {
        // Find existing index for project_id column if needed, but since I added it to outbox, I'll just use commonCols.
      }

      await client.query(`INSERT INTO ${targetTable} (${colStr}) VALUES (${valStr})`, vals);

      if (isActive) activeCount++; else inactiveCount++;
    }

    // 4. Cleanup: Delete migrated rows from engineer_form
    console.log("Cleaning up engineer_form...");
    const orphanIds = orphans.map(p => p.project_id);
    if (orphanIds.length > 0) {
      // Using IN clause for deletion
      await client.query(`DELETE FROM engineer_form WHERE project_id = ANY($1)`, [orphanIds]);
    }

    await client.query('COMMIT');
    console.log(`\nSUCCESS: Migration Complete.`);
    console.log(`Tier 1 (Active -> engineer_create): ${activeCount}`);
    console.log(`Tier 2 (Inactive -> engineer_form_outbox): ${inactiveCount}`);
    console.log(`Total Cleaned up: ${activeCount + inactiveCount}`);

  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error("\nMIGRATION FAILED - Transaction Rolled Back.");
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
