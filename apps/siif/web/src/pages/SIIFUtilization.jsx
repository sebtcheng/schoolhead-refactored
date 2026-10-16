import React, { useState, useCallback, useEffect, useMemo } from 'react';
// eslint-disable-next-line no-unused-vars
import { AnimatePresence, motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { TbTarget, TbPlus, TbCalendarStats, TbLock, TbLayoutDashboard, TbPencilPlus, TbHistory, TbAlertTriangle, TbArrowRight } from 'react-icons/tb';
import { useModifiedSIIFUtilization } from '../hooks/useModifiedSIIFUtilization';
import { saveModifiedUtilization } from '../services/siifService';
import { INTERVENTIONS, INTERVENTION_ICONS, OTHER_ACTIVITY } from '../constants/siifConstants';
import SiifLoader from '../components/SiifLoader';
import PageTabs from '../components/utilization/PageTabs';
import UtilizationDonut from '../components/utilization/UtilizationDonut';
import QuarterlyDisbursementChart from '../components/dashboard/QuarterlyDisbursementChart';
import { ALL_QUARTERS, buildDashboard } from '../components/dashboard/dashboardData';
import UtilizationHistory from '../components/utilization/UtilizationHistory';
import QuarterTabs from '../components/utilization/QuarterTabs';
import InterventionSelector from '../components/utilization/InterventionSelector';
import InterventionCard from '../components/utilization/InterventionCard';
import SaveBar from '../components/utilization/SaveBar';
import ExpenseModal from '../components/utilization/ExpenseModal';
import { UtilizationToast, ConfirmDialog } from '../components/utilization/UtilizationFeedback';
import { useUnsavedChanges } from '../context/unsavedChanges';
import {
    amountOf,
    expensesOf,
    sumExpenses,
    newExpenseId,
    quarterDateRange,
    formatPeso,
    QUARTER_SHORT,
} from '../components/utilization/utilizationUi';

const NO_ACTIVITIES = [];

/** A quarter's checked activities (older rows have none). */
const activitiesOf = (q) => (Array.isArray(q?.activities) ? q.activities : NO_ACTIVITIES);

/** A quarter worth protecting from removal: an amount, remarks or activities. */
const hasQuarterEntry = (q) =>
    amountOf(q) > 0 || String(q?.justification || '').trim() !== '' || activitiesOf(q).length > 0;

/** At least one real activity, or "Others" with the other activity spelled out. */
const activitiesComplete = (q) => {
    const activities = activitiesOf(q);
    return activities.some(a => a !== OTHER_ACTIVITY) ||
        (activities.includes(OTHER_ACTIVITY) && String(q?.other_activity || '').trim() !== '');
};

/** Comparable form of a quarter, so "unsaved" means the data really differs from the last save. */
const quarterSignature = (q) => {
    const activities = [...activitiesOf(q)].sort();
    return JSON.stringify([
        amountOf(q),
        String(q?.justification || ''),
        activities,
        activities.includes(OTHER_ACTIVITY) ? String(q?.other_activity || '') : '',
        (Array.isArray(q?.expenses) ? q.expenses : []).map(e => [e.id, parseFloat(e.amount) || 0]),
    ]);
};

const roundCents = (n) => Math.round(n * 100) / 100;

// In-page tabs (the sidebar keeps the module-level tabs)
// Dashboard = saved figures (what the division sees); Record Utilization = data collection
const TAB_IDS = ['dashboard', 'record', 'history'];
const DEFAULT_TAB = 'dashboard';
// Links from before the dashboard moved here
const TAB_ALIASES = { overview: 'dashboard' };

const SIIFUtilization = ({ user, token }) => {
    const [saving, setSaving] = useState(false);
    // null = automatic: open only when nothing is tracked yet
    const [selectorOpen, setSelectorOpen] = useState(null);
    const [toast, setToast] = useState(null);
    const [pendingDeactivate, setPendingDeactivate] = useState(null);
    // Set when Save is blocked by missing activities; cards then highlight the checklist
    // of each open quarter that has an amount but no activity
    const [showActivityErrors, setShowActivityErrors] = useState(false);
    // Spending entry being added/edited: { intId, quarterId, expense, label, quarterLabel, totalAllocated, schoolBalance, maxAmount }
    const [expenseEditor, setExpenseEditor] = useState(null);
    const { setGuard } = useUnsavedChanges();
    // The tab lives in the URL (?tab=) so a refresh keeps it; replace keeps Back for leaving the page
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedTab = TAB_ALIASES[searchParams.get('tab')] || searchParams.get('tab');
    const tab = TAB_IDS.includes(requestedTab) ? requestedTab : DEFAULT_TAB;
    const setTab = useCallback((id) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('tab', id);
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    // ─── Modified Utilization Hook ────────────────────────────────────────────
    const {
        loading,
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
        savedSnapshot,
        markSaved,
        periods,
        refetch,
    } = useModifiedSIIFUtilization(user, token);

    // Dashboard tab: disbursement chart + table for all quarters, built from the saved copy
    const dash = useMemo(
        () => buildDashboard(savedSnapshot.selected, savedSnapshot.data, ALL_QUARTERS),
        [savedSnapshot]
    );

    const showToast = useCallback((type, title, message) => {
        setToast({ id: Date.now(), type, title, message });
    }, []);
    const closeToast = useCallback(() => setToast(null), []);
    const cancelDeactivate = useCallback(() => setPendingDeactivate(null), []);
    const closeExpenseEditor = useCallback(() => setExpenseEditor(null), []);

    // ─── Calculations ──────────────────────────────────────────────────────────
    const selectorExpanded = selectorOpen ?? selectedInterventions.length === 0;
    const totalAllocated = parseFloat(officialAllocation?.allocation_amount) || 0;
    const fiscalYear = officialAllocation?.fiscal_year || new Date().getFullYear();

    const calculateTotalUtilized = () => {
        let total = 0;
        selectedInterventions.forEach(intId => {
            const intUtil = utilizationData[intId] || {};
            periods.forEach(p => {
                total += amountOf(intUtil[p.id]);
            });
        });
        return total;
    };

    const totalUtilized = calculateTotalUtilized();
    const isOverAllocation = totalAllocated > 0 && totalUtilized > totalAllocated;
    // The one "what's left" figure shown on the cards and in the Add/Edit dialog:
    // allocation minus everything recorded, unsaved entries included. null = no allocation set.
    const schoolBalance = totalAllocated > 0 ? Math.max(0, roundCents(totalAllocated - totalUtilized)) : null;

    const quarterStats = {};
    periods.forEach(p => {
        let amount = 0;
        let recorded = 0;
        selectedInterventions.forEach(intId => {
            const intUtil = utilizationData[intId] || {};
            amount += amountOf(intUtil[p.id]);
            if (amountOf(intUtil[p.id]) > 0) recorded += 1;
        });
        quarterStats[p.id] = { amount, recorded, total: selectedInterventions.length };
    });
    const viewingLabel = periods.find(p => p.id === viewingQuarter)?.label || viewingQuarter;

    // ─── Quarter locks ─────────────────────────────────────────────────────────
    const allLocked = lockedPeriods.length >= periods.length;
    const isViewingLocked = lockedPeriods.includes(viewingQuarter);
    const hasLockedEntry = (intId) =>
        lockedPeriods.some(p => hasQuarterEntry((utilizationData[intId] || {})[p]));

    // ─── Unsaved changes ───────────────────────────────────────────────────────
    // Compared with the last saved copy, so undoing an edit clears it again.
    // Each card shows its own "Save changes"; the floating bar lists them all.
    const savedSelected = savedSnapshot.selected;
    const isCardDirty = (intId) =>
        !savedSelected.includes(intId) ||
        periods.some(p =>
            quarterSignature((utilizationData[intId] || {})[p.id]) !==
            quarterSignature((savedSnapshot.data[intId] || {})[p.id])
        );
    const dirtyIds = selectedInterventions.filter(isCardDirty);
    const hasUnsavedChanges = !allLocked &&
        (dirtyIds.length > 0 || savedSelected.some(id => !selectedInterventions.includes(id)));
    const changedLabels = dirtyIds.map(id => INTERVENTIONS.find(i => i.id === id)?.label || id);

    // ─── Activities (per quarter) ──────────────────────────────────────────────
    // An open quarter with an amount needs at least one activity. Locked quarters
    // can't be edited, so they never block a save.
    const quarterNeedsActivities = (intId, quarterId) => {
        if (lockedPeriods.includes(quarterId)) return false;
        const q = (utilizationData[intId] || {})[quarterId];
        return amountOf(q) > 0 && !activitiesComplete(q);
    };

    // ─── Toggle Intervention Activation ───────────────────────────────────────
    // Removing is saved right away so a reload can't bring the intervention back
    const deactivateIntervention = async (intId) => {
        const label = INTERVENTIONS.find(i => i.id === intId)?.label || intId;
        const previous = selectedInterventions;
        const next = previous.filter(id => id !== intId);
        setSelectedInterventions(next);

        const result = await persistUtilization(next, 'remove');
        if (result.status === 'saved') {
            showToast('success', `${label} removed`, 'Your school and division records are now up to date.');
        } else if (result.status === 'over') {
            showToast('error', `${label} removed, but not saved yet`,
                'Your other amounts still exceed the school allocation. Adjust them, then click Save.');
        } else {
            setSelectedInterventions(previous);
            showToast('error', `Couldn't remove ${label}`, `${result.message} Nothing was changed.`);
        }
    };

    const handleToggleIntervention = (intId) => {
        if (saving) return;
        const isCurrentlyActive = selectedInterventions.includes(intId);
        const label = INTERVENTIONS.find(i => i.id === intId)?.label || intId;

        if (allLocked) {
            showToast('error', 'Utilization is closed', "All quarters are locked, so interventions can't be changed right now.");
            return;
        }

        if (isCurrentlyActive) {
            if (hasLockedEntry(intId)) {
                showToast('error', `${label} can't be removed`,
                    'It has entries in a locked quarter. Those records have to stay.');
                return;
            }

            // Check if there are entered amounts before removing
            const intUtil = utilizationData[intId] || {};
            const hasData = Object.values(intUtil).some(q => amountOf(q) > 0);

            if (hasData) {
                setPendingDeactivate(intId);
                return;
            }

            deactivateIntervention(intId);
        } else {
            setSelectedInterventions(prev => [...prev, intId]);
            // Initialize empty quarter entries if not yet present
            if (!utilizationData[intId]) {
                const initialQuarterData = {};
                periods.forEach(p => {
                    initialQuarterData[p.id] = { amount: '', justification: '' };
                });
                setUtilizationData(prev => ({ ...prev, [intId]: initialQuarterData }));
            }
        }
    };

    const confirmDeactivate = () => {
        const intId = pendingDeactivate;
        setPendingDeactivate(null);
        if (intId) deactivateIntervention(intId);
    };

    // ─── Utilization Inputs Handlers ──────────────────────────────────────────
    const getOtherTotal = (intId) => {
        let otherTotal = 0;
        selectedInterventions.forEach(id => {
            const intUtil = utilizationData[id] || {};
            periods.forEach(p => {
                if (id === intId && p.id === viewingQuarter) return; // skip this specific field
                otherTotal += amountOf(intUtil[p.id]);
            });
        });
        return otherTotal;
    };

    // ─── Spending entries (the "+" button) ─────────────────────────────────────
    // The amount can't be typed; it's the sum of dated entries for the quarter.
    const setQuarterExpenses = (intId, quarterId, list) => {
        setUtilizationData(prev => ({
            ...prev,
            [intId]: {
                ...(prev[intId] || {}),
                [quarterId]: {
                    ...((prev[intId] || {})[quarterId] || {}),
                    expenses: list,
                    amount: list.length ? String(sumExpenses(list)) : '',
                }
            }
        }));
    };

    const openExpenseEditor = (intId, expense = null) => {
        if (isViewingLocked) return;
        const quarterId = viewingQuarter;
        const own = expense ? parseFloat(expense.amount) || 0 : 0;
        setExpenseEditor({
            intId,
            quarterId,
            expense,
            label: INTERVENTIONS.find(i => i.id === intId)?.label || intId,
            quarterLabel: QUARTER_SHORT[quarterId] || quarterId,
            totalAllocated,
            schoolBalance,
            // What this entry may be without the school going over its allocation;
            // an entry being edited can also reuse its own current amount
            maxAmount: schoolBalance !== null ? roundCents(schoolBalance + own) : Infinity,
        });
    };

    /** Adds the entry, or updates the one being edited. Returns an error message or null. */
    const submitExpense = ({ amount }) => {
        const { intId, quarterId, expense } = expenseEditor;
        const list = expensesOf((utilizationData[intId] || {})[quarterId]);
        const next = expense
            ? list.map(e => (e.id === expense.id ? { id: e.id, amount } : e))
            : [...list, { id: newExpenseId(), amount }];
        const newTotal = getOtherTotal(intId) + sumExpenses(next);
        if (totalAllocated > 0 && roundCents(newTotal) > totalAllocated) {
            return `Over budget. The school allocation is ${formatPeso(totalAllocated)}.`;
        }
        setQuarterExpenses(intId, quarterId, next);
        setExpenseEditor(null);
        return null;
    };

    const deleteExpense = () => {
        const { intId, quarterId, expense } = expenseEditor;
        const list = expensesOf((utilizationData[intId] || {})[quarterId]);
        setQuarterExpenses(intId, quarterId, list.filter(e => e.id !== expense.id));
        setExpenseEditor(null);
    };

    const handleUpdateJustification = (intId, text) => {
        if (isViewingLocked) return;
        setUtilizationData(prev => ({
            ...prev,
            [intId]: {
                ...(prev[intId] || {}),
                [viewingQuarter]: {
                    ...((prev[intId] || {})[viewingQuarter] || {}),
                    justification: text
                }
            }
        }));
    };

    // Activities belong to the quarter being viewed, like the amount
    const handleUpdateActivities = (intId, next) => {
        if (isViewingLocked) return;
        setUtilizationData(prev => ({
            ...prev,
            [intId]: {
                ...(prev[intId] || {}),
                [viewingQuarter]: {
                    ...((prev[intId] || {})[viewingQuarter] || {}),
                    activities: next.activities || [],
                    other_activity: next.other_activity || '',
                }
            }
        }));
    };

    // ─── Persist ───────────────────────────────────────────────────────────────
    // Saves the given intervention list with the current quarter data.
    // `action` is recorded in the audit trail ('save' | 'remove').
    // Resolves to { status: 'saved' | 'over' | 'failed', message? }; callers show the toast.
    const persistUtilization = async (interventionIds, action = 'save') => {
        let nextTotal = 0;
        interventionIds.forEach(intId => {
            const intUtil = utilizationData[intId] || {};
            periods.forEach(p => {
                nextTotal += amountOf(intUtil[p.id]);
            });
        });
        if (totalAllocated > 0 && nextTotal > totalAllocated) {
            return { status: 'over' };
        }

        const schoolId = user?.school_id || user?.schoolId || user?.id || user?.uid || user?.sub;
        if (!schoolId) {
            return { status: 'failed', message: 'School ID could not be identified from your account session.' };
        }

        setSaving(true);
        try {
            // Every quarter is sent as { amount, justification, activities, other_activity }.
            // Implementation status is no longer collected, so any status saved earlier is
            // dropped here. Locked quarters are sent too, but the server keeps what is stored.
            const payloadData = { ...utilizationData };
            interventionIds.forEach(intId => {
                const original = utilizationData[intId] || {};
                const quarters = {};
                periods.forEach(p => {
                    const q = original[p.id];
                    // Legacy rows may hold a bare amount instead of { amount }
                    const isObj = q !== null && typeof q === 'object';
                    const activities = activitiesOf(q);
                    const expenses = isObj && Array.isArray(q.expenses) ? q.expenses : [];
                    quarters[p.id] = {
                        amount: String((isObj ? q.amount : q) ?? ''),
                        justification: isObj ? q.justification || '' : '',
                        activities,
                        // Free text only counts while "Others" is checked
                        other_activity: activities.includes(OTHER_ACTIVITY) ? String(q?.other_activity || '') : '',
                        // Dated spending entries; the server recomputes `amount` from them
                        ...(expenses.length ? { expenses } : {}),
                    };
                });
                payloadData[intId] = quarters;
            });

            // Construct unified selected_interventions containing quarters and subtotal
            const unifiedSelected = interventionIds.map(intId => {
                const intMeta = INTERVENTIONS.find(i => i.id === intId) || { label: intId };
                const quarters = payloadData[intId] || {};
                let totalSpent = 0;
                Object.values(quarters).forEach(q => {
                    totalSpent += amountOf(q);
                });
                return {
                    id: intId,
                    title: intMeta.label || intId,
                    quarters,
                    total_spent: totalSpent
                };
            });

            const payload = {
                schoolId,
                selectedInterventions: unifiedSelected,
                utilizationData: payloadData,
                fiscalYear,
                action,
            };

            console.log('💾 [SIIFUtilization] Saving modified utilization:', payload);
            await saveModifiedUtilization(payload, token);

            setUtilizationData(payloadData);
            markSaved(interventionIds, payloadData);
            refetch();
            return { status: 'saved' };
        } catch (err) {
            console.error('🔥 [SIIFUtilization] Save failed:', err);
            return { status: 'failed', message: err.message };
        } finally {
            setSaving(false);
        }
    };

    // ─── Save Handler ──────────────────────────────────────────────────────────
    // Resolves true when the save went through
    const handleSave = async () => {
        if (saving || allLocked) return false;

        const missing = [];
        periods.forEach(p => selectedInterventions.forEach(intId => {
            if (quarterNeedsActivities(intId, p.id)) missing.push({ intId, quarterId: p.id });
        }));
        if (missing.length) {
            setShowActivityErrors(true);
            setTab('record');
            // Jump to the first quarter that needs attention, unless it's the one on screen
            if (!missing.some(m => m.quarterId === viewingQuarter)) setViewingQuarter(missing[0].quarterId);
            const names = missing.map(({ intId, quarterId }) =>
                `${INTERVENTIONS.find(i => i.id === intId)?.label || intId} (${QUARTER_SHORT[quarterId] || quarterId})`
            ).join(', ');
            showToast('error', 'Activities needed',
                `Check at least one activity for: ${names}. Every quarter with an amount needs one.`);
            return false;
        }

        const result = await persistUtilization(selectedInterventions);
        if (result.status === 'saved') {
            setShowActivityErrors(false);
            showToast('success', 'Utilization updates saved', 'Your school and division records are now up to date.');
            return true;
        }
        if (result.status === 'over') {
            showToast('error', 'Over allocation limit',
                `Total utilization (${formatPeso(totalUtilized)}) exceeds the school allocation (${formatPeso(totalAllocated)}). Please adjust your figures before saving.`);
        } else {
            showToast('error', 'Error saving updates', result.message);
        }
        return false;
    };

    // Warn before a reload / tab close throws away edits that were never saved
    // (browsers only allow their own dialog here, not a SweetAlert)
    useEffect(() => {
        if (!hasUnsavedChanges) return undefined;
        const warn = (e) => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [hasUnsavedChanges]);

    // Let the SIIF nav ask before leaving with unsaved edits. Runs every render so
    // the guard always holds the latest data and save handler.
    useEffect(() => {
        setGuard({ isDirty: hasUnsavedChanges, canSave: !isOverAllocation, save: handleSave });
    });
    useEffect(() => () => setGuard(null), [setGuard]);

    if (loading) {
        return <SiifLoader text="Loading Utilization Tracker..." />;
    }

    const viewingRange = quarterDateRange(viewingQuarter, fiscalYear);
    const schoolId = user?.school_id || user?.schoolId || user?.id || user?.uid || user?.sub;

    // ─── Dashboard + History data ──────────────────────────────────────────────
    // The Dashboard tab shows saved figures; History also lists unsaved entries.
    const interventionLabel = (intId) => INTERVENTIONS.find(i => i.id === intId)?.label || intId;
    const quarterEntries = (quarterId, selected = selectedInterventions, data = utilizationData) => selected.flatMap(intId =>
        expensesOf((data[intId] || {})[quarterId]).map(e => ({
            ...e,
            key: `${intId}-${quarterId}-${e.id}`,
            intId,
            quarterId,
            label: interventionLabel(intId),
            intervention: interventionLabel(intId),
            quarter: QUARTER_SHORT[quarterId] || quarterId,
        }))
    );
    const savedQuarterAmount = (quarterId) => savedSelected.reduce(
        (sum, intId) => sum + amountOf((savedSnapshot.data[intId] || {})[quarterId]), 0
    );
    const savedUtilized = periods.reduce((sum, p) => sum + savedQuarterAmount(p.id), 0);
    const savedProgress = totalAllocated > 0 ? (savedUtilized / totalAllocated) * 100 : 0;
    const savedRemaining = Math.max(0, totalAllocated - savedUtilized);
    // "Unsaved" means the entry differs from the last save (same check as the Save bar),
    // not whether it has a timestamp: entries saved before tracking existed have none.
    const savedEntryOf = (e) => (savedSelected.includes(e.intId)
        ? expensesOf((savedSnapshot.data[e.intId] || {})[e.quarterId]).find(x => x.id === e.id)
        : null);
    const historyEntries = periods.flatMap(p => quarterEntries(p.id)).map(e => {
        const saved = savedEntryOf(e);
        const unsaved = !saved ||
            (parseFloat(saved.amount) || 0) !== (parseFloat(e.amount) || 0);
        return unsaved
            ? { ...e, unsaved: true }
            : { ...e, unsaved: false, recorded_at: saved.recorded_at, updated_at: saved.updated_at };
    }).sort((a, b) => {
        // Unsaved first, then newest activity; entries from before tracking go last
        const rank = (e) => (e.unsaved ? 0 : e.legacy ? 2 : 1);
        const stamp = (e) => String(e.updated_at || e.recorded_at || '');
        return rank(a) - rank(b) || stamp(b).localeCompare(stamp(a));
    });

    const tabs = [
        { id: 'dashboard', label: 'Dashboard', icon: <TbLayoutDashboard size={16} /> },
        { id: 'record', label: 'Record Utilization', icon: <TbPencilPlus size={16} />, dot: hasUnsavedChanges },
        { id: 'history', label: 'History', icon: <TbHistory size={16} /> },
    ];

    const pendingLabel = INTERVENTIONS.find(i => i.id === pendingDeactivate)?.label || pendingDeactivate;

    return (
        <main className="w-full pt-3 sm:pt-4 lg:pt-6 pb-36 text-lg siif-utilization-page">

            {/* ── Topbar / Header ── */}
            <header className="topbar print:hidden mb-6">
                <div className="page-title">
                    <p className="eyebrow">
                        DEPARTMENT OF EDUCATION | HUMAN RESOURCE AND ORGANIZATIONAL DEVELOPMENT AND INFRASTRUCTURE
                    </p>
                    <h1>School Innovation and Improvement Fund</h1>
                    <p className="mt-1 text-xs font-bold uppercase tracking-wider text-sky-200/90">
                        Quarterly Utilization Input Tool
                    </p>
                </div>

                {/* Compact on phones (icon hidden) so it fits the header's white corner */}
                <div className="siif-topbar-actions shrink-0">
                    <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-white px-2.5 py-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.08)] sm:rounded-2xl sm:px-4 sm:py-2.5">
                        <span className="hidden h-9 w-9 items-center justify-center rounded-xl bg-[#08315F] text-white sm:flex">
                            <TbCalendarStats size={18} />
                        </span>
                        <div className="text-right leading-tight sm:text-left">
                            <small className="block text-[8px] font-extrabold uppercase tracking-wider text-slate-500 sm:text-[10px]">Fiscal Year</small>
                            <strong className="block text-sm font-black text-[#08315F] sm:text-lg">FY {fiscalYear}</strong>
                        </div>
                    </div>
                </div>
            </header>

            {/* ── In-page tabs ── */}
            <PageTabs tabs={tabs} value={tab} onChange={setTab} idPrefix="siif-util" />

            {/* ── Dashboard: donut (30%) + disbursement chart (70%), then the table ── */}
            {tab === 'dashboard' && (
                <div role="tabpanel" id="siif-util-panel-dashboard" aria-labelledby="siif-util-dashboard" className="mb-8">
                    {hasUnsavedChanges && (
                        <div
                            role="status"
                            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/10"
                        >
                            <p className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-200">
                                <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-400" />
                                Showing saved figures. You have unsaved changes in Record Utilization.
                            </p>
                            <button
                                type="button"
                                onClick={() => setTab('record')}
                                className="cursor-pointer rounded-lg border-0 bg-amber-100 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-amber-800 hover:bg-amber-200 dark:bg-amber-500/20 dark:text-amber-200"
                            >
                                Review changes
                            </button>
                        </div>
                    )}

                    {/* Donut (30%) beside the disbursement chart (70%); the same figures as a table underneath */}
                    <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-10">
                        <div className="lg:col-span-3">
                            <UtilizationDonut
                                fiscalYear={fiscalYear}
                                totalAllocated={totalAllocated}
                                totalUtilized={savedUtilized}
                                remainingBalance={savedRemaining}
                                overallProgress={savedProgress}
                                remarks={officialAllocation?.remarks}
                            />
                        </div>
                        <div className="lg:col-span-7">
                            {dash.interventions.length > 0 ? (
                                <QuarterlyDisbursementChart interventions={dash.interventions} rankOrder={dash.rankOrder} view="chart" />
                            ) : (
                                <section className="flex h-full flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900">
                                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
                                        <TbAlertTriangle size={22} />
                                    </span>
                                    <h2 className="text-base font-black text-[#08315F] dark:text-white">No interventions tracked yet</h2>
                                    <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
                                        Choose your interventions and enter quarterly spending in Record Utilization. Your charts will appear here once you save.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setTab('record')}
                                        className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-xl border-0 bg-[#08315F] px-4 py-2.5 text-xs font-black text-white shadow-md transition-all hover:bg-[#0B3F7A]"
                                    >
                                        Go to Record Utilization <TbArrowRight size={14} />
                                    </button>
                                </section>
                            )}
                        </div>
                    </div>

                    {dash.interventions.length > 0 && (
                        <QuarterlyDisbursementChart interventions={dash.interventions} rankOrder={dash.rankOrder} view="table" />
                    )}
                </div>
            )}

            {/* ── History ── */}
            {tab === 'history' && (
                <div role="tabpanel" id="siif-util-panel-history" aria-labelledby="siif-util-history" className="mb-8">
                    <UtilizationHistory
                        schoolId={schoolId}
                        token={token}
                        fiscalYear={fiscalYear}
                        entries={historyEntries}
                        refreshKey={lastSavedAt}
                    />
                </div>
            )}

            {/* ── Record Utilization ── */}
            {tab === 'record' && (
                <div role="tabpanel" id="siif-util-panel-record" aria-labelledby="siif-util-record">

                {/* ── Quarterly Navigation Tabs ── */}
                <QuarterTabs
                    periods={periods}
                    activeQuarter={activeQuarter}
                    viewingQuarter={viewingQuarter}
                    onSelect={setViewingQuarter}
                    quarterStats={quarterStats}
                    lockedPeriods={lockedPeriods}
                />

                {/* ── Lock notice ── */}
                {(allLocked || isViewingLocked) && (
                    <div
                        role="status"
                        className="mb-6 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60"
                    >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                            <TbLock size={16} />
                        </span>
                        <div className="min-w-0">
                            <p className="text-sm font-black text-slate-800 dark:text-slate-100">
                                {allLocked ? 'Utilization entry is currently closed' : `${QUARTER_SHORT[viewingQuarter] || viewingLabel} is locked`}
                            </p>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                {allLocked
                                    ? 'All quarters are locked. You can still view your records, but nothing can be changed.'
                                    : 'Entries for this quarter can be viewed but not changed. It will open when the division enables it.'}
                            </p>
                        </div>
                    </div>
                )}

                {/* ── Intervention Selector ── */}
                <InterventionSelector
                    interventions={INTERVENTIONS}
                    icons={INTERVENTION_ICONS}
                    selected={selectedInterventions}
                    expanded={selectorExpanded}
                    onToggleExpanded={() => setSelectorOpen(!selectorExpanded)}
                    onToggle={handleToggleIntervention}
                />

                {/* ── Active Interventions ── */}
                <section className="mb-8" aria-label={`Active interventions for ${viewingLabel}`}>
                    <div className="mb-4 flex items-end justify-between gap-3 px-1">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recording for</p>
                            <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100">{viewingLabel}</h2>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            {selectedInterventions.length} intervention{selectedInterventions.length === 1 ? '' : 's'}
                        </span>
                    </div>

                    {selectedInterventions.length === 0 ? (
                        <motion.article
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="siif-card p-10 text-center"
                        >
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg shadow-indigo-500/25">
                                <TbTarget size={30} />
                            </div>
                            <h3 className="mb-1 text-lg font-black text-slate-800 dark:text-slate-100">
                                No interventions tracked yet
                            </h3>
                            <p className="mx-auto mb-6 max-w-md text-sm text-slate-500 dark:text-slate-400">
                                Choose the interventions your school is utilizing funds for, then record amounts per quarter.
                            </p>
                            {!allLocked && <button
                                type="button"
                                onClick={() => {
                                    setSelectorOpen(true);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className="inline-flex cursor-pointer items-center gap-2 rounded-xl border-0 bg-indigo-600 px-6 py-3 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-indigo-600/20 transition-all hover:bg-indigo-700"
                            >
                                <TbPlus size={16} /> Select Interventions
                            </button>}
                        </motion.article>
                    ) : (
                        <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
                            <AnimatePresence initial={false}>
                                {selectedInterventions.map((intId, index) => {
                                    return (
                                        <InterventionCard
                                            key={intId}
                                            intId={intId}
                                            index={index}
                                            label={(INTERVENTIONS.find(i => i.id === intId) || { label: intId }).label}
                                            icon={INTERVENTION_ICONS[intId]}
                                            quarterData={utilizationData[intId] || {}}
                                            periods={periods}
                                            viewingQuarter={viewingQuarter}
                                            schoolBalance={schoolBalance}
                                            totalAllocated={totalAllocated}
                                            onAddExpense={openExpenseEditor}
                                            onEditExpense={openExpenseEditor}
                                            editorOpen={expenseEditor !== null}
                                            addBlockedReason={
                                                viewingRange.notStarted
                                                    ? `${QUARTER_SHORT[viewingQuarter] || viewingLabel} hasn't started yet`
                                                    : schoolBalance !== null && schoolBalance <= 0
                                                        ? 'No school balance left to record'
                                                        : null
                                            }
                                            onJustificationChange={handleUpdateJustification}
                                            onRemove={handleToggleIntervention}
                                            locked={isViewingLocked}
                                            removeBlocked={allLocked || hasLockedEntry(intId)}
                                            plannedActivities={plannedActivities[intId] || []}
                                            activitiesMissing={showActivityErrors && quarterNeedsActivities(intId, viewingQuarter)}
                                            onActivitiesChange={handleUpdateActivities}
                                            isDirty={dirtyIds.includes(intId)}
                                            saving={saving}
                                            onSave={handleSave}
                                        />
                                    );
                                })}
                            </AnimatePresence>
                        </div>
                    )}
                </section>
                </div>
            )}

            <SaveBar
                saving={saving}
                hasUnsavedChanges={hasUnsavedChanges}
                changedLabels={changedLabels}
                isOverAllocation={isOverAllocation}
                totalUtilized={totalUtilized}
                totalAllocated={totalAllocated}
                lastSavedAt={lastSavedAt}
                onSave={handleSave}
                locked={allLocked}
            />

            <ExpenseModal
                editor={expenseEditor}
                onSubmit={submitExpense}
                onDelete={deleteExpense}
                onClose={closeExpenseEditor}
            />

            <UtilizationToast toast={toast} onClose={closeToast} />

            <ConfirmDialog
                open={!!pendingDeactivate}
                title={`Remove ${pendingLabel}?`}
                message={`"${pendingLabel}" has recorded utilization amounts. Removing it deletes those amounts from your saved records right away. Are you sure you want to proceed?`}
                confirmLabel="Remove"
                onConfirm={confirmDeactivate}
                onCancel={cancelDeactivate}
            />
        </main>
    );
};

export default SIIFUtilization;
