const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const client = await pool.connect();
  try {
    const efCols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'engineer_form'`);
    const createCols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'engineer_create'`);
    
    const efSet = new Set(efCols.rows.map(r => r.column_name));
    const createSet = new Set(createCols.rows.map(r => r.column_name));
    
    const missingInCreate = [...efSet].filter(c => !createSet.has(c));
    console.log(`Missing in Engineer Create: ${missingInCreate.length}`);
    if (missingInCreate.length > 0) {
      console.log("\nWARNING: Columns missing in Engineer Create:");
      console.table(missingInCreate);
    }
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
