import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

async function fix() {
  try {
    await pool.query('DROP POLICY IF EXISTS no_delete ON ph_schools');
    await pool.query(`CREATE POLICY no_delete ON ph_schools FOR DELETE USING (current_setting('internal.authorized_app_deletion', true) = 'true')`);
    console.log("✅ Policy on ph_schools updated to support authorized bypass.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

fix();
