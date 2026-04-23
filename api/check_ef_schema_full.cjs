const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd', ssl: { rejectUnauthorized: false } });

async function checkConstraints() {
  try {
    const res = await pool.query(`
      SELECT 
          column_name, 
          is_nullable, 
          column_default,
          data_type
      FROM 
          information_schema.columns 
      WHERE 
          table_name = 'engineer_form'
      ORDER BY 
          ordinal_position;
    `);
    console.log(JSON.stringify(res.rows));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkConstraints();
