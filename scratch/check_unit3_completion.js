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
      COUNT(*) FILTER (WHERE unit3_completed = TRUE) as completed_count,
      COUNT(*) FILTER (WHERE unit3 = 100) as unit3_100_count,
      COUNT(*) FILTER (WHERE unit3_sections IS NOT NULL) as not_null_sections_count
    FROM ph_schools
  `);
  console.log('Counts:', res.rows[0]);

  // Let's print out what unit3_completed = TRUE rows actually look like
  const resSample = await client.query(`
    SELECT school_id, unit3, unit3_completed, unit3_sections
    FROM ph_schools
    WHERE unit3_completed = TRUE OR unit3 = 100 OR unit3_sections IS NOT NULL
    LIMIT 3
  `);
  console.log('Samples:', resSample.rows);

  await client.end();
}
main().catch(console.error);
