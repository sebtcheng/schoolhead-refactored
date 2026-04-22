const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const client = await pool.connect();
  try {
    console.log("--- Inspecting Table Columns ---");
    
    // Check engineer_form columns
    const resForm = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'engineer_form'
      ORDER BY ordinal_position LIMIT 10
    `);
    console.log("\nTop 10 columns for engineer_form:");
    console.table(resForm.rows);

    // Check engineer_form_outbox columns
    const resOutbox = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'engineer_form_outbox'
      ORDER BY ordinal_position LIMIT 10
    `);
    console.log("\nTop 10 columns for engineer_form_outbox:");
    console.table(resOutbox.rows);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
