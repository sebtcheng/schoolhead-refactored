import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging',
  ssl: false
});

async function main() {
  await client.connect();

  console.log('--- JSONB/JSON Columns in ph_schools ---');
  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'ph_schools' AND data_type IN ('json', 'jsonb')
    ORDER BY column_name
  `);
  res.rows.forEach(r => console.log(`- ${r.column_name}: ${r.data_type}`));

  await client.end();
}
main().catch(console.error);
