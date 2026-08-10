import express from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import jwt from 'jsonwebtoken';

import { pool, poolUsers, safeQuery, safeUsersQuery } from '@shared/db';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// ZOD VALIDATION SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
const RegisterBetaSchema = z.object({
  firstName: z.string().min(1, "First name is required.").transform(val => val.trim()),
  lastName: z.string().min(1, "Last name is required.").transform(val => val.trim()),
  email: z.string()
    .email("Please enter a valid email address.")
    .transform(e => e.trim().toLowerCase())
    .refine(val => val.endsWith('@deped.gov.ph'), {
      message: "Restricted Access: Please use your official @deped.gov.ph school email."
    }),
  contactNumber: z.string()
    .length(11, "Mobile number must be exactly 11 digits.")
    .regex(/^09\d{9}$/, "Mobile number must start with 09 and contain only digits."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  schoolData: z.object({
    school_id: z.string().min(1, "School ID is required."),
    latitude: z.union([z.number(), z.string()]).optional().nullable(),
    longitude: z.union([z.number(), z.string()]).optional().nullable()
  })
});

// ─────────────────────────────────────────────────────────────────────────────
// [REGISTRATION] POST /api/check-existing-school
// Checks whether a school_id is already registered under a School Head account
// ─────────────────────────────────────────────────────────────────────────────
router.post('/api/check-existing-school', async (req, res) => {
  const { schoolId } = req.body;
  const tidiedId = (schoolId || '').trim();

  if (!tidiedId) {
    return res.status(400).json({ error: "School ID is required." });
  }

  let client;
  try {
    client = await poolUsers.connect();
    const query = "SELECT uid FROM user_schoolhead WHERE school_id = $1";
    let result;

    try {
      result = await client.query(query, [tidiedId]);
    } catch (err) {
      if (err.message.includes('terminated unexpectedly')) {
        client.release();
        client = await poolUsers.connect();
        result = await client.query(query, [tidiedId]);
      } else {
        throw err;
      }
    }

    res.json({ exists: result.rowCount > 0 });
  } catch (err) {
    console.error("❌ [Check Existing School] Error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    if (client) client.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// [REGISTRATION] POST /api/register-beta
// School Head registration using a school_id from the active master records table
// ─────────────────────────────────────────────────────────────────────────────
router.post('/api/register-beta', async (req, res) => {
  try {
    const validatedData = RegisterBetaSchema.safeParse(req.body);
    if (!validatedData.success) {
      const firstError = validatedData.error.errors[0]?.message || "Validation failed";
      return res.status(400).json({ error: firstError, details: validatedData.error.format() });
    }

    const { email, password, contactNumber, firstName, lastName, schoolData } = validatedData.data;
    const { school_id } = schoolData;

    // Retrieve the active school master record from users_database
    const masterRes = await safeUsersQuery(
      `SELECT 
        iern AS "IERN", school_id AS "SchoolID", 
        region AS "Region", division AS "Division", province AS "Province", 
        municipality AS "Municipality", barangay AS "Barangay", 
        latitude AS "Latitude", longitude AS "Longitude", status 
       FROM schools_iern 
       WHERE school_id = $1 AND (status ILIKE 'Active' OR status IS NULL) LIMIT 1`,
      [school_id]
    );
    if (masterRes.rowCount === 0) {
      return res.status(404).json({ error: "Active School ID not found in Master Record. Please contact support." });
    }
    const master = masterRes.rows[0];
    const iern = master.IERN || master.iern || school_id;

    // Check for duplicate user emails or school IDs in user_schoolhead
    const dupRes = await safeUsersQuery('SELECT uid FROM user_schoolhead WHERE LOWER(email) = $1 OR school_id = $2', [email.toLowerCase(), school_id]);
    if (dupRes.rowCount > 0) {
      return res.status(400).json({ error: "Email or School ID is already registered." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const uid = uuidv4();

    // Determine custom coordinates (dragged map coordinates) or fallback to master records
    const finalLat = schoolData.latitude !== undefined && schoolData.latitude !== null && schoolData.latitude !== ""
      ? String(schoolData.latitude)
      : String(master.Latitude);
    const finalLng = schoolData.longitude !== undefined && schoolData.longitude !== null && schoolData.longitude !== ""
      ? String(schoolData.longitude)
      : String(master.Longitude);

    // 1. Insert user into user_schoolhead table
    const userQuery = `
      INSERT INTO user_schoolhead (
        uid, email, password_hash, hash_version, role, first_name, last_name,
        school_id, iern, contact_number, region, division, province, city, barangay,
        disabled, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP)
    `;
    const userValues = [
      uid, email, passwordHash, 'bcrypt', 'School Head', firstName, lastName,
      school_id, iern, contactNumber,
      master.Region, master.Division, master.Province,
      master.Municipality, master.Barangay,
      false
    ];
    await safeUsersQuery(userQuery, userValues);

    // 2. Insert or update ph_schools and unit1_school_identity in main database
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const schoolQuery = `
        INSERT INTO ph_schools (
          school_id, iern, updated_at
        )
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (school_id) DO UPDATE SET 
          iern = EXCLUDED.iern,
          updated_at = EXCLUDED.updated_at
      `;
      await client.query(schoolQuery, [
        school_id, iern
      ]);

      const unit1Query = `
        INSERT INTO unit1_school_identity (
          school_id, iern, school_name, region, division, province, municipality, barangay, district, leg_district, curricular_offering, latitude, longitude, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
        ON CONFLICT (iern, school_yr) DO UPDATE SET 
          school_id = EXCLUDED.school_id,
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
      await client.query(unit1Query, [
        school_id, iern, master.School_Name,
        master.Region, master.Division, master.Province, master.Municipality, master.Barangay,
        master.District, master.Legislative_District, master.Curricular_Offering,
        finalLat, finalLng
      ]);

      await client.query('COMMIT');
    } catch (dbErr) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('❌ [Registration] ROLLBACK failed:', rollbackErr.message);
      }
      throw dbErr;
    } finally {
      client.release();
    }

    const token = jwt.sign(
      { uid, email, role: 'School Head', school_id, iern },
      process.env.JWT_SECRET || 'STRIDE_INSIGHTED_SECRET_2026_KEY_PROD',
      { expiresIn: '30d' }
    );

    res.status(201).json({
      success: true,
      token,
      user: {
        uid, email, role: 'School Head', firstName, lastName,
        school_id, iern
      }
    });

  } catch (err) {
    console.error("❌ [Registration Exception]:", err.message);
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

export default router;
