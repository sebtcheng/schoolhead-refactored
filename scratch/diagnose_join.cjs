'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  const client = await pool.connect();
  try {
    const mappingPath = path.join(__dirname, 'ipc_mapping.json');
    const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
    
    let success = 0;
    let fail = 0;
    for (const m of mapping) {
      const res = await client.query(`
        SELECT count(*) 
        FROM engineer_form ef 
        JOIN import_beff_projects ibp ON ef.ipc = ibp.ipc 
        WHERE ef.ipc = $1
      `, [m.new_ipc]);
      
      if (parseInt(res.rows[0].count, 10) > 0) {
        success++;
      } else {
        fail++;
      }
    }
    console.log(`Diagnostic Complete: SUCCESS=${success}, FAIL=${fail}`);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
