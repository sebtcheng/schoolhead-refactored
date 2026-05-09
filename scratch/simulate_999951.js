import pg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

async function simulateRegistration() {
  const email = `test_${Date.now()}@insighted.test`;
  const school_id = '999951';
  const password = 'password123';
  const firstName = 'Test';
  const lastName = 'User';
  const contactNumber = '09171234567';

  try {
    console.log("🚀 Starting simulation for 999951...");
    
    // 1. Fetch Master
    const masterRes = await pool.query('SELECT * FROM "schools_IERN" WHERE "SchoolID" = $1 LIMIT 1', [school_id]);
    if (masterRes.rowCount === 0) {
      console.error("❌ School ID not found in Master");
      return;
    }
    const master = masterRes.rows[0];
    const iern = master.IERN || school_id;

    // 2. Hash Password
    const passwordHash = await bcrypt.hash(password, 10);
    const uid = uuidv4();

    // 3. Insert User
    const userQuery = `
      INSERT INTO users (
        uid, email, password_hash, hash_version, role, first_name, last_name,
        school_id, iern, contact_number, region, division, province, city, barangay,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP)
    `;
    const userValues = [
      uid, email.toLowerCase(), passwordHash, 'bcrypt', 'School Head', firstName, lastName,
      school_id, iern, contactNumber,
      master.Region, master.Division, master.Province, 
      master.Municipality, master.Barangay
    ];
    await pool.query(userQuery, userValues);
    console.log("✅ User inserted");

    // 4. Hydrate ph_schools
    const schoolQuery = `
        INSERT INTO ph_schools (
          school_id, iern, school_name, region, division, province, municipality, barangay, district, leg_district, curricular_offering, latitude, longitude, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
        ON CONFLICT (school_id) DO UPDATE SET 
          iern = EXCLUDED.iern,
          school_name = EXCLUDED.school_name,
          region = EXCLUDED.region,
          division = EXCLUDED.division,
          province = EXCLUDED.province,
          municipality = EXCLUDED.municipality,
          barangay = EXCLUDED.barangay,
          district = EXCLUDED.district,
          leg_district = EXCLUDED.leg_district,
          curricular_offering = EXCLUDED.curricular_offering,
          latitude = EXCLUDED.latitude, 
          longitude = EXCLUDED.longitude,
          updated_at = EXCLUDED.updated_at
      `;
    await pool.query(schoolQuery, [
      school_id, iern, master.School_Name, 
      master.Region, master.Division, master.Province, master.Municipality, master.Barangay, master.District, master.Legislative_District, master.Curricular_Offering,
      master.Latitude, master.Longitude
    ]);
    console.log("✅ ph_schools hydrated");

    process.exit(0);
  } catch (err) {
    console.error("❌ Simulation Failed:", err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

simulateRegistration();
