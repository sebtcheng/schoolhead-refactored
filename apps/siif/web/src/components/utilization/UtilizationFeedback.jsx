import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TbCheck, TbAlertTriangle, TbInfoCircle, TbX } from 'react-icons/tb';

const TOAST_STYLES = {
    success: { icon: <TbCheck size={18} />, badge: 'bg-emerald-500 text-white' },
    error: { icon: <TbAlertTriangle size={18} />, badge: 'bg-rose-500 text-white' },
    info: { icon: <TbInfoCircle size={18} />, badge: 'bg-sky-500 text-white' },
};

export const UtilizationToast = ({ toast, onClose }) => {
    useEffect(() => {
        if (!toast) return undefined;
        const timer = setTimeout(onClose, toast.type === 'error' ? 6000 : 3500);
        return () => clearTimeout(timer);
    }, [toast, onClose]);

    const style = TOAST_STYLES[toast?.type] || TOAST_STYLES.info;

    return (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center px-4" aria-live="assertive">
            <AnimatePresence>
                {toast && (
                    <motion.div
                        key={toast.id}
                        initial={{ opacity: 0, y: -24, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -16, scale: 0.96 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                        role="status"
                        className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900"
                    >
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${style.badge}`}>
                            {style.icon}
                        </span>
                        <div className="min-w-0 flex-1 pt-0.5">
                            <p className="text-sm font-black text-slate-800 dark:text-slate-100">{toast.title}</p>
                            {toast.message && (
                                <p className="mt-0.5 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">{toast.message}</p>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Dismiss"
                            className="cursor-pointer rounded-lg border-0 bg-transparent p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                        >
                            <TbX size={15} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export const ConfirmDialog = ({ open, title, message, confirmLabel = 'Confirm', onConfirm, onCancel }) => {
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onCancel]);

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onCancel}
                >
                    <motion.div
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="siif-confirm-title"
                        initial={{ opacity: 0, y: 30, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.97 }}
                        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                    >
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 dark:bg-rose-500/10">
                            <TbAlertTriangle size={24} />
                        </div>
                        <h2 id="siif-confirm-title" className="mb-1.5 text-base font-black text-slate-900 dark:text-white">
                            {title}
                        </h2>
                        <p className="mb-6 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{message}</p>
                        <div className="flex gap-2.5">
                            <button
                                type="button"
                                onClick={onCancel}
                                autoFocus
                                className="flex-1 cursor-pointer rounded-xl border border-slate-200 bg-white py-3 text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={onConfirm}
                                className="flex-1 cursor-pointer rounded-xl border-0 bg-rose-500 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-rose-500/25 hover:bg-rose-600"
                            >
                                {confirmLabel}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
