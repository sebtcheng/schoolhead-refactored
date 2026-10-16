// ─── School SIIF Dashboard Data ────────────────────────────────────────────────
// Pure helpers that turn the school's modified_siif_utilization record into the
// numbers the dashboard shows.

import { amountOf } from '../utilization/utilizationUi';
import { INTERVENTIONS } from '../../constants/siifConstants';

export const ALL_QUARTERS = 'all';

// Same order and ids as the utilization hook's PERIODS
export const DASH_QUARTERS = [
    { id: 'July-September', short: 'Jul – Sep', label: 'July – September', color: '#0284C7' },
    { id: 'October-December', short: 'Oct – Dec', label: 'October – December', color: '#F59E0B' },
    { id: 'January-March', short: 'Jan – Mar', label: 'January – March', color: '#10B981' },
];

// Same palette as the RO/SDO Intervention Spending card
export const INTERVENTION_PALETTE = [
    '#0284C7', '#08315F', '#10B981', '#F59E0B',
    '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
    '#6366F1', '#06B6D4', '#84CC16', '#D946EF',
];

const labelFor = (id) =>
    INTERVENTIONS.find(i => i.id === id)?.label ||
    String(id || 'Intervention').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export const quarterIdsFor = (scope) =>
    scope === ALL_QUARTERS ? DASH_QUARTERS.map(q => q.id) : [scope];

/**
 * @param {string[]} selectedIds   intervention ids the school tracks
 * @param {object}   utilizationData { [interventionId]: { [quarterId]: { amount, justification } } }
 * @param {string}   scope          ALL_QUARTERS or a quarter id
 */
export const buildDashboard = (selectedIds, utilizationData, scope) => {
    const inScope = new Set(quarterIdsFor(scope));

    const interventions = (selectedIds || []).map(id => {
        const data = utilizationData?.[id] || {};
        const quarters = DASH_QUARTERS.map(q => {
            const raw = data[q.id];
            const amount = amountOf(raw);
            return {
                ...q,
                amount,
                justification: String(raw?.justification || '').trim(),
            };
        });
        const scoped = quarters.filter(q => inScope.has(q.id));
        return {
            id,
            label: labelFor(id),
            quarters,
            allTotal: quarters.reduce((sum, q) => sum + q.amount, 0),
            total: scoped.reduce((sum, q) => sum + q.amount, 0),
        };
    });

    // Colors follow the all-quarters ranking so an intervention keeps its color on every filter
    const ranked = [...interventions].sort((a, b) => b.allTotal - a.allTotal || a.label.localeCompare(b.label));
    ranked.forEach((iv, i) => { iv.color = INTERVENTION_PALETTE[i % INTERVENTION_PALETTE.length]; });

    const sorted = [...interventions].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));

    const quarterTotals = DASH_QUARTERS.map(q => ({
        ...q,
        amount: interventions.reduce((sum, iv) => sum + iv.quarters.find(x => x.id === q.id).amount, 0),
        withSpending: interventions.filter(iv => iv.quarters.find(x => x.id === q.id).amount > 0).length,
    }));

    return {
        interventions: sorted,
        rankOrder: ranked.map(iv => iv.id),
        quarterTotals,
        scopeUtilized: sorted.reduce((sum, iv) => sum + iv.total, 0),
        allUtilized: interventions.reduce((sum, iv) => sum + iv.allTotal, 0),
        withSpending: sorted.filter(iv => iv.total > 0).length,
    };
};

/** Forms completion % of the optional SIIF plan (same rules as the original dashboard). */
export const formsCompletionOf = (submission) => {
    if (!submission) return 0;
    const dbPct = submission.form_completion_percentage ?? submission.formCompletionPercentage;
    if (dbPct !== undefined && dbPct !== null && !isNaN(parseInt(dbPct, 10))) return parseInt(dbPct, 10);

    const status = String(submission.status || '').toLowerCase();
    if (status === 'submitted' || status === 'reviewed') return 100;

    const ints = Object.values(submission.interventionData || {});
    const learners = ints.reduce((s, d) =>
        s + Object.values(d.beneficiaryCounts || {}).reduce((a, v) => a + (parseInt(v, 10) || 0), 0), 0);
    const hasActivity = ints.some(d =>
        Object.values(d.selectedActivities || {}).flat().filter(Boolean).length > 0 ||
        String(d.otherActivity || '').trim().length > 0);

    let count = 0;
    if ((submission.priorityAreas || []).length > 0) count++;
    if ((submission.interventions || []).length > 0) count++;
    if (learners > 0) count++;
    if (hasActivity) count++;
    return Math.round((Math.min(count, 5) / 5) * 100);
};

export const formatPesoCompact = (val) => {
    const n = Number(val) || 0;
    const abs = Math.abs(n);
    if (abs >= 1e9) return `₱${(n / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `₱${(n / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `₱${(n / 1e3).toFixed(1)}K`;
    return `₱${Math.round(n).toLocaleString('en-PH')}`;
};
