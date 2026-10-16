import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { TbReceipt, TbAlertTriangle, TbTrash, TbX } from 'react-icons/tb';
import { formatPeso, formatAmountInput, sanitizeAmountInput } from './utilizationUi';

/** The form itself; mounted fresh each time the modal opens, so it starts from `editor`. */
const ExpenseForm = ({ editor, onSubmit, onDelete, onClose }) => {
    const editing = !!editor.expense;
    const [amount, setAmount] = useState(() => (editor.expense ? sanitizeAmountInput(editor.expense.amount) : ''));
    const [error, setError] = useState(null);
    // Delete asks once more, so it can't be hit by accident next to Update
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const hasBalance = Number.isFinite(editor.maxAmount);

    const handleSubmit = (e) => {
        e.preventDefault();
        const value = parseFloat(amount) || 0;
        if (value <= 0) return setError('Enter an amount greater than ₱0.00.');
        if (value > editor.maxAmount) {
            return setError(editing
                ? `Over budget. This entry can go up to ${formatPeso(editor.maxAmount)}: its current ${formatPeso(editor.expense.amount)} plus the ${formatPeso(editor.schoolBalance)} school balance left.`
                : `Over budget. The school only has ${formatPeso(editor.schoolBalance)} left of its ${formatPeso(editor.totalAllocated)} allocation.`);
        }
        const result = onSubmit({ amount: sanitizeAmountInput(amount) });
        if (result) setError(result);
    };

    return (
        <motion.form
            role="dialog"
            aria-modal="true"
            aria-labelledby="siif-expense-title"
            noValidate
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        >
            <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-md shadow-indigo-500/20">
                        <TbReceipt size={20} />
                    </span>
                    <div className="min-w-0">
                        <h2 id="siif-expense-title" className="text-base font-black text-slate-900 dark:text-white">
                            {editing ? 'Edit spending' : 'Add spending'}
                        </h2>
                        <p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {editor.label} · {editor.quarterLabel}
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

            <label htmlFor="siif-expense-amount" className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Amount spent
            </label>
            <div className="relative mb-1.5">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 select-none text-base font-black text-slate-400">₱</span>
                <input
                    id="siif-expense-amount"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    autoFocus
                    value={amount}
                    onChange={(e) => { setAmount(sanitizeAmountInput(e.target.value)); setError(null); }}
                    placeholder="0.00"
                    style={{ paddingLeft: '38px' }}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pr-4 text-base font-black tabular-nums text-slate-900 outline-none transition-all hover:border-slate-300 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-900 dark:focus:ring-indigo-500/20"
                />
            </div>
            <p className="mb-4 text-[11px] font-bold text-slate-400">
                {amount ? `₱${formatAmountInput(amount)}` : ''}
                {amount && hasBalance ? ' · ' : ''}
                {hasBalance && (
                    <>
                        School balance left: <span className="text-slate-600 dark:text-slate-300">{formatPeso(editor.schoolBalance)}</span> of {formatPeso(editor.totalAllocated)}
                        {editing && <> (this entry can go up to {formatPeso(editor.maxAmount)})</>}
                    </>
                )}
            </p>

            <p className="mb-4 min-h-[16px] text-[11px] font-bold" aria-live="assertive">
                {error && (
                    <span className="inline-flex items-start gap-1 text-rose-600 dark:text-rose-400">
                        <TbAlertTriangle size={13} className="mt-px shrink-0" /> {error}
                    </span>
                )}
            </p>

            <div className="flex gap-2.5">
                <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 cursor-pointer rounded-xl border border-slate-200 bg-white py-3 text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    className="flex-1 cursor-pointer rounded-xl border-0 bg-indigo-600 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-indigo-600/25 hover:bg-indigo-700"
                >
                    {editing ? 'Update entry' : 'Add entry'}
                </button>
            </div>

            <p className="mt-3 text-center text-[10px] font-semibold text-slate-400">
                Changes stay on this page until you click Save.
            </p>

            {editing && (
                <div className="mt-3 border-t border-slate-100 pt-3 text-center dark:border-slate-800">
                    {confirmingDelete ? (
                        <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-bold">
                            <span className="text-rose-600 dark:text-rose-400">
                                Delete this {formatPeso(editor.expense.amount)} entry?
                            </span>
                            <button
                                type="button"
                                onClick={onDelete}
                                className="cursor-pointer rounded-lg border-0 bg-rose-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white hover:bg-rose-700"
                            >
                                Yes, delete
                            </button>
                            <button
                                type="button"
                                onClick={() => setConfirmingDelete(false)}
                                className="cursor-pointer rounded-lg border-0 bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                            >
                                Keep it
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setConfirmingDelete(true)}
                            className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent text-[11px] font-bold text-rose-500 hover:text-rose-600 hover:underline"
                        >
                            <TbTrash size={13} /> Delete this entry
                        </button>
                    )}
                </div>
            )}
        </motion.form>
    );
};

/**
 * Add or edit one spending entry (amount only; spending is tracked per quarter) for an intervention's quarter.
 * `editor` is { label, quarterLabel, expense?, totalAllocated, schoolBalance, maxAmount } or null.
 * `onSubmit({ amount })` returns an error message, or null when it was applied.
 * Portaled to <body> so the card's overflow and transforms can't clip it.
 */
const ExpenseModal = ({ editor, onSubmit, onDelete, onClose }) => {
    const open = !!editor;

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    return createPortal(
        <AnimatePresence>
            {open && (
                <motion.div
                    className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                >
                    <ExpenseForm editor={editor} onSubmit={onSubmit} onDelete={onDelete} onClose={onClose} />
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default ExpenseModal;
