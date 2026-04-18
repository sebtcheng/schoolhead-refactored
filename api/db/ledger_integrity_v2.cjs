const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Fix: .env is at the project root
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) {
  console.error('❌ FATAL: DATABASE_URL not found in .env');
  process.exit(1);
}

const dbUrl = rawUrl.replace(':6432', ':5432')
    .replace('20.24.58.49', 'stride-posgre-prod-01.postgres.database.azure.com');

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function runIntegrity() {
  let client;
  try {
    client = await pool.connect();
    console.log('--- 🛠️ LEDGER INTEGRITY V2: CONTENT HASHING ---');
    
    await client.query('BEGIN');
    
    // 1. Add content_hash column
    console.log('1. Adding content_hash column...');
    await client.query(`ALTER TABLE engineer_form ADD COLUMN IF NOT EXISTS content_hash TEXT;`);

    // 2. Clear previous constraints
    await client.query(`DROP INDEX IF EXISTS idx_ef_content_hash;`);

    // 3. Backfill Hashes
    console.log('2. Generating content hashes...');
    await client.query(`
      UPDATE engineer_form SET content_hash = md5(
        COALESCE(school_id::text, '') || '|' ||
        COALESCE(project_name::text, '') || '|' ||
        COALESCE(project_category::text, '') || '|' ||
        COALESCE(status_of_construction_phase::text, '') || '|' ||
        COALESCE(accomplishment_percentage::text, '') || '|' ||
        COALESCE(status_as_of::text, '') || '|' ||
        COALESCE(approved_budget_for_contract::text, '') || '|' ||
        COALESCE(contract_amount::text, '') || '|' ||
        COALESCE(notice_to_proceed::text, '') || '|' ||
        COALESCE(contractor_name::text, '') || '|' ||
        COALESCE(batch_of_funds::text, '') || '|' ||
        COALESCE(funding_year::text, '')
      );
    `);
    console.log('✅ Hashes generated.');

    // 4. Purge Exact Clones
    console.log('3. Purging redundant digital clones...');
    const purgeRes = await client.query(`
      DELETE FROM engineer_form
      WHERE project_id NOT IN (
        SELECT MIN(project_id)
        FROM engineer_form
        GROUP BY content_hash
      );
    `);
    console.log(`✅ Purged ${purgeRes.rowCount} redundant clone records.`);

    // 5. Apply UNIQUE Index on Hash
    console.log('4. Enforcing Content-Clone Shield index...');
    await client.query(`CREATE UNIQUE INDEX idx_ef_content_hash ON engineer_form (content_hash);`);
    console.log('✅ Unique index created.');

    await client.query('COMMIT');
    console.log('🌟 ALL STEPS COMPLETED.');

  } catch (e) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Integrity operation failed:');
    console.error('Message:', e.message);
    console.error('Code:', e.code);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

runIntegrity();
