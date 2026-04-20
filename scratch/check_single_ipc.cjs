'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  const client = await pool.connect();
  try {
    const fs = require('fs');
    const mapping = JSON.parse(fs.readFileSync(require('path').join(__dirname, 'ipc_mapping.json'), 'utf8'));
    const oldIpcs = mapping.map(m => m.old_ipc);
    const resImg = await client.query("SELECT count(*) FROM engineer_image WHERE ipc = ANY($1)", [oldIpcs]);
    console.log('Count of images for OLD IPCs:', resImg.rows[0].count);
    
    const res2 = await client.query("SELECT count(*) FROM engineer_form WHERE ipc LIKE 'INF-%'");
    console.log('Count of IPCs starting with INF-:', res2.rows[0].count);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
