const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ 
  connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
  ssl: { rejectUnauthorized: false }
});

async function checkNullable() {
  try {
    const res = await pool.query("SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'engineer_form' ORDER BY ordinal_position");
    const output = res.rows.map(r => `${r.column_name}: ${r.is_nullable}`).join('\n');
    fs.writeFileSync('ef_nullable.txt', output);
    console.log('Nullable info written to ef_nullable.txt');
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkNullable();
