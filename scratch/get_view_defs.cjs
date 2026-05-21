const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    console.log("Getting definition of ph_schools_validate...");
    const res = await pool.query(`SELECT pg_get_viewdef('ph_schools_validate', true) as definition`);
    console.log("Definition:", res.rows[0].definition);
    
    console.log("\nGetting definition of ph_schools_audit...");
    const res2 = await pool.query(`SELECT pg_get_viewdef('ph_schools_audit', true) as definition`);
    console.log("Definition:", res2.rows[0].definition);
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await pool.end();
  }
}

main();
