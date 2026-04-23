const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd', ssl: { rejectUnauthorized: false } });

async function checkRules() {
  try {
    const res = await pool.query(`
      SELECT 
          rulename, 
          ev_type, 
          is_instead, 
          ev_action 
      FROM 
          pg_rewrite 
      WHERE 
          ev_class = 'engineer_form'::regclass;
    `);
    console.log(JSON.stringify(res.rows));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkRules();
