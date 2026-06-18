import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging',
  ssl: false
});

async function main() {
  await client.connect();

  // Let's count how many schools have unit2_completed = true or unit2 = 100
  const countRes = await client.query(`
    SELECT 
      COUNT(*) FILTER (WHERE unit2_completed = TRUE) as completed_count,
      COUNT(*) FILTER (WHERE unit2 = 100) as unit2_100_count,
      COUNT(*) FILTER (WHERE unit2_simplified_enrollment IS NOT NULL) as not_null_enrollment_count
    FROM ph_schools
  `);
  console.log('Counts:', countRes.rows[0]);

  // Let's select a few rows but get unit2_simplified_enrollment as text to avoid pg driver/postgres parser issues if any
  const res = await client.query(`
    SELECT school_id, unit2_completed, unit2, unit2_simplified_enrollment::text
    FROM ph_schools 
    WHERE unit2_simplified_enrollment IS NOT NULL
    LIMIT 5
  `);
  
  for (const row of res.rows) {
    console.log(`\nSchool ID: ${row.school_id}`);
    console.log(`unit2_completed: ${row.unit2_completed}, unit2: ${row.unit2}`);
    if (row.unit2_simplified_enrollment) {
      const parsed = JSON.parse(row.unit2_simplified_enrollment);
      console.log('JSON Keys:', Object.keys(parsed));
      if (parsed.array) {
        console.log(`Array length: ${parsed.array.length}`);
        console.log('First 3 items of array:', parsed.array.slice(0, 3));
      }
      // Check if there are other keys like sned, aral, total, male, female
      for (const key of Object.keys(parsed)) {
        if (key !== 'array') {
          console.log(`Key "${key}":`);
          console.log(JSON.stringify(parsed[key], null, 2));
        }
      }
    }
  }

  await client.end();
}
main().catch(console.error);
