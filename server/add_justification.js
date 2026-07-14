import { pool } from './utils/db.js';

async function runMigration() {
  console.log("Adding justification column to siif_utilization table...");
  try {
    await pool.query(`ALTER TABLE siif_utilization ADD COLUMN IF NOT EXISTS justification TEXT;`);
    console.log("Migration successful.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    process.exit(0);
  }
}

runMigration();
