import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging',
  ssl: false
});

async function main() {
  await client.connect();

  const res = await client.query(`
    SELECT school_id, unit3_sections 
    FROM ph_schools 
    WHERE unit3_sections IS NOT NULL 
    LIMIT 3
  `);

  console.log(`Found ${res.rows.length} rows with unit3_sections.`);
  
  for (const row of res.rows) {
    console.log(`\nSchool ID: ${row.school_id}`);
    console.log(JSON.stringify(row.unit3_sections, null, 2));
  }

  await client.end();
}
main().catch(console.error);
