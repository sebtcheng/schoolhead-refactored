const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const client = await pool.connect();
  try {
    const efCols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'engineer_form'`);
    const outboxCols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'engineer_form_outbox'`);
    
    const efSet = new Set(efCols.rows.map(r => r.column_name));
    const outSet = new Set(outboxCols.rows.map(r => r.column_name));
    
    const missingInTarget = [...efSet].filter(c => !outSet.has(c));
    const extraInTarget = [...outSet].filter(c => !efSet.has(c));

    console.log(`Common Columns: ${[...efSet].filter(c => outSet.has(c)).length}`);
    console.log(`Missing in Outbox Target: ${missingInTarget.length}`);
    console.log(`Extra in Outbox Target: ${extraInTarget.length}`);
    
    if (missingInTarget.length > 0) {
      console.log("\nWARNING: Columns missing in Target:");
      console.table(missingInTarget);
    }

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
