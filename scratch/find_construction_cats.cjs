const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function findConstructionCategories() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT DISTINCT project_category 
      FROM engineer_form 
      WHERE project_category ILIKE '%construction%' 
         OR project_category ILIKE '%new%'
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

findConstructionCategories();
