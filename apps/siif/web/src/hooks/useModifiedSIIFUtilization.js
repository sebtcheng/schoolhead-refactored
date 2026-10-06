// ─── useModifiedSIIFUtilization ───────────────────────────────────────────────
// Hook for the Modified SIIF Utilization Tool.
// Bypasses baseline submission checks and loads directly from modified_siif_utilization
// and siif_allocations.

import { useState, useEffect, useCallback } from 'react';
import { fetchDeadline, fetchModifiedUtilization } from '../services/siifService';

const PERIODS = [
    { id: 'July-September',   label: 'July - September',   full: 'Phase 1: July - September' },
    { id: 'October-December', label: 'October - December', full: 'Phase 2: October - December' },
    { id: 'January-March',    label: 'January - March',    full: 'Phase 3: January - March' },
];

/**
 * @param {object} user
 * @param {string} token
 */
export function useModifiedSIIFUtilization(user, token) {
    const [loading, setLoading]                                 = useState(true);
    const [deadline, setDeadline]                               = useState(null);
    const [activeQuarter, setActiveQuarter]                     = useState('');
    const [viewingQuarter, setViewingQuarter]                   = useState('July-September');
    const [selectedInterventions, setSelectedInterventions]     = useState([]);
    const [utilizationData, setUtilizationData]                 = useState({});
    const [officialAllocation, setOfficialAllocation]           = useState({ allocation_amount: 0, spent_amount: 0 });
    const [lastSavedAt, setLastSavedAt]                         = useState(null);

    // ─── Quarter detection from current date ──────────────────────────────────
    useEffect(() => {
        const month = new Date().getMonth(); // 0-11
        let q = '';
        if (month >= 6 && month <= 8)       q = 'July-September';
        else if (month >= 9 && month <= 11) q = 'October-December';
        else if (month >= 0 && month <= 2)  q = 'January-March';
        else                                q = 'July-September'; // default to Phase 1 if off-season test

        setActiveQuarter(q);
        setViewingQuarter(q || 'July-September');
    }, []);

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
                setLastSavedAt(data.updatedAt || null);
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
        officialAllocation,
        lastSavedAt,
        periods: PERIODS,
        refetch: load,
    };
}
