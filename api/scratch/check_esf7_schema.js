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
    console.log("Checking ESF7 tables...");
    
    const dbCols = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'esf7_database'
    `);
    
    const stgCols = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'esf7_staging'
    `);

    const dbSet = new Set(dbCols.rows.map(r => r.column_name));
    const stgSet = new Set(stgCols.rows.map(r => r.column_name));

    console.log(`esf7_database column count: ${dbSet.size}`);
    console.log(`esf7_staging column count: ${stgSet.size}`);

    const missingInStg = [...dbSet].filter(c => !stgSet.has(c));
    const missingInDb = [...stgSet].filter(c => !dbSet.has(c));

    if (missingInStg.length > 0) {
      console.error("Columns in DATABASE but missing in STAGING:", missingInStg);
    } else {
      console.log("Staging has all database columns.");
    }

    if (missingInDb.length > 0) {
      console.error("Columns in STAGING but missing in DATABASE:", missingInDb);
    } else {
      console.log("Database has all staging columns.");
    }

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

check();
