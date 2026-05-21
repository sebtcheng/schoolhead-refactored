const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    console.log("Checking for tables with 'status' column...");
    const res = await pool.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE column_name = 'status'
      AND table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log("Tables containing 'status' column:");
    console.table(res.rows);

    console.log("\nChecking suspect tables for 'status' column...");
    const suspectTables = ['ph_schools', 'ph_schools_validate', 'ph_school_completion'];
    for (const table of suspectTables) {
      const colRes = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns
        WHERE table_name = $1
        AND table_schema = 'public'
        ORDER BY ordinal_position;
      `, [table]);
      
      const hasStatus = colRes.rows.some(r => r.column_name === 'status');
      console.log(`Table '${table}': ${hasStatus ? 'HAS' : 'DOES NOT HAVE'} 'status' column.`);
      if (!hasStatus) {
          console.log(`Columns in '${table}':`, colRes.rows.map(r => r.column_name).join(', '));
      }
    }

  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await pool.end();
  }
}

main();
