const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function findColumns() {
  const client = await pool.connect();
  try {
    const tables = ['engineer_form', 'import_beff_projects'];
    for (const table of tables) {
      console.log(`\n--- ${table} Columns ---`);
      const res = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1
      `, [table]);
      console.table(res.rows);
    }
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

findColumns();
