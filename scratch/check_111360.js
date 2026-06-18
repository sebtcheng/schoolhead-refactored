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

  console.log('--- Production ph_schools lookup ---');
  const prodPh = await clientProd.query(`
    SELECT school_id, iern, unit3, unit3_completed 
    FROM ph_schools 
    WHERE school_id = '111360'
  `);
  console.log(prodPh.rows);

  console.log('--- Staging ph_schools lookup ---');
  const stagingPh = await clientStaging.query(`
    SELECT school_id, iern, unit3, unit3_completed 
    FROM ph_schools 
    WHERE school_id = '111360'
  `);
  console.log(stagingPh.rows);

  console.log('--- Staging schools_IERN lookup ---');
  const stagingIern = await clientStaging.query(`
    SELECT "SchoolID", "IERN" 
    FROM "schools_IERN" 
    WHERE "SchoolID" = '111360'
  `);
  console.log(stagingIern.rows);

  await clientStaging.end();
  await clientProd.end();
}

main().catch(console.error);
