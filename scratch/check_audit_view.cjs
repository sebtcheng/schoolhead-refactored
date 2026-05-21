const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    console.log("Checking ph_schools_audit...");
    const res = await pool.query(`SELECT * FROM ph_schools_audit LIMIT 1`);
    console.log("Success! Columns:", Object.keys(res.rows[0] || {}).join(', '));
  } catch (err) {
    console.error("ph_schools_audit failed:", err.message);
  } finally {
    await pool.end();
  }
}

main();
