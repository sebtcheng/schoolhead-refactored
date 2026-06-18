import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging',
  ssl: false
});

async function main() {
  await client.connect();

  console.log('--- Verification Summary ---');
  
  const totalStaging = await client.query('SELECT COUNT(*) FROM unit2_school_learners');
  console.log(`Total rows in target table (unit2_school_learners): ${totalStaging.rows[0].count}`);

  const totalSource = await client.query('SELECT COUNT(*) FROM ph_schools WHERE unit2_simplified_enrollment IS NOT NULL');
  console.log(`Total rows in legacy table (ph_schools with enrollment data): ${totalSource.rows[0].count}`);

  console.log('\n--- Sample Migrated Row Detail ---');
  const sample = await client.query(`
    SELECT iern, school_id, enroll_kinder, total_enrollment, total_male, total_female, main_sned, self_sned, has_aral_math, multigrade_groupings_1, multigrade_enrollment_1 
    FROM unit2_school_learners 
    WHERE total_enrollment > 0
    LIMIT 1
  `);
  console.log(sample.rows[0]);

  await client.end();
}
main().catch(console.error);
