const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const client = await pool.connect();
  try {
    const projectId = 1024350;
    console.log(`--- BRUTE FORCE DIAGNOSTIC: Project ${projectId} ---`);
    
    const project = (await client.query(`SELECT * FROM engineer_form WHERE project_id = $1`, [projectId])).rows[0];
    const targetTable = 'engineer_form_outbox';
    
    const colsRes = await client.query(`
      SELECT column_name, data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name = $1
    `, [targetTable]);
    
    const targetCols = colsRes.rows;

    for (const col of targetCols) {
      const colName = col.column_name;
      const val = project[colName];
      if (val === undefined || val === null) continue;

      try {
        await client.query('BEGIN');
        // Create a temp table with the EXACT type of the target column
        let typeStr = col.data_type;
        if (col.character_maximum_length) typeStr += `(${col.character_maximum_length})`;
        
        await client.query(`CREATE TEMP TABLE debug_col (val ${typeStr})`);
        await client.query(`INSERT INTO debug_col (val) VALUES ($1)`, [val]);
        await client.query('ROLLBACK');
      } catch (err) {
        console.log(`COLUMN FAILURE: [${colName}] (${col.data_type}${col.character_maximum_length ? '('+col.character_maximum_length+')' : ''})`);
        console.log(`Value: "${val}" (Type: ${typeof val}, Length: ${String(val).length})`);
        console.log(`Error: ${err.message}`);
        await client.query('ROLLBACK');
      }
    }

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
