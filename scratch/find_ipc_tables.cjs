const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function findIPCTables() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE column_name = 'ipc' 
        AND table_schema = 'public'
    `);
    console.log("Tables with 'ipc' column:");
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

findIPCTables();
