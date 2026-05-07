// ActivitiesCard.jsx — Step 3 of 4
// Form → Summary → CONFIRM-to-save (budget removed — now lives in BudgetCard)
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TbChevronLeft, TbChevronDown, TbChevronUp, TbCheck,
    TbChevronRight, TbArrowLeft, TbBook, TbChartBar, TbWallet
} from 'react-icons/tb';
import {
    INTERVENTIONS, INTERVENTION_ICONS,
    SIP_AIP_ACTIVITIES, REMAINING_ACTIVITIES, ACTION_RESEARCH_ACTIVITY
} from './siifConstants.jsx';

const ActivitiesCard = ({ selectedInterventions, value, onChange, onConfirm, onClose, readOnly }) => {
    // value = { [intId]: { selectedActivities: {sip_aip, action_research, remaining}, otherActivity } }
    const [screen, setScreen]           = useState('form');
    const [expanded, setExpanded]       = useState(selectedInterventions[0] || null);
    const [confirmText, setConfirmText] = useState('');
    const [confirmError, setConfirmError] = useState(false);

    console.log('🖊️ [ActivitiesCard_DIAGNOSTIC]', {
        screen,
        readOnly,
        interventionCount: selectedInterventions.length
    });

    const toggleActivity = (intId, category, choice) => {
        if (readOnly) return;
        const current = value[intId] || { selectedActivities: { sip_aip: [], action_research: [], remaining: [] }, otherActivity: '' };
        const list = current.selectedActivities[category] || [];
        const next = list.includes(choice) ? list.filter(x => x !== choice) : [...list, choice];
        console.log(`🔄 [ActivitiesCard] "${intId}" category "${category}" toggled "${choice}".`);
        onChange({
            ...value,
            [intId]: { ...current, selectedActivities: { ...current.selectedActivities, [category]: next } }
        });
    };

    const setOther = (intId, text) => {
        if (readOnly) return;
        const current = value[intId] || { selectedActivities: { sip_aip: [], action_research: [], remaining: [] }, otherActivity: '' };
        onChange({ ...value, [intId]: { ...current, otherActivity: text } });
    };

    const goToSummary = () => {
        const hasActivity = selectedInterventions.some(id => {
            const acts = value[id]?.selectedActivities || {};
            return Object.values(acts).flat().length > 0;
        });
        if (!hasActivity) {
            alert('Please select at least one activity for at least one intervention.');
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
        const data = value[intId] || { selectedActivities: { sip_aip: [], action_research: [], remaining: [] }, otherActivity: '' };
        const active = (data.selectedActivities[category] || []).includes(choice);
        const isOthers = choice === 'Others (specify)';
        
        if (readOnly && !active) return null;

        return (
            <React.Fragment key={choice}>
                <button
                    onClick={() => toggleActivity(intId, category, choice)}
                    disabled={readOnly}
                    className={`w-full p-4 rounded-2xl text-left text-[11px] font-bold flex items-start gap-3 transition-all border-2 ${
                        active ? 'border-amber-400 bg-amber-50/50 text-amber-800' : 'border-slate-50 bg-slate-50/50 text-slate-500'
                    } ${readOnly ? 'cursor-default' : ''}`}
                >
                    <div className={`w-5 h-5 rounded-md mt-0.5 shrink-0 flex items-center justify-center ${active ? 'bg-amber-500' : 'bg-slate-200'}`}>
                        {active && <TbCheck size={11} className="text-white" />}
                    </div>
                    <span className="leading-relaxed">{choice}</span>
                </button>
                {active && isOthers && (
                    <div className="px-2 pb-1">
                        <input
                            type="text"
                            placeholder="Please specify activity..."
                            readOnly={readOnly}
                            value={data.otherActivity || ''}
                            onChange={e => setOther(intId, e.target.value)}
                            className={`w-full bg-white border border-amber-100 rounded-xl px-4 py-3 text-[11px] font-bold text-slate-700 focus:ring-2 focus:ring-amber-300/30 focus:outline-none ${readOnly ? 'bg-slate-100' : ''}`}
                        />
                    </div>
                )}
            </React.Fragment>
        );
    };

    // Summary
    const summaryLines = selectedInterventions.flatMap(intId => {
        const acts = value[intId]?.selectedActivities || {};
        return Object.values(acts).flat().map(a => ({ intId, activity: a }));
    });

    // ── FORM SCREEN ──────────────────────────────────────────────────────────────
    const renderFormScreen = () => (
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-3 pb-36">
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
                <p className="text-[11px] text-slate-500 leading-relaxed">
                    {readOnly 
                        ? "Viewing planned activities for each intervention."
                        : "For each intervention, select the planned activities to be implemented."}
                </p>
            </div>

            {selectedInterventions.map(intId => {
                const info = INTERVENTIONS.find(i => i.id === intId);
                const data = value[intId] || { selectedActivities: { sip_aip: [], action_research: [], remaining: [] }, otherActivity: '' };
                const actCount = Object.values(data.selectedActivities).flat().length;
                const isExpanded = expanded === intId;

                return (
                    <div key={intId} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                        <button
                            onClick={() => setExpanded(isExpanded ? null : intId)}
                            className="w-full p-5 flex items-center gap-4 text-left"
                        >
                            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                                {INTERVENTION_ICONS[intId]}
                            </div>
                            <div className="flex-1">
                                <p className="font-black text-sm text-slate-800 uppercase tracking-tight">{info?.label}</p>
                                <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                                    {actCount > 0 ? `${actCount} activit${actCount !== 1 ? 'ies' : 'y'} selected` : 'Tap to add activities'}
                                </p>
                            </div>
                            {actCount > 0 && (
                                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                                    <TbCheck size={11} className="text-white" />
                                </div>
                            )}
                            {isExpanded ? <TbChevronUp className="text-slate-400 shrink-0" /> : <TbChevronDown className="text-slate-400 shrink-0" />}
                        </button>

                        {isExpanded && (
                            <div className="border-t border-slate-50 px-5 pb-5 pt-4 space-y-6">
                                <div className="space-y-2">
                                    <p className="text-xs font-black text-slate-700 italic flex items-center gap-2">
                                        <TbBook size={14} className="text-amber-500" /> SIP–AIP–Aligned Activities
                                    </p>
                                    {SIP_AIP_ACTIVITIES.map(c => renderActivityRow(intId, 'sip_aip', c))}
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs font-black text-slate-700 italic flex items-center gap-2">
                                        <TbChartBar size={14} className="text-amber-500" /> Action Research (AR)
                                    </p>
                                    {renderActivityRow(intId, 'action_research', ACTION_RESEARCH_ACTIVITY)}
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs font-black text-slate-700 italic flex items-center gap-2">
                                        <TbWallet size={14} className="text-amber-500" /> Remaining SIIF Balance
                                    </p>
                                    {REMAINING_ACTIVITIES.map(c => renderActivityRow(intId, 'remaining', c))}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}

            <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={goToSummary}
                className="w-full py-5 bg-amber-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-amber-900/20 active:scale-95 transition-transform flex items-center justify-center gap-3 mt-4"
            >
                {readOnly ? 'View Summary' : 'Review Summary'} <TbChevronRight size={18} />
            </motion.button>
        </div>
    );

    // ── SUMMARY SCREEN ───────────────────────────────────────────────────────────
    const renderSummaryScreen = () => (
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4 pb-36">
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Summary — Planned Activities</p>
                {selectedInterventions.map(intId => {
                    const info = INTERVENTIONS.find(i => i.id === intId);
                    const data = value[intId] || { selectedActivities: { sip_aip: [], action_research: [], remaining: [] }, otherActivity: '' };
                    
                    const CATEGORIES = [
                        { id: 'sip_aip', label: 'SIP–AIP–Aligned Activities' },
                        { id: 'action_research', label: 'Action Research (AR)' },
                        { id: 'remaining', label: 'Remaining SIIF Balance' }
                    ];

                    return (
                        <div key={intId} className="mb-6 pb-6 border-b border-slate-50 last:border-0 last:mb-0">
                            <p className="text-xs font-black text-slate-800 uppercase mb-4 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                {info?.label}
                            </p>
                            <div className="space-y-4 pl-3">
                                {CATEGORIES.map(cat => {
                                    const selected = data.selectedActivities[cat.id] || [];
                                    if (selected.length === 0) return null;
                                    return (
                                        <div key={cat.id} className="space-y-2">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                {cat.label}
                                            </p>
                                            <div className="space-y-1.5">
                                                {selected.map((a, i) => {
                                                    const isOthers = a === 'Others (specify)';
                                                    const displayValue = isOthers ? (data.otherActivity || 'Others (not specified)') : a;
                                                    return (
                                                        <div key={i} className="flex items-start gap-2 bg-slate-50/50 p-2 rounded-xl border border-slate-100/50">
                                                            <TbCheck size={10} className="text-amber-500 mt-0.5 shrink-0" />
                                                            <p className="text-[10px] text-slate-600 font-bold leading-tight">{displayValue}</p>
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

            {!readOnly && (
                <button
                    onClick={() => setScreen('form')}
                    className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-slate-200 hover:bg-slate-200 transition-colors"
                >
                    ← Edit Activities
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
                            Please confirm the activities listed above are accurate.
                        </p>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            Type <span className="text-amber-600 font-black">CONFIRM</span> to save
                        </p>
                        <input
                            type="text"
                            placeholder="Type CONFIRM here..."
                            value={confirmText}
                            onChange={e => setConfirmText(e.target.value)}
                            className={`w-full px-5 py-4 rounded-2xl border-2 font-black text-sm tracking-widest text-center transition-all focus:outline-none ${
                                confirmError
                                    ? 'border-red-400 bg-red-50 text-red-600'
                                    : 'border-slate-200 bg-slate-50 text-slate-800 focus:border-amber-400 focus:bg-white'
                            }`}
                        />
                        {confirmError && (
                            <p className="text-center text-[10px] text-red-500 font-bold animate-bounce">Please type CONFIRM exactly</p>
                        )}
                        <button
                            onClick={handleSave}
                            className="w-full py-5 bg-amber-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-amber-900/20 active:scale-95 transition-transform"
                        >
                            Save Activities ✓
                        </button>
                    </>
                )}
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col overflow-hidden">
            <div className="bg-amber-500 text-white pt-14 pb-8 px-6 rounded-b-[3rem] shadow-xl relative overflow-hidden shrink-0">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-24 -mt-24 pointer-events-none" />
                <div className="relative z-10 flex items-center gap-4">
                    <button
                        onClick={screen === 'summary' ? () => setScreen('form') : onClose}
                        className="p-2.5 bg-white/10 rounded-2xl border border-white/20"
                    >
                        {screen === 'summary' ? <TbArrowLeft size={20} /> : <TbChevronLeft size={20} />}
                    </button>
                    <div>
                        <p className="text-[9px] font-black text-amber-100 uppercase tracking-[0.3em]">
                            Step 3 of 4 — {screen === 'summary' ? 'Review & Confirm' : 'Select'}
                        </p>
                        <h1 className="text-xl font-black italic uppercase tracking-tight">Activities</h1>
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

export default ActivitiesCard;
