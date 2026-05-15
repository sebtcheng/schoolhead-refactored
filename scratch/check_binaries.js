
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const dbUrl = process.env.DATABASE_URL || 'postgres://Administrator1:pRZTbQ2T1JD7@127.0.0.1:6432/insightEd';

const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: false
});

async function check() {
  try {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'unified_binaries'
    `);
    console.log("Tables found:", res.rows);
    
    if (res.rows.length > 0) {
        const cols = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'unified_binaries'
        `);
        console.log("Columns in unified_binaries:", cols.rows);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
