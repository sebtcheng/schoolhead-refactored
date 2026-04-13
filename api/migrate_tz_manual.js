import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const tablesToMigrate = [
  { table: 'engineer_image', cols: ['created_at'] },
  { table: 'engineer_documents', cols: ['created_at'] },
  { table: 'activity_logs', cols: ['timestamp'] },
  { table: 'notifications', cols: ['created_at'] },
  { table: 'users', cols: ['created_at'] },
  { 
    table: 'engineer_form', 
    cols: [
      'status_as_of', 'target_completion_date', 'actual_completion_date', 
      'notice_to_proceed', 'construction_start_date', 'date_notice_of_award',
      'revised_target_completion_date'
    ] 
  }
];

async function run() {
  console.log("🚀 Starting manual Timezone Migration (TIMESTAMP -> TIMESTAMPTZ)...");
  try {
    for (const entry of tablesToMigrate) {
      for (const col of entry.cols) {
        process.stdout.write(`   - Migrating ${entry.table}.${col}... `);
        await pool.query(`ALTER TABLE ${entry.table} ALTER COLUMN "${col}" TYPE TIMESTAMPTZ USING "${col}"::TIMESTAMPTZ`);
        process.stdout.write("✅\n");
      }
    }
    console.log("\n🎉 Migration complete! Please refresh your database view.");
  } catch (err) {
    console.error("\n❌ Migration failed:", err.message);
    console.log("\n💡 Note: If you get a 'pg_hba.conf' error, it means your computer cannot connect to the Azure database directly. In that case, simply RESTART your Insighted server, and it will run the migration itself.");
  } finally {
    await pool.end();
  }
}

run();
