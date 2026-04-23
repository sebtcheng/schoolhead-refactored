import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ 
  connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd', 
  ssl: { rejectUnauthorized: false } 
});

async function simulate() {
  const engineer_id = '61f112ad-1056-4880-81b9-a6e2f38bdc55'; // testnueve UID
  try {
    const userResult = await pool.query('SELECT role, region, division FROM users WHERE uid = $1', [engineer_id]);
    const userProfile = userResult.rows[0];
    console.log("PROFILE FOUND:", userProfile);

    let queryParams = [];
    let whereClauses = [];
    let sql = `
      WITH Latest AS (SELECT DISTINCT ON (ipc) * FROM engineer_form ORDER BY ipc, project_id DESC)
      SELECT ipc, region, division FROM Latest
    `;

    if (userProfile && (userProfile.role === 'Division Engineer' || userProfile.role === 'SDO' || userProfile.role === 'RO')) {
      if (userProfile.region) {
        queryParams.push(userProfile.region.trim());
        whereClauses.push(`region ILIKE $${queryParams.length}`);
      }
      if (userProfile.division) {
        queryParams.push(userProfile.division.trim());
        whereClauses.push(`division ILIKE $${queryParams.length}`);
      }
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ` + whereClauses.join(' AND ');
    }

    const result = await pool.query(sql, queryParams);
    console.log("RESULTS COUNT:", result.rows.length);
    if (result.rows.length > 0) {
      console.log("SAMPLE:", result.rows[0]);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
simulate();
