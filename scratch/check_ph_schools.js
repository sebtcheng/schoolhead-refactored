import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function run() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ph_schools'
    `);
    console.log('Columns in ph_schools:', res.rows.map(r => `${r.column_name} (${r.data_type})`));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
