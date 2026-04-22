/**
 * Diagnostic: engineer_image IPC Linkage Audit + Safe Backfill
 *
 * Categories checked:
 *   1. Total images
 *   2. IPC-tagged and valid (IPC exists in engineer_form)
 *   3. Null IPC, backfillable (project_id links to project with non-null IPC)
 *   4. Null IPC, project has no IPC (parent project also untagged — not repairable here)
 *   5. Null IPC, no project_id (fully orphaned — report only, no action)
 *   6. Stale/dangling IPC (ipc set but no matching engineer_form row — report only)
 *
 * Backfills category 3 only. No DELETEs.
 */

const { Pool } = require('pg');
require('dotenv').config();

const POOLS = [
  { label: 'PRIMARY', url: process.env.DATABASE_URL },
  { label: 'SECONDARY', url: process.env.NEW_DATABASE_URL },
].filter(p => p.url);

function pct(n, total) {
  if (!total) return '0.00%';
  return ((n / total) * 100).toFixed(2) + '%';
}

async function auditPool({ label, url }) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  DB: ${label}`);
  console.log('='.repeat(60));

  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();

  try {
    // 1. Total
    const totalRes = await client.query(`SELECT COUNT(*) AS n FROM engineer_image`);
    const total = parseInt(totalRes.rows[0].n, 10);
    console.log(`\nTotal engineer_image rows : ${total}`);

    // 2. IPC-tagged and valid
    const taggedRes = await client.query(`
      SELECT COUNT(*) AS n
      FROM engineer_image ei
      WHERE ei.ipc IS NOT NULL
        AND EXISTS (SELECT 1 FROM engineer_form ef WHERE ef.ipc = ei.ipc)
    `);
    const tagged = parseInt(taggedRes.rows[0].n, 10);

    // 3. Null IPC, backfillable
    const backfillRes = await client.query(`
      SELECT COUNT(*) AS n
      FROM engineer_image ei
      JOIN engineer_form ef ON ef.project_id = ei.project_id
      WHERE ei.ipc IS NULL
        AND ef.ipc IS NOT NULL
    `);
    const backfillable = parseInt(backfillRes.rows[0].n, 10);

    // 4. Null IPC, project has no IPC
    const parentNoIpcRes = await client.query(`
      SELECT COUNT(*) AS n
      FROM engineer_image ei
      JOIN engineer_form ef ON ef.project_id = ei.project_id
      WHERE ei.ipc IS NULL
        AND ef.ipc IS NULL
    `);
    const parentNoIpc = parseInt(parentNoIpcRes.rows[0].n, 10);

    // 5. Null IPC, no project_id (fully orphaned)
    const orphanRes = await client.query(`
      SELECT COUNT(*) AS n
      FROM engineer_image
      WHERE ipc IS NULL
        AND project_id IS NULL
    `);
    const orphaned = parseInt(orphanRes.rows[0].n, 10);

    // 6. Stale/dangling IPC (ipc set but no matching engineer_form)
    const staleRes = await client.query(`
      SELECT COUNT(*) AS n
      FROM engineer_image ei
      WHERE ei.ipc IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM engineer_form ef WHERE ef.ipc = ei.ipc)
    `);
    const stale = parseInt(staleRes.rows[0].n, 10);

    console.log(`\n--- Breakdown ---`);
    console.log(`  [1] Total                            : ${total}`);
    console.log(`  [2] IPC-tagged & valid               : ${tagged}  (${pct(tagged, total)})`);
    console.log(`  [3] Null IPC — backfillable          : ${backfillable}  (${pct(backfillable, total)})`);
    console.log(`  [4] Null IPC — parent project no IPC : ${parentNoIpc}  (${pct(parentNoIpc, total)})`);
    console.log(`  [5] Null IPC — no project at all     : ${orphaned}  (${pct(orphaned, total)})`);
    console.log(`  [6] Stale/dangling IPC               : ${stale}  (${pct(stale, total)})`);

    const unaccounted = total - tagged - backfillable - parentNoIpc - orphaned - stale;
    if (unaccounted !== 0) {
      console.log(`  [!] Unaccounted rows (overlap/edge)  : ${unaccounted}`);
    }

    // --- Sample stale IPC values for visibility ---
    if (stale > 0) {
      const staleSampleRes = await client.query(`
        SELECT DISTINCT ei.ipc, COUNT(*) AS photo_count
        FROM engineer_image ei
        WHERE ei.ipc IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM engineer_form ef WHERE ef.ipc = ei.ipc)
        GROUP BY ei.ipc
        ORDER BY photo_count DESC
        LIMIT 20
      `);
      console.log(`\n  Stale IPC sample (top 20 by photo count):`);
      for (const row of staleSampleRes.rows) {
        console.log(`    IPC: ${row.ipc}  |  photos: ${row.photo_count}`);
      }
    }

    // --- Sample orphaned rows ---
    if (orphaned > 0) {
      const orphanSampleRes = await client.query(`
        SELECT id, uploaded_by, category, created_at
        FROM engineer_image
        WHERE ipc IS NULL AND project_id IS NULL
        ORDER BY created_at DESC
        LIMIT 10
      `);
      console.log(`\n  Fully orphaned image sample (latest 10):`);
      for (const row of orphanSampleRes.rows) {
        console.log(`    id=${row.id}  uploaded_by=${row.uploaded_by}  category=${row.category}  created_at=${row.created_at}`);
      }
    }

    // --- Backfill category 3 ---
    if (backfillable > 0) {
      console.log(`\n--- Backfill: applying IPC from parent project ---`);
      const backfillUpdate = await client.query(`
        UPDATE engineer_image ei
        SET ipc = ef.ipc
        FROM engineer_form ef
        WHERE ei.project_id = ef.project_id
          AND ei.ipc IS NULL
          AND ef.ipc IS NOT NULL
        RETURNING ei.id
      `);
      console.log(`  ✅ Backfilled ${backfillUpdate.rowCount} engineer_image rows with IPC from engineer_form`);
    } else {
      console.log(`\n  No backfillable rows — nothing to update.`);
    }

    // --- Post-backfill totals ---
    const afterTaggedRes = await client.query(`
      SELECT COUNT(*) AS n
      FROM engineer_image ei
      WHERE ei.ipc IS NOT NULL
        AND EXISTS (SELECT 1 FROM engineer_form ef WHERE ef.ipc = ei.ipc)
    `);
    const afterTagged = parseInt(afterTaggedRes.rows[0].n, 10);
    const afterNullRes = await client.query(`SELECT COUNT(*) AS n FROM engineer_image WHERE ipc IS NULL`);
    const afterNull = parseInt(afterNullRes.rows[0].n, 10);

    console.log(`\n--- Post-Backfill Summary ---`);
    console.log(`  IPC-tagged & valid  : ${afterTagged}  (${pct(afterTagged, total)})`);
    console.log(`  Still null IPC      : ${afterNull}  (${pct(afterNull, total)})`);
    console.log(`  Stale IPC (report)  : ${stale}  — no action taken`);
    console.log(`  Orphaned (report)   : ${orphaned}  — no action taken`);

  } catch (err) {
    console.error(`❌ [${label}] Error:`, err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

(async () => {
  if (POOLS.length === 0) {
    console.error('No DATABASE_URL configured in .env');
    process.exit(1);
  }
  for (const p of POOLS) {
    await auditPool(p);
  }
  console.log('\nDone.\n');
})();
