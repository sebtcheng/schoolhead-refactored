import React, { useEffect, useState } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { TbReceipt, TbHistory, TbAlertTriangle, TbCalendarEvent, TbUserCircle } from 'react-icons/tb';
import { fetchModifiedUtilizationHistory } from '../../services/siifService';
import { INTERVENTIONS } from '../../constants/siifConstants';
import { formatPeso } from './utilizationUi';

const PAGE_SIZE = 20;

const labelOf = (id) => INTERVENTIONS.find(i => i.id === id)?.label || id;

/** "Oct 12, 2026, 10:45 AM" */
const formatStamp = (iso) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? ''
        : d.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const SectionHeader = ({ icon, title, subtitle, count }) => (
    <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#08315F] text-white dark:bg-blue-500/20 dark:text-blue-300">
                {icon}
            </span>
            <div className="min-w-0">
                <h2 className="!text-base sm:!text-lg">{title}</h2>
                <p className="text-[11px] font-bold text-slate-400">{subtitle}</p>
            </div>
        </div>
        {count !== undefined && (
            <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {count}
            </span>
        )}
    </div>
);

const EntryStatus = ({ entry }) => {
    if (entry.unsaved) {
        return <span className="font-black text-amber-600 dark:text-amber-400">Not saved yet. Click Save to keep it.</span>;
    }
    if (entry.legacy) return <span className="italic text-slate-400">Recorded before tracking</span>;
    const edited = entry.updated_at && <> · edited {formatStamp(entry.updated_at)}</>;
    // Saved before "added" times were tracked
    if (!entry.recorded_at) return <span>Saved{edited}</span>;
    return <span>Added {formatStamp(entry.recorded_at)}{edited}</span>;
};

/**
 * Two timelines: every spending entry (when it was spent and when it was added),
 * and the save log from modified_siif_utilization_audit.
 * `entries`: [{ key, amount, date, recorded_at, updated_at, legacy, unsaved, intervention, quarter }]
 * `refreshKey` changes after each save so the log reloads.
 */
const UtilizationHistory = ({ schoolId, token, fiscalYear, entries, refreshKey }) => {
    const [limit, setLimit] = useState(PAGE_SIZE);
    const [log, setLog] = useState({ key: null, rows: [], total: 0, error: null });
    const requestKey = `${schoolId}|${fiscalYear}|${refreshKey}|${limit}`;
    const loading = log.key !== requestKey;

    useEffect(() => {
        if (!schoolId) return undefined;
        let cancelled = false;
        fetchModifiedUtilizationHistory(schoolId, token, { fiscalYear, limit })
            .then(data => {
                if (!cancelled) setLog({ key: requestKey, rows: data?.history || [], total: data?.total || 0, error: null });
            })
            .catch(err => {
                if (!cancelled) setLog({ key: requestKey, rows: [], total: 0, error: err.message });
            });
        return () => { cancelled = true; };
    }, [schoolId, token, fiscalYear, limit, requestKey]);

    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* ── Spending entries ── */}
            <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="siif-card p-4 sm:p-5"
                aria-label="Spending entries"
            >
                <SectionHeader
                    icon={<TbReceipt size={18} />}
                    title="Spending Entries"
                    subtitle="Every amount added with the + button"
                    count={`${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`}
                />
                {entries.length === 0 ? (
                    <p className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-400 dark:bg-slate-800/40">
                        No spending recorded yet. Add entries in the Record Utilization tab.
                    </p>
                ) : (
                    <ol className="relative space-y-3 border-l-2 border-slate-100 pl-4 dark:border-slate-800">
                        {entries.map(e => (
                            <li key={e.key} className="relative">
                                <span
                                    className={`absolute -left-[23px] top-1.5 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900 ${
                                        e.unsaved ? 'bg-amber-400' : e.legacy ? 'bg-slate-300' : 'bg-sky-500'
                                    }`}
                                    aria-hidden="true"
                                />
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-black text-slate-800 dark:text-slate-100">{e.intervention}</p>
                                        <p className="flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                            <TbCalendarEvent size={12} className="shrink-0" />
                                            {e.quarter}
                                        </p>
                                        <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                                            <EntryStatus entry={e} />
                                        </p>
                                    </div>
                                    <span className="shrink-0 text-sm font-black tabular-nums text-indigo-700 dark:text-indigo-300">
                                        {formatPeso(e.amount)}
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ol>
                )}
            </motion.section>

            {/* ── Save log ── */}
            <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 }}
                className="siif-card p-4 sm:p-5"
                aria-label="Save log"
                aria-busy={loading}
            >
                <SectionHeader
                    icon={<TbHistory size={18} />}
                    title="Save Log"
                    subtitle="Who saved, when, and how the total changed"
                    count={loading ? undefined : `${log.total} save${log.total === 1 ? '' : 's'}`}
                />
                {log.error ? (
                    <p className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                        <TbAlertTriangle size={14} className="mt-px shrink-0" /> Couldn&apos;t load the save log. {log.error}
                    </p>
                ) : loading && log.rows.length === 0 ? (
                    <div className="space-y-3" aria-hidden="true">
                        {[0, 1, 2].map(i => <div key={i} className="h-14 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />)}
                    </div>
                ) : log.rows.length === 0 ? (
                    <p className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-400 dark:bg-slate-800/40">
                        No saves yet for FY {fiscalYear}.
                    </p>
                ) : (
                    <>
                        <ol className="space-y-2.5">
                            {log.rows.map(row => {
                                const diff = (row.after_spent || 0) - (row.before_spent || 0);
                                return (
                                    <li key={row.audit_id} className="rounded-2xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-800/40">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-xs font-black text-slate-800 dark:text-slate-100">
                                                    {row.action === 'remove' ? 'Removed an intervention' : 'Saved utilization'}
                                                </p>
                                                <p className="text-[11px] font-bold text-slate-400">{formatStamp(row.changed_at)}</p>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <p className="text-xs font-black tabular-nums text-slate-700 dark:text-slate-200">{formatPeso(row.after_spent)}</p>
                                                {row.before_spent !== null && diff !== 0 && (
                                                    <p className={`text-[11px] font-black tabular-nums ${diff > 0 ? 'text-sky-600 dark:text-sky-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                        {diff > 0 ? '+' : '−'}{formatPeso(Math.abs(diff))}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        {(row.added_ids?.length > 0 || row.removed_ids?.length > 0) && (
                                            <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                                {row.added_ids?.length > 0 && <>Added: {row.added_ids.map(labelOf).join(', ')}. </>}
                                                {row.removed_ids?.length > 0 && <>Removed: {row.removed_ids.map(labelOf).join(', ')}.</>}
                                            </p>
                                        )}
                                        {row.changed_by_email && (
                                            <p className="mt-1 flex items-center gap-1 truncate text-[10px] font-bold text-slate-400">
                                                <TbUserCircle size={12} className="shrink-0" /> {row.changed_by_email}
                                            </p>
                                        )}
                                    </li>
                                );
                            })}
                        </ol>
                        {log.rows.length < log.total && (
                            <button
                                type="button"
                                onClick={() => setLimit(l => l + PAGE_SIZE)}
                                disabled={loading}
                                className="mt-3 w-full cursor-pointer rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                                {loading ? 'Loading…' : `Show more (${log.total - log.rows.length} left)`}
                            </button>
                        )}
                    </>
                )}
            </motion.section>
        </div>
    );
};

export default UtilizationHistory;
