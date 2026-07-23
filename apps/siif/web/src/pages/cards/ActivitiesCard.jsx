// ActivitiesCard.jsx — Step 3 of 4 (Modal Configuration & SIIF Theme)
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TbChevronLeft, TbChevronRight, TbArrowLeft, TbBook, TbCheck, TbChartBar, TbWallet, TbX
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
                <button
                    onClick={() => toggleActivity(intId, category, choice)}
                    disabled={readOnly}
                    className={`w-full p-4 rounded-2xl text-left text-[11px] font-bold flex items-start gap-3 transition-all border-2 ${active ? 'border-siif-blue bg-siif-blue/5 text-siif-blue' : 'border-slate-50 bg-slate-50/50 text-slate-500'
                        } ${readOnly ? 'cursor-default' : ''}`}
                >
                    <div className={`w-5 h-5 rounded-md mt-0.5 shrink-0 flex items-center justify-center ${active ? 'bg-siif-blue' : 'bg-slate-200'}`}>
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
                            value={current.otherActivity || ''}
                            onChange={e => setOther(intId, e.target.value)}
                            className="w-full bg-white border border-siif-blue/30 rounded-xl px-4 py-3 text-[11px] font-bold text-slate-700 focus:ring-2 focus:ring-siif-blue/20 focus:outline-none"
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
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
                <h3 className="text-sm font-black text-slate-800 mb-1 leading-snug">
                    What activities does your school plan to conduct for this intervention?
                </h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                    {readOnly
                        ? "Viewing planned activities for each intervention."
                        : "For each intervention, configure the planned activities to be implemented using popup panels."}
                </p>
            </div>

            <div className="flex flex-row overflow-x-auto gap-4 pb-4">
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
                        <div key={intId} className="siif-card shrink-0 w-[280px] p-4 sm:p-5 flex flex-col gap-3 hover:border-siif-blue transition-all duration-300">
                            <div className="flex flex-col gap-3 w-full">
                                <div className="flex items-center gap-3">
                                    <div className="w-14 h-14 rounded-2xl bg-siif-blue/5 text-siif-blue flex items-center justify-center shrink-0 shadow-inner">
                                        {INTERVENTION_ICONS[intId]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-black text-xs sm:text-sm text-slate-800 uppercase tracking-tight break-words whitespace-normal leading-snug">{info?.label}</p>
                                    </div>
                                </div>
                                {!readOnly && (
                                    <button
                                        onClick={() => setActiveModalInt(intId)}
                                        className="w-full h-[40px] bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shrink-0 active:scale-95 shadow-md flex items-center justify-center"
                                    >
                                        Configure
                                    </button>
                                )}
                            </div>

                            <div className="space-y-2 mt-1 bg-slate-50/50 p-2 sm:p-3 rounded-xl border border-slate-100/50 flex-1 overflow-y-auto max-h-[200px]">
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
                                                <div key={cat.key} className="bg-white p-2.5 rounded-xl border border-slate-100/80 shadow-sm">
                                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1.5">{cat.label}</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {items.map((a, idx) => {
                                                            const display = a === 'Others (specify)' ? (otherActivity ? `Other: ${otherActivity}` : 'Other') : a;
                                                            return (
                                                                <span key={idx} className="text-[8px] font-black bg-slate-50 text-slate-600 px-2 py-1 rounded-lg border border-slate-100 leading-snug whitespace-normal break-words inline-block" title={display}>
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
                                    <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1">
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
            <div className="siif-card p-6">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Summary — Planned Activities</p>

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
                    className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-slate-200 hover:bg-slate-200 transition-colors"
                >
                    ← Edit Planned Activities
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
                            Please confirm the planned activities above are accurate.
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
                                Save Activities ✓
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
                                Step 3 of 4 — {screen === 'summary' ? 'Review & Confirm' : 'Select'}
                            </p>
                            <h1 className="text-xl font-black italic uppercase tracking-tight text-slate-800">Planned Activities</h1>
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
