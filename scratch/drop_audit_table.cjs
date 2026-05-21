const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    console.log("Dropping ph_schools_audit table...");
    await pool.query(`DROP TABLE ph_schools_audit;`);
    console.log("Success!");
  } catch (err) {
    console.error("Drop failed:", err.message);
  } finally {
    await pool.end();
  }
}

main();
