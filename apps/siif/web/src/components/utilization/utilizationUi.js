// ─── Utilization UI Helpers ───────────────────────────────────────────────────
// Presentation-only helpers shared by the SIIF Utilization page components.

/** Reads an amount from a quarter entry (object `{ amount }` or legacy raw value). */
export const amountOf = (qVal) =>
    parseFloat(qVal?.amount !== undefined ? qVal.amount : qVal) || 0;

export const formatPeso = (value, { decimals = 2 } = {}) =>
    `₱${(Number(value) || 0).toLocaleString('en-PH', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    })}`;

/** Short "last saved" label: time only if today, else date + time. */
export const formatSavedAt = (value) => {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    const sameDay = d.toDateString() === new Date().toDateString();
    return sameDay
        ? d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
        : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

/** Formats a raw numeric string with thousands separators for display in inputs. */
export const formatAmountInput = (raw) => {
    if (raw === '' || raw === null || raw === undefined) return '';
    const num = parseFloat(raw);
    if (Number.isNaN(num)) return '';
    return num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Strips everything but digits and a single decimal point (max 2 decimals),
 * and drops leading zeros: "0020" → "20", ".5" → "0.5", "0.50" stays.
 */
export const sanitizeAmountInput = (text) => {
    const cleaned = String(text).replace(/[^0-9.]/g, '');
    const [rawWhole, ...rest] = cleaned.split('.');
    let whole = rawWhole.replace(/^0+(?=\d)/, '');
    if (rest.length && whole === '') whole = '0';
    return rest.length ? `${whole}.${rest.join('').slice(0, 2)}` : whole;
};

// ─── Spending entries ─────────────────────────────────────────────────────────
// A quarter's amount is the sum of its spending entries (tracked per quarter, no dates):
// quarter.expenses = [{ id, amount }]. Amounts saved before entries existed show as
// one "Previously recorded" entry.

export const LEGACY_EXPENSE_ID = 'legacy';

/** The quarter's entries; an old amount with no entries becomes one legacy entry. */
export const expensesOf = (q) => {
    if (Array.isArray(q?.expenses) && q.expenses.length) return q.expenses;
    const amount = amountOf(q);
    return amount > 0 ? [{ id: LEGACY_EXPENSE_ID, amount: String(amount), legacy: true }] : [];
};

/** Sum of entry amounts, rounded to centavos. */
export const sumExpenses = (list) =>
    Math.round(list.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0) * 100) / 100;

export const newExpenseId = () =>
    `e_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Today in Manila as YYYY-MM-DD (the server checks "no future dates" the same way). */
export const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

const QUARTER_RANGE = {
    // [first month, last month, last day, year offset from the fiscal year]
    'July-September':   ['07', '09', '30', 0],
    'October-December': ['10', '12', '31', 0],
    'January-March':    ['01', '03', '31', 1],
};

/**
 * Dates a spending entry may use for a quarter: inside the quarter and not after today.
 * Phase 3 (Jan–Mar) falls in the year after the fiscal year's July start.
 * `notStarted` is true when the whole quarter is still in the future.
 */
export const quarterDateRange = (periodId, fiscalYear) => {
    const [startM, endM, endD, offset] = QUARTER_RANGE[periodId] || QUARTER_RANGE['July-September'];
    const year = (parseInt(fiscalYear, 10) || new Date().getFullYear()) + offset;
    const min = `${year}-${startM}-01`;
    const end = `${year}-${endM}-${endD}`;
    const today = todayIso();
    return { min, max: end < today ? end : today, notStarted: min > today };
};

export const QUARTER_SHORT = {
    'July-September': 'Jul – Sep',
    'October-December': 'Oct – Dec',
    'January-March': 'Jan – Mar',
};
