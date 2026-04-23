import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ 
  connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd', 
  ssl: { rejectUnauthorized: false } 
});

async function check() {
  try {
    const res = await pool.query("SELECT project_id, ipc, region, division FROM engineer_form WHERE region IS NULL OR division IS NULL");
    console.log("PROJECTS WITH NULL REGION/DIVISION:");
    console.log(JSON.stringify(res.rows, null, 2));

    const res2 = await pool.query("SELECT ipc, count(*) FROM engineer_form GROUP BY ipc HAVING count(*) > 1 LIMIT 5");
    console.log("\nPROJECTS WITH MULTIPLE ROWS (UPDATED):");
    console.log(JSON.stringify(res2.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
check();
