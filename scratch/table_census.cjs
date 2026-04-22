const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  const client = await pool.connect();
  try {
    console.log("--- COMPREHENSIVE TABLE CENSUS ---");
    
    const stats = [
      ['engineer_form (Total)', 'SELECT count(*) FROM engineer_form'],
      ['engineer_form (New Construction)', "SELECT count(*) FROM engineer_form WHERE project_category ILIKE '%New Con%'"],
      ['engineer_create (Total)', 'SELECT count(*) FROM engineer_create'],
      ['engineer_form_outbox (Total)', 'SELECT count(*) FROM engineer_form_outbox'],
      ['import_beff_projects (Total)', 'SELECT count(*) FROM import_beff_projects']
    ];

    for (const [label, sql] of stats) {
      const res = await client.query(sql);
      console.log(`${label.padEnd(40)}: ${res.rows[0].count}`);
    }

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
