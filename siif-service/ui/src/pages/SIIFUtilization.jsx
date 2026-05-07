import React, { useState, useEffect } from 'react';
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
    TbClock
} from 'react-icons/tb';
import { useNavigate } from 'react-router-dom';

const SIIFUtilization = ({ user }) => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [submission, setSubmission] = useState(null);
    const [utilizationData, setUtilizationData] = useState({});
    const [deadline, setDeadline] = useState(null);
    const [isExpired, setIsExpired] = useState(false);
    const [activeQuarter, setActiveQuarter] = useState(0); // Real active quarter from date
    const [viewingQuarter, setViewingQuarter] = useState(1); // Currently viewed quarter in UI
    const [officialAllocation, setOfficialAllocation] = useState({ allocation_amount: 0, spent_amount: 0 });

    const periods = [
        { id: 1, label: 'Q1', full: 'Q1: July - September' },
        { id: 2, label: 'Q2', full: 'Q2: October - December' },
        { id: 3, label: 'Q3', full: 'Q3: January - March' }
    ];

    // ─── Phase & Period Detection ──────────────────────────────────────────────
    useEffect(() => {
        const now = new Date();
        const month = now.getMonth(); // 0-11
        
        let q = 0;
        // Q1: July - September (6, 7, 8)
        if (month >= 6 && month <= 8) q = 1;
        // Q2: October - December (9, 10, 11)
        else if (month >= 9 && month <= 11) q = 2;
        // Q3: January - March (0, 1, 2)
        else if (month >= 0 && month <= 2) q = 3;
        
        setActiveQuarter(q);
        if (q > 0) setViewingQuarter(q);
        else setViewingQuarter(1); // Default to Q1 if off-season
    }, []);
    
    // ─── Data Loading ──────────────────────────────────────────────────────────
    useEffect(() => {
        // Robustly resolve schoolId
        const schoolId = user?.school_id || user?.schoolId || user?.id || user?.uid || user?.sub;
        
        if (!schoolId || schoolId === 'undefined') {
            console.warn('⚠️ [SIIFUtilization] No valid schoolId found on user:', user);
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            console.log('🔍 [SIIFUtilization] Fetching data for school:', schoolId);
            try {
                const headers = { 'Authorization': `Bearer ${user.token}` };

                // 1. Fetch Deadline (CRITICAL for phase locking)
                try {
                    const dlRes = await fetch('/api/siif/settings/deadline', { headers });
                    if (dlRes.ok) {
                        const dlData = await dlRes.json();
                        if (dlData && dlData.deadline) {
                            setDeadline(dlData.deadline);
                            const dlDate = new Date(dlData.deadline);
                            const now = new Date();
                            setIsExpired(now > dlDate);
                            console.log(`🛡️ [SIIF_LOCK] Utilization Phase Status: ${now > dlDate ? 'ACTIVE' : 'LOCKED (Planning Phase)'}`);
                        }
                    }
                } catch (dlErr) {
                    console.error('🔥 [SIIFUtilization] Failed to fetch deadline:', dlErr);
                }

                // 2. Fetch Submission & Allocation
                const res = await fetch(`/api/siif/submission/${schoolId}`, { headers });
                const data = await res.json();
                console.log('📦 [SIIFUtilization] Data received from server:', data);
                
                if (data && data.success && data.submission) {
                    console.log('✅ [SIIFUtilization] Submission found. Status:', data.submission.status);
                    setSubmission(data.submission);
                    setUtilizationData(data.utilization || {});
                    if (data.allocation) {
                        setOfficialAllocation(data.allocation);
                        console.log('💰 [SIIFUtilization] Official allocation found:', data.allocation);
                    }
                } else if (data === null) {
                    console.warn('⚠️ [SIIFUtilization] Server returned null (no submission)');
                } else {
                    console.warn('⚠️ [SIIFUtilization] No valid submission found or server returned failure');
                }
            } catch (err) {
                console.error('🔥 [SIIFUtilization] Fetch failed:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user.school_id, user.schoolId, user.id, user.uid, user.token]);

    // ─── Verification Logic ─────────────────────────────────────────────────────
    const isPlanningPhase = !isExpired;
    const isSubmitted = submission?.status === 'submitted';

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-deped-blue/20 border-t-deped-blue rounded-full animate-spin"></div>
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
                        onClick={() => navigate('/forms')}
                        className="w-full py-4 bg-[#0038A8] text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-[#002d86] transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                    >
                        Review Baseline Plan
                        <TbChevronRight size={18} />
                    </button>
                </div>
            </div>
        );
    }

    // PHASE 2 LOCK: Deadline over but NO submission found
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
                        Utilization tracking is disabled because there is no approved budget to track against.
                    </p>
                    <button
                        onClick={() => navigate('/forms')}
                        className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center justify-center gap-2 shadow-lg"
                    >
                        View Archived Forms
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
                totalUtilized += (parseFloat(qVal) || 0);
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

        // 1️⃣ Calculate total utilized in PREVIOUS quarters
        let previousQuartersTotal = 0;
        for (let q = 1; q < activeQuarter; q++) {
            previousQuartersTotal += (parseFloat(qData[`q${q}`]) || 0);
        }

        // 🛡️ [CUMULATIVE LOCK] If already maxed in previous quarters, block immediately
        if (previousQuartersTotal >= allocation) {
            const currentPeriod = periods.find(p => p.id === activeQuarter)?.label || `Q${activeQuarter}`;
            alert(`⚠️ Allocation Exhausted\n\nYou have already utilized the full ₱${allocation.toLocaleString()} allocation in previous reporting periods. No further inputs are allowed for this intervention.`);
            return;
        }

        // 2️⃣ Calculate total utilized in OTHER quarters
        let otherQuartersTotal = 0;
        periods.forEach(p => {
            if (p.id !== activeQuarter) {
                otherQuartersTotal += (parseFloat(qData[`q${p.id}`]) || 0);
            }
        });

        // 🛡️ [BUDGET RESTRICTION] Check if total exceeds intervention's plan
        if (otherQuartersTotal + amount > allocation) {
            const maxAllowed = Math.max(0, allocation - otherQuartersTotal);
            alert(`⚠️ Budget Restriction\n\nYou cannot exceed the planned budget for this intervention (₱${allocation.toLocaleString()}).\n\nMaximum allowable for this quarter is ₱${maxAllowed.toLocaleString()}.`);
            return;
        }

        // 🚀 [MAX OUT WARNING] Notify user if they hit the limit now
        if (otherQuartersTotal + amount === allocation && amount > 0) {
            const currentPeriod = periods.find(p => p.id === activeQuarter)?.label || `Q${activeQuarter}`;
            alert(`✅ Maximum Allocation Reached\n\nYou have reached the ₱${allocation.toLocaleString()} limit for this intervention. \n\nNOTE: Since you've maxed out the budget in ${currentPeriod}, you will not be able to add more utilization in future reporting periods.`);
        }

        const newData = {
            ...utilizationData,
            [intId]: {
                ...(utilizationData[intId] || {}),
                [`q${activeQuarter}`]: value
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
            console.log('💾 [SIIFUtilization] Saving utilization updates:', utilizationData);
            const res = await fetch('/api/siif/utilization', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify({
                    submissionId: submission.submissionId,
                    utilizationData
                })
            });

            if (!res.ok) throw new Error('Failed to update utilization');
            console.log('✅ [SIIFUtilization] Data saved successfully');
            alert('Quarterly updates saved successfully!');
        } catch (err) {
            console.error('🔥 [SIIFUtilization] Save failed:', err);
            alert('Error saving: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    // ─── Phase-Based Locking UI ───
    if (!isExpired && !loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 max-w-sm w-full text-center">
                    <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                        <TbClock size={40} />
                    </div>
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-3">Planning Phase Active</h2>
                    <p className="text-xs text-slate-500 font-bold leading-relaxed mb-8">
                        The utilization tracking module is currently locked. You can start recording your quarterly updates once the planning phase concludes on {deadline ? new Date(deadline).toLocaleDateString() : 'the deadline'}.
                    </p>
                    <button
                        onClick={() => navigate('/siif/forms')}
                        className="w-full py-5 bg-deped-blue text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-900/20 active:scale-95 transition-all"
                    >
                        Go to Planning Hub
                    </button>
                </div>
            </div>
        );
    }

    if (submission === null && !loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 max-w-sm w-full text-center">
                    <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                        <TbAlertCircle size={40} />
                    </div>
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-3">No Baseline Found</h2>
                    <p className="text-xs text-slate-500 font-bold leading-relaxed mb-8">
                        It looks like your school hasn't submitted a SIIF intervention plan for this fiscal year. A submitted plan is required before you can track utilization.
                    </p>
                    <button
                        onClick={() => navigate('/siif/forms')}
                        className="w-full py-5 bg-deped-red text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-red-900/20 active:scale-95 transition-all"
                    >
                        Create Intervention Plan
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-6 pb-32">
            <header className="mb-8">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 bg-[#0038A8] rounded-xl flex items-center justify-center text-white shadow-lg">
                        <TbTrendingUp size={24} />
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">SIIF Utilization</h1>
                </div>
                <p className="text-slate-500 text-sm font-bold pl-13">FY 2026 Quarterly Tracking</p>
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
                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex flex-col items-center gap-0.5 ${
                                isSelected 
                                ? 'bg-white text-[#0038A8] shadow-md' 
                                : 'text-slate-500 hover:bg-white/50'
                            }`}
                        >
                            <span>{p.label}</span>
                            {isCurrent && <span className="text-[8px] text-emerald-500 font-black tracking-normal lowercase">Active Now</span>}
                            {isLocked && !isSelected && <TbLock size={10} className="text-slate-400" />}
                        </button>
                    );
                })}
            </div>
            {activeQuarter === 0 && (
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
                    const currentVal = qData[`q${viewingQuarter}`] || '';
                    
                    // Calculate total used for this intervention so far
                    const totalUsedInt = Object.values(qData).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
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
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xs">₱</span>
                                {(() => {
                                    const qData = utilizationData[intId] || {};
                                    let prevTotal = 0;
                                    for (let q = 1; q < viewingQuarter; q++) {
                                        prevTotal += (parseFloat(qData[`q${q}`]) || 0);
                                    }
                                    
                                    // Lock conditions:
                                    // 1. Budget exhausted in previous quarters
                                    // 2. Off-season (activeQuarter === 0)
                                    // 3. Not the active quarter
                                    const isBudgetExhausted = prevTotal >= allocation && allocation > 0;
                                    const isOffSeason = activeQuarter === 0;
                                    const isNotActiveWindow = viewingQuarter !== activeQuarter;
                                    
                                    // Correct logic for disabling input:
                                    // The input shown is ALWAYS for the currently SELECTED quarter in the navigation.
                                    // But we should only allow editing if the SELECTED quarter is the ACTIVE one.
                                    const isInputLocked = isBudgetExhausted || isOffSeason || isNotActiveWindow; 
                                    
                                    return (
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={currentVal}
                                                onChange={(e) => handleUpdateUtilization(intId, e.target.value)}
                                                disabled={isInputLocked}
                                                placeholder={isInputLocked ? (isOffSeason ? "WINDOW CLOSED" : isNotActiveWindow ? "NOT ACTIVE QUARTER" : "ALLOCATION EXHAUSTED") : "0.00"}
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
                                    );
                                })()}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ─── Save Action (Moved out of fixed to avoid overlap) ─── */}
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
                    disabled={saving || (totalAllocated > 0 && totalUtilized > totalAllocated) || activeQuarter === 0 || viewingQuarter !== activeQuarter}
                    className={`w-full py-5 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        (totalAllocated > 0 && totalUtilized > totalAllocated) 
                        ? 'bg-rose-500 shadow-rose-500/20' 
                        : (activeQuarter === 0 || viewingQuarter !== activeQuarter)
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
                    {activeQuarter === 0 ? "Reporting window is closed" : "Updates will be reflected in the dashboard progress"}
                </p>
            </div>
        </div>
    );
};

export default SIIFUtilization;
