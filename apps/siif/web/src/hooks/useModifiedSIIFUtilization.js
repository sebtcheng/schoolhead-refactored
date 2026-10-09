// ─── useModifiedSIIFUtilization ───────────────────────────────────────────────
// Hook for the Modified SIIF Utilization Tool.
// Bypasses baseline submission checks and loads directly from modified_siif_utilization
// and siif_allocations.

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchDeadline, fetchModifiedUtilization } from '../services/siifService';

const PERIODS = [
    { id: 'July-September',   label: 'July - September',   full: 'Phase 1: July - September' },
    { id: 'October-December', label: 'October - December', full: 'Phase 2: October - December' },
    { id: 'January-March',    label: 'January - March',    full: 'Phase 3: January - March' },
];

/** Quarter of today's date; April–June (off-season) falls back to Phase 1. */
function currentQuarter() {
    const month = new Date().getMonth(); // 0-11
    if (month >= 9 && month <= 11) return 'October-December';
    if (month >= 0 && month <= 2)  return 'January-March';
    return 'July-September';
}

/**
 * Tab to open on: today's quarter if it is open, else the latest open quarter
 * before it, else the first open one. With every quarter locked, today's (read-only).
 */
function startingQuarter(today, locked) {
    const open = PERIODS.filter(p => !locked.includes(p.id));
    if (open.some(p => p.id === today)) return today;
    const todayIdx = PERIODS.findIndex(p => p.id === today);
    const earlier = open.filter(p => PERIODS.indexOf(p) < todayIdx);
    return (earlier[earlier.length - 1] || open[0])?.id || today;
}

/**
 * @param {object} user
 * @param {string} token
 */
export function useModifiedSIIFUtilization(user, token) {
    const [loading, setLoading]                                 = useState(true);
    const [deadline, setDeadline]                               = useState(null);
    const [activeQuarter]                                       = useState(currentQuarter);
    const [viewingQuarter, setViewingQuarter]                   = useState(currentQuarter);
    const [selectedInterventions, setSelectedInterventions]     = useState([]);
    const [utilizationData, setUtilizationData]                 = useState({});
    const [officialAllocation, setOfficialAllocation]           = useState({ allocation_amount: 0, spent_amount: 0 });
    const [lastSavedAt, setLastSavedAt]                         = useState(null);
    const [plannedActivities, setPlannedActivities]             = useState({});
    const [lockedPeriods, setLockedPeriods]                     = useState([]);
    // The starting tab is picked once, on the first load; refetches keep the user's tab
    const startPicked                                           = useRef(false);

    // ─── Data loading ─────────────────────────────────────────────────────────
    const load = useCallback(async () => {
        const schoolId = user?.school_id || user?.schoolId || user?.id || user?.uid || user?.sub;

        if (!schoolId || schoolId === 'undefined') {
            console.warn('⚠️ [useModifiedSIIFUtilization] No valid schoolId:', user);
            setLoading(false);
            return;
        }

        console.log('🔍 [useModifiedSIIFUtilization] Fetching modified utilization for school:', schoolId);
        try {
            // 1. Fetch deadline (non-blocking)
            try {
                const dlData = await fetchDeadline();
                if (dlData?.deadline) {
                    setDeadline(dlData.deadline);
                }
            } catch (dlErr) {
                console.warn('⚠️ [useModifiedSIIFUtilization] Deadline fetch failed (non-critical):', dlErr.message);
            }

            // 2. Fetch modified utilization and official allocation
            const data = await fetchModifiedUtilization(schoolId, token);
            console.log('📦 [useModifiedSIIFUtilization] Data received:', data);

            if (data?.success) {
                if (data.allocation) {
                    setOfficialAllocation(data.allocation);
                }
                const rawSelected = data.selectedInterventions || [];
                const ids = (data.selectedInterventionIds && data.selectedInterventionIds.length > 0)
                    ? data.selectedInterventionIds
                    : rawSelected.map(i => (typeof i === 'object' && i !== null ? i.id : i));

                setSelectedInterventions(ids);
                setUtilizationData(data.utilizationData || {});
                setPlannedActivities(data.plannedActivities || {});
                setLastSavedAt(data.updatedAt || null);

                const locked = Array.isArray(data.lockedPeriods) ? data.lockedPeriods : [];
                setLockedPeriods(locked);
                if (!startPicked.current) {
                    startPicked.current = true;
                    setViewingQuarter(startingQuarter(currentQuarter(), locked));
                }
            }
        } catch (err) {
            console.error('🔥 [useModifiedSIIFUtilization] Fetch failed:', err);
        } finally {
            setLoading(false);
        }
    }, [user?.school_id, user?.schoolId, user?.id, user?.uid, user?.sub, token]);

    useEffect(() => {
        load();
    }, [load]);

    return {
        loading,
        deadline,
        activeQuarter,
        viewingQuarter,
        setViewingQuarter,
        selectedInterventions,
        setSelectedInterventions,
        utilizationData,
        setUtilizationData,
        plannedActivities,
        lockedPeriods,
        officialAllocation,
        lastSavedAt,
        periods: PERIODS,
        refetch: load,
    };
}
