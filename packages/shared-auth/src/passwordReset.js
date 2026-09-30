import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { sendPasswordResetEmail } from '../../shared-io/src/helpers.js';

/**
 * Mask an email address for privacy (e.g. "juan.delacruz@deped.gov.ph" -> "j***z@deped.gov.ph")
 */
export const maskEmail = (email) => {
  if (!email || !email.includes('@')) return '';
  const [user, domain] = email.split('@');
  if (user.length <= 2) {
    return `${user[0]}*@${domain}`;
  }
  const first = user[0];
  const last = user[user.length - 1];
  const maskedLength = Math.min(Math.max(user.length - 2, 3), 6);
  return `${first}${'*'.repeat(maskedLength)}${last}@${domain}`;
};

/**
 * Generate a 6-digit numeric OTP
 */
export const generateNumericOtp = (digits = 6) => {
  const min = Math.pow(10, digits - 1);
  const max = Math.pow(10, digits) - 1;
  return crypto.randomInt(min, max + 1).toString();
};

/**
 * Ensure verification_codes table exists in users_database
 */
export const ensureOtpTableExists = async (dbPool) => {
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS verification_codes (
      email VARCHAR(255) PRIMARY KEY,
      code VARCHAR(10) NOT NULL,
      expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 minutes')
    );
  `);
};

/**
 * Save / Upsert OTP to database with expiration
 */
export const saveOtp = async (dbPool, email, code, ttlMinutes = 10) => {
  await ensureOtpTableExists(dbPool);
  const cleanEmail = email.trim().toLowerCase();
  const query = `
    INSERT INTO verification_codes (email, code, expires_at)
    VALUES ($1, $2, NOW() + ($3 || ' minutes')::INTERVAL)
    ON CONFLICT (email) 
    DO UPDATE SET code = $2, expires_at = NOW() + ($3 || ' minutes')::INTERVAL;
  `;
  await dbPool.query(query, [cleanEmail, code, String(ttlMinutes)]);
};

/**
 * Verify OTP against database
 */
export const verifyOtp = async (dbPool, email, code) => {
  await ensureOtpTableExists(dbPool);
  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = String(code).trim();

  const query = `
    SELECT email, code, expires_at 
    FROM verification_codes 
    WHERE LOWER(email) = $1 AND code = $2 AND expires_at > NOW();
  `;
  const result = await dbPool.query(query, [cleanEmail, cleanCode]);
  return result.rowCount > 0;
};

/**
 * Invalidate / Delete OTP once consumed
 */
export const consumeOtp = async (dbPool, email) => {
  const cleanEmail = email.trim().toLowerCase();
  await dbPool.query('DELETE FROM verification_codes WHERE LOWER(email) = $1;', [cleanEmail]);
};

/**
 * Dispatch Password Reset Email via Nodemailer
 */
export const dispatchResetEmail = async ({ to, code, name }) => {
  return await sendPasswordResetEmail({
    to,
    code,
    identifierName: name || 'School Head'
  });
};

/**
 * Update password hash with bcrypt in user_schoolhead table
 */
export const updateSchoolHeadPassword = async (dbPool, uid, newPassword) => {
  const saltRounds = 10;
  const hash = await bcrypt.hash(newPassword, saltRounds);
  const result = await dbPool.query(
    `UPDATE user_schoolhead 
     SET password_hash = $1, password_salt = NULL, hash_version = 'bcrypt' 
     WHERE uid = $2`,
    [hash, uid]
  );
  return result.rowCount > 0;
};
