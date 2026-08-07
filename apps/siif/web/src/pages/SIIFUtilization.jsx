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
    TbChevronLeft,
    TbArrowLeft
} from 'react-icons/tb';
import { useNavigate } from 'react-router-dom';
import { useSIIFUtilization } from '../hooks/useSIIFUtilization';
import { updateUtilization } from '../services/siifService';
import SiifLoader from '../components/SiifLoader';

const SIIFUtilization = ({ user, token }) => {
    const navigate = useNavigate();
    const [saving, setSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

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
        return <SiifLoader text="Loading Utilization..." />;
    }

    // PHASE 2 PILOT TEST LOCK
    const IS_UNDER_DEVELOPMENT = false;
    if (IS_UNDER_DEVELOPMENT) {
        return (
        <main className="w-full pt-3 sm:pt-4 lg:pt-8 pb-32 text-lg">
                <div className="max-w-2xl mx-auto mt-12">
                    <article className="siif-card">
                        <div className="siif-card-inner text-center p-10">
                            <motion.div 
                                initial={{ scale: 0.9, opacity: 0, y: 10 }} 
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                                className="relative mx-auto w-32 h-32 mb-8"
                            >
                                <div className="absolute inset-0 bg-indigo-400 blur-[32px] opacity-20 rounded-full animate-pulse" />
                                <div className="relative w-full h-full bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-100/60 rounded-[2.5rem] flex items-center justify-center shadow-xl shadow-indigo-900/5 rotate-3 hover:rotate-0 transition-all duration-300">
                                    <TbTool size={56} className="text-indigo-500" />
                                </div>
                                <div className="absolute -bottom-3 -right-3 bg-white rounded-2xl p-2.5 shadow-lg border border-slate-100 -rotate-6">
                                    <TbAlertCircle size={28} className="text-purple-500" />
                                </div>
                            </motion.div>
                            
                            <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-slate-900 to-slate-500 mb-6 tracking-tight uppercase italic" style={{ fontFamily: 'var(--font-heading)' }}>
                                Under Development
                            </h1>
                            
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1, duration: 0.4 }}
                                className="relative overflow-hidden bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-8 mb-8 max-w-lg mx-auto shadow-2xl shadow-slate-200/40 text-left"
                            >
                                <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-indigo-400 to-purple-400" />
                                
                                <p className="text-base text-slate-600 mb-6 leading-relaxed font-medium">
                                    This feature is currently under development and will be released during <strong className="text-slate-900 font-black px-2 py-1 bg-slate-100 rounded-lg shadow-sm border border-slate-200/60 mx-1">Phase 2</strong> of the pilot test.
                                </p>
                                
                                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl p-4 md:p-5 border border-purple-100/50 flex flex-col md:flex-row items-start gap-4">
                                    <div className="p-3 bg-white rounded-xl shadow-sm shrink-0 border border-purple-100">
                                        <TbLayoutDashboard size={24} className="text-purple-500" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] md:text-xs text-purple-800 font-black leading-relaxed uppercase tracking-widest mb-1.5">
                                            Stay Tuned
                                        </p>
                                        <p className="text-sm text-slate-700 font-bold leading-relaxed">
                                            We are working hard to bring you this feature soon.
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                            <button
                                onClick={() => navigate('/siif')}
                                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20"
                            >
                                Return to Dashboard
                                <TbChevronRight size={18} />
                            </button>
                        </div>
                    </article>
                </div>
            </main>
        );
    }

    // PHASE 1 LOCK: Planning phase still active
    if (isPlanningPhase) {
        return (
        <main className="w-full pt-3 sm:pt-4 lg:pt-8 pb-32 text-lg">
                <div className="max-w-2xl mx-auto mt-12">
                    <article className="siif-card">
                        <div className="siif-card-inner text-center p-10">
                            <motion.div 
                                initial={{ scale: 0.9, opacity: 0, y: 10 }} 
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                                className="relative mx-auto w-32 h-32 mb-8"
                            >
                                <div className="absolute inset-0 bg-blue-400 blur-[32px] opacity-20 rounded-full animate-pulse" />
                                <div className="relative w-full h-full bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-100/60 rounded-[2.5rem] flex items-center justify-center shadow-xl shadow-blue-900/5 rotate-3 hover:rotate-0 transition-all duration-300">
                                    <TbClock size={56} className="text-blue-500" />
                                </div>
                                <div className="absolute -bottom-3 -right-3 bg-white rounded-2xl p-2.5 shadow-lg border border-slate-100 -rotate-6">
                                    <TbLayoutDashboard size={28} className="text-indigo-500" />
                                </div>
                            </motion.div>
                            
                            <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-slate-900 to-slate-500 mb-6 tracking-tight uppercase italic" style={{ fontFamily: 'var(--font-heading)' }}>
                                Planning Phase Active
                            </h1>
                            
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1, duration: 0.4 }}
                                className="relative overflow-hidden bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-8 mb-8 max-w-lg mx-auto shadow-2xl shadow-slate-200/40 text-left"
                            >
                                <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-blue-400 to-indigo-400" />
                                
                                <p className="text-base text-slate-600 mb-6 leading-relaxed font-medium">
                                    Utilization tracking will become available once the <strong className="text-slate-900 font-black px-2 py-1 bg-slate-100 rounded-lg shadow-sm border border-slate-200/60 mx-1">SIIF Planning Phase</strong> is officially over.
                                </p>
                                
                                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-2xl p-4 md:p-5 border border-indigo-100/50 flex flex-col md:flex-row items-start gap-4">
                                    <div className="p-3 bg-white rounded-xl shadow-sm shrink-0 border border-indigo-100">
                                        <TbClock size={24} className="text-indigo-500" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] md:text-xs text-indigo-800 font-black leading-relaxed uppercase tracking-widest mb-1.5">
                                            Estimated Opening
                                        </p>
                                        <p className="text-sm text-slate-700 font-bold leading-relaxed">
                                            {deadline ? new Date(deadline).toLocaleString() : 'TBD'}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                            <button
                                onClick={() => navigate('/siif/forms')}
                                className="w-full py-4 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg"
                                style={{ background: 'linear-gradient(135deg, var(--navy), var(--blue))' }}
                            >
                                Review Baseline Plan
                                <TbChevronRight size={18} />
                            </button>
                        </div>
                    </article>
                </div>
            </main>
        );
    }

    // PHASE 2 LOCK: Deadline over but NO submission found or still draft
    if (!isSubmitted) {
        return (
        <main className="w-full pt-3 sm:pt-4 lg:pt-8 pb-32 text-lg">
                <div className="max-w-2xl mx-auto mt-12">
                    <article className="siif-card">
                        <div className="siif-card-inner text-center p-10">
                            <motion.div 
                                initial={{ scale: 0.9, opacity: 0, y: 10 }} 
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                                className="relative mx-auto w-32 h-32 mb-8"
                            >
                                <div className="absolute inset-0 bg-amber-400 blur-[32px] opacity-20 rounded-full animate-pulse" />
                                <div className="relative w-full h-full bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-100/60 rounded-[2.5rem] flex items-center justify-center shadow-xl shadow-amber-900/5 rotate-3 hover:rotate-0 transition-all duration-300">
                                    <TbLock size={56} className="text-amber-500" />
                                </div>
                                <div className="absolute -bottom-3 -right-3 bg-white rounded-2xl p-2.5 shadow-lg border border-slate-100 -rotate-6">
                                    <TbAlertCircle size={28} className="text-rose-500" />
                                </div>
                            </motion.div>
                            
                            <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-slate-900 to-slate-500 mb-6 tracking-tight uppercase italic" style={{ fontFamily: 'var(--font-heading)' }}>
                                No Baseline Found
                            </h1>
                            
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1, duration: 0.4 }}
                                className="relative overflow-hidden bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-8 mb-8 max-w-lg mx-auto shadow-2xl shadow-slate-200/40 text-left"
                            >
                                <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-amber-400 to-rose-400" />
                                
                                <p className="text-base text-slate-600 mb-6 leading-relaxed font-medium">
                                    The planning window has closed, but no submitted <strong className="text-slate-900 font-black px-2 py-1 bg-slate-100 rounded-lg shadow-sm border border-slate-200/60 mx-1">SIIF Baseline Plan</strong> was found for your school.
                                </p>
                                
                                <div className="bg-gradient-to-r from-rose-50 to-amber-50 rounded-2xl p-4 md:p-5 border border-rose-100/50 flex flex-col md:flex-row items-start gap-4">
                                    <div className="p-3 bg-white rounded-xl shadow-sm shrink-0 border border-rose-100">
                                        <TbLayoutDashboard size={24} className="text-rose-500" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] md:text-xs text-rose-800 font-black leading-relaxed uppercase tracking-widest mb-1.5">
                                            Feature Disabled
                                        </p>
                                        <p className="text-sm text-slate-700 font-bold leading-relaxed">
                                            Utilization tracking cannot be activated because there is no reviewed budget to track against.
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                            <button
                                onClick={() => navigate('/siif/forms')}
                                className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center justify-center gap-2 shadow-lg"
                            >
                                View Archived Forms
                                <TbChevronRight size={18} />
                            </button>
                        </div>
                    </article>
                </div>
            </main>
        );
    }

    // PHASE 3 LOCK: Plan is submitted but Pending Review
    const statusVal = submission.status?.toLowerCase() || '';
    if (statusVal === 'submitted') {
        return (
        <main className="w-full pt-3 sm:pt-4 lg:pt-8 pb-32 text-lg">
                <div className="max-w-2xl mx-auto mt-12">
                    <article className="siif-card">
                        <div className="siif-card-inner text-center p-10">
                            <motion.div 
                                initial={{ scale: 0.9, opacity: 0, y: 10 }} 
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                                className="relative mx-auto w-32 h-32 mb-8"
                            >
                                <div className="absolute inset-0 bg-amber-400 blur-[32px] opacity-20 rounded-full animate-pulse" />
                                <div className="relative w-full h-full bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-100/60 rounded-[2.5rem] flex items-center justify-center shadow-xl shadow-amber-900/5 rotate-3 hover:rotate-0 transition-all duration-300">
                                    <TbClock size={56} className="text-amber-500 animate-pulse" />
                                </div>
                                <div className="absolute -bottom-3 -right-3 bg-white rounded-2xl p-2.5 shadow-lg border border-slate-100 -rotate-6">
                                    <TbAlertCircle size={28} className="text-orange-500" />
                                </div>
                            </motion.div>
                            
                            <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-slate-900 to-slate-500 mb-6 tracking-tight uppercase italic" style={{ fontFamily: 'var(--font-heading)' }}>
                                Pending SDO Review
                            </h1>
                            
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1, duration: 0.4 }}
                                className="relative overflow-hidden bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-8 mb-8 max-w-lg mx-auto shadow-2xl shadow-slate-200/40 text-left"
                            >
                                <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-amber-400 to-orange-400" />
                                
                                <p className="text-base text-slate-600 mb-6 leading-relaxed font-medium">
                                    Your submitted plan is currently waiting for review from the <strong className="text-slate-900 font-black px-2 py-1 bg-slate-100 rounded-lg shadow-sm border border-slate-200/60 mx-1">Division Office</strong>.
                                </p>
                                
                                <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl p-4 md:p-5 border border-orange-100/50 flex flex-col md:flex-row items-start gap-4">
                                    <div className="p-3 bg-white rounded-xl shadow-sm shrink-0 border border-orange-100">
                                        <TbClock size={24} className="text-orange-500" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] md:text-xs text-orange-800 font-black leading-relaxed uppercase tracking-widest mb-1.5">
                                            Status: Pending
                                        </p>
                                        <p className="text-sm text-slate-700 font-bold leading-relaxed">
                                            You can begin tracking your quarterly utilization once your baseline plan has been officially reviewed.
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                            <button
                                onClick={() => navigate('/siif/forms')}
                                className="w-full py-4 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg"
                                style={{ background: 'linear-gradient(135deg, var(--navy), var(--blue))' }}
                            >
                                View Read-Only Plan
                                <TbChevronRight size={18} />
                            </button>
                        </div>
                    </article>
                </div>
            </main>
        );
    }

    // PHASE 4 LOCK: Plan is disapproved
    if (statusVal === 'disapproved') {
        return (
        <main className="w-full pt-3 sm:pt-4 lg:pt-8 pb-32 text-lg">
                <div className="max-w-2xl mx-auto mt-12">
                    <article className="siif-card">
                        <div className="siif-card-inner text-center p-10">
                            <motion.div 
                                initial={{ scale: 0.9, opacity: 0, y: 10 }} 
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                                className="relative mx-auto w-32 h-32 mb-8"
                            >
                                <div className="absolute inset-0 bg-red-400 blur-[32px] opacity-20 rounded-full animate-pulse" />
                                <div className="relative w-full h-full bg-gradient-to-br from-red-50 to-rose-50 border-2 border-red-100/60 rounded-[2.5rem] flex items-center justify-center shadow-xl shadow-red-900/5 rotate-3 hover:rotate-0 transition-all duration-300">
                                    <TbAlertCircle size={56} className="text-red-500" />
                                </div>
                                <div className="absolute -bottom-3 -right-3 bg-white rounded-2xl p-2.5 shadow-lg border border-slate-100 -rotate-6">
                                    <TbLock size={28} className="text-rose-500" />
                                </div>
                            </motion.div>
                            
                            <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-slate-900 to-slate-500 mb-6 tracking-tight uppercase italic" style={{ fontFamily: 'var(--font-heading)' }}>
                                Plan Disapproved
                            </h1>
                            
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1, duration: 0.4 }}
                                className="relative overflow-hidden bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-8 mb-8 max-w-lg mx-auto shadow-2xl shadow-slate-200/40 text-left"
                            >
                                <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-red-400 to-rose-400" />
                                
                                <p className="text-base text-slate-600 mb-6 leading-relaxed font-medium">
                                    Your plan was <strong className="text-red-600 font-black px-2 py-1 bg-red-50 rounded-lg shadow-sm border border-red-200/60 mx-1">Disapproved</strong> by the Division Office and the submission deadline has passed.
                                </p>
                                
                                <div className="bg-gradient-to-r from-rose-50 to-red-50 rounded-2xl p-4 md:p-5 border border-rose-100/50 flex flex-col md:flex-row items-start gap-4">
                                    <div className="p-3 bg-white rounded-xl shadow-sm shrink-0 border border-rose-100">
                                        <TbAlertCircle size={24} className="text-red-500" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] md:text-xs text-red-800 font-black leading-relaxed uppercase tracking-widest mb-1.5">
                                            Feature Disabled
                                        </p>
                                        <p className="text-sm text-slate-700 font-bold leading-relaxed">
                                            Utilization tracking cannot proceed without a reviewed baseline.
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                            <button
                                onClick={() => navigate('/siif/forms')}
                                className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center justify-center gap-2 shadow-lg"
                            >
                                View Rejection Details
                                <TbChevronRight size={18} />
                            </button>
                        </div>
                    </article>
                </div>
            </main>
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

        // Calculate the current overall total utilization WITHOUT the active quarter for this specific intervention
        let currentTotalUtilized = 0;
        selectedInterventions.forEach(id => {
            const intUtil = utilizationData[id] || {};
            if (id === intId) {
                // For the current intervention, add only other phases
                periods.forEach(p => {
                    if (p.id !== activeQuarter) {
                        const qVal = intUtil[p.id];
                        currentTotalUtilized += (parseFloat(qVal?.amount !== undefined ? qVal.amount : qVal) || 0);
                    }
                });
            } else {
                // For other interventions, add all phases
                Object.values(intUtil).forEach(qVal => {
                    currentTotalUtilized += (parseFloat(qVal?.amount !== undefined ? qVal.amount : qVal) || 0);
                });
            }
        });

        const newTotal = currentTotalUtilized + amount;

        // 🛡️ [TOTAL ALLOCATION RESTRICTION]
        if (totalAllocated > 0 && newTotal > totalAllocated) {
            const maxAllowed = Math.max(0, totalAllocated - currentTotalUtilized);
            alert(`⚠️ Overall Budget Restriction\n\nYou cannot exceed the school's total allocation (₱${totalAllocated.toLocaleString()}).\n\nMaximum allowable amount to input here is ₱${maxAllowed.toLocaleString()}.`);
            return;
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
        setHasUnsavedChanges(true);
    };

    const handleUpdateJustification = (intId, text) => {
        setUtilizationData(prev => ({
            ...prev,
            [intId]: {
                ...(prev[intId] || {}),
                [activeQuarter]: {
                    ...((prev[intId] || {})[activeQuarter] || {}),
                    justification: text
                }
            }
        }));
        setHasUnsavedChanges(true);
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
        setHasUnsavedChanges(true);
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
                        finalUtilizationData[intId][activeQuarter] = { amount: '0', status: 'Not Yet Started', justification: '' };
                    }
                });
            }

            console.log('💾 [SIIFUtilization] Saving utilization updates:', finalUtilizationData);
            await updateUtilization(submission.submissionId, finalUtilizationData, token);

            // Sync local state so it reflects the defaults we just saved
            setUtilizationData(finalUtilizationData);
            setHasUnsavedChanges(false);

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
        <main className="w-full pt-3 sm:pt-4 lg:pt-8 pb-32 text-lg">
            
            {/* ── Header ── */}
            <header className="topbar print:hidden mb-8">
                <div className="page-title">
                    <p className="eyebrow">
                        DEPARTMENT OF EDUCATION | HUMAN RESOURCE AND ORGANIZATIONAL DEVELOPMENT AND INFRASTRUCTURE
                    </p>
                    <h1>School Innovation and Improvement Fund</h1>
                </div>

                <div className="siif-topbar-actions w-full sm:w-auto mt-4 sm:mt-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    
                    {/* Overall Progress Pill */}
                    <section className="siif-school-pill w-full sm:w-auto flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 sm:gap-1 shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
                        <div className="flex flex-col items-start sm:items-end">
                            <small style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--slate-500)' }}>Total Utilized</small>
                            <strong style={{ fontSize: 'clamp(20px, 5vw, 28px)', background: 'linear-gradient(to right, var(--navy), var(--blue))', WebkitBackgroundClip: 'text', color: 'transparent', margin: 0, lineHeight: 1 }}>
                                {overallProgress.toFixed(1)}%
                            </strong>
                        </div>
                        <div className="flex-1 sm:w-full" style={{ maxWidth: '120px', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(overallProgress, 100)}%`, height: '100%', background: overallProgress > 100 ? 'var(--red)' : 'var(--blue)', transition: 'width 0.3s ease' }} />
                        </div>
                    </section>
                </div>
            </header>

            {/* ─── Summary Dashboard ─── */}
            <div className="grid grid-cols-1 gap-4 mb-8 mt-6">
                <article className="siif-card siif-progress-highlight">
                    <div className="siif-card-inner relative overflow-hidden">
                        <div className="siif-card-header relative z-10">
                            <div>
                                <h2>FY {officialAllocation?.fiscal_year || new Date().getFullYear()} Total Utilization Progress</h2>
                                <p className="siif-card-subtitle">
                                    {officialAllocation.allocation_amount > 0
                                        ? "Based on Finance Official Allocation"
                                        : "Based on School Estimated Budget"}
                                    {officialAllocation.remarks && ` • ${officialAllocation.remarks}`}
                                </p>
                            </div>
                            <span className={`siif-status ${overallProgress > 100 ? 'bad bg-red-50 text-red-600 border border-red-200' : 'ok'}`}>
                                {overallProgress.toFixed(1)}%
                            </span>
                        </div>

                        <div className="siif-allocation-summary relative z-10" style={{ paddingTop: '24px', paddingBottom: '20px' }}>
                            <div>
                                <p className="siif-card-subtitle">Total Utilized</p>
                                <h3 className="siif-big-number">₱{totalUtilized.toLocaleString()}</h3>
                            </div>
                            <div className="text-right flex flex-col items-end">
                                <p className="siif-card-subtitle">Total Allocated</p>
                                <h3 className="siif-big-number" style={{ fontSize: '1.25rem', color: 'var(--slate-400)' }}>/ ₱{totalAllocated.toLocaleString()}</h3>
                            </div>
                        </div>

                        <div className="siif-progress-track relative z-10">
                            <motion.div
                                className="siif-progress-fill"
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(overallProgress, 100)}%` }}
                                style={{ background: overallProgress > 100 ? 'var(--red)' : 'var(--blue)' }}
                                transition={{ duration: 1.2, ease: 'easeOut' }}
                            >
                                {overallProgress.toFixed(1)}%
                            </motion.div>
                        </div>

                        {/* Background decoration */}
                        <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-deped-blue/5 rounded-full blur-3xl pointer-events-none z-0"></div>
                    </div>
                </article>

                {/* Information Note */}
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 shadow-sm mx-1">
                    <TbAlertCircle className="text-amber-500 shrink-0 mt-0.5" size={18} />
                    <div>
                        <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-1" style={{ fontFamily: 'var(--font-heading)' }}>Utilization Note</p>
                        <p className="text-[11px] text-amber-700 font-medium leading-relaxed">
                            Quarterly utilization can exceed the estimated budget set for a specific intervention, but the total utilization across all quarters must not exceed your official total allocation.
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
                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex flex-col items-center gap-0.5 ${isLocked
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
            <div className="mb-8">
                <div className="flex justify-between items-center mb-4 px-2">
                    <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Planned Interventions</h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-stretch">
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
                        <article key={intId} className="siif-card h-full">
                            <div className="siif-card-inner flex flex-col" style={{ height: '100%' }}>
                                <div className="flex flex-wrap items-start justify-between gap-3 mb-4 border-b border-slate-100 pb-4 shrink-0">
                                    <div className="flex gap-3 items-center min-w-0">
                                        <div className="w-10 h-10 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 shadow-sm shrink-0">
                                            <TbTarget size={20} />
                                        </div>
                                        <div className="min-w-0">
                                            <h2 className="truncate" style={{ fontSize: '14px', lineHeight: 1.2 }} title={intId}>{intId}</h2>
                                            <p className="siif-card-subtitle mt-1 leading-tight">
                                                Allocated: <strong style={{ color: 'var(--blue)' }}>₱{allocation.toLocaleString()}</strong>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="shrink-0">
                                        <span className={`inline-block px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg whitespace-nowrap ${intProgress > 100 ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
                                            {intProgress.toFixed(0)}% Utilized
                                        </span>
                                    </div>
                                </div>

                            <div className="relative flex-1 overflow-y-auto siif-intervention-scroll">
                                {(() => {
                                    // Check if overall school budget is exhausted
                                    let prevOverallTotal = 0;
                                    const viewIdx = periods.findIndex(p => p.id === viewingQuarter);
                                    selectedInterventions.forEach(id => {
                                        const iData = utilizationData[id] || {};
                                        for (let i = 0; i < viewIdx; i++) {
                                            const qVal = iData[periods[i].id];
                                            prevOverallTotal += (parseFloat(qVal?.amount !== undefined ? qVal.amount : qVal) || 0);
                                        }
                                    });
                                    const isBudgetExhausted = totalAllocated > 0 && prevOverallTotal >= totalAllocated;
                                    const isOffSeason = activeQuarter === '';
                                    const isNotActiveWindow = viewingQuarter !== activeQuarter;
                                    const isInputLocked = isBudgetExhausted || isOffSeason || isNotActiveWindow;

                                    return (
                                        <div className="relative flex flex-col gap-3">
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xs">₱</span>
                                                <input
                                                    type="number"
                                                    value={typeof currentVal === 'object' ? '' : currentVal}
                                                    onChange={(e) => handleUpdateUtilization(intId, e.target.value)}
                                                    disabled={isInputLocked}
                                                    placeholder={isInputLocked ? (isOffSeason ? "WINDOW CLOSED" : isNotActiveWindow ? "NOT ACTIVE PHASE" : "ALLOCATION EXHAUSTED") : "0.00"}
                                                    className={`w-full border-none rounded-2xl py-4 pl-8 pr-4 text-sm font-bold transition-all ${isInputLocked
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
                                                    className={`w-full border-none rounded-2xl py-3 pl-4 pr-10 text-sm font-bold transition-all appearance-none ${isInputLocked
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

                                            {/* Justification zone */}
                                            <div className="overflow-hidden">
                                                <AnimatePresence>
                                                    {parseFloat(currentVal) > allocation && !isNotActiveWindow && (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 6 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: 6 }}
                                                            transition={{ duration: 0.18 }}
                                                        >
                                                            <div className="pt-2">
                                                                <div className="rounded-xl overflow-hidden border border-amber-200 shadow-sm shadow-amber-100/60">
                                                                    {/* Header bar */}
                                                                    <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-400">
                                                                        <div className="w-4 h-4 rounded-md bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                                                                            <TbAlertCircle size={10} className="text-white" />
                                                                        </div>
                                                                        <span className="text-[9px] font-black text-white uppercase tracking-widest leading-none">Justification Required</span>
                                                                    </div>
                                                                    {/* Textarea */}
                                                                    <textarea
                                                                        value={qValObj?.justification || ''}
                                                                        onChange={(e) => handleUpdateJustification(intId, e.target.value)}
                                                                        disabled={isInputLocked}
                                                                        placeholder="Provide a detailed justification for exceeding the allocated budget estimate..."
                                                                        className={`w-full border-none p-3 text-xs font-medium transition-all resize-none outline-none focus:outline-none h-[85px] ${
                                                                            !qValObj?.justification?.trim()
                                                                                ? 'bg-amber-50 placeholder-amber-400/70 text-amber-900'
                                                                                : 'bg-slate-50 text-slate-700'
                                                                        }`}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </article>
                );
                })}
                </div>
            </div>

            {/* ─── Save Action ─── */}
            <div className="mt-8 pb-12">
                {(() => {
                    let missingJustification = false;
                    if (activeQuarter) {
                        selectedInterventions.forEach(intId => {
                            const qData = utilizationData[intId] || {};
                            const qValObj = qData[activeQuarter] || {};
                            const amount = parseFloat(qValObj?.amount !== undefined ? qValObj.amount : qValObj) || 0;
                            const allocation = budgetEstimates[intId] || 0;
                            if (amount > allocation && !qValObj?.justification?.trim()) {
                                missingJustification = true;
                            }
                        });
                    }

                    const isSaveDisabled = saving || (totalAllocated > 0 && totalUtilized > totalAllocated) || activeQuarter === '' || viewingQuarter !== activeQuarter || missingJustification;

                    return (
                        <>
                            {totalUtilized > totalAllocated && (
                                <div className="mb-4 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3">
                                    <TbAlertCircle className="text-rose-500 shrink-0 mt-0.5" size={18} />
                                    <p className="text-[11px] text-rose-700 font-bold leading-relaxed">
                                        UNABLE TO SAVE: Total utilization (₱{totalUtilized.toLocaleString()}) exceeds the allocated budget (₱{totalAllocated.toLocaleString()}). Please adjust your inputs.
                                    </p>
                                </div>
                            )}
                            {missingJustification && totalUtilized <= totalAllocated && (
                                <div className="mb-4 p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
                                    <TbAlertCircle className="text-amber-500 shrink-0 mt-0.5" size={18} />
                                    <p className="text-[11px] text-amber-700 font-bold leading-relaxed">
                                        JUSTIFICATION REQUIRED: You have entered amounts exceeding the initial budget estimates. Please provide a justification for all highlighted fields before saving.
                                    </p>
                                </div>
                            )}

                            <button
                                onClick={handleSave}
                                disabled={isSaveDisabled || !hasUnsavedChanges}
                                className={`w-full py-5 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:cursor-not-allowed ${(totalAllocated > 0 && totalUtilized > totalAllocated)
                                        ? 'bg-rose-500 shadow-rose-500/20 disabled:opacity-50'
                                        : (activeQuarter === '' || viewingQuarter !== activeQuarter)
                                            ? 'bg-slate-400 shadow-slate-400/20 disabled:opacity-50'
                                            : !hasUnsavedChanges
                                                ? 'bg-slate-800 shadow-slate-800/20 opacity-80'
                                                : 'bg-emerald-500 shadow-emerald-500/20'
                                    }`}
                            >
                                {saving ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : !hasUnsavedChanges ? (
                                    <>
                                        <TbCheck size={20} className="text-emerald-400" />
                                        All Updates Saved
                                    </>
                                ) : (
                                    <>
                                        <TbCheck size={20} />
                                        Save Quarterly Updates
                                    </>
                                )}
                            </button>
                        </>
                    );
                })()}
                <p className="text-center text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-4 italic">
                    {activeQuarter === '' ? "Reporting window is closed" : "Updates will be reflected in the dashboard progress"}
                </p>
            </div>
        </main>
    );
};

export default SIIFUtilization;
