import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd',
  ssl: false
});

async function main() {
  await client.connect();

  console.log('--- Columns in school_unit3_classes (production) ---');
  const resCols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'school_unit3_classes'
    ORDER BY column_name
  `);
  resCols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

  const resCount = await client.query('SELECT COUNT(*) FROM school_unit3_classes');
  console.log(`\nTotal rows in school_unit3_classes: ${resCount.rows[0].count}`);

  if (parseInt(resCount.rows[0].count) > 0) {
    const sample = await client.query('SELECT * FROM school_unit3_classes LIMIT 1');
    console.log('\nSample row from school_unit3_classes:', sample.rows[0]);
  }

  await client.end();
}
main().catch(console.error);
