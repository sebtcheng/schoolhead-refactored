import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: "postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd",
  ssl: { rejectUnauthorized: false }
});

async function checkColumns() {
  try {
    const res = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'ph_schools' 
      AND (column_name ~* 'esf7' OR column_name ~* 'nspp' OR column_name ~* 'unit')
      ORDER BY column_name
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error("Schema Error:", err.message);
  } finally {
    await pool.end();
  }
}

checkColumns();
