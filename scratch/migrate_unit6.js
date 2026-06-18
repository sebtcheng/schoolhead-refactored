import pg from 'pg';
const { Client } = pg;

const stagingConnStr = 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging';
const prodConnStr = 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd';

// Helper to safely parse JSONB fields
function safeParse(fieldValue) {
  if (!fieldValue) return {};
  if (typeof fieldValue === 'object') return fieldValue;
  try {
    return JSON.parse(fieldValue);
  } catch (e) {
    return {};
  }
}

// Safely convert string/number to integer
function safeInt(val) {
  if (val === null || val === undefined || val === '') return 0;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? 0 : parsed;
}

// Safely convert to boolean
function safeBool(val) {
  if (val === null || val === undefined) return false;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    return val.toLowerCase() === 'true' || val === '1';
  }
  return !!val;
}

async function main() {
  // --- 1. Load mappings from staging first, then close connection ---
  console.log('Connecting to Staging to load mappings...');
  const clientStagingMap = new Client({ connectionString: stagingConnStr, ssl: false });
  await clientStagingMap.connect();
  const stagingPhRes = await clientStagingMap.query('SELECT school_id, iern FROM ph_schools');
  const stagingSchoolMap = new Map();
  stagingPhRes.rows.forEach(r => {
    stagingSchoolMap.set(r.school_id, r.iern);
  });
  await clientStagingMap.end();
  console.log(`Loaded ${stagingSchoolMap.size} school mappings. Closed staging map connection.`);

  // --- 2. Fetch all school data from Production, then close connection ---
  console.log('Connecting to Production to fetch data...');
  const clientProd = new Client({ connectionString: prodConnStr, ssl: false });
  await clientProd.connect();

  console.log('Fetching legacy school resources from production...');
  const prodRes = await clientProd.query(`
    SELECT 
      school_id, iern, unit7_furniture, unit7_ict, unit7_wash, unit7_utilities, unit7_completed, unit6_updated_at
    FROM ph_schools
  `);
  console.log(`Loaded ${prodRes.rows.length} rows from production ph_schools.`);

  console.log('Fetching eCarts from production...');
  const ecartsRes = await clientProd.query(`
    SELECT school_id, iern, batches_name, year_received, sources_fund, ecart_laptops, ecart_tablets, ecart_tv, charging_condition, remarks, created_at
    FROM ph_ecart_batches
  `);
  console.log(`Loaded ${ecartsRes.rows.length} ecart batches.`);

  await clientProd.end();
  console.log('Closed Production connection.');

  // --- 3. Process data in memory ---
  console.log('Processing data in memory...');
  const resourcesRows = [];
  const gradesRows = [];
  let skippedCount = 0;

  for (const row of prodRes.rows) {
    const resolvedIern = stagingSchoolMap.get(row.school_id);
    if (!resolvedIern) {
      skippedCount++;
      continue;
    }

    const furnitureData = safeParse(row.unit7_furniture);
    const general = furnitureData.general || {};
    const gradesList = furnitureData.grades || [];

    const ict = safeParse(row.unit7_ict);
    const wash = safeParse(row.unit7_wash);
    const utilities = safeParse(row.unit7_utilities);

    const unit6_completed = safeBool(row.unit7_completed);
    const unit6_updated_at = row.unit6_updated_at || null;

    resourcesRows.push({
      iern: resolvedIern,
      school_id: row.school_id,
      iern_val: resolvedIern,
      unit6_completed,
      unit6_updated_at,
      has_general_rooms: safeBool(general.has_general_rooms),
      general_rooms_count: safeInt(general.general_rooms_count),
      armchair_wood_func: safeInt(general.armchair_wood_func),
      armchair_wood_broken: safeInt(general.armchair_wood_broken),
      armchair_plastic_func: safeInt(general.armchair_plastic_func),
      armchair_plastic_broken: safeInt(general.armchair_plastic_broken),
      armchair_plastic_steel_func: safeInt(general.armchair_plastic_steel_func),
      armchair_plastic_steel_broken: safeInt(general.armchair_plastic_steel_broken),
      individual_table_chair_func: safeInt(general.individual_table_chair_func),
      individual_table_chair_broken: safeInt(general.individual_table_chair_broken),
      two_seater_wood_func: safeInt(general.two_seater_wood_func),
      two_seater_wood_broken: safeInt(general.two_seater_wood_broken),
      two_seater_wood_steel_func: safeInt(general.two_seater_wood_steel_func),
      two_seater_wood_steel_broken: safeInt(general.two_seater_wood_steel_broken),
      wooden_chair_only_func: safeInt(general.wooden_chair_only_func),
      wooden_chair_only_broken: safeInt(general.wooden_chair_only_broken),
      plastic_chair_only_func: safeInt(general.plastic_chair_only_func),
      plastic_chair_only_broken: safeInt(general.plastic_chair_only_broken),
      has_teacher_desk: safeBool(general.has_teacher_desk),
      laptops_total: safeInt(ict.laptops_total),
      laptops_func: safeInt(ict.laptops_func),
      laptops_teaching: safeInt(ict.laptops_teaching),
      laptops_working: safeInt(ict.laptops_working),
      tablets_total: safeInt(ict.tablets_total),
      tablets_func: safeInt(ict.tablets_func),
      tablets_teaching: safeInt(ict.tablets_teaching),
      tablets_working: safeInt(ict.tablets_working),
      desktops_total: safeInt(ict.desktops_total),
      desktops_func: safeInt(ict.desktops_func),
      desktops_teaching: safeInt(ict.desktops_teaching),
      desktops_working: safeInt(ict.desktops_working),
      smart_tvs_total: safeInt(ict.smart_tvs_total),
      smart_tvs_func: safeInt(ict.smart_tvs_func),
      smart_tvs_cond: ict.smart_tvs_cond || '',
      projectors_total: safeInt(ict.projectors_total),
      projectors_func: safeInt(ict.projectors_func),
      projectors_cond: ict.projectors_cond || '',
      printers_total: safeInt(ict.printers_total),
      printers_func: safeInt(ict.printers_func),
      printers_cond: ict.printers_cond || '',
      unit7_has_ecart: false,
      male_seats_total: safeInt(wash.male_seats_total),
      male_seats_func: safeInt(wash.male_seats_func),
      male_seats_cond: wash.male_seats_cond || '',
      male_urinals_total: safeInt(wash.male_urinals_total),
      male_urinals_func: safeInt(wash.male_urinals_func),
      female_seats_total: safeInt(wash.female_seats_total),
      female_seats_func: safeInt(wash.female_seats_func),
      female_seats_cond: wash.female_seats_cond || '',
      common_seats_total: safeInt(wash.common_seats_total),
      common_seats_func: safeInt(wash.common_seats_func),
      common_seats_cond: wash.common_seats_cond || '',
      pwd_seats_total: safeInt(wash.pwd_seats_total),
      pwd_seats_func: safeInt(wash.pwd_seats_func),
      pwd_seats_cond: wash.pwd_seats_cond || '',
      faucets_total: safeInt(wash.faucets_total),
      faucets_func: safeInt(wash.faucets_func),
      faucets_cond: wash.faucets_cond || '',
      water_source: wash.water_source || '',
      confirm_no_piped: safeBool(wash.confirm_no_piped),
      confirm_no_piped_text: wash.confirm_no_piped_text || '',
      confirm_zero_wash_text: wash.confirm_zero_wash_text || '',
      attached_cr_classrooms: safeInt(wash.attached_cr_classrooms),
      attached_cr_seats: safeInt(wash.attached_cr_seats),
      attached_cr_included_in_main: safeBool(wash.attached_cr_included_in_main),
      utility_electricity: utilities.utility_electricity || '',
      confirm_no_grid: safeBool(utilities.confirm_no_grid),
      confirm_no_grid_text: utilities.confirm_no_grid_text || '',
      has_solar_or_gen: safeBool(utilities.has_solar_or_gen),
      utility_internet_yesno: utilities.utility_internet_yesno || '',
      utility_internet_type: utilities.utility_internet_type || '',
      confirm_no_wired: safeBool(utilities.confirm_no_wired),
      confirm_no_wired_text: utilities.confirm_no_wired_text || '',
      utility_internet_funder: utilities.utility_internet_funder || '',
      laptops_students: safeInt(ict.laptops_students),
      tablets_students: safeInt(ict.tablets_students),
      desktops_students: safeInt(ict.desktops_students)
    });

    if (gradesList && gradesList.length > 0) {
      for (const g of gradesList) {
        gradesRows.push({
          iern: resolvedIern,
          grade_level: g.id || g.grade_level || '',
          armchair_wood_func: safeInt(g.armchair_wood_func),
          armchair_wood_broken: safeInt(g.armchair_wood_broken),
          armchair_plastic_func: safeInt(g.armchair_plastic_func),
          armchair_plastic_broken: safeInt(g.armchair_plastic_broken),
          armchair_plastic_steel_func: safeInt(g.armchair_plastic_steel_func),
          armchair_plastic_steel_broken: safeInt(g.armchair_plastic_steel_broken),
          individual_table_chair_func: safeInt(g.individual_table_chair_func),
          individual_table_chair_broken: safeInt(g.individual_table_chair_broken),
          two_seater_wood_func: safeInt(g.two_seater_wood_func),
          two_seater_wood_broken: safeInt(g.two_seater_wood_broken),
          two_seater_wood_steel_func: safeInt(g.two_seater_wood_steel_func),
          two_seater_wood_steel_broken: safeInt(g.two_seater_wood_steel_broken),
          wooden_chair_only_func: safeInt(g.wooden_chair_only_func),
          wooden_chair_only_broken: safeInt(g.wooden_chair_only_broken),
          plastic_chair_only_func: safeInt(g.plastic_chair_only_func),
          plastic_chair_only_broken: safeInt(g.plastic_chair_only_broken),
          is_sharing: safeBool(g.is_sharing),
          shared_with: Array.isArray(g.shared_with) ? g.shared_with.join(',') : (g.shared_with || ''),
          is_kinder_double_shift: safeBool(g.is_kinder_double_shift)
        });
      }
    }
  }

  const ecartsRows = [];
  let ecartSkipped = 0;
  const schoolsWithEcarts = new Set();

  for (const row of ecartsRes.rows) {
    const resolvedIern = stagingSchoolMap.get(row.school_id);
    if (!resolvedIern) {
      ecartSkipped++;
      continue;
    }
    schoolsWithEcarts.add(row.school_id);
    ecartsRows.push({
      iern: resolvedIern,
      batches_name: row.batches_name || '',
      year_received: safeInt(row.year_received),
      sources_fund: row.sources_fund || '',
      ecart_laptops: safeInt(row.ecart_laptops),
      ecart_tablets: safeInt(row.ecart_tablets),
      ecart_tv: safeInt(row.ecart_tv),
      charging_condition: row.charging_condition || '',
      remarks: row.remarks || '',
      created_at: row.created_at || new Date()
    });
  }

  // Update unit7_has_ecart flag in memory for schools that have ecarts
  for (const r of resourcesRows) {
    if (schoolsWithEcarts.has(r.school_id)) {
      r.unit7_has_ecart = true;
    }
  }

  // --- 4. Connect to Staging only when ready to perform write operations ---
  console.log('Connecting to Staging to execute write transaction...');
  const clientStaging = new Client({ connectionString: stagingConnStr, ssl: false });
  await clientStaging.connect();

  console.log('Starting staging write transaction...');
  await clientStaging.query('BEGIN');
  try {
    // Bypass delete prevention trigger
    await clientStaging.query("SET LOCAL internal.authorized_app_deletion = 'true'");

    // Clean tables
    console.log('Clearing staging target tables...');
    await clientStaging.query('DELETE FROM unit6_ecart_batches');
    await clientStaging.query('DELETE FROM unit6_furniture_grades');
    await clientStaging.query('DELETE FROM unit6_school_resources');

    // Helper for bulk insert chunking
    const bulkInsert = async (tableName, rows, columnsList) => {
      const chunkSize = 500;
      for (let offset = 0; offset < rows.length; offset += chunkSize) {
        const chunk = rows.slice(offset, offset + chunkSize);
        const valuePlaceholders = [];
        const flatValues = [];
        let pIndex = 1;

        for (const row of chunk) {
          const placeholders = [];
          for (const col of columnsList) {
            flatValues.push(row[col]);
            placeholders.push(`$${pIndex++}`);
          }
          valuePlaceholders.push(`(${placeholders.join(', ')})`);
        }

        const sql = `
          INSERT INTO "${tableName}" (${columnsList.map(c => `"${c}"`).join(', ')})
          VALUES ${valuePlaceholders.join(', ')}
        `;
        await clientStaging.query(sql, flatValues);
      }
    };

    // Bulk insert into unit6_school_resources
    console.log(`Bulk inserting ${resourcesRows.length} rows into unit6_school_resources...`);
    const resourceCols = Object.keys(resourcesRows[0]);
    await bulkInsert('unit6_school_resources', resourcesRows, resourceCols);

    // Bulk insert into unit6_furniture_grades
    if (gradesRows.length > 0) {
      console.log(`Bulk inserting ${gradesRows.length} rows into unit6_furniture_grades...`);
      const gradeCols = Object.keys(gradesRows[0]);
      await bulkInsert('unit6_furniture_grades', gradesRows, gradeCols);
    }

    // Bulk insert into unit6_ecart_batches
    if (ecartsRows.length > 0) {
      console.log(`Bulk inserting ${ecartsRows.length} rows into unit6_ecart_batches...`);
      const ecartCols = Object.keys(ecartsRows[0]);
      await bulkInsert('unit6_ecart_batches', ecartsRows, ecartCols);
    }

    // Sync completion flags back to staging ph_schools
    console.log('Syncing completion flags back to ph_schools...');
    await clientStaging.query(`
      UPDATE ph_schools ps
      SET 
        unit6 = CASE WHEN usr.unit6_completed = TRUE THEN 100 ELSE 0 END,
        unit6_completed = usr.unit6_completed,
        unit6_updated_at = usr.unit6_updated_at
      FROM unit6_school_resources usr
      WHERE ps.school_id = usr.school_id
    `);

    await clientStaging.query('COMMIT');
    console.log('\n✅ Transaction committed successfully!');
    console.log(`- resources: ${resourcesRows.length}`);
    console.log(`- furniture grades: ${gradesRows.length}`);
    console.log(`- ecart batches: ${ecartsRows.length}`);
    console.log(`- skipped schools: ${skippedCount}`);
    console.log(`- skipped ecarts: ${ecartSkipped}`);
  } catch (err) {
    await clientStaging.query('ROLLBACK');
    console.error('❌ Staging bulk transaction failed, rolled back.', err);
  }

  await clientStaging.end();
  console.log('Closed Staging connection.');
}

main().catch(console.error);
