import pg from 'pg';
const { Client } = pg;

const clientStaging = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging',
  ssl: false
});

async function main() {
  await clientStaging.connect();

  console.log('Updating iern for school 111360 in staging ph_schools...');
  try {
    const updateRes = await clientStaging.query(`
      UPDATE ph_schools 
      SET iern = '2026-06495' 
      WHERE school_id = '111360' AND (iern = '' OR iern IS NULL)
    `);
    console.log(`Update result: affected ${updateRes.rowCount} rows`);
  } catch (err) {
    console.error('Error updating ph_schools iern:', err.message);
  }

  await clientStaging.end();
}

main().catch(console.error);
