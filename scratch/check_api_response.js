import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    connectionString: "postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging",
    ssl: false
});

async function run() {
    try {
        console.log("Simulating `/api/ph_schools/:id` query for 999163:");
        const query = `
      SELECT ps.*, 
             u2.enroll_kinder, u2.enroll_g1, u2.enroll_g2, u2.enroll_g3, u2.enroll_g4, u2.enroll_g5, u2.enroll_g6,
             u2.enroll_g7, u2.enroll_g8, u2.enroll_g9, u2.enroll_g10, u2.enroll_g11, u2.enroll_g12, u2.total_enrollment,
             u2.male_enrollment, u2.female_enrollment, u2.total_male, u2.total_female,
             u2.kinder_male, u2.kinder_female, u2.g1_male, u2.g1_female, u2.g2_male, u2.g2_female, u2.g3_male, u2.g3_female,
             u2.g4_male, u2.g4_female, u2.g5_male, u2.g5_female, u2.g6_male, u2.g6_female, u2.g7_male, u2.g7_female,
             u2.g8_male, u2.g8_female, u2.g9_male, u2.g9_female, u2.g10_male, u2.g10_female, u2.g11_male, u2.g11_female,
             u2.g12_male, u2.g12_female,
             u2.main_sned, u2.main_sned_male, u2.main_sned_female, u2.self_sned, u2.self_sned_male, u2.self_sned_female, u2.self_sned_org_class,
             u2.has_aral_math, u2.aral_math_learners_g1, u2.aral_math_learners_g2, u2.aral_math_learners_g3, u2.aral_math_learners_g4, u2.aral_math_learners_g5, u2.aral_math_learners_g6,
             u2.has_aral_reading, u2.aral_reading_learners_g1, u2.aral_reading_learners_g2, u2.aral_reading_learners_g3, u2.aral_reading_learners_g4, u2.aral_reading_learners_g5, u2.aral_reading_learners_g6,
             u2.has_aral_science, u2.aral_science_learners_g1, u2.aral_science_learners_g2, u2.aral_science_learners_g3, u2.aral_science_learners_g4, u2.aral_science_learners_g5, u2.aral_science_learners_g6,
             u2.multigrade_groupings_1, u2.multigrade_groupings_2, u2.multigrade_groupings_3,
             u2.multigrade_enrollment_1, u2.multigrade_enrollment_2, u2.multigrade_enrollment_3,
             u2.multigrade_groupings_1_male, u2.multigrade_groupings_1_female,
             u2.multigrade_groupings_2_male, u2.multigrade_groupings_2_female,
             u2.multigrade_groupings_3_male, u2.multigrade_groupings_3_female,
             u3.grade_kinder_size, u3.grade_1_size, u3.grade_2_size, u3.grade_3_size,
             u3.grade_4_size, u3.grade_5_size, u3.grade_6_size, u3.grade_7_size,
             u3.grade_8_size, u3.grade_9_size, u3.grade_10_size, u3.grade_11_size,
             u3.grade_12_size, u3.multigrade_size_1, u3.multigrade_size_2, u3.multigrade_size_3,
             -- Unit2: only count as completed if the unit2 table row actually exists
             (u2.iern IS NOT NULL AND u2.unit2 = TRUE) AS unit2_completed,
             CASE WHEN u2.iern IS NOT NULL AND u2.unit2 = TRUE THEN 100 ELSE 0 END AS unit2,
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
             
             -- Unit 5 Shifting & Modality
             COALESCE(u5.has_standard_shifting, ps.has_standard_shifting) AS has_standard_shifting,
             u5.has_adms AS has_adms,
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
             COALESCE(u5.unit5_completed, ps.unit5_completed) AS unit5_completed,
             CASE WHEN COALESCE(u5.unit5_completed, ps.unit5_completed) = TRUE THEN 100 ELSE 0 END AS unit5,
             (u5.iern IS NOT NULL) AS unit5_has_data
      FROM ph_schools ps
      LEFT JOIN unit2_school_learners u2 ON ps.iern = u2.iern
      LEFT JOIN unit3_organized_classes u3 ON ps.iern = u3.iern
      LEFT JOIN unit1_school_identity u1 ON ps.iern = u1.iern
      LEFT JOIN unit4_learner_profile u4 ON ps.iern = u4.iern
      LEFT JOIN unit5_shifting_modality u5 ON ps.iern = u5.iern
      WHERE ps.school_id = $1 OR ps.iern = $1
        `;
        const res = await pool.query(query, ['999163']);
        console.log("Returned row count:", res.rows.length);
        console.log("unit5_completed:", res.rows[0]?.unit5_completed);
        console.log("unit5 XP:", res.rows[0]?.unit5);
        console.log("unit5_has_data:", res.rows[0]?.unit5_has_data);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}
run();
