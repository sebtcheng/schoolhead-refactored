// BeneficiariesCard.jsx — Step 2 of 4 (Modal Configuration & SIIF Theme)
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TbChevronLeft, TbChevronRight, TbArrowLeft, TbUsers, TbCheck, TbX, TbShieldCheck, TbChecklist
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

            <div className="flex flex-col gap-3.5">
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
                            className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-3.5 transition-all shadow-sm ${!readOnly ? 'cursor-pointer hover:border-blue-400' : ''
                                }`}
                        >
                            <div className="flex items-center justify-between gap-3 w-full">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                        {INTERVENTION_ICONS[intId]}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-base text-slate-900 dark:text-white leading-snug truncate">{info?.label}</p>
                                        <p className="text-xs text-slate-500">{gradeCount > 0 ? `${gradeCount} grade level${gradeCount > 1 ? 's' : ''} configured` : 'Tap to configure grade levels'}</p>
                                    </div>
                                </div>
                                {!readOnly && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveModalInt(intId);
                                        }}
                                        className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-blue-600 dark:hover:bg-blue-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shrink-0 active:scale-95 shadow-sm min-h-[44px]"
                                    >
                                        Configure
                                    </button>
                                )}
                            </div>

                            <div className="space-y-2 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                {gradeCount > 0 ? (
                                    KEY_STAGES.map(ks => {
                                        const activeGradesInKs = ks.grades.filter(g => selectedGrades.includes(g));
                                        if (activeGradesInKs.length === 0) return null;
                                        const ksTotal = activeGradesInKs.reduce((sum, g) => sum + (parseInt(beneficiaryCounts[g]) || 0), 0);
                                        return (
                                            <div key={ks.id} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">{ks.label}</span>
                                                    <span className="text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 px-2.5 py-0.5 rounded-md border border-blue-100 dark:border-blue-800">Total: {ksTotal.toLocaleString()}</span>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {activeGradesInKs.map(g => (
                                                        <span key={g} className="text-xs font-medium bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 inline-flex items-center gap-1.5">
                                                            {GRADE_LABELS[g] || g}: <span className="text-blue-600 dark:text-blue-400 font-bold">{beneficiaryCounts[g] || 0}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                        ⚠️ Click Configure to add grade levels and learner counts
                                    </span>
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
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-4 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800 shadow-xs">
                                <TbUsers size={18} className="text-blue-600 dark:text-blue-400 shrink-0" />
                                <span className="text-xs font-black uppercase tracking-wider">
                                    Target Beneficiaries Summary
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-black text-xs border border-slate-200/80 dark:border-slate-700">
                                <TbChecklist size={14} className="text-blue-600 dark:text-blue-400" />
                                <span>Card {currentSlideIndex + 1} of {validInterventions.length}</span>
                            </div>
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
                        className="w-full py-3.5 px-4 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-300 rounded-xl font-extrabold text-xs uppercase tracking-widest border border-rose-200 dark:border-rose-800 transition-all flex items-center justify-center gap-2 active:scale-[0.98] shadow-sm"
                    >
                        <TbArrowLeft size={16} /> Edit Target Beneficiaries
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
                                    By typing <span className="font-extrabold text-blue-700 dark:text-blue-300">CONFIRM</span> below, you certify that the target beneficiary count data submitted above is true, accurate, and officially authorized.
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
                                <TbShieldCheck size={18} /> Confirm & Certify Beneficiaries
                            </button>
                        </div>
                    </>
                )}
            </div>
            </div>
        );
    };

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
                            Step 2 of 4 — {screen === 'summary' ? 'Review & Confirm' : 'Configure'}
                        </span>
                        <h2 className="siif-font-header text-sm font-extrabold text-slate-800 dark:text-slate-100 tracking-tight leading-tight truncate">
                            Target Beneficiaries
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
                <div className="h-0.5 flex-1 rounded-full bg-blue-600" />
                <div className={`h-0.5 flex-1 rounded-full transition-all duration-300 ${screen === 'summary' ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
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
                                className="siif-card w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[80vh] border-[2.5px] border-slate-300"
                                style={{ borderRadius: 'calc(var(--radius) + 6px)' }}
                            >
                                {/* Modal Header */}
                                <div className="bg-gradient-to-br from-[#0B1F4D] to-[#10346B] text-white px-6 py-5 flex items-center justify-between shrink-0">
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
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                                                    {relevantGrades.map(g => {
                                                        const active = selectedGrades.includes(g);
                                                        return (
                                                            <button
                                                                key={g}
                                                                disabled={readOnly}
                                                                onClick={() => toggleGrade(intId, g)}
                                                                className={`p-3.5 rounded-2xl border text-center transition-all min-h-[52px] flex flex-col items-center justify-center ${active ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-[1.02]' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                                                                    }`}
                                                            >
                                                                <span className="block text-[9px] uppercase opacity-75 font-semibold tracking-wider">Grade Level</span>
                                                                <span className="text-sm font-extrabold">{GRADE_LABELS[g] || g}</span>
                                                            </button>
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
                                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
