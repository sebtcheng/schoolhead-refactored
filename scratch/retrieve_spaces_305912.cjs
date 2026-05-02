const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function retrieveSpaces() {
  try {
    const res = await pool.query('SELECT * FROM ph_school_buildable_spaces WHERE school_id = $1 OR iern = $1', ['305912']);
    console.log('--- BUILDABLE SPACES FOR SCHOOL 305912 ---');
    console.log(JSON.stringify(res.rows, null, 2));

    if (res.rows.length === 0) {
      console.log('No spaces found for school_id 305912. Checking if any spaces exist at all...');
      const anyRes = await pool.query('SELECT * FROM ph_school_buildable_spaces LIMIT 5');
      console.log('Sample spaces from table:');
      console.log(JSON.stringify(anyRes.rows, null, 2));
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

retrieveSpaces();
