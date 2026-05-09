import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

const BASE_URL = 'http://localhost:3000/api';

async function test() {
  try {
    console.log("🧪 Starting Verification...");

    // 1. Test Location Endpoints
    console.log("\n--- Testing Location Endpoints ---");
    const regionsRes = await fetch(`${BASE_URL}/locations/regions`);
    const regions = await regionsRes.json();
    console.log(`Regions count: ${regions.length}`);
    if (regions.length === 0) throw new Error("No regions found");

    const divisionsRes = await fetch(`${BASE_URL}/locations/divisions?region=${encodeURIComponent(regions[0])}`);
    const divisions = await divisionsRes.json();
    console.log(`Divisions in ${regions[0]}: ${divisions.length}`);

    // 2. Test Invalid School Registration
    console.log("\n--- Testing Invalid School Registration ---");
    const invalidRes = await fetch(`${BASE_URL}/register-beta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `test_invalid_${Date.now()}@deped.gov.ph`,
        password: 'password123',
        contactNumber: '09123456789',
        firstName: 'Test',
        lastName: 'Invalid',
        schoolData: { school_id: '999999' }, // Non-existent
        passcode: '123456'
      })
    });
    const invalidData = await invalidRes.json();
    if (invalidRes.status === 404) {
      console.log(`✅ Correctly failed: ${invalidData.error}`);
    } else {
      console.error(`❌ Error: Registration with invalid school ID should have failed with 404, but got ${invalidRes.status}`);
    }

    // 3. Test Valid School Registration
    console.log("\n--- Testing Valid School Registration ---");
    // Pick a valid school ID from schools_IERN that is NOT yet in users
    const unregisteredSchool = await pool.query(`
        SELECT "SchoolID", "School_Name" 
        FROM "schools_IERN" 
        WHERE "SchoolID" NOT IN (SELECT school_id FROM users WHERE school_id IS NOT NULL) 
        LIMIT 1
    `);
    
    if (unregisteredSchool.rowCount === 0) {
        throw new Error("Could not find an unregistered school for testing.");
    }

    const schoolId = unregisteredSchool.rows[0].SchoolID;
    const schoolName = unregisteredSchool.rows[0].School_Name;
    console.log(`Using valid unregistered school: ${schoolName} (${schoolId})`);

    const email = `test_valid_${Date.now()}@deped.gov.ph`;
    const regRes = await fetch(`${BASE_URL}/register-beta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        password: 'password123',
        contactNumber: '09123456789',
        firstName: 'Test',
        lastName: 'Valid',
        schoolData: { school_id: schoolId },
        passcode: '123456'
      })
    });
    const regData = await regRes.json();
    if (regRes.ok) {
      console.log("✅ Registration successful");
    } else {
      console.error("❌ Registration failed:", regData.error);
      if (regData.details) console.error("   Details:", JSON.stringify(regData.details));
      throw new Error("Registration failed");
    }

    // 4. Verify ph_schools population
    const phRes = await pool.query('SELECT * FROM ph_schools WHERE school_id = $1', [schoolId]);
    if (phRes.rowCount > 0) {
      console.log(`✅ ph_schools record found: ${phRes.rows[0].school_name}`);
      console.log(`   Region: ${phRes.rows[0].region}`);
      console.log(`   Division: ${phRes.rows[0].division}`);
      console.log(`   District: ${phRes.rows[0].district}`);
    } else {
      console.error("❌ ph_schools record NOT found");
    }

    process.exit(0);
  } catch (err) {
    console.error("❌ Verification failed:", err.message);
    process.exit(1);
  }
}

test();
