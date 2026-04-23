const pg = require('pg');
const { Pool } = pg;

const dbUrl = 'postgres://Administrator1:<REDACTED_PGB_PASS>@20.24.58.49:6432/insightEd';
const pool = new Pool({
  connectionString: dbUrl,
  ssl: false
});

async function checkCreate() {
  try {
    const res = await pool.query("SELECT COUNT(*) FROM engineer_create WHERE division = 'SARANGANI'");
    console.log("Total Sarangani Projects in engineer_create:", res.rows[0].count);
    
    const res2 = await pool.query("SELECT COUNT(*) FROM engineer_form WHERE division = 'SARANGANI'");
    console.log("Total Sarangani Projects in engineer_form:", res2.rows[0].count);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkCreate();
