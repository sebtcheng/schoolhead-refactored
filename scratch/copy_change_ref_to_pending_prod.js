import pg from 'pg';
const { Client, Pool } = pg;

const prodConnectionString = 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd';

async function copyData() {
  const prodClient = new Client({
    connectionString: prodConnectionString,
    ssl: { rejectUnauthorized: false }
  });

  const prodPool = new Pool({
    connectionString: prodConnectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("Connecting to production database to read schoolid_change_reference...");
    await prodClient.connect();

    const refRes = await prodClient.query('SELECT * FROM schoolid_change_reference;');
    console.log(`Successfully read ${refRes.rows.length} rows from production.`);

    console.log("Fetching existing school IDs from production database...");
    const schoolsRes = await prodPool.query('SELECT school_id FROM ph_schools;');
    const pendingRes = await prodPool.query('SELECT school_id FROM pending_schools;');
    
    const existingSchoolIds = new Set([
      ...schoolsRes.rows.map(r => r.school_id),
      ...pendingRes.rows.map(r => r.school_id)
    ]);
    console.log(`Production database has ${schoolsRes.rows.length} schools and ${pendingRes.rows.length} pending schools.`);

    // Fetch an admin user UUID to use as submitted_by
    const userRes = await prodPool.query("SELECT uid FROM users WHERE role = 'admin' LIMIT 1;");
    let adminUid = '00000000-0000-0000-0000-000000000000'; // Default fallback UUID
    if (userRes.rows.length > 0) {
      adminUid = userRes.rows[0].uid;
      console.log(`Using admin UUID: ${adminUid}`);
    } else {
      console.log(`No admin found in users table, using fallback UUID.`);
    }

    let insertCount = 0;
    let skipCount = 0;

    for (const row of refRes.rows) {
      const schoolId = String(row.new_school_id);
      
      // Filter out test schools starting with 999
      if (schoolId.startsWith('999')) {
        skipCount++;
        continue;
      }

      // Check for duplicates
      if (existingSchoolIds.has(schoolId)) {
        skipCount++;
        continue;
      }

      const prevSchoolId = row.prev_school_id;
      const isNew = prevSchoolId === 'New school';
      const regType = isNew ? 'newly-established' : 'conversion';
      const oldSchoolId = isNew ? null : prevSchoolId;

      console.log(`Inserting: ${schoolId} - ${row.school_name} (${regType})`);

      await prodPool.query(
        `INSERT INTO pending_schools 
          (registration_type, old_school_id, school_id, school_name, region, division, submitted_by, status, is_deleted, submitted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          regType,
          oldSchoolId,
          schoolId,
          row.school_name,
          row.region,
          row.division,
          adminUid,
          'pending',
          false
        ]
      );
      insertCount++;
    }

    console.log(`\nSync Summary:`);
    console.log(`- Inserted into pending_schools: ${insertCount}`);
    console.log(`- Skipped (duplicates or test schools starting with 999): ${skipCount}`);

  } catch (err) {
    console.error("Error copying data:", err);
  } finally {
    await prodClient.end();
    await prodPool.end();
  }
}

copyData();
