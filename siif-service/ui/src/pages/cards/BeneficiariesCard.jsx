// BeneficiariesCard.jsx — Step 2 of 4
// Form → Summary → CONFIRM-to-save
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TbChevronLeft, TbChevronDown, TbChevronUp, TbCheck,
    TbChevronRight, TbArrowLeft, TbUsers
} from 'react-icons/tb';
import { INTERVENTIONS, INTERVENTION_ICONS, KEY_STAGES, GRADE_LABELS } from './siifConstants.jsx';

const BeneficiariesCard = ({ selectedInterventions, value, onChange, onConfirm, onClose, readOnly }) => {
    const [screen, setScreen]           = useState('form');
    const [expanded, setExpanded]       = useState(selectedInterventions[0] || null);
    const [confirmText, setConfirmText] = useState('');
    const [confirmError, setConfirmError] = useState(false);

    console.log('🖊️ [BeneficiariesCard_DIAGNOSTIC]', {
        screen,
        readOnly,
        interventionCount: selectedInterventions.length
    });

    const toggleGrade = (intId, grade) => {
        if (readOnly) return;
        const current = value[intId] || { selectedGrades: [], beneficiaryCounts: {} };
        const isSelected = current.selectedGrades.includes(grade);
        const newGrades = isSelected
            ? current.selectedGrades.filter(g => g !== grade)
            : [...current.selectedGrades, grade];
        const newCounts = { ...current.beneficiaryCounts };
        if (isSelected) delete newCounts[grade];
        console.log(`🔄 [BeneficiariesCard] "${intId}" toggle grade "${grade}".`);
        onChange({ ...value, [intId]: { ...current, selectedGrades: newGrades, beneficiaryCounts: newCounts } });
    };

    const updateCount = (intId, grade, count) => {
        if (readOnly) return;
        const current = value[intId] || { selectedGrades: [], beneficiaryCounts: {} };
        onChange({ ...value, [intId]: { ...current, beneficiaryCounts: { ...current.beneficiaryCounts, [grade]: count } } });
    };

    // Summary rows
    const summaryRows = selectedInterventions.flatMap(intId => {
        const data = value[intId] || {};
        return (data.selectedGrades || []).map(g => ({
            intId, grade: g,
            label: GRADE_LABELS[g],
            count: data.beneficiaryCounts?.[g] || '0',
            intLabel: INTERVENTIONS.find(i => i.id === intId)?.label
        }));
    });
    const totalLearners = summaryRows.reduce((sum, r) => sum + (parseInt(r.count) || 0), 0);

    const goToSummary = () => {
        const hasGrades = selectedInterventions.some(id => (value[id]?.selectedGrades || []).length > 0);
        if (!hasGrades) {
            alert('Please select at least one grade level for at least one intervention.');
            return;
        }
        console.log('➡️ [BeneficiariesCard] Moving to summary.');
        setScreen('summary');
    };

    const handleSave = () => {
        if (readOnly) {
            onClose();
            return;
        }
        if (confirmText.trim().toUpperCase() !== 'CONFIRM') {
            setConfirmError(true);
            setTimeout(() => setConfirmError(false), 1500);
            console.warn('⚠️ [BeneficiariesCard] CONFIRM mismatch.');
            return;
        }
        console.log('✅ [BeneficiariesCard] Confirmed. Summary rows:', summaryRows);
        onConfirm();
    };

    // ── FORM SCREEN ─────────────────────────────────────────────────────────────
    const renderFormScreen = () => (
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-3 pb-36">
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
                <p className="text-[11px] text-slate-500 leading-relaxed">
                    {readOnly
                        ? "Viewing target beneficiaries for each intervention."
                        : "For each intervention, select the grade levels and enter estimated learner counts."}
                </p>
            </div>

            {selectedInterventions.map(intId => {
                const info = INTERVENTIONS.find(i => i.id === intId);
                const data = value[intId] || { selectedGrades: [], beneficiaryCounts: {} };
                const isExpanded = expanded === intId;
                const gradeCount = data.selectedGrades.length;

                return (
                    <div key={intId} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                        <button
                            onClick={() => setExpanded(isExpanded ? null : intId)}
                            className="w-full p-5 flex items-center gap-4 text-left"
                        >
                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-deped-blue flex items-center justify-center shrink-0">
                                {INTERVENTION_ICONS[intId]}
                            </div>
                            <div className="flex-1">
                                <p className="font-black text-sm text-slate-800 uppercase tracking-tight">{info?.label}</p>
                                <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                                    {gradeCount > 0 ? `${gradeCount} grade${gradeCount !== 1 ? 's' : ''} selected` : 'Tap to select grade levels'}
                                </p>
                            </div>
                            {gradeCount > 0 && (
                                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                                    <TbCheck size={11} className="text-white" />
                                </div>
                            )}
                            {isExpanded ? <TbChevronUp className="text-slate-400 shrink-0" /> : <TbChevronDown className="text-slate-400 shrink-0" />}
                        </button>

                        {isExpanded && (
                            <div className="border-t border-slate-50 px-5 pb-5 pt-4 space-y-5">
                                {KEY_STAGES.map(ks => {
                                    const relevantGrades = ks.grades.filter(g => !readOnly || data.selectedGrades.includes(g));
                                    if (relevantGrades.length === 0) return null;
                                    return (
                                        <div key={ks.id}>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{ks.label}</p>
                                            <div className="flex flex-wrap gap-2 mb-3">
                                                {relevantGrades.map(g => {
                                                    const active = data.selectedGrades.includes(g);
                                                    return (
                                                        <button
                                                            key={g}
                                                            disabled={readOnly}
                                                            onClick={() => toggleGrade(intId, g)}
                                                            className={`px-3.5 py-2 rounded-2xl text-[10px] font-black uppercase transition-all duration-200 ${
                                                                active ? 'bg-deped-blue text-white shadow-md' : 'bg-slate-50 text-slate-500 border border-slate-100'
                                                            } ${readOnly ? 'cursor-default' : ''}`}
                                                        >{GRADE_LABELS[g]}</button>
                                                    );
                                                })}
                                            </div>
                                            <div className="space-y-2">
                                                {ks.grades.filter(g => data.selectedGrades.includes(g)).map(g => (
                                                    <div key={g} className="flex items-center justify-between bg-slate-50 px-4 py-3 rounded-2xl border border-slate-100">
                                                        <span className="text-[10px] font-black text-slate-600 uppercase">{GRADE_LABELS[g]}</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] text-slate-400 font-bold">Learners:</span>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                placeholder="0"
                                                                readOnly={readOnly}
                                                                value={data.beneficiaryCounts[g] || ''}
                                                                onChange={e => updateCount(intId, g, e.target.value)}
                                                                className={`w-20 bg-white border border-slate-200 rounded-xl px-3 py-2 text-right text-xs font-black text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:outline-none ${readOnly ? 'bg-slate-100 cursor-default' : ''}`}
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}

            <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={goToSummary}
                className="w-full py-5 bg-emerald-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-emerald-900/20 active:scale-95 transition-transform flex items-center justify-center gap-3 mt-4"
            >
                {readOnly ? 'View Summary' : 'Review Summary'} <TbChevronRight size={18} />
            </motion.button>
        </div>
    );

    // ── SUMMARY SCREEN ───────────────────────────────────────────────────────────
    const renderSummaryScreen = () => (
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4 pb-36">
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Summary — Target Beneficiaries</p>
                
                <div className="space-y-6">
                    {selectedInterventions.map(intId => {
                        const info = INTERVENTIONS.find(i => i.id === intId);
                        const data = value[intId] || { selectedGrades: [], beneficiaryCounts: {} };
                        // Filter to grades that actually have a count
                        const grades = (data.selectedGrades || []).filter(g => (parseInt(data.beneficiaryCounts[g]) || 0) > 0);
                        
                        if (grades.length === 0) return null;

                        return (
                            <div key={intId} className="space-y-2">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
                                    <p className="text-[10px] font-black text-slate-800 uppercase tracking-tight">{info?.label}</p>
                                </div>
                                <div className="pl-3.5 space-y-1.5">
                                    {grades.map(g => (
                                        <div key={g} className="flex justify-between items-center bg-slate-50/50 px-3 py-2 rounded-xl border border-slate-100/50">
                                            <p className="text-[10px] font-bold text-slate-500 uppercase">{GRADE_LABELS[g]}</p>
                                            <p className="text-[11px] font-black text-emerald-600">{parseInt(data.beneficiaryCounts[g]).toLocaleString()} Learners</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-6 pt-5 border-t border-slate-100 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <TbUsers className="text-slate-400" size={16} />
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Learners Across Plan</p>
                    </div>
                    <p className="text-sm font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">{totalLearners.toLocaleString()}</p>
                </div>
            </div>

            {/* Navigation / Edit */}
            {!readOnly && (
                <button
                    onClick={() => setScreen('form')}
                    className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-slate-200 hover:bg-slate-200 transition-colors"
                >
                    ← Edit Beneficiaries
                </button>
            )}

            <div className="p-5 bg-white rounded-[2rem] border border-slate-100 shadow-sm space-y-3">
                {readOnly ? (
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
                        <p className="text-[11px] font-bold text-slate-600 leading-relaxed">
                            Please confirm the beneficiary counts above are accurate.
                        </p>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            Type <span className="text-emerald-600 font-black">CONFIRM</span> to save
                        </p>
                        <input
                            type="text"
                            placeholder="Type CONFIRM here..."
                            value={confirmText}
                            onChange={e => setConfirmText(e.target.value)}
                            className={`w-full px-5 py-4 rounded-2xl border-2 font-black text-sm tracking-widest text-center transition-all focus:outline-none ${
                                confirmError
                                    ? 'border-red-400 bg-red-50 text-red-600'
                                    : 'border-slate-200 bg-slate-50 text-slate-800 focus:border-emerald-500 focus:bg-white'
                            }`}
                        />
                        {confirmError && (
                            <p className="text-center text-[10px] text-red-500 font-bold animate-bounce">Please type CONFIRM exactly</p>
                        )}
                        <button
                            onClick={handleSave}
                            className="w-full py-5 bg-emerald-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-emerald-900/20 active:scale-95 transition-transform"
                        >
                            Save Beneficiaries ✓
                        </button>
                    </>
                )}
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col overflow-hidden">
            <div className="bg-emerald-600 text-white pt-14 pb-8 px-6 rounded-b-[3rem] shadow-xl relative overflow-hidden shrink-0">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-24 -mt-24 pointer-events-none" />
                <div className="relative z-10 flex items-center gap-4">
                    <button
                        onClick={screen === 'summary' ? () => setScreen('form') : onClose}
                        className="p-2.5 bg-white/10 rounded-2xl border border-white/20"
                    >
                        {screen === 'summary' ? <TbArrowLeft size={20} /> : <TbChevronLeft size={20} />}
                    </button>
                    <div>
                        <p className="text-[9px] font-black text-emerald-200 uppercase tracking-[0.3em]">
                            Step 2 of 4 — {screen === 'summary' ? 'Review & Confirm' : 'Select'}
                        </p>
                        <h1 className="text-xl font-black italic uppercase tracking-tight">Target Beneficiaries</h1>
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

export default BeneficiariesCard;
