const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkImportCats() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT project_category, COUNT(*) 
      FROM import_beff_projects 
      GROUP BY project_category
    `);
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

checkImportCats();
