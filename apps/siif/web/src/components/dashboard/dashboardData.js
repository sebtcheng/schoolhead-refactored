// ─── School SIIF Dashboard Data ────────────────────────────────────────────────
// Pure helpers that turn the school's modified_siif_utilization record into the
// numbers the dashboard shows. Status rules match the RO/SDO monitoring dashboard
// (InsightED-ROSDO siifGeoAggregation.js) so a school sees what the division sees.

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

export const STATUS_KEYS = ['Completed', 'Ongoing', 'Not Started'];

// Matches the School Head utilization cards (Ongoing = amber, Not Started = slate)
export const STATUS_COLORS = {
    Completed: '#10B981',
    Ongoing: '#F59E0B',
    'Not Started': '#94A3B8',
};

const labelFor = (id) =>
    INTERVENTIONS.find(i => i.id === id)?.label ||
    String(id || 'Intervention').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

/** 'Completed' | 'Ongoing' | 'Not Started' — spending with no status counts as Ongoing. */
const normalizeStatus = (raw, amount) => {
    const st = String(raw || '').trim().toLowerCase();
    if (st === 'completed') return 'Completed';
    if (st === 'ongoing') return 'Ongoing';
    if (st.includes('not') || st === 'pending') return 'Not Started';
    return amount > 0 ? 'Ongoing' : 'Not Started';
};

/**
 * One status from several (RO/SDO rule): every one Completed → Completed,
 * nothing or every one Not Started → Not Started, anything mixed → Ongoing.
 */
export const rollupStatus = (statuses) => {
    const unique = new Set(statuses);
    if (unique.size === 0) return 'Not Started';
    if (unique.size === 1) return [...unique][0];
    return 'Ongoing';
};

export const quarterIdsFor = (scope) =>
    scope === ALL_QUARTERS ? DASH_QUARTERS.map(q => q.id) : [scope];

/**
 * @param {string[]} selectedIds   intervention ids the school tracks
 * @param {object}   utilizationData { [interventionId]: { [quarterId]: { amount, status, justification } } }
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
                status: normalizeStatus(raw?.status, amount),
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
            status: rollupStatus(scoped.map(q => q.status)),
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

    const statusCounts = Object.fromEntries(STATUS_KEYS.map(k => [k, 0]));
    interventions.forEach(iv => { statusCounts[iv.status] += 1; });

    return {
        interventions: sorted,
        rankOrder: ranked.map(iv => iv.id),
        quarterTotals,
        scopeUtilized: sorted.reduce((sum, iv) => sum + iv.total, 0),
        allUtilized: interventions.reduce((sum, iv) => sum + iv.allTotal, 0),
        withSpending: sorted.filter(iv => iv.total > 0).length,
        statusCounts,
        // School status uses every quarter status in scope, like the RO/SDO school roster
        schoolStatus: rollupStatus(
            interventions.flatMap(iv => iv.quarters.filter(q => inScope.has(q.id)).map(q => q.status))
        ),
    };
};

export const formatPesoCompact = (val) => {
    const n = Number(val) || 0;
    const abs = Math.abs(n);
    if (abs >= 1e9) return `₱${(n / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `₱${(n / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `₱${(n / 1e3).toFixed(1)}K`;
    return `₱${Math.round(n).toLocaleString('en-PH')}`;
};
