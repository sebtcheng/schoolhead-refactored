const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd', ssl: { rejectUnauthorized: false } });

async function checkSpecificFK() {
  try {
    const res = await pool.query(`
      SELECT 
          conname, 
          pg_get_constraintdef(oid) 
      FROM 
          pg_constraint 
      WHERE 
          conname = 'fk_engineer_form_legacy_1774683767';
    `);
    console.log(JSON.stringify(res.rows));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkSpecificFK();
