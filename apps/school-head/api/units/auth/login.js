import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { FirebaseScrypt } from 'firebase-scrypt';

import authMiddleware from '../../middleware/authMiddleware.js';
import { pool } from '../../utils/db.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// [LOGIN] POST /api/auth/migrate-login
// Supports: email or school_id + password (bcrypt or firebase-scrypt)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/api/auth/migrate-login', async (req, res) => {
  if (!req.body) {
    return res.status(400).json({ success: false, error: "Missing request body." });
  }

  const { email, school_id, password } = req.body;
  const identifier = (school_id || email || '').trim();

  if (!identifier || !password) {
    return res.status(400).json({ success: false, error: "Identifier and password are required." });
  }

  try {
    const isEmail = identifier.includes('@');
    const isSchoolId = !isEmail && (!!school_id || /^\d{6,}$/.test(identifier));

    const SELECT_COLS = `uid, email, role, region, division, office, account_category, passcode, password_hash, password_salt, hash_version, first_name, last_name, school_id, province, city`;

    const query = isSchoolId
      ? `SELECT ${SELECT_COLS} FROM users WHERE school_id = $1 AND disabled = false AND (registration_status = 'Valid' OR registration_status IS NULL)`
      : `SELECT ${SELECT_COLS} FROM users WHERE LOWER(email) = $1 AND disabled = false AND (registration_status = 'Valid' OR registration_status IS NULL) ORDER BY CASE WHEN role = 'School Head' THEN 2 ELSE 1 END, created_at DESC`;

    const processUserRes = (resObj) => {
      if (resObj.rowCount === 0) return null;
      return resObj.rows[0];
    };

    let user;
    let loginClient = await pool.connect();
    try {
      const userRes = await loginClient.query(query, [isSchoolId ? identifier : identifier.toLowerCase()]);
      user = processUserRes(userRes);
    } catch (err) {
      if (err.message.includes('terminated unexpectedly')) {
        loginClient.release();
        loginClient = await pool.connect();
        const retryRes = await loginClient.query(query, [isSchoolId ? identifier : identifier.toLowerCase()]);
        user = processUserRes(retryRes);
      } else {
        throw err;
      }
    } finally {
      loginClient.release();
    }

    if (!user) {
      return res.status(401).json({ success: false, error: "Username does not exist. Kindly register first." });
    }

    let isValid = false;

    if (user.hash_version === 'bcrypt') {
      isValid = await bcrypt.compare(password, user.password_hash);
    } else if (user.hash_version === 'firebase') {
      if (!process.env.FIREBASE_HASH_SIGNER_KEY) {
        return res.status(500).json({ success: false, error: "Server configuration error during migration." });
      }

      const scrypt = new FirebaseScrypt({
        memCost: parseInt((process.env.FIREBASE_HASH_MEM_COST || "14").replace(/"/g, '')),
        rounds: parseInt((process.env.FIREBASE_HASH_ROUNDS || "8").replace(/"/g, '')),
        saltSeparator: (process.env.FIREBASE_HASH_SALT_SEPARATOR || "").replace(/"/g, ''),
        signerKey: (process.env.FIREBASE_HASH_SIGNER_KEY || "").replace(/"/g, '')
      });

      isValid = await scrypt.verify(password, user.password_salt, user.password_hash);

      if (isValid) {
        console.log(`[LAZY MIGRATION] Upgrading hash for user: ${user.email}`);
        const saltRounds = 10;
        bcrypt.hash(password, saltRounds).then(newBcryptHash => {
          pool.query(
            `UPDATE users SET password_hash = $1, password_salt = NULL, hash_version = 'bcrypt' WHERE uid = $2`,
            [newBcryptHash, user.uid]
          ).catch(e => console.error('[LAZY MIGRATION] Update failed:', e.message));
        }).catch(e => console.error('[LAZY MIGRATION] Hash failed:', e.message));
      }
    } else {
      return res.status(401).json({ success: false, error: "Unsupported hash algorithm." });
    }

    if (!isValid) {
      return res.status(401).json({ success: false, error: "The username exists but does not match the password you provided." });
    }

    let finalCategory = user.account_category;
    if (!finalCategory || user.role === 'EFD' || user.role === 'HRODI' || user.role === 'EFD Engineer' || user.role === 'DepEd Engineer' || user.role === 'Division Engineer') {
      if (user.role === 'EFD' || user.role === 'HRODI' || user.role === 'EFD Engineer' || user.role === 'DepEd Engineer' || user.role === 'Division Engineer') {
        finalCategory = 'DepEd Engineer';
      } else {
        finalCategory = user.role;
      }

      if (finalCategory !== user.account_category) {
        pool.query('UPDATE users SET account_category = $1 WHERE uid = $2', [finalCategory, user.uid])
          .catch(e => console.error('[MIGRATE LOGIN] Category update failed:', e.message));
      }
    }

    const token = jwt.sign(
      {
        uid: user.uid,
        email: user.email,
        role: user.role,
        region: user.region || null,
        division: user.division || null
      },
      process.env.JWT_SECRET || 'STRIDE_INSIGHTED_SECRET_2026_KEY_PROD',
      { expiresIn: '30d' }
    );

    return res.json({
      success: true,
      token: token,
      user: {
        uid: user.uid,
        email: user.email,
        role: user.role,
        region: user.region,
        division: user.division,
        account_category: finalCategory,
        passcode: user.passcode,
        first_name: user.first_name,
        last_name: user.last_name,
        school_id: user.school_id,
        office: user.office,
        province: user.province,
        city: user.city,
        firstName: user.first_name,
        lastName: user.last_name
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message || "Internal Server Error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// [LOGIN] POST /api/auth/pin-login
// Login using a 6-digit PIN instead of a password
// ─────────────────────────────────────────────────────────────────────────────
router.post('/api/auth/pin-login', async (req, res) => {
  const { email, school_id, pin } = req.body;
  const identifier = (school_id || email || '').trim();

  if (!identifier || !pin) {
    return res.status(400).json({ success: false, error: "Identifier and PIN are required." });
  }

  try {
    const isEmail = identifier.includes('@');
    const isSchoolId = !isEmail && (!!school_id || /^\d{6,}$/.test(identifier));

    const selectCols = 'uid, email, role, region, division, office, account_category, passcode, first_name, last_name, school_id';
    const query = isSchoolId
      ? `SELECT ${selectCols} FROM users WHERE school_id = $1 AND disabled = false AND (registration_status = 'Valid' OR registration_status IS NULL)`
      : `SELECT ${selectCols} FROM users WHERE LOWER(email) = $1 AND disabled = false AND (registration_status = 'Valid' OR registration_status IS NULL) ORDER BY CASE WHEN role = 'School Head' THEN 2 ELSE 1 END, created_at DESC`;

    let user;
    let client = await pool.connect();
    try {
      let userRes;
      try {
        userRes = await client.query(query, [isSchoolId ? identifier : identifier.toLowerCase()]);
      } catch (err) {
        if (err.message.includes('terminated unexpectedly')) {
          client.release();
          client = await pool.connect();
          userRes = await client.query(query, [isSchoolId ? identifier : identifier.toLowerCase()]);
        } else {
          throw err;
        }
      }
      if (userRes.rowCount > 0) user = userRes.rows[0];
    } finally {
      client.release();
    }

    if (!user) {
      return res.status(401).json({ success: false, error: "Username does not exist. Kindly register first." });
    }

    if (!user.passcode) {
      return res.status(401).json({ success: false, error: "No PIN setup for this account." });
    }

    const storedPasscode = user.passcode;
    const isBcryptHash = storedPasscode.startsWith('$2b$');
    const isValidPin = isBcryptHash
      ? await bcrypt.compare(pin, storedPasscode)
      : (pin === storedPasscode);

    if (!isValidPin) {
      return res.status(401).json({ success: false, error: "The username exists but does not match the PIN you provided." });
    }

    let finalCategory = user.account_category;
    if (!finalCategory || user.role === 'EFD' || user.role === 'HRODI' || user.role === 'EFD Engineer' || user.role === 'DepEd Engineer' || user.role === 'Division Engineer') {
      if (user.role === 'EFD' || user.role === 'HRODI' || user.role === 'EFD Engineer' || user.role === 'DepEd Engineer' || user.role === 'Division Engineer') {
        finalCategory = 'DepEd Engineer';
      } else {
        finalCategory = user.role;
      }
    }

    const token = jwt.sign(
      {
        uid: user.uid,
        email: user.email,
        role: user.role,
        region: user.region || null,
        division: user.division || null
      },
      process.env.JWT_SECRET || 'STRIDE_INSIGHTED_SECRET_2026_KEY_PROD',
      { expiresIn: '30d' }
    );

    return res.json({
      success: true,
      token: token,
      user: {
        uid: user.uid,
        email: user.email,
        role: user.role,
        region: user.region,
        division: user.division,
        account_category: finalCategory,
        first_name: user.first_name,
        last_name: user.last_name,
        school_id: user.school_id,
        passcode: user.passcode,
        office: user.office,
        firstName: user.first_name,
        lastName: user.last_name
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// [AUTH] GET /api/auth/me
// Get currently authenticated user's profile
// ─────────────────────────────────────────────────────────────────────────────
router.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const { uid } = req.user;
    const query = 'SELECT uid, email, role, region, division, office, account_category, first_name, last_name, school_id, passcode, province, city FROM users WHERE uid = $1';

    let result;
    try {
      result = await pool.query(query, [uid]);
    } catch (err) {
      if (err.message.includes('terminated unexpectedly')) {
        result = await pool.query(query, [uid]);
      } else {
        throw err;
      }
    }

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    const user = result.rows[0];
    res.json({
      uid: user.uid,
      email: user.email,
      role: user.role,
      region: user.region,
      division: user.division,
      account_category: user.account_category,
      first_name: user.first_name,
      last_name: user.last_name,
      school_id: user.school_id,
      passcode: user.passcode,
      office: user.office,
      province: user.province,
      city: user.city
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// [AUTH] POST /api/auth/change-password
// ─────────────────────────────────────────────────────────────────────────────
router.post('/api/auth/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const { uid } = req.user;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current and new passwords are required." });
  }

  try {
    const userRes = await pool.query('SELECT password_hash FROM users WHERE uid = $1', [uid]);
    if (userRes.rowCount === 0) return res.status(404).json({ error: "User not found" });

    const { password_hash } = userRes.rows[0];

    const isMatch = await bcrypt.compare(currentPassword, password_hash);
    if (!isMatch) return res.status(401).json({ error: "Incorrect current password" });

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1, hash_version = \'bcrypt\' WHERE uid = $1', [newHash, uid]);

    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// [AUTH] POST /api/auth/verify-passcode
// ─────────────────────────────────────────────────────────────────────────────
router.post('/api/auth/verify-passcode', authMiddleware, async (req, res) => {
  try {
    const { passcode } = req.body;
    const { uid } = req.user;

    if (!passcode) {
      return res.status(400).json({ success: false, error: "Passcode is required." });
    }

    const userRes = await pool.query('SELECT passcode FROM users WHERE uid = $1', [uid]);
    if (userRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: "User not found." });
    }

    const storedPasscode = userRes.rows[0].passcode;
    if (!storedPasscode) {
      return res.status(400).json({ success: false, error: "No PIN setup for this account." });
    }

    const isBcryptHash = storedPasscode.startsWith('$2b$');
    const isValid = isBcryptHash
      ? await bcrypt.compare(passcode, storedPasscode)
      : (passcode === storedPasscode);

    if (isValid) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, error: "Invalid passcode. Please try again." });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// [AUTH] POST /api/auth/setup-passcode
// ─────────────────────────────────────────────────────────────────────────────
router.post('/api/auth/setup-passcode', authMiddleware, async (req, res) => {
  const { passcode, oldPasscode, pin } = req.body;
  const finalPasscode = passcode || pin;
  const { uid, role } = req.user;

  if (!finalPasscode || finalPasscode.length !== 6) {
    return res.status(400).json({ error: "6-digit passcode is required" });
  }

  try {
    if (oldPasscode) {
      const userRes = await pool.query('SELECT passcode FROM users WHERE uid = $1', [uid]);
      if (userRes.rowCount > 0 && userRes.rows[0].passcode) {
        const stored = userRes.rows[0].passcode;
        const isMatch = stored.startsWith('$2b$')
          ? await bcrypt.compare(oldPasscode, stored)
          : (oldPasscode === stored);
        if (!isMatch) return res.status(401).json({ error: "Incorrect current passcode" });
      }
    }

    const dbPasscode = (role === 'School Head') ? finalPasscode : await bcrypt.hash(finalPasscode, 10);
    await pool.query('UPDATE users SET passcode = $1 WHERE uid = $2', [dbPasscode, uid]);

    res.json({ success: true, message: "Passcode updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// [AUTH] PUT /api/users/update
// Update user profile (name, email)
// ─────────────────────────────────────────────────────────────────────────────
router.put('/api/users/update', authMiddleware, async (req, res) => {
  const { firstName, lastName, email, currentPasscode } = req.body;
  const { uid } = req.user;

  try {
    const userRes = await pool.query('SELECT email, passcode FROM users WHERE uid = $1', [uid]);
    if (userRes.rowCount === 0) return res.status(404).json({ error: "User not found" });

    const user = userRes.rows[0];
    let emailChanged = false;

    if (email && email.toLowerCase() !== user.email.toLowerCase()) {
      const currentDomain = user.email.split('@')[1];
      const newDomain = email.split('@')[1];

      if (currentDomain && newDomain && currentDomain.toLowerCase() !== newDomain.toLowerCase()) {
        return res.status(403).json({ error: `Domain restricted: Email must end with @${currentDomain}` });
      }

      if (user.passcode) {
        if (!currentPasscode) return res.status(401).json({ error: "Passcode verification required to change email" });

        const isPinMatch = user.passcode.startsWith('$2b$')
          ? await bcrypt.compare(currentPasscode, user.passcode)
          : (currentPasscode === user.passcode);

        if (!isPinMatch) return res.status(401).json({ error: "Invalid passcode" });
      }
      emailChanged = true;
    }

    const updates = [];
    const values = [];
    let pIdx = 1;

    if (firstName) { updates.push(`first_name = $${pIdx++}`); values.push(firstName); }
    if (lastName) { updates.push(`last_name = $${pIdx++}`); values.push(lastName); }
    if (email) { updates.push(`email = $${pIdx++}`); values.push(email.toLowerCase()); }

    if (updates.length === 0) return res.json({ success: true, message: "No changes detected" });

    values.push(uid);
    const query = `UPDATE users SET ${updates.join(', ')} WHERE uid = $${pIdx} RETURNING *`;
    await pool.query(query, values);

    res.json({ success: true, emailChanged });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// [MISC] POST /api/feedback
// ─────────────────────────────────────────────────────────────────────────────
router.post('/api/feedback', authMiddleware, async (req, res) => {
  const { ratings, comment, appVersion } = req.body;
  const { uid, email, role } = req.user;

  try {
    await pool.query(
      `INSERT INTO user_feedback (uid, email, role, ratings, comment, app_version, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [uid, email, role, JSON.stringify(ratings), comment, appVersion]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// [SYSTEM] POST /api/system/align-unit8
// ─────────────────────────────────────────────────────────────────────────────
router.post('/api/system/align-unit8', authMiddleware, async (req, res) => {
  console.log(`🔧 [System] Aligning Unit 8 for UID: ${req.user.uid}`);
  res.json({ success: true, message: "Unit 8 alignment protocol complete" });
});

export default router;
