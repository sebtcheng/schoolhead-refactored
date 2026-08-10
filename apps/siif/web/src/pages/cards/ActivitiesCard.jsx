// ActivitiesCard.jsx — Step 3 of 4 (Inline Slider Configuration & SIIF Theme)
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TbChevronLeft, TbChevronRight, TbArrowLeft, TbBook, TbCheck, TbChartBar, TbWallet, TbX, TbShieldCheck, TbClipboardList, TbChecklist
} from 'react-icons/tb';
import {
    INTERVENTIONS, INTERVENTION_ICONS,
    SIP_AIP_ACTIVITIES, REMAINING_ACTIVITIES, ACTION_RESEARCH_ACTIVITY
} from './siifConstants.jsx';

const ActivitiesCard = ({ selectedInterventions, value, onChange, onConfirm, onClose, readOnly }) => {
    const [screen, setScreen] = useState('form');
    const [isEditing, setIsEditing] = useState(false);
    const [currentFormSlide, setCurrentFormSlide] = useState(0);
    const [confirmText, setConfirmText] = useState('');
    const [confirmError, setConfirmError] = useState(false);
    const [expandedCategoryKey, setExpandedCategoryKey] = useState(null);

    // Collapse editor when navigating to a different slide
    useEffect(() => {
        setIsEditing(false);
        setExpandedCategoryKey(null);
    }, [currentFormSlide]);

    const toggleActivity = (intId, category, choice) => {
        if (readOnly) return;
        const current = value[intId] || {};
        const selectedActivities = current.selectedActivities || { sip_aip: [], action_research: [], remaining: [] };
        const list = Array.isArray(selectedActivities[category]) ? selectedActivities[category] : [];
        const next = list.includes(choice) ? list.filter(x => x !== choice) : [...list, choice];
        onChange({
            ...value,
            [intId]: { ...current, selectedActivities: { ...selectedActivities, [category]: next } }
        });
    };

    const setOther = (intId, text) => {
        if (readOnly) return;
        const current = value[intId] || {};
        const selectedActivities = current.selectedActivities || { sip_aip: [], action_research: [], remaining: [] };
        onChange({ ...value, [intId]: { ...current, selectedActivities, otherActivity: text } });
    };

    const goToSummary = () => {
        const hasActivity = selectedInterventions.every(id => {
            const current = value[id] || {};
            const selectedActivities = current.selectedActivities || {};
            const count = Object.values(selectedActivities).flat().filter(Boolean).length;
            const other = current.otherActivity || '';
            return count > 0 || other.trim().length > 0;
        });
        if (!hasActivity) {
            alert('Please select or specify at least one activity for every selected intervention.');
            return;
        }
        setScreen('summary');
    };

    const handleSave = () => {
        if (readOnly) { onClose(); return; }
        if (confirmText.trim().toUpperCase() !== 'CONFIRM') {
            setConfirmError(true);
            setTimeout(() => setConfirmError(false), 1500);
            return;
        }
        onConfirm();
    };

    const renderActivityRow = (intId, category, choice) => {
        const current = value[intId] || {};
        const selectedActivities = current.selectedActivities || { sip_aip: [], action_research: [], remaining: [] };
        const list = Array.isArray(selectedActivities[category]) ? selectedActivities[category] : [];
        const active = list.includes(choice);
        const isOthers = choice === 'Others (specify)';
        if (readOnly && !active) return null;
        return (
            <React.Fragment key={choice}>
                <label
                    onClick={() => toggleActivity(intId, category, choice)}
                    className={`group relative flex items-start gap-3.5 p-4 border rounded-2xl cursor-pointer select-none transition-all duration-200 min-h-[52px] ${
                        active
                            ? 'border-blue-600 bg-gradient-to-br from-blue-50/50 to-white scale-[1.01]'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                    } ${readOnly ? 'cursor-default' : ''}`}
                >
                    <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm leading-snug ${active ? 'text-blue-950 font-bold' : 'text-slate-800'}`}>{choice}</p>
                    </div>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all shrink-0 mt-0.5 ${
                        active ? 'bg-blue-600 border-blue-600 text-white scale-110 shadow-sm' : 'border-slate-300 bg-white'
                    }`}>
                        {active && <TbCheck size={14} />}
                    </div>
                </label>
                {active && isOthers && (
                    <div className="px-1 pb-1">
                        <input
                            type="text"
                            placeholder="Please specify activity..."
                            readOnly={readOnly}
                            value={current.otherActivity || ''}
                            onChange={e => setOther(intId, e.target.value)}
                            className="w-full bg-white border border-blue-400 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none min-h-[48px]"
                        />
                    </div>
                )}
            </React.Fragment>
        );
    };

    // ── FORM SCREEN ──────────────────────────────────────────────────────────────
    const renderFormScreen = () => {
        const total = selectedInterventions.length;
        const intId = selectedInterventions[currentFormSlide] || selectedInterventions[0];
        const info = INTERVENTIONS.find(i => i.id === intId);
        const current = value[intId] || {};
        const selectedActivities = current.selectedActivities || { sip_aip: [], action_research: [], remaining: [] };
        const otherActivity = current.otherActivity || '';
        const canPrev = currentFormSlide > 0;
        const canNext = currentFormSlide < total - 1;

        const actsList = [];
        Object.entries(selectedActivities).forEach(([, list]) => {
            if (Array.isArray(list)) {
                list.forEach(a => {
                    if (a === 'Others (specify)') { if (otherActivity) actsList.push(`Other: ${otherActivity}`); }
                    else actsList.push(a);
                });
            }
        });

        const handleDoneEditing = () => {
            const totalActCount = Object.values(selectedActivities).flat().filter(Boolean).length;
            if (totalActCount === 0 && !otherActivity) {
                alert('Please select at least one activity before saving.');
                return;
            }
            setIsEditing(false);
        };

        return (
            <div className="flex-1 overflow-y-auto px-5 py-6 space-y-3 pb-6 sm:pb-8">
                {/* Header */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-black text-slate-900 mb-1 leading-snug">
                        What activities does your school plan to conduct?
                    </h3>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                        {readOnly ? 'Viewing planned activities for each intervention.'
                            : isEditing ? 'Select all applicable planned activities below.'
                            : 'Use the arrows to navigate through interventions and configure each one.'}
                    </p>
                </div>

                {/* Slider nav — hidden while editing */}
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
                            <div className="flex items-center gap-1.5 flex-wrap justify-center flex-1">
                                {selectedInterventions.map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setCurrentFormSlide(idx)}
                                        className={`rounded-full transition-all duration-200 ${idx === currentFormSlide ? 'w-5 h-2 bg-blue-600' : 'w-2 h-2 bg-slate-300 hover:bg-slate-400'}`}
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
                        className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
                    >
                        {/* Card header */}
                        <div className={`flex items-center justify-between gap-3 p-4 sm:p-5 ${isEditing ? 'bg-gradient-to-r from-[#0B1F4D] to-[#10346B]' : ''}`}>
                            <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${isEditing ? 'bg-white/10 text-white' : 'bg-blue-50 text-blue-600'}`}>
                                    {INTERVENTION_ICONS[intId]}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className={`font-bold text-sm leading-snug truncate ${isEditing ? 'text-white' : 'text-slate-900'}`}>{info?.label}</p>
                                    <p className={`text-[11px] ${isEditing ? 'text-blue-200' : 'text-slate-500'}`}>
                                        {isEditing ? 'Select planned activities'
                                            : actsList.length > 0 ? `${actsList.length} activit${actsList.length > 1 ? 'ies' : 'y'} selected`
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
                                        className="px-4 py-2 bg-slate-900 hover:bg-slate-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shrink-0 active:scale-95 shadow-sm min-h-[40px]"
                                    >
                                        {actsList.length > 0 ? 'Edit' : 'Configure'}
                                    </button>
                                )
                            )}
                        </div>

                        {/* ── Inline editing panel with Accordion Heads ── */}
                        <AnimatePresence>
                            {isEditing && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.22 }}
                                    className="overflow-hidden"
                                >
                                    <div className="p-4 space-y-3 border-t border-slate-100 bg-slate-50/40">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1 mb-1">
                                            Activity Categories — Tap to expand options
                                        </p>

                                        {[
                                            {
                                                key: 'sip_aip',
                                                title: 'SIP–AIP–Aligned Activities',
                                                icon: <TbBook size={16} />,
                                                items: SIP_AIP_ACTIVITIES
                                            },
                                            {
                                                key: 'action_research',
                                                title: 'Action Research (AR)',
                                                icon: <TbChartBar size={16} />,
                                                items: [ACTION_RESEARCH_ACTIVITY]
                                            },
                                            {
                                                key: 'remaining',
                                                title: 'Remaining SIIF Balance',
                                                icon: <TbWallet size={16} />,
                                                items: REMAINING_ACTIVITIES
                                            }
                                        ].map((cat) => {
                                            const isExpanded = expandedCategoryKey === cat.key;
                                            const selectedList = Array.isArray(selectedActivities[cat.key]) ? selectedActivities[cat.key] : [];
                                            const count = selectedList.filter(Boolean).length;

                                            return (
                                                <div
                                                    key={cat.key}
                                                    className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                                                        isExpanded
                                                            ? 'border-blue-500 ring-2 ring-blue-500/80 shadow-md bg-white'
                                                            : 'border-slate-200 bg-white hover:border-blue-300 shadow-sm'
                                                    }`}
                                                >
                                                    {/* Accordion Head */}
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedCategoryKey(prev => prev === cat.key ? null : cat.key)}
                                                        className={`w-full p-3.5 text-left flex items-center justify-between gap-3 transition-colors ${
                                                            isExpanded ? 'bg-blue-50/80 text-blue-950 font-bold' : 'hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                                                                isExpanded ? 'bg-blue-600 text-white shadow-sm' : 'bg-blue-50 text-blue-600 font-bold'
                                                            }`}>
                                                                {cat.icon}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className={`text-xs leading-snug transition-colors ${
                                                                    isExpanded ? 'font-extrabold text-blue-950' : 'font-bold text-slate-800'
                                                                }`}>
                                                                    {cat.title}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {count > 0 && (
                                                                <span className="flex items-center justify-center bg-blue-600 text-white text-[11px] font-extrabold rounded-full w-5 h-5 shadow-sm">
                                                                    {count}
                                                                </span>
                                                            )}
                                                            <TbChevronRight
                                                                size={18}
                                                                className={`transition-transform duration-200 ${
                                                                    isExpanded ? 'rotate-90 text-blue-600 font-bold' : 'text-slate-400'
                                                                }`}
                                                            />
                                                        </div>
                                                    </button>

                                                    {/* Accordion Content Panel with Motion */}
                                                    <AnimatePresence initial={false}>
                                                        {isExpanded && (
                                                            <motion.div
                                                                key={`cat-panel-${cat.key}`}
                                                                initial={{ height: 0, opacity: 0 }}
                                                                animate={{ height: 'auto', opacity: 1 }}
                                                                exit={{ height: 0, opacity: 0 }}
                                                                transition={{ duration: 0.22, ease: 'easeInOut' }}
                                                                className="overflow-hidden border-t border-blue-100 bg-slate-50/70 p-3.5 space-y-2.5"
                                                            >
                                                                <div className="flex items-center justify-between px-1 mb-1 pb-1 border-b border-slate-200/60">
                                                                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                                                                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                                                                        Selecting {cat.title}
                                                                    </span>
                                                                    <span className="text-[10px] font-bold text-slate-400">
                                                                        {cat.items.length} option{cat.items.length > 1 ? 's' : ''}
                                                                    </span>
                                                                </div>

                                                                <div className="space-y-2">
                                                                    {cat.items.map(choice => renderActivityRow(intId, cat.key, choice))}
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            );
                                        })}

                                        <button
                                            onClick={handleDoneEditing}
                                            className="w-full py-3.5 mt-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
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
                                {actsList.length > 0 ? (() => {
                                    const categories = [
                                        { key: 'sip_aip', label: 'SIP–AIP Aligned' },
                                        { key: 'action_research', label: 'Action Research' },
                                        { key: 'remaining', label: 'Remaining Balance' }
                                    ];
                                    return categories.map(cat => {
                                        const items = Array.isArray(selectedActivities[cat.key]) ? selectedActivities[cat.key] : [];
                                        if (items.length === 0) return null;
                                        return (
                                            <div key={cat.key} className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5">
                                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{cat.label}</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {items.map((a, idx) => {
                                                        const display = a === 'Others (specify)' ? (otherActivity ? `Other: ${otherActivity}` : 'Other') : a;
                                                        return (
                                                            <span key={idx} className="text-[10px] font-medium bg-white text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 leading-snug whitespace-normal break-words inline-block">
                                                                {display}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    });
                                })() : (
                                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                                        <span className="text-xs font-semibold text-amber-600 flex items-center gap-1.5">
                                            ⚠️ Click <strong>Configure</strong> above to select planned activities
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>

                {/* Nav buttons — hidden while editing */}
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
    const renderSummaryScreen = () => (
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4 pb-6 sm:pb-8">
            <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200/80">
                        <TbClipboardList size={18} className="text-blue-600 shrink-0" />
                        <span className="text-xs font-black uppercase tracking-wider">Planned Activities Summary</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-100 text-slate-700 font-mono font-black text-xs border border-slate-200/80">
                        <TbChecklist size={14} className="text-blue-600" />
                        <span>{selectedInterventions.length} Interventions</span>
                    </div>
                </div>

                <div className="space-y-6">
                    {selectedInterventions.map(intId => {
                        const info = INTERVENTIONS.find(i => i.id === intId);
                        const current = value[intId] || {};
                        const selectedActivities = current.selectedActivities || { sip_aip: [], action_research: [], remaining: [] };
                        const otherActivity = current.otherActivity || '';
                        const categories = [
                            { key: 'sip_aip', label: 'SIP–AIP Aligned' },
                            { key: 'action_research', label: 'Action Research' },
                            { key: 'remaining', label: 'Remaining Balance' }
                        ];
                        const hasActivities = categories.some(cat => (Array.isArray(selectedActivities[cat.key]) ? selectedActivities[cat.key] : []).length > 0);
                        if (!hasActivities) return null;
                        return (
                            <div key={intId} className="space-y-2">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-1.5 h-4 bg-blue-600 rounded-full" />
                                    <p className="text-[10px] font-black text-slate-800 uppercase tracking-tight">{info?.label}</p>
                                </div>
                                <div className="pl-3.5 space-y-2">
                                    {categories.map(cat => {
                                        const items = Array.isArray(selectedActivities[cat.key]) ? selectedActivities[cat.key] : [];
                                        if (items.length === 0) return null;
                                        return (
                                            <div key={cat.key} className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100/50">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-1">{cat.label}</p>
                                                <div className="space-y-1.5">
                                                    {items.map((act, idx) => {
                                                        const display = act === 'Others (specify)' ? (otherActivity ? `Other: ${otherActivity}` : 'Other') : act;
                                                        return (
                                                            <div key={idx} className="flex items-start gap-2 bg-white p-2 rounded-lg border border-slate-100">
                                                                <div className="w-3.5 h-3.5 rounded bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                                                                    <TbCheck size={8} />
                                                                </div>
                                                                <p className="text-[9px] text-slate-600 font-bold leading-normal">{display}</p>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {!readOnly && (
                <button
                    onClick={() => setScreen('form')}
                    className="w-full py-3.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-extrabold text-xs uppercase tracking-widest border border-rose-200 transition-all flex items-center justify-center gap-2 active:scale-[0.98] shadow-sm"
                >
                    <TbArrowLeft size={16} /> Edit Planned Activities
                </button>
            )}

            <div className="p-5 bg-gradient-to-br from-blue-50/90 via-slate-50 to-indigo-50/70 rounded-2xl border-2 border-blue-200/90 shadow-md space-y-4">
                {readOnly ? (
                    <div className="space-y-4 text-center">
                        <p className="text-xs font-bold text-slate-500 leading-relaxed">This section is finalized and read-only as the plan is submitted.</p>
                        <button onClick={onClose} className="w-full py-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-extrabold text-xs uppercase tracking-widest shadow-md active:scale-95 transition-all">
                            Close View
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="flex items-start gap-3 p-3.5 bg-white/90 rounded-xl border border-blue-200/80 shadow-sm">
                            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md">
                                <TbShieldCheck size={22} />
                            </div>
                            <div className="space-y-0.5 min-w-0">
                                <p className="text-xs font-black text-slate-900 uppercase tracking-wide">Data Authenticity & Accuracy Declaration</p>
                                <p className="text-[11px] font-semibold text-slate-600 leading-snug">
                                    By typing <span className="font-extrabold text-blue-700">CONFIRM</span> below, you certify that the planned activity data submitted above is true, accurate, and officially authorized.
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
                                        ? 'border-red-400 bg-red-50 text-red-600 focus:ring-red-500/20'
                                        : 'border-blue-200 bg-white text-slate-900 focus:border-blue-600 focus:ring-blue-500/20'
                                }`}
                            />
                            {confirmError && <p className="text-center text-xs text-red-500 font-extrabold animate-bounce">Please type CONFIRM exactly to certify data</p>}
                        </div>

                        <div className="pt-0.5">
                            <button
                                onClick={handleSave}
                                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-xl font-extrabold text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                            >
                                <TbShieldCheck size={18} /> Confirm & Certify Activities
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
            <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-slate-100 bg-white shrink-0 z-20">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <button
                        onClick={screen === 'summary' ? () => setScreen('form') : onClose}
                        className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all text-slate-600 shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center"
                    >
                        {screen === 'summary' ? <TbArrowLeft size={17} /> : <TbChevronLeft size={17} />}
                    </button>
                    <div className="min-w-0 flex-1">
                        <span className="block text-[9px] font-extrabold uppercase tracking-widest text-blue-600 siif-font-header leading-none mb-0.5">
                            Step 3 of 4 — {screen === 'summary' ? 'Review & Confirm' : 'Select'}
                        </span>
                        <h2 className="siif-font-header text-sm font-extrabold text-slate-800 tracking-tight leading-tight truncate">
                            Planned Activities
                        </h2>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 bg-slate-100 hover:bg-rose-100 hover:text-rose-600 rounded-xl transition-all text-slate-500 shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center"
                    title="Close"
                >
                    <TbX size={17} />
                </button>
            </div>
            {/* Step progress bar */}
            <div className="flex gap-1.5 px-3 py-1 bg-white border-b border-slate-100 shrink-0">
                <div className="h-0.5 flex-1 rounded-full bg-blue-600" />
                <div className={`h-0.5 flex-1 rounded-full transition-all duration-300 ${screen === 'summary' ? 'bg-blue-600' : 'bg-slate-200'}`} />
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

export default ActivitiesCard;
