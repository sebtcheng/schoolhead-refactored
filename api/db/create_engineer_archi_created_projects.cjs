/**
 * create_engineer_archi_created_projects.cjs
 *
 * Extracts all app-created engineer projects from engineer_form into
 * the engineer_archi_created_projects table.
 *
 * IDENTIFICATION RULE:
 *   created_at IS NULL
 *   AND NOT EXISTS (same IPC with created_at IS NOT NULL)
 *
 * TWO-PART LOGIC:
 *   Part 1 — created_at IS NULL
 *     The engineer_form.created_at column has NO PostgreSQL DEFAULT.
 *     Neither POST /api/save-project nor PUT /api/update-project includes
 *     created_at in their INSERT column lists — it is never touched by the app.
 *     Only the two historical bulk-import scripts set created_at explicitly:
 *       Batch Import #1  (2026-03-27): 11,538 rows — also sets validation_status='Pending'
 *       Batch Import #2  (2026-04-08):  2,950 rows — validation_status left NULL
 *
 *   Part 2 — NOT EXISTS (same IPC with created_at IS NOT NULL)
 *     engineer_form is an APPEND-LOG table. Every app update inserts a new row
 *     (created_at IS NULL). So an imported project that an engineer later updated
 *     would have BOTH an import row (created_at set) AND an app-update row
 *     (created_at IS NULL). Without this filter, 365 such IPCs would be
 *     falsely classified as "app-created".
 *     This condition keeps only IPCs that were NEVER imported — genuinely born
 *     in the app by an engineer or architect.
 *
 *   Result: 1,334 rows across 1,215 unique IPCs — truly app-created projects.
 *
 * USAGE:
 *   node api/db/create_engineer_archi_created_projects.cjs [--dry-run] [--truncate]
 *
 *   --dry-run   : show counts, skip writes
 *   --truncate  : truncate table before re-populating (safe to re-run)
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { Pool } = require('pg');

const isDryRun = process.argv.includes('--dry-run');
const doTruncate = process.argv.includes('--truncate');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  try {
    // ── 1. Count source rows ───────────────────────────────────────────────
    const countRes = await client.query(`
      SELECT COUNT(*) AS total, COUNT(DISTINCT ipc) AS unique_ipcs
      FROM engineer_form
      WHERE created_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM engineer_form ef2
          WHERE ef2.ipc = engineer_form.ipc
            AND ef2.created_at IS NOT NULL
        )
    `);
    const total = parseInt(countRes.rows[0].total, 10);
    console.log(`[INFO] Truly app-created rows: ${total} (${countRes.rows[0].unique_ipcs} unique IPCs)`);

    if (isDryRun) {
      const breakdown = await client.query(`
        SELECT
          COUNT(*) FILTER (WHERE no_of_units IS NOT NULL) AS new_app_created,
          COUNT(*) FILTER (WHERE no_of_units IS NULL)     AS old_app_created,
          (
            SELECT COUNT(DISTINCT ipc) FROM engineer_form
            WHERE created_at IS NULL
          ) - (
            SELECT COUNT(DISTINCT ipc) FROM engineer_form
            WHERE created_at IS NULL
              AND NOT EXISTS (
                SELECT 1 FROM engineer_form ef2
                WHERE ef2.ipc = engineer_form.ipc AND ef2.created_at IS NOT NULL
              )
          ) AS ipcs_excluded_imported_then_updated
        FROM engineer_form
        WHERE created_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM engineer_form ef2
            WHERE ef2.ipc = engineer_form.ipc AND ef2.created_at IS NOT NULL
          )
      `);
      const b = breakdown.rows[0];
      console.log(`  new-style (has no_of_units)           : ${b.new_app_created}`);
      console.log(`  old-style (pre-column)                : ${b.old_app_created}`);
      console.log(`  excluded (imported then app-updated)  : ${b.ipcs_excluded_imported_then_updated} IPCs`);
      console.log('[DRY-RUN] No changes made.');
      return;
    }

    await client.query('BEGIN');

    // ── 2. Create target table if it doesn't exist ────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS engineer_archi_created_projects (
        LIKE engineer_form INCLUDING ALL
      )
    `);
    console.log('[INFO] Table engineer_archi_created_projects ensured.');

    // ── 3. Ensure origin_tag column exists ────────────────────────────────
    await client.query(`
      ALTER TABLE engineer_archi_created_projects
        ADD COLUMN IF NOT EXISTS origin_tag TEXT DEFAULT 'app-created'
    `);

    // ── 4. Optional truncate ──────────────────────────────────────────────
    if (doTruncate) {
      await client.query(`TRUNCATE TABLE engineer_archi_created_projects RESTART IDENTITY CASCADE`);
      console.log('[INFO] Table truncated (--truncate flag used).');
    }

    // ── 5. Copy rows ──────────────────────────────────────────────────────
    //    Get the exact column list from engineer_form (excluding project_id
    //    which is a serial and will be auto-assigned, and excluding origin_tag
    //    which doesn't exist in engineer_form).
    const colsRes = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'engineer_form'
        AND column_name != 'project_id'
      ORDER BY ordinal_position
    `);
    const cols = colsRes.rows.map(r => r.column_name);
    const colList = cols.map(c => `"${c}"`).join(', ');

    const insertRes = await client.query(`
      INSERT INTO engineer_archi_created_projects (${colList}, origin_tag)
      SELECT ${colList}, 'app-created'
      FROM engineer_form
      WHERE created_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM engineer_form ef2
          WHERE ef2.ipc = engineer_form.ipc
            AND ef2.created_at IS NOT NULL
        )
      ON CONFLICT DO NOTHING
    `);
    const inserted = insertRes.rowCount;
    console.log(`[INFO] Rows inserted: ${inserted}`);

    // ── 6. Verify ─────────────────────────────────────────────────────────
    const verifyRes = await client.query(`
      SELECT COUNT(*) AS total FROM engineer_archi_created_projects
    `);
    console.log(`[INFO] Total rows in engineer_archi_created_projects: ${verifyRes.rows[0].total}`);

    await client.query('COMMIT');
    console.log('[DONE] engineer_archi_created_projects populated successfully.');

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[ERROR]', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
