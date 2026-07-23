// ─── useSIIFDeadline ─────────────────────────────────────────────────────────
// Fetches the global planning window and derives phase states.
// Used by: SIIFFormsHub, SIIFUtilization, SIIFSummary

import { useState, useEffect } from 'react';
import { fetchDeadline } from '../services/siifService';

/**
 * @returns {{
 *   deadline: string|null,
 *   openDate: string|null,
 *   isExpired: boolean,
 *   isNotYetOpen: boolean,
 *   loading: boolean,
 * }}
 */
export function useSIIFDeadline() {
    const [deadline, setDeadline] = useState(null);
    const [openDate, setOpenDate] = useState(null);
    const [isExpired, setIsExpired] = useState(false);
    const [isNotYetOpen, setIsNotYetOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDeadline()
            .then(data => {
                if (!data) return;
                const now = new Date();
                const end   = data.deadline ? new Date(data.deadline) : null;
                const start = data.start    ? new Date(data.start)    : null;

                setDeadline(data.deadline || null);
                setOpenDate(data.start || null);
                setIsExpired(end   ? now > end   : false);
                setIsNotYetOpen(start ? now < start : false);

                const status = start && now < start ? 'NOT YET OPEN'
                             : end   && now > end   ? 'CLOSED'
                             : 'OPEN';
                console.log(`🛡️ [SIIF_LOCK] Window Status: ${status}`);
            })
            .catch(err => console.error('🔥 [useSIIFDeadline] Failed:', err))
            .finally(() => setLoading(false));
    }, []);

    return { deadline, openDate, isExpired, isNotYetOpen, loading };
}
