const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const client = await pool.connect();
  try {
    console.log("--- Investigating Missing 'NC' Projects ---");
    
    // I previously saw 'NC' projects for some schools.
    // Let's find projects in engineer_form that I recovered, 
    // and see if their counterparts in import_beff_projects have changed category.
    
    const sampleEF = await client.query(`
      SELECT ipc, school_id, funding_year, project_category 
      FROM engineer_form 
      WHERE project_category = 'New Construction'
      AND ipc LIKE 'INF-%'
      LIMIT 10
    `);
    
    for (const ef of sampleEF.rows) {
      const matchMaster = await client.query(`
        SELECT project_category, ipc 
        FROM import_beff_projects 
        WHERE school_id::text = $1 AND funding_year::text = $2
      `, [String(ef.school_id), String(ef.funding_year)]);
      
      console.log(`\nEF Project (School ${ef.school_id}, Year ${ef.funding_year})`);
      console.table(matchMaster.rows);
    }

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
