const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    const res = await pool.query("SELECT * FROM unit6_school_resources LIMIT 5");
    console.log("=== unit6_school_resources ===");
    console.log(res.rows);

    const countRes = await pool.query("SELECT COUNT(*) FROM unit6_school_resources");
    console.log("Total rows in unit6_school_resources:", countRes.rows[0].count);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
