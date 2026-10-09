// ─── Utilization Periods ──────────────────────────────────────────────────────
// Quarter ids, the settings keys that open/lock them, and the sanitizers used
// when a school saves modified_siif_utilization.selected_interventions.

export const PERIOD_IDS = ['July-September', 'October-December', 'January-March'];

// settings.value 'true' = open; anything else (or a missing row) = locked.
// Seeded by sql/siif_v2_utilization_quarter_locks.sql.
export const PERIOD_LOCK_KEYS = {
    'July-September':   'siif_utilization_jul_sep_open',
    'October-December': 'siif_utilization_oct_dec_open',
    'January-March':    'siif_utilization_jan_mar_open',
};

const MAX_ACTIVITIES = 15;
const MAX_ACTIVITY_LENGTH = 200;
const MAX_OTHER_ACTIVITY_LENGTH = 300;

/** Quarter ids that are currently locked, in PERIOD_IDS order. Fails closed. */
export async function getLockedPeriods(db) {
    const { rows } = await db.query(
        'SELECT key, value FROM settings WHERE key = ANY($1)',
        [Object.values(PERIOD_LOCK_KEYS)]
    );
    const open = new Set(
        rows
            .filter(row => String(row.value ?? '').trim().toLowerCase() === 'true')
            .map(row => row.key)
    );
    return PERIOD_IDS.filter(id => !open.has(PERIOD_LOCK_KEYS[id]));
}

/** Amount from a quarter entry (`{ amount }` or a legacy bare amount). */
export const amountOf = (q) =>
    parseFloat(q?.amount !== undefined ? q.amount : q) || 0;

export const emptyQuarter = () => ({ amount: '', justification: '', activities: [], other_activity: '' });

/** True when a quarter holds something worth protecting: an amount, remarks or activities. */
export const hasQuarterEntry = (q) =>
    amountOf(q) > 0 ||
    String(q?.justification ?? '').trim() !== '' ||
    (Array.isArray(q?.activities) && q.activities.length > 0);

/**
 * Keeps only the known quarter fields: { amount, justification, activities, other_activity }.
 * Implementation status is no longer collected, so a status saved earlier is
 * dropped on the school's next save.
 */
export function sanitizeQuarter(q) {
    if (q === null || typeof q !== 'object') {
        // Legacy rows stored a bare amount
        return { ...emptyQuarter(), amount: q === undefined || q === null ? '' : String(q) };
    }
    return {
        amount: q.amount === undefined || q.amount === null ? '' : String(q.amount),
        justification: String(q.justification ?? ''),
        activities: sanitizeActivities(q.activities),
        other_activity: sanitizeOtherActivity(q.other_activity),
    };
}

/** Unique, trimmed, length-capped activity labels. */
export function sanitizeActivities(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    for (const item of list) {
        if (typeof item !== 'string') continue;
        const label = item.trim().slice(0, MAX_ACTIVITY_LENGTH);
        if (label) seen.add(label);
        if (seen.size >= MAX_ACTIVITIES) break;
    }
    return [...seen];
}

export const sanitizeOtherActivity = (text) =>
    String(text ?? '').trim().slice(0, MAX_OTHER_ACTIVITY_LENGTH);
