import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging',
  ssl: false
});

async function main() {
  await client.connect();

  console.log('--- Columns in ph_schools matching keywords ---');
  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'ph_schools' 
      AND (column_name LIKE '%class%' 
           OR column_name LIKE '%size%' 
           OR column_name LIKE '%section%' 
           OR column_name LIKE '%grouping%'
           OR column_name LIKE '%grade%')
    ORDER BY column_name
  `);
  res.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

  await client.end();
}
main().catch(console.error);
