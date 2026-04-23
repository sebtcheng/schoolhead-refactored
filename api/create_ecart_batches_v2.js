import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ph_ecart_batches (
          id SERIAL PRIMARY KEY,
          school_id CHARACTER VARYING REFERENCES ph_schools(school_id) ON DELETE CASCADE,
          iern CHARACTER VARYING REFERENCES ph_schools(iern),
          batches_name VARCHAR(255),
          year_received INTEGER,
          sources_fund VARCHAR(255),
          ecart_laptops INTEGER DEFAULT 0,
          ecart_tablets INTEGER DEFAULT 0,
          ecart_tv INTEGER DEFAULT 0,
          charging_condition VARCHAR(100),
          remarks TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Successfully created ph_ecart_batches table.");
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

run();
