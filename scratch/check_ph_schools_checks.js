import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

async function checkCheckConstraints() {
  try {
    const res = await pool.query(`
      SELECT pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE conrelid = 'ph_schools'::regclass AND contype = 'c'
    `);
    console.log("Check constraints on ph_schools:", res.rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkCheckConstraints();
