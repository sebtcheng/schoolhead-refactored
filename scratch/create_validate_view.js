
import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function createValidateView() {
  const sql = `
    CREATE OR REPLACE VIEW ph_schools_validate AS
    WITH room_checks AS (
        SELECT 
            school_id,
            BOOL_AND(status IS NOT NULL AND status <> '' AND dimension IS NOT NULL AND dimension <> '') as all_rooms_valid
        FROM ph_buildings_inventory
        GROUP BY school_id
    ),
    space_checks AS (
        SELECT 
            school_id,
            COUNT(*) as space_count
        FROM ph_school_buildable_spaces
        GROUP BY school_id
    )
    SELECT 
        audit.*,
        -- Pass-through for simple units
        audit.unit1_completed AS unit1_validated,
        audit.unit2_completed AS unit2_validated,
        audit.unit3_completed AS unit3_validated,
        audit.unit4_completed AS unit4_validated,
        audit.unit5_completed AS unit5_validated,
        audit.unit6_completed AS unit6_validated,
        audit.unit8_completed AS unit8_validated,
        audit.unit10_completed AS unit10_validated,
        
        -- Strict logic for Unit 7
        (
            audit.unit7_completed IS TRUE
            AND COALESCE(rc.all_rooms_valid, TRUE)
            AND (COALESCE(sc.space_count, 0) > 0 OR ps.u7_confirm_no_space IS TRUE)
        ) as unit7_validated,
        
        -- Strict logic for Unit 9
        (
            audit.unit9_completed IS TRUE
            AND ps.u9_general IS NOT NULL AND ps.u9_general <> ''
            AND ps.u9_wiring IS NOT NULL AND ps.u9_wiring <> ''
            AND ps.u9_cords_cctv IS NOT NULL AND ps.u9_cords_cctv <> ''
            AND ps.u9_final IS NOT NULL AND ps.u9_final <> ''
        ) as unit9_validated,

        -- Needs Validation Flags
        (audit.unit7_completed IS TRUE AND NOT (
            COALESCE(rc.all_rooms_valid, TRUE)
            AND (COALESCE(sc.space_count, 0) > 0 OR ps.u7_confirm_no_space IS TRUE)
        )) as needs_unit7_validation,

        (audit.unit9_completed IS TRUE AND NOT (
            ps.u9_general IS NOT NULL AND ps.u9_general <> ''
            AND ps.u9_wiring IS NOT NULL AND ps.u9_wiring <> ''
            AND ps.u9_cords_cctv IS NOT NULL AND ps.u9_cords_cctv <> ''
            AND ps.u9_final IS NOT NULL AND ps.u9_final <> ''
        )) as needs_unit9_validation,

        -- Overall needs validation (if any unit is completed but not validated)
        (
            (audit.unit7_completed IS TRUE AND NOT (
                COALESCE(rc.all_rooms_valid, TRUE)
                AND (COALESCE(sc.space_count, 0) > 0 OR ps.u7_confirm_no_space IS TRUE)
            ))
            OR
            (audit.unit9_completed IS TRUE AND NOT (
                ps.u9_general IS NOT NULL AND ps.u9_general <> ''
                AND ps.u9_wiring IS NOT NULL AND ps.u9_wiring <> ''
                AND ps.u9_cords_cctv IS NOT NULL AND ps.u9_cords_cctv <> ''
                AND ps.u9_final IS NOT NULL AND ps.u9_final <> ''
            ))
        ) as needs_validation,

        -- Total validated count (out of 9)
        (
            (CASE WHEN audit.unit1_completed IS TRUE THEN 1 ELSE 0 END) +
            (CASE WHEN audit.unit2_completed IS TRUE THEN 1 ELSE 0 END) +
            (CASE WHEN audit.unit3_completed IS TRUE THEN 1 ELSE 0 END) +
            (CASE WHEN audit.unit4_completed IS TRUE THEN 1 ELSE 0 END) +
            (CASE WHEN audit.unit5_completed IS TRUE THEN 1 ELSE 0 END) +
            (CASE WHEN audit.unit6_completed IS TRUE THEN 1 ELSE 0 END) +
            (CASE WHEN (audit.unit7_completed IS TRUE AND COALESCE(rc.all_rooms_valid, TRUE) AND (COALESCE(sc.space_count, 0) > 0 OR ps.u7_confirm_no_space IS TRUE)) THEN 1 ELSE 0 END) +
            (CASE WHEN audit.unit8_completed IS TRUE THEN 1 ELSE 0 END) +
            (CASE WHEN (audit.unit9_completed IS TRUE AND ps.u9_general IS NOT NULL AND ps.u9_general <> '' AND ps.u9_wiring IS NOT NULL AND ps.u9_wiring <> '' AND ps.u9_cords_cctv IS NOT NULL AND ps.u9_cords_cctv <> '' AND ps.u9_final IS NOT NULL AND ps.u9_final <> '') THEN 1 ELSE 0 END)
        ) as validated_units_count,

        -- Validation Percentage
        ROUND(((
            (CASE WHEN audit.unit1_completed IS TRUE THEN 1 ELSE 0 END) +
            (CASE WHEN audit.unit2_completed IS TRUE THEN 1 ELSE 0 END) +
            (CASE WHEN audit.unit3_completed IS TRUE THEN 1 ELSE 0 END) +
            (CASE WHEN audit.unit4_completed IS TRUE THEN 1 ELSE 0 END) +
            (CASE WHEN audit.unit5_completed IS TRUE THEN 1 ELSE 0 END) +
            (CASE WHEN audit.unit6_completed IS TRUE THEN 1 ELSE 0 END) +
            (CASE WHEN (audit.unit7_completed IS TRUE AND COALESCE(rc.all_rooms_valid, TRUE) AND (COALESCE(sc.space_count, 0) > 0 OR ps.u7_confirm_no_space IS TRUE)) THEN 1 ELSE 0 END) +
            (CASE WHEN audit.unit8_completed IS TRUE THEN 1 ELSE 0 END) +
            (CASE WHEN (audit.unit9_completed IS TRUE AND ps.u9_general IS NOT NULL AND ps.u9_general <> '' AND ps.u9_wiring IS NOT NULL AND ps.u9_wiring <> '' AND ps.u9_cords_cctv IS NOT NULL AND ps.u9_cords_cctv <> '' AND ps.u9_final IS NOT NULL AND ps.u9_final <> '') THEN 1 ELSE 0 END)
        )::NUMERIC / 9.0) * 100, 2) as validation_percentage

    FROM ph_schools_audit audit
    JOIN ph_schools ps ON audit.school_id = ps.school_id
    LEFT JOIN room_checks rc ON audit.school_id = rc.school_id
    LEFT JOIN space_checks sc ON audit.school_id = sc.school_id;
  `;

  try {
    await pool.query(sql);
    console.log("✅ View ph_schools_validate created successfully.");
  } catch (err) {
    console.error("❌ Error creating view:", err.message);
  } finally {
    await pool.end();
  }
}

createValidateView();
