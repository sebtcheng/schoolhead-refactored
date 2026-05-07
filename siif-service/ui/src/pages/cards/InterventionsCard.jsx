// InterventionsCard.jsx — Step 1 of 4
// Form → Summary → CONFIRM-to-save
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TbCheck, TbChevronLeft, TbChevronRight, TbArrowLeft } from 'react-icons/tb';
import { FiInfo } from 'react-icons/fi';
import { INTERVENTIONS, INTERVENTION_ICONS } from './siifConstants.jsx';

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
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-3 pb-36">
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm mb-2">
                <p className="text-[11px] text-slate-500 leading-relaxed">
                    {readOnly 
                        ? "Viewing selected interventions for this fiscal year." 
                        : "Select all interventions your school plans to implement this fiscal year. You must select at least one to proceed."}
                </p>
            </div>

            {INTERVENTIONS.map(opt => {
                const active = value.includes(opt.id);
                return (
                    <React.Fragment key={opt.id}>
                        <button
                            onClick={() => toggle(opt.id)}
                            disabled={readOnly}
                            className={`w-full p-5 rounded-3xl border-2 text-left flex items-center gap-4 transition-all duration-300 ${!readOnly ? 'active:scale-[0.98]' : ''} ${
                                active
                                    ? 'border-deped-blue bg-blue-50/60 shadow-md shadow-blue-100'
                                    : 'border-slate-100 bg-white hover:border-slate-200'
                            } ${readOnly ? 'cursor-default' : ''}`}
                        >
                            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all ${active ? 'bg-deped-blue text-white' : 'bg-slate-50 text-slate-400'}`}>
                                {INTERVENTION_ICONS[opt.id]}
                            </div>
                            <div className="flex-1 text-left">
                                <p className={`font-black text-sm uppercase tracking-tight leading-none mb-1 ${active ? 'text-deped-blue' : 'text-slate-700'}`}>{opt.label}</p>
                                <p className="text-[10px] text-slate-400 leading-relaxed">{opt.desc}</p>
                            </div>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${active ? 'border-deped-blue bg-deped-blue' : 'border-slate-200 bg-white'}`}>
                                {active && <TbCheck size={13} className="text-white" />}
                            </div>
                        </button>

                        {/* ARAL sub-question (Remediation only) */}
                        <AnimatePresence>
                            {active && opt.id === 'remediation' && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="mx-3 overflow-hidden"
                                >
                                    <div className="p-5 bg-amber-50 rounded-b-3xl border-x-2 border-b-2 border-amber-200/60 space-y-4 -mt-2 pt-6">
                                        <p className="text-xs font-black text-amber-800 flex items-center gap-2 italic">
                                            <FiInfo /> {readOnly ? 'ARAL Implementation Plan:' : 'Do you plan to implement ARAL?'}
                                        </p>
                                        <div className="flex gap-2">
                                            {[{ label: 'Yes', val: true }, { label: 'No', val: false }].map(o => (
                                                <button
                                                    key={o.label}
                                                    disabled={readOnly}
                                                    onClick={() => onAralChange({ ...aral, planned: o.val })}
                                                    className={`flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border ${
                                                        aral.planned === o.val
                                                            ? o.val ? 'bg-deped-blue text-white border-deped-blue' : 'bg-slate-200 text-slate-600 border-slate-300'
                                                            : 'bg-white text-slate-400 border-amber-200'
                                                    } ${readOnly && aral.planned !== o.val ? 'hidden' : ''} ${readOnly ? 'flex-none w-full' : ''}`}
                                                >{o.label}</button>
                                            ))}
                                        </div>
                                        {aral.planned === true && (
                                            <div className="space-y-2">
                                                <p className="text-[10px] text-amber-600 font-black uppercase tracking-widest">ARAL Subject Areas</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {['Reading', 'Mathematics', 'Science'].map(subj => {
                                                        const checked = aral.subjects.includes(subj);
                                                        if (readOnly && !checked) return null;
                                                        return (
                                                            <button
                                                                key={subj}
                                                                disabled={readOnly}
                                                                onClick={() => onAralChange({
                                                                    ...aral,
                                                                    subjects: checked
                                                                        ? aral.subjects.filter(s => s !== subj)
                                                                        : [...aral.subjects, subj]
                                                                })}
                                                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                                                                    checked ? 'bg-deped-blue border-deped-blue text-white' : 'bg-white border-amber-200 text-amber-700'
                                                                } ${readOnly ? 'cursor-default' : ''}`}
                                                            >{subj}</button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </React.Fragment>
                );
            })}

            {/* Next button */}
            {value.length > 0 && (
                <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={goToSummary}
                    className="w-full py-5 bg-deped-blue text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-900/20 active:scale-95 transition-transform flex items-center justify-center gap-3 mt-4"
                >
                    {readOnly ? 'View Summary' : 'Review Summary'} <TbChevronRight size={18} />
                </motion.button>
            )}
        </div>
    );

    // ── SUMMARY SCREEN ───────────────────────────────────────────────────────────
    const renderSummaryScreen = () => (
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4 pb-36">
            <div className="p-5 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Summary — Selected Interventions</p>
                <div className="space-y-3">
                    {value.map(id => {
                        const info = INTERVENTIONS.find(i => i.id === id);
                        return (
                            <div key={id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                                <div className="w-8 h-8 rounded-xl bg-blue-50 text-deped-blue flex items-center justify-center shrink-0">
                                    {INTERVENTION_ICONS[id]}
                                </div>
                                <p className="text-xs font-black text-slate-700 uppercase tracking-tight">{info?.label}</p>
                                <TbCheck className="ml-auto text-emerald-500 shrink-0" size={16} />
                            </div>
                        );
                    })}
                </div>
                {value.includes('remediation') && (
                    <div className="mt-4 pt-4 border-t border-slate-100 bg-amber-50 rounded-2xl p-4">
                        <p className="text-[9px] text-amber-600 font-black uppercase tracking-widest mb-1">ARAL Status</p>
                        <p className="text-[11px] font-bold text-slate-700">
                            {aral.planned === true
                                ? `Planned — ${aral.subjects.length > 0 ? aral.subjects.join(', ') : 'No subjects specified'}`
                                : aral.planned === false ? 'Not planned'
                                : 'Not answered'}
                        </p>
                    </div>
                )}
            </div>

            {/* Navigation / Edit */}
            {!readOnly && (
                <button
                    onClick={() => setScreen('form')}
                    className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-slate-200 hover:bg-slate-200 transition-colors"
                >
                    ← Edit Selection
                </button>
            )}

            {/* CONFIRM gate */}
            <div className="p-5 bg-white rounded-[2rem] border border-slate-100 shadow-sm space-y-3">
                {readOnly ? (
                    <div className="space-y-4">
                        <p className="text-[11px] font-bold text-slate-600 leading-relaxed text-center">
                            This plan has been finalized and submitted.
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
                        <p className="text-[11px] font-bold text-slate-600 leading-relaxed">
                            Please confirm that the intervention selection above is accurate and complete for your school's plan.
                        </p>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            Type <span className="text-deped-blue font-black">CONFIRM</span> to save
                        </p>
                        <input
                            type="text"
                            placeholder="Type CONFIRM here..."
                            value={confirmText}
                            onChange={e => setConfirmText(e.target.value)}
                            className={`w-full px-5 py-4 rounded-2xl border-2 font-black text-sm tracking-widest text-center transition-all focus:outline-none ${
                                confirmError
                                    ? 'border-red-400 bg-red-50 text-red-600'
                                    : 'border-slate-200 bg-slate-50 text-slate-800 focus:border-deped-blue focus:bg-white'
                            }`}
                        />
                        {confirmError && (
                            <p className="text-center text-[10px] text-red-500 font-bold animate-bounce">Please type CONFIRM exactly</p>
                        )}
                        <button
                            onClick={handleSave}
                            className="w-full py-5 bg-deped-blue text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-900/20 active:scale-95 transition-transform"
                        >
                            Save Interventions ✓
                        </button>
                    </>
                )}
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-deped-blue text-white pt-14 pb-8 px-6 rounded-b-[3rem] shadow-xl relative overflow-hidden shrink-0">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-24 -mt-24 pointer-events-none" />
                <div className="relative z-10 flex items-center gap-4 mb-1">
                    <button
                        onClick={screen === 'summary' ? () => setScreen('form') : onClose}
                        className="p-2.5 bg-white/10 rounded-2xl border border-white/20"
                    >
                        {screen === 'summary' ? <TbArrowLeft size={20} /> : <TbChevronLeft size={20} />}
                    </button>
                    <div>
                        <p className="text-[9px] font-black text-blue-200 uppercase tracking-[0.3em]">
                            Step 1 of 4 — {screen === 'summary' ? 'Review & Confirm' : 'Select'}
                        </p>
                        <h1 className="text-xl font-black italic uppercase tracking-tight">Interventions</h1>
                    </div>
                    {screen === 'form' && value.length > 0 && (
                        <div className="ml-auto bg-white/20 px-3 py-1.5 rounded-full">
                            <span className="text-xs font-black">{value.length} selected</span>
                        </div>
                    )}
                </div>
                {/* Step tabs */}
                <div className="relative z-10 flex gap-2 mt-4">
                    {['form', 'summary'].map((s, i) => (
                        <div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${screen === s || (s === 'form') ? 'bg-white' : 'bg-white/30'} ${screen === 'summary' && s === 'summary' ? 'bg-white' : screen === 'form' && s === 'summary' ? 'bg-white/30' : ''}`} />
                    ))}
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

export default InterventionsCard;
