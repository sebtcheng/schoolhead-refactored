import pg from 'pg';
const { Client } = pg;

const clientStaging = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging',
  ssl: false
});

async function main() {
  await clientStaging.connect();
  console.log('Connected to Staging database for verification.');

  // 1. Total resources migrated
  const resResources = await clientStaging.query('SELECT COUNT(*) FROM unit6_school_resources');
  console.log(`Total records in unit6_school_resources: ${resResources.rows[0].count}`);

  // 2. Completed resources count
  const resCompletedResources = await clientStaging.query('SELECT COUNT(*) FROM unit6_school_resources WHERE unit6_completed = TRUE');
  console.log(`Completed records in unit6_school_resources: ${resCompletedResources.rows[0].count}`);

  // 3. Furniture grades rows count
  const resGrades = await clientStaging.query('SELECT COUNT(*) FROM unit6_furniture_grades');
  console.log(`Total records in unit6_furniture_grades: ${resGrades.rows[0].count}`);

  // 4. eCarts batches count
  const resCarts = await clientStaging.query('SELECT COUNT(*) FROM unit6_ecart_batches');
  console.log(`Total records in unit6_ecart_batches: ${resCarts.rows[0].count}`);

  // 5. Check completed flag in staging ph_schools matching unit6_school_resources
  const resMismatch = await clientStaging.query(`
    SELECT COUNT(*) 
    FROM ph_schools ps
    LEFT JOIN unit6_school_resources usr ON ps.school_id = usr.school_id
    WHERE ps.unit6_completed = TRUE AND (usr.unit6_completed IS NULL OR usr.unit6_completed = FALSE)
  `);
  console.log(`Completed staging ph_schools missing/incomplete in unit6_school_resources: ${resMismatch.rows[0].count}`);

  // 6. Detailed counts by flag
  const resPhFlags = await clientStaging.query(`
    SELECT COUNT(*) FILTER (WHERE unit6_completed = TRUE) as completed_in_ph_schools
    FROM ph_schools
  `);
  console.log('Staging ph_schools progress flags counts:', resPhFlags.rows[0]);

  await clientStaging.end();
}

main().catch(console.error);
