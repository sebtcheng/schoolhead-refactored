const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const res = await pool.query(`SELECT COUNT(*) FROM ph_schools_audit_legacy`);
    console.log("Legacy row count:", res.rows[0].count);
    
    const res2 = await pool.query(`SELECT COUNT(*) FROM ph_schools_audit`);
    console.log("Current row count:", res2.rows[0].count);
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await pool.end();
  }
}

main();
