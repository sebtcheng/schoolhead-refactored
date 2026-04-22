const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const client = await pool.connect();
  try {
    console.log("--- IPC Category Discrepancy Audit ---");
    
    const res = await client.query(`
      SELECT project_category, COUNT(*), LENGTH(project_category) as len
      FROM import_beff_projects 
      WHERE project_category ILIKE 'NC%'
      GROUP BY project_category
    `);
    console.table(res.rows);

    const sample = await client.query(`
      SELECT ipc, project_category, school_id, funding_year 
      FROM import_beff_projects 
      WHERE project_category ILIKE 'NC%' 
      LIMIT 5
    `);
    console.log("\nSample 'NC' records:");
    console.table(sample.rows);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
