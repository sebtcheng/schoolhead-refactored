import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging',
  ssl: false
});

async function main() {
  await client.connect();

  console.log('--- Finding schools with snedSelfContainedCount > 0 ---');
  const resSned = await client.query(`
    SELECT school_id, unit2_simplified_enrollment::text
    FROM ph_schools
    WHERE unit2_simplified_enrollment IS NOT NULL
      AND (unit2_simplified_enrollment->'questionnaire'->>'snedSelfContainedCount')::int > 0
    LIMIT 2
  `);
  for (const row of resSned.rows) {
    console.log(`\nSchool ID: ${row.school_id}`);
    console.log(JSON.stringify(JSON.parse(row.unit2_simplified_enrollment).questionnaire, null, 2));
  }

  console.log('\n--- Finding schools with mgCombinations having enrollment > 0 or detailed elements ---');
  const resMg = await client.query(`
    SELECT school_id, unit2_simplified_enrollment::text
    FROM ph_schools
    WHERE unit2_simplified_enrollment IS NOT NULL
      AND jsonb_array_length(unit2_simplified_enrollment->'questionnaire'->'mgCombinations') > 0
    LIMIT 2
  `);
  for (const row of resMg.rows) {
    console.log(`\nSchool ID: ${row.school_id}`);
    console.log(JSON.stringify(JSON.parse(row.unit2_simplified_enrollment).questionnaire, null, 2));
  }

  await client.end();
}
main().catch(console.error);
