import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { TbListDetails, TbX, TbPencil, TbPlus, TbLock } from 'react-icons/tb';
import { formatPeso } from './utilizationUi';

/**
 * Spending entries behind one card's quarter amount, oldest first.
 * Stays open under the Add/Edit dialog (`editorOpen`), so the list updates as entries change.
 */
const BreakdownModal = ({
    open,
    onClose,
    label,
    quarterLabel,
    expenses,
    total,
    locked = false,
    canAdd = false,
    addBlockedReason = null,
    onAdd,
    onEdit,
    editorOpen = false,
}) => {
    useEffect(() => {
        if (!open || editorOpen) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, editorOpen, onClose]);

    // Undated ("previously recorded") entries sort first, then by date
    // Order added; an amount carried over from before entries existed comes first
    const sorted = [...expenses].sort((a, b) => Number(!!b.legacy) - Number(!!a.legacy));

    return createPortal(
        <AnimatePresence>
            {open && (
                <motion.div
                    className="fixed inset-0 z-[65] flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                >
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="siif-breakdown-title"
                        initial={{ opacity: 0, y: 30, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.97 }}
                        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                        onClick={(e) => e.stopPropagation()}
                        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                    >
                        <div className="mb-4 flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-md shadow-indigo-500/20">
                                    <TbListDetails size={20} />
                                </span>
                                <div className="min-w-0">
                                    <h2 id="siif-breakdown-title" className="text-base font-black text-slate-900 dark:text-white">
                                        Expense breakdown
                                    </h2>
                                    <p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                                        {label} · {quarterLabel}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Close"
                                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl border-0 bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
                            >
                                <TbX size={15} />
                            </button>
                        </div>

                        {sorted.length === 0 ? (
                            <p className="rounded-2xl border border-dashed border-slate-200 py-8 text-center text-xs font-bold text-slate-400 dark:border-slate-700">
                                No spending recorded for {quarterLabel} yet.
                            </p>
                        ) : (
                            <ol className="-mx-1 flex-1 space-y-1.5 overflow-y-auto px-1" aria-label="Spending entries">
                                {sorted.map((e, i) => (
                                    <li
                                        key={e.id}
                                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 py-2 pl-3 pr-1.5 dark:border-slate-800 dark:bg-slate-800/40"
                                    >
                                        <span className="flex min-w-0 items-center gap-2.5">
                                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-[10px] font-black text-slate-400 dark:bg-slate-900">
                                                {i + 1}
                                            </span>
                                            <span className={`truncate text-xs font-bold ${e.legacy ? 'italic text-slate-400' : 'text-slate-600 dark:text-slate-300'}`}>
                                                {e.legacy ? 'Previously recorded' : 'Spending entry'}
                                            </span>
                                        </span>
                                        <span className="flex shrink-0 items-center gap-1">
                                            <span className="text-sm font-black tabular-nums text-slate-800 dark:text-slate-100">
                                                {formatPeso(e.amount)}
                                            </span>
                                            {!locked && (
                                                <button
                                                    type="button"
                                                    onClick={() => onEdit(e)}
                                                    aria-label={`Edit ${formatPeso(e.amount)} entry`}
                                                    title="Edit or delete this entry"
                                                    className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border-0 bg-transparent px-2 text-[10px] font-black uppercase tracking-wider text-slate-400 outline-none hover:bg-indigo-50 hover:text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-300 dark:hover:bg-indigo-500/10"
                                                >
                                                    <TbPencil size={13} /> Edit
                                                </button>
                                            )}
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        )}

                        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                                Total · {sorted.length} entr{sorted.length === 1 ? 'y' : 'ies'}
                            </span>
                            <span className="text-base font-black tabular-nums text-indigo-700 dark:text-indigo-300">
                                {formatPeso(total)}
                            </span>
                        </div>

                        {locked ? (
                            <p className="mt-3 inline-flex items-center justify-center gap-1 text-[11px] font-bold text-slate-400">
                                <TbLock size={12} /> Locked quarter, view only
                            </p>
                        ) : (
                            <button
                                type="button"
                                onClick={onAdd}
                                disabled={!canAdd}
                                title={addBlockedReason || 'Add a spending entry'}
                                className="mt-4 inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border-0 bg-indigo-600 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-indigo-600/25 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none dark:disabled:bg-slate-700"
                            >
                                <TbPlus size={15} /> Add spending
                            </button>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default BreakdownModal;
