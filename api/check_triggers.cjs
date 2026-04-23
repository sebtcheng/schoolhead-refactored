const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd', ssl: { rejectUnauthorized: false } });

async function checkTriggers() {
  try {
    const res = await pool.query(`
      SELECT 
          trigger_name, 
          event_manipulation, 
          action_statement, 
          action_timing 
      FROM 
          information_schema.triggers 
      WHERE 
          event_object_table = 'engineer_form';
    `);
    console.log(JSON.stringify(res.rows));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkTriggers();
