
import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false // Disable SSL
});

async function listViews() {
  try {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
      ORDER BY table_name;
    `);
    console.log("Views in database:");
    console.table(res.rows);
  } catch (err) {
    console.error("Error listing views:", err);
  } finally {
    await pool.end();
  }
}

listViews();
