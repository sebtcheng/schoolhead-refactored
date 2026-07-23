import express from 'express';
import { pool, safeQuery } from '../../utils/db.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// [QUEST] DASHBOARD & ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────

router.get('/api/announcements/latest', async (req, res) => {
  try {
    const result = await safeQuery("SELECT content, created_at FROM ticket_announcements WHERE is_deleted = false ORDER BY created_at DESC LIMIT 1");
    if (result.rows.length === 0) return res.json({ success: true, data: null });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Fetch latest announcement error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.patch('/api/schools/:school_id/units/:unit_number/complete', async (req, res) => {
  const { school_id, unit_number } = req.params;
  const unitNum = parseInt(unit_number, 10);
  if (isNaN(unitNum) || unitNum < 1 || unitNum > 8) {
    return res.status(400).json({ error: `Invalid unit_number "${unit_number}"` });
  }
  const col = `unit${unitNum}`;
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      `UPDATE ph_schools SET ${col} = 1 WHERE school_id = $1
       RETURNING unit1, unit2, unit3, unit4, unit5, unit6, unit7, unit8, unit_completion`,
      [school_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "School not found" });
    const row = result.rows[0];
    res.json({
      success: true,
      data: {
        unit1: row.unit1, unit2: row.unit2, unit3: row.unit3, unit4: row.unit4,
        unit5: row.unit5, unit6: row.unit6, unit7: row.unit7, unit8: row.unit8,
        unit_completion: parseFloat(parseFloat(row.unit_completion || 0).toFixed(2))
      }
    });
  } catch (err) {
    console.error('PATCH unit complete error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    if (client) client.release();
  }
});

router.get('/api/schools/:schoolId/activity', async (req, res) => {
  const { schoolId } = req.params;
  try {
    const schoolRes = await safeQuery(
      `SELECT
        ps.school_id, ps.school_name,
        ps.unit5, ps.unit6, ps.unit7, ps.unit8, ps.unit9,
        ps.unit5_completed, ps.unit6_completed, ps.unit7_completed, ps.unit8_completed, ps.unit9_completed,
        ps.unit_completion, ps.region, ps.division,
        COALESCE(u1.unit1_completed, FALSE) AS unit1_completed,
        CASE WHEN u1.unit1_completed = TRUE THEN 100 ELSE COALESCE(u1.unit1, 0) END AS unit1,
        COALESCE(u2.unit2_completed = 100.00, FALSE) AS unit2_completed,
        CASE WHEN u2.unit2 = TRUE THEN 100 ELSE 0 END AS unit2,
        COALESCE(u3.unit3_completed = 100.00, FALSE) AS unit3_completed,
        CASE WHEN u3.unit3 = TRUE THEN 100 ELSE 0 END AS unit3,
        COALESCE(u4.unit4_completed = 100.00, FALSE) AS unit4_completed,
        CASE WHEN u4.unit4 = TRUE THEN 100 ELSE 0 END AS unit4
       FROM ph_schools ps
       LEFT JOIN unit1_school_identity u1 ON ps.iern = u1.iern
       LEFT JOIN unit2_school_learners u2 ON ps.iern = u2.iern
       LEFT JOIN unit3_organized_classes u3 ON ps.iern = u3.iern
       LEFT JOIN unit4_learner_profile u4 ON ps.iern = u4.iern
       WHERE ps.school_id = $1`,
      [schoolId]
    );
    if (schoolRes.rows.length === 0) return res.status(404).json({ error: "School not found" });

    const row = schoolRes.rows[0];
    const totalUnits = 9;
    let completedUnitsCount = 0;
    let completedFlags = {};

    const unitMapping = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = 0; i < unitMapping.length; i++) {
      const dbIdx = unitMapping[i];
      const displayId = i + 1;
      const intVal = parseInt(row[`unit${dbIdx}`]) || 0;
      const boolVal = row[`unit${dbIdx}_completed`] === true;
      const isDone = (intVal === 1 || boolVal);

      completedFlags[`unit${displayId}`] = isDone;
      if (isDone) completedUnitsCount++;
    }

    const overall_progress_percentage = parseFloat(((completedUnitsCount / totalUnits) * 100).toFixed(2));

    const sprintRes = await pool.query(
      `SELECT unit_id, duration_seconds FROM ph_performance_logs 
       WHERE school_id = $1 ORDER BY duration_seconds ASC LIMIT 1`,
      [schoolId]
    );
    let fastest_sprint = null;
    if (sprintRes.rows.length > 0) {
      const r = sprintRes.rows[0];
      fastest_sprint = { unit: r.unit_id, time_text: `${Math.floor(r.duration_seconds / 60)}m ${r.duration_seconds % 60}s` };
    }

    const divRes = await pool.query(`SELECT AVG(COALESCE(unit_completion, 0)) as avg FROM ph_schools WHERE division = $1`, [row.division]);
    const regRes = await pool.query(`SELECT AVG(COALESCE(unit_completion, 0)) as avg FROM ph_schools WHERE region = $1`, [row.region]);

    res.json({
      success: true,
      data: {
        schoolInfo: { school_id: row.school_id, school_name: row.school_name },
        progress: { completedUnits: completedUnitsCount, totalUnits, percentage: overall_progress_percentage, flags: completedFlags },
        gamification: { fastest_sprint },
        comparative: [
          { name: 'My School', completed: overall_progress_percentage },
          { name: 'Division Avg', completed: parseFloat(parseFloat(divRes.rows[0]?.avg || 0).toFixed(1)) },
          { name: 'Region Avg', completed: parseFloat(parseFloat(regRes.rows[0]?.avg || 0).toFixed(1)) }
        ]
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// [InsightEd Quest] SCHOOL HEAD DASHBOARD ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

router.get('/api/school-by-user/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const userRes = await pool.query('SELECT school_id FROM users WHERE uid = $1', [uid]);
    if (userRes.rowCount === 0) return res.status(404).json({ exists: false, error: 'User not found' });
    const schoolId = userRes.rows[0].school_id;
    if (!schoolId) return res.status(404).json({ exists: false, error: 'User has no school assigned' });
    const schoolRes = await safeQuery(`
      SELECT 
        ps.*,
        COALESCE(u1.unit1_completed, FALSE) AS unit1_validated,
        v.unit2_validated, v.unit3_validated, v.unit4_validated, v.unit5_validated,
        v.unit6_validated, v.unit7_validated, v.unit8_validated, v.unit9_validated,
        v.validation_percentage, v.validated_units_count, v.needs_validation
      FROM ph_schools ps
      LEFT JOIN unit1_school_identity u1 ON ps.iern = u1.iern
      LEFT JOIN ph_schools_validate v ON ps.school_id = v.school_id
      WHERE ps.school_id = $1
    `, [schoolId]);
    res.json({ exists: schoolRes.rowCount > 0, data: schoolRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/iern/:school_id', async (req, res) => {
  try {
    const { school_id } = req.params;
    const result = await safeQuery(
      `SELECT "IERN" FROM "schools_IERN" WHERE "SchoolID" = $1 LIMIT 1`,
      [school_id]
    );
    if (result.rows.length === 0) return res.json({ iern: null });
    res.json({ iern: result.rows[0].IERN });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/school-head/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const result = await safeQuery('SELECT first_name, last_name, office, region, division, account_category FROM users WHERE uid = $1', [uid]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'School Head not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/schools_iern/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await safeQuery('SELECT * FROM "schools_IERN" WHERE "SchoolID" = $1', [id]);
    res.json({ exists: result.rowCount > 0, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/ph_schools/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const schoolYr = req.query.school_yr || 'SY 26-27';
    let result;
    const query = `
      SELECT ps.*, 
             ps.unit2_simplified_enrollment,
             COALESCE(u2.enroll_kinder, ps.enroll_kinder) AS enroll_kinder,
             COALESCE(u2.enroll_g1, ps.enroll_g1) AS enroll_g1,
             COALESCE(u2.enroll_g2, ps.enroll_g2) AS enroll_g2,
             COALESCE(u2.enroll_g3, ps.enroll_g3) AS enroll_g3,
             COALESCE(u2.enroll_g4, ps.enroll_g4) AS enroll_g4,
             COALESCE(u2.enroll_g5, ps.enroll_g5) AS enroll_g5,
             COALESCE(u2.enroll_g6, ps.enroll_g6) AS enroll_g6,
             COALESCE(u2.enroll_g7, ps.enroll_g7) AS enroll_g7,
             COALESCE(u2.enroll_g8, ps.enroll_g8) AS enroll_g8,
             COALESCE(u2.enroll_g9, ps.enroll_g9) AS enroll_g9,
             COALESCE(u2.enroll_g10, ps.enroll_g10) AS enroll_g10,
             COALESCE(u2.enroll_g11, ps.enroll_g11) AS enroll_g11,
             COALESCE(u2.enroll_g12, ps.enroll_g12) AS enroll_g12,
             COALESCE(u2.total_enrollment, ps.total_enrollment) AS total_enrollment,
             COALESCE(u2.male_enrollment, ps.male_enrollment) AS male_enrollment,
             COALESCE(u2.female_enrollment, ps.female_enrollment) AS female_enrollment,
             COALESCE(u2.total_male, ps.total_male) AS total_male,
             COALESCE(u2.total_female, ps.total_female) AS total_female,
             COALESCE(u2.kinder_male, ps.kinder_male) AS kinder_male,
             COALESCE(u2.kinder_female, ps.kinder_female) AS kinder_female,
             COALESCE(u2.g1_male, ps.g1_male) AS g1_male,
             COALESCE(u2.g1_female, ps.g1_female) AS g1_female,
             COALESCE(u2.g2_male, ps.g2_male) AS g2_male,
             COALESCE(u2.g2_female, ps.g2_female) AS g2_female,
             COALESCE(u2.g3_male, ps.g3_male) AS g3_male,
             COALESCE(u2.g3_female, ps.g3_female) AS g3_female,
             COALESCE(u2.g4_male, ps.g4_male) AS g4_male,
             COALESCE(u2.g4_female, ps.g4_female) AS g4_female,
             COALESCE(u2.g5_male, ps.g5_male) AS g5_male,
             COALESCE(u2.g5_female, ps.g5_female) AS g5_female,
             COALESCE(u2.g6_male, ps.g6_male) AS g6_male,
             COALESCE(u2.g6_female, ps.g6_female) AS g6_female,
             COALESCE(u2.g7_male, ps.g7_male) AS g7_male,
             COALESCE(u2.g7_female, ps.g7_female) AS g7_female,
             COALESCE(u2.g8_male, ps.g8_male) AS g8_male,
             COALESCE(u2.g8_female, ps.g8_female) AS g8_female,
             COALESCE(u2.g9_male, ps.g9_male) AS g9_male,
             COALESCE(u2.g9_female, ps.g9_female) AS g9_female,
             COALESCE(u2.g10_male, ps.g10_male) AS g10_male,
             COALESCE(u2.g10_female, ps.g10_female) AS g10_female,
             COALESCE(u2.g11_male, ps.g11_male) AS g11_male,
             COALESCE(u2.g11_female, ps.g11_female) AS g11_female,
             COALESCE(u2.g12_male, ps.g12_male) AS g12_male,
             COALESCE(u2.g12_female, ps.g12_female) AS g12_female,
             COALESCE(u2.main_sned, COALESCE(ps.sned_male, 0) + COALESCE(ps.sned_female, 0)) AS main_sned,
             COALESCE(u2.main_sned_male, ps.sned_male) AS main_sned_male,
             COALESCE(u2.main_sned_female, ps.sned_female) AS main_sned_female,
             COALESCE(u2.self_sned, ps.sned_self_contained_count) AS self_sned,
             COALESCE(u2.self_sned, ps.sned_self_contained_count) AS sned_self_contained_count,
             COALESCE(u2.self_sned_male, 0) AS self_sned_male,
             COALESCE(u2.self_sned_female, 0) AS self_sned_female,
             COALESCE(u2.self_sned_org_class, ps.sned_organized_class_count) AS self_sned_org_class,
             COALESCE(u2.self_sned_org_class, ps.sned_organized_class_count) AS sned_organized_class_count,
             COALESCE(u2.has_aral_math, FALSE) AS has_aral_math,
             COALESCE(u2.aral_math_learners_g1, ps.aral_math_g1) AS aral_math_learners_g1,
             COALESCE(u2.aral_math_learners_g2, ps.aral_math_g2) AS aral_math_learners_g2,
             COALESCE(u2.aral_math_learners_g3, ps.aral_math_g3) AS aral_math_learners_g3,
             COALESCE(u2.aral_math_learners_g4, ps.aral_math_g4) AS aral_math_learners_g4,
             COALESCE(u2.aral_math_learners_g5, ps.aral_math_g5) AS aral_math_learners_g5,
             COALESCE(u2.aral_math_learners_g6, ps.aral_math_g6) AS aral_math_learners_g6,
             COALESCE(u2.has_aral_reading, FALSE) AS has_aral_reading,
             COALESCE(u2.aral_reading_learners_g1, ps.aral_read_g1) AS aral_reading_learners_g1,
             COALESCE(u2.aral_reading_learners_g2, ps.aral_read_g2) AS aral_reading_learners_g2,
             COALESCE(u2.aral_reading_learners_g3, ps.aral_read_g3) AS aral_reading_learners_g3,
             COALESCE(u2.aral_reading_learners_g4, ps.aral_read_g4) AS aral_reading_learners_g4,
             COALESCE(u2.aral_reading_learners_g5, ps.aral_read_g5) AS aral_reading_learners_g5,
             COALESCE(u2.aral_reading_learners_g6, ps.aral_read_g6) AS aral_reading_learners_g6,
             COALESCE(u2.has_aral_science, FALSE) AS has_aral_science,
             COALESCE(u2.aral_science_learners_g1, ps.aral_sci_g1) AS aral_science_learners_g1,
             COALESCE(u2.aral_science_learners_g2, ps.aral_sci_g2) AS aral_science_learners_g2,
             COALESCE(u2.aral_science_learners_g3, ps.aral_sci_g3) AS aral_science_learners_g3,
             COALESCE(u2.aral_science_learners_g4, ps.aral_sci_g4) AS aral_science_learners_g4,
             COALESCE(u2.aral_science_learners_g5, ps.aral_sci_g5) AS aral_science_learners_g5,
             COALESCE(u2.aral_science_learners_g6, ps.aral_sci_g6) AS aral_science_learners_g6,
             COALESCE(u2.multigrade_groupings_1, ps.multigrade_groupings_1) AS multigrade_groupings_1,
             COALESCE(u2.multigrade_groupings_2, ps.multigrade_groupings_2) AS multigrade_groupings_2,
             COALESCE(u2.multigrade_groupings_3, ps.multigrade_groupings_3) AS multigrade_groupings_3,
             COALESCE(u2.multigrade_enrollment_1, ps.multigrade_enrollment_1) AS multigrade_enrollment_1,
             COALESCE(u2.multigrade_enrollment_2, ps.multigrade_enrollment_2) AS multigrade_enrollment_2,
             COALESCE(u2.multigrade_enrollment_3, ps.multigrade_enrollment_3) AS multigrade_enrollment_3,
             COALESCE(u2.multigrade_groupings_1_male, 0) AS multigrade_groupings_1_male,
             COALESCE(u2.multigrade_groupings_1_female, 0) AS multigrade_groupings_1_female,
             COALESCE(u2.multigrade_groupings_2_male, 0) AS multigrade_groupings_2_male,
             COALESCE(u2.multigrade_groupings_2_female, 0) AS multigrade_groupings_2_female,
             COALESCE(u2.multigrade_groupings_3_male, 0) AS multigrade_groupings_3_male,
             COALESCE(u2.multigrade_groupings_3_female, 0) AS multigrade_groupings_3_female,
             u3.grade_kinder_size, u3.grade_1_size, u3.grade_2_size, u3.grade_3_size,
             u3.grade_4_size, u3.grade_5_size, u3.grade_6_size, u3.grade_7_size,
             u3.grade_8_size, u3.grade_9_size, u3.grade_10_size, u3.grade_11_size,
             u3.grade_12_size, u3.multigrade_size_1, u3.multigrade_size_2, u3.multigrade_size_3,
             -- Unit1: only count as completed if the unit1 table row exists
             COALESCE(u1.unit1_completed, FALSE) AS unit1_completed,
             CASE WHEN u1.unit1_completed = TRUE THEN 100 ELSE COALESCE(u1.unit1, 0) END AS unit1,
             COALESCE(u1.unit1_completed, FALSE) AS unit1_has_data,
             -- Unit2: only count as completed if the unit2 table row exists
             COALESCE(u2.unit2_completed = 100.00, FALSE) AS unit2_completed,
             CASE WHEN COALESCE(u2.unit2_completed = 100.00, FALSE) = TRUE THEN 100 ELSE 0 END AS unit2,
             (u2.iern IS NOT NULL) AS unit2_has_data,
             -- Unit3: only count as completed if the unit3 table row actually exists
             (u3.iern IS NOT NULL AND u3.unit3 = TRUE) AS unit3_completed,
             CASE WHEN u3.iern IS NOT NULL AND u3.unit3 = TRUE THEN 100 ELSE 0 END AS unit3,
             (u3.iern IS NOT NULL) AS unit3_has_data,
             -- Unit4: only count as completed if the unit4 table row actually exists
             (u4.iern IS NOT NULL AND u4.unit4 = TRUE) AS unit4_completed,
             CASE WHEN u4.iern IS NOT NULL AND u4.unit4 = TRUE THEN 100 ELSE 0 END AS unit4,
             (u4.iern IS NOT NULL) AS unit4_has_data,
             u4.selected_learner_groups, u4.bmi_severely_wasted, u4.bmi_wasted, u4.bmi_overweight_obese, u4.bmi_normal,
             u4.als_kinder, u4.als_g1, u4.als_g2, u4.als_g3, u4.als_g4, u4.als_g5, u4.als_g6, u4.als_g7, u4.als_g8, u4.als_g9, u4.als_g10, u4.als_g11, u4.als_g12, u4.als_total,
             u4.fourps_kinder, u4.fourps_g1, u4.fourps_g2, u4.fourps_g3, u4.fourps_g4, u4.fourps_g5, u4.fourps_g6, u4.fourps_g7, u4.fourps_g8, u4.fourps_g9, u4.fourps_g10, u4.fourps_g11, u4.fourps_g12,
             u4.muslim_kinder, u4.muslim_g1, u4.muslim_g2, u4.muslim_g3, u4.muslim_g4, u4.muslim_g5, u4.muslim_g6, u4.muslim_g7, u4.muslim_g8, u4.muslim_g9, u4.muslim_g10, u4.muslim_g11, u4.muslim_g12,
             u4.ip_kinder, u4.ip_g1, u4.ip_g2, u4.ip_g3, u4.ip_g4, u4.ip_g5, u4.ip_g6, u4.ip_g7, u4.ip_g8, u4.ip_g9, u4.ip_g10, u4.ip_g11, u4.ip_g12,
             u4.displaced_kinder, u4.displaced_g1, u4.displaced_g2, u4.displaced_g3, u4.displaced_g4, u4.displaced_g5, u4.displaced_g6, u4.displaced_g7, u4.displaced_g8, u4.displaced_g9, u4.displaced_g10, u4.displaced_g11, u4.displaced_g12,
             u4.overage_kinder, u4.overage_g1, u4.overage_g2, u4.overage_g3, u4.overage_g4, u4.overage_g5, u4.overage_g6, u4.overage_g7, u4.overage_g8, u4.overage_g9, u4.overage_g10, u4.overage_g11, u4.overage_g12,
             u4.dropout_kinder, u4.dropout_g1, u4.dropout_g2, u4.dropout_g3, u4.dropout_g4, u4.dropout_g5, u4.dropout_g6, u4.dropout_g7, u4.dropout_g8, u4.dropout_g9, u4.dropout_g10, u4.dropout_g11, u4.dropout_g12,
             u4.repeater_kinder, u4.repeater_g1, u4.repeater_g2, u4.repeater_g3, u4.repeater_g4, u4.repeater_g5, u4.repeater_g6, u4.repeater_g7, u4.repeater_g8, u4.repeater_g9, u4.repeater_g10, u4.repeater_g11, u4.repeater_g12,
             u4.lwd_kinder, u4.lwd_g1, u4.lwd_g2, u4.lwd_g3, u4.lwd_g4, u4.lwd_g5, u4.lwd_g6, u4.lwd_g7, u4.lwd_g8, u4.lwd_g9, u4.lwd_g10, u4.lwd_g11, u4.lwd_g12,
             u4.sned_kinder, u4.sned_g1, u4.sned_g2, u4.sned_g3, u4.sned_g4, u4.sned_g5, u4.sned_g6, u4.sned_g7, u4.sned_g8, u4.sned_g9, u4.sned_g10, u4.sned_g11, u4.sned_g12,
             u1.head_first_name, u1.head_middle_name, u1.head_last_name, u1.head_sex,
             u1.head_position_title, u1.head_date_hired,
             u1.ownership_type AS ownership, u1.document_type AS ownership_document_type,
             u1.multiple_ownership AS ownership_multiple, u1.multiple_document_type AS ownership_document_multiple,
             u1.document_path AS local_file_path, u1.annexes AS annex_details,
             u1.ownership_na_reason, u1.ownership_doc_id,
             u1.established_month, u1.established_year,
             u1.mother_school_id, u1.extension_mother_school_name,
             -- COALESCE: unit1_school_identity is the authoritative source for these fields.
             -- ph_schools may have nulls if not synced after Unit 1 submission.
             COALESCE(NULLIF(u1.school_type, ''), ps.school_type) AS school_type,
             COALESCE(NULLIF(u1.curricular_offering, ''), ps.curricular_offering) AS curricular_offering,
             COALESCE(NULLIF(u1.latitude, ''), ps.latitude) AS latitude,
             COALESCE(NULLIF(u1.longitude, ''), ps.longitude) AS longitude,
             
             -- Unit 5 Shifting & Modality
             COALESCE(u5.has_standard_shifting, ps.has_standard_shifting) AS has_standard_shifting,
             COALESCE(u5.has_adms, FALSE) AS has_adms,
             COALESCE(u5.shifting_modality, ps.shifting_modality) AS shifting_modality,
             COALESCE(u5.adm_mdl, ps.adm_mdl) AS adm_mdl,
             COALESCE(u5.adm_odl, ps.adm_odl) AS adm_odl,
             COALESCE(u5.adm_tvi, ps.adm_tvi) AS adm_tvi,
             COALESCE(u5.adm_blended, ps.adm_blended) AS adm_blended,
             COALESCE(u5.shift_kinder, ps.shift_kinder) AS shift_kinder,
             COALESCE(u5.shift_g1, ps.shift_g1) AS shift_g1,
             COALESCE(u5.shift_g2, ps.shift_g2) AS shift_g2,
             COALESCE(u5.shift_g3, ps.shift_g3) AS shift_g3,
             COALESCE(u5.shift_g4, ps.shift_g4) AS shift_g4,
             COALESCE(u5.shift_g5, ps.shift_g5) AS shift_g5,
             COALESCE(u5.shift_g6, ps.shift_g6) AS shift_g6,
             COALESCE(u5.shift_g7, ps.shift_g7) AS shift_g7,
             COALESCE(u5.shift_g8, ps.shift_g8) AS shift_g8,
             COALESCE(u5.shift_g9, ps.shift_g9) AS shift_g9,
             COALESCE(u5.shift_g10, ps.shift_g10) AS shift_g10,
             COALESCE(u5.shift_g11, ps.shift_g11) AS shift_g11,
             COALESCE(u5.shift_g12, ps.shift_g12) AS shift_g12,
             COALESCE(u5.shift_mg_1, ps.shift_mg_1) AS shift_mg_1,
             COALESCE(u5.shift_mg_2, ps.shift_mg_2) AS shift_mg_2,
             COALESCE(u5.shift_mg_3, ps.shift_mg_3) AS shift_mg_3,
             COALESCE(u5.mode_kinder, ps.mode_kinder) AS mode_kinder,
             COALESCE(u5.mode_g1, ps.mode_g1) AS mode_g1,
             COALESCE(u5.mode_g2, ps.mode_g2) AS mode_g2,
             COALESCE(u5.mode_g3, ps.mode_g3) AS mode_g3,
             COALESCE(u5.mode_g4, ps.mode_g4) AS mode_g4,
             COALESCE(u5.mode_g5, ps.mode_g5) AS mode_g5,
             COALESCE(u5.mode_g6, ps.mode_g6) AS mode_g6,
             COALESCE(u5.mode_g7, ps.mode_g7) AS mode_g7,
             COALESCE(u5.mode_g8, ps.mode_g8) AS mode_g8,
             COALESCE(u5.mode_g9, ps.mode_g9) AS mode_g9,
             COALESCE(u5.mode_g10, ps.mode_g10) AS mode_g10,
             COALESCE(u5.mode_g11, ps.mode_g11) AS mode_g11,
             COALESCE(u5.mode_g12, ps.mode_g12) AS mode_g12,
             COALESCE(u5.mode_mg_1, ps.mode_mg_1) AS mode_mg_1,
             COALESCE(u5.mode_mg_2, ps.mode_mg_2) AS mode_mg_2,
             COALESCE(u5.mode_mg_3, ps.mode_mg_3) AS mode_mg_3,
             COALESCE(u5.unit5_completed, FALSE) AS unit5_completed,
             CASE WHEN COALESCE(u5.unit5_completed, FALSE) = TRUE THEN 100 ELSE 0 END AS unit5,
             (u5.iern IS NOT NULL) AS unit5_has_data,
             -- Unit6: only count as completed if the unit6 table row actually exists
             COALESCE(u6.unit6_completed, FALSE) AS unit6_completed,
             CASE WHEN COALESCE(u6.unit6_completed, FALSE) = TRUE THEN 100 ELSE 0 END AS unit6,
             (u6.school_id IS NOT NULL) AS unit6_has_data,
             -- Unit7: only count as completed if the unit7 table row actually exists
             COALESCE(u7.unit7_completed, FALSE) AS unit7_completed,
             CASE WHEN COALESCE(u7.unit7_completed, FALSE) = TRUE THEN 100 ELSE 0 END AS unit7,
             (u7.school_id IS NOT NULL) AS unit7_has_data,
             -- Unit8: only count as completed if the unit8 table row actually exists
             COALESCE(u8.unit8_completed, FALSE) AS unit8_completed,
             CASE WHEN COALESCE(u8.unit8_completed, FALSE) = TRUE THEN 100 ELSE 0 END AS unit8,
             (u8.school_id IS NOT NULL) AS unit8_has_data,
             -- Unit9: only count as completed if the unit9 table row actually exists
             COALESCE(u9.unit9_completed, FALSE) AS unit9_completed,
             CASE WHEN COALESCE(u9.unit9_completed, FALSE) = TRUE THEN 100 ELSE 0 END AS unit9,
             (u9.school_id IS NOT NULL) AS unit9_has_data
      FROM ph_schools ps
      LEFT JOIN unit1_school_identity u1 ON ps.iern = u1.iern AND u1.school_yr = $2
      LEFT JOIN unit2_school_learners u2 ON ps.iern = u2.iern AND u2.school_yr = $2
      LEFT JOIN unit3_organized_classes u3 ON ps.iern = u3.iern AND u3.school_yr = $2
      LEFT JOIN unit4_learner_profile u4 ON ps.iern = u4.iern AND u4.school_yr = $2
      LEFT JOIN unit5_shifting_modality u5 ON ps.iern = u5.iern AND u5.school_yr = $2
      LEFT JOIN unit6_school_resources u6 ON ps.school_id = u6.school_id AND u6.school_yr = $2
      LEFT JOIN unit7_facilities u7 ON ps.school_id = u7.school_id AND u7.school_yr = $2
      LEFT JOIN unit8_location u8 ON ps.school_id = u8.school_id AND u8.school_yr = $2
      LEFT JOIN unit9_safety u9 ON ps.school_id = u9.school_id AND u9.school_yr = $2
      WHERE ps.school_id = $1 OR ps.iern = $1
    `;
    try {
      result = await safeQuery(query, [id, schoolYr]);
    } catch (err) {
      if (err.message.includes('terminated unexpectedly')) {
        result = await safeQuery(query, [id, schoolYr]);
      } else {
        throw err;
      }
    }

    if (result.rows.length > 0) {
      const schoolData = result.rows[0];
      const iern = schoolData.iern;

      if (iern) {
        // Fetch Unit 6 resources flat row
        const resRow = await safeQuery('SELECT * FROM unit6_school_resources WHERE iern = $1 AND school_yr = $2', [iern, schoolYr]);
        if (resRow.rows.length > 0) {
          const r = resRow.rows[0];

          // 1. Rebuild unit7_furniture
          const gradesRows = await safeQuery('SELECT * FROM unit6_furniture_grades WHERE iern = $1 AND school_yr = $2', [iern, schoolYr]);
          const grades = gradesRows.rows.map(g => ({
            id: g.grade_level,
            grade_level: g.grade_level === 'kinder' ? 'Kinder' : 
                         g.grade_level === 'sned_self_contained' ? 'Self-contained SNED' :
                         g.grade_level === 'sped_als' ? 'SPED/ALS' :
                         g.grade_level.startsWith('mg_') ? g.grade_level : 
                         `Grade ${g.grade_level.replace('g', '')}`,
            armchair_wood_func: String(g.armchair_wood_func || 0),
            armchair_wood_broken: String(g.armchair_wood_broken || 0),
            armchair_plastic_func: String(g.armchair_plastic_func || 0),
            armchair_plastic_broken: String(g.armchair_plastic_broken || 0),
            armchair_plastic_steel_func: String(g.armchair_plastic_steel_func || 0),
            armchair_plastic_steel_broken: String(g.armchair_plastic_steel_broken || 0),
            individual_table_chair_func: String(g.individual_table_chair_func || 0),
            individual_table_chair_broken: String(g.individual_table_chair_broken || 0),
            two_seater_wood_func: String(g.two_seater_wood_func || 0),
            two_seater_wood_broken: String(g.two_seater_wood_broken || 0),
            two_seater_wood_steel_func: String(g.two_seater_wood_steel_func || 0),
            two_seater_wood_steel_broken: String(g.two_seater_wood_steel_broken || 0),
            wooden_chair_only_func: String(g.wooden_chair_only_func || 0),
            wooden_chair_only_broken: String(g.wooden_chair_only_broken || 0),
            plastic_chair_only_func: String(g.plastic_chair_only_func || 0),
            plastic_chair_only_broken: String(g.plastic_chair_only_broken || 0),
            is_sharing: g.is_sharing,
            shared_with: g.shared_with ? g.shared_with.split(',') : [],
            is_kinder_double_shift: g.is_kinder_double_shift
          }));

          const general = {
            has_general_rooms: r.has_general_rooms,
            general_rooms_count: String(r.general_rooms_count || 0),
            armchair_wood_func: String(r.armchair_wood_func || 0),
            armchair_wood_broken: String(r.armchair_wood_broken || 0),
            armchair_plastic_func: String(r.armchair_plastic_func || 0),
            armchair_plastic_broken: String(r.armchair_plastic_broken || 0),
            armchair_plastic_steel_func: String(r.armchair_plastic_steel_func || 0),
            armchair_plastic_steel_broken: String(r.armchair_plastic_steel_broken || 0),
            individual_table_chair_func: String(r.individual_table_chair_func || 0),
            individual_table_chair_broken: String(r.individual_table_chair_broken || 0),
            two_seater_wood_func: String(r.two_seater_wood_func || 0),
            two_seater_wood_broken: String(r.two_seater_wood_broken || 0),
            two_seater_wood_steel_func: String(r.two_seater_wood_steel_func || 0),
            two_seater_wood_steel_broken: String(r.two_seater_wood_steel_broken || 0),
            wooden_chair_only_func: String(r.wooden_chair_only_func || 0),
            wooden_chair_only_broken: String(r.wooden_chair_only_broken || 0),
            plastic_chair_only_func: String(r.plastic_chair_only_func || 0),
            plastic_chair_only_broken: String(r.plastic_chair_only_broken || 0),
            has_teacher_desk: r.has_teacher_desk
          };

          schoolData.unit7_furniture = { grades, general };

          // 2. Rebuild unit7_ict
          schoolData.unit7_ict = {
            laptops_total: String(r.laptops_total || 0),
            laptops_func: String(r.laptops_func || 0),
            laptops_teaching: String(r.laptops_teaching || 0),
            laptops_working: String(r.laptops_working || 0),
            laptops_students: String(r.laptops_students || 0),
            tablets_total: String(r.tablets_total || 0),
            tablets_func: String(r.tablets_func || 0),
            tablets_teaching: String(r.tablets_teaching || 0),
            tablets_working: String(r.tablets_working || 0),
            tablets_students: String(r.tablets_students || 0),
            desktops_total: String(r.desktops_total || 0),
            desktops_func: String(r.desktops_func || 0),
            desktops_teaching: String(r.desktops_teaching || 0),
            desktops_working: String(r.desktops_working || 0),
            desktops_students: String(r.desktops_students || 0),
            smart_tvs_total: String(r.smart_tvs_total || 0),
            smart_tvs_func: String(r.smart_tvs_func || 0),
            smart_tvs_cond: r.smart_tvs_cond || "",
            projectors_total: String(r.projectors_total || 0),
            projectors_func: String(r.projectors_func || 0),
            projectors_cond: r.projectors_cond || "",
            printers_total: String(r.printers_total || 0),
            printers_func: String(r.printers_func || 0),
            printers_cond: r.printers_cond || ""
          };

          // 3. Rebuild unit7_has_ecart and unit7_ecarts
          schoolData.unit7_has_ecart = r.unit7_has_ecart;
          const ecartRows = await safeQuery('SELECT * FROM unit6_ecart_batches WHERE iern = $1 AND school_yr = $2', [iern, schoolYr]);
          schoolData.unit7_ecarts = ecartRows.rows.map(c => ({
            batches_name: c.batches_name || "",
            year_received: String(c.year_received || 0),
            sources_fund: c.sources_fund || "",
            ecart_laptops: String(c.ecart_laptops || 0),
            ecart_tablets: String(c.ecart_tablets || 0),
            ecart_tv: String(c.ecart_tv || 0),
            charging_condition: c.charging_condition || "",
            remarks: c.remarks || ""
          }));

          // 4. Rebuild unit7_wash
          schoolData.unit7_wash = {
            male_seats_total: String(r.male_seats_total || 0),
            male_seats_func: String(r.male_seats_func || 0),
            male_seats_cond: r.male_seats_cond || "",
            male_urinals_total: String(r.male_urinals_total || 0),
            male_urinals_func: String(r.male_urinals_func || 0),
            female_seats_total: String(r.female_seats_total || 0),
            female_seats_func: String(r.female_seats_func || 0),
            female_seats_cond: r.female_seats_cond || "",
            common_seats_total: String(r.common_seats_total || 0),
            common_seats_func: String(r.common_seats_func || 0),
            common_seats_cond: r.common_seats_cond || "",
            pwd_seats_total: String(r.pwd_seats_total || 0),
            pwd_seats_func: String(r.pwd_seats_func || 0),
            pwd_seats_cond: r.pwd_seats_cond || "",
            faucets_total: String(r.faucets_total || 0),
            faucets_func: String(r.faucets_func || 0),
            faucets_cond: r.faucets_cond || "",
            water_source: r.water_source || "",
            confirm_no_piped: r.confirm_no_piped,
            confirm_no_piped_text: r.confirm_no_piped_text || "",
            confirm_zero_wash_text: r.confirm_zero_wash_text || "",
            attached_cr_classrooms: String(r.attached_cr_classrooms || 0),
            attached_cr_seats: String(r.attached_cr_seats || 0),
            attached_cr_included_in_main: r.attached_cr_included_in_main
          };

          // 5. Rebuild unit7_utilities
          schoolData.unit7_utilities = {
            utility_electricity: r.utility_electricity || "",
            confirm_no_grid: r.confirm_no_grid,
            confirm_no_grid_text: r.confirm_no_grid_text || "",
            has_solar_or_gen: r.has_solar_or_gen,
            utility_internet_yesno: r.utility_internet_yesno,
            utility_internet_type: r.utility_internet_type || "",
            confirm_no_wired: r.confirm_no_wired,
            confirm_no_wired_text: r.confirm_no_wired_text || "",
            utility_internet_funder: r.utility_internet_funder || ""
          };

          schoolData.unit6_completed = r.unit6_completed;
          schoolData.unit6_updated_at = r.unit6_updated_at;
        } else {
          // Fallback to default properties to ensure clean baseline loading
          schoolData.unit7_furniture = { grades: [], general: {} };
          schoolData.unit7_ict = {
            laptops_total: "0", laptops_func: "0", laptops_teaching: "0", laptops_working: "0", laptops_students: "0",
            tablets_total: "0", tablets_func: "0", tablets_teaching: "0", tablets_working: "0", tablets_students: "0",
            desktops_total: "0", desktops_func: "0", desktops_teaching: "0", desktops_working: "0", desktops_students: "0",
            smart_tvs_total: "0", smart_tvs_func: "0", smart_tvs_cond: "",
            projectors_total: "0", projectors_func: "0", projectors_cond: "",
            printers_total: "0", printers_func: "0", printers_cond: ""
          };
          schoolData.unit7_has_ecart = null;
          schoolData.unit7_ecarts = [];
          schoolData.unit7_wash = {
            male_seats_total: "0", male_seats_func: "0", male_seats_cond: "",
            male_urinals_total: "0", male_urinals_func: "0",
            female_seats_total: "0", female_seats_func: "0", female_seats_cond: "",
            common_seats_total: "0", common_seats_func: "0", common_seats_cond: "",
            pwd_seats_total: "0", pwd_seats_func: "0", pwd_seats_cond: "",
            faucets_total: "0", faucets_func: "0", faucets_cond: "",
            water_source: "", confirm_no_piped: false, confirm_no_piped_text: "", confirm_zero_wash_text: "",
            attached_cr_classrooms: "0", attached_cr_seats: "0", attached_cr_included_in_main: false
          };
          schoolData.unit7_utilities = {
            utility_electricity: "", confirm_no_grid: false, confirm_no_grid_text: "", has_solar_or_gen: false,
            utility_internet_yesno: null, utility_internet_type: "", confirm_no_wired: false, confirm_no_wired_text: "", utility_internet_funder: ""
          };
          schoolData.unit6_completed = false;
        }
      }
    }

    res.json({ exists: result.rowCount > 0, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/audit/remarks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await safeQuery('SELECT * FROM audit_feedback_tasks WHERE school_id = $1 ORDER BY created_at DESC', [id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

router.get('/api/schools/:id/activity', async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT ps.*, 
             COALESCE(u2.unit2_completed = 100.00, ps.unit2_completed) AS unit2_completed,
             CASE WHEN u2.unit2 = TRUE THEN 100 ELSE ps.unit2 END AS unit2,
             COALESCE(u3.unit3_completed = 100.00, ps.unit3_completed) AS unit3_completed,
             CASE WHEN u3.unit3 = TRUE THEN 100 ELSE ps.unit3 END AS unit3,
             COALESCE(u4.unit4_completed = 100.00, FALSE) AS unit4_completed,
             CASE WHEN u4.unit4 = TRUE THEN 100 ELSE 0 END AS unit4,
             COALESCE(u5.unit5_completed, ps.unit5_completed) AS unit5_completed,
             CASE WHEN COALESCE(u5.unit5_completed, ps.unit5_completed) = TRUE THEN 100 ELSE 0 END AS unit5
      FROM ph_schools ps
      LEFT JOIN unit2_school_learners u2 ON ps.iern = u2.iern
      LEFT JOIN unit3_organized_classes u3 ON ps.iern = u3.iern
      LEFT JOIN unit4_learner_profile u4 ON ps.iern = u4.iern
      LEFT JOIN unit5_shifting_modality u5 ON ps.iern = u5.iern
      WHERE ps.school_id = $1
    `;
    const schoolRes = await safeQuery(query, [id]);
    const completionRes = await safeQuery('SELECT * FROM ph_school_completion WHERE school_id = $1', [id]);
    
    const school = schoolRes.rows[0] || {};
    const flags = {};
    const completedUnits = [];
    for (let i = 1; i <= 9; i++) {
        const val = school[`unit${i}`];
        if (Number(val) === 100 || school[`unit${i}_completed`] === true) {
            flags[`unit${i}`] = true;
            completedUnits.push(i);
        }
    }

    res.json({
      success: true,
      data: {
        schoolInfo: school,
        progress: {
          percentage: school.completion_percentage || 0,
          completedUnits,
          flags
        },
        gamification: completionRes.rows[0] || {}
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/ph_schools/progress/:schoolId', async (req, res) => {
  try {
    const { schoolId } = req.params;
    const schoolYr = req.query.school_yr || 'SY 26-27';

    const schoolRes = await safeQuery(
      `SELECT ps.school_id, ps.school_name, ps.region, ps.division, ps.unit_completion, ps.is_esf7_opened,
       COALESCE(u5.unit5_completed, FALSE) AS unit5_completed,
       CASE WHEN COALESCE(u5.unit5_completed, FALSE) = TRUE THEN 100 ELSE COALESCE(u5.unit5, 0) END AS unit5,
       u5.unit5_updated_at AS unit5_updated_at,
       COALESCE(u6.unit6_completed, FALSE) AS unit6_completed,
       CASE WHEN COALESCE(u6.unit6_completed, FALSE) = TRUE THEN 100 ELSE 0 END AS unit6,
       u6.unit6_updated_at AS unit6_updated_at,
       COALESCE(u7.unit7_completed, FALSE) AS unit7_completed,
       CASE WHEN COALESCE(u7.unit7_completed, FALSE) = TRUE THEN 100 ELSE COALESCE(u7.unit7, 0) END AS unit7,
       u7.unit7_updated_at AS unit7_updated_at,
       COALESCE(u8.unit8_completed, FALSE) AS unit8_completed,
       CASE WHEN COALESCE(u8.unit8_completed, FALSE) = TRUE THEN 100 ELSE COALESCE(u8.unit8, 0) END AS unit8,
       u8.unit8_updated_at AS unit8_updated_at,
       COALESCE(u9.unit9_completed, FALSE) AS unit9_completed,
       CASE WHEN COALESCE(u9.unit9_completed, FALSE) = TRUE THEN 100 ELSE COALESCE(u9.unit9, 0) END AS unit9,
       u9.unit9_updated_at AS unit9_updated_at,
       COALESCE(u1.unit1_completed, FALSE) AS unit1_completed,
       CASE WHEN u1.unit1_completed = TRUE THEN 100 ELSE COALESCE(u1.unit1, 0) END AS unit1,
       u1.unit1_updated_at AS unit1_updated_at,
       COALESCE(u2.unit2_completed = 100.00, FALSE) AS unit2_completed,
       CASE WHEN COALESCE(u2.unit2_completed = 100.00, FALSE) = TRUE THEN 100 ELSE 0 END AS unit2,
       u2.updated_at AS unit2_updated_at,
       COALESCE(u3.unit3_completed = 100.00, FALSE) AS unit3_completed,
       CASE WHEN COALESCE(u3.unit3_completed = 100.00, FALSE) = TRUE THEN 100 ELSE 0 END AS unit3,
       u3.updated_at AS unit3_updated_at,
       COALESCE(u4.unit4_completed = 100.00, FALSE) AS unit4_completed,
       CASE WHEN COALESCE(u4.unit4_completed = 100.00, FALSE) = TRUE THEN 100 ELSE 0 END AS unit4,
       u4.updated_at AS unit4_updated_at,
       COALESCE(u1.unit1_completed, FALSE) AS unit1_validated,
       v.unit2_validated, v.unit3_validated, v.unit4_validated, v.unit5_validated,
       v.unit6_validated, v.unit7_validated, v.unit8_validated, v.unit9_validated,
       v.validation_percentage
       FROM ph_schools ps
       LEFT JOIN unit1_school_identity u1 ON ps.iern = u1.iern AND u1.school_yr = $2
       LEFT JOIN unit2_school_learners u2 ON ps.iern = u2.iern AND u2.school_yr = $2
       LEFT JOIN unit3_organized_classes u3 ON ps.iern = u3.iern AND u3.school_yr = $2
       LEFT JOIN unit4_learner_profile u4 ON ps.iern = u4.iern AND u4.school_yr = $2
       LEFT JOIN unit5_shifting_modality u5 ON ps.iern = u5.iern AND u5.school_yr = $2
       LEFT JOIN unit6_school_resources u6 ON ps.school_id = u6.school_id AND u6.school_yr = $2
       LEFT JOIN unit7_facilities u7 ON ps.school_id = u7.school_id AND u7.school_yr = $2
       LEFT JOIN unit8_location u8 ON ps.school_id = u8.school_id AND u8.school_yr = $2
       LEFT JOIN unit9_safety u9 ON ps.school_id = u9.school_id AND u9.school_yr = $2
       LEFT JOIN ph_schools_validate v ON ps.school_id = v.school_id
       WHERE ps.school_id = $1`,
      [schoolId, schoolYr]
    );
    
    if (schoolRes.rowCount === 0) return res.status(404).json({ error: 'School not found' });
    const school = schoolRes.rows[0];

    const completedUnits = [];
    const flags = {};
    const validationFlags = {};
    let completedCount = 0;
    for (let i = 1; i <= 9; i++) {
      const isCompleted = school[`unit${i}_completed`] === true || String(school[`unit${i}_completed`]) === 'true';
      const val = parseFloat(school[`unit${i}`]) || 0;
      const isHundred = Math.round(val) === 100;
      
      let unitProgress = 0;
      if (isCompleted || isHundred) {
        completedUnits.push(i);
        flags[`unit${i}`] = true;
        unitProgress = 100;
      } else if (val > 0) {
        unitProgress = val;
      }
      completedCount += (unitProgress / 100);
      validationFlags[`unit${i}`] = school[`unit${i}_validated`] === true;
    }
    const dynamicPercentage = parseFloat(((completedCount / 9) * 100).toFixed(2));


    const completionRes = await safeQuery('SELECT * FROM ph_school_completion WHERE school_id = $1', [schoolId]);

    const esf7Res = await pool.query(
      'SELECT status FROM esf7_link WHERE school_id = $1 ORDER BY updated_at DESC LIMIT 1',
      [schoolId]
    );
    let esf7Progress = 0;
    if (esf7Res.rowCount > 0) {
      const status = esf7Res.rows[0].status;
      if (['SUBMITTED', 'PROCESSING', 'QUEUE'].includes(status)) {
        esf7Progress = 50;
      } else if (status === 'VERIFIED') {
        esf7Progress = 100;
      }
    }

    res.json({
      success: true,
      data: {
        schoolInfo: {
          school_id: school.school_id,
          school_name: school.school_name,
          region: school.region,
          division: school.division,
          is_esf7_opened: school.is_esf7_opened === true || String(school.is_esf7_opened) === 'true'
        },
        progress: {
          percentage: dynamicPercentage,
          validation_percentage: school.validation_percentage ? parseFloat(school.validation_percentage) : 0,
          esf7_progress: esf7Progress,
          completedUnits: completedUnits,
          flags: flags,
          validationFlags: validationFlags,
          timestamps: {
            unit1: school.unit1_updated_at,
            unit2: school.unit2_updated_at,
            unit3: school.unit3_updated_at,
            unit4: school.unit4_updated_at,
            unit5: school.unit5_updated_at,
            unit6: school.unit6_updated_at,
            unit7: school.unit7_updated_at,
            unit8: school.unit8_updated_at,
            unit9: school.unit9_updated_at
          }
        },
        gamification: completionRes.rows[0] || {}
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/monitoring/schools', async (req, res) => {
  try {
    const { region, division, page = 1, limit = 20, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let query = `
      SELECT 
        v.school_id, v.school_name, v.region, v.division,
        v.unit2_completed as u2_status, v.unit3_completed as u3_status,
        v.unit4_completed as u4_status, v.unit5_completed as u5_status, v.unit6_completed as u6_status,
        v.unit7_completed as u7_status, v.unit8_completed as u8_status, v.unit9_completed as u9_status,
        v.unit2_validated, v.unit3_validated, v.unit4_validated, v.unit5_validated,
        v.unit6_validated, v.unit7_validated, v.unit8_validated, v.unit9_validated,
        v.needs_validation, v.validation_percentage,
        COALESCE(u1.unit1_completed, FALSE) as u1_status,
        COALESCE(u1.unit1_completed, FALSE) as unit1_validated,
        ps.completion_percentage,
        ps.data_health_score, ps.data_health_description, ps.data_quality_issues
      FROM ph_schools_validate v
      JOIN ph_schools ps ON v.school_id = ps.school_id
      LEFT JOIN unit1_school_identity u1 ON ps.iern = u1.iern
      WHERE 1=1
    `;
    
    let params = [];
    let pIdx = 1;
    
    if (region) { query += ` AND v.region = $${pIdx++}`; params.push(region); }
    if (division) { query += ` AND v.division = $${pIdx++}`; params.push(division); }
    if (search) { 
      query += ` AND (v.school_name ILIKE $${pIdx} OR v.school_id ILIKE $${pIdx})`; 
      params.push(`%${search}%`);
      pIdx++;
    }
    
    const countQuery = `SELECT COUNT(*) FROM (${query}) as count_query`;
    const countRes = await safeQuery(countQuery, params);
    const total = parseInt(countRes.rows[0].count);
    
    query += ` ORDER BY v.school_name LIMIT $${pIdx++} OFFSET $${pIdx++}`;
    params.push(parseInt(limit), offset);
    
    const result = await pool.query(query, params);
    
    res.json({
      data: result.rows,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      page: parseInt(page)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export { router as dashboardRouter };
export default router;
