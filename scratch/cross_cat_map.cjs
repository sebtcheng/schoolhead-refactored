const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  const client = await pool.connect();
  try {
    console.log("--- Cross-Table Category Mapping ---");
    console.log("Source: engineer_form (New Construction)");
    console.log("Joined with: import_beff_projects (Master)");
    
    const res = await client.query(`
      SELECT i.project_category as master_category, COUNT(*) 
      FROM engineer_form e 
      JOIN import_beff_projects i ON e.ipc = i.ipc 
      WHERE e.project_category ILIKE '%New Con%' 
      GROUP BY i.project_category
    `);
    console.table(res.rows);

    const totalRes = await client.query(`
       SELECT COUNT(*) FROM engineer_form e WHERE e.project_category ILIKE '%New Con%'
    `);
    console.log(`Total NC in engineer_form: ${totalRes.rows[0].count}`);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
