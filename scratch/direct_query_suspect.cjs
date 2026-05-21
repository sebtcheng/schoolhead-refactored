const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    console.log("Direct query to ph_schools_validate...");
    const res = await pool.query(`SELECT * FROM ph_schools_validate LIMIT 1`);
    console.log("Success! Columns:", Object.keys(res.rows[0] || {}).join(', '));
  } catch (err) {
    console.error("Direct query failed:", err.message);
  } finally {
    await pool.end();
  }
}

main();
