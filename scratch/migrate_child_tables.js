import pg from 'pg';
const { Client } = pg;

const stagingConnStr = 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging';

async function main() {
  const client = new Client({ connectionString: stagingConnStr, ssl: false });
  await client.connect();
  console.log('Connected to Staging database for child table migration.');

  // Set local flag to bypass trigger block
  await client.query("SET LOCAL internal.authorized_app_deletion = 'true';");

  try {
    await client.query('BEGIN');

    // Add school_yr to school_ownership_records
    await client.query(`
      ALTER TABLE school_ownership_records 
      ADD COLUMN IF NOT EXISTS school_yr TEXT DEFAULT 'SY 25-26'
    `);
    console.log('  - Added school_yr to school_ownership_records');

    await client.query(`
      UPDATE school_ownership_records
      SET school_yr = 'SY 25-26'
      WHERE school_yr IS NULL
    `);
    console.log('  - Set existing records to SY 25-26 in school_ownership_records');

    await client.query('COMMIT');
    console.log('✅ Child tables successfully migrated.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
