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

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("Adding uploaded_at and approved_at columns...");
    
    const queries = [
      "ALTER TABLE ph_schools ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ",
      "ALTER TABLE ph_schools ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ",
      "ALTER TABLE esf7_database ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ",
      "ALTER TABLE esf7_database ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ",
      "ALTER TABLE esf7_staging ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ",
      "ALTER TABLE esf7_staging ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ"
    ];

    for (const q of queries) {
      console.log(`Executing: ${q}`);
      await client.query(q);
    }

    console.log("Migration complete.");

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
