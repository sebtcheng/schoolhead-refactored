import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging',
  ssl: false
});

async function main() {
  await client.connect();

  const res = await client.query(`
    SELECT COUNT(*) 
    FROM ph_schools 
    WHERE multigrade_details IS NOT NULL 
      AND multigrade_details::text != '[]' 
      AND multigrade_details::text != 'null'
  `);
  console.log('Count of non-empty multigrade details:', res.rows[0].count);

  if (parseInt(res.rows[0].count) > 0) {
    const samples = await client.query(`
      SELECT school_id, multigrade_details 
      FROM ph_schools 
      WHERE multigrade_details IS NOT NULL 
        AND multigrade_details::text != '[]' 
        AND multigrade_details::text != 'null'
      LIMIT 3
    `);
    samples.rows.forEach(r => {
      console.log(`School ID: ${r.school_id}`);
      console.log(JSON.stringify(r.multigrade_details, null, 2));
    });
  }

  await client.end();
}
main().catch(console.error);
