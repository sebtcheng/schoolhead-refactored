const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT table_name, column_name, data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name IN ('engineer_form', 'engineer_create', 'engineer_form_outbox') 
      AND character_maximum_length = 1
    `);
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
