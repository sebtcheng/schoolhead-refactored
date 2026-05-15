import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function fix() {
  try {
    const res = await pool.query(`
      UPDATE "schools_IERN"
      SET "School_Name" = '999009 Test School'
      WHERE "SchoolID" = '999009';
    `);
    console.log("Updated rows:", res.rowCount);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

fix();
