import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ 
    connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
    ssl: { rejectUnauthorized: false }
});
async function checkSchema() {
  try {
    const tables = ['engineer_documents', 'unified_binaries'];
    for (const table of tables) {
        const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = $1", [table]);
        console.log(`Columns in ${table}:`, res.rows.map(r => r.column_name));
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
checkSchema();
