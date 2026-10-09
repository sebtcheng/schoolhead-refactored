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

/** Strips everything but digits and a single decimal point (max 2 decimals). */
export const sanitizeAmountInput = (text) => {
    const cleaned = String(text).replace(/[^0-9.]/g, '');
    const [whole, ...rest] = cleaned.split('.');
    return rest.length ? `${whole}.${rest.join('').slice(0, 2)}` : whole;
};

export const QUARTER_SHORT = {
    'July-September': 'Jul – Sep',
    'October-December': 'Oct – Dec',
    'January-March': 'Jan – Mar',
};

// Index-aligned with the hook's PERIODS
export const QUARTER_SWATCHES = [
    { bar: 'bg-sky-400', dot: 'bg-sky-400' },
    { bar: 'bg-blue-600', dot: 'bg-blue-600' },
    { bar: 'bg-[#08315F] dark:bg-indigo-400', dot: 'bg-[#08315F] dark:bg-indigo-400' },
];
