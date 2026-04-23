const pg = require('pg');
const { Pool } = pg;

const dbUrl = 'postgres://Administrator1:<REDACTED_PGB_PASS>@20.24.58.49:6432/insightEd';
const pool = new Pool({
  connectionString: dbUrl,
  ssl: false
});

async function checkIds() {
  try {
    const res = await pool.query("SELECT DISTINCT engineer_id FROM engineer_form WHERE division = 'SARANGANI'");
    console.log("Distinct Engineer IDs in Sarangani:", JSON.stringify(res.rows, null, 2));
    
    const davidUid = 'c4316fa2-6141-4569-a1b4-8629060cafee';
    const res2 = await pool.query("SELECT COUNT(*) FROM engineer_form WHERE engineer_id = $1", [davidUid]);
    console.log(`Projects with David's UID (${davidUid}):`, res2.rows[0].count);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkIds();
