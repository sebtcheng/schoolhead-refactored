import pg from 'pg';
const { Client } = pg;

const clientProd = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd',
  ssl: false
});

async function main() {
  await clientProd.connect();
  console.log('Connected to production database: insightEd');

  // Let's check if the table has any non-zero or non-null Unit 4 columns
  const res = await clientProd.query(`
    SELECT 
      COUNT(*) FILTER (WHERE selected_learner_groups IS NOT NULL AND selected_learner_groups::text <> '[]') as has_groups,
      COUNT(*) FILTER (WHERE bmi_wasted > 0 OR bmi_severely_wasted > 0) as has_bmi,
      COUNT(*) FILTER (WHERE als_total > 0) as has_als,
      COUNT(*) FILTER (WHERE muslim_kinder > 0 OR muslim_g1 > 0) as has_muslim,
      COUNT(*) FILTER (WHERE ip_kinder > 0 OR ip_g1 > 0) as has_ip,
      COUNT(*) FILTER (WHERE unit4_completed = TRUE) as completed_count
    FROM ph_schools
  `);

  console.log('Production ph_schools Unit 4 counts:');
  console.log(res.rows[0]);

  await clientProd.end();
}

main().catch(console.error);
