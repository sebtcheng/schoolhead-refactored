// ─── useSIIFSubmission ────────────────────────────────────────────────────────
// Encapsulates all data-loading logic for SIIFFormsHub: deadline fetching,
// allocation, draft submission, and derived lock/status flags.
// SIIFFormsHub becomes a pure UI component that reads from this hook.

import { useState, useEffect } from 'react';
import { fetchDeadline, fetchAllocation, fetchSubmission } from '../services/siifService';
import { emptyIntData } from '../constants/siifConstants';
import { logger } from '../../../utils/logger';

/**
 * @param {object} user
 * @param {string} token
 * @returns full form state + setters needed by SIIFFormsHub
 */
export function useSIIFSubmission(user, token) {
    const [loading, setLoading]                     = useState(true);
    const [error, setError]                         = useState(null);
    const [deadline, setDeadline]                   = useState(null);
    const [openDate, setOpenDate]                   = useState(null);
    const [isExpired, setIsExpired]                 = useState(false);
    const [isNotYetOpen, setIsNotYetOpen]           = useState(false);
    const [allocation, setAllocation]               = useState(null);
    const [submissionId, setSubmissionId]           = useState(null);
    const [isLocked, setIsLocked]                   = useState(false);
    const [isDisapproved, setIsDisapproved]         = useState(false);
    const [rejectionReason, setRejectionReason]     = useState(null);
    const [selectedInterventions, setSelectedInterventions] = useState([]);
    const [aral, setAral]                           = useState({ planned: null, subjects: [] });
    const [beneficiaries, setBeneficiaries]         = useState({});
    const [activities, setActivities]               = useState({});
    const [budgets, setBudgets]                     = useState({});
    const [confirmed, setConfirmed]                 = useState({
        interventions: false, beneficiaries: false, activities: false, budget: false,
    });

    useEffect(() => {
        const schoolId = user?.school_id || user?.schoolId || user?.uid || user?.id || user?.sub;
        if (!schoolId) {
            logger.error('SIIF', 'No schoolId found in user session.');
            setLoading(false);
            return;
        }

        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const headers = { Authorization: `Bearer ${token}` };

                // 1. Deadline
                const dlData = await fetchDeadline();
                if (dlData) {
                    setDeadline(dlData.deadline);
                    setOpenDate(dlData.start);
                    const now   = new Date();
                    const end   = dlData.deadline ? new Date(dlData.deadline) : null;
                    const start = dlData.start    ? new Date(dlData.start)    : null;
                    setIsExpired(end   ? now > end   : false);
                    setIsNotYetOpen(start ? now < start : false);
                    const status = start && now < start ? 'NOT YET OPEN'
                                 : end   && now > end   ? 'CLOSED' : 'OPEN';
                    console.log(`🛡️ [SIIF_LOCK] Window Status: ${status}`);
                }

                // 2. Allocation + submission in parallel
                const [allocData, subData] = await Promise.all([
                    fetchAllocation(schoolId, token),
                    fetchSubmission(schoolId, token),
                ]);

                if (allocData) {
                    console.log('💰 [useSIIFSubmission] Allocation:', allocData);
                    setAllocation(allocData);
                }

                if (subData?.success) {
                    const ints = subData.interventions || [];
                    setSubmissionId(subData.submissionId || subData.siif_sub_id || null);
                    setIsLocked(subData.status === 'submitted');
                    setIsDisapproved(subData.status?.toLowerCase() === 'disapproved');
                    setRejectionReason(subData.rejection_reason || subData.rejectionReason || null);
                    setSelectedInterventions(ints);
                    setAral(subData.aral || { planned: null, subjects: [] });
                    setBudgets(subData.budgetEstimates || {});

                    const bens = {};
                    const acts = {};
                    ints.forEach(intId => {
                        const d = subData.interventionData?.[intId] || emptyIntData();
                        bens[intId] = { selectedGrades: d.selectedGrades || [], beneficiaryCounts: d.beneficiaryCounts || {} };
                        acts[intId] = { selectedActivities: d.selectedActivities || {}, otherActivity: d.otherActivity || '' };
                    });
                    setBeneficiaries(bens);
                    setActivities(acts);

                    const nextConfirmed = {
                        interventions: ints.length > 0,
                        beneficiaries: ints.some(id => (bens[id]?.selectedGrades || []).length > 0),
                        activities:    ints.some(id => Object.values(acts[id]?.selectedActivities || {}).flat().length > 0),
                        budget:        ints.some(id => parseFloat(subData.budgetEstimates?.[id]) > 0),
                    };
                    if (subData.status === 'submitted' || subData.status?.toLowerCase() === 'disapproved') {
                        Object.keys(nextConfirmed).forEach(k => (nextConfirmed[k] = true));
                    }
                    setConfirmed(nextConfirmed);
                    if (subData.allocation) setAllocation(subData.allocation);
                }
            } catch (err) {
                console.error('🔥 [useSIIFSubmission] Failed to load data:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [user]);

    return {
        // Deadline
        deadline, openDate, isExpired, isNotYetOpen,
        // Submission meta
        loading, error, submissionId, isLocked, isDisapproved, rejectionReason, allocation,
        // Form state
        selectedInterventions, setSelectedInterventions,
        aral, setAral,
        beneficiaries, setBeneficiaries,
        activities, setActivities,
        budgets, setBudgets,
        confirmed, setConfirmed,
    };
}
