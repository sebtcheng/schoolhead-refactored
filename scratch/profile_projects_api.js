
const pg = require('pg');
const { performance } = require('perf_hooks');

const dbUrl = process.env.DATABASE_URL || 'postgres://Administrator1:<REDACTED_PGB_PASS>@20.24.58.49:6432/insightEd';
const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function profileAPI(engineerId) {
  const start = performance.now();
  
  // This mimics the query in /api/projects
  let sql = `
      WITH BaseRanked AS (
          SELECT
            e.project_id, e.school_name, e.project_name, e.school_id, e.division, e.region, e.status_of_construction_phase AS status, e.ipc, e.engineer_name, e.engineer_id,
            e.accomplishment_percentage, e.is_duplicate,
            LAG(e.accomplishment_percentage) OVER (
                PARTITION BY COALESCE(e.ipc, e.school_id || '-' || e.project_name)
                ORDER BY e.project_id ASC
            ) as previous_percentage,
            e.approved_budget_for_contract, e.contract_amount, e.batch_of_funds, e.contractor_name, e.other_remarks,
            e.status_as_of, e.target_completion_date, e.actual_completion_date, e.notice_to_proceed, e.latitude, e.longitude,
            e.construction_start_date, e.project_category, e.scope_of_work,
            e.province, e.city, e.municipality,
            e.number_of_classrooms, e.number_of_storeys, e.number_of_sites, e.funds_utilized,
            e.is_donated, e.program_type, e.status_design_phase, e.procurement_status, e.actions, e.savings, e.funding_year, e.funding_year_justification, e.approval_status,
            e.sangguniang_resolution_id, e.mother_moa_id, e.supplamental_moa_id,
            e.implementing_agency,
            e.implementing_agency_specific,
            ROW_NUMBER() OVER (
                PARTITION BY COALESCE(e.ipc, e.school_id || '-' || e.project_name)
                ORDER BY e.accomplishment_percentage DESC, e.project_id DESC
            ) as rn
          FROM engineer_form e
      ),
      LatestProjects AS (
          SELECT * FROM BaseRanked WHERE rn = 1
      )
      SELECT
        p.*,
        sp.district,
        COALESCE(f.tranche_1, 0) as tranche_1,
        COALESCE(img_agg.img_count, 0) AS images_count,
        COUNT(*) OVER() AS total_count
      FROM LatestProjects p
      LEFT JOIN co_finance f ON p.project_id = f.project_id
      LEFT JOIN ph_schools sp ON p.school_id = sp.school_id
      LEFT JOIN (
          SELECT ipc, COUNT(*) AS img_count
          FROM engineer_image
          WHERE ipc IS NOT NULL
          GROUP BY ipc
      ) img_agg ON img_agg.ipc = p.ipc
      WHERE p.engineer_id = $1
      ORDER BY p.project_id DESC
  `;

  try {
    const res = await pool.query(sql, [engineerId]);
    const end = performance.now();
    console.log(`✅ Query successful!`);
    console.log(`⏱️ Time taken: ${(end - start).toFixed(2)}ms`);
    console.log(`📊 Rows returned: ${res.rows.length}`);
    if (res.rows.length > 0) {
        console.log(`🔢 Total count (pagination): ${res.rows[0].total_count}`);
        console.log(`🖼️ Sample imagesCount: ${res.rows[0].images_count}`);
    }
  } catch (err) {
    console.error(`❌ Query failed:`, err.message);
  } finally {
    await pool.end();
  }
}

const engineerId = process.argv[2] || '01a6595d-9e55-45da-babf-0faa0527914e';
profileAPI(engineerId);
