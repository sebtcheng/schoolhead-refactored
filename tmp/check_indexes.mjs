
import pkg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const dbUrl = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const res = await pool.query(`
      SELECT
          ix.relname AS index_name,
          a.attname AS column_name
      FROM
          pg_class t,
          pg_class ix,
          pg_index i,
          pg_attribute a
      WHERE
          t.oid = i.indrelid
          AND ix.oid = i.indexrelid
          AND a.attrelid = t.oid
          AND a.attnum = ANY(i.indkey)
          AND t.relkind = 'r'
          AND t.relname = 'all_locations'
      ORDER BY
          ix.relname,
          a.attnum;
    `);
    console.log(JSON.stringify(res.rows, null, 2));
    
    // Also check for unique constraints explicitly
    const res2 = await pool.query(`
      SELECT conname, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      WHERE t.relname = 'all_locations' AND c.contype = 'u';
    `);
    console.log("\nUNIQUE CONSTRAINTS:");
    console.log(JSON.stringify(res2.rows, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
