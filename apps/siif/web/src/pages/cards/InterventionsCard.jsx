// InterventionsCard.jsx — Step 1 of 4
// Form → Summary → CONFIRM-to-save
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TbCheck, TbChevronLeft, TbChevronRight, TbArrowLeft, TbX, TbShieldCheck, TbPuzzle, TbChecklist } from 'react-icons/tb';
import { FiInfo } from 'react-icons/fi';
import { INTERVENTIONS, INTERVENTION_ICONS, REMEDIATION_SUBJECTS } from './siifConstants.jsx';

const InterventionsCard = ({ value, aral, onChange, onAralChange, onConfirm, onClose, readOnly }) => {
    const [screen, setScreen]           = useState('form'); // 'form' | 'summary'
    const [confirmText, setConfirmText] = useState('');
    const [confirmError, setConfirmError] = useState(false);

    console.log('🖊️ [InterventionsCard_DIAGNOSTIC]', {
        screen,
        readOnly,
        valueCount: value.length,
        hasAral: !!aral
    });

    const toggle = (id) => {
        if (readOnly) return;
        const next = value.includes(id) ? value.filter(x => x !== id) : [...value, id];
        console.log(`🔄 [InterventionsCard] Toggle "${id}". New list:`, next);
        onChange(next);
    };

    const goToSummary = () => {
        if (value.length === 0) {
            alert('Please select at least one intervention before proceeding.');
            return;
        }
        // Validation: Remediation must have at least one subject area selected
        if (value.includes('remediation') && aral.subjects.length === 0) {
            alert('Please select at least one Subject Area for the Remediation intervention before proceeding.');
            return;
        }
        console.log('➡️ [InterventionsCard] Moving to summary.');
        setScreen('summary');
    };

    const handleSave = () => {
        if (readOnly) {
            onClose();
            return;
        }
        console.log('💾 [InterventionsCard] Confirm attempt. text:', confirmText);
        if (confirmText.trim().toUpperCase() !== 'CONFIRM') {
            setConfirmError(true);
            setTimeout(() => setConfirmError(false), 1500);
            console.warn('⚠️ [InterventionsCard] CONFIRM mismatch.');
            return;
        }
        console.log('✅ [InterventionsCard] Saved. interventions:', value, ' aral:', aral);
        onConfirm();
    };

    // ── FORM SCREEN ─────────────────────────────────────────────────────────────
    const renderFormScreen = () => (
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-2.5 pb-6 sm:pb-8">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mb-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 leading-snug">
                    What type of interventions does your school plan to implement?
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                    {readOnly 
                        ? "Viewing selected interventions for this fiscal year." 
                        : "Select all interventions your school plans to implement this fiscal year. You must select at least one to proceed."}
                </p>
            </div>

            {INTERVENTIONS.map(opt => {
                const active = value.includes(opt.id);
                return (
                    <React.Fragment key={opt.id}>
                        <label
                            onClick={() => toggle(opt.id)}
                            className={`group relative flex items-start gap-4 p-4 border rounded-2xl cursor-pointer select-none transition-all duration-200 min-h-[52px] ${
                                active 
                                    ? "border-blue-600 dark:border-blue-500 bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-950/20 dark:to-slate-900 pod-glow scale-[1.01]" 
                                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700"
                            } ${readOnly ? 'cursor-default' : ''}`}
                        >
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400">
                                {INTERVENTION_ICONS[opt.id]}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`font-extrabold text-base leading-snug ${active ? 'text-blue-950 dark:text-blue-100' : 'text-slate-900 dark:text-white'}`}>{opt.label}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">{opt.desc}</p>
                            </div>
                            {/* Custom Animated Check Circle */}
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all shrink-0 mt-0.5 ${
                                active 
                                    ? "bg-blue-600 border-blue-600 text-white scale-110 shadow-sm" 
                                    : "border-slate-300 dark:border-slate-700 group-hover:border-slate-400 bg-white dark:bg-slate-800"
                            }`}>
                                {active && <TbCheck size={14} className="font-bold text-white" />}
                            </div>
                        </label>

                        {/* ARAL sub-question (Remediation only) */}
                        <AnimatePresence>
                            {active && opt.id === 'remediation' && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="mx-2 overflow-hidden"
                                >
                                    <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800/50 space-y-3 mt-1">
                                        <div className="space-y-2">
                                            <p className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                                                {readOnly ? 'Selected Subject Areas' : 'Select Subject Areas'}
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {REMEDIATION_SUBJECTS.map(subj => {
                                                    const checked = aral.subjects.includes(subj);
                                                    if (readOnly && !checked) return null;
                                                    return (
                                                        <button
                                                            key={subj}
                                                            disabled={readOnly}
                                                            onClick={() => onAralChange({
                                                                ...aral,
                                                                planned: true,
                                                                subjects: checked
                                                                    ? aral.subjects.filter(s => s !== subj)
                                                                    : [...aral.subjects, subj]
                                                            })}
                                                            className={`px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border min-h-[44px] ${
                                                                checked ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-slate-800 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:bg-amber-100'
                                                            } ${readOnly ? 'cursor-default' : ''}`}
                                                        >{subj}</button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </React.Fragment>
                );
            })}

            {value.length > 0 && (
                <div className="mt-4">
                    <motion.button
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={goToSummary}
                        className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-600/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                    >
                        {readOnly ? 'View Summary' : 'Review Summary'} <TbChevronRight size={18} />
                    </motion.button>
                </div>
            )}
        </div>
    );

    // ── SUMMARY SCREEN ───────────────────────────────────────────────────────────
    const renderSummaryScreen = () => (
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4 pb-6 sm:pb-8">
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800 shadow-xs">
                        <TbPuzzle size={18} className="text-blue-600 dark:text-blue-400 shrink-0" />
                        <span className="text-xs font-black uppercase tracking-wider">
                            Selected School Interventions
                        </span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-black text-xs border border-slate-200/80 dark:border-slate-700">
                        <TbChecklist size={14} className="text-blue-600 dark:text-blue-400" />
                        <span>{value.length} Selected</span>
                    </div>
                </div>

                <div className="space-y-2.5">
                    {value.map(id => {
                        const info = INTERVENTIONS.find(i => i.id === id);
                        return (
                            <div key={id} className="flex items-center gap-6 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                                <div className="w-10 h-10 rounded-xl bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                                    {INTERVENTION_ICONS[id]}
                                </div>
                                <div className="flex-1 min-w-0 pl-2">
                                    <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100 tracking-tight leading-snug">{info?.label}</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{info?.desc}</p>
                                </div>
                                <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                                    <TbCheck size={14} className="font-black" />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {value.includes('remediation') && (
                    <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-amber-950/30 dark:to-orange-950/20 rounded-xl border border-amber-200/80 dark:border-amber-800/50 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-amber-900 dark:text-amber-300 uppercase tracking-wider">Subject Areas</span>
                            <span className="text-[9px] font-bold text-amber-700 bg-amber-200/60 dark:bg-amber-900/60 px-2 py-0.5 rounded-md">
                                {aral.subjects.length} Selected
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {aral.subjects.length > 0 ? (
                                aral.subjects.map(subj => (
                                    <span
                                        key={subj}
                                        className="px-3 py-1 text-white font-extrabold text-xs rounded-lg shadow-sm"
                                        style={{ backgroundColor: '#d97706', color: '#ffffff' }}
                                    >
                                        {subj}
                                    </span>
                                ))
                            ) : (
                                <span className="text-xs text-amber-800 dark:text-amber-300 italic">No specific subjects selected</span>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Navigation / Edit */}
            {!readOnly && (
                <button
                    onClick={() => setScreen('form')}
                    className="w-full py-3.5 px-4 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-300 rounded-xl font-extrabold text-xs uppercase tracking-widest border border-rose-200 dark:border-rose-800 transition-all flex items-center justify-center gap-2 active:scale-[0.98] shadow-sm"
                >
                    <TbArrowLeft size={16} /> Edit Selected Interventions
                </button>
            )}

            <div className="p-5 bg-gradient-to-br from-blue-50/90 via-slate-50 to-indigo-50/70 dark:from-slate-900 dark:to-blue-950/40 rounded-2xl border-2 border-blue-200/90 dark:border-blue-800/80 shadow-md space-y-4">
                {readOnly ? (
                    <div className="space-y-4 text-center">
                        <p className="text-xs font-bold text-slate-500 leading-relaxed">
                            This section is finalized and read-only as the plan is submitted.
                        </p>
                        <button
                            onClick={onClose}
                            className="w-full py-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-extrabold text-xs uppercase tracking-widest shadow-md active:scale-95 transition-all"
                        >
                            Close View
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Authenticity & Accuracy Declaration Card */}
                        <div className="flex items-start gap-3 p-3.5 bg-white/90 dark:bg-slate-800/90 rounded-xl border border-blue-200/80 dark:border-blue-900/50 shadow-sm">
                            <div className="w-10 h-10 rounded-xl bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-md">
                                <TbShieldCheck size={22} />
                            </div>
                            <div className="space-y-0.5 min-w-0">
                                <p className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                                    Data Authenticity & Accuracy Declaration
                                </p>
                                <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 leading-snug">
                                    By typing <span className="font-extrabold text-blue-700 dark:text-blue-300">CONFIRM</span> below, you certify that the intervention data submitted above is true, accurate, and officially authorized.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <input
                                type="text"
                                placeholder="Type CONFIRM to certify..."
                                value={confirmText}
                                onChange={e => setConfirmText(e.target.value)}
                                className={`w-full px-4 py-3.5 rounded-xl border-2 font-mono font-black text-sm tracking-widest text-center transition-all focus:outline-none focus:ring-4 ${
                                    confirmError
                                        ? 'border-red-400 bg-red-50 text-red-600 focus:ring-red-500/20 dark:bg-red-950/40 dark:text-red-300'
                                        : 'border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:ring-blue-500/20'
                                }`}
                            />
                            {confirmError && (
                                <p className="text-center text-xs text-red-500 font-extrabold animate-bounce">Please type CONFIRM exactly to certify data</p>
                            )}
                        </div>

                        <div className="pt-0.5">
                            <button
                                onClick={handleSave}
                                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-xl font-extrabold text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                            >
                                <TbShieldCheck size={18} /> Confirm & Certify Interventions
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );

    return (
        <div className="w-full h-full flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden">
            {/* ── v5 Ultra-Compact Low-Profile Header ── */}
            <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 z-20">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <button
                        onClick={screen === 'summary' ? () => setScreen('form') : onClose}
                        className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-all text-slate-600 dark:text-slate-300 shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center"
                    >
                        {screen === 'summary' ? <TbArrowLeft size={17} /> : <TbChevronLeft size={17} />}
                    </button>
                    <div className="min-w-0 flex-1">
                        <span className="block text-[9px] font-extrabold uppercase tracking-widest text-blue-600 dark:text-blue-400 siif-font-header leading-none mb-0.5">
                            Step 1 of 4 — {screen === 'summary' ? 'Review & Confirm' : 'Select'}
                        </span>
                        <h2 className="siif-font-header text-sm font-extrabold text-slate-800 dark:text-slate-100 tracking-tight leading-tight truncate">
                            Interventions
                        </h2>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 bg-slate-100 hover:bg-rose-100 hover:text-rose-600 dark:bg-slate-800 rounded-xl transition-all text-slate-500 shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center"
                    title="Close"
                >
                    <TbX size={17} />
                </button>
            </div>
            {/* Step progress dots */}
            <div className="flex gap-1.5 px-3 py-1 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shrink-0">
                {['form', 'summary'].map((s) => (
                    <div key={s} className={`h-0.5 flex-1 rounded-full transition-all duration-300 ${screen === s || (s === 'form' && screen !== 'summary') ? 'bg-blue-600' : screen === 'summary' && s === 'summary' ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
                ))}
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

export default InterventionsCard;

