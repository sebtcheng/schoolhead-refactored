// ─── useSIIFUtilization ───────────────────────────────────────────────────────
// Encapsulates all data fetching and quarter-detection logic for SIIFUtilization.
// Replaces the two useEffects that previously lived directly in the page component.

import { useState, useEffect } from 'react';
import { fetchDeadline, fetchSubmission } from '../services/siifService';

const PERIODS = [
    { id: 'July-September',   label: 'July - September',   full: 'Phase 1: July - September' },
    { id: 'October-December', label: 'October - December', full: 'Phase 2: October - December' },
    { id: 'January-March',    label: 'January - March',    full: 'Phase 3: January - March' },
];

/**
 * @param {object} user
 * @param {string} token
 * @returns {{
 *   loading: boolean,
 *   deadline: string|null,
 *   isExpired: boolean,
 *   activeQuarter: string,       // '' when off-season
 *   viewingQuarter: string,
 *   setViewingQuarter: function,
 *   submission: object|null,
 *   utilizationData: object,
 *   officialAllocation: object,
 *   periods: Array,
 * }}
 */
export function useSIIFUtilization(user, token) {
    const [loading, setLoading]                   = useState(true);
    const [deadline, setDeadline]                 = useState(null);
    const [isExpired, setIsExpired]               = useState(false);
    const [activeQuarter, setActiveQuarter]       = useState('');
    const [viewingQuarter, setViewingQuarter]     = useState('July-September');
    const [submission, setSubmission]             = useState(null);
    const [utilizationData, setUtilizationData]   = useState({});
    const [officialAllocation, setOfficialAllocation] = useState({ allocation_amount: 0, spent_amount: 0 });

    // ─── Quarter detection from current date ──────────────────────────────
    useEffect(() => {
        if (!deadline) return;

        const month = new Date().getMonth(); // 0-11
        let q = '';
        if (month >= 6 && month <= 8)  q = 'July-September';
        else if (month >= 9 && month <= 11) q = 'October-December';
        else if (month >= 0 && month <= 2)  q = 'January-March';
        // Months 3-5 (April-June) = off-season: q stays ''

        setActiveQuarter(q);
        if (q) setViewingQuarter(q);
        // If off-season, keep viewingQuarter at default for display purposes
    }, [deadline]);

    // ─── Data loading ─────────────────────────────────────────────────────
    useEffect(() => {
        const schoolId = user?.school_id || user?.schoolId || user?.id || user?.uid || user?.sub;

        if (!schoolId || schoolId === 'undefined') {
            console.warn('⚠️ [useSIIFUtilization] No valid schoolId:', user);
            setLoading(false);
            return;
        }

        const load = async () => {
            console.log('🔍 [useSIIFUtilization] Fetching for school:', schoolId);
            try {
                // 1. Deadline
                try {
                    const dlData = await fetchDeadline();
                    if (dlData?.deadline) {
                        setDeadline(dlData.deadline);
                        setIsExpired(new Date() > new Date(dlData.deadline));
                        console.log(`🛡️ [SIIF_LOCK] Utilization Phase: ${new Date() > new Date(dlData.deadline) ? 'ACTIVE' : 'LOCKED'}`);
                    }
                } catch (dlErr) {
                    console.error('🔥 [useSIIFUtilization] Deadline fetch failed:', dlErr);
                }

                // 2. Submission + allocation
                const data = await fetchSubmission(schoolId, token);
                console.log('📦 [useSIIFUtilization] Data received:', data);

                if (data?.success && data?.submission) {
                    console.log('✅ [useSIIFUtilization] Submission found. Status:', data.submission.status);
                    setSubmission(data.submission);
                    setUtilizationData(data.utilization || {});
                    if (data.allocation) setOfficialAllocation(data.allocation);
                } else {
                    console.warn('⚠️ [useSIIFUtilization] No valid submission found');
                }
            } catch (err) {
                console.error('🔥 [useSIIFUtilization] Fetch failed:', err);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [user?.school_id, user?.schoolId, user?.id, user?.uid, token]);

    return {
        loading,
        deadline,
        isExpired,
        activeQuarter,
        viewingQuarter,
        setViewingQuarter,
        submission,
        utilizationData,
        setUtilizationData,
        officialAllocation,
        periods: PERIODS,
    };
}
