'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'engineer_form' AND table_schema = 'public'
    `);
    const fs = require('fs');
    fs.writeFileSync(require('path').join(__dirname, 'schema_detail.txt'), JSON.stringify(res.rows, null, 2));
    console.log("Results written to scratch/schema_detail.txt");
    
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
