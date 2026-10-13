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
const MAX_EXPENSES = 100;
const MAX_EXPENSE_ID_LENGTH = 40;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

const timestampOrNull = (v) => (typeof v === 'string' && ISO_TIMESTAMP.test(v) ? v : null);

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
 * Keeps only the known quarter fields:
 * { amount, justification, activities, other_activity, expenses }.
 * When the quarter has spending entries, `amount` is recomputed as their sum,
 * so a client can't send a total that disagrees with its entries.
 * Implementation status is no longer collected, so a status saved earlier is
 * dropped on the school's next save.
 */
export function sanitizeQuarter(q) {
    if (q === null || typeof q !== 'object') {
        // Legacy rows stored a bare amount
        return { ...emptyQuarter(), amount: q === undefined || q === null ? '' : String(q) };
    }
    const expenses = sanitizeExpenses(q.expenses);
    const quarter = {
        amount: q.amount === undefined || q.amount === null ? '' : String(q.amount),
        justification: String(q.justification ?? ''),
        activities: sanitizeActivities(q.activities),
        other_activity: sanitizeOtherActivity(q.other_activity),
    };
    if (expenses.length) {
        quarter.expenses = expenses;
        quarter.amount = String(Math.round(expenses.reduce((sum, e) => sum + Number(e.amount), 0) * 100) / 100);
    }
    return quarter;
}

/**
 * Well-formed spending entries: { id, amount, legacy?, recorded_at?, updated_at? } with
 * amount > 0 (max 2 decimals). Spending is tracked per quarter only, so any `date`
 * (sent by older clients, or stored before dates were dropped) is discarded.
 * Timestamps pass through here only so stored ones survive; stampExpenses() decides
 * their values. Malformed entries are dropped.
 */
export function sanitizeExpenses(list) {
    if (!Array.isArray(list)) return [];
    const out = [];
    const ids = new Set();
    for (const e of list) {
        if (out.length >= MAX_EXPENSES) break;
        if (!e || typeof e !== 'object') continue;
        const id = String(e.id ?? '').slice(0, MAX_EXPENSE_ID_LENGTH);
        const amount = Math.round(parseFloat(e.amount) * 100) / 100;
        if (!id || ids.has(id) || !Number.isFinite(amount) || amount <= 0) continue;
        ids.add(id);
        const entry = e.legacy === true ? { id, amount: String(amount), legacy: true } : { id, amount: String(amount) };
        const recordedAt = timestampOrNull(e.recorded_at);
        const updatedAt = timestampOrNull(e.updated_at);
        if (recordedAt) entry.recorded_at = recordedAt;
        if (updatedAt) entry.updated_at = updatedAt;
        out.push(entry);
    }
    return out;
}

/**
 * Server-side timestamps for a sanitized quarter's entries, so the client can't
 * backdate them: an entry seen for the first time gets recorded_at = now; a known
 * entry keeps its stored recorded_at, and gets updated_at = now when its amount
 * changed. Carried-over legacy entries were recorded before tracking began.
 */
export function stampExpenses(quarter, storedQuarter, nowIso) {
    if (!Array.isArray(quarter?.expenses)) return quarter;
    const storedById = new Map(sanitizeExpenses(storedQuarter?.expenses).map(e => [e.id, e]));
    quarter.expenses = quarter.expenses.map(entry => {
        // Whatever timestamps the client sent are dropped; only the server's count
        const e = { ...entry };
        delete e.recorded_at;
        delete e.updated_at;
        const prev = storedById.get(e.id);
        if (!prev) return e.legacy ? e : { ...e, recorded_at: nowIso };
        const changed = prev.amount !== e.amount;
        const updatedAt = changed ? nowIso : prev.updated_at;
        return {
            ...e,
            ...(prev.recorded_at ? { recorded_at: prev.recorded_at } : {}),
            ...(updatedAt ? { updated_at: updatedAt } : {}),
        };
    });
    return quarter;
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
