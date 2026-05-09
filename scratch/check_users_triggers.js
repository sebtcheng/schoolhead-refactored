import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

async function checkUsersTriggers() {
  try {
    const res = await pool.query(`
      SELECT tgname 
      FROM pg_trigger 
      WHERE tgrelid = 'users'::regclass
    `);
    console.log("Triggers on users:", res.rows.map(r => r.tgname));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkUsersTriggers();
