const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("--- STARTING TWO-TIER ORPHAN MIGRATION (V5) ---");

    // 1. Sync Outbox Schema
    await client.query(`ALTER TABLE engineer_form_outbox ADD COLUMN IF NOT EXISTS project_id INTEGER`);
    await client.query(`ALTER TABLE engineer_form_outbox ADD COLUMN IF NOT EXISTS funding_year_justification TEXT`);
    await client.query(`ALTER TABLE engineer_form_outbox ADD COLUMN IF NOT EXISTS implementing_agency_specific TEXT`);

    // 2. Identify Orphans (5,105)
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

    // Get Clean Source Columns
    const efColsRes = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'engineer_form'`);
    const efColumns = efColsRes.rows.map(r => r.column_name).filter(c => {
       // STRICT FILTER: Only standard columns, no spaces, no totals
       return !c.includes(' ') && !c.toLowerCase().includes('total');
    });

    let activeCount = 0;
    let inactiveCount = 0;
    let conflictCount = 0;

    for (const project of orphans) {
      const hasPhotosRes = await client.query(`SELECT 1 FROM engineer_image WHERE project_id = $1 LIMIT 1`, [project.project_id]);
      const hasDocsRes = await client.query(`SELECT 1 FROM engineer_documents WHERE project_id = $1 LIMIT 1`, [project.project_id]);
      const isActive = project.engineer_id || hasPhotosRes.rows.length > 0 || hasDocsRes.rows.length > 0;

      const targetTable = isActive ? 'engineer_create' : 'engineer_form_outbox';
      
      const targetColsRes = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = $1`, [targetTable]);
      const targetCols = new Set(targetColsRes.rows.map(r => r.column_name));

      const validCols = efColumns.filter(c => targetCols.has(c));
      const colStr = validCols.map(c => `"${c}"`).join(', ');
      const valStr = validCols.map((_, i) => `$${i + 1}`).join(', ');
      const vals = validCols.map(c => project[c]);

      // Manuel existence check to avoid ON CONFLICT errors on tables without PK
      const exists = await client.query(`SELECT 1 FROM ${targetTable} WHERE project_id = $1`, [project.project_id]);
      if (exists.rows.length === 0) {
         await client.query(`INSERT INTO ${targetTable} (${colStr}) VALUES (${valStr})`, vals);
         if (isActive) activeCount++; else inactiveCount++;
      } else {
         conflictCount++;
      }
    }

    // 4. Cleanup
    const orphanIds = orphans.map(p => p.project_id);
    if (orphanIds.length > 0) {
      await client.query(`DELETE FROM engineer_form WHERE project_id = ANY($1)`, [orphanIds]);
    }

    await client.query('COMMIT');
    console.log(`\nSUCCESS: Tier 1: ${activeCount}, Tier 2: ${inactiveCount}, Conflicts Skipped: ${conflictCount}`);

  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
