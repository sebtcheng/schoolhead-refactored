import pg from 'pg';
const { Client } = pg;

const stagingConnStr = 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging';

async function main() {
  const client = new Client({ connectionString: stagingConnStr, ssl: false });
  await client.connect();
  console.log('Connected to Staging database for index check.');

  try {
    // Drop the old index if it exists
    await client.query(`DROP INDEX IF EXISTS idx_ph_school_buildable_spaces_iern_name`);
    await client.query(`DROP INDEX IF EXISTS idx_unit7_school_buildable_spaces_iern_name`);
    
    // Create new unique index including school_yr
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_unit7_school_buildable_spaces_iern_name_yr
      ON unit7_school_buildable_spaces(iern, space_name, school_yr)
    `);
    console.log('✅ Recreated buildable spaces unique index to include school_yr.');
  } catch (err) {
    console.error('❌ Index recreation failed:', err.message);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
