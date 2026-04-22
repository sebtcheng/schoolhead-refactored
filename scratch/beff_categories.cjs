const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  const client = await pool.connect();
  try {
    console.log("--- Category Distribution: import_beff_projects ---");
    const res = await client.query(`
      SELECT project_category, COUNT(*) 
      FROM import_beff_projects 
      GROUP BY project_category 
      ORDER BY COUNT(*) DESC
    `);
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
