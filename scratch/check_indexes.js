import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging',
  ssl: false
});

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'ph_schools'
  `);
  console.log('Indexes on ph_schools:');
  res.rows.forEach(r => console.log(`- ${r.indexname}: ${r.indexdef}`));
  await client.end();
}
main().catch(console.error);
