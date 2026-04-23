const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd', ssl: { rejectUnauthorized: false } });

async function fixSequence() {
  try {
    console.log("Fixing project_id default...");
    await pool.query(`ALTER TABLE engineer_form ALTER COLUMN project_id SET DEFAULT nextval('engineer_form_project_id_seq')`);
    console.log("✅ project_id default restored.");

    console.log("Syncing sequence with max ID...");
    const maxRes = await pool.query('SELECT MAX(project_id) FROM engineer_form');
    const maxId = maxRes.rows[0].max || 0;
    await pool.query(`SELECT setval('engineer_form_project_id_seq', ${maxId})`);
    console.log(`✅ Sequence synced to ${maxId}.`);

  } catch (err) {
    console.error("Fix Failed:", err.message);
  } finally {
    await pool.end();
  }
}

fixSequence();
