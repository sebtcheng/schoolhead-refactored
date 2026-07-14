import { pool } from './utils/db.js';

async function runMigration() {
  console.log("Adding priority_improvement_area column to siif_submissions table...");
  try {
    await pool.query(`ALTER TABLE siif_submissions ADD COLUMN IF NOT EXISTS priority_improvement_area JSONB DEFAULT '[]'::jsonb;`);
    console.log("Migration successful.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    process.exit(0);
  }
}

runMigration();
