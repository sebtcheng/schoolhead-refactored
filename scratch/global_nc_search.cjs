const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const client = await pool.connect();
  try {
    console.log("--- Global 'NC' Category Search ---");
    
    // 1. Find all tables with 'project_category' column
    const tableRes = await client.query(`
      SELECT table_name 
      FROM information_schema.columns 
      WHERE column_name = 'project_category' 
        AND table_schema = 'public'
    `);
    const tables = tableRes.rows.map(r => r.table_name);
    
    for (const table of tables) {
      const countRes = await client.query(`
        SELECT COUNT(*) FROM ${table} WHERE project_category = 'NC'
      `);
      const count = parseInt(countRes.rows[0].count);
      if (count > 0) {
        console.log(`Table ${table} has ${count} 'NC' records.`);
      }
    }

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
