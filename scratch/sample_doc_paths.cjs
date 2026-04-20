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
    const res = await client.query(`
      SELECT ipc, pow_pdf, pow_filename, contract_pdf, contract_filename 
      FROM engineer_documents 
      WHERE (pow_pdf IS NOT NULL OR pow_filename IS NOT NULL) 
      LIMIT 5
    `);
    fs.writeFileSync(require('path').join(__dirname, 'doc_samples.txt'), JSON.stringify(res.rows, null, 2));
    console.log("Results written to scratch/doc_samples.txt");

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
