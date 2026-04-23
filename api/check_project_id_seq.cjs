const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd', ssl: { rejectUnauthorized: false } });

async function checkSequence() {
  try {
    const res = await pool.query(`
      SELECT 
          column_name, 
          column_default 
      FROM 
          information_schema.columns 
      WHERE 
          table_name = 'engineer_form' AND column_name = 'project_id';
    `);
    console.log("Column Info:", res.rows);

    const seqRes = await pool.query(`
      SELECT sequence_name 
      FROM information_schema.sequences 
      WHERE sequence_name LIKE 'engineer_form_project_id_seq%';
    `);
    console.log("Sequences:", seqRes.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkSequence();
