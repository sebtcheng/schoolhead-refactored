import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging',
  ssl: false
});

const buildMgString = (gradesArray) => {
  if (!gradesArray || gradesArray.length === 0) return null;
  const labels = gradesArray.map(gId => gId.replace('g', ''));
  if (labels.length === 1) return `Grade ${labels[0]}`;
  if (labels.length === 2) return `Grade ${labels[0]} & ${labels[1]}`;
  const last = labels.pop();
  return `Grade ${labels.join(', ')} & ${last}`;
};

async function main() {
  await client.connect();
  console.log('Connected to database.');

  // Count the total rows to migrate
  const countRes = await client.query(`
    SELECT COUNT(*) 
    FROM ph_schools 
    WHERE unit2_simplified_enrollment IS NOT NULL
  `);
  const totalRows = parseInt(countRes.rows[0].count);
  console.log(`Total rows to migrate: ${totalRows}`);

  const batchSize = 1000;
  const insertChunkSize = 50; // Insert 50 rows at a time in a single statement
  let migratedCount = 0;
  let skippedCount = 0;

  for (let offset = 0; offset < totalRows; offset += batchSize) {
    // Fetch batch using primary key index order (extremely fast)
    const res = await client.query(`
      SELECT iern, school_id, unit2_simplified_enrollment 
      FROM ph_schools 
      WHERE unit2_simplified_enrollment IS NOT NULL
      ORDER BY iern
      LIMIT $1 OFFSET $2
    `, [batchSize, offset]);

    const parsedRows = [];

    for (let i = 0; i < res.rows.length; i++) {
      const row = res.rows[i];
      const resolvedIern = row.iern;
      const resolvedSchoolId = row.school_id;

      if (!resolvedIern) {
        skippedCount++;
        continue;
      }

      const payloadObj = typeof row.unit2_simplified_enrollment === 'string' 
        ? JSON.parse(row.unit2_simplified_enrollment) 
        : row.unit2_simplified_enrollment;

      const questionnaire = payloadObj.questionnaire || payloadObj || {};
      const gradeGenderMap = questionnaire.gradeGenderMap || {};

      // Fallback: populate gradeGenderMap from array if it is empty/missing
      if (Array.isArray(payloadObj.array)) {
        payloadObj.array.forEach(item => {
          if (item && item.grade_level) {
            if (!gradeGenderMap[item.grade_level]) {
              gradeGenderMap[item.grade_level] = {
                male: (item.male ?? 0).toString(),
                female: (item.female ?? 0).toString()
              };
            }
          }
        });
      }

      const gradeKeys = ['kinder', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11', 'g12'];
      const extracted = {};
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

      const snedSelfContainedMale = parseInt(gradeGenderMap['sned_self_contained']?.male) || parseInt(gradeGenderMap['sned']?.male) || 0;
      const snedSelfContainedFemale = parseInt(gradeGenderMap['sned_self_contained']?.female) || parseInt(gradeGenderMap['sned']?.female) || 0;
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
      const self_sned_org_class = parseInt(questionnaire.snedOrganizedClassCount) || 0;

      // ARAL Demographics
      const has_aral_math = questionnaire.hasAralMath || false;
      const mathMap = questionnaire.aralMath || {};
      const has_aral_reading = questionnaire.hasAralReading || false;
      const readingMap = questionnaire.aralReading || {};
      const has_aral_science = questionnaire.hasAralScience || false;
      const scienceMap = questionnaire.aralScience || {};

      const aralFields = {};
      for (let g = 1; g <= 6; g++) {
        aralFields[`aral_math_learners_g${g}`] = parseInt(mathMap[`g${g}`]) || 0;
        aralFields[`aral_reading_learners_g${g}`] = parseInt(readingMap[`g${g}`]) || 0;
        aralFields[`aral_science_learners_g${g}`] = parseInt(scienceMap[`g${g}`]) || 0;
      }

      // Multigrade
      const mgCombinations = questionnaire.mgCombinations || [];
      const gradeTotals = questionnaire.gradeTotals || {};

      const mg_1 = mgCombinations.length > 0 ? buildMgString(mgCombinations[0].grades) : null;
      const mg_2 = mgCombinations.length > 1 ? buildMgString(mgCombinations[1].grades) : null;
      const mg_3 = mgCombinations.length > 2 ? buildMgString(mgCombinations[2].grades) : null;

      const mg_1_enrollment = mgCombinations.length > 0 ? mgCombinations[0].grades.reduce((sum, g) => sum + (parseInt(gradeTotals[g]) || 0), 0) : 0;
      const mg_2_enrollment = mgCombinations.length > 1 ? mgCombinations[1].grades.reduce((sum, g) => sum + (parseInt(gradeTotals[g]) || 0), 0) : 0;
      const mg_3_enrollment = mgCombinations.length > 2 ? mgCombinations[2].grades.reduce((sum, g) => sum + (parseInt(gradeTotals[g]) || 0), 0) : 0;

      const mg_1_male = mgCombinations.length > 0 ? mgCombinations[0].grades.reduce((sum, g) => sum + (parseInt(gradeGenderMap[g]?.male) || 0), 0) : 0;
      const mg_1_female = mgCombinations.length > 0 ? mgCombinations[0].grades.reduce((sum, g) => sum + (parseInt(gradeGenderMap[g]?.female) || 0), 0) : 0;
      const mg_2_male = mgCombinations.length > 1 ? mgCombinations[1].grades.reduce((sum, g) => sum + (parseInt(gradeGenderMap[g]?.male) || 0), 0) : 0;
      const mg_2_female = mgCombinations.length > 1 ? mgCombinations[1].grades.reduce((sum, g) => sum + (parseInt(gradeGenderMap[g]?.female) || 0), 0) : 0;
      const mg_3_male = mgCombinations.length > 2 ? mgCombinations[2].grades.reduce((sum, g) => sum + (parseInt(gradeGenderMap[g]?.male) || 0), 0) : 0;
      const mg_3_female = mgCombinations.length > 2 ? mgCombinations[2].grades.reduce((sum, g) => sum + (parseInt(gradeGenderMap[g]?.female) || 0), 0) : 0;

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
        
        main_sned,
        main_sned_male,
        main_sned_female,
        self_sned,
        self_sned_male,
        self_sned_female,
        self_sned_org_class,

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

        multigrade_groupings_1: mg_1,
        multigrade_groupings_2: mg_2,
        multigrade_groupings_3: mg_3,
        multigrade_enrollment_1: mg_1_enrollment,
        multigrade_enrollment_2: mg_2_enrollment,
        multigrade_enrollment_3: mg_3_enrollment,
        multigrade_groupings_1_male: mg_1_male,
        multigrade_groupings_1_female: mg_1_female,
        multigrade_groupings_2_male: mg_2_male,
        multigrade_groupings_2_female: mg_2_female,
        multigrade_groupings_3_male: mg_3_male,
        multigrade_groupings_3_female: mg_3_female,
        unit2: true,
        unit2_completed: 100.00
      };

      parsedRows.push({ resolvedIern, resolvedSchoolId, updateFields });
    }

    // Execute multi-row bulk insert in chunks of 50
    const keys = Object.keys(parsedRows[0].updateFields);
    
    for (let c = 0; c < parsedRows.length; c += insertChunkSize) {
      const chunk = parsedRows.slice(c, c + insertChunkSize);
      
      const values = [];
      const rowPlaceholders = [];
      let paramIdx = 1;

      for (let r = 0; r < chunk.length; r++) {
        const item = chunk[r];
        const placeholders = [];
        
        values.push(item.resolvedIern, item.resolvedSchoolId);
        placeholders.push(`$${paramIdx++}`, `$${paramIdx++}`);
        
        for (const key of keys) {
          values.push(item.updateFields[key]);
          placeholders.push(`$${paramIdx++}`);
        }
        
        rowPlaceholders.push(`(${placeholders.join(', ')})`);
      }

      const query = `
        INSERT INTO unit2_school_learners ("iern", "school_id", ${keys.map(k => `"${k}"`).join(', ')})
        VALUES ${rowPlaceholders.join(',\n')}
        ON CONFLICT (iern) DO UPDATE SET
          ${keys.map(k => `"${k}" = EXCLUDED."${k}"`).join(', ')},
          updated_at = CURRENT_TIMESTAMP
      `;

      try {
        await client.query(query, values);
        migratedCount += chunk.length;
      } catch (dbErr) {
        console.error(`Chunk insert failed. Falling back to individual inserts... Error:`, dbErr.message);
        
        // Fallback to individual inserts for this chunk
        for (const item of chunk) {
          const singlePlaceholders = ['$1', '$2', ...keys.map((_, idx) => `$${idx + 3}`)].join(', ');
          const singleQuery = `
            INSERT INTO unit2_school_learners ("iern", "school_id", ${keys.map(k => `"${k}"`).join(', ')})
            VALUES (${singlePlaceholders})
            ON CONFLICT (iern) DO UPDATE SET
              ${keys.map(k => `"${k}" = EXCLUDED."${k}"`).join(', ')},
              updated_at = CURRENT_TIMESTAMP
          `;
          const singleValues = [item.resolvedIern, item.resolvedSchoolId, ...keys.map(k => item.updateFields[k])];
          try {
            await client.query(singleQuery, singleValues);
            migratedCount++;
          } catch (singleErr) {
            console.error(`Error migrating school_id ${item.resolvedSchoolId} individually:`, singleErr.message);
            skippedCount++;
          }
        }
      }
    }

    console.log(`Processed batch ${offset / batchSize + 1}/${Math.ceil(totalRows / batchSize)}. Migrated: ${migratedCount}. Skipped: ${skippedCount}.`);
  }

  console.log(`Migration finished. Successfully migrated: ${migratedCount}. Skipped: ${skippedCount}.`);
  await client.end();
}

main().catch(async (e) => {
  console.error(e);
  await client.end();
});
