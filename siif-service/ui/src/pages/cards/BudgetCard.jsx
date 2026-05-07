// BudgetCard.jsx — Step 4 of 4
// Per-intervention budget inputs → Summary → CONFIRM-to-save
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TbChevronLeft, TbChevronRight, TbArrowLeft, TbCurrencyPeso } from 'react-icons/tb';
import { FiInfo } from 'react-icons/fi';
import { INTERVENTIONS, INTERVENTION_ICONS } from './siifConstants.jsx';

const BudgetCard = ({ interventions, budgets, setBudgets, onConfirm, onClose, isLocked, allocation }) => {
    // budgets = { [intId]: amount }
    const [screen, setScreen] = useState('form');
    const [confirmText, setConfirmText] = useState('');
    const [confirmError, setConfirmError] = useState(false);

    console.log('🖊️ [BudgetCard_DIAGNOSTIC]', {
        screen,
        isLocked,
        interventionCount: interventions.length,
        hasAllocation: !!allocation
    });

    const totalBudget = Object.values(budgets).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    const allocAmt    = allocation ? (parseFloat(allocation.allocation_amount) || 0) : 0;
    const isOver      = allocation && allocAmt > 0 && totalBudget > allocAmt;
    const remaining   = allocation ? (allocAmt - totalBudget) : 0;

    const handleAmountChange = (intId, amt) => {
        if (isLocked) return;
        
        // Basic number validation
        const val = amt.replace(/[^0-9.]/g, '');
        const numVal = parseFloat(val) || 0;

        setBudgets(prev => {
            return { ...prev, [intId]: val };
        });
    };

    const goToSummary = () => {
        const allFilled = interventions.every(id => {
            const amt = parseFloat(budgets[id]);
            return !isNaN(amt) && amt > 0;
        });

        if (!allFilled) {
            alert('Please provide a budget for all selected interventions.');
            return;
        }

        if (isOver) {
            alert(`⚠️ Budget Warning\n\nYour total estimate (₱${totalBudget.toLocaleString()}) exceeds the official allocation (₱${allocAmt.toLocaleString()}).\n\nPlease check your entries before proceeding to confirmation.`);
        }

        console.log('➡️ [BudgetCard] Moving to summary.');
        setScreen('summary');
    };

    const handleSave = () => {
        if (isLocked) {
            onClose();
            return;
        }
        if (isOver) {
            alert(`⛔ BUDGET EXCEEDED\n\nTotal: ${formatCurrency(totalBudget)}\nAllocation: ${formatCurrency(allocAmt)}\n\nYou cannot proceed because your budget exceeds the allocation. Please adjust your amounts.`);
            return;
        }
        if (confirmText.trim().toUpperCase() !== 'CONFIRM') {
            setConfirmError(true);
            setTimeout(() => setConfirmError(false), 1500);
            console.warn('⚠️ [BudgetCard] CONFIRM mismatch.');
            return;
        }
        console.log('✅ [BudgetCard] Confirmed.');
        onConfirm();
    };

    const formatCurrency = (num) => {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP',
        }).format(num);
    };

    // ── FORM SCREEN ──────────────────────────────────────────────────────────────
    const renderFormScreen = () => (
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4 pb-36">
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-3 relative overflow-hidden">
                {allocAmt > 0 && (
                    <div className="absolute top-0 right-0 px-4 py-1.5 bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase rounded-bl-2xl border-b border-l border-emerald-100">
                        Official Allocation: {formatCurrency(allocAmt)}
                    </div>
                )}
                
                <p className="text-[11px] text-slate-500 leading-relaxed pr-12">
                    {isLocked 
                        ? "Viewing the approved budget for each intervention."
                        : "Specify the estimated budget requirement for each selected intervention."}
                </p>

                {!isLocked && allocAmt > 0 && (
                    <div className="mt-4 p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
                        <FiInfo className="text-amber-500 shrink-0 mt-0.5" size={16} />
                        <p className="text-[10px] font-bold text-amber-700 leading-tight">
                            <span className="uppercase block mb-1">Budget Note:</span>
                            Your total estimated budget across all interventions must not exceed your official allocation of {formatCurrency(allocAmt)}.
                        </p>
                    </div>
                )}
                
                <div className="pt-2 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Estimate</p>
                        <p className={`text-2xl font-black tracking-tight transition-colors ${isOver ? 'text-red-500' : 'text-emerald-600'}`}>
                            {formatCurrency(totalBudget)}
                        </p>
                    </div>
                    {allocAmt > 0 && (
                        <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Allowance</p>
                            <p className={`text-sm font-black tracking-tight ${remaining < 0 ? 'text-red-500' : 'text-slate-600'}`}>
                                {remaining < 0 ? '-' : ''}{formatCurrency(Math.abs(remaining))}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-3">
                {interventions.map(intId => {
                    const info = INTERVENTIONS.find(i => i.id === intId);
                    return (
                        <div key={intId} className="bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                {INTERVENTION_ICONS[intId]}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-black text-[11px] text-slate-800 uppercase truncate">{info?.label}</p>
                                <div className="mt-1 relative">
                                    <span className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₱</span>
                                    <input
                                        type="text"
                                        placeholder="0.00"
                                        readOnly={isLocked}
                                        value={budgets[intId] || ''}
                                        onChange={e => handleAmountChange(intId, e.target.value)}
                                        className={`w-full pl-4 py-1 bg-transparent border-b-2 border-slate-100 focus:border-emerald-500 transition-colors text-sm font-black text-slate-700 focus:outline-none ${isLocked ? 'border-transparent' : ''}`}
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={goToSummary}
                className={`w-full py-5 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 mt-4 ${
                    isOver ? 'bg-red-500 shadow-red-900/20' : 'bg-emerald-600 shadow-emerald-900/20'
                }`}
            >
                {isLocked ? 'View Summary' : (isOver ? 'Over Allocation Limit' : 'Review Summary')} <TbChevronRight size={18} />
            </motion.button>
        </div>
    );

    // ── SUMMARY SCREEN ───────────────────────────────────────────────────────────
    const renderSummaryScreen = () => (
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4 pb-36">
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-5 text-center">Budget Allocation Summary</p>
                
                <div className="space-y-4 mb-6">
                    {interventions.map(intId => {
                        const info = INTERVENTIONS.find(i => i.id === intId);
                        const amt = parseFloat(budgets[intId]) || 0;
                        return (
                            <div key={intId} className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                                    <p className="text-[10px] font-bold text-slate-600 uppercase">{info?.label}</p>
                                </div>
                                <p className="text-xs font-black text-slate-800">{formatCurrency(amt)}</p>
                            </div>
                        );
                    })}
                </div>

                <div className="space-y-2 pt-5 border-t-2 border-dashed border-slate-100">
                    <div className="flex items-center justify-between">
                        <p className="font-black text-[10px] text-slate-400 uppercase tracking-widest">Total Plan Budget</p>
                        <p className={`text-lg font-black tracking-tight ${isOver ? 'text-red-500' : 'text-emerald-600'}`}>
                            {formatCurrency(totalBudget)}
                        </p>
                    </div>
                    {allocAmt > 0 && (
                        <div className="flex items-center justify-between">
                            <p className="font-black text-[10px] text-slate-400 uppercase tracking-widest">Official Allocation</p>
                            <p className="text-xs font-bold text-slate-600">{formatCurrency(allocAmt)}</p>
                        </div>
                    )}
                </div>
            </div>

            {!isLocked && (
                <button
                    onClick={() => setScreen('form')}
                    className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-slate-200 hover:bg-slate-200 transition-colors"
                >
                    ← Edit Budget Allocation
                </button>
            )}

            <div className="p-6 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
                {isLocked ? (
                    <div className="space-y-4">
                        <p className="text-[11px] font-bold text-slate-600 leading-relaxed text-center">
                            This section is now read-only as the plan is submitted.
                        </p>
                        <button
                            onClick={onClose}
                            className="w-full py-5 bg-slate-800 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-slate-900/20 active:scale-95 transition-transform"
                        >
                            Close View
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="space-y-1">
                            <p className="text-[11px] font-bold text-slate-600 leading-relaxed">
                                Please confirm the budget allocation above.
                            </p>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                Type <span className="text-emerald-600 font-black">CONFIRM</span> to save
                            </p>
                        </div>
                        <input
                            type="text"
                            placeholder="Type CONFIRM here..."
                            value={confirmText}
                            onChange={e => setConfirmText(e.target.value)}
                            className={`w-full px-5 py-4 rounded-2xl border-2 font-black text-sm tracking-widest text-center transition-all focus:outline-none ${
                                confirmError
                                    ? 'border-red-400 bg-red-50 text-red-600'
                                    : 'border-slate-200 bg-slate-50 text-slate-800 focus:border-emerald-400 focus:bg-white'
                            }`}
                        />
                        {confirmError && (
                            <p className="text-center text-[10px] text-red-500 font-bold animate-bounce">Please type CONFIRM exactly</p>
                        )}
                        <button
                            onClick={handleSave}
                            className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-emerald-900/20 active:scale-95 transition-transform"
                        >
                            Save Budget Plan ✓
                        </button>
                    </>
                )}
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-violet-600 text-white pt-14 pb-8 px-6 rounded-b-[3rem] shadow-xl relative overflow-hidden shrink-0">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-24 -mt-24 pointer-events-none" />
                <div className="relative z-10 flex items-center gap-4">
                    <button
                        onClick={screen === 'summary' ? () => setScreen('form') : onClose}
                        className="p-2.5 bg-white/10 rounded-2xl border border-white/20"
                    >
                        {screen === 'summary' ? <TbArrowLeft size={20} /> : <TbChevronLeft size={20} />}
                    </button>
                    <div>
                        <p className="text-[9px] font-black text-violet-200 uppercase tracking-[0.3em]">
                            Step 4 of 4 — {screen === 'summary' ? 'Review & Confirm' : 'Enter Amounts'}
                        </p>
                        <h1 className="text-xl font-black italic uppercase tracking-tight">Budget Estimation</h1>
                    </div>
                </div>
                <div className="relative z-10 flex gap-2 mt-4">
                    <div className="h-1.5 flex-1 rounded-full bg-white" />
                    <div className={`h-1.5 flex-1 rounded-full transition-all ${screen === 'summary' ? 'bg-white' : 'bg-white/30'}`} />
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
        </div>
    );
};

export default BudgetCard;
