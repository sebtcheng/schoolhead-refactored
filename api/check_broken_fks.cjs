const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd', ssl: { rejectUnauthorized: false } });

async function checkBrokenFKs() {
  try {
    const res = await pool.query(`
      SELECT 
          conrelid::regclass AS table_name, 
          conname AS constraint_name, 
          pg_get_constraintdef(oid) AS definition
      FROM 
          pg_constraint 
      WHERE 
          confrelid = 'engineer_form_legacy_1774683767'::regclass;
    `);
    console.log(JSON.stringify(res.rows));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkBrokenFKs();
