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
      WHERE table_name = 'ph_schools_validate'
      AND table_schema = 'public';
    `);
    
    if (res.rowCount === 0) {
      console.log("Table 'ph_schools_validate' DOES NOT EXIST in public schema.");
      
      // Check other schemas just in case
      const schemaRes = await pool.query(`
        SELECT table_schema, table_name, table_type
        FROM information_schema.tables
        WHERE table_name = 'ph_schools_validate';
      `);
      if (schemaRes.rowCount > 0) {
        console.log("Found in other schemas:");
        console.table(schemaRes.rows);
      } else {
        console.log("Not found in any schema.");
      }
    } else {
      console.log("Table 'ph_schools_validate' exists:");
      console.table(res.rows);
    }

  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await pool.end();
  }
}

main();
