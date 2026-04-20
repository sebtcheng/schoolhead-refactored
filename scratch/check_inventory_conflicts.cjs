'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  const client = await pool.connect();
  try {
    const mapping = JSON.parse(fs.readFileSync(require('path').join(__dirname, 'ipc_mapping.json'), 'utf8'));
    const newIpcs = mapping.map(m => m.new_ipc);
    
    const res = await client.query("SELECT ipc FROM engineer_projects_inventory WHERE ipc = ANY($1)", [newIpcs]);
    console.log('Existing target IPCs in inventory:', res.rows.length);
    if (res.rows.length > 0) {
      console.log('First 5 matches:', res.rows.slice(0, 5).map(r => r.ipc));
    }

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
