import React, { useState, useCallback, useEffect } from 'react';
// eslint-disable-next-line no-unused-vars
import { AnimatePresence, motion } from 'framer-motion';
import { TbTarget, TbPlus, TbCalendarStats } from 'react-icons/tb';
import { useModifiedSIIFUtilization } from '../hooks/useModifiedSIIFUtilization';
import { saveModifiedUtilization } from '../services/siifService';
import { INTERVENTIONS, INTERVENTION_ICONS } from '../constants/siifConstants';
import SiifLoader from '../components/SiifLoader';
import UtilizationSummary from '../components/utilization/UtilizationSummary';
import QuarterTabs from '../components/utilization/QuarterTabs';
import InterventionSelector from '../components/utilization/InterventionSelector';
import InterventionCard from '../components/utilization/InterventionCard';
import SaveBar from '../components/utilization/SaveBar';
import { UtilizationToast, ConfirmDialog } from '../components/utilization/UtilizationFeedback';
import { amountOf, formatPeso, effectiveStatus } from '../components/utilization/utilizationUi';

const SIIFUtilization = ({ user, token }) => {
    const [saving, setSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    // null = automatic: open only when nothing is tracked yet
    const [selectorOpen, setSelectorOpen] = useState(null);
    const [toast, setToast] = useState(null);
    const [pendingDeactivate, setPendingDeactivate] = useState(null);

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
        officialAllocation,
        lastSavedAt,
        periods,
        refetch,
    } = useModifiedSIIFUtilization(user, token);

    const showToast = useCallback((type, title, message) => {
        setToast({ id: Date.now(), type, title, message });
    }, []);
    const closeToast = useCallback(() => setToast(null), []);
    const cancelDeactivate = useCallback(() => setPendingDeactivate(null), []);

    // Warn before a reload / tab close throws away edits that were never saved
    useEffect(() => {
        if (!hasUnsavedChanges) return undefined;
        const warn = (e) => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [hasUnsavedChanges]);

    if (loading) {
        return <SiifLoader text="Loading Utilization Tracker..." />;
    }

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
    const overallProgress = totalAllocated > 0 ? (totalUtilized / totalAllocated) * 100 : 0;
    const remainingBalance = Math.max(0, totalAllocated - totalUtilized);
    const isOverAllocation = totalAllocated > 0 && totalUtilized > totalAllocated;

    const quarterStats = {};
    periods.forEach(p => {
        let amount = 0;
        let completed = 0;
        selectedInterventions.forEach(intId => {
            const intUtil = utilizationData[intId] || {};
            amount += amountOf(intUtil[p.id]);
            if (effectiveStatus(intUtil, periods, p.id).status === 'Completed') completed += 1;
        });
        quarterStats[p.id] = { amount, completed, total: selectedInterventions.length };
    });
    const quarterTotals = periods.map(p => ({ id: p.id, label: p.label, amount: quarterStats[p.id].amount }));
    const viewingLabel = periods.find(p => p.id === viewingQuarter)?.label || viewingQuarter;

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
            setHasUnsavedChanges(true);
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

        if (isCurrentlyActive) {
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
                    initialQuarterData[p.id] = { amount: '', status: 'Not Yet Started', justification: '' };
                });
                setUtilizationData(prev => ({ ...prev, [intId]: initialQuarterData }));
            }
            setHasUnsavedChanges(true);
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

    const handleUpdateUtilization = (intId, value) => {
        const amount = parseFloat(value) || 0;
        const otherTotal = getOtherTotal(intId);
        const newTotal = otherTotal + amount;

        // Total allocation restraint — reject the entry and let the card explain why
        if (totalAllocated > 0 && newTotal > totalAllocated) {
            return { exceeded: true, maxAllowed: Math.max(0, totalAllocated - otherTotal) };
        }

        setUtilizationData(prev => ({
            ...prev,
            [intId]: {
                ...(prev[intId] || {}),
                [viewingQuarter]: {
                    ...((prev[intId] || {})[viewingQuarter] || {}),
                    amount: value,
                    // Keep the status carried over from an earlier quarter
                    status: effectiveStatus(prev[intId], periods, viewingQuarter).status
                }
            }
        }));
        setHasUnsavedChanges(true);
        return { exceeded: false };
    };

    const handleUpdateStatus = (intId, status) => {
        setUtilizationData(prev => ({
            ...prev,
            [intId]: {
                ...(prev[intId] || {}),
                [viewingQuarter]: {
                    ...((prev[intId] || {})[viewingQuarter] || {}),
                    amount: (prev[intId] || {})[viewingQuarter]?.amount !== undefined ? (prev[intId] || {})[viewingQuarter].amount : '',
                    status: status
                }
            }
        }));
        setHasUnsavedChanges(true);
    };

    const handleUpdateJustification = (intId, text) => {
        setUtilizationData(prev => ({
            ...prev,
            [intId]: {
                ...(prev[intId] || {}),
                [viewingQuarter]: {
                    ...((prev[intId] || {})[viewingQuarter] || {}),
                    status: effectiveStatus(prev[intId], periods, viewingQuarter).status,
                    justification: text
                }
            }
        }));
        setHasUnsavedChanges(true);
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
            // Auto-clean: ensure valid values for active quarter in active interventions.
            // Statuses carried over from an earlier quarter are written for quarters up to
            // the current one; future quarters keep inheriting until they are filled in.
            const activeIdx = periods.findIndex(p => p.id === activeQuarter);
            const lastPersistIdx = activeIdx === -1 ? periods.length - 1 : activeIdx;
            const payloadData = { ...utilizationData };
            interventionIds.forEach(intId => {
                const original = utilizationData[intId] || {};
                const quarters = { ...original };
                periods.forEach((p, i) => {
                    const status = i <= lastPersistIdx
                        ? effectiveStatus(original, periods, p.id).status
                        : (quarters[p.id]?.status || 'Not Yet Started');
                    quarters[p.id] = quarters[p.id]
                        ? { ...quarters[p.id], status }
                        : { amount: '0', status, justification: '' };
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
            setHasUnsavedChanges(false);
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
    const handleSave = async () => {
        if (saving) return;
        const result = await persistUtilization(selectedInterventions);
        if (result.status === 'saved') {
            showToast('success', 'Utilization updates saved', 'Your school and division records are now up to date.');
        } else if (result.status === 'over') {
            showToast('error', 'Over allocation limit',
                `Total utilization (${formatPeso(totalUtilized)}) exceeds the school allocation (${formatPeso(totalAllocated)}). Please adjust your figures before saving.`);
        } else {
            showToast('error', 'Error saving updates', result.message);
        }
    };

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

            {/* ── Summary ── */}
            <UtilizationSummary
                fiscalYear={fiscalYear}
                totalAllocated={totalAllocated}
                totalUtilized={totalUtilized}
                remainingBalance={remainingBalance}
                overallProgress={overallProgress}
                quarterTotals={quarterTotals}
                remarks={officialAllocation?.remarks}
            />

            {/* ── Quarterly Navigation Tabs ── */}
            <QuarterTabs
                periods={periods}
                activeQuarter={activeQuarter}
                viewingQuarter={viewingQuarter}
                onSelect={setViewingQuarter}
                quarterStats={quarterStats}
            />

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
                        <button
                            type="button"
                            onClick={() => {
                                setSelectorOpen(true);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border-0 bg-indigo-600 px-6 py-3 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-indigo-600/20 transition-all hover:bg-indigo-700"
                        >
                            <TbPlus size={16} /> Select Interventions
                        </button>
                    </motion.article>
                ) : (
                    <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <AnimatePresence initial={false}>
                            {selectedInterventions.map((intId, index) => {
                                const otherTotal = getOtherTotal(intId);
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
                                        maxAllowed={totalAllocated > 0 ? Math.max(0, totalAllocated - otherTotal) : null}
                                        onAmountChange={handleUpdateUtilization}
                                        onStatusChange={handleUpdateStatus}
                                        onJustificationChange={handleUpdateJustification}
                                        onRemove={handleToggleIntervention}
                                    />
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </section>

            <SaveBar
                saving={saving}
                hasUnsavedChanges={hasUnsavedChanges}
                isOverAllocation={isOverAllocation}
                totalUtilized={totalUtilized}
                totalAllocated={totalAllocated}
                lastSavedAt={lastSavedAt}
                onSave={handleSave}
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
