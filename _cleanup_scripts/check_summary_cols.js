import pg from 'pg';
const { Pool } = pg;
import fs from 'fs';

const pool = new Pool({
  connectionString: "postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd",
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'school_summary'");
    fs.writeFileSync('_cleanup_scripts/school_summary_cols.json', JSON.stringify(res.rows, null, 2));
    console.log('Saved to _cleanup_scripts/school_summary_cols.json');
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
