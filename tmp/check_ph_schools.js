
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const dbUrl = process.env.DATABASE_URL;
const isVmProxy = dbUrl && dbUrl.includes('20.24.58.49');

const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: isVmProxy ? false : { rejectUnauthorized: false }
});

async function checkPhSchools() {
  const client = await pool.connect();
  try {
    const schoolId = '999009';
    console.log(`--- PH_SCHOOLS DATA for ${schoolId} ---`);
    const res = await client.query("SELECT * FROM ph_schools WHERE school_id = $1", [schoolId]);
    console.table(res.rows);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

checkPhSchools();
