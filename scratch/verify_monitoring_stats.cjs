const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    console.log("Testing monitoring stats query logic...");
    
    // This is the logic from ROSDO/api/index.js around line 3321
    const statsQuery = `
        WITH validation_stats AS (
            SELECT 
                i."SchoolID",
                p.completion_percentage,
                -- Accurate Validation Rules (Inlined from ph_schools_validate)
                (
                    p.unit1_completed AND p.unit2_completed AND p.unit3_completed AND
                    p.unit4_completed AND p.unit5_completed AND p.unit6_completed AND
                    p.unit8_completed AND
                    (p.unit7_completed AND COALESCE(rc.all_rooms_valid, true) AND (COALESCE(sc.space_count, 0) > 0 OR p.u7_confirm_no_space IS TRUE)) AND
                    (p.unit9_completed AND p.u9_general IS NOT NULL AND p.u9_wiring IS NOT NULL AND p.u9_final IS NOT NULL)
                ) as is_validated,
                (p.unit7_completed AND NOT (COALESCE(rc.all_rooms_valid, true) AND (COALESCE(sc.space_count, 0) > 0 OR p.u7_confirm_no_space IS TRUE))) as needs_u7_val,
                (p.unit9_completed AND NOT (p.u9_general IS NOT NULL AND p.u9_wiring IS NOT NULL AND p.u9_final IS NOT NULL)) as needs_u9_val
            FROM "schools_IERN" i
            LEFT JOIN ph_schools p ON i."SchoolID" = p.school_id
            LEFT JOIN LATERAL (
                SELECT BOOL_AND(status IS NOT NULL AND status <> '') as all_rooms_valid 
                FROM ph_buildings_inventory WHERE school_id = i."SchoolID"
            ) rc ON true
            LEFT JOIN LATERAL (
                SELECT COUNT(*) as space_count FROM ph_school_buildable_spaces WHERE school_id = i."SchoolID"
            ) sc ON true
            WHERE i.status = 'Active'
        )
        SELECT 
            COUNT("SchoolID") FILTER (WHERE "SchoolID" IN (SELECT school_id FROM ph_schools)) as registered_count,
            COUNT("SchoolID") FILTER (WHERE completion_percentage >= 100) as completed_count,
            AVG(COALESCE(completion_percentage, 0)) as avg_completion,
            COUNT("SchoolID") FILTER (WHERE is_validated = true) as validated_count,
            COUNT("SchoolID") FILTER (WHERE needs_u7_val = true OR needs_u9_val = true) as needs_val_count
        FROM validation_stats
    `;
    
    const res = await pool.query(statsQuery);
    console.log("Monitoring Stats Query Success!");
    console.table(res.rows);
    
  } catch (err) {
    console.error("Monitoring Stats Query FAILED:", err.message);
  } finally {
    await pool.end();
  }
}

main();
