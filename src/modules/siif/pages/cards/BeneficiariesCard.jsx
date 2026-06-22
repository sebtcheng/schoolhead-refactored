// BeneficiariesCard.jsx — Step 2 of 4 (Modal Configuration & SIIF Theme)
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TbChevronLeft, TbChevronRight, TbArrowLeft, TbUsers, TbCheck, TbX
} from 'react-icons/tb';
import { INTERVENTIONS, INTERVENTION_ICONS, KEY_STAGES, GRADE_LABELS } from './siifConstants.jsx';

const BeneficiariesCard = ({ selectedInterventions, value, aral, onChange, onApplyConfig, onConfirm, onClose, readOnly }) => {
    const [screen, setScreen] = useState('form');
    const [activeModalInt, setActiveModalInt] = useState(null);
    const [confirmText, setConfirmText] = useState('');
    const [confirmError, setConfirmError] = useState(false);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

    console.log('🖊️ [BeneficiariesCard_DIAGNOSTIC]', {
        screen,
        readOnly,
        interventionCount: selectedInterventions.length
    });

    const toggleGrade = (intId, grade) => {
        if (readOnly) return;
        const current = value[intId] || {};
        const selectedGrades = Array.isArray(current.selectedGrades) ? current.selectedGrades : [];
        const beneficiaryCounts = current.beneficiaryCounts || {};

        const isSelected = selectedGrades.includes(grade);
        const newGrades = isSelected
            ? selectedGrades.filter(g => g !== grade)
            : [...selectedGrades, grade];
        const newCounts = { ...beneficiaryCounts };
        if (isSelected) {
            delete newCounts[grade];
        } else {
            newCounts[grade] = ''; // Default to empty instead of 0
        }
        console.log(`🔄 [BeneficiariesCard] "${intId}" toggle grade "${grade}".`);
        onChange({ ...value, [intId]: { ...current, selectedGrades: newGrades, beneficiaryCounts: newCounts } });
    };

    const updateCount = (intId, grade, count) => {
        if (readOnly) return;
        let val = count.replace(/^0+(?=\d)/, '');
        const current = value[intId] || {};
        const selectedGrades = Array.isArray(current.selectedGrades) ? current.selectedGrades : [];
        const beneficiaryCounts = current.beneficiaryCounts || {};
        onChange({ ...value, [intId]: { ...current, selectedGrades, beneficiaryCounts: { ...beneficiaryCounts, [grade]: val } } });
    };

    const updateAralCount = (intId, grade, subject, count) => {
        if (readOnly) return;
        let val = count.replace(/^0+(?=\d)/, '');
        const current = value[intId] || {};
        const aralCounts = current.aralCounts || {};
        const gradeAral = aralCounts[grade] || {};
        const newGradeAral = { ...gradeAral, [subject]: val };

        const total = Object.values(newGradeAral).reduce((sum, v) => sum + (parseInt(v) || 0), 0);
        const beneficiaryCounts = current.beneficiaryCounts || {};

        onChange({
            ...value,
            [intId]: {
                ...current,
                beneficiaryCounts: {
                    ...beneficiaryCounts,
                    [grade]: total > 0 ? total.toString() : ''
                },
                aralCounts: {
                    ...aralCounts,
                    [grade]: newGradeAral
                }
            }
        });
    };

    // Summary rows
    const summaryRows = selectedInterventions.flatMap(intId => {
        const data = value[intId] || {};
        const selectedGrades = Array.isArray(data.selectedGrades) ? data.selectedGrades : [];
        const beneficiaryCounts = data.beneficiaryCounts || {};
        return selectedGrades.map(g => ({
            intId, grade: g,
            label: GRADE_LABELS[g] || g,
            count: beneficiaryCounts[g] || '',
            intLabel: INTERVENTIONS.find(i => i.id === intId)?.label || intId
        }));
    });
    const totalLearners = summaryRows.reduce((sum, r) => sum + (parseInt(r.count) || 0), 0);

    const goToSummary = () => {
        for (const intId of selectedInterventions) {
            const data = value[intId] || {};
            const selectedGrades = Array.isArray(data.selectedGrades) ? data.selectedGrades : [];
            const beneficiaryCounts = data.beneficiaryCounts || {};
            const label = INTERVENTIONS.find(i => i.id === intId)?.label || intId;

            if (selectedGrades.length === 0) {
                alert(`Please select at least one grade level for the intervention "${label}".`);
                setActiveModalInt(intId);
                return;
            }

            for (const g of selectedGrades) {
                const count = parseInt(beneficiaryCounts[g]) || 0;
                if (count <= 0) {
                    alert(`0 beneficiary is not accepted. If you don't have beneficiary for this grade level, unclick the grade level.`);
                    setActiveModalInt(intId);
                    return;
                }
            }
        }
        console.log('➡️ [BeneficiariesCard] Validation passed. Moving to summary.');
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
                <h3 className="text-sm font-black text-slate-800 mb-1 leading-snug">
                    Who will be the beneficiaries of each intervention?
                </h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                    {readOnly
                        ? "Viewing target beneficiaries for each intervention."
                        : "For each intervention, configure the grade levels and estimated learner counts using popup panels."}
                </p>
            </div>

            {selectedInterventions.map(intId => {
                const info = INTERVENTIONS.find(i => i.id === intId);
                const data = value[intId] || {};
                const selectedGrades = Array.isArray(data.selectedGrades) ? data.selectedGrades : [];
                const beneficiaryCounts = data.beneficiaryCounts || {};
                const gradeCount = selectedGrades.length;

                return (
                    <div
                        key={intId}
                        onClick={() => !readOnly && setActiveModalInt(intId)}
                        className={`siif-card p-4 sm:p-5 flex flex-col gap-3 transition-all duration-300 ${!readOnly ? 'cursor-pointer hover:border-siif-blue hover:shadow-lg' : ''
                            }`}
                    >
                        <div className="flex items-center gap-3 sm:gap-4 w-full">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-siif-blue/5 text-siif-blue flex items-center justify-center shrink-0 shadow-inner">
                                {INTERVENTION_ICONS[intId]}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-black text-xs sm:text-sm text-slate-800 uppercase tracking-tight truncate">{info?.label}</p>
                            </div>
                            {!readOnly && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveModalInt(intId);
                                    }}
                                    className="px-3 py-2 sm:px-4 sm:py-2.5 bg-siif-blue/10 hover:bg-siif-blue text-siif-blue hover:text-white rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all shrink-0 active:scale-95 shadow-sm"
                                >
                                    Configure
                                </button>
                            )}
                        </div>

                        <div className="space-y-2 mt-1 bg-slate-50/50 p-2 sm:p-3 rounded-xl border border-slate-100/50">
                            {gradeCount > 0 ? (
                                KEY_STAGES.map(ks => {
                                    const activeGradesInKs = ks.grades.filter(g => selectedGrades.includes(g));
                                    if (activeGradesInKs.length === 0) return null;
                                    const ksTotal = activeGradesInKs.reduce((sum, g) => sum + (parseInt(beneficiaryCounts[g]) || 0), 0);
                                    return (
                                        <div key={ks.id} className="bg-white p-2.5 rounded-xl border border-slate-100/80 shadow-sm">
                                            <div className="flex justify-between items-center mb-1.5">
                                                <span className="text-[15px] font-black text-slate-500 uppercase tracking-wider">{ks.label}</span>
                                                <span className="text-[15px] font-black text-siif-blue bg-siif-blue/5 px-2.5 py-1 rounded-md border border-siif-blue/10">Total: {ksTotal.toLocaleString()}</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 mt-1">
                                                {activeGradesInKs.map(g => (
                                                    <span key={g} className="text-[11px] font-black bg-slate-50 text-slate-600 px-3 py-1 rounded-lg border border-slate-100">
                                                        {GRADE_LABELS[g] || g}: <span className="text-siif-blue">{beneficiaryCounts[g] || 0}</span>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1">
                                    ⚠️ Click Configure to add learners
                                </span>
                            )}
                        </div>
                    </div>
                );
            })}

            <div className="mt-4">
                <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={goToSummary}
                    className="w-full py-5 bg-siif-blue hover:bg-siif-blue/90 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-siif-blue/20 active:scale-95 transition-transform flex items-center justify-center gap-3"
                >
                    {readOnly ? 'View Summary' : 'Review Summary'} <TbChevronRight size={18} />
                </motion.button>
            </div>
        </div>
    );

    // ── SUMMARY SCREEN ───────────────────────────────────────────────────────────
    const renderSummaryScreen = () => {
        const validInterventions = selectedInterventions.filter(intId => {
            const data = value[intId] || {};
            const selectedGrades = Array.isArray(data.selectedGrades) ? data.selectedGrades : [];
            const beneficiaryCounts = data.beneficiaryCounts || {};
            return selectedGrades.some(g => (parseInt(beneficiaryCounts[g]) || 0) > 0);
        });

        const activeIntId = validInterventions[currentSlideIndex];
        const canPrev = currentSlideIndex > 0;
        const canNext = currentSlideIndex < validInterventions.length - 1;

        return (
            <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4 pb-36">
                <div className="siif-card p-6 space-y-5">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Summary — Target Beneficiaries</p>
                            <p className="text-[11px] font-black text-siif-blue bg-siif-blue/10 px-3 py-1 rounded-full">Card {currentSlideIndex + 1} of {validInterventions.length}</p>
                        </div>

                        <div className="overflow-hidden relative">
                            <AnimatePresence mode="wait">
                                {activeIntId && (() => {
                                    const intId = activeIntId;
                                    const info = INTERVENTIONS.find(i => i.id === intId);
                                    const data = value[intId] || {};
                                    const selectedGrades = Array.isArray(data.selectedGrades) ? data.selectedGrades : [];
                                    const beneficiaryCounts = data.beneficiaryCounts || {};
                                    const aralCounts = data.aralCounts || {};
                                    const grades = selectedGrades.filter(g => (parseInt(beneficiaryCounts[g]) || 0) > 0);

                                    return (
                                        <motion.div
                                            key={intId}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            transition={{ duration: 0.15 }}
                                            className="space-y-3 min-h-[14rem]"
                                        >
                                            <div className="flex items-center gap-2 mb-1 border-b border-slate-50 pb-2">
                                                <div className="w-1.5 h-4 bg-siif-blue rounded-full" />
                                                <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{info?.label}</p>
                                            </div>
                                            <div className="pl-3.5 space-y-3">
                                                {KEY_STAGES.map(ks => {
                                                    const activeGradesInKs = ks.grades.filter(g => grades.includes(g));
                                                    if (activeGradesInKs.length === 0) return null;
                                                    const ksTotal = activeGradesInKs.reduce((sum, g) => sum + (parseInt(beneficiaryCounts?.[g]) || 0), 0);
                                                    return (
                                                        <div key={ks.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col gap-2">
                                                            <div className="flex justify-between items-center text-[11px] font-black text-slate-500 uppercase">
                                                                <span>{ks.label}</span>
                                                                <span className="text-siif-blue bg-siif-blue/5 px-2.5 py-1 rounded-md">Total: {ksTotal.toLocaleString()}</span>
                                                            </div>
                                                            <div className="flex flex-wrap gap-2 mt-0.5">
                                                                {activeGradesInKs.map(g => {
                                                                    const gradeAral = aralCounts[g] || {};
                                                                    const aralStrings = Object.entries(gradeAral)
                                                                        .filter(([_, cnt]) => parseInt(cnt) > 0)
                                                                        .map(([subj, cnt]) => `${subj}: ${cnt}`);

                                                                    return (
                                                                        <div key={g} className="flex flex-col gap-1.5 w-full">
                                                                            <span className="text-[11px] font-black bg-white text-slate-600 px-3 py-1.5 rounded-lg border border-slate-100 flex items-center justify-between gap-3">
                                                                                <span>{GRADE_LABELS[g] || g}</span>
                                                                                <span className="text-siif-blue">{beneficiaryCounts?.[g] || 0} Learners</span>
                                                                            </span>
                                                                            {aralStrings.length > 0 && (
                                                                                <div className="flex flex-wrap gap-1.5 pl-2">
                                                                                    {aralStrings.map((s, i) => (
                                                                                        <span key={i} className="text-[10px] font-bold bg-amber-50 text-amber-700 px-2 py-1 rounded-md border border-amber-100 whitespace-nowrap">{s}</span>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </motion.div>
                                    );
                                })()}
                            </AnimatePresence>
                        </div>

                        <div className="flex justify-between items-center mt-6">
                            <button
                                onClick={() => canPrev && setCurrentSlideIndex(p => p - 1)}
                                disabled={!canPrev}
                                className={`p-2.5 rounded-full transition-all ${canPrev ? 'bg-siif-blue/10 text-siif-blue hover:bg-siif-blue hover:text-white active:scale-90' : 'bg-slate-50 text-slate-300'}`}
                            >
                                <TbChevronLeft size={20} />
                            </button>
                            <div className="flex gap-1.5">
                                {validInterventions.map((_, idx) => (
                                    <div key={idx} className={`w-1.5 h-1.5 rounded-full transition-all ${idx === currentSlideIndex ? 'bg-siif-blue scale-125' : 'bg-slate-200'}`} />
                                ))}
                            </div>
                            <button
                                onClick={() => canNext && setCurrentSlideIndex(p => p + 1)}
                                disabled={!canNext}
                                className={`p-2.5 rounded-full transition-all ${canNext ? 'bg-siif-blue/10 text-siif-blue hover:bg-siif-blue hover:text-white active:scale-90' : 'bg-slate-50 text-slate-300'}`}
                            >
                                <TbChevronRight size={20} />
                            </button>
                        </div>
                    </div>

                    <div className="pt-5 border-t border-slate-100 flex justify-between items-center text-xs">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Learners Across Plan</p>
                        <p className="text-sm font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                            {totalLearners.toLocaleString()}
                        </p>
                    </div>
                </div>


                {/* Navigation / Edit */}
                {!readOnly && (
                    <button
                        onClick={() => setScreen('form')}
                        className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-slate-200 hover:bg-slate-200 transition-colors"
                    >
                        ← Edit Target Beneficiaries
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
                                Type <span className="text-siif-blue font-black">CONFIRM</span> to save
                            </p>
                            <input
                                type="text"
                                placeholder="Type CONFIRM here..."
                                value={confirmText}
                                onChange={e => setConfirmText(e.target.value)}
                                className={`w-full px-5 py-4 rounded-2xl border-2 font-black text-sm tracking-widest text-center transition-all focus:outline-none ${confirmError
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
                                    Save Beneficiaries ✓
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    };

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
                                Step 2 of 4 — {screen === 'summary' ? 'Review & Confirm' : 'Select'}
                            </p>
                            <h1 className="text-xl font-black italic uppercase tracking-tight text-slate-800">Target Beneficiaries</h1>
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
                {/* Step tabs */}
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

            {/* ── Center Popup Config Modal ── */}
            <AnimatePresence>
                {activeModalInt && (() => {
                    const intId = activeModalInt;
                    const info = INTERVENTIONS.find(i => i.id === intId);
                    const data = value[intId] || {};
                    const selectedGrades = Array.isArray(data.selectedGrades) ? data.selectedGrades : [];
                    const beneficiaryCounts = data.beneficiaryCounts || {};

                    return (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-5"
                        >
                            <motion.div
                                initial={{ scale: 0.95, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.95, y: 20 }}
                                className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[80vh] border border-slate-100"
                            >
                                {/* Modal Header */}
                                <div className="bg-siif-blue text-white px-6 py-5 flex items-center justify-between shrink-0">
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <div className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center shrink-0">
                                            {INTERVENTION_ICONS[intId] || <TbUsers size={20} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[8px] font-black text-blue-200 uppercase tracking-widest">Target Grades & Learners</p>
                                            <h3 className="font-black text-sm uppercase tracking-tight truncate">{info?.label}</h3>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setActiveModalInt(null)}
                                        className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all border border-white/10 text-white shrink-0"
                                        title="Cancel"
                                    >
                                        <TbX size={16} />
                                    </button>
                                </div>

                                {/* Modal Body */}
                                <div className="p-6 overflow-y-auto space-y-5 flex-1">
                                    {KEY_STAGES.map(ks => {
                                        const relevantGrades = ks.grades;
                                        return (
                                            <div key={ks.id} className="space-y-2">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{ks.label}</p>
                                                <div className="flex flex-wrap gap-1.5 mb-2">
                                                    {relevantGrades.map(g => {
                                                        const active = selectedGrades.includes(g);
                                                        return (
                                                            <button
                                                                key={g}
                                                                disabled={readOnly}
                                                                onClick={() => toggleGrade(intId, g)}
                                                                className={`px-3.5 py-2 rounded-xl text-[9px] font-black uppercase transition-all duration-200 ${active ? 'bg-siif-blue text-white shadow-sm border border-siif-blue' : 'bg-slate-50 text-slate-500 border border-slate-100'
                                                                    }`}
                                                            >{GRADE_LABELS[g] || g}</button>
                                                        );
                                                    })}
                                                </div>
                                                <div className="space-y-1.5">
                                                    {ks.grades.filter(g => selectedGrades.includes(g)).map(g => {
                                                        const showAral = intId === 'remediation' && aral?.planned;
                                                        const isAralActive = showAral && aral?.subjects?.length > 0;
                                                        return (
                                                            <div key={g} className="flex flex-col gap-2 bg-slate-50 px-4 py-3 rounded-xl border border-slate-100">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-[10px] font-black text-slate-600 uppercase">{GRADE_LABELS[g] || g}</span>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[9px] text-slate-400 font-bold">Total Learners:</span>
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            placeholder="0"
                                                                            readOnly={readOnly || isAralActive}
                                                                            value={beneficiaryCounts[g] || ''}
                                                                            onChange={e => updateCount(intId, g, e.target.value)}
                                                                            className={`w-20 border border-slate-200 rounded-lg px-2.5 py-1 text-right text-xs font-black focus:outline-none ${readOnly || isAralActive ? 'bg-slate-100 text-slate-500' : 'bg-white text-slate-800 focus:ring-2 focus:ring-siif-blue/20'}`}
                                                                        />
                                                                    </div>
                                                                </div>
                                                                {isAralActive && (
                                                                    <div className="pt-2 border-t border-slate-200 mt-1">
                                                                        <p className="text-[8.5px] font-black text-amber-600 uppercase tracking-widest mb-2">ARAL Subjects</p>
                                                                        <div className="grid grid-cols-2 gap-2">
                                                                            {aral.subjects.map(subj => (
                                                                                <div key={subj} className="flex items-center justify-between bg-white px-2 py-1.5 rounded-lg border border-slate-100 shadow-sm">
                                                                                    <span className="text-[9px] font-bold text-slate-600 truncate mr-2">{subj}</span>
                                                                                    <input
                                                                                        type="number"
                                                                                        min="0"
                                                                                        placeholder="0"
                                                                                        readOnly={readOnly}
                                                                                        value={(!data.aralCounts?.[g]?.[subj] || data.aralCounts?.[g]?.[subj] === '0' || data.aralCounts?.[g]?.[subj] === 0) ? '' : data.aralCounts[g][subj]}
                                                                                        onChange={e => updateAralCount(intId, g, subj, e.target.value)}
                                                                                        className="w-14 bg-slate-50 border border-slate-200 rounded-md px-1.5 py-1 text-right text-[10px] font-black text-slate-800 focus:ring-1 focus:ring-siif-blue/20 focus:outline-none placeholder-slate-300"
                                                                                    />
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="p-5 border-t border-slate-50 shrink-0">
                                    <button
                                        onClick={() => {
                                            for (const g of selectedGrades) {
                                                const count = parseInt(beneficiaryCounts[g]) || 0;
                                                if (count <= 0) {
                                                    alert(`0 beneficiary is not accepted. If you don't have beneficiary for this grade level, unclick the grade level.`);
                                                    return;
                                                }
                                            }
                                            setActiveModalInt(null);
                                            if (onApplyConfig) onApplyConfig();
                                        }}
                                        className="w-full py-4 bg-siif-blue hover:bg-siif-blue/90 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-md transition-all active:scale-[0.98]"
                                    >
                                        Save ✓
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    );
                })()}
            </AnimatePresence>
        </div>
    );
};

export default BeneficiariesCard;
