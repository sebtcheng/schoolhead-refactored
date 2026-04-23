const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd', ssl: { rejectUnauthorized: false } });

async function checkAllFKs() {
  try {
    const res = await pool.query(`
      SELECT 
          tc.constraint_name, 
          tc.table_name, 
          kcu.column_name, 
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name 
      FROM 
          information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
      WHERE constraint_type = 'FOREIGN KEY' AND (tc.table_name = 'engineer_form' OR ccu.table_name = 'engineer_form');
    `);
    console.log(JSON.stringify(res.rows));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkAllFKs();
