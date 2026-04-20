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
    const res = await client.query("SELECT ipc, file_path, image_data FROM engineer_image WHERE file_path IS NOT NULL LIMIT 5");
    fs.writeFileSync(require('path').join(__dirname, 'image_samples.txt'), JSON.stringify(res.rows, null, 2));
    console.log("Results written to scratch/image_samples.txt");

    const docRes = await client.query("SELECT ipc, pow_pdf, dupa_pdf, contract_pdf FROM engineer_documents WHERE ipc IS NOT NULL LIMIT 5");
    fs.appendFileSync(require('path').join(__dirname, 'image_samples.txt'), "\n\n--- Documents ---\n" + JSON.stringify(docRes.rows, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
