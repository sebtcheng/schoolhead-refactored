import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

async function check() {
  try {
    const res = await pool.query(`
        SELECT count(*) as count 
        FROM ph_schools 
        WHERE province IS NULL AND municipality IS NULL AND barangay IS NULL AND district IS NULL 
        AND school_id IN (SELECT school_id FROM users WHERE school_id IS NOT NULL)
    `);
    console.log(`Records in use by users: ${res.rows[0].count}`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
