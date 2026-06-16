// BudgetCard.jsx — Step 4 of 4 (SIIF Unified Palette Theme)
// Task 1: No 0 defaults in inputs
// Task 4: "View Beneficiaries" modal before setting budget
// Task 5: Excess budget indicator + 10-sec timer warning modal
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TbChevronLeft, TbChevronRight, TbArrowLeft, TbX, TbUsers, TbAlertTriangle, TbCheck } from 'react-icons/tb';
import { FiInfo } from 'react-icons/fi';
import { INTERVENTIONS, INTERVENTION_ICONS, GRADE_LABELS, KEY_STAGES } from './siifConstants.jsx';

const BudgetCard = ({ interventions, budgets, setBudgets, beneficiaries, onConfirm, onClose, isLocked, allocation }) => {
    const [screen, setScreen] = useState('form');
    const [confirmText, setConfirmText] = useState('');
    const [confirmError, setConfirmError] = useState(false);
    const [showBeneficiariesModal, setShowBeneficiariesModal] = useState(false);
    const [showExcessModal, setShowExcessModal] = useState(false);
    const [excessCountdown, setExcessCountdown] = useState(10);
    const countdownRef = useRef(null);

    console.log('🖊️ [BudgetCard_DIAGNOSTIC]', {
        screen,
        isLocked,
        interventionCount: interventions.length,
        hasAllocation: !!allocation,
        hasBeneficiaries: !!beneficiaries,
    });

    const safeBudgets = budgets || {};
    const totalBudget = Object.values(safeBudgets).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    const allocAmt    = allocation ? (parseFloat(allocation.allocation_amount) || 0) : 0;
    const isOver      = allocation && allocAmt > 0 && totalBudget > allocAmt;
    const excess      = allocation ? (allocAmt - totalBudget) : 0; // positive = surplus, negative = over

    const handleAmountChange = (intId, amt) => {
        if (isLocked) return;
        const val = amt.replace(/[^0-9.]/g, '').replace(/^0+(?=\d)/, '');
        setBudgets(prev => ({ ...(prev || {}), [intId]: val }));
    };

    const formatCurrency = (num) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(num);

    // ── Countdown timer for excess modal ────────────────────────────────────────
    const startCountdown = useCallback(() => {
        setExcessCountdown(10);
        clearInterval(countdownRef.current);
        countdownRef.current = setInterval(() => {
            setExcessCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(countdownRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, []);

    useEffect(() => {
        return () => clearInterval(countdownRef.current);
    }, []);

    const handleOpenExcessModal = () => {
        setShowExcessModal(true);
        startCountdown();
    };

    const handleConfirmWithExcess = () => {
        if (excessCountdown > 0) return;
        setShowExcessModal(false);
        setScreen('summary');
    };

    // ── Go to Summary ────────────────────────────────────────────────────────────
    const goToSummary = () => {
        const allFilled = interventions.every(id => {
            const amt = parseFloat(safeBudgets[id]);
            return !isNaN(amt) && amt > 0;
        });

        if (!allFilled) {
            alert('Please provide a budget estimate for all selected interventions before proceeding.');
            return;
        }

        if (isOver) {
            alert(`⛔ BUDGET EXCEEDED\n\nYour total estimate (₱${totalBudget.toLocaleString()}) exceeds the official allocation (₱${allocAmt.toLocaleString()}).\n\nYou must adjust your entries before you can proceed.`);
            return;
        }

        // If there's excess budget, show warning modal
        if (excess > 0 && !isOver) {
            handleOpenExcessModal();
            return;
        }

        console.log('➡️ [BudgetCard] Validation passed. Moving to summary.');
        setScreen('summary');
    };

    const handleSave = () => {
        if (isLocked) { onClose(); return; }
        if (isOver) {
            alert(`⛔ BUDGET EXCEEDED\n\nYou cannot save because your budget exceeds the allocation.`);
            return;
        }
        if (confirmText.trim().toUpperCase() !== 'CONFIRM') {
            setConfirmError(true);
            setTimeout(() => setConfirmError(false), 1500);
            return;
        }
        console.log('✅ [BudgetCard] Confirmed.');
        onConfirm();
    };

    // ── Beneficiaries reference data helper ──────────────────────────────────────
    const getBeneficiarySummary = () => {
        if (!beneficiaries) return [];
        return interventions.map(intId => {
            const info = INTERVENTIONS.find(i => i.id === intId);
            const data = beneficiaries[intId] || {};
            const selectedGrades = Array.isArray(data.selectedGrades) ? data.selectedGrades : [];
            const counts = data.beneficiaryCounts || {};
            const total = selectedGrades.reduce((s, g) => s + (parseInt(counts[g]) || 0), 0);
            const byKS = KEY_STAGES.map(ks => {
                const grades = ks.grades.filter(g => selectedGrades.includes(g));
                if (!grades.length) return null;
                return {
                    label: ks.label,
                    grades: grades.map(g => ({ label: GRADE_LABELS[g] || g, count: parseInt(counts[g]) || 0 })),
                    ksTotal: grades.reduce((s, g) => s + (parseInt(counts[g]) || 0), 0)
                };
            }).filter(Boolean);
            return { intId, label: info?.label || intId, total, byKS };
        });
    };

    // ── FORM SCREEN ──────────────────────────────────────────────────────────────
    const renderFormScreen = () => (
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4 pb-36">
            {/* Header Info Card */}
            <div className="siif-card p-6 space-y-3 relative overflow-hidden">
                {allocAmt > 0 && (
                    <div className="absolute top-0 right-0 px-4 py-1.5 bg-siif-blue/5 text-siif-blue text-[9px] font-black uppercase rounded-bl-2xl border-b border-l border-siif-blue/10">
                        Official Allocation: {formatCurrency(allocAmt)}
                    </div>
                )}
                <h3 className="text-sm font-black text-slate-800 mb-1 leading-snug pr-12 pt-2">
                    How much is the budget for each intervention?
                </h3>
                <p className="text-[11px] text-slate-500 leading-relaxed pr-12">
                    {isLocked ? 'Viewing the approved budget for each intervention.' : 'Enter the estimated budget amount per intervention.'}
                </p>

                {!isLocked && allocAmt > 0 && (
                    <div className="mt-2 p-4 bg-blue-50/50 border border-siif-blue/10 rounded-2xl flex items-start gap-3">
                        <FiInfo className="text-siif-blue shrink-0 mt-0.5" size={16} />
                        <p className="text-[10px] font-bold text-siif-blue leading-tight">
                            <span className="uppercase block mb-1">Budget Note:</span>
                            Your total must not exceed your official allocation of {formatCurrency(allocAmt)}.
                        </p>
                    </div>
                )}

                {/* View Beneficiaries Reference Button — Task 4 */}
                {!isLocked && beneficiaries && (
                    <button
                        onClick={() => setShowBeneficiariesModal(true)}
                        className="w-full mt-2 py-3 px-4 bg-slate-800 border border-slate-700 hover:border-slate-600 hover:bg-slate-700 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white transition-all flex items-center justify-center gap-2 active:scale-[0.98] shadow-md"
                    >
                        <TbUsers size={16} />
                        View Target Beneficiaries Reference
                    </button>
                )}

                {/* Live Totals */}
                <div className="pt-2 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Estimate</p>
                        <p className={`text-2xl font-black tracking-tight transition-colors ${isOver ? 'text-red-500' : 'text-siif-blue'}`}>
                            {formatCurrency(totalBudget)}
                        </p>
                    </div>
                    {allocAmt > 0 && (
                        <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {excess >= 0 ? 'Remaining Budget' : 'Over Limit'}
                            </p>
                            {/* Task 5: Show excess in green */}
                            <p className={`text-sm font-black tracking-tight ${excess < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                {excess < 0 ? '-' : '+'}{formatCurrency(Math.abs(excess))}
                            </p>
                        </div>
                    )}
                </div>

                {/* Excess budget indicator — Task 5 */}
                <AnimatePresence>
                    {excess > 0 && !isOver && totalBudget > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3"
                        >
                            <div className="w-7 h-7 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                                <TbCheck size={14} className="text-emerald-600" />
                            </div>
                            <p className="text-[10px] font-bold text-emerald-700">
                                <span className="font-black">Excess Budget: {formatCurrency(excess)}</span><br />
                                You have remaining allocation after all interventions. You will need to confirm this before proceeding.
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Intervention Budget Inputs */}
            <div className="space-y-3">
                {interventions.map(intId => {
                    const info = INTERVENTIONS.find(i => i.id === intId);
                    const bData = beneficiaries?.[intId] || {};
                    const counts = bData.beneficiaryCounts || {};
                    const learnersCount = (bData.selectedGrades || []).reduce((s, g) => s + (parseInt(counts[g]) || 0), 0);
                    const activeGrades = (bData.selectedGrades || []).filter(g => (parseInt(counts[g]) || 0) > 0);

                    return (
                        <div key={intId} className="siif-card p-4 sm:p-5 flex flex-col gap-3 hover:border-siif-blue transition-all duration-300">
                            {/* Header & Budget Row */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                                <div className="flex items-center gap-3 sm:gap-4 flex-1">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-siif-blue/5 text-siif-blue flex items-center justify-center shrink-0 shadow-inner">
                                        {INTERVENTION_ICONS[intId]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-black text-xs text-slate-800 uppercase tracking-tight truncate">{info?.label}</p>
                                        <p className="text-[9px] text-slate-400 font-bold mt-0.5">Estimated Budget</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2 w-full sm:w-auto shrink-0 justify-between sm:justify-start">
                                    <span className="text-[10px] font-black text-slate-400 sm:hidden">Budget:</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-black text-slate-400">₱</span>
                                        <input
                                            type="text"
                                            placeholder="0.00"
                                            readOnly={isLocked}
                                            value={(!safeBudgets[intId] || safeBudgets[intId] === '0' || safeBudgets[intId] === 0) ? '' : safeBudgets[intId]}
                                            onChange={e => handleAmountChange(intId, e.target.value)}
                                            className="w-24 bg-transparent text-right text-xs font-black text-slate-800 focus:outline-none placeholder-slate-300"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Target Learners Row (Below Budget) */}
                            <div className="bg-slate-50/70 rounded-xl p-3 border border-slate-100/50 mt-1">
                                <div className="flex items-center gap-1.5 mb-2">
                                    <TbUsers size={14} className="text-siif-blue" />
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                        Target Learners: <span className="text-siif-blue">{learnersCount.toLocaleString()} Total</span>
                                    </p>
                                </div>
                                {activeGrades.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5">
                                        {activeGrades.map(g => (
                                            <span key={g} className="text-[9px] font-bold bg-white text-slate-600 px-2 py-0.5 rounded-lg border border-slate-200/60 shadow-sm flex items-center gap-1">
                                                {GRADE_LABELS[g] || g}: <span className="text-siif-blue font-black">{counts[g]}</span>
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[9px] text-slate-400 italic">No beneficiaries targeted.</p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-4">
                <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={goToSummary}
                    className="w-full py-5 bg-siif-blue hover:bg-siif-blue/90 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-siif-blue/20 active:scale-95 transition-transform flex items-center justify-center gap-3"
                >
                    Review Summary <TbChevronRight size={18} />
                </motion.button>
            </div>
        </div>
    );

    // ── SUMMARY SCREEN ────────────────────────────────────────────────────────────
    const renderSummaryScreen = () => (
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4 pb-36">
            <div className="siif-card p-6 space-y-5">
                <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Summary — Budget Estimations</p>
                    <div className="space-y-3">
                        {interventions.map(intId => {
                            const info = INTERVENTIONS.find(i => i.id === intId);
                            const amt  = parseFloat(safeBudgets[intId]) || 0;
                            return (
                                <div key={intId} className="flex justify-between items-center bg-slate-50 px-4 py-3 rounded-2xl border border-slate-100/50">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-4 bg-siif-blue rounded-full" />
                                        <p className="text-[10px] font-black text-slate-800 uppercase tracking-tight">{info?.label}</p>
                                    </div>
                                    <p className="text-[11px] font-black text-siif-blue">{formatCurrency(amt)}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="pt-5 border-t border-slate-100 space-y-2">
                    <div className="flex justify-between items-center">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Plan Budget</p>
                        <p className="text-sm font-black text-siif-blue bg-siif-blue/5 px-3 py-1.5 rounded-full">
                            {formatCurrency(totalBudget)}
                        </p>
                    </div>
                    {allocAmt > 0 && excess > 0 && (
                        <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
                            <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Excess Budget</p>
                            <p className="text-sm font-black text-emerald-600">+{formatCurrency(excess)}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Navigation / Edit */}
            {!isLocked && (
                <button
                    onClick={() => setScreen('form')}
                    className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-slate-200 hover:bg-slate-200 transition-colors"
                >
                    ← Edit Estimates
                </button>
            )}

            <div className="p-5 bg-white rounded-[2rem] border border-slate-100 shadow-sm space-y-3">
                {isLocked ? (
                    <div className="space-y-4">
                        <p className="text-[11px] font-bold text-slate-600 leading-relaxed text-center">
                            This section is now read-only as the plan is submitted.
                        </p>
                        <button onClick={onClose} className="w-full py-5 bg-slate-800 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-slate-900/20 active:scale-95 transition-transform">
                            Close View
                        </button>
                    </div>
                ) : (
                    <>
                        <p className="text-[11px] font-bold text-slate-600 leading-relaxed">
                            Please confirm the estimated budget allocations above are accurate.
                        </p>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            Type <span className="text-siif-blue font-black">CONFIRM</span> to save
                        </p>
                        <input
                            type="text"
                            placeholder="Type CONFIRM here..."
                            value={confirmText}
                            onChange={e => setConfirmText(e.target.value)}
                            className={`w-full px-5 py-4 rounded-2xl border-2 font-black text-sm tracking-widest text-center transition-all focus:outline-none ${
                                confirmError
                                    ? 'border-red-400 bg-red-50 text-red-600'
                                    : 'border-slate-200 bg-slate-50 text-slate-800 focus:border-siif-blue focus:bg-white'
                            }`}
                        />
                        {confirmError && (
                            <p className="text-center text-[10px] text-red-500 font-bold animate-bounce">Please type CONFIRM exactly</p>
                        )}
                        <div className="mt-3">
                            <button
                                onClick={handleSave}
                                className="w-full py-5 bg-siif-blue text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-siif-blue/20 active:scale-95 transition-transform"
                            >
                                Save Estimates ✓
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );

    return (
        <div className="w-full h-full flex flex-col bg-slate-50 overflow-hidden">
            {/* Header */}
            <div className="siif-topbar !m-0 !border-x-0 !border-t-0 !rounded-b-[2rem] flex-col items-stretch !items-start !justify-start shrink-0 z-20 print:hidden relative">
                <div className="flex items-center justify-between w-full mb-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={screen === 'summary' ? () => setScreen('form') : onClose}
                            className="p-3 bg-white hover:bg-slate-50 shadow-sm border border-slate-200 rounded-2xl transition-all text-slate-600"
                        >
                            {screen === 'summary' ? <TbArrowLeft size={20} /> : <TbChevronLeft size={20} />}
                        </button>
                        <div>
                            <p className="eyebrow">
                                Step 4 of 4 — {screen === 'summary' ? 'Review & Confirm' : 'Estimate'}
                            </p>
                            <h1 className="text-xl font-black italic uppercase tracking-tight text-slate-800">Budget Estimations</h1>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 bg-white hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 shadow-sm border border-slate-200 rounded-2xl transition-all text-slate-600 shrink-0"
                        title="Close"
                    >
                        <TbX size={20} />
                    </button>
                </div>
                <div className="flex gap-2 w-full mt-2">
                    <div className="h-1.5 flex-1 rounded-full bg-siif-blue" />
                    <div className={`h-1.5 flex-1 rounded-full transition-all ${screen === 'summary' ? 'bg-siif-blue' : 'bg-slate-200'}`} />
                </div>
            </div>

            <AnimatePresence mode="wait">
                <motion.div
                    key={screen}
                    initial={{ x: screen === 'summary' ? 40 : -40, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: screen === 'summary' ? -40 : 40, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 flex flex-col overflow-hidden"
                >
                    {screen === 'form' ? renderFormScreen() : renderSummaryScreen()}
                </motion.div>
            </AnimatePresence>

            {/* ── Beneficiaries Reference Modal — Task 4 ─────────────────────────── */}
            <AnimatePresence>
                {showBeneficiariesModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ y: 50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 50, opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
                            className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
                        >
                            <div className="bg-siif-blue text-white px-6 py-5 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
                                        <TbUsers size={18} />
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-blue-200 uppercase tracking-widest">Reference</p>
                                        <h3 className="font-black text-sm uppercase tracking-tight">Target Beneficiaries</h3>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowBeneficiariesModal(false)}
                                    className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all border border-white/10"
                                >
                                    <TbX size={16} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-5 space-y-4">
                                {getBeneficiarySummary().map(({ intId, label, total, byKS }) => (
                                    <div key={intId} className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
                                        <div className="flex justify-between items-center px-4 py-3 bg-white border-b border-slate-100">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-4 bg-siif-blue rounded-full" />
                                                <span className="text-[10px] font-black text-slate-800 uppercase tracking-tight">{label}</span>
                                            </div>
                                            <span className="text-[9px] font-black text-siif-blue bg-siif-blue/5 px-2.5 py-1 rounded-full border border-siif-blue/10">
                                                {total.toLocaleString()} Total
                                            </span>
                                        </div>
                                        {byKS.length > 0 ? (
                                            <div className="p-3 space-y-2">
                                                {byKS.map(ks => (
                                                    <div key={ks.label}>
                                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{ks.label}</p>
                                                        <div className="flex flex-wrap gap-1">
                                                            {ks.grades.map(g => (
                                                                <span key={g.label} className="text-[8px] font-bold bg-white px-2 py-1 rounded-lg border border-slate-100 text-slate-600">
                                                                    {g.label}: <span className="text-siif-blue font-black">{g.count.toLocaleString()}</span>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-[10px] text-slate-400 italic p-3">No beneficiaries configured yet.</p>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="p-5 border-t border-slate-100 shrink-0">
                                <button
                                    onClick={() => setShowBeneficiariesModal(false)}
                                    className="w-full py-4 bg-siif-blue text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-md transition-all active:scale-[0.98]"
                                >
                                    Got It — Close Reference
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Excess Budget Warning Modal — Task 5 ───────────────────────────── */}
            <AnimatePresence>
                {showExcessModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[110] flex items-center justify-center p-6"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                            className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100"
                        >
                            <div className="bg-amber-500 text-white px-6 py-6 text-center">
                                <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <TbAlertTriangle size={28} className="text-white" />
                                </div>
                                <h3 className="font-black text-lg uppercase tracking-tight">Excess Budget</h3>
                                <p className="text-amber-100 text-[11px] font-bold mt-1">You have unallocated funds</p>
                            </div>

                            <div className="p-6 space-y-5">
                                <div className="text-center p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
                                    <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Remaining Unallocated Budget</p>
                                    <p className="text-2xl font-black text-emerald-600">+{formatCurrency(excess)}</p>
                                </div>

                                <p className="text-[11px] font-bold text-slate-600 leading-relaxed text-center">
                                    Your estimated budget is <strong>lower than your official allocation</strong>. Consider allocating the remaining amount to your interventions.
                                </p>

                                {/* Countdown progress */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                        <span>You may proceed in</span>
                                        <span className={`text-base font-black ${excessCountdown > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                            {excessCountdown > 0 ? `${excessCountdown}s` : '✓ Ready'}
                                        </span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <motion.div
                                            className="h-full bg-amber-400 rounded-full"
                                            initial={{ width: '100%' }}
                                            animate={{ width: `${(excessCountdown / 10) * 100}%` }}
                                            transition={{ duration: 0.5 }}
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => { setShowExcessModal(false); clearInterval(countdownRef.current); }}
                                        className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                                    >
                                        ← Adjust Budget
                                    </button>
                                    <button
                                        onClick={handleConfirmWithExcess}
                                        disabled={excessCountdown > 0}
                                        className="flex-1 py-3 bg-siif-blue text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-md transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        Proceed Anyway
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default BudgetCard;
