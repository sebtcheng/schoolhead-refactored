const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  try {
    await pool.query("ALTER TABLE ph_schools ADD COLUMN IF NOT EXISTS unit9 SMALLINT DEFAULT 0");
    console.log('Successfully added unit9 column to ph_schools!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}
migrate();
