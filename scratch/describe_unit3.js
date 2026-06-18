import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging',
  ssl: false
});

async function main() {
  await client.connect();

  console.log('--- Tables in staging matching unit3 ---');
  const resTables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_name LIKE '%unit3%' OR table_name LIKE '%unit_3%'
    ORDER BY table_name
  `);
  resTables.rows.forEach(r => console.log(`- ${r.table_name}`));

  console.log('\n--- Columns in ph_schools related to unit3 ---');
  const res1 = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'ph_schools' AND (column_name LIKE '%unit3%' OR column_name LIKE '%teachers%' OR column_name LIKE '%personnel%')
    ORDER BY column_name
  `);
  res1.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

  // Let's also print columns for any unit3 tables found
  for (const row of resTables.rows) {
    console.log(`\n--- Columns in ${row.table_name} ---`);
    const resCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = $1
      ORDER BY column_name
    `, [row.table_name]);
    resCols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));
  }

  await client.end();
}
main().catch(console.error);
