import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { FirebaseScrypt } from 'firebase-scrypt';

import authMiddleware, {
  maskEmail,
  generateNumericOtp,
  saveOtp,
  verifyOtp,
  consumeOtp,
  dispatchResetEmail,
  updateSchoolHeadPassword
} from '@shared/auth';
import { pool, poolUsers, safeQuery, safeUsersQuery } from '@shared/db';

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

    const query = `
      SELECT ${SELECT_COLS} 
      FROM user_schoolhead 
      WHERE (TRIM(school_id) = $1 OR LOWER(email) = $1) 
        AND (disabled = false OR disabled IS NULL) 
      ORDER BY created_at DESC
    `;

    const processUserRes = (resObj) => {
      if (resObj.rowCount === 0) return null;
      return resObj.rows[0];
    };

    let user;
    let loginClient = await poolUsers.connect();
    try {
      const searchTarget = identifier.toLowerCase();
      console.log(`\n=================== [LOGIN DEBUG TRACE] ===================`);
      console.log(`🔍 Received req.body:`, JSON.stringify(req.body));
      console.log(`🔍 Extracted identifier: "${identifier}", searchTarget: "${searchTarget}"`);
      
      const userRes = await loginClient.query(query, [searchTarget]);
      console.log(`📊 DB query rowCount: ${userRes.rowCount}`);
      user = processUserRes(userRes);
      if (user) {
        console.log(`✅ USER MATCHED: email="${user.email}", school_id="${user.school_id}", role="${user.role}", hash_version="${user.hash_version}"`);
      } else {
        console.log(`❌ NO USER MATCH FOUND IN DB for target: "${searchTarget}"`);
      }
      console.log(`===========================================================\n`);
    } catch (err) {
      console.error(`❌ [LOGIN DEBUG TRACE ERROR]:`, err);
      if (err.message.includes('terminated unexpectedly')) {
        loginClient.release();
        loginClient = await poolUsers.connect();
        const retryRes = await loginClient.query(query, [identifier.toLowerCase()]);
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
          poolUsers.query(
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
        poolUsers.query('UPDATE users SET account_category = $1 WHERE uid = $2', [finalCategory, user.uid])
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
    const query = `
      SELECT ${selectCols} 
      FROM user_schoolhead 
      WHERE (TRIM(school_id) = $1 OR LOWER(email) = $1) 
        AND (disabled = false OR disabled IS NULL) 
      ORDER BY created_at DESC
    `;

    let user;
    let client = await poolUsers.connect();
    try {
      const searchTarget = identifier.toLowerCase();
      console.log(`\n=================== [PIN-LOGIN DEBUG TRACE] ===================`);
      console.log(`🔍 Received req.body:`, JSON.stringify(req.body));
      console.log(`🔍 Extracted identifier: "${identifier}", searchTarget: "${searchTarget}"`);

      let userRes;
      try {
        userRes = await client.query(query, [searchTarget]);
        console.log(`📊 DB query rowCount: ${userRes.rowCount}`);
      } catch (err) {
        if (err.message.includes('terminated unexpectedly')) {
          client.release();
          client = await poolUsers.connect();
          userRes = await client.query(query, [searchTarget]);
        } else {
          throw err;
        }
      }
      if (userRes.rowCount > 0) {
        user = userRes.rows[0];
        console.log(`✅ PIN USER MATCHED: email="${user.email}", school_id="${user.school_id}", role="${user.role}"`);
      } else {
        console.log(`❌ NO PIN USER MATCH FOUND IN DB for target: "${searchTarget}"`);
      }
      console.log(`===============================================================\n`);
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
        lastName: user.last_name,
        user_sh_index: user.user_sh_index
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
    const query = 'SELECT uid, email, role, region, division, office, account_category, first_name, last_name, school_id, passcode, province, city FROM user_schoolhead WHERE uid = $1';

    let result;
    try {
      result = await poolUsers.query(query, [uid]);
    } catch (err) {
      if (err.message.includes('terminated unexpectedly')) {
        result = await poolUsers.query(query, [uid]);
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
  const { currentPassword, newPassword, passcode } = req.body;
  const { uid } = req.user;

  if (passcode && newPassword) {
    try {
      let userRes = await poolUsers.query('SELECT passcode FROM user_schoolhead WHERE uid = $1', [uid]);
      if (userRes.rowCount === 0) return res.status(404).json({ error: "User not found" });

      const storedPasscode = userRes.rows[0].passcode;
      if (!storedPasscode) return res.status(400).json({ error: "No PIN/passcode setup for this account." });

      const passStr = String(storedPasscode);
      const isBcryptHash = passStr.startsWith('$2b$');
      const isMatch = isBcryptHash
        ? await bcrypt.compare(String(passcode).trim(), passStr)
        : (String(passcode).trim() === passStr.trim());

      if (!isMatch) return res.status(401).json({ error: "Incorrect 6-digit security passcode." });

      const newHash = await bcrypt.hash(newPassword, 10);
      await poolUsers.query('UPDATE user_schoolhead SET password_hash = $1, hash_version = \'bcrypt\' WHERE uid = $2', [newHash, uid]);

      return res.json({ success: true, message: "Password updated successfully via passcode verification" });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current and new passwords are required." });
  }

  try {
    let userRes = await poolUsers.query('SELECT password_hash FROM user_schoolhead WHERE uid = $1', [uid]);
    if (userRes.rowCount === 0) return res.status(404).json({ error: "User not found" });

    const { password_hash } = userRes.rows[0];

    const isMatch = await bcrypt.compare(currentPassword, password_hash);
    if (!isMatch) return res.status(401).json({ error: "Incorrect current password" });

    const newHash = await bcrypt.hash(newPassword, 10);
    await poolUsers.query('UPDATE user_schoolhead SET password_hash = $1, hash_version = \'bcrypt\' WHERE uid = $2', [newHash, uid]);

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

    let userRes = await poolUsers.query('SELECT passcode FROM user_schoolhead WHERE uid = $1', [uid]);
    if (userRes.rowCount === 0) return res.status(404).json({ success: false, error: "User not found." });

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
      let userRes = await safeUsersQuery('SELECT passcode FROM user_schoolhead WHERE uid = $1', [uid]);
      if (userRes && userRes.rowCount > 0 && userRes.rows[0].passcode) {
        const stored = userRes.rows[0].passcode;
        const isMatch = stored.startsWith('$2b$')
          ? await bcrypt.compare(oldPasscode, stored)
          : (oldPasscode === stored);
        if (!isMatch) return res.status(401).json({ error: "Incorrect current passcode" });
      }
    }

    const dbPasscode = (role === 'School Head') ? finalPasscode : await bcrypt.hash(finalPasscode, 10);
    await safeUsersQuery('UPDATE user_schoolhead SET passcode = $1 WHERE uid = $2', [dbPasscode, uid]);

    res.json({ success: true, message: "Passcode updated successfully" });
  } catch (err) {
    console.error("❌ [/api/auth/setup-passcode] Error:", err.message);
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
    let userRes = await poolUsers.query('SELECT email, passcode FROM user_schoolhead WHERE uid = $1', [uid]);
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
    const query = `UPDATE user_schoolhead SET ${updates.join(', ')} WHERE uid = $${pIdx} RETURNING *`;
    await poolUsers.query(query, values);

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

// ─────────────────────────────────────────────────────────────────────────────
// [FORGOT PASSWORD] GET /api/auth/lookup-masked-email/:identifier
// ─────────────────────────────────────────────────────────────────────────────
router.get('/api/auth/lookup-masked-email/:identifier', async (req, res) => {
  const { identifier } = req.params;
  if (!identifier) {
    return res.status(400).json({ success: false, error: "School ID or email is required." });
  }

  const target = identifier.trim().toLowerCase();
  try {
    const query = `
      SELECT uid, email, school_id, first_name, last_name 
      FROM user_schoolhead 
      WHERE (TRIM(school_id) = $1 OR LOWER(email) = $1)
        AND (disabled = false OR disabled IS NULL)
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    const result = await poolUsers.query(query, [target]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: "No active School Head account found for this School ID or email." });
    }

    const user = result.rows[0];
    if (!user.email) {
      return res.status(400).json({ success: false, error: "No registered email address found on file for this account." });
    }

    const masked = maskEmail(user.email);
    return res.json({
      success: true,
      schoolId: user.school_id,
      maskedEmail: masked,
      firstName: user.first_name || 'School Head'
    });
  } catch (err) {
    console.error("❌ [LOOKUP MASKED EMAIL ERROR]:", err);
    return res.status(500).json({ success: false, error: "Internal server error during email lookup." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// [FORGOT PASSWORD] POST /api/auth/forgot-password/send-otp
// Dispatches 6-digit OTP via Nodemailer using helpdesk.stride@deped.gov.ph
// ─────────────────────────────────────────────────────────────────────────────
router.post('/api/auth/forgot-password/send-otp', async (req, res) => {
  const { identifier } = req.body;
  if (!identifier) {
    return res.status(400).json({ success: false, error: "School ID or email is required." });
  }

  const target = identifier.trim().toLowerCase();
  try {
    const query = `
      SELECT uid, email, school_id, first_name, last_name 
      FROM user_schoolhead 
      WHERE (TRIM(school_id) = $1 OR LOWER(email) = $1)
        AND (disabled = false OR disabled IS NULL)
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    const result = await poolUsers.query(query, [target]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: "No active School Head account found for this School ID or email." });
    }

    const user = result.rows[0];
    if (!user.email) {
      return res.status(400).json({ success: false, error: "No registered email address found for this account." });
    }

    // Generate 6-digit OTP and store in DB with 10-minute expiration
    const otp = generateNumericOtp(6);
    await saveOtp(poolUsers, user.email, otp, 10);

    // Send email via Nodemailer
    const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'School Head';
    await dispatchResetEmail({
      to: user.email,
      code: otp,
      name: displayName
    });

    console.log(`✅ [PASSWORD RESET] Sent OTP to ${user.email} (School ID: ${user.school_id})`);

    return res.json({
      success: true,
      message: `Verification code sent to ${maskEmail(user.email)}`,
      maskedEmail: maskEmail(user.email)
    });
  } catch (err) {
    console.error("❌ [SEND OTP ERROR]:", err);
    return res.status(500).json({ success: false, error: "Failed to send verification email. " + (err.message || "") });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// [FORGOT PASSWORD] POST /api/auth/forgot-password/reset
// Verifies OTP and hashes new password with bcrypt
// ─────────────────────────────────────────────────────────────────────────────
router.post('/api/auth/forgot-password/reset', async (req, res) => {
  const { identifier, code, newPassword } = req.body;

  if (!identifier || !code || !newPassword) {
    return res.status(400).json({ success: false, error: "Identifier, verification code, and new password are required." });
  }

  const cleanCode = String(code).trim();
  if (cleanCode.length !== 6) {
    return res.status(400).json({ success: false, error: "Verification code must be 6 digits." });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, error: "Password must be at least 6 characters." });
  }

  const target = identifier.trim().toLowerCase();
  try {
    const query = `
      SELECT uid, email, school_id 
      FROM user_schoolhead 
      WHERE (TRIM(school_id) = $1 OR LOWER(email) = $1)
        AND (disabled = false OR disabled IS NULL)
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    const result = await poolUsers.query(query, [target]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: "Account not found." });
    }

    const user = result.rows[0];
    const isValid = await verifyOtp(poolUsers, user.email, cleanCode);
    if (!isValid) {
      return res.status(400).json({ success: false, error: "Invalid or expired verification code. Please request a new one." });
    }

    // Update password with bcrypt (salt 10)
    await updateSchoolHeadPassword(poolUsers, user.uid, newPassword);

    // Consume OTP so it cannot be reused
    await consumeOtp(poolUsers, user.email);

    console.log(`✅ [PASSWORD RESET] Password successfully updated for UID: ${user.uid} (${user.email})`);
    return res.json({
      success: true,
      message: "Password updated successfully. You may now sign in with your new password."
    });
  } catch (err) {
    console.error("❌ [RESET PASSWORD ERROR]:", err);
    return res.status(500).json({ success: false, error: "Failed to reset password: " + (err.message || "") });
  }
});

// Legacy alias compatibility
router.post('/api/forgot-password', async (req, res) => {
  const { schoolId, identifier } = req.body;
  req.body.identifier = identifier || schoolId;
  return router.handle(req, res);
});

export default router;

