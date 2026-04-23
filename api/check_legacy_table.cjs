const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd', ssl: { rejectUnauthorized: false } });

async function checkLegacyTable() {
  try {
    const res = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_name = 'engineer_form_legacy'`);
    console.log("Table exists:", res.rowCount > 0);
    
    if (res.rowCount > 0) {
      const cols = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'engineer_form_legacy'`);
      console.log("Columns:", JSON.stringify(cols.rows));
      
      const constraints = await pool.query(`
        SELECT 
            conname AS constraint_name, 
            pg_get_constraintdef(oid) AS constraint_definition
        FROM 
            pg_constraint 
        WHERE 
            conrelid = 'engineer_form_legacy'::regclass;
      `);
      console.log("Constraints on legacy table:", JSON.stringify(constraints.rows));
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkLegacyTable();
