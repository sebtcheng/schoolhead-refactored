const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const res = await pool.query(`
      SELECT 
          tc.table_name, 
          tc.constraint_name, 
          ccu.table_name AS foreign_table_name
      FROM 
          information_schema.table_constraints AS tc 
          JOIN information_schema.constraint_column_usage AS ccu 
            ON ccu.constraint_name = tc.constraint_name 
      WHERE 
          tc.constraint_type = 'FOREIGN KEY' 
          AND (ccu.table_name LIKE 'engineer_form%' OR tc.table_name = 'engineer_documents' OR tc.table_name = 'engineer_image');
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

run();
