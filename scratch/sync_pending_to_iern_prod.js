import pg from 'pg';
const { Pool } = pg;

const prodConnectionString = 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd';

async function syncPendingToIern() {
  const prodPool = new Pool({
    connectionString: prodConnectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("=== STEP 1: FETCHING CURRENT REFERENCE DATA FROM PROD ===");
    
    // Fetch all existing school ID to IERN mappings
    const refRes = await prodPool.query('SELECT "SchoolID", "IERN", "status" FROM "schools_IERN";');
    
    const iernMapBySchoolId = new Map(); // SchoolID -> Row
    const existingSchoolIds = new Set();
    const allIerns = [];

    for (const row of refRes.rows) {
      iernMapBySchoolId.set(row.SchoolID, row);
      existingSchoolIds.add(row.SchoolID);
      if (row.IERN) {
        allIerns.push(row.IERN);
      }
    }
    console.log(`Loaded ${iernMapBySchoolId.size} existing schools from schools_IERN.`);

    // Find the last numeric IERN suffix for 2026-
    let maxSuffix = 0;
    for (const iern of allIerns) {
      if (iern.startsWith('2026-')) {
        const suffixStr = iern.substring(5);
        if (/^\d+$/.test(suffixStr)) {
          const suffixNum = parseInt(suffixStr, 10);
          if (suffixNum > maxSuffix) {
            maxSuffix = suffixNum;
          }
        }
      }
    }
    console.log(`Last numeric IERN suffix found: ${maxSuffix}`);

    // Fetch the next ID for schools_IERN in case the column id is not auto-incrementing
    const maxIdRes = await prodPool.query('SELECT MAX(id) FROM "schools_IERN";');
    let nextId = (maxIdRes.rows[0].max || 0) + 1;
    console.log(`Next primary key id for schools_IERN: ${nextId}`);

    console.log("\n=== STEP 2: FETCHING PENDING SCHOOLS FROM PROD ===");
    // Fetch pending schools, filtering out 999... test schools
    const pendingRes = await prodPool.query(`
      SELECT * FROM pending_schools 
      WHERE school_id NOT LIKE '999%' 
        AND status = 'pending' 
        AND (is_deleted IS NOT TRUE);
    `);
    console.log(`Found ${pendingRes.rows.length} pending schools to process.`);

    let insertedCount = 0;
    let archivedCount = 0;
    let skippedCount = 0;

    for (const pending of pendingRes.rows) {
      const schoolId = pending.school_id;

      // Duplicate check: if the school ID already exists in schools_IERN, skip
      if (existingSchoolIds.has(schoolId)) {
        console.log(`⚠️ School ID ${schoolId} already exists in schools_IERN. Skipping.`);
        skippedCount++;
        continue;
      }

      let iernToUse = null;
      let isConversion = pending.registration_type === 'conversion' || pending.old_school_id;
      let oldSchoolRow = null;

      if (isConversion && pending.old_school_id) {
        oldSchoolRow = iernMapBySchoolId.get(pending.old_school_id);
        if (oldSchoolRow) {
          iernToUse = oldSchoolRow.IERN;
        } else {
          console.log(`⚠️ Conversion old_school_id ${pending.old_school_id} not found in schools_IERN. Treating as newly established.`);
        }
      }

      // If newly established or old school IERN not found, generate a new IERN
      if (!iernToUse) {
        maxSuffix++;
        iernToUse = `2026-${maxSuffix}`;
        console.log(`✨ Generated new IERN ${iernToUse} for school ${schoolId} (${pending.school_name})`);
      } else {
        console.log(`🔄 Reusing existing IERN ${iernToUse} for converted school ${schoolId} (${pending.school_name})`);
      }

      // Insert new school into schools_IERN
      await prodPool.query(`
        INSERT INTO "schools_IERN" (
          id, "IERN", "SchoolID", "Region", "Division", "District", "School_Name", "Barangay", 
          "Latitude", "Longitude", "Curricular_Offering", "Street_Address", "Mother_School_ID", 
          "Province", "Municipality", "Legislative_District", status, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
      `, [
        nextId++,
        iernToUse,
        schoolId,
        pending.region,
        pending.division,
        pending.district,
        pending.school_name,
        pending.barangay,
        pending.latitude,
        pending.longitude,
        pending.curricular_offering,
        pending.street_address,
        pending.mother_school_id,
        pending.province,
        pending.municipality,
        pending.leg_district,
        'Active'
      ]);
      insertedCount++;

      // Archive the old school if this was a conversion
      if (oldSchoolRow) {
        const updateRes = await prodPool.query(
          'UPDATE "schools_IERN" SET status = \'Archived\' WHERE "SchoolID" = $1 AND status != \'Archived\' RETURNING "School_Name";',
          [pending.old_school_id]
        );
        if (updateRes.rows.length > 0) {
          console.log(`🗄️ Archived old school: ${pending.old_school_id} - ${updateRes.rows[0].School_Name}`);
          archivedCount++;
        }
      }
    }

    console.log(`\n=== SYNC SUMMARY ===`);
    console.log(`- Inserted new active schools: ${insertedCount}`);
    console.log(`- Archived old schools: ${archivedCount}`);
    console.log(`- Skipped (already exist): ${skippedCount}`);

  } catch (err) {
    console.error("Error running migration:", err);
  } finally {
    await prodPool.end();
  }
}

syncPendingToIern();
