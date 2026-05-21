const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    console.log("Verifying columns of ph_schools_validate...");
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ph_schools_validate' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.table(res.rows);
    
    console.log("\nTesting a query on ph_schools_validate...");
    const test = await pool.query(`SELECT school_id, status, region, division FROM ph_schools_validate LIMIT 1`);
    console.log("Query success!");
    console.table(test.rows);
  } catch (err) {
    console.error("Verification failed:", err.message);
  } finally {
    await pool.end();
  }
}

main();
