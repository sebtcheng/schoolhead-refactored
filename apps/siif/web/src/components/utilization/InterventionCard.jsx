import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { TbTarget, TbX, TbAlertTriangle, TbLock } from 'react-icons/tb';
import ActivityChecklist from './ActivityChecklist';
import {
    amountOf,
    formatPeso,
    formatAmountInput,
    sanitizeAmountInput,
    QUARTER_SHORT,
} from './utilizationUi';

const InterventionCard = ({
    intId,
    label,
    icon,
    quarterData,
    periods,
    viewingQuarter,
    maxAllowed,
    onAmountChange,
    onJustificationChange,
    onRemove,
    index,
    locked = false,
    removeBlocked = false,
    plannedActivities = [],
    activitiesMissing = false,
    onActivitiesChange,
}) => {
    const [focused, setFocused] = useState(false);
    const [limitError, setLimitError] = useState(null);
    const errorTimer = useRef(null);

    const current = quarterData[viewingQuarter] || {};
    const rawAmount = current?.amount !== undefined ? current.amount : current;
    const amountStr = typeof rawAmount === 'object' || rawAmount === undefined || rawAmount === null ? '' : String(rawAmount);
    const justification = current?.justification || '';
    const hasAmount = amountOf(current) > 0;

    const total = periods.reduce((sum, p) => sum + amountOf(quarterData[p.id]), 0);
    const fieldId = `siif-${intId}-${viewingQuarter}`;
    const errorText = limitError?.quarter === viewingQuarter ? limitError.text : null;

    useEffect(() => () => clearTimeout(errorTimer.current), []);

    const handleAmount = (text) => {
        if (locked) return;
        const result = onAmountChange(intId, sanitizeAmountInput(text));
        clearTimeout(errorTimer.current);
        if (result?.exceeded) {
            setLimitError({ quarter: viewingQuarter, text: `Over budget. You can enter up to ${formatPeso(result.maxAllowed)} here.` });
            errorTimer.current = setTimeout(() => setLimitError(null), 4500);
        } else {
            setLimitError(null);
        }
    };

    return (
        <motion.article
            layout
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.3) }}
            className="siif-card group relative flex h-full flex-col overflow-hidden transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:!shadow-[0_12px_32px_-12px_rgba(8,49,95,0.28)]"
        >
            {/* Accent: filled in once this quarter has an amount */}
            <span className={`absolute inset-y-0 left-0 w-1.5 transition-colors duration-300 ${hasAmount ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`} aria-hidden="true" />

            <div className="flex flex-1 flex-col gap-4 p-4 pl-5 sm:p-5 sm:pl-6">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-md shadow-indigo-500/20">
                            {icon || <TbTarget size={18} />}
                        </div>
                        <h3 className="min-w-0 truncate font-heading text-[15px] font-extrabold tracking-tight text-[#08315F] dark:text-slate-100" title={label}>
                            {label}
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={() => onRemove(intId)}
                        disabled={removeBlocked}
                        title={removeBlocked
                            ? "Can't be removed: it has entries in a locked quarter"
                            : 'Stop tracking this intervention'}
                        aria-label={`Stop tracking ${label}`}
                        className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl border-0 bg-slate-100 text-slate-400 outline-none transition-all hover:bg-rose-50 hover:text-rose-500 focus-visible:ring-2 focus-visible:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-slate-100 disabled:hover:text-slate-400 dark:bg-slate-800 dark:hover:bg-rose-500/10"
                    >
                        <TbX size={15} />
                    </button>
                </div>

                {/* Amount */}
                <div>
                    <label htmlFor={`${fieldId}-amount`} className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Utilized Amount
                    </label>
                    <div className="relative">
                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 select-none text-base font-black text-slate-400">
                            ₱
                        </span>
                        <input
                            id={`${fieldId}-amount`}
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            value={focused ? amountStr : formatAmountInput(amountStr)}
                            onFocus={() => setFocused(true)}
                            onBlur={() => setFocused(false)}
                            onChange={(e) => handleAmount(e.target.value)}
                            readOnly={locked}
                            placeholder="0.00"
                            aria-invalid={!!errorText}
                            aria-describedby={`${fieldId}-hint`}
                            style={{ paddingLeft: '38px' }}
                            className={`w-full rounded-2xl border py-3 pr-4 text-base font-black tabular-nums text-slate-900 outline-none transition-all hover:border-slate-300 focus:bg-white focus:ring-4 dark:text-slate-100 dark:focus:bg-slate-900 dark:focus:ring-indigo-500/20 ${
                                locked
                                    ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500 focus:ring-0 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400'
                                    : errorText
                                    ? 'border-rose-400 bg-rose-50/60 focus:border-rose-400 focus:ring-rose-100'
                                    : 'border-slate-200 bg-slate-50 focus:border-indigo-400 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800'
                            }`}
                        />
                    </div>
                    <p id={`${fieldId}-hint`} className="mt-1.5 min-h-[16px] text-[11px] font-bold">
                        {locked ? (
                            <span className="inline-flex items-center gap-1 text-slate-400">
                                <TbLock size={12} /> Locked quarter, view only
                            </span>
                        ) : errorText ? (
                            <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                                <TbAlertTriangle size={13} /> {errorText}
                            </span>
                        ) : maxAllowed !== null ? (
                            <span className="text-slate-400">Up to {formatPeso(maxAllowed)} available</span>
                        ) : null}
                    </p>
                </div>

                {/* Activities for the quarter on screen; remounts per quarter */}
                <ActivityChecklist
                    key={viewingQuarter}
                    fieldId={fieldId}
                    caption={`For ${QUARTER_SHORT[viewingQuarter] || viewingQuarter}`}
                    activities={Array.isArray(current?.activities) ? current.activities : []}
                    otherActivity={current?.other_activity || ''}
                    planned={plannedActivities}
                    readOnly={locked}
                    missing={activitiesMissing}
                    onChange={(next) => onActivitiesChange(intId, next)}
                />

                {/* Remarks */}
                <div>
                    <label htmlFor={`${fieldId}-remarks`} className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Remarks / Justification
                    </label>
                    <textarea
                        id={`${fieldId}-remarks`}
                        value={justification}
                        onChange={(e) => onJustificationChange(intId, e.target.value)}
                        readOnly={locked}
                        rows={2}
                        placeholder={locked ? '' : 'Optional notes or accomplishment description...'}
                        className="read-only:cursor-not-allowed read-only:bg-slate-100 read-only:text-slate-500 dark:read-only:bg-slate-800/60 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium leading-relaxed text-slate-700 outline-none transition-all placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:bg-slate-900 dark:focus:ring-indigo-500/20"
                    />
                </div>
            </div>

            {/* Footer total */}
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-5 py-3 pl-6 dark:border-slate-800 dark:bg-slate-800/40">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Total, all quarters
                </span>
                <span className="text-sm font-black tabular-nums text-indigo-700 dark:text-indigo-300">
                    {formatPeso(total)}
                </span>
            </div>
        </motion.article>
    );
};

export default InterventionCard;
