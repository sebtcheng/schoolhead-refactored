// ─── SIIF API Service ─────────────────────────────────────────────────────────
// All fetch() calls for the SIIF module go through this service.
// Components and pages MUST NOT call fetch() directly — import from here.
//
// Architecture Guardian Rule 4: no fetch in components/pages.
// Architecture Guardian Rule 5: named exports only.

import { api } from '../../../lib/api';

// ─── Settings ─────────────────────────────────────────────────────────────────

/**
 * Fetch the global planning deadline window.
 * Public endpoint — no auth required.
 * @returns {{ deadline: string, start: string, serverTime: string }}
 */
export async function fetchDeadline() {
    const res = await fetch(api('/siif/settings/deadline'));
    if (!res.ok) throw new Error(`Deadline fetch failed: ${res.status}`);
    return res.json();
}

// ─── Allocation ───────────────────────────────────────────────────────────────

/**
 * Fetch a school's official SIIF budget allocation.
 * @param {string} schoolId
 * @param {string} token
 */
export async function fetchAllocation(schoolId, token) {
    const res = await fetch(api(`/siif/allocation/${schoolId}`), {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Allocation fetch failed: ${res.status}`);
    return res.json();
}

// ─── Submission ───────────────────────────────────────────────────────────────

/**
 * Fetch a school's full SIIF submission including interventions, beneficiaries,
 * activities, budget estimates, utilization, and allocation.
 * @param {string} schoolId
 * @param {string} token
 * @returns {object|null} submission data or null if not found
 */
export async function fetchSubmission(schoolId, token) {
    const res = await fetch(api(`/siif/submission/${schoolId}`), {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Submission fetch failed: ${res.status}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
}

/**
 * Save a draft or submit the final SIIF plan.
 * @param {object} payload — full submission payload including schoolId, interventions, etc.
 * @param {string} token
 * @returns {{ success: boolean, submissionId: string }}
 */
export async function submitPlan(payload, token) {
    const res = await fetch(api('/siif/submit'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok || !data.success) {
        throw new Error(data.error || `Submit failed: ${res.status}`);
    }
    return data;
}

// ─── Utilization ──────────────────────────────────────────────────────────────

/**
 * Save quarterly utilization amounts for a submission.
 * @param {string} submissionId
 * @param {object} utilizationData — { [interventionType]: { [quarter]: amount } }
 * @param {string} token
 */
export async function updateUtilization(submissionId, utilizationData, token) {
    const res = await fetch(api('/siif/utilization'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ submissionId, utilizationData }),
    });
    if (!res.ok) throw new Error(`Utilization update failed: ${res.status}`);
    return res.json();
}
