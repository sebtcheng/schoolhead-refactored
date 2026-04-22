const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function listCategories() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT project_category, COUNT(*) as count 
      FROM engineer_form 
      GROUP BY project_category 
      ORDER BY count DESC
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

listCategories();
