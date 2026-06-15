import { pool } from './api/utils/db.js';
import { runMigrations } from './api/db_init.js';

async function run() {
  const client = await pool.connect();
  try {
    console.log("Starting migrations...");
    await runMigrations(client, 'ScratchMigration');
    console.log("Migrations successfully executed!");
  } catch (err) {
    console.error("Migration execution failed:", err);
  } finally {
    client.release();
    await pool.end();
  }
}
run();
