const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const res = await pool.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_name = 'ph_schools_audit'
    `);
    console.table(res.rows);
    
    const res2 = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'ph_schools_audit_legacy'
    `);
    console.log("Legacy table exists:", res2.rowCount > 0);
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await pool.end();
  }
}

main();
