import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd',
  ssl: false
});

async function main() {
  await client.connect();

  console.log('--- All Tables in Production ---');
  const res = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);
  res.rows.forEach(r => console.log(`- ${r.table_name}`));

  await client.end();
}
main().catch(console.error);
