// ActivitiesCard.jsx — Step 3 of 4 (Modal Configuration & SIIF Theme)
import React, { useState } from 'react';
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
    const [activeModalInt, setActiveModalInt] = useState(null);
    const [confirmText, setConfirmText] = useState('');
    const [confirmError, setConfirmError] = useState(false);

    console.log('🖊️ [ActivitiesCard_DIAGNOSTIC]', {
        screen,
        readOnly,
        interventionCount: selectedInterventions.length
    });

    const toggleActivity = (intId, category, choice) => {
        if (readOnly) return;
        const current = value[intId] || {};
        const selectedActivities = current.selectedActivities || { sip_aip: [], action_research: [], remaining: [] };
        const list = Array.isArray(selectedActivities[category]) ? selectedActivities[category] : [];

        const next = list.includes(choice) ? list.filter(x => x !== choice) : [...list, choice];
        console.log(`🔄 [ActivitiesCard] "${intId}" category "${category}" toggled "${choice}".`);
        onChange({
            ...value,
            [intId]: {
                ...current,
                selectedActivities: {
                    ...selectedActivities,
                    [category]: next
                }
            }
        });
    };

    const setOther = (intId, text) => {
        if (readOnly) return;
        const current = value[intId] || {};
        const selectedActivities = current.selectedActivities || { sip_aip: [], action_research: [], remaining: [] };
        onChange({
            ...value,
            [intId]: {
                ...current,
                selectedActivities,
                otherActivity: text
            }
        });
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
        console.log('➡️ [ActivitiesCard] Moving to summary.');
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
            console.warn('⚠️ [ActivitiesCard] CONFIRM mismatch.');
            return;
        }
        console.log('✅ [ActivitiesCard] Confirmed.');
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
                    className={`group relative flex items-start gap-3.5 p-4 border rounded-2xl cursor-pointer select-none transition-all duration-200 min-h-[52px] ${active
                            ? 'border-blue-600 dark:border-blue-500 bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-950/20 dark:to-slate-900 pod-glow scale-[1.01]'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                        } ${readOnly ? 'cursor-default' : ''}`}
                >
                    <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm leading-snug ${active ? 'text-blue-950 dark:text-blue-100 font-bold' : 'text-slate-800 dark:text-slate-100'}`}>{choice}</p>
                    </div>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all shrink-0 mt-0.5 ${
                        active 
                            ? "bg-blue-600 border-blue-600 text-white scale-110 shadow-sm" 
                            : "border-slate-300 dark:border-slate-700 group-hover:border-slate-400 bg-white dark:bg-slate-800"
                    }`}>
                        {active && <TbCheck size={14} className="font-bold text-white" />}
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
                            className="w-full bg-white dark:bg-slate-800 border border-blue-400 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none min-h-[48px]"
                        />
                    </div>
                )}
            </React.Fragment>
        );
    };

    // Summary lines
    const summaryLines = selectedInterventions.flatMap(intId => {
        const current = value[intId] || {};
        const selectedActivities = current.selectedActivities || {};
        const list = Object.values(selectedActivities).flat().filter(Boolean);
        const other = current.otherActivity;
        if (other && list.includes('Others (specify)')) {
            list.push(`Other: ${other}`);
        }
        return list.filter(a => a !== 'Others (specify)').map(a => ({ intId, activity: a }));
    });

    // ── FORM SCREEN ──────────────────────────────────────────────────────────────
    const renderFormScreen = () => (
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-3 pb-36">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 leading-snug">
                    What activities does your school plan to conduct for this intervention?
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                    {readOnly
                        ? "Viewing planned activities for each intervention."
                        : "For each intervention, configure the planned activities to be implemented using popup panels."}
                </p>
            </div>

            <div className="flex flex-col gap-3.5">
                {selectedInterventions.map(intId => {
                    const info = INTERVENTIONS.find(i => i.id === intId);
                    const current = value[intId] || {};
                    const selectedActivities = current.selectedActivities || { sip_aip: [], action_research: [], remaining: [] };
                    const otherActivity = current.otherActivity || '';

                    const actsList = [];
                    Object.entries(selectedActivities).forEach(([cat, list]) => {
                        if (Array.isArray(list)) {
                            list.forEach(a => {
                                if (a === 'Others (specify)') {
                                    if (otherActivity) actsList.push(`Other: ${otherActivity}`);
                                } else {
                                    actsList.push(a);
                                }
                            });
                        }
                    });

                    return (
                        <div key={intId} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-3.5 shadow-sm">
                            <div className="flex items-center justify-between gap-3 w-full">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                        {INTERVENTION_ICONS[intId]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-base text-slate-900 dark:text-white leading-snug truncate">{info?.label}</p>
                                        <p className="text-xs text-slate-500">{actsList.length > 0 ? `${actsList.length} activit${actsList.length > 1 ? 'ies' : 'y'} selected` : 'Tap to configure activities'}</p>
                                    </div>
                                </div>
                                {!readOnly && (
                                    <button
                                        onClick={() => setActiveModalInt(intId)}
                                        className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-blue-600 dark:hover:bg-blue-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shrink-0 active:scale-95 shadow-sm min-h-[44px]"
                                    >
                                        Configure
                                    </button>
                                )}
                            </div>

                            <div className="space-y-2 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                {actsList.length > 0 ? (
                                    (() => {
                                        const categories = [
                                            { key: 'sip_aip', label: 'SIP–AIP Aligned' },
                                            { key: 'action_research', label: 'Action Research' },
                                            { key: 'remaining', label: 'Remaining Balance' }
                                        ];
                                        return categories.map(cat => {
                                            const items = Array.isArray(selectedActivities[cat.key]) ? selectedActivities[cat.key] : [];
                                            if (items.length === 0) return null;
                                            return (
                                                <div key={cat.key} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-1.5">
                                                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">{cat.label}</p>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {items.map((a, idx) => {
                                                            const display = a === 'Others (specify)' ? (otherActivity ? `Other: ${otherActivity}` : 'Other') : a;
                                                            return (
                                                                <span key={idx} className="text-xs font-medium bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-600 leading-snug whitespace-normal break-words inline-block" title={display}>
                                                                    {display}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()
                                ) : (
                                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                        ⚠️ Click Configure to add activities
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
    const renderSummaryScreen = () => (
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4 pb-36">
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800 shadow-xs">
                        <TbClipboardList size={18} className="text-blue-600 dark:text-blue-400 shrink-0" />
                        <span className="text-xs font-black uppercase tracking-wider">
                            Planned Activities Summary
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-black text-xs border border-slate-200/80 dark:border-slate-700">
                        <TbChecklist size={14} className="text-blue-600 dark:text-blue-400" />
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

                        const hasActivities = categories.some(cat => (Array.isArray(selectedActivities[cat.key]) ? selectedActivities[cat.key] : []).length > 0) ||
                            (otherActivity && (
                                (Array.isArray(selectedActivities.sip_aip) && selectedActivities.sip_aip.includes('Others (specify)')) ||
                                (Array.isArray(selectedActivities.action_research) && selectedActivities.action_research.includes('Others (specify)')) ||
                                (Array.isArray(selectedActivities.remaining) && selectedActivities.remaining.includes('Others (specify)'))
                            ));

                        if (!hasActivities) return null;

                        return (
                            <div key={intId} className="space-y-2">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-1.5 h-4 bg-siif-blue rounded-full" />
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
                                                                <div className="w-3.5 h-3.5 rounded bg-siif-blue text-white flex items-center justify-center shrink-0 mt-0.5">
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

            {/* Navigation / Edit */}
            {!readOnly && (
                <button
                    onClick={() => setScreen('form')}
                    className="w-full py-3.5 px-4 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-300 rounded-xl font-extrabold text-xs uppercase tracking-widest border border-rose-200 dark:border-rose-800 transition-all flex items-center justify-center gap-2 active:scale-[0.98] shadow-sm"
                >
                    <TbArrowLeft size={16} /> Edit Planned Activities
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
                                    By typing <span className="font-extrabold text-blue-700 dark:text-blue-300">CONFIRM</span> below, you certify that the planned activity data submitted above is true, accurate, and officially authorized.
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
                                <TbShieldCheck size={18} /> Confirm & Certify Activities
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
                            Step 3 of 4 — {screen === 'summary' ? 'Review & Confirm' : 'Select'}
                        </span>
                        <h2 className="siif-font-header text-sm font-extrabold text-slate-800 dark:text-slate-100 tracking-tight leading-tight truncate">
                            Planned Activities
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
                    const current = value[intId] || {};
                    const selectedActivities = current.selectedActivities || { sip_aip: [], action_research: [], remaining: [] };
                    const otherActivity = current.otherActivity || '';

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
                                            {INTERVENTION_ICONS[intId] || <TbBook size={20} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[8px] font-black text-blue-200 uppercase tracking-widest">Select Planned Activities</p>
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
                                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                                    {/* SIP-AIP */}
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black text-slate-700 italic flex items-center gap-2 uppercase tracking-wider">
                                            <TbBook size={14} className="text-siif-blue" /> SIP–AIP–Aligned Activities
                                        </p>
                                        <div className="space-y-2">
                                            {SIP_AIP_ACTIVITIES.map(c => renderActivityRow(intId, 'sip_aip', c))}
                                        </div>
                                    </div>

                                    {/* Action Research */}
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black text-slate-700 italic flex items-center gap-2 uppercase tracking-wider">
                                            <TbChartBar size={14} className="text-siif-blue" /> Action Research (AR)
                                        </p>
                                        <div className="space-y-2">
                                            {renderActivityRow(intId, 'action_research', ACTION_RESEARCH_ACTIVITY)}
                                        </div>
                                    </div>

                                    {/* Remaining operational */}
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black text-slate-700 italic flex items-center gap-2 uppercase tracking-wider">
                                            <TbWallet size={14} className="text-siif-blue" /> Remaining SIIF Balance
                                        </p>
                                        <div className="space-y-2">
                                            {REMAINING_ACTIVITIES.map(c => renderActivityRow(intId, 'remaining', c))}
                                        </div>
                                    </div>
                                </div>

                                {/* Modal Footer */}
                                <div className="p-5 border-t border-slate-50 shrink-0">
                                    <button
                                        onClick={() => {
                                            const totalActCount = Object.values(selectedActivities).flat().filter(Boolean).length;
                                            if (totalActCount === 0 && !otherActivity) {
                                                alert("Please select at least one activity before saving.");
                                                return;
                                            }
                                            setActiveModalInt(null);
                                        }}
                                        className="w-full py-4 bg-siif-blue hover:bg-siif-blue/90 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-md transition-all active:scale-[0.98]"
                                    >
                                        Apply Activities ✓
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

export default ActivitiesCard;
