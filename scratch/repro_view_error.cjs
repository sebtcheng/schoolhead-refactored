const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  try {
    console.log("Attempting to recreate views to catch 'column does not exist' error...");
    
    // ── Step 1: Get ph_schools columns ─────────────────
    const colsRes = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'ph_schools' AND table_schema = 'public' ORDER BY ordinal_position"
    );
    const phCols = colsRes.rows.map(r => r.column_name);
    console.log(`Found ${phCols.length} columns in ph_schools.`);

    const excluded = new Set([
      'school_id', 'iern', 'region', 'division', 'district', 'municipality',
      'province', 'barangay', 'leg_district', 'school_name', 'latitude',
      'longitude', 'school_head', 'contact_number', 'curricular_offering',
      'ownership', 'unit_completion', 'completion_percentage', 'forms_completed_count',
      'esf7_status', 'status', 'is_esf7_opened', 'updated_at', 'is_registered',
      'unit1_completed', 'unit2_completed', 'unit3_completed', 'unit4_completed',
      'unit5_completed', 'unit6_completed', 'unit7_completed', 'unit8_completed',
      'unit9_completed', 'unit10_completed',
    ]);

    const extraCols = phCols
      .filter(c => !excluded.has(c))
      .map(c => `ps."${c}"`)
      .join(',\n                ');

    console.log("Recreating ph_schools_audit...");
    const auditViewSql = `
      CREATE OR REPLACE VIEW ph_schools_audit_test AS
      SELECT
          si."SchoolID"::text                                         AS school_id,
          COALESCE(ps.school_name, si."School_Name")::text           AS school_name,
          COALESCE(ps.region,      si."Region")::text                AS region,
          COALESCE(ps.division,    si."Division")::text              AS division,
          COALESCE(ps.district,    si."District")::text              AS district,
          COALESCE(ps.municipality,si."Municipality")::text          AS municipality,
          COALESCE(ps.province,    si."Province")::text              AS province,
          COALESCE(ps.barangay,    si."Barangay")::text              AS barangay,
          COALESCE(ps.leg_district,si."Legislative_District")::text  AS leg_district,
          COALESCE(ps.latitude,    si."Latitude"::text)::text        AS latitude,
          COALESCE(ps.longitude,   si."Longitude"::text)::text       AS longitude,
          ps.school_head::text,
          ps.contact_number::text,
          ps.curricular_offering::text,
          ps.ownership::text,
          ps.unit_completion,
          ps.completion_percentage,
          ps.forms_completed_count,
          ps.unit1_completed,
          ps.unit2_completed,
          ps.unit3_completed,
          ps.unit4_completed,
          ps.unit5_completed,
          ps.unit6_completed,
          ps.unit7_completed,
          ps.unit8_completed,
          ps.unit9_completed,
          ps.unit10_completed,
          COALESCE(si."status", 'Active')::text                      AS status,
          ps.is_esf7_opened,
          COALESCE(el.status, 'NOT_STARTED')::text                   AS esf7_status,
          (
            ps.school_id IS NOT NULL
            OR EXISTS (SELECT 1 FROM users u WHERE u.iern = si."IERN")
          )                                                           AS is_registered,
          ps.updated_at,
          ${extraCols ? extraCols + ',' : ''}
          si."IERN"                                                   AS iern
      FROM "schools_IERN" si
      LEFT JOIN ph_schools ps ON si."IERN" = ps.iern
      LEFT JOIN esf7_link  el ON si."SchoolID" = el.school_id
      WHERE si."status" = 'Active';
    `;
    await client.query(auditViewSql);
    console.log("ph_schools_audit_test created successfully.");

    console.log("Recreating ph_schools_validate...");
    const validateViewSql = `
      CREATE OR REPLACE VIEW ph_schools_validate_test AS
      WITH room_checks AS (
          SELECT
              school_id,
              BOOL_AND(
                status IS NOT NULL AND status <> ''
                AND dimension IS NOT NULL AND dimension <> ''
              ) AS all_rooms_valid
          FROM ph_buildings_inventory
          GROUP BY school_id
      ),
      space_checks AS (
          SELECT school_id, COUNT(*) AS space_count
          FROM ph_school_buildable_spaces
          GROUP BY school_id
      ),
      validation_flags AS (
          SELECT
              audit.school_id,
              audit.unit1_validated,  -- Wait! audit.unit1_validated? 
                                      -- In ph_schools_audit, it's unit1_completed!
              audit.unit2_validated,
              audit.unit3_validated,
              audit.unit4_validated,
              audit.unit5_validated,
              audit.unit6_validated,
              audit.unit8_validated,
              audit.unit10_validated,
              (
                  audit.unit7_completed IS TRUE
                  AND COALESCE(rc.all_rooms_valid, TRUE)
                  AND (COALESCE(sc.space_count, 0) > 0 OR ps.u7_confirm_no_space IS TRUE)
              ) AS unit7_validated,
              (
                  audit.unit9_completed IS TRUE
                  AND ps.u9_general    IS NOT NULL AND ps.u9_general    <> ''
                  AND ps.u9_wiring     IS NOT NULL AND ps.u9_wiring     <> ''
                  AND ps.u9_cords_cctv IS NOT NULL AND ps.u9_cords_cctv <> ''
                  AND ps.u9_final      IS NOT NULL AND ps.u9_final      <> ''
              ) AS unit9_validated
          FROM ph_schools_audit_test audit
          JOIN  ph_schools ps ON audit.school_id = ps.school_id
          LEFT JOIN room_checks  rc ON audit.school_id = rc.school_id
          LEFT JOIN space_checks sc ON audit.school_id = sc.school_id
      )
      SELECT * FROM validation_flags;
    `;
    // Wait, I noticed a bug in update_audit_view.cjs while writing this!
    // In ph_schools_validate (line 129), it uses audit.unit1_validated.
    // But ph_schools_audit (line 78) defines unit1_completed.
    // So ph_schools_validate should use audit.unit1_completed.

    await client.query(validateViewSql);
    console.log("ph_schools_validate_test created successfully.");

  } catch (err) {
    console.error("FAILURE:", err.message);
    if (err.hint) console.error("HINT:", err.hint);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
