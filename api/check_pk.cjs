const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd', ssl: { rejectUnauthorized: false } });

async function checkPK() {
  try {
    const res = await pool.query(`
      SELECT 
          kcu.column_name 
      FROM 
          information_schema.table_constraints tc 
          JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name 
      WHERE 
          tc.table_name = 'engineer_form' AND tc.constraint_type = 'PRIMARY KEY';
    `);
    console.log(JSON.stringify(res.rows));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkPK();
