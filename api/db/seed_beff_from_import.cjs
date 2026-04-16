/**
 * seed_beff_from_import.cjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Imports all rows from import_beff_projects → engineer_imported_beff.
 *
 * What this script does:
 *   1. Reads the live column list of both tables from information_schema
 *   2. Adds any columns that exist in import_beff_projects but NOT in
 *      engineer_imported_beff (preserving their original data type)
 *   3. Generates IPC codes (INF-B-YYYY-NNNNN) for every row, grouped by
 *      funding_year (falls back to 0000 when funding_year is NULL)
 *   4. Inserts all rows in one transaction — idempotent (skips duplicates)
 *
 * Usage:
 *   node api/db/seed_beff_from_import.cjs
 *
 * Pass --dry-run to inspect what will happen without writing anything.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { Pool } = require('pg');

const DRY_RUN = process.argv.includes('--dry-run');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ── Column name mapping: source → target ─────────────────────────────────────
// Add entries here for any source column whose name differs in the target table.
const COLUMN_REMAP = {
  notice_to_proceed_date: 'notice_to_proceed',
};

// Columns in the source that we handle specially and must NOT be auto-added
const SKIP_SOURCE_COLS = new Set([
  'notice_to_proceed_date', // remapped above
]);

// ── Map information_schema data_type → safe DDL type ─────────────────────────
function ddlType(pgType) {
  if (['integer', 'bigint', 'smallint'].includes(pgType)) return 'TEXT';
  if (['numeric', 'decimal', 'real', 'double precision'].includes(pgType)) return 'NUMERIC';
  if (['date', 'timestamp without time zone', 'timestamp with time zone'].includes(pgType))
    return 'TIMESTAMPTZ';
  if (pgType === 'boolean') return 'BOOLEAN';
  return 'TEXT';
}

// ── Left-pad a number for the IPC sequence ───────────────────────────────────
function padSeq(n) {
  return String(n).padStart(5, '0');
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  const client = await pool.connect();
  try {
    // ── 1. Fetch live column lists ────────────────────────────────────────────
    const [srcMeta, dstMeta] = await Promise.all([
      client.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'import_beff_projects'
        ORDER BY ordinal_position
      `),
      client.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'engineer_imported_beff'
        ORDER BY ordinal_position
      `),
    ]);

    const srcCols = srcMeta.rows;   // { column_name, data_type }[]
    const dstColSet = new Set(dstMeta.rows.map(r => r.column_name));

    console.log(`\n${'─'.repeat(70)}`);
    console.log(`  import_beff_projects   : ${srcCols.length} columns`);
    console.log(`  engineer_imported_beff : ${dstMeta.rows.length} columns`);

    // ── 2. Find columns to add ────────────────────────────────────────────────
    const toAdd = srcCols.filter(c => {
      if (SKIP_SOURCE_COLS.has(c.column_name)) return false;
      const targetName = COLUMN_REMAP[c.column_name] || c.column_name;
      return !dstColSet.has(targetName);
    });

    if (toAdd.length === 0) {
      console.log(`\n  ✅ No new columns to add — engineer_imported_beff already has all source columns.`);
    } else {
      console.log(`\n  Columns to add to engineer_imported_beff (${toAdd.length}):`);
      toAdd.forEach(c => console.log(`    + ${c.column_name}  →  ${ddlType(c.data_type)}`));
    }

    // ── 3. Count source rows ──────────────────────────────────────────────────
    const countRes = await client.query(`SELECT COUNT(*) FROM import_beff_projects`);
    const totalRows = parseInt(countRes.rows[0].count, 10);
    console.log(`\n  Rows to import: ${totalRows.toLocaleString()}`);

    // ── 4. Count already-imported rows ───────────────────────────────────────
    const existingRes = await client.query(`SELECT COUNT(*) FROM engineer_imported_beff`);
    const existingRows = parseInt(existingRes.rows[0].count, 10);
    if (existingRows > 0) {
      console.log(`  ⚠️  engineer_imported_beff already has ${existingRows.toLocaleString()} rows.`);
      console.log(`     Existing IPCs will be skipped (ON CONFLICT DO NOTHING).`);
    }

    if (DRY_RUN) {
      console.log(`\n  🔎  DRY RUN — no changes written.\n`);
      return;
    }

    // ── 5. Begin transaction ──────────────────────────────────────────────────
    await client.query('BEGIN');

    // ── 6. Add missing columns + relax NOT NULL on nullable source cols ──────
    if (toAdd.length > 0) {
      console.log(`\n  Adding missing columns...`);
      for (const col of toAdd) {
        const type = ddlType(col.data_type);
        await client.query(
          `ALTER TABLE engineer_imported_beff ADD COLUMN IF NOT EXISTS ${col.column_name} ${type}`
        );
        console.log(`    ✅ Added ${col.column_name} (${type})`);
      }
    }

    // school_id and school_name may be NULL in source data — relax constraints
    console.log(`\n  Relaxing NOT NULL on school_id / school_name to allow source NULLs...`);
    await client.query(`ALTER TABLE engineer_imported_beff ALTER COLUMN school_id  DROP NOT NULL`);
    await client.query(`ALTER TABLE engineer_imported_beff ALTER COLUMN school_name DROP NOT NULL`);
    console.log(`    ✅ Done`);

    // ── 7. Fetch all source rows ──────────────────────────────────────────────
    console.log(`\n  Fetching source rows...`);
    const srcRows = await client.query(`SELECT * FROM import_beff_projects ORDER BY funding_year, school_name, project_name`);
    console.log(`  Fetched ${srcRows.rows.length.toLocaleString()} rows.`);

    // ── 8. Build per-year IPC sequences ──────────────────────────────────────
    // Find the highest existing sequence per year so we don't collide
    const seqMap = {}; // year → next sequence number
    const existingIpcs = await client.query(`
      SELECT ipc FROM engineer_imported_beff WHERE ipc LIKE 'INF-B-%'
    `);
    existingIpcs.rows.forEach(({ ipc }) => {
      // format: INF-B-YYYY-NNNNN
      const m = ipc.match(/^INF-B-(\d{4})-(\d+)$/);
      if (m) {
        const yr = m[1];
        const seq = parseInt(m[2], 10);
        seqMap[yr] = Math.max(seqMap[yr] || 0, seq);
      }
    });

    // ── 9. Build INSERT column list ───────────────────────────────────────────
    // All columns that exist in the target after step 6, derived from source
    const refreshedDst = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'engineer_imported_beff'
      ORDER BY ordinal_position
    `);
    const dstColsNow = new Set(refreshedDst.rows.map(r => r.column_name));

    // Build a mapping: targetColName → sourceColName (or null if generated/not in source)
    const srcColNames = new Set(srcCols.map(c => c.column_name));
    const insertMapping = []; // { target, source }

    for (const dstCol of refreshedDst.rows) {
      const tgt = dstCol.column_name;
      if (tgt === 'ipc') continue; // generated below
      if (tgt === 'imported_at') continue; // defaults to NOW()
      if (tgt === 'imported_by') continue; // set to 'seed_script'

      // check direct name
      if (srcColNames.has(tgt)) {
        insertMapping.push({ target: tgt, source: tgt });
        continue;
      }
      // check reverse remap (target ← source with different name)
      const srcAlias = Object.entries(COLUMN_REMAP).find(([, v]) => v === tgt);
      if (srcAlias && srcColNames.has(srcAlias[0])) {
        insertMapping.push({ target: tgt, source: srcAlias[0] });
        continue;
      }
      // not in source — will be NULL
    }

    // ── 10. Insert rows ───────────────────────────────────────────────────────
    console.log(`\n  Inserting rows...`);
    let inserted = 0;
    let skipped  = 0;

    for (const row of srcRows.rows) {
      const yr = row.funding_year ? String(row.funding_year) : '0000';
      seqMap[yr] = (seqMap[yr] || 0) + 1;
      const ipc = `INF-B-${yr}-${padSeq(seqMap[yr])}`;

      // Build values array
      const cols   = ['ipc', ...insertMapping.map(m => m.target), 'imported_by'];
      const values = [ipc, ...insertMapping.map(m => {
        const v = row[m.source];
        return v === undefined ? null : v;
      }), 'seed_script'];

      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

      const res = await client.query(
        `INSERT INTO engineer_imported_beff (${cols.join(', ')})
         VALUES (${placeholders})
         ON CONFLICT (ipc) DO NOTHING`,
        values
      );

      if (res.rowCount === 0) skipped++;
      else inserted++;

      // progress every 1000
      if ((inserted + skipped) % 1000 === 0) {
        process.stdout.write(`\r    Progress: ${inserted + skipped} / ${srcRows.rows.length}`);
      }
    }

    process.stdout.write(`\r    Progress: ${inserted + skipped} / ${srcRows.rows.length}\n`);

    await client.query('COMMIT');

    // ── 11. Summary ───────────────────────────────────────────────────────────
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`  ✅ Import complete`);
    console.log(`     Inserted : ${inserted.toLocaleString()}`);
    console.log(`     Skipped  : ${skipped.toLocaleString()} (already existed)`);
    console.log(`     Total    : ${(inserted + skipped).toLocaleString()}`);
    console.log(`${'═'.repeat(70)}\n`);

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`\n❌ Import failed — rolled back.\n   ${err.message}\n`);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
