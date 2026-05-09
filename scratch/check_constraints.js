import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

async function checkConstraints() {
  const query = `
    SELECT 
      conname as constraint_name, 
      pg_get_constraintdef(c.oid) as constraint_def,
      relname as table_name
    FROM pg_constraint c 
    JOIN pg_class r ON c.conrelid = r.oid
    JOIN pg_namespace n ON n.oid = c.connamespace 
    WHERE n.nspname = 'public' 
      AND r.relname IN ('ph_schools', 'schools_IERN')
  `;
  const res = await pool.query(query);
  console.log(JSON.stringify(res.rows, null, 2));
  process.exit(0);
}

checkConstraints().catch(e => { console.error(e); process.exit(1); });
