const pg = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkDefault() {
  try {
    const res = await pool.query(`
      SELECT column_default 
      FROM information_schema.columns 
      WHERE table_name = 'engineer_form' AND column_name = 'created_at'
    `);
    console.log("created_at default:", res.rows[0].column_default);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkDefault();
