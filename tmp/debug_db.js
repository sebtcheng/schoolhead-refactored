import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ 
  connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd', 
  ssl: { rejectUnauthorized: false } 
});

async function check() {
  try {
    const res = await pool.query("SELECT DISTINCT region, division FROM engineer_form WHERE region ILIKE '%Region II%' OR division ILIKE '%Vizcaya%'");
    console.log("ENGINEER_FORM DATA:");
    console.log(JSON.stringify(res.rows, null, 2));

    const res2 = await pool.query("SELECT email, role, region, division FROM users WHERE region ILIKE '%Region II%' OR division ILIKE '%Vizcaya%'");
    console.log("\nUSERS DATA:");
    console.log(JSON.stringify(res2.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
check();
