
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const res = await pool.query('SELECT * FROM "schools_IERN" LIMIT 1');
    if (res.rows.length > 0) {
      console.log('Columns:', Object.keys(res.rows[0]));
      console.log('Sample Data:', res.rows[0]);
    } else {
      console.log('Table is empty');
    }
  } catch (err) {
    console.error('Error querying database:', err.message);
  } finally {
    await pool.end();
  }
}
check();
