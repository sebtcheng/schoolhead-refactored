import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const dbUrl = process.env.DATABASE_URL;
const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const client = await pool.connect();
  try {
    console.log("Checking for orphaned PENDING_SDO schools...");
    
    const res = await client.query(`
      SELECT school_id, school_name FROM ph_schools 
      WHERE unit7 = 0.5 
      AND school_id NOT IN (SELECT DISTINCT school_id FROM esf7_staging)
    `);
    
    if (res.rows.length > 0) {
      console.error("Found schools with status PENDING_SDO but NO staging records:", res.rows);
    } else {
      console.log("No orphaned PENDING_SDO schools found.");
    }

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

check();
