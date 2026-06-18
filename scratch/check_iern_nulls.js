import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging',
  ssl: false
});

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT 
      COUNT(*) as total_rows,
      COUNT(*) FILTER (WHERE iern IS NULL) as null_iern_count
    FROM ph_schools
    WHERE unit2_simplified_enrollment IS NOT NULL
  `);
  console.log('Result:', res.rows[0]);
  await client.end();
}
main().catch(console.error);
