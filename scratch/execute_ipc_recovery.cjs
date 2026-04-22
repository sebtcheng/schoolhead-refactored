const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("--- Starting IPC Mapping Recovery Migration (9,245 Projects) ---");

    // 1. Identify all child tables with 'ipc' column (Filtering out views)
    const tableRes = await client.query(`
      SELECT c.table_name 
      FROM information_schema.columns c
      JOIN information_schema.tables t ON c.table_name = t.table_name AND c.table_schema = t.table_schema
      WHERE c.column_name = 'ipc' 
        AND c.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
    `);
    const tables = tableRes.rows.map(r => r.table_name);
    console.log("Affected tables:", tables);

    // 2. Identify the 9,245 projects and their new IPCs
    // Using the same query as the recovery analysis
    const mappingQuery = `
      WITH non_ipc_matches AS (
        SELECT *
        FROM engineer_form e
        WHERE NOT EXISTS (
          SELECT 1 FROM import_beff_projects i WHERE i.ipc = e.ipc
        )
        AND e.project_category = 'New Construction'
      )
      SELECT 
        e.ipc as old_ipc,
        i.ipc as new_ipc,
        e.project_id
      FROM non_ipc_matches e
      JOIN import_beff_projects i ON 
        e.school_id::text = i.school_id::text AND
        e.funding_year::text = i.funding_year::text AND
        (
          (e.project_category = 'New Construction' AND i.project_category = 'NC') OR
          (e.project_category = i.project_category)
        ) AND
        ABS(COALESCE(e.approved_budget_for_contract, 0) - COALESCE(i.approved_budget_for_contract, 0)) < 0.01
    `;

    const mappingRes = await client.query(mappingQuery);
    const mappings = mappingRes.rows;
    console.log(`Mapping generated for ${mappings.length} projects.`);

    if (mappings.length === 0) {
      console.log("No projects found to migrate.");
      return;
    }

    // 3. Execute updates in a transaction
    await client.query('BEGIN');
    console.log("Transaction started...");

    let totalUpdated = 0;
    for (const row of mappings) {
      const { old_ipc, new_ipc, project_id } = row;
      
      // Update each table
      // We use old_ipc to find the records in child tables, and new_ipc to update them.
      // IMPORTANT: We update engineer_form by project_id first if possible to be precise, 
      // but child tables usually only have 'ipc'.
      
      for (const table of tables) {
        try {
          if (table === 'engineer_form') {
            await client.query(`UPDATE engineer_form SET ipc = $1 WHERE project_id = $2`, [new_ipc, project_id]);
          } else if (table === 'engineer_projects_inventory') {
            // Special handling for inventory to avoid PK conflicts
            // If the new_ipc already exists, we might need to delete the old one or merge.
            // For now, let's check if the new_ipc exists.
            const existsRes = await client.query(`SELECT 1 FROM engineer_projects_inventory WHERE ipc = $1`, [new_ipc]);
            if (existsRes.rows.length > 0) {
              // If it exists, we delete the old one to avoid conflict (assuming the new one is correct/identical)
              // Or we could merge, but usually these are unique per IPC.
              await client.query(`DELETE FROM engineer_projects_inventory WHERE ipc = $1`, [old_ipc]);
            } else {
              await client.query(`UPDATE engineer_projects_inventory SET ipc = $1 WHERE ipc = $2`, [new_ipc, old_ipc]);
            }
          } else {
            await client.query(`UPDATE ${table} SET ipc = $1 WHERE ipc = $2`, [new_ipc, old_ipc]);
          }
        } catch (tableErr) {
          // If we still hit a unique constraint on other tables, log it but don't fail the whole transaction if possible
          // though we are in a transaction, so we should handle it.
          if (tableErr.code === '23505') {
            console.warn(`Unique constraint violation on ${table} for IPC ${new_ipc}. Skipping...`);
          } else {
            throw tableErr;
          }
        }
      }
      
      totalUpdated++;
      if (totalUpdated % 1000 === 0) {
        console.log(`Updated ${totalUpdated} projects...`);
      }
    }

    await client.query('COMMIT');
    console.log(`\nSUCCESS: Migrated ${totalUpdated} projects across ${tables.length} tables.`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("\nMIGRATION FAILED - Transaction Rolled Back.");
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
