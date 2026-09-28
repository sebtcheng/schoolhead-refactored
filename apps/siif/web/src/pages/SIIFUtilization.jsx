import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TbTarget,
    TbChevronRight,
    TbAlertCircle,
    TbLock,
    TbCheck,
    TbPlus,
    TbMinus,
    TbDeviceFloppy,
    TbLayersLinked
} from 'react-icons/tb';
import { FiGrid, FiLogOut } from 'react-icons/fi';
import { useAuth } from '../../../../school-head/web/src/context/AuthContext';
import { useModifiedSIIFUtilization } from '../hooks/useModifiedSIIFUtilization';
import { saveModifiedUtilization } from '../services/siifService';
import { INTERVENTIONS, INTERVENTION_ICONS } from '../constants/siifConstants';
import SiifLoader from '../components/SiifLoader';

const SIIFUtilization = ({ user, token }) => {
    const navigate = useNavigate();
    const { confirmLogout } = useAuth();
    const [saving, setSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [selectorExpanded, setSelectorExpanded] = useState(true);

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
        periods,
        refetch,
    } = useModifiedSIIFUtilization(user, token);

    if (loading) {
        return <SiifLoader text="Loading Utilization Tracker..." />;
    }

    // ─── Calculations ──────────────────────────────────────────────────────────
    const totalAllocated = parseFloat(officialAllocation?.allocation_amount) || 0;

    const calculateTotalUtilized = () => {
        let total = 0;
        selectedInterventions.forEach(intId => {
            const intUtil = utilizationData[intId] || {};
            periods.forEach(p => {
                const qVal = intUtil[p.id];
                const amt = parseFloat(qVal?.amount !== undefined ? qVal.amount : qVal) || 0;
                total += amt;
            });
        });
        return total;
    };

    const totalUtilized = calculateTotalUtilized();
    const overallProgress = totalAllocated > 0 ? (totalUtilized / totalAllocated) * 100 : 0;
    const remainingBalance = Math.max(0, totalAllocated - totalUtilized);

    // ─── Toggle Intervention Activation ───────────────────────────────────────
    const handleToggleIntervention = (intId) => {
        const isCurrentlyActive = selectedInterventions.includes(intId);

        if (isCurrentlyActive) {
            // Check if there are entered amounts before removing
            const intUtil = utilizationData[intId] || {};
            const hasData = Object.values(intUtil).some(q => (parseFloat(q?.amount !== undefined ? q.amount : q) || 0) > 0);

            if (hasData) {
                const confirmDeactivate = window.confirm(
                    `"${intId}" currently has recorded utilization amounts. Deactivating it will hide it from the active tracker. Are you sure you want to proceed?`
                );
                if (!confirmDeactivate) return;
            }

            setSelectedInterventions(prev => prev.filter(id => id !== intId));
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
        }
        setHasUnsavedChanges(true);
    };

    // ─── Utilization Inputs Handlers ──────────────────────────────────────────
    const handleUpdateUtilization = (intId, value) => {
        const amount = parseFloat(value) || 0;

        // Calculate what the new grand total would be
        let otherTotal = 0;
        selectedInterventions.forEach(id => {
            const intUtil = utilizationData[id] || {};
            periods.forEach(p => {
                if (id === intId && p.id === viewingQuarter) return; // skip this specific field
                const qVal = intUtil[p.id];
                otherTotal += (parseFloat(qVal?.amount !== undefined ? qVal.amount : qVal) || 0);
            });
        });

        const newTotal = otherTotal + amount;

        // Total allocation restraint warning
        if (totalAllocated > 0 && newTotal > totalAllocated) {
            const maxAllowed = Math.max(0, totalAllocated - otherTotal);
            alert(`⚠️ Budget Limit Exceeded\n\nTotal utilization cannot exceed your school's official allocation (₱${totalAllocated.toLocaleString()}).\n\nMaximum allowable amount here is ₱${maxAllowed.toLocaleString()}.`);
            return;
        }

        setUtilizationData(prev => ({
            ...prev,
            [intId]: {
                ...(prev[intId] || {}),
                [viewingQuarter]: {
                    ...((prev[intId] || {})[viewingQuarter] || {}),
                    amount: value,
                    status: (prev[intId] || {})[viewingQuarter]?.status || 'Not Yet Started'
                }
            }
        }));
        setHasUnsavedChanges(true);
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
                    justification: text
                }
            }
        }));
        setHasUnsavedChanges(true);
    };

    // ─── Save Handler ──────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (totalAllocated > 0 && totalUtilized > totalAllocated) {
            alert(`⚠️ Over Allocation Limit\n\nTotal utilization (₱${totalUtilized.toLocaleString()}) exceeds the school allocation (₱${totalAllocated.toLocaleString()}).\nPlease adjust your figures before saving.`);
            return;
        }

        const schoolId = user?.school_id || user?.schoolId || user?.id || user?.uid || user?.sub;
        if (!schoolId) {
            alert('Error: School ID could not be identified from your account session.');
            return;
        }

        setSaving(true);
        try {
            // Auto-clean: ensure valid values for active quarter in active interventions
            const payloadData = { ...utilizationData };
            selectedInterventions.forEach(intId => {
                if (!payloadData[intId]) payloadData[intId] = {};
                periods.forEach(p => {
                    if (!payloadData[intId][p.id]) {
                        payloadData[intId][p.id] = { amount: '0', status: 'Not Yet Started', justification: '' };
                    }
                });
            });

            // Construct unified selected_interventions containing quarters and subtotal
            const unifiedSelected = selectedInterventions.map(intId => {
                const intMeta = INTERVENTIONS.find(i => i.id === intId) || { label: intId };
                const quarters = payloadData[intId] || {};
                let totalSpent = 0;
                Object.values(quarters).forEach(q => {
                    totalSpent += (parseFloat(q?.amount !== undefined ? q.amount : q) || 0);
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
                fiscalYear: officialAllocation?.fiscal_year || new Date().getFullYear(),
            };

            console.log('💾 [SIIFUtilization] Saving modified utilization:', payload);
            await saveModifiedUtilization(payload, token);

            setUtilizationData(payloadData);
            setHasUnsavedChanges(false);
            alert('✅ Utilization updates saved successfully!');
            refetch();
        } catch (err) {
            console.error('🔥 [SIIFUtilization] Save failed:', err);
            alert('Error saving updates: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <main className="w-full pt-3 sm:pt-4 lg:pt-6 pb-32 text-lg siif-utilization-page">
            
            {/* ── Standalone Navigation & Account Header Bar ── */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-200/90 print:hidden">
                <button
                    type="button"
                    onClick={() => navigate('/nodes-dashboard')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold border border-slate-200 shadow-sm hover:shadow transition-all cursor-pointer group"
                >
                    <div className="w-6 h-6 rounded-lg bg-[#10346B] text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                        <FiGrid size={13} />
                    </div>
                    <span>Back to Nexus Portal</span>
                </button>

                <div className="flex items-center gap-3 ml-auto">
                    <div className="text-right hidden sm:block">
                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#0038A8] block">
                            SCHOOL HEAD
                        </span>
                        <span className="text-xs font-bold text-slate-700 block truncate max-w-[240px]">
                            {user?.school_name || "SIIF Utilization Hub"}
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={confirmLogout}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 shadow-sm hover:shadow transition-all cursor-pointer"
                    >
                        <FiLogOut size={15} />
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
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
                        Quarterly Utilization Input Tool
                    </p>
                </div>

                <div className="siif-topbar-actions w-full sm:w-auto mt-4 sm:mt-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    {/* Overall Progress Pill */}
                    <section className="siif-school-pill w-full sm:w-auto flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 sm:gap-1 shadow-[0_4px_12px_rgba(0,0,0,0.08)] px-4 py-2 bg-white rounded-2xl border border-slate-100">
                        <div className="flex flex-col items-start sm:items-end">
                            <small style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--slate-500)' }}>
                                Total Utilized
                            </small>
                            <strong style={{ fontSize: 'clamp(18px, 2.5vw, 22px)', background: 'linear-gradient(to right, var(--navy), var(--blue))', WebkitBackgroundClip: 'text', color: 'transparent', margin: 0, lineHeight: 1.1 }}>
                                {overallProgress.toFixed(1)}%
                            </strong>
                        </div>
                        <div className="flex-1 sm:w-full" style={{ maxWidth: '120px', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(overallProgress, 100)}%`, height: '100%', background: overallProgress > 100 ? 'var(--red)' : 'var(--blue)', transition: 'width 0.3s ease' }} />
                        </div>
                    </section>
                </div>
            </header>

            {/* ── Summary Dashboard Banner ── */}
            <div className="grid grid-cols-1 gap-4 mb-6">
                <article className="siif-card siif-progress-highlight">
                    <div className="siif-card-inner relative overflow-hidden">
                        <div className="siif-card-header relative z-10 flex flex-wrap justify-between items-start gap-2">
                            <div>
                                <h2>FY {officialAllocation?.fiscal_year || new Date().getFullYear()} Total Utilization Progress</h2>
                                <p className="siif-card-subtitle">
                                    Official Allocation: <strong className="text-slate-800">₱{totalAllocated.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</strong>
                                    {officialAllocation?.remarks && ` • ${officialAllocation.remarks}`}
                                </p>
                            </div>
                            <span className={`siif-status ${overallProgress > 100 ? 'bad bg-red-50 text-red-600 border border-red-200' : 'ok'}`}>
                                {overallProgress.toFixed(1)}% Utilized
                            </span>
                        </div>

                        <div className="flex flex-row items-baseline justify-between w-full gap-4 relative z-10 pt-4 pb-3">
                            <div className="min-w-0">
                                <p className="siif-card-subtitle text-[10px] sm:text-xs uppercase font-extrabold text-slate-500 mb-1">
                                    Total Spent 
                                </p>
                                <h3 className="siif-big-number text-xl sm:text-2xl md:text-3xl font-black text-[#08315F] leading-none whitespace-nowrap">
                                    ₱{totalUtilized.toLocaleString('en-PH', { maximumFractionDigits: 2 })}
                                </h3>
                            </div>
                            <div className="text-right shrink-0 flex flex-col items-end">
                                <p className="siif-card-subtitle text-[10px] sm:text-xs uppercase font-extrabold text-slate-400 mb-1">
                                    Remaining Balance
                                </p>
                                <h3 className="siif-big-number text-sm sm:text-base md:text-xl font-bold text-slate-500 leading-none whitespace-nowrap">
                                    ₱{remainingBalance.toLocaleString('en-PH', { maximumFractionDigits: 2 })}
                                </h3>
                            </div>
                        </div>

                        <div className="siif-progress-track relative z-10">
                            <motion.div
                                className="siif-progress-fill"
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(overallProgress, 100)}%` }}
                                style={{ background: overallProgress > 100 ? 'var(--red)' : 'var(--blue)' }}
                                transition={{ duration: 1.0, ease: 'easeOut' }}
                            >
                                {overallProgress.toFixed(1)}%
                            </motion.div>
                        </div>
                    </div>
                </article>

                {totalAllocated === 0 && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3 shadow-sm mx-1">
                        <TbAlertCircle className="text-blue-500 shrink-0 mt-0.5" size={18} />
                        <div>
                            <p className="text-[11px] font-black text-blue-900 uppercase tracking-wider mb-0.5">Allocation Notice</p>
                            <p className="text-xs text-blue-800 font-medium leading-relaxed">
                                No official finance allocation was found for your school ID yet. You can still select interventions and record quarterly expenditures.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Quarterly Navigation Tabs ── */}
            <div className="flex bg-slate-200/60 p-1.5 rounded-2xl mb-6 shadow-inner">
                {periods.map(p => {
                    const isCurrent = p.id === activeQuarter;
                    const isSelected = p.id === viewingQuarter;

                    return (
                        <button
                            key={p.id}
                            onClick={() => setViewingQuarter(p.id)}
                            className={`flex-1 py-3 px-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex flex-col items-center gap-0.5 border-0 cursor-pointer ${
                                isSelected
                                    ? 'bg-white text-[#0038A8] shadow-md transform scale-[1.01]'
                                    : 'bg-transparent text-slate-600 hover:bg-white/40'
                            }`}
                        >
                            <span>{p.label}</span>
                            {isCurrent && (
                                <span className="text-[9px] text-emerald-600 font-extrabold tracking-normal">
                                    • Active Phase
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* ── INTERVENTION ACTIVATOR / SELECTOR (CORE PIVOT UPGRADE) ── */}
            <section className="mb-8 bg-white border border-slate-200/90 rounded-3xl p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                            <TbLayersLinked size={22} />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                Select Interventions to Track
                            </h2>
                            <p className="text-xs text-slate-500 font-medium">
                                Toggle ON the interventions your school is utilizing funds for:
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-black text-xs rounded-full border border-indigo-100">
                            {selectedInterventions.length} of {INTERVENTIONS.length} Active
                        </span>
                        <button
                            type="button"
                            onClick={() => setSelectorExpanded(!selectorExpanded)}
                            className="text-xs text-slate-500 font-bold px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-all border-0 bg-transparent cursor-pointer"
                        >
                            {selectorExpanded ? 'Collapse' : 'Expand Interventions'}
                        </button>
                    </div>
                </div>

                <AnimatePresence>
                    {selectorExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                        >
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-2">
                                {INTERVENTIONS.map(item => {
                                    const isSelected = selectedInterventions.includes(item.id);
                                    const Icon = INTERVENTION_ICONS[item.id] || <TbTarget size={18} />;

                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => handleToggleIntervention(item.id)}
                                            className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2.5 cursor-pointer relative overflow-hidden group ${
                                                isSelected
                                                    ? 'bg-gradient-to-br from-indigo-50/80 to-blue-50/50 border-indigo-300 shadow-sm shadow-indigo-100'
                                                    : 'bg-slate-50/80 border-slate-200/80 hover:bg-slate-100/70 opacity-75 hover:opacity-100'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between w-full">
                                                <div className={`p-2 rounded-xl shrink-0 transition-colors ${
                                                    isSelected ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-400 border border-slate-200'
                                                }`}>
                                                    {Icon}
                                                </div>
                                                <span className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                                                    isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-400 group-hover:bg-slate-300'
                                                }`}>
                                                    {isSelected ? <TbCheck size={12} /> : <TbPlus size={12} />}
                                                </span>
                                            </div>

                                            <div>
                                                <h3 className={`text-xs font-black leading-tight truncate ${isSelected ? 'text-indigo-950' : 'text-slate-700'}`} title={item.label}>
                                                    {item.label}
                                                </h3>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 block">
                                                    {isSelected ? 'Activated' : 'Click to Add'}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </section>

            {/* ── Active Interventions Section ── */}
            <div className="mb-8">
                <div className="flex justify-between items-center mb-4 px-1">
                    <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">
                        Active Interventions for {periods.find(p => p.id === viewingQuarter)?.label || viewingQuarter}
                    </h2>
                    <span className="text-xs font-bold text-slate-400">
                        {selectedInterventions.length} cards displayed
                    </span>
                </div>

                {selectedInterventions.length === 0 ? (
                    <article className="siif-card text-center p-10 bg-slate-50/80 border-2 border-dashed border-slate-200 rounded-3xl">
                        <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto mb-4 border border-indigo-100 shadow-sm">
                            <TbTarget size={32} />
                        </div>
                        <h3 className="text-lg font-black text-slate-800 mb-1">
                            No Interventions Selected Yet
                        </h3>
                        <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
                            Click any intervention in the selector above to activate it and record utilization amounts.
                        </p>
                        <button
                            type="button"
                            onClick={() => setSelectorExpanded(true)}
                            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-indigo-700 transition-all border-0 cursor-pointer shadow-md shadow-indigo-600/20"
                        >
                            Select Interventions Above
                        </button>
                    </article>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-stretch">
                        {selectedInterventions.map(intId => {
                            const intMeta = INTERVENTIONS.find(i => i.id === intId) || { label: intId };
                            const qData = utilizationData[intId] || {};
                            const currentQuarterObj = qData[viewingQuarter] || {};
                            const currentVal = currentQuarterObj?.amount !== undefined ? currentQuarterObj.amount : currentQuarterObj;
                            const currentStatus = currentQuarterObj?.status || 'Not Yet Started';
                            const currentJustification = currentQuarterObj?.justification || '';

                            // Calculate total utilized for this intervention across all quarters
                            let totalThisInt = 0;
                            periods.forEach(p => {
                                const qv = qData[p.id];
                                totalThisInt += (parseFloat(qv?.amount !== undefined ? qv.amount : qv) || 0);
                            });

                            return (
                                <article key={intId} className="siif-card h-full transition-all hover:shadow-lg">
                                    <div className="siif-card-inner flex flex-col justify-between" style={{ minHeight: '340px' }}>
                                        
                                        {/* Card Header */}
                                        <div>
                                            <div className="flex items-start justify-between gap-3 mb-3 border-b border-slate-100 pb-3">
                                                <div className="flex gap-2.5 items-center min-w-0">
                                                    <div className="w-9 h-9 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                                                        {INTERVENTION_ICONS[intId] || <TbTarget size={18} />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h3 className="truncate text-sm font-black text-slate-800" title={intMeta.label}>
                                                            {intMeta.label}
                                                        </h3>
                                                        <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                                                            Total: <strong className="text-indigo-600">₱{totalThisInt.toLocaleString()}</strong>
                                                        </p>
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleIntervention(intId)}
                                                    title="Deactivate this intervention"
                                                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-500 flex items-center justify-center transition-all border-0 cursor-pointer shrink-0"
                                                >
                                                    <TbMinus size={14} />
                                                </button>
                                            </div>

                                            {/* Inputs Zone */}
                                            <div className="flex flex-col gap-3 pt-1">
                                                
                                                {/* Utilized Amount */}
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                                        Utilized Amount ({viewingQuarter})
                                                    </label>
                                                    <div className="relative">
                                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-extrabold text-sm select-none pointer-events-none">
                                                            ₱
                                                        </span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="any"
                                                            value={typeof currentVal === 'object' ? '' : currentVal}
                                                            onChange={(e) => handleUpdateUtilization(intId, e.target.value)}
                                                            placeholder="0.00"
                                                            style={{ paddingLeft: '40px' }}
                                                            className="w-full border border-slate-200 rounded-2xl py-3 pr-4 text-sm font-bold bg-slate-50 text-slate-900 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Implementation Status */}
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                                        Implementation Status
                                                    </label>
                                                    <div className="relative">
                                                        <select
                                                            value={currentStatus}
                                                            onChange={(e) => handleUpdateStatus(intId, e.target.value)}
                                                            className="w-full border border-slate-200 rounded-2xl py-2.5 pl-3 pr-8 text-xs font-bold bg-slate-50 text-slate-800 focus:bg-white focus:border-indigo-400 outline-none transition-all appearance-none cursor-pointer"
                                                        >
                                                            <option value="Not Yet Started">Not Yet Started</option>
                                                            <option value="Ongoing">Ongoing</option>
                                                            <option value="Completed">Completed</option>
                                                        </select>
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                            <TbChevronRight size={14} className="rotate-90" />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Justification / Notes */}
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                                        Remarks / Justification
                                                    </label>
                                                    <textarea
                                                        value={currentJustification}
                                                        onChange={(e) => handleUpdateJustification(intId, e.target.value)}
                                                        rows={2}
                                                        placeholder="Optional notes or accomplishment description..."
                                                        className="w-full border border-slate-200 rounded-2xl p-2.5 text-xs font-medium text-slate-700 bg-slate-50 focus:bg-white focus:border-indigo-400 outline-none transition-all resize-none"
                                                    />
                                                </div>

                                            </div>
                                        </div>

                                        {/* Status Footer Pill */}
                                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[10px]">
                                            <span className="font-extrabold text-slate-400 uppercase tracking-wider">
                                                Status:
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-md font-black uppercase tracking-wider ${
                                                currentStatus === 'Completed'
                                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                                    : currentStatus === 'Ongoing'
                                                        ? 'bg-blue-50 text-blue-600 border border-blue-200'
                                                        : 'bg-slate-100 text-slate-500'
                                            }`}>
                                                {currentStatus}
                                            </span>
                                        </div>

                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Save Action Bar ── */}
            <div className="mt-8 pb-12">
                {totalAllocated > 0 && totalUtilized > totalAllocated && (
                    <div className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
                        <TbAlertCircle className="text-rose-500 shrink-0 mt-0.5" size={18} />
                        <p className="text-xs text-rose-700 font-bold leading-relaxed">
                            UNABLE TO SAVE: Total utilization (₱{totalUtilized.toLocaleString()}) exceeds your official allocation (₱{totalAllocated.toLocaleString()}). Please adjust the entered amounts.
                        </p>
                    </div>
                )}

                <button
                    onClick={handleSave}
                    disabled={saving || (totalAllocated > 0 && totalUtilized > totalAllocated) || !hasUnsavedChanges}
                    className={`w-full py-4 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-[0.99] transition-all border-0 cursor-pointer disabled:cursor-not-allowed ${
                        totalAllocated > 0 && totalUtilized > totalAllocated
                            ? 'bg-rose-500 shadow-rose-500/20 disabled:opacity-50'
                            : !hasUnsavedChanges
                                ? 'bg-slate-800 shadow-slate-800/20 opacity-80'
                                : 'bg-emerald-500 shadow-emerald-500/20 hover:bg-emerald-600'
                    }`}
                >
                    {saving ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : !hasUnsavedChanges ? (
                        <>
                            <TbCheck size={20} className="text-emerald-400" />
                            All Utilization Updates Saved
                        </>
                    ) : (
                        <>
                            <TbDeviceFloppy size={20} />
                            Save Quarterly Updates
                        </>
                    )}
                </button>

                <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-4 italic">
                    Updates will sync with your school's official spent amount and division records
                </p>
            </div>
        </main>
    );
};

export default SIIFUtilization;
