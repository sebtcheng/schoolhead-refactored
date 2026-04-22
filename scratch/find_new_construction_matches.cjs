const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function findMatches() {
  const client = await pool.connect();
  try {
    // 1. Get categories to identify "New Construction"
    const catRes = await client.query(`
      SELECT DISTINCT project_category 
      FROM engineer_form 
      WHERE project_category ILIKE '%construction%'
    `);
    console.log("Matching Categories in engineer_form:", catRes.rows);

    // 2. Find IPCs in both tables where engineer_form category is 'New Construction'
    // (Assuming the category name from the previous result)
    const matchesRes = await client.query(`
      SELECT 
        e.ipc, 
        e.project_name as ef_project, 
        i.project_name as import_project,
        e.project_category as ef_category,
        e.school_name as ef_school,
        i.school_name as import_school
      FROM engineer_form e
      JOIN import_beff_projects i ON e.ipc = i.ipc
      WHERE e.project_category ILIKE '%new construction%'
         OR e.project_category ILIKE '%construction of%'
      LIMIT 50
    `);

    console.log("\nMatching IPCs (First 50):");
    console.log(JSON.stringify(matchesRes.rows, null, 2));

    const totalMatches = await client.query(`
      SELECT COUNT(*)
      FROM engineer_form e
      JOIN import_beff_projects i ON e.ipc = i.ipc
      WHERE e.project_category ILIKE '%new construction%'
         OR e.project_category ILIKE '%construction of%'
    `);
    console.log("\nTotal Matching IPCs with Construction Category:", totalMatches.rows[0].count);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

findMatches();
