const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  const client = await pool.connect();
  try {
    console.log("--- DEFINITIVE CATEGORY AUDIT: import_beff_projects ---");
    
    // Get ALL categories
    const res = await client.query(`
      SELECT project_category, COUNT(*) as count
      FROM import_beff_projects 
      GROUP BY project_category 
      ORDER BY count DESC
    `);
    console.table(res.rows);

    // Sample some "Repair" projects
    console.log("\n--- Sample Repair Projects ---");
    const sample = await client.query(`
      SELECT ipc, school_id, project_name, project_category 
      FROM import_beff_projects 
      WHERE project_category = 'Repair' 
      LIMIT 10
    `);
    console.table(sample.rows);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
