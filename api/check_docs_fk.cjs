const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd', ssl: { rejectUnauthorized: false } });

async function checkDocsFK() {
  try {
    const res = await pool.query(`
      SELECT 
          conname, 
          pg_get_constraintdef(oid) 
      FROM 
          pg_constraint 
      WHERE 
          conrelid = 'engineer_documents'::regclass AND conname = 'engineer_documents_project_id_fkey';
    `);
    console.log(JSON.stringify(res.rows));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkDocsFK();
