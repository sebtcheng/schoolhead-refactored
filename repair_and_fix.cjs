const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log("🚀 STARTING COMPREHENSIVE DATA REPAIR & SCHEMA FIX...");

    // 1. RE-LINKING via IPC
    console.log("\n🔗 1. Re-linking engineer_image...");
    const imgRelink = await pool.query(`
      UPDATE engineer_image t
      SET project_id = e.project_id
      FROM engineer_form e
      WHERE t.ipc = e.ipc 
      AND t.project_id != e.project_id;
    `);
    console.log(`   ✅ Re-linked ${imgRelink.rowCount} images.`);

    console.log("\n🔗 2. Re-linking engineer_documents...");
    const docRelink = await pool.query(`
      UPDATE engineer_documents t
      SET project_id = e.project_id
      FROM engineer_form e
      WHERE t.ipc = e.ipc 
      AND t.project_id != e.project_id;
    `);
    console.log(`   ✅ Re-linked ${docRelink.rowCount} documents.`);

    // 2. CLEANUP UNFIXABLE ORPHANS
    const tablesToClean = ['engineer_image', 'engineer_documents', 'project_documents', 'hrodi_project', 'co_finance'];
    console.log("\n🧹 3. Cleaning up unfixable orphans...");
    for (const table of tablesToClean) {
        const delRes = await pool.query(`
          DELETE FROM ${table} t
          WHERE NOT EXISTS (
            SELECT 1 FROM engineer_form e WHERE e.project_id = t.project_id
          );
        `);
        if (delRes.rowCount > 0) {
            console.log(`   🗑️ Removed ${delRes.rowCount} stale records from ${table}.`);
        }
    }

    // 3. SCHEMA REPAIR (Drop & Recreate FKs)
    const fkFixes = [
      { table: 'engineer_image', constraint: 'engineer_image_project_id_fkey' },
      { table: 'project_documents', constraint: 'project_documents_project_id_fkey' },
      { table: 'hrodi_project', constraint: 'hrodi_project_project_id_fkey' },
      { table: 'co_finance', constraint: 'co_finance_project_id_fkey' },
      { table: 'engineer_documents', constraint: 'engineer_documents_project_id_fkey' }
    ];

    console.log("\n🛠️ 4. Repairing Schema Constraints...");
    for (const fix of fkFixes) {
      console.log(`   Fixing ${fix.table}...`);
      // Standardize the sequence: Drop then Add
      await pool.query(`ALTER TABLE ${fix.table} DROP CONSTRAINT IF EXISTS ${fix.constraint};`);
      await pool.query(`
        ALTER TABLE ${fix.table} 
        ADD CONSTRAINT ${fix.constraint} 
        FOREIGN KEY (project_id) 
        REFERENCES engineer_form(project_id) 
        ON DELETE CASCADE;
      `);
      console.log(`      ✅ ${fix.constraint} restored.`);
    }

    console.log("\n🏁 REPAIR COMPLETE! 🏁");

    // Final Validation
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
          AND tc.table_name IN ('engineer_image', 'project_documents', 'hrodi_project', 'co_finance', 'engineer_documents')
          AND ccu.table_name = 'engineer_form';
    `);
    
    console.log("\nVerified Foreign Keys pointing to engineer_form:");
    console.table(auditRes.rows);

  } catch (e) {
    console.error("\n❌ FATAL REPAIR ERROR:", e.message);
  } finally {
    await pool.end();
  }
}

run();
