import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd',
  ssl: false
});

async function main() {
  await client.connect();
  console.log('Connected to production database: insightEd');

  // Check if column exists
  const resCols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'ph_schools' AND column_name = 'unit3_simplified_counts'
  `);
  console.log('Column info:', resCols.rows[0]);

  if (resCols.rows.length > 0) {
    const resCount = await client.query(`
      SELECT COUNT(*) 
      FROM ph_schools 
      WHERE unit3_simplified_counts IS NOT NULL
    `);
    console.log(`Rows with non-null unit3_simplified_counts in production: ${resCount.rows[0].count}`);

    if (parseInt(resCount.rows[0].count) > 0) {
      const resSample = await client.query(`
        SELECT school_id, unit3_simplified_counts::text 
        FROM ph_schools 
        WHERE unit3_simplified_counts IS NOT NULL 
        LIMIT 3
      `);
      resSample.rows.forEach(r => {
        console.log(`\nSchool ID: ${r.school_id}`);
        console.log(JSON.stringify(JSON.parse(r.unit3_simplified_counts), null, 2));
      });
    }
  } else {
    console.log('Column unit3_simplified_counts does not exist in production ph_schools!');
  }

  await client.end();
}
main().catch(console.error);
