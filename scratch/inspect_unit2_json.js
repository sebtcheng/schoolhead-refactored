import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging',
  ssl: false
});

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT school_id, unit2_simplified_enrollment 
    FROM ph_schools 
    WHERE unit2_completed = TRUE AND unit2_simplified_enrollment IS NOT NULL
    LIMIT 1
  `);
  if (res.rows.length > 0) {
    console.log(`School: ${res.rows[0].school_id}`);
    console.log(res.rows[0].unit2_simplified_enrollment);
  } else {
    console.log("No completed unit 2 rows found.");
  }
  await client.end();
}
main().catch(console.error);
