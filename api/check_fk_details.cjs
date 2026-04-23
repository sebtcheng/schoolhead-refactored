const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd', ssl: { rejectUnauthorized: false } });

async function checkFK() {
  try {
    const res = await pool.query(`
      SELECT 
          kcu.table_name, 
          kcu.column_name, 
          rel_kcu.table_name AS foreign_table_name, 
          rel_kcu.column_name AS foreign_column_name,
          rc.update_rule,
          rc.delete_rule
      FROM 
          information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.referential_constraints AS rc
            ON tc.constraint_name = rc.constraint_name
          JOIN information_schema.key_column_usage AS rel_kcu
            ON rc.unique_constraint_name = rel_kcu.constraint_name
      WHERE 
          tc.constraint_type = 'FOREIGN KEY' AND tc.constraint_name = 'fk_engineer_form_legacy_1774683767';
    `);
    console.log(JSON.stringify(res.rows));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkFK();
