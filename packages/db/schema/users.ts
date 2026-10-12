import { pgTable, text, boolean, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';

/**
 * Users Table Schema (Drizzle ORM)
 * Stores user credentials, passcode PIN, and demographic affiliations.
 */
export const users = pgTable('users', {
  uid: text('uid').primaryKey(),
  email: text('email').unique(),
  role: text('role'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  schoolId: text('school_id'),
  iern: text('iern'),
  region: text('region'),
  division: text('division'),
  province: text('province'),
  city: text('city'),
  barangay: text('barangay'),
  office: text('office'),
  position: text('position'),
  contactNumber: text('contact_number'),
  altEmail: text('alt_email'),
  accountCategory: text('account_category'),
  registrantType: text('registrant_type'),
  passwordHash: text('password_hash'),
  passwordSalt: text('password_salt'),
  hashVersion: text('hash_version'),
  passcode: text('passcode'),
  disabled: boolean('disabled').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('idx_users_school_id').on(table.schoolId),
  index('idx_users_email_lower').on(table.email),
]);

/**
 * User Schoolhead Table Schema (Primary School Head authentication table in users_database)
 */
export const userSchoolhead = pgTable('user_schoolhead', {
  uid: text('uid').primaryKey(),
  email: text('email'),
  role: text('role'),
  region: text('region'),
  division: text('division'),
  office: text('office'),
  accountCategory: text('account_category'),
  passcode: text('passcode'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  schoolId: text('school_id'),
  disabled: boolean('disabled').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
