const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function listSchools() {
  try {
    const res = await pool.query(`
      SELECT "SchoolID", "School_Name", "Region", "Division" 
      FROM "schools_IERN" 
      LIMIT 20
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

listSchools();
