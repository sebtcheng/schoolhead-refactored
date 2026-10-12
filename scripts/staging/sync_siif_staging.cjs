#!/usr/bin/env node
/**
 * SIIF Staging Sync — copies production siif_database_v2 (public schema) into
 * insighted-staging.siif_staging_v2 so staging is identical to production.
 *
 *   node scripts/staging/sync_siif_staging.cjs            # full sync
 *   node scripts/staging/sync_siif_staging.cjs --dry-run  # read prod + print plan, write nothing
 *
 * Safety:
 *   - Production is opened READ ONLY in one REPEATABLE READ snapshot (consistent copy).
 *   - Only the dedicated schema siif_staging_v2 in insighted-staging is ever written.
 *     The `public` schema of insighted-staging is never touched.
 *   - Builds into siif_staging_v2_build first; swaps in only after row counts and
 *     column definitions match production. A failed run leaves the old copy intact.
 *   - Refuses to replace a schema that contains triggers (deletion-lock safety).
 */
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
require(path.join(ROOT, 'node_modules/dotenv')).config({ path: path.join(ROOT, '.env'), quiet: true });
const { Client } = require(path.join(ROOT, 'node_modules/pg'));
const QueryStream = require(path.join(ROOT, 'node_modules/pg-query-stream'));

const SOURCE_DB = 'siif_database_v2';
const SOURCE_SCHEMA = 'public';
const TARGET_DB = 'insighted-staging';
const SCHEMA = 'siif_staging_v2';
const BUILD = `${SCHEMA}_build`;
const BATCH = 5000;
const DRY_RUN = process.argv.includes('--dry-run');

const C = { g: '\x1b[32m', r: '\x1b[31m', c: '\x1b[36m', y: '\x1b[33m', n: '\x1b[0m' };
const info = (m) => console.log(`${C.c}ℹ️  ${m}${C.n}`);
const ok = (m) => console.log(`${C.g}✅ ${m}${C.n}`);
const warn = (m) => console.log(`${C.y}⚠️  ${m}${C.n}`);
const fail = (m) => { console.error(`${C.r}❌ ${m}${C.n}`); process.exit(1); };

const qi = (s) => '"' + s.replace(/"/g, '""') + '"';
const dbName = (url) => decodeURIComponent(new URL(url).pathname.slice(1));

function urls() {
  const src = process.env.SIIF_DATABASE_URL;
  if (!src) fail('SIIF_DATABASE_URL is not set in .env');
  if (dbName(src) !== SOURCE_DB) fail(`SIIF_DATABASE_URL points to "${dbName(src)}", expected "${SOURCE_DB}"`);
  const t = new URL(src);
  t.pathname = '/' + TARGET_DB;
  t.search = '';
  return { src, dst: t.toString() };
}

async function connect(url, appName) {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, application_name: appName });
  await c.connect();
  return c;
}

// ─── Read production catalog ────────────────────────────────────────────────
async function readCatalog(src) {
  const q = async (sql) => (await src.query(sql)).rows;
  const tables = await q(`
    SELECT c.oid, c.relname FROM pg_class c
    WHERE c.relnamespace = '${SOURCE_SCHEMA}'::regnamespace AND c.relkind = 'r' ORDER BY c.relname`);
  const columns = await q(`
    SELECT c.relname tbl, a.attname col, format_type(a.atttypid, a.atttypmod) typ, a.attnotnull nn,
           pg_get_expr(d.adbin, d.adrelid) def, a.attidentity ident, a.attgenerated gen
    FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE c.relnamespace = '${SOURCE_SCHEMA}'::regnamespace AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
    ORDER BY c.relname, a.attnum`);
  const sequences = await q(`
    SELECT s.sequencename name, format_type(s.data_type, NULL) typ, s.start_value, s.min_value, s.max_value,
           s.increment_by, s.cycle, s.cache_size, s.last_value,
           (SELECT tc.relname || '.' || a.attname FROM pg_depend dp
              JOIN pg_class tc ON tc.oid = dp.refobjid
              JOIN pg_attribute a ON a.attrelid = dp.refobjid AND a.attnum = dp.refobjsubid
            WHERE dp.objid = (quote_ident(s.schemaname) || '.' || quote_ident(s.sequencename))::regclass
              AND dp.classid = 'pg_class'::regclass AND dp.deptype = 'a' LIMIT 1) owned_by
    FROM pg_sequences s WHERE s.schemaname = '${SOURCE_SCHEMA}' ORDER BY 1`);
  const constraints = await q(`
    SELECT c.relname tbl, k.conname, k.contype, pg_get_constraintdef(k.oid) def
    FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid
    WHERE c.relnamespace = '${SOURCE_SCHEMA}'::regnamespace AND c.relkind = 'r' AND k.contype IN ('p','u','c','f','x')
    ORDER BY CASE k.contype WHEN 'p' THEN 0 WHEN 'u' THEN 1 WHEN 'c' THEN 2 WHEN 'x' THEN 3 ELSE 4 END, c.relname, k.conname`);
  const indexes = await q(`
    SELECT i.indexrelid::regclass::text name, pg_get_indexdef(i.indexrelid) def
    FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid
    WHERE c.relnamespace = '${SOURCE_SCHEMA}'::regnamespace AND c.relkind = 'r'
      AND NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conindid = i.indexrelid)
    ORDER BY 1`);
  const views = await q(`
    SELECT c.oid, c.relname, c.relkind, pg_get_viewdef(c.oid, true) def
    FROM pg_class c WHERE c.relnamespace = '${SOURCE_SCHEMA}'::regnamespace AND c.relkind IN ('v','m') ORDER BY c.relname`);
  const viewDeps = await q(`
    SELECT DISTINCT v.relname view, t.relname dep FROM pg_depend d
    JOIN pg_rewrite r ON r.oid = d.objid JOIN pg_class v ON v.oid = r.ev_class
    JOIN pg_class t ON t.oid = d.refobjid
    WHERE v.relnamespace = '${SOURCE_SCHEMA}'::regnamespace AND t.relkind IN ('v','m') AND v.oid <> t.oid`);
  const triggers = await q(`
    SELECT count(*)::int n FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relnamespace = '${SOURCE_SCHEMA}'::regnamespace AND NOT t.tgisinternal`);
  const funcs = await q(`SELECT count(*)::int n FROM pg_proc WHERE pronamespace = '${SOURCE_SCHEMA}'::regnamespace`);
  if (triggers[0].n || funcs[0].n) warn(`Production has ${triggers[0].n} trigger(s) / ${funcs[0].n} function(s) — these are NOT copied.`);

  // Views in dependency order (a view after the views it reads from)
  const ordered = [];
  const seen = new Set();
  const visit = (name, stack = new Set()) => {
    if (seen.has(name)) return;
    if (stack.has(name)) fail(`Circular view dependency at ${name}`);
    stack.add(name);
    viewDeps.filter((d) => d.view === name).forEach((d) => visit(d.dep, stack));
    seen.add(name);
    ordered.push(views.find((v) => v.relname === name));
  };
  views.forEach((v) => visit(v.relname));

  return { tables, columns, sequences, constraints, indexes, views: ordered.filter(Boolean) };
}

// ─── Target guards ──────────────────────────────────────────────────────────
async function assertReplaceable(dst, schema, allowedNames) {
  const { rows: [s] } = await dst.query(`SELECT oid FROM pg_namespace WHERE nspname = $1`, [schema]);
  if (!s) return false;
  const { rows: [t] } = await dst.query(
    `SELECT count(*)::int n FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid
     WHERE c.relnamespace = $1 AND NOT tg.tgisinternal`, [s.oid]);
  if (t.n) fail(`Schema ${schema} has ${t.n} trigger(s). Refusing to replace it — resolve manually.`);
  const { rows: foreign } = await dst.query(
    `SELECT relname FROM pg_class WHERE relnamespace = $1 AND relkind IN ('r','v','m','p') AND NOT (relname = ANY($2))`,
    [s.oid, allowedNames]);
  if (foreign.length) fail(`Schema ${schema} contains objects not in production (${foreign.map((f) => f.relname).join(', ')}). Refusing to replace it.`);
  return true;
}

const retarget = (sql) => sql.replace(/\b(ON|REFERENCES)\s+(ONLY\s+)?public\./g, `$1 $2${qi(BUILD)}.`);

// ─── Main ───────────────────────────────────────────────────────────────────
(async () => {
  const t0 = Date.now();
  const { src: srcUrl, dst: dstUrl } = urls();
  console.log(`${C.c}${'='.repeat(64)}\n🔁 SIIF Staging Sync: ${SOURCE_DB}.${SOURCE_SCHEMA} ➜ ${TARGET_DB}.${SCHEMA}${DRY_RUN ? '  (DRY RUN)' : ''}\n${'='.repeat(64)}${C.n}`);

  const src = await connect(srcUrl, 'siif_staging_sync_reader');
  await src.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await src.query(`SET LOCAL search_path = ${SOURCE_SCHEMA}`);

  info('Reading production catalog (read-only snapshot)...');
  const cat = await readCatalog(src);
  ok(`Prod: ${cat.tables.length} tables, ${cat.views.length} views, ${cat.sequences.length} sequences, ${cat.constraints.length} constraints, ${cat.indexes.length} extra indexes`);

  if (DRY_RUN) {
    for (const t of cat.tables) {
      const { rows: [r] } = await src.query(`SELECT count(*)::bigint n FROM ${qi(t.relname)}`);
      console.log(`   ${t.relname.padEnd(40)} ${r.n} rows`);
    }
    cat.views.forEach((v) => console.log(`   [view] ${v.relname}`));
    await src.query('ROLLBACK'); await src.end();
    ok('Dry run complete. Nothing was written.');
    return;
  }

  const dst = await connect(dstUrl, 'siif_staging_sync_writer');
  const { rows: [{ db }] } = await dst.query('SELECT current_database() db');
  if (db !== TARGET_DB) fail(`Connected to "${db}", expected "${TARGET_DB}"`);
  if ([SCHEMA, BUILD].includes('public')) fail('Target schema may never be public');

  const allowed = [...cat.tables, ...cat.views].map((t) => t.relname);
  await assertReplaceable(dst, SCHEMA, allowed);
  if (await assertReplaceable(dst, BUILD, allowed)) {
    info(`Removing leftover ${BUILD} from a previous failed run...`);
    await dst.query(`DROP SCHEMA ${qi(BUILD)} CASCADE`);
  }

  // 1. Structure (no constraints yet — faster bulk load)
  info(`Creating ${BUILD} structure...`);
  await dst.query(`CREATE SCHEMA ${qi(BUILD)}`);
  await dst.query(`SET search_path = ${qi(BUILD)}`);
  for (const s of cat.sequences) {
    await dst.query(`CREATE SEQUENCE ${qi(s.name)} AS ${s.typ} INCREMENT BY ${s.increment_by} MINVALUE ${s.min_value}
      MAXVALUE ${s.max_value} START WITH ${s.start_value} CACHE ${s.cache_size} ${s.cycle ? 'CYCLE' : 'NO CYCLE'}`);
  }
  for (const t of cat.tables) {
    const cols = cat.columns.filter((c) => c.tbl === t.relname).map((c) => {
      let d = `${qi(c.col)} ${c.typ}`;
      if (c.gen === 's') d += ` GENERATED ALWAYS AS (${c.def}) STORED`;
      else if (c.ident) d += ` GENERATED ${c.ident === 'a' ? 'ALWAYS' : 'BY DEFAULT'} AS IDENTITY`;
      else if (c.def) d += ` DEFAULT ${c.def}`;
      if (c.nn) d += ' NOT NULL';
      return d;
    });
    await dst.query(`CREATE TABLE ${qi(t.relname)} (\n  ${cols.join(',\n  ')}\n)`);
  }
  ok('Tables and sequences created.');

  // 2. Data — streamed from the prod snapshot as JSON, inserted in batches
  const prodCounts = {};
  for (const t of cat.tables) {
    const cols = cat.columns.filter((c) => c.tbl === t.relname && c.gen !== 's').map((c) => qi(c.col));
    const overriding = cat.columns.some((c) => c.tbl === t.relname && c.ident === 'a') ? 'OVERRIDING SYSTEM VALUE' : '';
    const insertSql = `INSERT INTO ${qi(t.relname)} (${cols.join(', ')}) ${overriding}
      SELECT ${cols.join(', ')} FROM json_populate_recordset(NULL::${qi(BUILD)}.${qi(t.relname)}, $1::json)`;
    const stream = src.query(new QueryStream(`SELECT row_to_json(t)::text j FROM ${qi(t.relname)} t`, [], { batchSize: BATCH }));
    let batch = [];
    let n = 0;
    const flush = async () => {
      if (!batch.length) return;
      await dst.query(insertSql, ['[' + batch.join(',') + ']']);
      n += batch.length;
      batch = [];
      process.stdout.write(`\r   ${t.relname.padEnd(40)} ${n.toLocaleString()} rows`);
    };
    for await (const row of stream) {
      batch.push(row.j);
      if (batch.length >= BATCH) await flush();
    }
    await flush();
    const { rows: [r] } = await src.query(`SELECT count(*)::bigint n FROM ${qi(t.relname)}`);
    prodCounts[t.relname] = Number(r.n);
    process.stdout.write(`\r   ${t.relname.padEnd(40)} ${n.toLocaleString()} rows\n`);
  }
  ok('Data copied.');

  // 3. Sequences, constraints, indexes, views
  info('Restoring sequence positions, constraints, indexes, views...');
  for (const s of cat.sequences) {
    if (s.last_value !== null) await dst.query(`SELECT setval($1, $2, true)`, [`${qi(BUILD)}.${qi(s.name)}`, s.last_value]);
    if (s.owned_by) {
      const [tbl, col] = s.owned_by.split('.');
      await dst.query(`ALTER SEQUENCE ${qi(s.name)} OWNED BY ${qi(tbl)}.${qi(col)}`);
    }
  }
  for (const k of cat.constraints) {
    await dst.query(`ALTER TABLE ${qi(k.tbl)} ADD CONSTRAINT ${qi(k.conname)} ${retarget(k.def)}`);
  }
  for (const i of cat.indexes) await dst.query(retarget(i.def));
  for (const v of cat.views) {
    const kind = v.relkind === 'm' ? 'MATERIALIZED VIEW' : 'VIEW';
    await dst.query(`CREATE ${kind} ${qi(v.relname)} AS ${v.def}`);
  }
  for (const t of cat.tables) await dst.query(`ANALYZE ${qi(t.relname)}`);
  ok('Constraints, indexes, views restored.');

  // 4. Verify against production before swapping in
  info('Verifying copy against production...');
  let problems = 0;
  for (const t of cat.tables) {
    const { rows: [r] } = await dst.query(`SELECT count(*)::bigint n FROM ${qi(t.relname)}`);
    if (Number(r.n) !== prodCounts[t.relname]) { problems++; warn(`Row count mismatch ${t.relname}: prod ${prodCounts[t.relname]} vs staging ${r.n}`); }
  }
  const sig = (rows) => rows.map((c) => `${c.tbl}.${c.col}:${c.typ}:${c.nn}:${c.def || ''}`).join('\n');
  const { rows: builtCols } = await dst.query(`
    SELECT c.relname tbl, a.attname col, format_type(a.atttypid, a.atttypmod) typ, a.attnotnull nn,
           pg_get_expr(d.adbin, d.adrelid) def
    FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE c.relnamespace = $1::regnamespace AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
    ORDER BY c.relname, a.attnum`, [BUILD]);
  if (sig(builtCols) !== sig(cat.columns)) { problems++; warn('Column definitions differ from production.'); }
  const { rows: [{ nv }] } = await dst.query(`SELECT count(*)::int nv FROM pg_class WHERE relnamespace = $1::regnamespace AND relkind IN ('v','m')`, [BUILD]);
  if (nv !== cat.views.length) { problems++; warn(`View count mismatch: prod ${cat.views.length} vs staging ${nv}`); }
  if (problems) fail(`${problems} verification problem(s). Old ${SCHEMA} left untouched; ${BUILD} kept for inspection.`);
  ok('Row counts, column definitions and views match production.');

  // 5. Swap build → live
  info(`Swapping ${BUILD} ➜ ${SCHEMA}...`);
  await dst.query('BEGIN');
  if (await assertReplaceable(dst, SCHEMA, allowed)) await dst.query(`DROP SCHEMA ${qi(SCHEMA)} CASCADE`);
  await dst.query(`ALTER SCHEMA ${qi(BUILD)} RENAME TO ${qi(SCHEMA)}`);
  await dst.query('COMMIT');

  await src.query('ROLLBACK');
  await Promise.all([src.end(), dst.end()]);

  const total = Object.values(prodCounts).reduce((a, b) => a + b, 0);
  console.log(`${C.c}${'='.repeat(64)}${C.n}`);
  ok(`${TARGET_DB}.${SCHEMA} now mirrors ${SOURCE_DB}: ${cat.tables.length} tables, ${cat.views.length} views, ${total.toLocaleString()} rows (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
})().catch((e) => fail(e.stack || e.message));
