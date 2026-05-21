const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    console.log("Checking all schemas for ph_schools_audit...");
    const res = await pool.query(`
      SELECT table_schema, table_name, table_type 
      FROM information_schema.tables 
      WHERE table_name = 'ph_schools_audit'
    `);
    console.table(res.rows);
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await pool.end();
  }
}

main();
