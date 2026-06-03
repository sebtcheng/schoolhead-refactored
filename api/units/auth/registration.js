import express from 'express';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import jwt from 'jsonwebtoken';

import { pool, safeQuery } from '../../utils/db.js';
import {
  normalizeBasicField,
  normalizeLocationField,
} from '../../utils/helpers.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// ZOD VALIDATION SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
const PasscodeSchema = z.string().length(6).regex(/^\d+$/, "Passcode must be exactly 6 digits.");

const RegisterUserSchema = z.object({
  email: z.string().email().transform(e => e.trim().toLowerCase()),
  password: z.string().min(6, "Password must be at least 6 characters."),
  role: z.string().min(1, "Role is required."),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  region: z.string().optional().transform(normalizeLocationField),
  division: z.string().optional().transform(normalizeLocationField),
  province: z.string().optional().transform(normalizeLocationField),
  city: z.string().optional().transform(normalizeLocationField),
  barangay: z.string().optional().transform(normalizeLocationField),
  office: z.string().optional().transform(normalizeBasicField),
  position: z.string().optional().transform(normalizeBasicField),
  contactNumber: z.string().optional(),
  altEmail: z.string().email().optional().or(z.literal("")),
  accountCategory: z.string().optional(),
  passcode: PasscodeSchema.optional()
});

const RegisterBetaSchema = z.object({
  email: z.string().email().optional().or(z.literal("")),
  password: z.string().min(6),
  schoolData: z.object({
    school_id: z.string().min(1),
    school_name: z.string().optional().nullable(),
    region: z.string().optional().nullable().transform(normalizeLocationField),
    division: z.string().optional().nullable().transform(normalizeLocationField),
    province: z.string().optional().nullable().transform(normalizeLocationField),
    municipality: z.string().optional().nullable().transform(normalizeLocationField),
    district: z.string().optional().nullable().transform(normalizeLocationField),
    legislative_district: z.string().optional().nullable().transform(normalizeLocationField),
    barangay: z.string().optional().nullable().transform(normalizeLocationField),
    latitude: z.union([z.number(), z.string()]).optional().nullable(),
    longitude: z.union([z.number(), z.string()]).optional().nullable()
  }),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  contactNumber: z.string().optional(),
  passcode: PasscodeSchema.optional()
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
    client = await pool.connect();
    const query = "SELECT uid FROM users WHERE school_id = $1 AND role = 'School Head'";
    let result;

    try {
      result = await client.query(query, [tidiedId]);
    } catch (err) {
      if (err.message.includes('terminated unexpectedly')) {
        client.release();
        client = await pool.connect();
        result = await client.query(query, [tidiedId]);
      } else {
        throw err;
      }
    }

    res.json({ exists: result.rowCount > 0 });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    if (client) client.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// [REGISTRATION] POST /api/register-beta
// School Head registration using a school_id from the master records table
// ─────────────────────────────────────────────────────────────────────────────
router.post('/api/register-beta', async (req, res) => {
  try {
    const validatedData = RegisterBetaSchema.safeParse(req.body);
    if (!validatedData.success) {
      return res.status(400).json({ error: "Validation failed", details: validatedData.error.format() });
    }

    const { email, password, contactNumber, firstName, lastName, schoolData, passcode } = validatedData.data;
    const { school_id } = schoolData;

    const masterRes = await safeQuery('SELECT * FROM "schools_IERN" WHERE "SchoolID" = $1 LIMIT 1', [school_id]);
    if (masterRes.rowCount === 0) {
      return res.status(404).json({ error: "School ID not found in Master Record. Please contact support." });
    }
    const master = masterRes.rows[0];
    const iern = master.IERN || school_id;

    const dupRes = await safeQuery('SELECT uid FROM users WHERE LOWER(email) = $1 OR school_id = $2', [email.toLowerCase(), school_id]);
    if (dupRes.rowCount > 0) {
      return res.status(400).json({ error: "Email or School ID is already registered." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const dbPasscode = passcode || null;
    const uid = uuidv4();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const userQuery = `
        INSERT INTO users (
          uid, email, password_hash, hash_version, role, first_name, last_name,
          school_id, iern, contact_number, region, division, province, city, barangay,
          passcode, registration_status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, CURRENT_TIMESTAMP)
      `;
      const userValues = [
        uid, email, passwordHash, 'bcrypt', 'School Head', firstName, lastName,
        school_id, iern, contactNumber,
        master.Region, master.Division, master.Province,
        master.Municipality, master.Barangay,
        dbPasscode,
        'Valid'
      ];
      await client.query(userQuery, userValues);

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
      await client.query(schoolQuery, [
        school_id, iern, master.School_Name,
        master.Region, master.Division, master.Province, master.Municipality, master.Barangay,
        master.District, master.Legislative_District, master.Curricular_Offering,
        master.Latitude, master.Longitude
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
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// [REGISTRATION] POST /api/register-user
// General user registration for non-School-Head roles (division staff, etc.)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/api/register-user', async (req, res) => {
  try {
    const validatedData = RegisterUserSchema.safeParse(req.body);
    if (!validatedData.success) {
      return res.status(400).json({ success: false, error: "Validation failed", details: validatedData.error.format() });
    }

    const {
      email, password, role, firstName, lastName, region, division,
      school_id, office, province, city, barangay, position, contactNumber, accountCategory, passcode
    } = validatedData.data;

    const existingUser = await safeQuery('SELECT uid FROM users WHERE LOWER(email) = $1', [email.toLowerCase()]);
    if (existingUser.rowCount > 0) {
      return res.status(400).json({ success: false, error: "Email already registered." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const dbPasscode = passcode
      ? (role === 'School Head' ? passcode : await bcrypt.hash(passcode, 10))
      : null;
    const uid = uuidv4();

    let iern = null;
    if (school_id) {
      const iernRes = await safeQuery('SELECT "IERN" FROM "schools_IERN" WHERE "SchoolID" = $1 LIMIT 1', [school_id]);
      if (iernRes.rowCount === 0) {
        return res.status(400).json({ success: false, error: "Provided School ID not found in Master Record." });
      }
      iern = iernRes.rows[0].IERN;
    }

    const query = `
      INSERT INTO users (
        uid, email, password_hash, hash_version, role, first_name, last_name,
        region, division, province, city, barangay, school_id, iern, office, position, 
        contact_number, account_category, passcode, registration_status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, CURRENT_TIMESTAMP)
    `;

    const values = [
      uid, email, passwordHash, 'bcrypt', role, firstName, lastName,
      region, division, province, city, barangay, school_id, iern, office, position,
      contactNumber, accountCategory || role, dbPasscode, 'Valid'
    ];

    await pool.query(query, values);

    const token = jwt.sign(
      { uid, email, role, school_id, iern },
      process.env.JWT_SECRET || 'STRIDE_INSIGHTED_SECRET_2026_KEY_PROD',
      { expiresIn: '30d' }
    );

    res.status(201).json({
      success: true,
      token,
      user: {
        uid, email, role, firstName, lastName, region, division,
        account_category: accountCategory || role
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

export default router;
