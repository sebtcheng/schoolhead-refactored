import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging',
  ssl: false
});

async function main() {
  await client.connect();

  console.log('--- Non-null size column counts in staging unit3_organized_classes ---');
  const res = await client.query(`
    SELECT 
      COUNT(*) FILTER (WHERE grade_kinder_size IS NOT NULL) as kinder,
      COUNT(*) FILTER (WHERE grade_1_size IS NOT NULL) as g1,
      COUNT(*) FILTER (WHERE grade_2_size IS NOT NULL) as g2,
      COUNT(*) FILTER (WHERE grade_3_size IS NOT NULL) as g3,
      COUNT(*) FILTER (WHERE grade_4_size IS NOT NULL) as g4,
      COUNT(*) FILTER (WHERE grade_5_size IS NOT NULL) as g5,
      COUNT(*) FILTER (WHERE grade_6_size IS NOT NULL) as g6,
      COUNT(*) FILTER (WHERE grade_7_size IS NOT NULL) as g7,
      COUNT(*) FILTER (WHERE grade_8_size IS NOT NULL) as g8,
      COUNT(*) FILTER (WHERE grade_9_size IS NOT NULL) as g9,
      COUNT(*) FILTER (WHERE grade_10_size IS NOT NULL) as g10,
      COUNT(*) FILTER (WHERE grade_11_size IS NOT NULL) as g11,
      COUNT(*) FILTER (WHERE grade_12_size IS NOT NULL) as g12,
      COUNT(*) FILTER (WHERE multigrade_size_1 IS NOT NULL) as mg1
    FROM unit3_organized_classes
  `);
  console.log(res.rows[0]);

  // Query one of them to make sure
  const sample = await client.query(`
    SELECT school_id, iern, grade_kinder_size 
    FROM unit3_organized_classes 
    WHERE grade_kinder_size IS NOT NULL 
    LIMIT 2
  `);
  console.log('\nSample non-null rows:', sample.rows);

  await client.end();
}
main().catch(console.error);
