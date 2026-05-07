
import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkView() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ph_schools_validate'
      ORDER BY ordinal_position;
    `);
    console.log("Columns in ph_schools_validate:");
    console.table(res.rows);

    const countRes = await pool.query('SELECT COUNT(*) FROM ph_schools_validate');
    console.log("Total rows in ph_schools_validate:", countRes.rows[0].count);

    const sampleRes = await pool.query('SELECT * FROM ph_schools_validate LIMIT 1');
    console.log("Sample row:", JSON.stringify(sampleRes.rows[0], null, 2));

  } catch (err) {
    console.error("Error checking view:", err.message);
  } finally {
    await pool.end();
  }
}

checkView();
