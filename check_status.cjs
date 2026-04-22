const pg = require('pg');
const { Pool } = pg;

const dbUrl = 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd';
const pool = new Pool({
  connectionString: dbUrl,
  ssl: false
});

async function checkStatus() {
  try {
    const res = await pool.query("SELECT email, registration_status FROM users WHERE email = 'david.pacheco@deped.gov.ph'");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkStatus();
