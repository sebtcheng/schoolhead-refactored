const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function getCleanCategories() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT DISTINCT project_category 
      FROM engineer_form 
      WHERE project_category IS NOT NULL
    `);
    process.stdout.write(JSON.stringify(res.rows));
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

getCleanCategories();
