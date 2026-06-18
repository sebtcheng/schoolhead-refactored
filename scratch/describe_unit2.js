import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging',
  ssl: false
});

async function main() {
  await client.connect();

  console.log('--- Columns in ph_schools related to unit2 ---');
  const res1 = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'ph_schools' AND column_name LIKE '%unit2%'
    ORDER BY column_name
  `);
  res1.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

  console.log('\n--- Columns in unit2_school_learners ---');
  const res2 = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'unit2_school_learners'
    ORDER BY column_name
  `);
  res2.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

  // Also query one row from ph_schools with unit2_completed to see what unit2_simplified_enrollment column type is,
  // and check why it fails to query unit2_simplified_enrollment.
  const res3 = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'ph_schools' AND column_name = 'unit2_simplified_enrollment'
  `);
  console.log('\nunit2_simplified_enrollment info:', res3.rows[0]);

  await client.end();
}
main().catch(console.error);
