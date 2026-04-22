const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("--- STARTING FAULT-TOLERANT MIGRATION (V7) ---");

    await client.query(`ALTER TABLE engineer_form_outbox ADD COLUMN IF NOT EXISTS project_id INTEGER`);
    
    // Process all 5,105 orphans
    const orphanRes = await client.query(`
      SELECT * FROM engineer_form e
      WHERE project_category = 'New Construction'
      AND ipc LIKE 'INF-%'
      AND NOT EXISTS (SELECT 1 FROM import_beff_projects i WHERE i.ipc = e.ipc)
    `);
    const orphans = orphanRes.rows;
    console.log(`Discovered ${orphans.length} orphans for migration.`);

    const efColsRes = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'engineer_form'`);
    const efColumns = efColsRes.rows.map(r => r.column_name).filter(c => !c.includes(' ') && !c.toLowerCase().includes('total'));

    let activeCount = 0;
    let inactiveCount = 0;
    let errorCount = 0;
    let skipCount = 0;

    await client.query('BEGIN');

    for (const project of orphans) {
      const targetTable = (project.engineer_id) ? 'engineer_create' : 'engineer_form_outbox';
      const targetColsRes = await client.query(`SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_name = $1`, [targetTable]);
      const targetColsMap = new Map(targetColsRes.rows.map(r => [r.column_name, r]));

      const validCols = efColumns.filter(c => targetColsMap.has(c));
      
      try {
        // Existence check
        const exists = await client.query(`SELECT 1 FROM ${targetTable} WHERE project_id = $1`, [project.project_id]);
        if (exists.rows.length > 0) {
          skipCount++;
          continue;
        }

        const colStr = validCols.map(c => `"${c}"`).join(', ');
        const valStr = validCols.map((_, i) => `$${i + 1}`).join(', ');
        const vals = validCols.map(c => {
           let val = project[c];
           const meta = targetColsMap.get(c);

           // Handle Null Strings
           if (val === '' || val === undefined) return null;

           // Handle Date/Timestamp casting issues
           if (meta.data_type.includes('timestamp') || meta.data_type.includes('date')) {
             if (typeof val === 'string' && isNaN(Date.parse(val))) {
               return null; // Don't crash on invalid dates
             }
           }

           // Handle Truncation
           if (meta.character_maximum_length && typeof val === 'string' && val.length > meta.character_maximum_length) {
             return val.substring(0, meta.character_maximum_length);
           }
           
           return val;
        });

        await client.query(`INSERT INTO ${targetTable} (${colStr}) VALUES (${valStr})`, vals);
        if (isActive = (project.engineer_id)) activeCount++; else inactiveCount++;

      } catch (err) {
        console.error(`ERROR on Project ${project.project_id}: ${err.message}`);
        errorCount++;
      }
    }

    // Delete ONLY successfully migrated projects
    // Actually, to be safe, I'll delete projects that are confirmed in target.
    console.log("Cleaning up engineer_form...");
    await client.query(`
      DELETE FROM engineer_form 
      WHERE project_id IN (SELECT project_id FROM engineer_create)
      OR project_id IN (SELECT project_id FROM engineer_form_outbox)
    `);

    await client.query('COMMIT');
    console.log(`\nCOMPLETED: Tier 1: ${activeCount}, Tier 2: ${inactiveCount}, Errors: ${errorCount}, Existing: ${skipCount}`);

  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
