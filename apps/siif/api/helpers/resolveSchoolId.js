// ─── School ID Resolver ───────────────────────────────────────────────────────
// Resolves a 6-digit school ID from the request context, falling back to a DB
// lookup by email when the ID is missing or is a UUID.

import { safeUsersQuery } from '@shared/db';

export async function resolveSchoolId(schoolId, user) {
    let finalId = schoolId;

    // Trigger recovery if ID is missing, 'undefined', or a long UUID (> 10 chars)
    if (!finalId || finalId === 'undefined' || finalId.length > 10) {
        console.log(`🔎 [SIIF-API] Resolving ID for: ${finalId}...`);

        // 1. Try token properties
        finalId = user?.school_id || user?.schoolId || user?.uid || user?.id || user?.sub;

        // 2. If still a UUID or missing, try database lookup by email in users_database
        if ((!finalId || finalId.length > 10) && user?.email) {
            try {
                const userLookup = await safeUsersQuery(
                    'SELECT school_id FROM user_schoolhead WHERE LOWER(email) = LOWER($1) LIMIT 1',
                    [user.email]
                );
                if (userLookup.rows[0]?.school_id) {
                    finalId = userLookup.rows[0].school_id;
                    console.log(`✅ [SIIF-API] Resolved from database: ${finalId}`);
                }
            } catch (err) {
                console.error('❌ [SIIF-API] Recovery lookup failed:', err.message);
            }
        }
    }
    return finalId;
}
