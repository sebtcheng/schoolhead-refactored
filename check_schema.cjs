const pg = require('pg');
const { Pool } = pg;

const dbUrl = 'postgres://Administrator1:<REDACTED_PGB_PASS>@20.24.58.49:6432/insightEd';
const pool = new Pool({
  connectionString: dbUrl,
  ssl: false
});

async function checkColumns() {
  try {
    const resForm = await pool.query("SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name = 'engineer_form'");
    console.log("engineer_form columns:", resForm.rows[0].count);

    const resCreate = await pool.query("SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name = 'engineer_create'");
    console.log("engineer_create columns:", resCreate.rows[0].count);

    const resDiff = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'engineer_form'
      AND column_name NOT IN (SELECT column_name FROM information_schema.columns WHERE table_name = 'engineer_create')
    `);
    console.log("Columns in engineer_form but NOT in engineer_create:", JSON.stringify(resDiff.rows, null, 2));

    const resDiff2 = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'engineer_create'
      AND column_name NOT IN (SELECT column_name FROM information_schema.columns WHERE table_name = 'engineer_form')
    `);
    console.log("Columns in engineer_create but NOT in engineer_form:", JSON.stringify(resDiff2.rows, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkColumns();
