import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging',
  ssl: false
});

async function main() {
  await client.connect();
  console.log("Connected to DB.");

  const res = await client.query(`
    SELECT * FROM unit5_shifting_modality WHERE school_id = '999163' AND school_yr = 'SY 25-26'
  `);
  
  if (res.rowCount > 0) {
    console.log("Found school data in unit5_shifting_modality:");
    const row = res.rows[0];
    const filtered = {};
    for (const key of Object.keys(row)) {
      if (key.includes('shift') || key.includes('mode') || key.includes('adm')) {
        filtered[key] = row[key];
      }
    }
    console.log(JSON.stringify(filtered, null, 2));
  } else {
    console.log("No record found in unit5_shifting_modality for 999163 with SY 25-26");
    const resAll = await client.query(`
      SELECT school_id, iern, school_yr FROM unit5_shifting_modality WHERE school_id = '999163' OR iern = '999163'
    `);
    console.log("Available records in unit5_shifting_modality:");
    console.table(resAll.rows);
  }

  await client.end();
}
main().catch(console.error);
