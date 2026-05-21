import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const dbUrl = "postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd";
const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function audit() {
  const client = await pool.connect();
  try {
    console.log("--- TRIGGER AUDIT ---");
    const trg = await client.query(`
      SELECT tgname, relname 
      FROM pg_trigger 
      JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid 
      WHERE NOT tgisinternal;
    `);
    console.table(trg.rows);

    console.log("\n--- EVENT TRIGGER AUDIT (Schema Drift Protection) ---");
    const evTrg = await client.query(`SELECT * FROM pg_event_trigger;`);
    console.table(evTrg.rows);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

audit();
