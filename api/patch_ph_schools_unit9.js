import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await pool.query(`
      ALTER TABLE ph_schools 
      ADD COLUMN IF NOT EXISTS unit9_furniture TEXT,
      ADD COLUMN IF NOT EXISTS unit9_ict TEXT,
      ADD COLUMN IF NOT EXISTS unit9_has_ecart BOOLEAN,
      ADD COLUMN IF NOT EXISTS unit9_ecarts TEXT,
      ADD COLUMN IF NOT EXISTS unit9_wash TEXT,
      ADD COLUMN IF NOT EXISTS unit9_utilities TEXT;
    `);
    console.log("Successfully added the 6 unit9_... columns to ph_schools!");
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

run();
