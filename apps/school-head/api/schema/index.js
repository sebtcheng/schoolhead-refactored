import { pgTable, text, boolean, timestamp, serial, integer, jsonb, numeric, uniqueIndex, index } from 'drizzle-orm/pg-core';

/**
 * Users Table Schema
 * Auth & user profile accounts including passcode PIN, roles, and school links.
 */
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  email: text('email').unique(),
  role: text('role'),
  schoolId: text('school_id'),
  iern: text('iern'),
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

/**
 * Schools IERN Master Registry Table Schema
 * Official 46,000+ national schools directory, geographic divisions and geotags.
 */
export const schoolsIern = pgTable('schools_IERN', {
  schoolId: text('school_id').primaryKey(),
  iern: text('iern'),
  schoolName: text('school_name'),
  region: text('region'),
  division: text('division'),
  district: text('district'),
  municipality: text('municipality'),
  province: text('province'),
  barangay: text('barangay'),
  legislativeDistrict: text('legislative_district'),
  latitude: text('latitude'),
  longitude: text('longitude'),
  status: text('status'),
  isTestaccount: boolean('is_testaccount').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_schools_iern_lookup').on(table.schoolId, table.iern),
  index('idx_schools_iern_iern_only').on(table.iern),
]);

/**
 * Modified SIIF Utilization Table Schema
 * Budget allocations, quarter spending, and unified selected interventions JSONB.
 */
export const modifiedSiifUtilization = pgTable('modified_siif_utilization', {
  modiSiifUtilId: serial('modi_siif_util_id').primaryKey(),
  schoolId: text('school_id').notNull(),
  siifAllocationId: text('siif_allocation_id'),
  fiscalYear: integer('fiscal_year').notNull(),
  allocationAmount: numeric('allocation_amount', { precision: 15, scale: 2 }),
  selectedInterventions: jsonb('selected_interventions'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('idx_modified_siif_util_school_year').on(table.schoolId, table.fiscalYear),
]);
