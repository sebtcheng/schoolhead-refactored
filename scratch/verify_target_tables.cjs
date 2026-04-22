const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('engineer_create', 'engineer_form_outbox')
      AND table_schema = 'public'
    `);
    console.table(res.rows);
    
    // Also check for columns if they exist
    for (const row of res.rows) {
      const cols = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1
      `, [row.table_name]);
      console.log(`\nColumns for ${row.table_name}:`);
      console.table(cols.rows);
    }

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
