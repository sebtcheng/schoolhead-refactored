import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const res = await pool.query('SELECT * FROM ph_schools WHERE school_id = $1', ['104489']);
  console.log('Results for 104489:', res.rows.length);
  if (res.rows.length > 0) {
    console.log('SCHOOL_NAME:', res.rows[0].school_name);
    console.log('IERN:', res.rows[0].iern);
  }
  await pool.end();
}
check();
