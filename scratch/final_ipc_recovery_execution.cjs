const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("--- Executing Final IPC Mapping Recovery (9,245 Projects) ---");

    // 1. Get affected base tables
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

    // 2. Generate Mapping
    // Use robust join: school_id, funding_year, category mapping, and rounded budget
    const mappingQuery = `
      WITH non_ipc_matches AS (
        SELECT *
        FROM engineer_form e
        WHERE NOT EXISTS (SELECT 1 FROM import_beff_projects i WHERE i.ipc = e.ipc)
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
        ROUND(COALESCE(e.approved_budget_for_contract, 0)::numeric, 0) = ROUND(COALESCE(i.approved_budget_for_contract, 0)::numeric, 0)
    `;

    const mappingRes = await client.query(mappingQuery);
    const mappings = mappingRes.rows;
    console.log(`Final mapping generated for ${mappings.length} unique project IDs.`);

    if (mappings.length === 0) {
      console.log("No projects found to migrate.");
      return;
    }

    // 3. Update Database
    await client.query('BEGIN');
    console.log("Transaction started...");

    let totalUpdated = 0;
    for (const row of mappings) {
      const { old_ipc, new_ipc, project_id } = row;
      
      for (const table of tables) {
        try {
          if (table === 'engineer_form') {
            await client.query(`UPDATE engineer_form SET ipc = $1 WHERE project_id = $2`, [new_ipc, project_id]);
          } else if (table === 'engineer_projects_inventory') {
            const existsRes = await client.query(`SELECT 1 FROM engineer_projects_inventory WHERE ipc = $1`, [new_ipc]);
            if (existsRes.rows.length > 0) {
              await client.query(`DELETE FROM engineer_projects_inventory WHERE ipc = $1`, [old_ipc]);
            } else {
              await client.query(`UPDATE engineer_projects_inventory SET ipc = $1 WHERE ipc = $2`, [new_ipc, old_ipc]);
            }
          } else {
            await client.query(`UPDATE ${table} SET ipc = $1 WHERE ipc = $2`, [new_ipc, old_ipc]);
          }
        } catch (tableErr) {
          if (tableErr.code === '23505') {
            // Already updated or duplicate in a non-PK IPC table
          } else {
            throw tableErr;
          }
        }
      }
      
      totalUpdated++;
      if (totalUpdated % 1000 === 0) console.log(`Processed ${totalUpdated} projects...`);
    }

    await client.query('COMMIT');
    console.log(`\nSUCCESS: Migrated ${totalUpdated} projects across ${tables.length} tables.`);

  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error("\nMIGRATION FAILED - Transaction Rolled Back.");
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
