// ─── School Details Resolver ───────────────────────────────────────────────────
// Resolves authoritative school_name, region, division, and district from the
// master `schools_iern` table in users_database.

import { safeUsersQuery } from '@shared/db';

/**
 * Resolves school details from master schools_iern table.
 * @param {string|number} schoolId
 * @returns {Promise<{ school_name: string|null, region: string|null, division: string|null, district: string|null }|null>}
 */
export async function resolveSchoolDetails(schoolId) {
    if (!schoolId) return null;

    try {
        const sId = String(schoolId);
        const query = `
            SELECT school_name, region, division, district
            FROM schools_iern
            WHERE school_id = $1 OR iern = $1
            LIMIT 1
        `;
        const res = await safeUsersQuery(query, [sId]);
        if (res.rows.length > 0) {
            const row = res.rows[0];
            return {
                school_name: row.school_name || null,
                region: row.region || null,
                division: row.division || null,
                district: row.district || null,
            };
        }
    } catch (err) {
        console.error('❌ [SIIF-API] resolveSchoolDetails error:', err.message);
    }
    return null;
}
