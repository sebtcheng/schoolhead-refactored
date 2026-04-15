const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const COLUMNS_TO_DROP = [
  'mode_of_project',
  'is_donated',
  'approval_status',
  'assigned_engineer_id',
  'assigned_engineer_name',
  'date_assigned',
  'uploader_id_moa_rta',
  'project_category_id',
  'funding_year_justification',
  'pow_pdf',
  'dupa_pdf',
  'contract_pdf',
  'pow_filename',
  'dupa_filename',
  'contract_filename',
];

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Step 1: drop the view (it depends on engineer_imported_beff_updates columns)
    console.log('Dropping view v_latest_beff_project_state...');
    await client.query(`DROP VIEW v_latest_beff_project_state;`);
    console.log('  ✅ view dropped');

    // Step 2: drop columns from engineer_imported_beff
    // (already done in prior run, so use IF EXISTS to be safe)
    console.log('\nDropping columns from engineer_imported_beff...');
    for (const col of COLUMNS_TO_DROP) {
      await client.query(`ALTER TABLE engineer_imported_beff DROP COLUMN IF EXISTS ${col};`);
      console.log(`  ✅ dropped ${col}`);
    }

    // Step 3: drop columns from engineer_imported_beff_updates
    console.log('\nDropping columns from engineer_imported_beff_updates...');
    for (const col of COLUMNS_TO_DROP) {
      await client.query(`ALTER TABLE engineer_imported_beff_updates DROP COLUMN IF EXISTS ${col};`);
      console.log(`  ✅ dropped ${col}`);
    }

    // Step 4: recreate the view (now clean, without dropped columns)
    console.log('\nRecreating view v_latest_beff_project_state...');
    await client.query(`
      CREATE VIEW v_latest_beff_project_state AS
      SELECT DISTINCT ON (u.ipc)
        u.*,
        b.imported_at AS project_imported_at,
        b.imported_by AS project_imported_by
      FROM engineer_imported_beff_updates u
      JOIN engineer_imported_beff b ON b.ipc = u.ipc
      ORDER BY u.ipc, u.update_id DESC;
    `);
    console.log('  ✅ view recreated');

    await client.query('COMMIT');
    console.log('\n✅ Done.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Failed — rolled back:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
