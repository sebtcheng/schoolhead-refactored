import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd',
  ssl: false
});

async function main() {
  await client.connect();

  console.log('--- Checking populated class size columns ---');
  const res = await client.query(`
    SELECT 
      COUNT(*) FILTER (WHERE sections_kinder > 0) as kinder_sections_count,
      COUNT(*) FILTER (WHERE size_less_g1 > 0) as g1_less_count,
      COUNT(*) FILTER (WHERE size_within_g1 > 0) as g1_within_count,
      COUNT(*) FILTER (WHERE size_above_g1 > 0) as g1_above_count
    FROM ph_schools
  `);
  console.log('Stats:', res.rows[0]);

  const resSample = await client.query(`
    SELECT 
      school_id, 
      sections_kinder, size_less_kinder, size_within_kinder, size_above_kinder,
      sections_g1, size_less_g1, size_within_g1, size_above_g1,
      sections_g2, size_less_g2, size_within_g2, size_above_g2
    FROM ph_schools
    WHERE sections_g1 > 0
    LIMIT 3
  `);
  console.log('\nSample rows with populated sections:');
  resSample.rows.forEach(r => console.log(JSON.stringify(r, null, 2)));

  await client.end();
}
main().catch(console.error);
