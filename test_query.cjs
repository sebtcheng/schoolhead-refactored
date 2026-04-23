const pg = require('pg');
const { Pool } = pg;

const dbUrl = 'postgres://Administrator1:<REDACTED_PGB_PASS>@20.24.58.49:6432/insightEd';
const pool = new Pool({
  connectionString: dbUrl,
  ssl: false
});

async function testQuery() {
  try {
    // Inputs for David Pacheco
    const jurisdictionRole = 'division engineer';
    const jurisdictionRegion = 'REGION XII';
    const jurisdictionDivision = 'SARANGANI';

    // Simulation of filtering logic from api/index.js
    let queryParams = [];
    let whereClauses = [];

    // Region filter
    const normRegion = jurisdictionRegion.trim().toLowerCase();
    queryParams.push(normRegion);
    whereClauses.push(`LOWER(TRIM(p.region)) = $${queryParams.length}`);

    // Division filter
    const normalizedDivisionParam = jurisdictionDivision.trim().replace(/^(SDO|Division of)[-\s]+/i, '').trim().toLowerCase();
    queryParams.push(normalizedDivisionParam);
    whereClauses.push(`LOWER(TRIM(regexp_replace(p.division, '^(SDO|Division of)[-\\s]+', '', 'i'))) = $${queryParams.length}`);

    console.log("Params:", queryParams);
    console.log("Where Clauses:", whereClauses.join(' AND '));

    // Full SQL simulation (Simplified for testing)
    const sql = `
      WITH RankedProjects AS (
          SELECT
            e.project_id, e.school_name, e.project_name, e.school_id, e.division, e.region,
            ROW_NUMBER() OVER (
                PARTITION BY COALESCE(e.ipc, e.school_id || '-' || e.project_name)
                ORDER BY accomplishment_percentage DESC, project_id DESC
            ) as rn
          FROM engineer_form e
      ),
      LatestProjects AS (
          SELECT * FROM RankedProjects WHERE rn = 1
      )
      SELECT COUNT(*) FROM LatestProjects p
      WHERE ` + whereClauses.join(' AND ');

    const res = await pool.query(sql, queryParams);
    console.log("Resulting Count:", res.rows[0].count);

    // Also check raw matches in engineer_form
    const resRaw = await pool.query(`SELECT COUNT(*) FROM engineer_form e WHERE LOWER(TRIM(e.region)) = $1 AND LOWER(TRIM(e.division)) = $2`, [normRegion, normalizedDivisionParam]);
    console.log("Raw Matches in engineer_form:", resRaw.rows[0].count);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

testQuery();
