import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

async function audit() {
  try {
    const res = await pool.query('SELECT count(*) as count FROM ph_schools WHERE province IS NULL AND municipality IS NULL AND barangay IS NULL AND district IS NULL');
    console.log(`Found ${res.rows[0].count} records where location fields are all NULL.`);
    
    if (res.rows[0].count > 0) {
        const samples = await pool.query('SELECT school_id, school_name FROM ph_schools WHERE province IS NULL AND municipality IS NULL AND barangay IS NULL AND district IS NULL LIMIT 5');
        console.log("Samples:", samples.rows);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

audit();
