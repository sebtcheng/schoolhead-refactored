import { pgTable, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';

/**
 * Schools IERN Master Registry Table Schema (Drizzle ORM)
 * Master directory of 46,000+ national schools with geographic and administrative metadata.
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
