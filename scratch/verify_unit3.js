import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging',
  ssl: false
});

async function main() {
  await client.connect();

  console.log('--- Unit 3 Verification ---');
  
  const resTarget = await client.query('SELECT COUNT(*) FROM unit3_organized_classes');
  console.log(`Total rows in target table (unit3_organized_classes): ${resTarget.rows[0].count}`);

  const resSource = await client.query(`
    SELECT COUNT(*) 
    FROM ph_schools 
    WHERE unit3_completed = TRUE OR unit3 = 100
  `);
  console.log(`Total completed Unit 3 rows in ph_schools: ${resSource.rows[0].count}`);

  console.log('\n--- Sample Row Detail ---');
  const sample = await client.query(`
    SELECT iern, school_id, unit3, unit3_completed, grade_kinder_size, multigrade_size_1 
    FROM unit3_organized_classes 
    WHERE iern != '999163'
    LIMIT 1
  `);
  console.log(sample.rows[0]);

  await client.end();
}
main().catch(console.error);
