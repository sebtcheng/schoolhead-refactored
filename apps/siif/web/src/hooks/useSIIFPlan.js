// ─── useSIIFPlan ─────────────────────────────────────────────────────────────
// Loads the school's allocation and optional SIIF plan (Forms tab) for the
// Dashboard's plan overview. The plan never gates Utilization, so a missing plan
// or a failed fetch resolves to `submission: null` instead of breaking the page.

import { useState, useEffect } from 'react';
import { fetchAllocation, fetchSubmission } from '../services/siifService';
import { logger } from '../utils/logger';

const DEFAULT_ALLOCATION = {
    allocation_amount: '0.00',
    spent_amount: '0.00',
    remaining_balance: '0.00',
    fiscal_year: new Date().getFullYear(),
    school_name: '',
};

/**
 * @returns {{ loading: boolean, allocation: object, submission: object|null }}
 */
export function useSIIFPlan(user, token) {
    const schoolId = user?.school_id || user?.schoolId || user?.uid || user?.id || user?.sub;
    const requestKey = schoolId && token ? `${schoolId}|${token}` : null;
    // Result is tagged with the request it answers; loading is derived, not set
    const [result, setResult] = useState({ key: null, allocation: DEFAULT_ALLOCATION, submission: null });

    useEffect(() => {
        if (!requestKey) return undefined;
        let cancelled = false;
        Promise.all([
            fetchAllocation(schoolId, token).catch(err => {
                logger.error('SIIF', 'Allocation fetch failed', err);
                return null;
            }),
            fetchSubmission(schoolId, token).catch(err => {
                logger.error('SIIF', 'Plan fetch failed (dashboard continues without it)', err);
                return null;
            }),
        ]).then(([allocData, subData]) => {
            if (cancelled) return;
            setResult({
                key: requestKey,
                allocation: allocData || DEFAULT_ALLOCATION,
                submission: subData?.success ? subData : null,
            });
        });
        return () => { cancelled = true; };
    }, [requestKey, schoolId, token]);

    const current = result.key === requestKey;
    return {
        loading: !!requestKey && !current,
        allocation: current ? result.allocation : DEFAULT_ALLOCATION,
        submission: current ? result.submission : null,
    };
}
