const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("--- STARTING MIGRATION V11: AGGRESSIVE TRUNCATION ---");

    await client.query(`ALTER TABLE engineer_form_outbox ADD COLUMN IF NOT EXISTS project_id INTEGER`);
    
    const orphanRes = await client.query(`
      SELECT * FROM engineer_form e
      WHERE project_category = 'New Construction'
      AND ipc LIKE 'INF-%'
      AND NOT EXISTS (SELECT 1 FROM import_beff_projects i WHERE i.ipc = e.ipc)
    `);
    
    const orphanMap = new Map();
    for (const row of orphanRes.rows) {
      if (!orphanMap.has(row.project_id)) {
        orphanMap.set(row.project_id, row);
      }
    }
    const orphans = Array.from(orphanMap.values());
    console.log(`Deduplicated: ${orphans.length} unique orphans.`);

    const efColsRes = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'engineer_form'`);
    const efColumns = efColsRes.rows.map(r => r.column_name).filter(c => /^[a-zA-Z0-9_]+$/.test(c));

    let activeCount = 0;
    let inactiveCount = 0;
    let skipCount = 0;

    await client.query('BEGIN');

    for (const project of orphans) {
      const isActuallyActive = (project.engineer_id);
      const targetTable = isActuallyActive ? 'engineer_create' : 'engineer_form_outbox';
      const targetColsRes = await client.query(`SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_name = $1`, [targetTable]);
      const targetColsMap = new Map(targetColsRes.rows.map(r => [r.column_name, r]));

      const validCols = efColumns.filter(c => targetColsMap.has(c));
      const colStr = validCols.map(c => `"${c}"`).join(', ');
      const valStr = validCols.map((_, i) => `$${i + 1}`).join(', ');
      
      const vals = validCols.map(c => {
         let val = project[c];
         if (val === '' || val === undefined || val === null) return null;
         
         const meta = targetColsMap.get(c);

         // Aggressive Type Coercion for Dates
         if (meta.data_type.includes('timestamp') || meta.data_type.includes('date')) {
            const d = Date.parse(val);
            return isNaN(d) ? null : new Date(d);
         }

         // Aggressive Truncation for Restricted Lengths (CHAR(N))
         if (meta.character_maximum_length) {
            const strVal = String(val);
            if (strVal.length > meta.character_maximum_length) {
               return strVal.substring(0, meta.character_maximum_length);
            }
            return strVal;
         }
         
         return val;
      });

      try {
        const exists = await client.query(`SELECT 1 FROM ${targetTable} WHERE project_id = $1`, [project.project_id]);
        if (exists.rows.length === 0) {
          await client.query(`INSERT INTO ${targetTable} (${colStr}) VALUES (${valStr})`, vals);
          if (isActuallyActive) activeCount++; else inactiveCount++;
        } else {
          skipCount++;
        }
      } catch (err) {
        console.error(`Record ${project.project_id} FAILED: ${err.message}`);
        // Log the offending values if it's a length error
        if (err.message.includes('too long')) {
           console.log("Record values:", JSON.stringify(project).substring(0, 500));
        }
        throw err;
      }
    }

    await client.query('COMMIT');
    
    console.log("Cleanup...");
    await client.query(`
      DELETE FROM engineer_form 
      WHERE project_id IN (SELECT project_id FROM engineer_create)
      OR project_id IN (SELECT project_id FROM engineer_form_outbox)
    `);

    console.log(`\nSUCCESS: Active: ${activeCount}, Inactive: ${inactiveCount}, Skipped: ${skipCount}`);

  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
