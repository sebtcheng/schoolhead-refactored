const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("--- STARTING PER-RECORD DIAGNOSTIC MIGRATION (V6) ---");

    // 1. Setup
    await client.query(`ALTER TABLE engineer_form_outbox ADD COLUMN IF NOT EXISTS project_id INTEGER`);
    
    const orphanRes = await client.query(`
      SELECT * FROM engineer_form e
      WHERE project_category = 'New Construction'
      AND ipc LIKE 'INF-%'
      AND NOT EXISTS (SELECT 1 FROM import_beff_projects i WHERE i.ipc = e.ipc)
      LIMIT 100 -- Process in smaller batches for diagnostic
    `);
    const orphans = orphanRes.rows;
    console.log(`Auditing batch of ${orphans.length} orphans.`);

    const efColsRes = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'engineer_form'`);
    const efColumns = efColsRes.rows.map(r => r.column_name).filter(c => !c.includes(' ') && !c.toLowerCase().includes('total'));

    for (const project of orphans) {
      const targetTable = (project.engineer_id) ? 'engineer_create' : 'engineer_form_outbox';
      const targetColsRes = await client.query(`SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_name = $1`, [targetTable]);
      const targetColsMap = new Map(targetColsRes.rows.map(r => [r.column_name, r]));

      const validCols = efColumns.filter(c => targetColsMap.has(c));
      
      try {
        const colStr = validCols.map(c => `"${c}"`).join(', ');
        const valStr = validCols.map((_, i) => `$${i + 1}`).join(', ');
        const vals = validCols.map(c => {
           const val = project[c];
           const meta = targetColsMap.get(c);
           // TRUNCATE if it's a fixed character field
           if (meta.character_maximum_length && typeof val === 'string' && val.length > meta.character_maximum_length) {
             console.log(`TRUNCATING column ${c} for project ${project.project_id}: length ${val.length} -> ${meta.character_maximum_length}`);
             return val.substring(0, meta.character_maximum_length);
           }
           return val;
        });

        await client.query(`INSERT INTO ${targetTable} (${colStr}) VALUES (${valStr}) ON CONFLICT (project_id) DO NOTHING`, vals);
      } catch (err) {
        console.error(`FAILED Project ${project.project_id} -> ${targetTable}: ${err.message}`);
        throw err;
      }
    }

    console.log("Diagnostic batch finished.");

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
