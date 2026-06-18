import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging',
  ssl: false
});

async function main() {
  await client.connect();

  console.log('--- Checking multigrade_details in ph_schools ---');
  const resCount = await client.query('SELECT COUNT(*) FROM ph_schools WHERE multigrade_details IS NOT NULL');
  console.log(`Rows with multigrade_details: ${resCount.rows[0].count}`);

  if (parseInt(resCount.rows[0].count) > 0) {
    const resSample = await client.query(`
      SELECT school_id, multigrade_details 
      FROM ph_schools 
      WHERE multigrade_details IS NOT NULL 
      LIMIT 3
    `);
    resSample.rows.forEach(r => {
      console.log(`\nSchool ID: ${r.school_id}`);
      console.log(JSON.stringify(r.multigrade_details, null, 2));
    });
  }

  await client.end();
}
main().catch(console.error);
