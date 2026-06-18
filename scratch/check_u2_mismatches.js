import pg from 'pg';
const { Client } = pg;

const clientStaging = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging',
  ssl: false
});

const clientProd = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd',
  ssl: false
});

async function main() {
  await clientStaging.connect();
  await clientProd.connect();

  const resProd = await clientProd.query(`
    SELECT COUNT(*) FROM ph_schools WHERE unit2_simplified_enrollment IS NOT NULL
  `);
  console.log(`Production schools with Unit 2 enrollment: ${resProd.rows[0].count}`);

  const resStaging = await clientStaging.query(`
    SELECT COUNT(*) FROM ph_schools WHERE unit2_simplified_enrollment IS NOT NULL
  `);
  console.log(`Staging schools with Unit 2 enrollment: ${resStaging.rows[0].count}`);

  // Find if any school with data in prod doesn't have it in staging
  const prodSchools = await clientProd.query(`
    SELECT school_id, iern FROM ph_schools WHERE unit2_simplified_enrollment IS NOT NULL
  `);

  let mismatchCount = 0;
  for (const row of prodSchools.rows) {
    const checkStaging = await clientStaging.query(`
      SELECT school_id, iern, unit2_simplified_enrollment FROM ph_schools
      WHERE school_id = $1
    `, [row.school_id]);

    if (checkStaging.rows.length === 0) {
      console.log(`School ${row.school_id} (IERN: ${row.iern}) is missing entirely from staging ph_schools!`);
      mismatchCount++;
    } else if (checkStaging.rows[0].unit2_simplified_enrollment === null) {
      console.log(`School ${row.school_id} (IERN: ${row.iern}) has Unit 2 data in prod, but it is NULL in staging ph_schools!`);
      mismatchCount++;
    }
  }
  console.log(`Total mismatching Unit 2 schools: ${mismatchCount}`);

  await clientStaging.end();
  await clientProd.end();
}

main().catch(console.error);
