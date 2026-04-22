const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function introspect() {
  const client = await pool.connect();
  try {
    const efCategories = await client.query(`
      SELECT project_category, COUNT(*) as count 
      FROM engineer_form 
      GROUP BY project_category
    `);
    
    const efPrograms = await client.query(`
      SELECT program_type, COUNT(*) as count 
      FROM engineer_form 
      GROUP BY program_type
    `);

    const importSample = await client.query(`
      SELECT * FROM import_beff_projects LIMIT 1
    `);

    const result = {
      engineer_form_categories: efCategories.rows,
      engineer_form_programs: efPrograms.rows,
      import_beff_projects_sample_columns: Object.keys(importSample.rows[0] || {})
    };

    console.log(JSON.stringify(result, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

introspect();
