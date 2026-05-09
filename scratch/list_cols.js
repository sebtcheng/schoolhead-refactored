import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function checkCols() {
  try {
    const tables = ['schools_IERN', 'ph_schools'];
    for (const table of tables) {
      console.log(`\n--- Columns in ${table} ---`);
      const res = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table.includes('"') ? table.replace(/"/g, '') : table]);
      res.rows.forEach(row => {
        console.log(`${row.column_name}: ${row.data_type}`);
      });
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkCols();
