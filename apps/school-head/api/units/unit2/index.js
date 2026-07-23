import express from 'express';
import { safeQuery, pool } from '../../utils/db.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// [QUEST] UNIT 2: LEARNERS (ENROLLMENT)
// ─────────────────────────────────────────────────────────────────────────────
router.put('/api/ph_schools/unit2/:id', async (req, res) => {
    const schoolId = req.params.id;
    const data = req.body;

    try {
        // Resolve IERN and School ID from core registry if not fully provided
        let resolvedIern = data.iern;
        let resolvedSchoolId = schoolId;
        
        const schoolRes = await safeQuery('SELECT iern, school_id FROM ph_schools WHERE school_id = $1 OR iern = $1 LIMIT 1', [schoolId]);
        if (schoolRes.rows[0]) {
            resolvedIern = schoolRes.rows[0].iern;
            resolvedSchoolId = schoolRes.rows[0].school_id;
        } else {
            const iernRes = await safeQuery('SELECT "IERN" as iern, "SchoolID" as school_id FROM "schools_IERN" WHERE "SchoolID" = $1 OR "IERN" = $1 LIMIT 1', [schoolId]);
            if (iernRes.rows[0]) {
                resolvedIern = iernRes.rows[0].iern;
                resolvedSchoolId = iernRes.rows[0].school_id;
            }
        }

        if (!resolvedIern) {
            return res.status(404).json({ error: "School not found in core registry" });
        }

        const gradeGenderMap = data.gradeGenderMap || {};
        
        // Extracted columns mapping
        const extracted = {};
        const gradeKeys = ['kinder', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11', 'g12'];
        
        let totalMale = 0;
        let totalFemale = 0;

        gradeKeys.forEach(gk => {
            const m = parseInt(gradeGenderMap[gk]?.male) || 0;
            const f = parseInt(gradeGenderMap[gk]?.female) || 0;
            
            totalMale += m;
            totalFemale += f;
            
            extracted[`${gk}_male`] = m;
            extracted[`${gk}_female`] = f;
            extracted[`enroll_${gk}`] = m + f;
        });

        // Add self-contained SNED to total male/female sum
        const snedSelfContainedMale = parseInt(gradeGenderMap['sned_self_contained']?.male) || 0;
        const snedSelfContainedFemale = parseInt(gradeGenderMap['sned_self_contained']?.female) || 0;
        totalMale += snedSelfContainedMale;
        totalFemale += snedSelfContainedFemale;

        extracted['total_male'] = totalMale;
        extracted['total_female'] = totalFemale;
        extracted['total_enrollment'] = totalMale + totalFemale;
        extracted['male_enrollment'] = totalMale;
        extracted['female_enrollment'] = totalFemale;

        // Detailed SNED Demographics
        const main_sned_male = parseInt(gradeGenderMap['sned_mainstreamed']?.male) || 0;
        const main_sned_female = parseInt(gradeGenderMap['sned_mainstreamed']?.female) || 0;
        const main_sned = main_sned_male + main_sned_female;

        const self_sned_male = snedSelfContainedMale;
        const self_sned_female = snedSelfContainedFemale;
        const self_sned = self_sned_male + self_sned_female;
        
        // Questionnaire context helper
        const questionnaire = data.unit2_simplified_enrollment?.questionnaire || data.unit2_simplified_enrollment || {};
        const self_sned_org_class = parseInt(data.sned_organized_class_count) || parseInt(questionnaire.snedOrganizedClassCount) || 0;

        // Flattened ARAL Demographics (checks both top-level and nested questionnaire context)
        const has_aral_math = data.has_aral_math || data.hasAralMath || questionnaire.hasAralMath || false;
        const mathMap = data.aralMath || questionnaire.aralMath || {};
        
        const has_aral_reading = data.has_aral_reading || data.hasAralReading || questionnaire.hasAralReading || false;
        const readingMap = data.aralReading || questionnaire.aralReading || {};
        
        const has_aral_science = data.has_aral_science || data.hasAralScience || questionnaire.hasAralScience || false;
        const scienceMap = data.aralScience || questionnaire.aralScience || {};

        const aralFields = {};
        for (let g = 1; g <= 6; g++) {
            aralFields[`aral_math_learners_g${g}`] = parseInt(mathMap[`g${g}`]) || 0;
            aralFields[`aral_reading_learners_g${g}`] = parseInt(readingMap[`g${g}`]) || 0;
            aralFields[`aral_science_learners_g${g}`] = parseInt(scienceMap[`g${g}`]) || 0;
        }

        // Populate table fields
        const updateFields = {
            enroll_kinder: extracted['enroll_kinder'],
            enroll_g1: extracted['enroll_g1'],
            enroll_g2: extracted['enroll_g2'],
            enroll_g3: extracted['enroll_g3'],
            enroll_g4: extracted['enroll_g4'],
            enroll_g5: extracted['enroll_g5'],
            enroll_g6: extracted['enroll_g6'],
            enroll_g7: extracted['enroll_g7'],
            enroll_g8: extracted['enroll_g8'],
            enroll_g9: extracted['enroll_g9'],
            enroll_g10: extracted['enroll_g10'],
            enroll_g11: extracted['enroll_g11'],
            enroll_g12: extracted['enroll_g12'],
            total_enrollment: extracted['total_enrollment'],
            male_enrollment: extracted['male_enrollment'],
            female_enrollment: extracted['female_enrollment'],
            total_male: extracted['total_male'],
            total_female: extracted['total_female'],
            kinder_male: extracted['kinder_male'],
            kinder_female: extracted['kinder_female'],
            g1_male: extracted['g1_male'],
            g1_female: extracted['g1_female'],
            g2_male: extracted['g2_male'],
            g2_female: extracted['g2_female'],
            g3_male: extracted['g3_male'],
            g3_female: extracted['g3_female'],
            g4_male: extracted['g4_male'],
            g4_female: extracted['g4_female'],
            g5_male: extracted['g5_male'],
            g5_female: extracted['g5_female'],
            g6_male: extracted['g6_male'],
            g6_female: extracted['g6_female'],
            g7_male: extracted['g7_male'],
            g7_female: extracted['g7_female'],
            g8_male: extracted['g8_male'],
            g8_female: extracted['g8_female'],
            g9_male: extracted['g9_male'],
            g9_female: extracted['g9_female'],
            g10_male: extracted['g10_male'],
            g10_female: extracted['g10_female'],
            g11_male: extracted['g11_male'],
            g11_female: extracted['g11_female'],
            g12_male: extracted['g12_male'],
            g12_female: extracted['g12_female'],
            
            // New SNED fields
            main_sned,
            main_sned_male,
            main_sned_female,
            self_sned,
            self_sned_male,
            self_sned_female,
            self_sned_org_class,

            // New ARAL fields
            has_aral_math,
            aral_math_learners_g1: aralFields.aral_math_learners_g1,
            aral_math_learners_g2: aralFields.aral_math_learners_g2,
            aral_math_learners_g3: aralFields.aral_math_learners_g3,
            aral_math_learners_g4: aralFields.aral_math_learners_g4,
            aral_math_learners_g5: aralFields.aral_math_learners_g5,
            aral_math_learners_g6: aralFields.aral_math_learners_g6,

            has_aral_reading,
            aral_reading_learners_g1: aralFields.aral_reading_learners_g1,
            aral_reading_learners_g2: aralFields.aral_reading_learners_g2,
            aral_reading_learners_g3: aralFields.aral_reading_learners_g3,
            aral_reading_learners_g4: aralFields.aral_reading_learners_g4,
            aral_reading_learners_g5: aralFields.aral_reading_learners_g5,
            aral_reading_learners_g6: aralFields.aral_reading_learners_g6,
            has_aral_science,
            aral_science_learners_g1: aralFields.aral_science_learners_g1,
            aral_science_learners_g2: aralFields.aral_science_learners_g2,
            aral_science_learners_g3: aralFields.aral_science_learners_g3,
            aral_science_learners_g4: aralFields.aral_science_learners_g4,
            aral_science_learners_g5: aralFields.aral_science_learners_g5,
            aral_science_learners_g6: aralFields.aral_science_learners_g6,

            multigrade_groupings_1: data.multigrade_groupings_1 || null,
            multigrade_groupings_2: data.multigrade_groupings_2 || null,
            multigrade_groupings_3: data.multigrade_groupings_3 || null,
            multigrade_enrollment_1: parseInt(data.multigrade_enrollment_1) || 0,
            multigrade_enrollment_2: parseInt(data.multigrade_enrollment_2) || 0,
            multigrade_enrollment_3: parseInt(data.multigrade_enrollment_3) || 0,
            multigrade_groupings_1_male: parseInt(data.multigrade_groupings_1_male) || 0,
            multigrade_groupings_1_female: parseInt(data.multigrade_groupings_1_female) || 0,
            multigrade_groupings_2_male: parseInt(data.multigrade_groupings_2_male) || 0,
            multigrade_groupings_2_female: parseInt(data.multigrade_groupings_2_female) || 0,
            multigrade_groupings_3_male: parseInt(data.multigrade_groupings_3_male) || 0,
            multigrade_groupings_3_female: parseInt(data.multigrade_groupings_3_female) || 0,
            unit2: true, // Boolean as requested
            unit2_completed: 100.00, // Numeric percentage as requested
            unit_2_updated_at: new Date()
        };

        const school_yr = data.school_yr || 'SY 26-27';

        const keys = Object.keys(updateFields);
        const columnsStr = ['iern', 'school_id', 'school_yr', ...keys].map(c => `"${c}"`).join(', ');
        const placeholders = ['iern', 'school_id', 'school_yr', ...keys].map((_, idx) => `$${idx + 1}`).join(', ');
        const updateClause = keys.map(f => `"${f}" = EXCLUDED."${f}"`).join(', ');

        const query = `
            INSERT INTO unit2_school_learners (${columnsStr})
            VALUES (${placeholders})
            ON CONFLICT (iern, school_yr) DO UPDATE SET
                ${updateClause},
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `;

        const values = [resolvedIern, resolvedSchoolId, school_yr, ...keys.map(k => updateFields[k])];
        const result = await safeQuery(query, values);



        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error("Unit 2 Update Error:", err);
        res.status(500).json({ error: err.message });
    }
});

export { router as unit2Router };
export default router;
