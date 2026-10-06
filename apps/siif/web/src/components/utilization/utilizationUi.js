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

export const STATUS_OPTIONS = [
    {
        value: 'Not Yet Started',
        short: 'Not Started',
        accent: 'bg-slate-300 dark:bg-slate-600',
        active: 'bg-slate-700 shadow-slate-900/20 dark:bg-slate-200',
        activeText: 'text-white dark:text-slate-900',
        hover: 'hover:bg-white hover:text-slate-800 dark:hover:bg-slate-700 dark:hover:text-slate-100',
        dot: 'bg-slate-400',
        chip: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    },
    {
        value: 'Ongoing',
        short: 'Ongoing',
        accent: 'bg-amber-400',
        active: 'bg-amber-600 shadow-amber-600/30',
        activeText: 'text-white',
        hover: 'hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-500/10 dark:hover:text-amber-300',
        dot: 'bg-amber-500',
        chip: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
    },
    {
        value: 'Completed',
        short: 'Completed',
        accent: 'bg-emerald-500',
        active: 'bg-emerald-600 shadow-emerald-600/30',
        activeText: 'text-white',
        hover: 'hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300',
        dot: 'bg-emerald-500',
        chip: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
    },
];

export const statusStyle = (status) =>
    STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];

const DEFAULT_STATUS = 'Not Yet Started';

/** A quarter nobody has filled in yet: no amount, no remarks, default status. */
export const isUntouchedQuarter = (qVal) =>
    !qVal || (
        (!qVal.status || qVal.status === DEFAULT_STATUS) &&
        amountOf(qVal) === 0 &&
        !String(qVal.justification || '').trim()
    );

/**
 * Status to show for a quarter. An untouched quarter carries over the status of
 * the nearest earlier quarter that was filled in (e.g. Jul–Sep "Ongoing" →
 * Oct–Dec opens as "Ongoing"). `inheritedFrom` is that quarter's id, else null.
 */
export const effectiveStatus = (quarterData, periods, quarterId) => {
    const own = quarterData?.[quarterId];
    if (!isUntouchedQuarter(own)) return { status: own.status || DEFAULT_STATUS, inheritedFrom: null };

    const idx = periods.findIndex(p => p.id === quarterId);
    for (let i = idx - 1; i >= 0; i--) {
        const prev = quarterData?.[periods[i].id];
        if (isUntouchedQuarter(prev)) continue;
        return prev.status && prev.status !== DEFAULT_STATUS
            ? { status: prev.status, inheritedFrom: periods[i].id }
            : { status: DEFAULT_STATUS, inheritedFrom: null };
    }
    return { status: DEFAULT_STATUS, inheritedFrom: null };
};
