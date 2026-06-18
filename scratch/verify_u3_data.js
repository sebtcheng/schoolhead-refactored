import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging',
  ssl: false
});

async function main() {
  await client.connect();

  console.log('--- Verification of Schools with Legacy JSON Data ---');
  
  const res = await client.query(`
    SELECT * 
    FROM unit3_organized_classes 
    WHERE school_id IN ('103840', '108188', '303449')
  `);

  res.rows.forEach(row => {
    console.log(`\nSchool ID: ${row.school_id}`);
    console.log(`iern: ${row.iern}`);
    console.log(`unit3_completed: ${row.unit3_completed}`);
    console.log(`grade_kinder_size: ${row.grade_kinder_size}`);
    console.log(`grade_1_size: ${row.grade_1_size}`);
    console.log(`grade_2_size: ${row.grade_2_size}`);
    console.log(`grade_3_size: ${row.grade_3_size}`);
    console.log(`grade_4_size: ${row.grade_4_size}`);
    console.log(`grade_5_size: ${row.grade_5_size}`);
    console.log(`grade_6_size: ${row.grade_6_size}`);
    console.log(`grade_7_size: ${row.grade_7_size}`);
    console.log(`grade_8_size: ${row.grade_8_size}`);
    console.log(`grade_9_size: ${row.grade_9_size}`);
    console.log(`grade_10_size: ${row.grade_10_size}`);
    console.log(`grade_11_size: ${row.grade_11_size}`);
    console.log(`grade_12_size: ${row.grade_12_size}`);
    console.log(`multigrade_size_1: ${row.multigrade_size_1}`);
  });

  await client.end();
}
main().catch(console.error);
