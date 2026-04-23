import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ 
    connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
    ssl: { rejectUnauthorized: false }
});
async function checkHydra() {
  try {
    const res = await pool.query("SELECT doc_id, project_id, hydra_manifest FROM engineer_documents WHERE hydra_manifest IS NOT NULL AND hydra_manifest != '{}'::jsonb");
    console.log(`Found ${res.rows.length} records with Project Hydra manifests.`);
    if (res.rows.length > 0) {
        console.log('Sample Manifest:', JSON.stringify(res.rows[0].hydra_manifest, null, 2));
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
checkHydra();
