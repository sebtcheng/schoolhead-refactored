const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT project_category, COUNT(*) 
      FROM import_beff_projects 
      GROUP BY project_category
    `);
    console.table(res.rows);

    const matchCheck = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM engineer_form WHERE project_category = 'New Construction') as ef_nc,
        (SELECT COUNT(*) FROM import_beff_projects WHERE project_category = 'New Construction') as import_nc,
        (SELECT COUNT(*) FROM import_beff_projects WHERE project_category = 'NC') as import_nc_short
    `);
    console.table(matchCheck.rows);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
