import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ 
  connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd', 
  ssl: { rejectUnauthorized: false } 
});

async function simulate() {
  const engineer_id = '61f112ad-1056-4880-81b9-a6e2f38bdc55'; // testnueve UID
  try {
    // 1. Get User Profile
    const userResult = await pool.query('SELECT role, region, division FROM users WHERE uid = $1', [engineer_id]);
    const userProfile = userResult.rows[0];
    console.log("PROFILE FOUND:", userProfile);

    // 2. Build Query
    let queryParams = [];
    let whereClauses = [];
    let sql = `
      WITH RankedProjects AS (
          SELECT *,
                 LAG(accomplishment_percentage) OVER (PARTITION BY ipc ORDER BY project_id ASC) as prev_perc
          FROM engineer_form
      ),
      LatestProjects AS (
          SELECT DISTINCT ON (ipc) *
          FROM RankedProjects
          ORDER BY ipc, project_id DESC
      )
      SELECT ipc, region, division FROM LatestProjects
    `;

    if (userProfile && (userProfile.role === 'Division Engineer' || userProfile.role === 'SDO' || userProfile.role === 'RO')) {
      if (userProfile.region) {
        queryParams.push(`%${userProfile.region.trim()}%`);
        whereClauses.push(`region ILIKE $${queryParams.length}`);
      }
      if (userProfile.division) {
        queryParams.push(`%${userProfile.division.trim()}%`);
        whereClauses.push(`division ILIKE $${queryParams.length}`);
      }
    } else {
      queryParams.push(engineer_id);
      whereClauses.push(`engineer_id = $${queryParams.length}`);
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ` + whereClauses.join(' AND ');
    }

    console.log("EXECUTING SQL:", sql);
    console.log("PARAMS:", queryParams);

    const result = await pool.query(sql, queryParams);
    console.log("RESULTS COUNT:", result.rows.length);
    console.log("RESULTS:", JSON.stringify(result.rows, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
simulate();
