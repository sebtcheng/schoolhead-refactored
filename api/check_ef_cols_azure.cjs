const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ 
  connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
  ssl: { rejectUnauthorized: false }
});

async function checkCols() {
  try {
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'engineer_form' ORDER BY ordinal_position");
    const cols = res.rows.map(r => r.column_name).join('\n');
    fs.writeFileSync('ef_cols.txt', cols + '\nTotal columns: ' + res.rows.length);
    console.log('Columns written to ef_cols.txt');
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkCols();
