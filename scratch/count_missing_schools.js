import pg from 'pg';
import { pool as stagingPool } from '../api/utils/db.js';
const { Pool } = pg;

const prodConnectionString = 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd';

async function main() {
  const isProd = process.argv[2] === 'prod';

  let pool;
  if (isProd) {
    console.log("⚠️ RUNNING IN PRODUCTION MODE (insightEd database)");
    pool = new Pool({
      connectionString: prodConnectionString,
      ssl: { rejectUnauthorized: false }
    });
  } else {
    console.log("ℹ️ Running in Staging/Dev mode");
    pool = stagingPool;
  }

  const client = await pool.connect();
  try {
    // Count total rows in schools_IERN
    const totalIernRes = await client.query('SELECT COUNT(*) FROM "schools_IERN"');
    const totalIern = totalIernRes.rows[0].count;

    // Count how many "SchoolID" in schools_IERN do not exist in ph_schools.school_id
    const missingRes = await client.query(`
      SELECT COUNT(*) 
      FROM "schools_IERN" s
      LEFT JOIN ph_schools p ON s."SchoolID" = p.school_id
      WHERE p.school_id IS NULL
    `);
    const missingCount = missingRes.rows[0].count;

    console.log(`Total schools in schools_IERN: ${totalIern}`);
    console.log(`Schools in schools_IERN not present in ph_schools: ${missingCount}`);
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    if (isProd) {
      await pool.end();
    } else {
      await stagingPool.end();
    }
  }
}
main();
