// BeneficiariesCard.jsx — Step 2 of 4 (Modal Configuration & SIIF Theme)
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TbChevronLeft, TbChevronRight, TbArrowLeft, TbUsers, TbCheck, TbX, TbShieldCheck, TbChecklist
} from 'react-icons/tb';
import { INTERVENTIONS, INTERVENTION_ICONS, KEY_STAGES, GRADE_LABELS } from './siifConstants.jsx';

const BeneficiariesCard = ({ selectedInterventions, value, aral, onChange, onApplyConfig, onConfirm, onClose, readOnly }) => {
    const [screen, setScreen] = useState('form');
    const [isEditing, setIsEditing] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [confirmError, setConfirmError] = useState(false);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    const [currentFormSlide, setCurrentFormSlide] = useState(0);

    // Collapse editor when navigating to a different slide
    useEffect(() => { setIsEditing(false); }, [currentFormSlide]);

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
                // Navigate slider to the problematic intervention
                const idx = selectedInterventions.indexOf(intId);
                if (idx !== -1) { setCurrentFormSlide(idx); setIsEditing(true); }
                return;
            }

            for (const g of selectedGrades) {
                const count = parseInt(beneficiaryCounts[g]) || 0;
                if (count <= 0) {
                    alert(`0 beneficiary is not accepted. If you don't have beneficiary for this grade level, unclick the grade level.`);
                    const idx = selectedInterventions.indexOf(intId);
                    if (idx !== -1) { setCurrentFormSlide(idx); setIsEditing(true); }
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
    const renderFormScreen = () => {
        const total = selectedInterventions.length;
        const intId = selectedInterventions[currentFormSlide] || selectedInterventions[0];
        const info = INTERVENTIONS.find(i => i.id === intId);
        const data = value[intId] || {};
        const selectedGrades = Array.isArray(data.selectedGrades) ? data.selectedGrades : [];
        const beneficiaryCounts = data.beneficiaryCounts || {};
        const gradeCount = selectedGrades.length;
        const canPrev = currentFormSlide > 0;
        const canNext = currentFormSlide < total - 1;

        const handleDoneEditing = () => {
            // Validate before collapsing
            for (const g of selectedGrades) {
                const count = parseInt(beneficiaryCounts[g]) || 0;
                if (count <= 0) {
                    alert(`0 beneficiary is not accepted. If you don't have beneficiary for this grade level, unclick the grade level.`);
                    return;
                }
            }
            setIsEditing(false);
        };

        return (
            <div className="flex-1 overflow-y-auto px-5 py-6 space-y-3 pb-6 sm:pb-8">
                {/* Header info */}
                <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
                    <h3 className="text-sm font-black text-slate-800 mb-1 leading-snug">
                        Who will be the beneficiaries of each intervention?
                    </h3>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                        {readOnly
                            ? "Viewing target beneficiaries for each intervention."
                            : isEditing
                                ? "Select the grade levels and enter learner counts below."
                                : "Use the arrows to navigate through interventions and configure each one."}
                    </p>
                </div>

                {/* Slider navigation header — hidden while editing */}
                {!isEditing && (
                    <>
                        <div className="flex items-center justify-between gap-3 px-1">
                            <button
                                onClick={() => setCurrentFormSlide(p => Math.max(0, p - 1))}
                                disabled={!canPrev}
                                className={`p-2.5 rounded-2xl transition-all shrink-0 ${canPrev ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-90 shadow-sm' : 'bg-slate-50 border border-slate-100 text-slate-300 cursor-not-allowed'}`}
                            >
                                <TbChevronLeft size={18} />
                            </button>

                            {/* Dot indicators */}
                            <div className="flex items-center gap-1.5 flex-wrap justify-center flex-1">
                                {selectedInterventions.map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setCurrentFormSlide(idx)}
                                        className={`rounded-full transition-all duration-200 ${idx === currentFormSlide ? 'w-5 h-2 bg-siif-blue' : 'w-2 h-2 bg-slate-300 hover:bg-slate-400'}`}
                                    />
                                ))}
                            </div>

                            <button
                                onClick={() => setCurrentFormSlide(p => Math.min(total - 1, p + 1))}
                                disabled={!canNext}
                                className={`p-2.5 rounded-2xl transition-all shrink-0 ${canNext ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-90 shadow-sm' : 'bg-slate-50 border border-slate-100 text-slate-300 cursor-not-allowed'}`}
                            >
                                <TbChevronRight size={18} />
                            </button>
                        </div>

                        <p className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Intervention {currentFormSlide + 1} of {total}
                        </p>
                    </>
                )}

                {/* Intervention card (single, animated) */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={intId}
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -30 }}
                        transition={{ duration: 0.2 }}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm"
                    >
                        {/* Card header */}
                        <div className={`flex items-center justify-between gap-3 p-4 sm:p-5 ${ isEditing ? 'bg-gradient-to-r from-[#0B1F4D] to-[#10346B]' : '' }`}>
                            <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${ isEditing ? 'bg-white/10 text-white' : 'bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400' }`}>
                                    {INTERVENTION_ICONS[intId]}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className={`font-bold text-sm leading-snug truncate ${ isEditing ? 'text-white' : 'text-slate-900 dark:text-white' }`}>{info?.label}</p>
                                    <p className={`text-[11px] ${ isEditing ? 'text-blue-200' : 'text-slate-500' }`}>
                                        {isEditing
                                            ? 'Select grades & enter learner counts'
                                            : gradeCount > 0
                                                ? `${gradeCount} grade level${gradeCount > 1 ? 's' : ''} configured`
                                                : 'Not yet configured'}
                                    </p>
                                </div>
                            </div>
                            {!readOnly && (
                                isEditing ? (
                                    <button
                                        onClick={handleDoneEditing}
                                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 active:scale-95 flex items-center gap-1.5 min-h-[40px]"
                                    >
                                        <TbCheck size={14} /> Done
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="px-4 py-2 bg-slate-900 hover:bg-slate-700 text-white dark:bg-blue-600 dark:hover:bg-blue-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shrink-0 active:scale-95 shadow-sm min-h-[40px]"
                                    >
                                        {gradeCount > 0 ? 'Edit' : 'Configure'}
                                    </button>
                                )
                            )}
                        </div>

                        {/* ── Inline editing panel ── */}
                        <AnimatePresence>
                            {isEditing && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.22 }}
                                    className="overflow-hidden"
                                >
                                    <div className="p-4 space-y-5 border-t border-slate-100 dark:border-slate-800">
                                        {KEY_STAGES.map(ks => (
                                            <div key={ks.id} className="space-y-2">
                                                <div className="flex items-center justify-between mb-1">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{ks.label}</p>
                                                    {(() => {
                                                        const ksActiveGrades = ks.grades.filter(g => selectedGrades.includes(g));
                                                        const ksTotal = ksActiveGrades.reduce((sum, g) => sum + (parseInt(beneficiaryCounts[g]) || 0), 0);
                                                        return ksActiveGrades.length > 0 ? (
                                                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md">
                                                                Total: {ksTotal.toLocaleString()}
                                                            </span>
                                                        ) : null;
                                                    })()}
                                                </div>
                                                {/* Grade toggle buttons */}
                                                <div className="grid grid-cols-2 gap-2 mb-2">
                                                    {ks.grades.map(g => {
                                                        const active = selectedGrades.includes(g);
                                                        return (
                                                            <button
                                                                key={g}
                                                                disabled={readOnly}
                                                                onClick={() => toggleGrade(intId, g)}
                                                                className={`p-3 rounded-xl border text-center transition-all min-h-[48px] flex flex-col items-center justify-center ${
                                                                    active
                                                                        ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                                                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-300'
                                                                }`}
                                                            >
                                                                <span className="block text-[9px] uppercase opacity-70 font-semibold tracking-wider">Grade Level</span>
                                                                <span className="text-sm font-extrabold">{GRADE_LABELS[g] || g}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                {/* Count inputs for active grades */}
                                                <div className="space-y-1.5">
                                                    {ks.grades.filter(g => selectedGrades.includes(g)).map(g => {
                                                        const showAral = intId === 'remediation' && aral?.planned;
                                                        const isAralActive = showAral && aral?.subjects?.length > 0;
                                                        return (
                                                            <div key={g} className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-800/40 px-4 py-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase">{GRADE_LABELS[g] || g}</span>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[9px] text-slate-400 font-bold">Total Learners:</span>
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            placeholder="0"
                                                                            readOnly={readOnly || isAralActive}
                                                                            value={beneficiaryCounts[g] || ''}
                                                                            onChange={e => updateCount(intId, g, e.target.value)}
                                                                            className={`w-20 border border-slate-200 rounded-lg px-2.5 py-1 text-right text-xs font-black focus:outline-none focus:ring-2 focus:ring-siif-blue/20 ${
                                                                                readOnly || isAralActive ? 'bg-slate-100 text-slate-500' : 'bg-white text-slate-800'
                                                                            }`}
                                                                        />
                                                                    </div>
                                                                </div>
                                                                {isAralActive && (
                                                                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 mt-1">
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
                                        ))}

                                        {/* Done button inside the editor */}
                                        <button
                                            onClick={handleDoneEditing}
                                            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                        >
                                            <TbCheck size={16} /> Save & Done
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* ── Summary / locked view ── */}
                        {!isEditing && (
                            <div className="p-4 pt-0 space-y-2">
                                {gradeCount > 0 ? (
                                    KEY_STAGES.map(ks => {
                                        const activeGradesInKs = ks.grades.filter(g => selectedGrades.includes(g));
                                        if (activeGradesInKs.length === 0) return null;
                                        const ksTotal = activeGradesInKs.reduce((sum, g) => sum + (parseInt(beneficiaryCounts[g]) || 0), 0);
                                        return (
                                            <div key={ks.id} className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1.5">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">{ks.label}</span>
                                                    <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-800">Total: {ksTotal.toLocaleString()}</span>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {activeGradesInKs.map(g => (
                                                        <span key={g} className="text-[10px] font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-600 inline-flex items-center gap-1">
                                                            {GRADE_LABELS[g] || g}: <span className="text-blue-600 dark:text-blue-400 font-bold">{beneficiaryCounts[g] || 0}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-100 dark:border-amber-900">
                                        <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                                            ⚠️ Click <strong>Configure</strong> above to set grade levels and learner counts
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>

                {/* Next/Prev nav + Review Summary — hidden while editing */}
                {!isEditing && (
                    <div className="flex gap-3 mt-2">
                        {canPrev && (
                            <button
                                onClick={() => setCurrentFormSlide(p => p - 1)}
                                className="flex-1 py-3.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm"
                            >
                                <TbChevronLeft size={16} /> Prev
                            </button>
                        )}
                        {canNext ? (
                            <button
                                onClick={() => setCurrentFormSlide(p => p + 1)}
                                className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm"
                            >
                                Next <TbChevronRight size={16} />
                            </button>
                        ) : (
                            <motion.button
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                onClick={goToSummary}
                                className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-transform flex items-center justify-center gap-2"
                            >
                                {readOnly ? 'View Summary' : 'Review Summary'} <TbChevronRight size={16} />
                            </motion.button>
                        )}
                    </div>
                )}
            </div>
        );
    };


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
            <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4 pb-6 sm:pb-8">
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
                                    className={`w-full px-4 py-3.5 rounded-xl border-2 font-mono font-black text-sm tracking-widest text-center transition-all focus:outline-none focus:ring-4 ${confirmError
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


        </div>
    );
};

export default BeneficiariesCard;
