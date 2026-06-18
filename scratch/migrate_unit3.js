import pg from 'pg';
const { Client } = pg;

const clientStaging = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging',
  ssl: false
});

const clientProd = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd',
  ssl: false
});

const getClassSizeOptions = (className) => {
  const name = (className || "").toLowerCase().trim();
  
  if (name.includes("&") || name.includes("joined") || name.includes("multigrade")) {
    return ["< 25 learners", "25 learners", "> 25 learners"];
  }
  if (name.includes("kinder")) {
    return ["< 25 learners", "25-30 learners", "> 30 learners"];
  }
  if (name === "grade 1" || name === "grade 2" || name === "grade 3") {
    return ["< 30 learners", "30-35 learners", "> 35 learners"];
  }
  if (name === "grade 11" || name === "grade 12") {
    return ["< 45 learners", "45 learners", "> 45 learners"];
  }
  return ["< 40 learners", "40-45 learners", "> 45 learners"];
};

const getGradeLabel = (gId) => {
  if (gId === 'kinder') return 'Kindergarten';
  if (gId.startsWith('g')) return `Grade ${gId.replace('g', '')}`;
  return gId;
};

async function main() {
  await clientStaging.connect();
  await clientProd.connect();
  console.log('Connected to both Staging and Production databases.');

  // 1. Fetch the 43 schools with unit3_simplified_counts from production
  console.log('Fetching legacy unit3_simplified_counts from production...');
  const prodRes = await clientProd.query(`
    SELECT school_id, iern, unit3_simplified_counts 
    FROM ph_schools 
    WHERE unit3_simplified_counts IS NOT NULL
  `);
  console.log(`Found ${prodRes.rows.length} schools with simplified class counts in production.`);

  // 2. Fetch all completed Unit 3 schools from staging ph_schools
  const stagingCompletedRes = await clientStaging.query(`
    SELECT school_id, iern 
    FROM ph_schools 
    WHERE unit3_completed = TRUE OR unit3 = 100
  `);
  console.log(`Found ${stagingCompletedRes.rows.length} completed Unit 3 schools in staging.`);

  // 3. Fetch all completed Unit 3 schools from production ph_schools
  const prodCompletedRes = await clientProd.query(`
    SELECT school_id, iern 
    FROM ph_schools 
    WHERE unit3_completed = TRUE OR unit3 = 100
  `);
  console.log(`Found ${prodCompletedRes.rows.length} completed Unit 3 schools in production.`);

  // Build a union map of school_id -> { school_id, iern }
  const schoolMap = new Map();
  
  stagingCompletedRes.rows.forEach(r => {
    schoolMap.set(r.school_id, { school_id: r.school_id, iern: r.iern });
  });

  prodCompletedRes.rows.forEach(r => {
    if (!schoolMap.has(r.school_id)) {
      schoolMap.set(r.school_id, { school_id: r.school_id, iern: r.iern });
    } else {
      const existing = schoolMap.get(r.school_id);
      if (!existing.iern && r.iern) {
        existing.iern = r.iern;
      }
    }
  });

  prodRes.rows.forEach(r => {
    if (!schoolMap.has(r.school_id)) {
      schoolMap.set(r.school_id, { school_id: r.school_id, iern: r.iern });
    } else {
      const existing = schoolMap.get(r.school_id);
      if (!existing.iern && r.iern) {
        existing.iern = r.iern;
      }
    }
  });

  const allCompletedSchools = Array.from(schoolMap.values());
  console.log(`Total unique schools to process (union of completed/data): ${allCompletedSchools.length}`);

  // Create a map of school_id/iern to check who has simplified counts
  const prodDataMap = new Map();
  prodRes.rows.forEach(r => {
    prodDataMap.set(r.school_id, r);
  });

  let migratedWithDataCount = 0;
  let migratedBaselineCount = 0;
  let skippedCount = 0;

  const insertChunkSize = 100;
  const parsedRows = [];

  for (const school of allCompletedSchools) {
    const resolvedSchoolId = school.school_id;
    let resolvedIern = null;

    // Resolve IERN directly from staging ph_schools to ensure foreign key match
    const stagingPhRes = await clientStaging.query(
      'SELECT iern FROM ph_schools WHERE school_id = $1 LIMIT 1',
      [resolvedSchoolId]
    );

    if (stagingPhRes.rows.length === 0) {
      skippedCount++;
      continue;
    }

    resolvedIern = stagingPhRes.rows[0].iern;

    if (resolvedIern === null || resolvedIern === undefined) {
      skippedCount++;
      continue;
    }

    // Default fields
    const updateFields = {
      grade_kinder_size: null,
      grade_1_size: null,
      grade_2_size: null,
      grade_3_size: null,
      grade_4_size: null,
      grade_5_size: null,
      grade_6_size: null,
      grade_7_size: null,
      grade_8_size: null,
      grade_9_size: null,
      grade_10_size: null,
      grade_11_size: null,
      grade_12_size: null,
      multigrade_size_1: null,
      multigrade_size_2: null,
      multigrade_size_3: null,
      unit3: true,
      unit3_completed: 100.00
    };

    // If this school has production simplified counts, map them!
    if (prodDataMap.has(resolvedSchoolId)) {
      const prodRow = prodDataMap.get(resolvedSchoolId);
      const countsArray = typeof prodRow.unit3_simplified_counts === 'string'
        ? JSON.parse(prodRow.unit3_simplified_counts)
        : prodRow.unit3_simplified_counts;

      // Query multigrade groupings from unit2_school_learners in staging
      const u2Res = await clientStaging.query(`
        SELECT multigrade_groupings_1, multigrade_groupings_2, multigrade_groupings_3 
        FROM unit2_school_learners 
        WHERE iern = $1
      `, [resolvedIern]);

      const groupings = u2Res.rows[0] || {};

      if (Array.isArray(countsArray)) {
        countsArray.forEach(item => {
          const gId = item.grade_level;
          let label = '';
          let isMultigrade = false;
          let mgIdx = 0;

          if (gId.startsWith('mg_')) {
            isMultigrade = true;
            mgIdx = parseInt(gId.split('_')[1]) || 1;
            label = groupings[`multigrade_groupings_${mgIdx}`] || 'multigrade';
          } else {
            label = getGradeLabel(gId);
          }

          const options = getClassSizeOptions(label);
          
          let parts = [];
          if (item.col_below > 0) parts.push(`${item.col_below} (${options[0]})`);
          if (item.col_within > 0) parts.push(`${item.col_within} (${options[1]})`);
          if (item.col_above > 0) parts.push(`${item.col_above} (${options[2]})`);
          const sSize = parts.length > 0 ? parts.join(', ') : null;

          if (isMultigrade) {
            updateFields[`multigrade_size_${mgIdx}`] = sSize;
          } else {
            if (gId === 'kinder') {
              updateFields.grade_kinder_size = sSize;
            } else if (gId.startsWith('g')) {
              const num = gId.replace('g', '');
              if (updateFields.hasOwnProperty(`grade_${num}_size`)) {
                updateFields[`grade_${num}_size`] = sSize;
              }
            }
          }
        });
      }
      migratedWithDataCount++;
    } else {
      migratedBaselineCount++;
    }

    parsedRows.push({ resolvedIern, resolvedSchoolId, updateFields });
  }

  // Execute bulk inserts in chunks
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
      INSERT INTO unit3_organized_classes ("iern", "school_id", ${keys.map(k => `"${k}"`).join(', ')})
      VALUES ${rowPlaceholders.join(',\n')}
      ON CONFLICT (iern) DO UPDATE SET
        ${keys.map(k => `"${k}" = EXCLUDED."${k}"`).join(', ')},
        updated_at = CURRENT_TIMESTAMP
    `;

    try {
      await clientStaging.query(query, values);
    } catch (dbErr) {
      console.error(`Chunk insert failed. Falling back to individual inserts... Error:`, dbErr.message);
      
      // Fallback
      for (const item of chunk) {
        const singlePlaceholders = ['$1', '$2', ...keys.map((_, idx) => `$${idx + 3}`)].join(', ');
        const singleQuery = `
          INSERT INTO unit3_organized_classes ("iern", "school_id", ${keys.map(k => `"${k}"`).join(', ')})
          VALUES (${singlePlaceholders})
          ON CONFLICT (iern) DO UPDATE SET
            ${keys.map(k => `"${k}" = EXCLUDED."${k}"`).join(', ')},
            updated_at = CURRENT_TIMESTAMP
        `;
        const singleValues = [item.resolvedIern, item.resolvedSchoolId, ...keys.map(k => item.updateFields[k])];
        try {
          await clientStaging.query(singleQuery, singleValues);
        } catch (singleErr) {
          console.error(`Error migrating school_id ${item.resolvedSchoolId} individually:`, singleErr.message);
        }
      }
    }
  }

  console.log(`Migration finished.`);
  console.log(`Successfully migrated with JSON data: ${migratedWithDataCount}`);
  console.log(`Successfully migrated baselines: ${migratedBaselineCount}`);
  console.log(`Skipped: ${skippedCount}`);

  await clientStaging.end();
  await clientProd.end();
}

main().catch(async (e) => {
  console.error(e);
  await clientStaging.end();
  await clientProd.end();
});
