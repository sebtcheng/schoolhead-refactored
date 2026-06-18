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
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE total_teachers_kinder > 0) as kinder_teachers,
      COUNT(*) FILTER (WHERE total_teachers_elementary > 0) as elem_teachers,
      COUNT(*) FILTER (WHERE total_teachers_jhs > 0) as jhs_teachers,
      COUNT(*) FILTER (WHERE total_teachers_shs > 0) as shs_teachers,
      COUNT(*) FILTER (WHERE total_teachers_registered > 0) as reg_teachers
    FROM ph_schools
  `);
  console.log('Teacher column counts in staging:', res.rows[0]);

  const resSample = await client.query(`
    SELECT school_id, total_teachers_kinder, total_teachers_elementary, total_teachers_jhs, total_teachers_shs, total_teachers_registered
    FROM ph_schools
    WHERE total_teachers_registered > 0
    LIMIT 3
  `);
  console.log('Sample rows:', resSample.rows);

  await client.end();
}
main().catch(console.error);
