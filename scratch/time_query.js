import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging',
  ssl: false
});

async function main() {
  await client.connect();
  console.log('Connected.');

  // Fetch 500 random school IDs
  const idRes = await client.query('SELECT school_id FROM ph_schools WHERE unit2_simplified_enrollment IS NOT NULL LIMIT 500');
  const ids = idRes.rows.map(r => r.school_id);
  console.log(`Fetched ${ids.length} school IDs.`);

  console.time('Fetch batch of 500');
  const placeholders = ids.map((_, idx) => `$${idx + 1}`).join(', ');
  const res = await client.query(`
    SELECT iern, school_id, unit2_simplified_enrollment 
    FROM ph_schools 
    WHERE school_id IN (${placeholders})
  `, ids);
  console.timeEnd('Fetch batch of 500');
  console.log(`Fetched ${res.rows.length} rows.`);

  await client.end();
}
main().catch(console.error);
