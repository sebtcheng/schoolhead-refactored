const pg = require('pg');
const { Pool } = pg;

const dbUrl = 'postgres://Administrator1:<REDACTED_PGB_PASS>@20.24.58.49:6432/insightEd';
const pool = new Pool({
  connectionString: dbUrl,
  ssl: false
});

async function fixSchema() {
  try {
    console.log("Adding 'district' column to 'engineer_form'...");
    await pool.query("ALTER TABLE engineer_form ADD COLUMN IF NOT EXISTS district TEXT");
    console.log("Success! Columns should now match (except for ordering).");

    // Verify
    const resForm = await pool.query("SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name = 'engineer_form'");
    console.log("engineer_form columns now:", resForm.rows[0].count);
    
    const resCreate = await pool.query("SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name = 'engineer_create'");
    console.log("engineer_create columns:", resCreate.rows[0].count);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

fixSchema();
