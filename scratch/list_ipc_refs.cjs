'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  const client = await pool.connect();
  try {
    console.log("--- Tables with 'ipc' column ---");
    const ipcCols = await client.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE column_name = 'ipc' AND table_schema = 'public'
    `);
    console.log(ipcCols.rows);

    console.log("\n--- Foreign Keys referencing engineer_form(ipc) ---");
    const fks = await client.query(`
      SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema 
      JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema 
      WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'engineer_form' AND ccu.column_name = 'ipc'
    `);
    const fs = require('fs');
    let out = "--- Tables with 'ipc' column ---\n";
    out += JSON.stringify(ipcCols.rows, null, 2) + "\n\n";
    out += "--- Foreign Keys referencing engineer_form(ipc) ---\n";
    out += JSON.stringify(fks.rows, null, 2) + "\n";
    
    fs.writeFileSync(require('path').join(__dirname, 'ipc_refs.txt'), out);
    console.log("Results written to scratch/ipc_refs.txt");

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
