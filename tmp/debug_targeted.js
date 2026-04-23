import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ 
  connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd', 
  ssl: { rejectUnauthorized: false } 
});

async function check() {
  try {
    const res = await pool.query("SELECT project_id, ipc, region, division, project_name FROM engineer_form WHERE region IS NOT NULL AND (region ILIKE '%Region II%' OR division ILIKE '%Vizcaya%')");
    console.log("REGION II PROJECTS IN DB:");
    console.log(JSON.stringify(res.rows, null, 2));

    const res2 = await pool.query(`
      WITH Latest AS (SELECT DISTINCT ON (ipc) * FROM engineer_form ORDER BY ipc, project_id DESC)
      SELECT ipc, region, division, project_name FROM Latest WHERE (region IS NULL OR division IS NULL)
    `);
    console.log("\nLATEST PROJECT VERSIONS WITH NULL REGION/DIVISION:");
    console.log(JSON.stringify(res2.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
check();
