const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const fixes = [
      { table: 'engineer_image', constraint: 'engineer_image_project_id_fkey' },
      { table: 'project_documents', constraint: 'project_documents_project_id_fkey' },
      { table: 'hrodi_project', constraint: 'hrodi_project_project_id_fkey' },
      { table: 'co_finance', constraint: 'co_finance_project_id_fkey' },
      { table: 'engineer_documents', constraint: 'engineer_documents_project_id_fkey' }
    ];

    console.log("🚀 Starting database constraint repair...");

    for (const fix of fixes) {
      console.log(`🛠️ Fixing ${fix.table} (${fix.constraint})...`);
      
      // 1. Drop the broken constraint
      await pool.query(`ALTER TABLE ${fix.table} DROP CONSTRAINT ${fix.constraint};`);
      console.log(`   - Dropped bench constraint.`);

      // 2. Recreate it pointing to the active engineer_form table
      // Note: We use ON DELETE CASCADE to ensure data integrity during project deletions
      await pool.query(`
        ALTER TABLE ${fix.table} 
        ADD CONSTRAINT ${fix.constraint} 
        FOREIGN KEY (project_id) 
        REFERENCES engineer_form(project_id) 
        ON DELETE CASCADE;
      `);
      console.log(`   - Successfully re-linked to engineer_form.`);
    }

    console.log("\n✅ All constraints have been repaired! Checking Linkage...");
    
    // Final Audit call
    const auditRes = await pool.query(`
      SELECT 
          tc.table_name, 
          ccu.table_name AS foreign_table_name
      FROM 
          information_schema.table_constraints AS tc 
          JOIN information_schema.constraint_column_usage AS ccu 
            ON ccu.constraint_name = tc.constraint_name 
      WHERE 
          tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_name IN ('engineer_image', 'project_documents', 'hrodi_project', 'co_finance', 'engineer_documents');
    `);
    
    console.table(auditRes.rows);

  } catch (e) {
    console.error("❌ ERROR during repair:", e.message);
  } finally {
    await pool.end();
  }
}

run();
