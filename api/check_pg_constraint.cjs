const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd', ssl: { rejectUnauthorized: false } });

async function checkPgConstraint() {
  try {
    const res = await pool.query(`
      SELECT 
          conname AS constraint_name, 
          conrelid::regclass AS table_name, 
          confrelid::regclass AS foreign_table_name,
          pg_get_constraintdef(oid) AS constraint_definition
      FROM 
          pg_constraint 
      WHERE 
          conname LIKE '%engineer_form_legacy%';
    `);
    console.log(JSON.stringify(res.rows));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkPgConstraint();
