const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function debugColumn() {
  const client = await pool.connect();
  try {
    console.log("--- COLUMN DIAGNOSTIC: PROJECT 100067 ---");
    const project = (await client.query(`SELECT * FROM engineer_form WHERE project_id = 100067`)).rows[0];
    const targetTable = 'engineer_form_outbox';
    
    const targetColsRes = await client.query(`SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_name = $1`, [targetTable]);
    const targetColsMap = new Map(targetColsRes.rows.map(r => [r.column_name, r]));

    const efColsRes = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'engineer_form'`);
    const efColumns = efColsRes.rows.map(r => r.column_name).filter(c => /^[a-zA-Z0-9_]+$/.test(c));
    const validCols = efColumns.filter(c => targetColsMap.has(c));

    for (const col of validCols) {
      try {
        await client.query('BEGIN');
        const meta = targetColsMap.get(col);
        let val = project[col];
        if (val === '' || val === undefined) val = null;
        
        // Single column insert to test
        await client.query(`INSERT INTO temp_debug (val) SELECT $1::${meta.data_type}`, [val]);
        await client.query('ROLLBACK');
      } catch (err) {
        if (err.message.includes('too long')) {
           console.log(`Column [${col}] is failing: ${err.message}. Value: "${project[col]}"`);
        }
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

debugColumn();
