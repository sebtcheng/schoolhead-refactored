import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    TbTrendingUp, 
    TbTarget, 
    TbCurrencyPeso, 
    TbChevronRight, 
    TbAlertCircle, 
    TbLock, 
    TbCheck,
    TbLayoutDashboard,
    TbClock,
    TbTool,
    TbChevronLeft
} from 'react-icons/tb';
import { useNavigate } from 'react-router-dom';
import { useSIIFUtilization } from '../hooks/useSIIFUtilization';
import { updateUtilization } from '../services/siifService';

const SIIFUtilization = ({ user, token }) => {
    const navigate = useNavigate();
    const [saving, setSaving] = useState(false);

    // ─── All data loading & quarter state from hook ───────────────────────────
    const {
        loading, deadline, isExpired,
        activeQuarter, viewingQuarter, setViewingQuarter,
        submission, utilizationData, setUtilizationData,
        officialAllocation, periods,
    } = useSIIFUtilization(user, token);

    // ─── Derived flags ────────────────────────────────────────────────────────
    const isPlanningPhase = !isExpired;
    const isSubmitted = submission && submission.status && submission.status.toLowerCase() !== 'draft';

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-deped-blue/20 border-t-deped-blue rounded-full animate-spin"></div>
            </div>
        );
    }

    // PHASE 2 PILOT TEST LOCK
    const IS_UNDER_DEVELOPMENT = false;
    if (IS_UNDER_DEVELOPMENT) {
        return (
            <div className="min-h-screen bg-slate-50 p-6 pb-24">
                <div className="max-w-2xl mx-auto mt-12 bg-white rounded-[2.5rem] p-10 text-center shadow-xl border border-slate-100">
                    <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                        <TbTool size={40} className="text-indigo-600" />
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 mb-4 tracking-tight uppercase italic">Under Development</h1>
                    <p className="text-slate-500 mb-8 leading-relaxed font-medium">
                        This feature is currently under development and will be released during <span className="font-bold text-indigo-600">Phase 2</span> of the pilot test.
                        <br/><br/>
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                            Stay Tuned
                        </span>
                    </p>
                    <button
                        onClick={() => navigate('/siif')}
                        className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20"
                    >
                        Return to Dashboard
                        <TbChevronRight size={18} />
                    </button>
                </div>
            </div>
        );
    }

    // PHASE 1 LOCK: Planning phase still active
    if (isPlanningPhase) {
        return (
            <div className="min-h-screen bg-slate-50 p-6 pb-24">
                <div className="max-w-2xl mx-auto mt-12 bg-white rounded-[2.5rem] p-10 text-center shadow-xl border border-slate-100">
                    <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                        <TbClock size={40} className="text-deped-blue" />
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 mb-4 tracking-tight uppercase italic">Planning Phase Active</h1>
                    <p className="text-slate-500 mb-8 leading-relaxed font-medium">
                        Utilization tracking will become available once the **SIIF Planning Phase** is officially over.
                        <br/><br/>
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                            Estimated Opening: {deadline ? new Date(deadline).toLocaleString() : 'TBD'}
                        </span>
                    </p>
                    <button
                        onClick={() => navigate('/siif/forms')}
                        className="w-full py-4 bg-[#0038A8] text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-[#002d86] transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                    >
                        Review Baseline Plan
                        <TbChevronRight size={18} />
                    </button>
                </div>
            </div>
        );
    }

    // PHASE 2 LOCK: Deadline over but NO submission found or still draft
    if (!isSubmitted) {
        return (
            <div className="min-h-screen bg-slate-50 p-6 pb-24">
                <div className="max-w-2xl mx-auto mt-12 bg-white rounded-[2.5rem] p-10 text-center shadow-xl border border-slate-100">
                    <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                        <TbLock size={40} className="text-amber-500" />
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 mb-4 tracking-tight uppercase italic">No Baseline Found</h1>
                    <p className="text-slate-500 mb-8 leading-relaxed font-medium text-sm">
                        The planning window has closed, but no submitted **SIIF Baseline Plan** was found for your school. 
                        <br/><br/>
                        Utilization tracking is disabled because there is no reviewed budget to track against.
                    </p>
                    <button
                        onClick={() => navigate('/siif/forms')}
                        className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center justify-center gap-2 shadow-lg"
                    >
                        View Archived Forms
                        <TbChevronRight size={18} />
                    </button>
                </div>
            </div>
        );
    }

    // PHASE 3 LOCK: Plan is submitted but Pending Review
    const statusVal = submission.status?.toLowerCase() || '';
    if (statusVal === 'submitted') {
        return (
            <div className="min-h-screen bg-slate-50 p-6 pb-24">
                <div className="max-w-2xl mx-auto mt-12 bg-white rounded-[2.5rem] p-10 text-center shadow-xl border border-slate-100">
                    <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                        <TbClock size={40} className="text-amber-500 animate-pulse" />
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 mb-4 tracking-tight uppercase italic">Pending SDO Review</h1>
                    <p className="text-slate-500 mb-8 leading-relaxed font-medium">
                        Your submitted plan is currently waiting for review from the Division Office. 
                        <br/><br/>
                        You can begin tracking your quarterly utilization once your baseline plan has been officially reviewed.
                    </p>
                    <button
                        onClick={() => navigate('/siif/forms')}
                        className="w-full py-4 bg-[#0038A8] text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-[#002d86] transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                    >
                        View Read-Only Plan
                        <TbChevronRight size={18} />
                    </button>
                </div>
            </div>
        );
    }

    // PHASE 4 LOCK: Plan is disapproved
    if (statusVal === 'disapproved') {
        return (
            <div className="min-h-screen bg-slate-50 p-6 pb-24">
                <div className="max-w-2xl mx-auto mt-12 bg-white rounded-[2.5rem] p-10 text-center shadow-xl border border-slate-100">
                    <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                        <TbAlertCircle size={40} className="text-red-500" />
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 mb-4 tracking-tight uppercase italic">Plan Disapproved</h1>
                    <p className="text-slate-500 mb-8 leading-relaxed font-medium">
                        Your plan was disapproved by the Division Office and the submission deadline has passed. 
                        <br/><br/>
                        Utilization tracking cannot proceed without a reviewed baseline.
                    </p>
                    <button
                        onClick={() => navigate('/siif/forms')}
                        className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center justify-center gap-2 shadow-lg"
                    >
                        View Rejection Details
                        <TbChevronRight size={18} />
                    </button>
                </div>
            </div>
        );
    }

    // ─── Calculations ──────────────────────────────────────────────────────────
    const selectedInterventions = submission.interventions || [];
    const budgetEstimates = submission.budgetEstimates || {};

    const calculateTotals = () => {
        let totalEstimated = 0;
        let totalUtilized = 0;

        selectedInterventions.forEach(intId => {
            totalEstimated += (budgetEstimates[intId] || 0);
            
            // Total utilized for this intervention across all quarters
            const intUtil = utilizationData[intId] || {};
            Object.values(intUtil).forEach(qVal => {
                totalUtilized += (parseFloat(qVal?.amount !== undefined ? qVal.amount : qVal) || 0);
            });
        });

        // Use official allocation if available, otherwise fallback to sum of estimates
        const totalAllocated = officialAllocation.allocation_amount > 0 
            ? parseFloat(officialAllocation.allocation_amount) 
            : totalEstimated;

        return { totalAllocated, totalUtilized, totalEstimated };
    };

    const { totalAllocated, totalUtilized, totalEstimated } = calculateTotals();
    const overallProgress = totalAllocated > 0 ? (totalUtilized / totalAllocated) * 100 : 0;

    // ─── Handlers ──────────────────────────────────────────────────────────────
    const handleUpdateUtilization = async (intId, value) => {
        const amount = parseFloat(value) || 0;
        const allocation = budgetEstimates[intId] || 0;
        const qData = utilizationData[intId] || {};

        // 1️⃣ Calculate total utilized in PREVIOUS phases (chronological check)
        let previousPhasesTotal = 0;
        const currentIdx = periods.findIndex(p => p.id === activeQuarter);
        for (let i = 0; i < currentIdx; i++) {
            const qVal = qData[periods[i].id];
            previousPhasesTotal += (parseFloat(qVal?.amount !== undefined ? qVal.amount : qVal) || 0);
        }

        // 🛡️ [CUMULATIVE LOCK] If already maxed in previous phases, block immediately
        if (previousPhasesTotal >= allocation) {
            alert(`⚠️ Allocation Exhausted\n\nYou have already utilized the full ₱${allocation.toLocaleString()} allocation in previous reporting periods. No further inputs are allowed for this intervention.`);
            return;
        }

        // 2️⃣ Calculate total utilized in OTHER phases
        let otherPhasesTotal = 0;
        periods.forEach(p => {
            if (p.id !== activeQuarter) {
                const qVal = qData[p.id];
                otherPhasesTotal += (parseFloat(qVal?.amount !== undefined ? qVal.amount : qVal) || 0);
            }
        });

        // 🛡️ [BUDGET RESTRICTION] Check if total exceeds intervention's plan
        if (otherPhasesTotal + amount > allocation) {
            const maxAllowed = Math.max(0, allocation - otherPhasesTotal);
            alert(`⚠️ Budget Restriction\n\nYou cannot exceed the planned budget for this intervention (₱${allocation.toLocaleString()}).\n\nMaximum allowable for this phase is ₱${maxAllowed.toLocaleString()}.`);
            return;
        }

        // 🚀 [MAX OUT WARNING] Notify user if they hit the limit now
        if (otherPhasesTotal + amount === allocation && amount > 0) {
            const currentPeriod = periods.find(p => p.id === activeQuarter)?.label || activeQuarter;
            alert(`✅ Maximum Allocation Reached\n\nYou have reached the ₱${allocation.toLocaleString()} limit for this intervention. \n\nNOTE: Since you've maxed out the budget in ${currentPeriod}, you will not be able to add more utilization in future reporting periods.`);
        }

        const newData = {
            ...utilizationData,
            [intId]: {
                ...(utilizationData[intId] || {}),
                [activeQuarter]: {
                    ...((utilizationData[intId] || {})[activeQuarter] || {}),
                    amount: value,
                    status: (utilizationData[intId] || {})[activeQuarter]?.status || 'Not Yet Started'
                }
            }
        };
        setUtilizationData(newData);
    };

    const handleUpdateStatus = (intId, status) => {
        const newData = {
            ...utilizationData,
            [intId]: {
                ...(utilizationData[intId] || {}),
                [activeQuarter]: {
                    ...((utilizationData[intId] || {})[activeQuarter] || {}),
                    amount: (utilizationData[intId] || {})[activeQuarter]?.amount !== undefined ? (utilizationData[intId] || {})[activeQuarter].amount : ((utilizationData[intId] || {})[activeQuarter] || ''),
                    status: status
                }
            }
        };
        setUtilizationData(newData);
    };

    const handleSave = async () => {
        // ─── Budget Validation ──────────────────────────────────────────────
        if (totalAllocated > 0 && totalUtilized > totalAllocated) {
            alert(`⚠️ Over Budget Limit\n\nTotal utilization (₱${totalUtilized.toLocaleString()}) exceeds your budget (₱${totalAllocated.toLocaleString()}).\n\nPlease reduce the amounts before saving.`);
            return;
        }

        setSaving(true);
        try {
            // Auto-fill untouched inputs for the active quarter with 0 and Not Yet Started
            const finalUtilizationData = { ...utilizationData };
            if (activeQuarter) {
                selectedInterventions.forEach(intId => {
                    if (!finalUtilizationData[intId]) {
                        finalUtilizationData[intId] = {};
                    }
                    if (!finalUtilizationData[intId][activeQuarter]) {
                        finalUtilizationData[intId][activeQuarter] = { amount: '0', status: 'Not Yet Started' };
                    }
                });
            }

            console.log('💾 [SIIFUtilization] Saving utilization updates:', finalUtilizationData);
            await updateUtilization(submission.submissionId, finalUtilizationData, token);
            
            // Sync local state so it reflects the defaults we just saved
            setUtilizationData(finalUtilizationData);

            console.log('✅ [SIIIFUtilization] Data saved successfully');
            alert('Quarterly updates saved successfully!');
        } catch (err) {
            console.error('🔥 [SIIFUtilization] Save failed:', err);
            alert('Error saving: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6 pb-32">
            <header className="siif-topbar siif-topbar-flush flex-col items-stretch !items-start !justify-start gap-6 pb-8 print:hidden mb-8 w-full">
                <div className="flex items-center gap-3 w-full">
                    <button onClick={() => navigate('/siif')} className="p-3 bg-white hover:bg-slate-50 shadow-sm border border-slate-200 rounded-2xl transition-all text-slate-600 mr-2">
                        <TbChevronLeft size={20} />
                    </button>
                    <div className="w-10 h-10 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center text-siif-blue shadow-inner shrink-0">
                        <TbTrendingUp size={24} />
                    </div>
                    <div>
                        <p className="eyebrow">National Education Command Center</p>
                        <h1 className="text-xl font-black text-slate-800 tracking-tight italic uppercase">SIIF Utilization</h1>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">FY {officialAllocation?.fiscal_year || new Date().getFullYear()} Quarterly Tracking</p>
                    </div>
                </div>
            </header>

            {/* ─── Summary Dashboard ─── */}
            <div className="grid grid-cols-1 gap-4 mb-8">
                <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="flex justify-between items-end mb-4">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Utilization Progress</p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-black text-slate-900">₱{totalUtilized.toLocaleString()}</span>
                                    <span className="text-slate-400 font-bold text-sm">/ ₱{totalAllocated.toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-2xl font-black text-[#0038A8]">{overallProgress.toFixed(1)}%</span>
                            </div>
                        </div>
                        
                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-2">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(overallProgress, 100)}%` }}
                                className={`h-full rounded-full ${overallProgress > 100 ? 'bg-rose-500' : 'bg-[#0038A8]'}`}
                            />
                        </div>
                        <div className="flex justify-between items-center">
                            <p className="text-[10px] text-slate-400 font-bold">
                                {officialAllocation.allocation_amount > 0 
                                    ? "Based on Finance Official Allocation" 
                                    : "Based on School Estimated Budget"}
                            </p>
                            {officialAllocation.remarks && (
                                <p className="text-[10px] text-emerald-600 font-black italic">
                                    • {officialAllocation.remarks}
                                </p>
                            )}
                        </div>
                    </div>
                    {/* Background decoration */}
                    <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-deped-blue/5 rounded-full blur-3xl"></div>
                </div>

                {/* Information Note */}
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
                    <TbAlertCircle className="text-amber-500 shrink-0 mt-0.5" size={18} />
                    <div>
                        <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-1">Utilization Note</p>
                        <p className="text-[11px] text-amber-700 font-medium leading-relaxed">
                            Quarterly utilization must not exceed the estimated budget set for each intervention. 
                            The total utilization across all quarters is capped by your official allocation.
                        </p>
                    </div>
                </div>
            </div>

            {/* ─── Quarterly Navigation ─── */}
            <div className="flex bg-slate-200/50 p-1 rounded-2xl mb-2">
                {periods.map(p => {
                    const isCurrent = p.id === activeQuarter;
                    const isSelected = p.id === viewingQuarter;
                    const isLocked = p.id !== activeQuarter;

                    return (
                        <button
                            key={p.id}
                            onClick={() => setViewingQuarter(p.id)}
                            disabled={isLocked}
                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex flex-col items-center gap-0.5 ${
                                isLocked
                                ? 'bg-slate-100/50 text-slate-400 cursor-not-allowed opacity-50'
                                : isSelected 
                                    ? 'bg-white text-[#0038A8] shadow-md' 
                                    : 'text-slate-500 hover:bg-white/50'
                            }`}
                        >
                            <span>{p.label}</span>
                            {isCurrent && <span className="text-[8px] text-emerald-500 font-black tracking-normal lowercase">Active Now</span>}
                            {isLocked && <TbLock size={10} className="text-slate-400" />}
                        </button>
                    );
                })}
            </div>
            {activeQuarter === '' && (
                <div className="mb-8 p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-center gap-2">
                    <TbAlertCircle size={16} className="text-amber-500" />
                    <p className="text-[10px] font-bold text-amber-800">
                        OFF-SEASON: The utilization reporting window is currently closed.
                    </p>
                </div>
            )}
            <div className="mb-8" />

            {/* ─── Intervention List ─── */}
            <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center mb-2 px-2">
                    <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Planned Interventions</h2>
                </div>

                {selectedInterventions.map(intId => {
                    const allocation = budgetEstimates[intId] || 0;
                    const qData = utilizationData[intId] || {};
                    const qValObj = qData[viewingQuarter] || {};
                    const currentVal = qValObj?.amount !== undefined ? qValObj.amount : qValObj;
                    const currentStatus = qValObj?.status || 'Not Yet Started';
                    
                    // Calculate total used for this intervention so far
                    const totalUsedInt = Object.values(qData).reduce((sum, val) => sum + (parseFloat(val?.amount !== undefined ? val.amount : val) || 0), 0);
                    const intProgress = allocation > 0 ? (totalUsedInt / allocation) * 100 : 0;

                    return (
                        <div key={intId} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex gap-3">
                                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                                        <TbTarget size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900 leading-tight mb-1">{intId}</h3>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-slate-400 uppercase">Allocated:</span>
                                            <span className="text-[10px] font-bold text-slate-600">₱{allocation.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${intProgress > 100 ? 'bg-rose-50 text-rose-600' : 'bg-deped-blue/5 text-deped-blue'}`}>
                                        {intProgress.toFixed(0)}% Utilized
                                    </span>
                                </div>
                            </div>

                            <div className="relative">
                                {(() => {
                                    const qData = utilizationData[intId] || {};
                                    let prevTotal = 0;
                                    const viewIdx = periods.findIndex(p => p.id === viewingQuarter);
                                    for (let i = 0; i < viewIdx; i++) {
                                        const qVal = qData[periods[i].id];
                                        prevTotal += (parseFloat(qVal?.amount !== undefined ? qVal.amount : qVal) || 0);
                                    }
                                    
                                    const isBudgetExhausted = prevTotal >= allocation && allocation > 0;
                                    const isOffSeason = activeQuarter === '';
                                    const isNotActiveWindow = viewingQuarter !== activeQuarter;
                                    const isInputLocked = isBudgetExhausted || isOffSeason || isNotActiveWindow; 
                                    
                                    return (
                                        <div className="relative space-y-3">
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xs">₱</span>
                                                <input
                                                    type="number"
                                                    value={typeof currentVal === 'object' ? '' : currentVal}
                                                    onChange={(e) => handleUpdateUtilization(intId, e.target.value)}
                                                    disabled={isInputLocked}
                                                    placeholder={isInputLocked ? (isOffSeason ? "WINDOW CLOSED" : isNotActiveWindow ? "NOT ACTIVE PHASE" : "ALLOCATION EXHAUSTED") : "0.00"}
                                                    className={`w-full border-none rounded-2xl py-4 pl-8 pr-4 text-sm font-bold transition-all ${
                                                        isInputLocked 
                                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed italic' 
                                                        : 'bg-slate-50 text-slate-900 focus:ring-2 focus:ring-deped-blue/20'
                                                    }`}
                                                />
                                                {isInputLocked && (
                                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 text-slate-400">
                                                        <TbLock size={16} />
                                                        <span className="text-[10px] font-black uppercase">{isOffSeason ? "Archived" : isNotActiveWindow ? "Locked" : "Maxed"}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="relative">
                                                <select
                                                    value={currentStatus}
                                                    onChange={(e) => handleUpdateStatus(intId, e.target.value)}
                                                    disabled={isInputLocked}
                                                    className={`w-full border-none rounded-2xl py-3 pl-4 pr-10 text-sm font-bold transition-all appearance-none ${
                                                        isInputLocked
                                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed italic'
                                                        : 'bg-slate-50 text-slate-900 focus:ring-2 focus:ring-deped-blue/20 cursor-pointer'
                                                    }`}
                                                >
                                                    <option value="Not Yet Started">Not Yet Started</option>
                                                    <option value="Ongoing">Ongoing</option>
                                                    <option value="Completed">Completed</option>
                                                </select>
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                    <TbChevronRight size={16} className="rotate-90" />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ─── Save Action ─── */}
            <div className="mt-8 pb-12">
                {totalUtilized > totalAllocated && (
                    <div className="mb-4 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3">
                        <TbAlertCircle className="text-rose-500 shrink-0 mt-0.5" size={18} />
                        <p className="text-[11px] text-rose-700 font-bold leading-relaxed">
                            UNABLE TO SAVE: Total utilization (₱{totalUtilized.toLocaleString()}) exceeds the allocated budget (₱{totalAllocated.toLocaleString()}). Please adjust your inputs.
                        </p>
                    </div>
                )}
                
                <button
                    onClick={handleSave}
                    disabled={saving || (totalAllocated > 0 && totalUtilized > totalAllocated) || activeQuarter === '' || viewingQuarter !== activeQuarter}
                    className={`w-full py-5 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        (totalAllocated > 0 && totalUtilized > totalAllocated) 
                        ? 'bg-rose-500 shadow-rose-500/20' 
                        : (activeQuarter === '' || viewingQuarter !== activeQuarter)
                            ? 'bg-slate-400 shadow-slate-400/20'
                            : 'bg-emerald-500 shadow-emerald-500/20'
                    }`}
                >
                    {saving ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <>
                            <TbCheck size={20} />
                            Save Quarterly Updates
                        </>
                    )}
                </button>
                <p className="text-center text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-4 italic">
                    {activeQuarter === '' ? "Reporting window is closed" : "Updates will be reflected in the dashboard progress"}
                </p>
            </div>
        </div>
    );
};

export default SIIFUtilization;
