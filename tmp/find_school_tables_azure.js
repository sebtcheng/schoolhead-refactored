import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ 
  connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.azure.com:5432/insightEd',
  ssl: { rejectUnauthorized: false }
});
try {
  const res = await pool.query("SELECT table_name FROM information_schema.columns WHERE column_name = 'school_id' AND table_schema = 'public'");
  console.log("Tables with school_id in Azure DB:", JSON.stringify(res.rows.map(r => r.table_name)));
  
  const phCols = await pool.query("SELECT * FROM ph_schools LIMIT 1");
  console.log("ph_schools Columns:", JSON.stringify(Object.keys(phCols.rows[0])));
} catch (err) {
  console.error(err);
} finally {
  await pool.end();
}
