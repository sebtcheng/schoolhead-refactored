const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkTypes() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE column_name IN ('approved_budget_for_contract', 'funding_year', 'school_id')
      AND table_name IN ('engineer_form', 'import_beff_projects')
    `);
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

checkTypes();
