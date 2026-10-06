import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { TbTarget, TbPlus, TbCalendarStats } from 'react-icons/tb';
import { FiGrid, FiLogOut } from 'react-icons/fi';
import { useAuth } from '../../../../school-head/web/src/context/AuthContext';
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
    const navigate = useNavigate();
    const { confirmLogout } = useAuth();
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
    const deactivateIntervention = (intId) => {
        setSelectedInterventions(prev => prev.filter(id => id !== intId));
        setHasUnsavedChanges(true);
    };

    const handleToggleIntervention = (intId) => {
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
        if (pendingDeactivate) deactivateIntervention(pendingDeactivate);
        setPendingDeactivate(null);
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

    // ─── Save Handler ──────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (isOverAllocation) {
            showToast('error', 'Over allocation limit',
                `Total utilization (${formatPeso(totalUtilized)}) exceeds the school allocation (${formatPeso(totalAllocated)}). Please adjust your figures before saving.`);
            return;
        }

        const schoolId = user?.school_id || user?.schoolId || user?.id || user?.uid || user?.sub;
        if (!schoolId) {
            showToast('error', 'Unable to save', 'School ID could not be identified from your account session.');
            return;
        }

        setSaving(true);
        try {
            // Auto-clean: ensure valid values for active quarter in active interventions.
            // Statuses carried over from an earlier quarter are written for quarters up to
            // the current one; future quarters keep inheriting until they are filled in.
            const activeIdx = periods.findIndex(p => p.id === activeQuarter);
            const lastPersistIdx = activeIdx === -1 ? periods.length - 1 : activeIdx;
            const payloadData = { ...utilizationData };
            selectedInterventions.forEach(intId => {
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
            const unifiedSelected = selectedInterventions.map(intId => {
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
            };

            console.log('💾 [SIIFUtilization] Saving modified utilization:', payload);
            await saveModifiedUtilization(payload, token);

            setUtilizationData(payloadData);
            setHasUnsavedChanges(false);
            showToast('success', 'Utilization updates saved', 'Your school and division records are now up to date.');
            refetch();
        } catch (err) {
            console.error('🔥 [SIIFUtilization] Save failed:', err);
            showToast('error', 'Error saving updates', err.message);
        } finally {
            setSaving(false);
        }
    };

    const pendingLabel = INTERVENTIONS.find(i => i.id === pendingDeactivate)?.label || pendingDeactivate;

    return (
        <main className="w-full pt-3 sm:pt-4 lg:pt-6 pb-36 text-lg siif-utilization-page">

            {/* ── Navigation & Account Bar ── */}
            <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
                <button
                    type="button"
                    onClick={() => navigate('/nodes-dashboard')}
                    className="group inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition-all hover:shadow dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#10346B] text-white transition-transform group-hover:scale-105">
                        <FiGrid size={13} />
                    </span>
                    <span className="hidden sm:inline">Back to Nexus Portal</span>
                    <span className="sm:hidden">Back</span>
                </button>

                <div className="flex min-w-0 items-center gap-3">
                    <div className="hidden min-w-0 text-right sm:block">
                        <span className="block text-[10px] font-extrabold uppercase tracking-wider text-[#0038A8] dark:text-sky-300">
                            School Head
                        </span>
                        <span className="block max-w-[260px] truncate text-xs font-bold text-slate-700 dark:text-slate-200">
                            {user?.school_name || 'SIIF Utilization Hub'}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={confirmLogout}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 shadow-sm transition-all hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                    >
                        <FiLogOut size={14} />
                        <span>Sign Out</span>
                    </button>
                </div>
            </div>

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

                <div className="siif-topbar-actions hidden sm:flex">
                    <div className="flex items-center gap-2.5 rounded-2xl border border-slate-100 bg-white px-4 py-2.5 shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#08315F] text-white">
                            <TbCalendarStats size={18} />
                        </span>
                        <div className="leading-tight">
                            <small className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Fiscal Year</small>
                            <strong className="block text-lg font-black text-[#08315F]">FY {fiscalYear}</strong>
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
                title={`Stop tracking ${pendingLabel}?`}
                message={`"${pendingLabel}" currently has recorded utilization amounts. Deactivating it will hide it from the active tracker. Are you sure you want to proceed?`}
                confirmLabel="Deactivate"
                onConfirm={confirmDeactivate}
                onCancel={cancelDeactivate}
            />
        </main>
    );
};

export default SIIFUtilization;
