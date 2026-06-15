import pg from 'pg';
import { pool } from '../api/utils/db.js';
const { Client } = pg;

const prodConnectionString = 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd';

async function countActive() {
  const prodClient = new Client({
    connectionString: prodConnectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // 1. Staging Count
    const stagingRes = await pool.query(`
      SELECT status, COUNT(*) as count 
      FROM "schools_IERN" 
      GROUP BY status;
    `);
    console.log("=== STAGING DATABASE ===");
    console.log(stagingRes.rows);

    // 2. Production Count
    console.log("\nConnecting to production database...");
    await prodClient.connect();
    const prodRes = await prodClient.query(`
      SELECT status, COUNT(*) as count 
      FROM "schools_IERN" 
      GROUP BY status;
    `);
    console.log("=== PRODUCTION DATABASE ===");
    console.log(prodRes.rows);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
    await prodClient.end();
  }
}

countActive();
