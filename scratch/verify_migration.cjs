'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  const client = await pool.connect();
  try {
    const mapping = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'ipc_mapping.json'), 'utf8'));
    const newIpcs = mapping.map(m => m.new_ipc);
    
    const resIBPUnique = await client.query(`SELECT count(DISTINCT ipc) FROM import_beff_projects`);
    console.log(`UNIQUE_IPCS_IN_IBP:${resIBPUnique.rows[0].count}`);

    const resEFUnique = await client.query(`SELECT count(DISTINCT ipc) FROM engineer_form`);
    console.log(`UNIQUE_IPCS_IN_EF:${resEFUnique.rows[0].count}`);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
