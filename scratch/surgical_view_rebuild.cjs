const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  try {
    console.log("Surgical View Rebuild...");
    
    console.log("Dropping ph_schools_validate (if exists)...");
    await client.query(`DROP VIEW IF EXISTS ph_schools_validate;`);
    
    console.log("Dropping ph_schools_audit (table or view)...");
    await client.query(`DROP VIEW IF EXISTS ph_schools_audit;`).catch(() => {});
    await client.query(`DROP TABLE IF EXISTS ph_schools_audit;`).catch(() => {});
    
    // Now create the audit view
    console.log("Creating ph_schools_audit VIEW...");
    // ... I'll copy the logic from update_audit_view.cjs ...
    const colsRes = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'ph_schools' AND table_schema = 'public' ORDER BY ordinal_position"
    );
    const phCols = colsRes.rows.map(r => r.column_name);
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

    const auditViewSql = `
      CREATE VIEW ph_schools_audit AS
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
    console.log("ph_schools_audit VIEW created.");

    // Now create the validate view
    console.log("Creating ph_schools_validate VIEW...");
    const validateViewSql = `
      CREATE VIEW ph_schools_validate AS
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
              audit.unit1_completed  AS unit1_validated,
              audit.unit2_completed  AS unit2_validated,
              audit.unit3_completed  AS unit3_validated,
              audit.unit4_completed  AS unit4_validated,
              audit.unit5_completed  AS unit5_validated,
              audit.unit6_completed  AS unit6_validated,
              audit.unit8_completed  AS unit8_validated,
              audit.unit10_completed AS unit10_validated,
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
              ) AS unit9_validated,
              (
                  NOT (audit.unit7_completed IS TRUE AND COALESCE(rc.all_rooms_valid, TRUE) AND (COALESCE(sc.space_count, 0) > 0 OR ps.u7_confirm_no_space IS TRUE))
                  AND audit.unit7_completed IS TRUE
              ) AS needs_unit7_validation,
              (
                  NOT (audit.unit9_completed IS TRUE AND ps.u9_general IS NOT NULL AND ps.u9_wiring IS NOT NULL AND ps.u9_cords_cctv IS NOT NULL AND ps.u9_final IS NOT NULL)
                  AND audit.unit9_completed IS TRUE
              ) AS needs_unit9_validation
          FROM ph_schools_audit audit
          JOIN  ph_schools ps ON audit.school_id = ps.school_id
          LEFT JOIN room_checks  rc ON audit.school_id = rc.school_id
          LEFT JOIN space_checks sc ON audit.school_id = sc.school_id
      )
      SELECT
          audit.school_id,
          audit.school_name,
          audit.region,
          audit.division,
          audit.status,
          vf.unit1_validated,  vf.unit2_validated,  vf.unit3_validated,
          vf.unit4_validated,  vf.unit5_validated,  vf.unit6_validated,
          vf.unit7_validated,  vf.unit8_validated,  vf.unit9_validated,
          vf.unit10_validated,
          vf.needs_unit7_validation,
          vf.needs_unit9_validation,
          (vf.needs_unit7_validation OR vf.needs_unit9_validation) AS needs_validation,
          (
              (CASE WHEN vf.unit1_validated  THEN 1 ELSE 0 END +
               CASE WHEN vf.unit2_validated  THEN 1 ELSE 0 END +
               CASE WHEN vf.unit3_validated  THEN 1 ELSE 0 END +
               CASE WHEN vf.unit4_validated  THEN 1 ELSE 0 END +
               CASE WHEN vf.unit5_validated  THEN 1 ELSE 0 END +
               CASE WHEN vf.unit6_validated  THEN 1 ELSE 0 END +
               CASE WHEN vf.unit7_validated  THEN 1 ELSE 0 END +
               CASE WHEN vf.unit8_validated  THEN 1 ELSE 0 END +
               CASE WHEN vf.unit9_validated  THEN 1 ELSE 0 END +
               CASE WHEN vf.unit10_validated THEN 1 ELSE 0 END)
          ) / 10.0 * 100                             AS validation_percentage
      FROM ph_schools_audit audit
      LEFT JOIN validation_flags vf ON audit.school_id = vf.school_id;
    `;
    await client.query(validateViewSql);
    console.log("ph_schools_validate VIEW created.");

  } catch (err) {
    console.error("FAILURE:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
