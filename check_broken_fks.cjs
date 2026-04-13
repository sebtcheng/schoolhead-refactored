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
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
      FROM 
          information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu 
            ON tc.constraint_name = kcu.constraint_name 
            AND tc.table_schema = kcu.table_schema 
          JOIN information_schema.constraint_column_usage AS ccu 
            ON ccu.constraint_name = tc.constraint_name 
            AND ccu.table_schema = tc.table_schema 
      WHERE 
          tc.constraint_type = 'FOREIGN KEY' 
          AND ccu.table_name LIKE 'engineer_form_%';
    `);
    console.log("Broken Foreign Keys (pointing to backups):", JSON.stringify(res.rows, null, 2));
    
    // Also check if any other tables are missing engineer_form connection
    const res2 = await pool.query(`
      SELECT 
          tc.table_name, 
          tc.constraint_name, 
          kcu.column_name,
          ccu.table_name AS foreign_table_name
      FROM 
          information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu 
            ON tc.constraint_name = kcu.constraint_name 
          JOIN information_schema.constraint_column_usage AS ccu 
            ON ccu.constraint_name = tc.constraint_name 
      WHERE 
          tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_name IN ('engineer_image', 'engineer_documents');
    `);
    console.log("Current constraints for relevant tables:", JSON.stringify(res2.rows, null, 2));

  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

run();
