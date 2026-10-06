import React from 'react';
import { motion } from 'framer-motion';
import { TbCheck, TbDeviceFloppy, TbAlertCircle } from 'react-icons/tb';
import { formatPeso } from './utilizationUi';

const formatSavedAt = (value) => {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    const sameDay = d.toDateString() === new Date().toDateString();
    return sameDay
        ? d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
        : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const SaveBar = ({ saving, hasUnsavedChanges, isOverAllocation, totalUtilized, totalAllocated, lastSavedAt, onSave }) => {
    const savedLabel = formatSavedAt(lastSavedAt);

    let tone, title, subtitle, icon;
    if (isOverAllocation) {
        tone = 'bg-rose-500';
        icon = <TbAlertCircle size={18} className="text-rose-500" />;
        title = 'Over the allocation';
        subtitle = `${formatPeso(totalUtilized)} of ${formatPeso(totalAllocated)}. Adjust amounts to save.`;
    } else if (hasUnsavedChanges) {
        tone = 'bg-amber-400';
        icon = <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-400" />;
        title = 'Unsaved changes';
        subtitle = 'Save to sync with your school and division records.';
    } else {
        tone = 'bg-emerald-500';
        icon = <TbCheck size={18} className="text-emerald-500" />;
        title = 'All changes saved';
        subtitle = savedLabel ? `Last saved ${savedLabel}` : 'Synced with division records.';
    }

    const disabled = saving || isOverAllocation || !hasUnsavedChanges;

    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-3 sm:px-6 sm:pb-5 print:hidden">
            <motion.div
                initial={{ y: 90, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                className="pointer-events-auto relative mx-auto flex max-w-3xl items-center gap-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 shadow-2xl shadow-slate-900/15 backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/90"
            >
                <span className={`absolute inset-x-0 top-0 h-0.5 ${tone}`} aria-hidden="true" />
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                    {icon}
                </div>
                <div className="min-w-0 flex-1" aria-live="polite">
                    <p className="truncate text-sm font-black text-slate-800 dark:text-slate-100">{title}</p>
                    <p className="truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">{subtitle}</p>
                </div>
                <button
                    type="button"
                    onClick={onSave}
                    disabled={disabled}
                    className={`inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border-0 px-4 py-2.5 sm:px-5 text-xs font-black uppercase tracking-wider text-white outline-none transition-all focus-visible:ring-4 active:scale-[0.97] disabled:cursor-not-allowed ${
                        isOverAllocation
                            ? 'bg-rose-500 opacity-60'
                            : hasUnsavedChanges
                                ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 focus-visible:ring-emerald-200'
                                : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                >
                    {saving ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                        <TbDeviceFloppy size={16} />
                    )}
                    <span>{saving ? 'Saving…' : 'Save'}</span>
                </button>
            </motion.div>
        </div>
    );
};

export default SaveBar;
