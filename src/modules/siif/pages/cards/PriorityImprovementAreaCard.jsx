import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TbCheck, TbChevronLeft, TbChevronRight, TbArrowLeft, TbX, TbPlus, TbTrash } from 'react-icons/tb';

const PriorityImprovementAreaCard = ({ value = [], onChange, onConfirm, onClose, readOnly }) => {
    const [screen, setScreen]           = useState('form'); // 'form' | 'summary'
    const [confirmText, setConfirmText] = useState('');
    const [confirmError, setConfirmError] = useState(false);

    console.log('🛡️ [PriorityImprovementAreaCard] Rendered with:', { readOnly, value, screen });

    const handleAdd = () => {
        if (readOnly) return;
        onChange([...value, '']);
    };

    const handleUpdate = (index, text) => {
        if (readOnly) return;
        const next = [...value];
        next[index] = text;
        onChange(next);
    };

    const handleRemove = (index) => {
        if (readOnly) return;
        const next = value.filter((_, i) => i !== index);
        onChange(next);
    };

    const goToSummary = () => {
        // Allow empty if they really want, or we can force at least one. Let's allow empty.
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
            return;
        }
        onConfirm();
    };

    // ── FORM SCREEN ─────────────────────────────────────────────────────────────
    const renderFormScreen = () => (
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-3 pb-36">
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm mb-2">
                <h3 className="text-sm font-black text-slate-800 mb-1 leading-snug">
                    Priority Improvement Areas
                </h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                    {readOnly 
                        ? "Viewing priority improvement areas for this fiscal year." 
                        : "List down the Priority Improvement Areas (PIAs) of your school before selecting interventions. Click 'Add Area' to input."}
                </p>
            </div>

            <div className="space-y-3">
                {value.length === 0 && !readOnly && (
                    <div className="flex gap-2 items-start">
                        <textarea
                            value=""
                            onChange={(e) => {
                                onChange([e.target.value]);
                            }}
                            placeholder="Describe the priority improvement area..."
                            className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 focus:border-siif-blue focus:ring-4 focus:ring-blue-50 text-sm font-bold text-slate-700 transition-all resize-none min-h-[80px]"
                        />
                    </div>
                )}
                {value.map((area, index) => (
                    <div key={index} className="flex gap-2 items-start">
                        <textarea
                            value={area}
                            onChange={(e) => handleUpdate(index, e.target.value)}
                            disabled={readOnly}
                            placeholder="Describe the priority improvement area..."
                            className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 focus:border-siif-blue focus:ring-4 focus:ring-blue-50 text-sm font-bold text-slate-700 transition-all resize-none min-h-[80px]"
                        />
                        {!readOnly && (
                            <button
                                onClick={() => handleRemove(index)}
                                className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors shrink-0"
                                title="Remove"
                            >
                                <TbTrash size={20} />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {!readOnly && (
                <button
                    onClick={handleAdd}
                    className="w-full py-4 mt-2 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 border border-slate-200 border-dashed rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
                >
                    <TbPlus size={18} /> Add Area
                </button>
            )}

            <div className="mt-4">
                <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={goToSummary}
                    className="w-full py-5 bg-siif-blue hover:bg-[var(--blue)] text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-900/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                    {readOnly ? 'View Summary' : 'Review Summary'} <TbChevronRight size={18} />
                </motion.button>
            </div>
        </div>
    );

    // ── SUMMARY SCREEN ───────────────────────────────────────────────────────────
    const renderSummaryScreen = () => (
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4 pb-36">
            <div className="p-5 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Summary — Priority Improvement Areas</p>
                <div className="space-y-3">
                    {value.filter(v => v && v.trim().length > 0).map((area, index) => (
                        <div key={index} className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0">
                            <div className="w-8 h-8 rounded-xl bg-blue-50 text-deped-blue flex items-center justify-center shrink-0 mt-1">
                                <span className="font-black text-sm">{index + 1}</span>
                            </div>
                            <p className="text-xs font-bold text-slate-700 leading-relaxed flex-1 whitespace-pre-wrap">{area}</p>
                        </div>
                    ))}
                    {value.filter(v => v && v.trim().length > 0).length === 0 && (
                        <p className="text-xs text-slate-500 italic">No priority improvement areas specified.</p>
                    )}
                </div>
            </div>

            {/* Navigation / Edit */}
            {!readOnly && (
                <button
                    onClick={() => setScreen('form')}
                    className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-slate-200 hover:bg-slate-200 transition-colors"
                >
                    ← Edit List
                </button>
            )}

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
                            Please confirm that the list above is accurate and complete for your school's plan.
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
                        <div className="mt-3">
                            <button
                                onClick={handleSave}
                                className="w-full py-5 bg-deped-blue text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-900/20 active:scale-95 transition-transform"
                            >
                                Save Priority Areas ✓
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
                                Step 1 of 5 — {screen === 'summary' ? 'Review & Confirm' : 'List Areas'}
                            </p>
                            <h1 className="text-xl font-black italic uppercase tracking-tight text-slate-800">Priority Areas</h1>
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
                    {['form', 'summary'].map((s) => (
                        <div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${screen === s || s === 'form' ? 'bg-siif-blue' : 'bg-slate-200'} ${screen === 'summary' && s === 'summary' ? 'bg-siif-blue' : screen === 'form' && s === 'summary' ? 'bg-slate-200' : ''}`} />
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

export default PriorityImprovementAreaCard;
