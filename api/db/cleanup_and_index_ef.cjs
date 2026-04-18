/**
 * cleanup_and_index_ef.cjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Hardened cleanup script for engineer_form table.
 * 
 * 1. Uses advisory locks to prevent concurrent runs.
 * 2. Deletes duplicate entries (preserving latest).
 * 3. Restores UNIQUE constraint on 'ipc'.
 * 4. Adds safety partial index.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

// Helper to provide fallback connectivity if 6432 proxy is down
const dbUrl = process.env.DATABASE_URL.replace(':6432', ':5432')
    .replace('20.24.58.49', 'stride-posgre-prod-01.postgres.database.azure.com')
    .replace('20.24.25.245', 'stride-posgre-prod-01.postgres.database.azure.com');

console.log(`🔌 Initializing database connection...`);
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('🛡️ [Senior-Dev] Attempting to acquire advisory lock (9999)...');
    const lockRes = await client.query('SELECT pg_try_advisory_lock(9999)');
    if (!lockRes.rows[0].pg_try_advisory_lock) {
      console.warn('⚠️ Migration already in progress by another worker. Aborting.');
      return;
    }

    console.log('\nSTEP 1: Starting cleanup transaction...');
    await client.query('BEGIN');

    // 1. Identify and Delete duplicates (keep one per IPC)
    // We keep the one with the latest status_as_of or created_at
    const deleteRes = await client.query(`
      DELETE FROM engineer_form
      WHERE project_id NOT IN (
        SELECT DISTINCT ON (ipc) project_id
        FROM engineer_form
        WHERE ipc IS NOT NULL AND ipc != ''
        ORDER BY ipc, status_as_of DESC, created_at DESC, project_id DESC
      )
      AND ipc IS NOT NULL AND ipc != '';
    `);
    console.log(`✅ Removed ${deleteRes.rowCount} duplicate rows.`);

    // 1b. Identify and Delete logical duplicates for NULL IPCs
    console.log('STEP 1b: Deleting logical duplicates (NULL IPC)...');
    const deleteResLogical = await client.query(`
      DELETE FROM engineer_form
      WHERE project_id NOT IN (
        SELECT DISTINCT ON (project_name, school_id) project_id
        FROM engineer_form
        WHERE ipc IS NULL OR ipc = ''
        ORDER BY project_name, school_id, status_as_of DESC, created_at DESC, project_id DESC
      )
      AND (ipc IS NULL OR ipc = '');
    `);
    console.log(`✅ Removed ${deleteResLogical.rowCount} logical duplicate rows.`);

    // 2. Restore UNIQUE constraint
    console.log('STEP 2: Restoring UNIQUE(ipc) constraint...');
    await client.query(`
      ALTER TABLE engineer_form 
      DROP CONSTRAINT IF EXISTS engineer_form_ipc_key,
      ADD CONSTRAINT engineer_form_ipc_key UNIQUE (ipc);
    `);
    console.log('✅ UNIQUE constraint on "ipc" restored.');

    // 3. Add safety partial index for project_name + school_id
    console.log('STEP 3: Creating safety index for NULL IPC cases...');
    await client.query(`DROP INDEX IF EXISTS idx_ef_logical_key_v2;`);
    await client.query(`
      CREATE UNIQUE INDEX idx_ef_logical_key_v2 
      ON engineer_form (project_name, school_id) 
      WHERE (ipc IS NULL OR ipc = '');
    `);
    console.log('✅ Logical key index v2 created.');

    await client.query('COMMIT');
    console.log('\n🌟 ALL STEPS COMPLETED SUCCESSFULLY.');

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\n❌ CRITICAL FAILURE:', err.message);
    process.exit(1);
  } finally {
    await client.query('SELECT pg_advisory_unlock(9999)').catch(() => {});
    client.release();
    await pool.end();
  }
}

run();
