import React, { useMemo, useState } from 'react';
import { TbListDetails } from 'react-icons/tb';
import { formatPeso } from '../utilization/utilizationUi';
import { ALL_QUARTERS, DASH_QUARTERS, STATUS_KEYS } from './dashboardData';
import { DashCard, StatusPill } from './DashboardParts';

/**
 * The school's declared interventions for one quarter: status, amount and remarks
 * (same layout as the RO/SDO QuarterUtilizationPanel). Follows the top quarter filter.
 */
const QuarterDetailsPanel = ({ interventions, scope }) => {
    const byQuarter = useMemo(() => DASH_QUARTERS.map(q => {
        const rows = interventions
            .map(iv => ({ ...iv.quarters.find(x => x.id === q.id), id: iv.id, title: iv.label, color: iv.color }))
            .sort((a, b) => b.amount - a.amount || a.title.localeCompare(b.title));
        const counts = Object.fromEntries(STATUS_KEYS.map(k => [k, 0]));
        rows.forEach(r => { counts[r.status] += 1; });
        return { ...q, rows, counts, total: rows.reduce((sum, r) => sum + r.amount, 0) };
    }), [interventions]);

    // A tab the user picks sticks until the top quarter filter changes
    const [picked, setPicked] = useState(null); // { id, scope }
    const active = picked?.scope === scope
        ? picked.id
        : (scope !== ALL_QUARTERS ? scope : DASH_QUARTERS[0].id);

    const current = byQuarter.find(q => q.id === active) || byQuarter[0];

    return (
        <DashCard
            icon={<TbListDetails />}
            title="Declared Interventions by Quarter"
            subtitle="Status, amount and remarks you entered in the Utilization page"
            actions={
                <div role="tablist" aria-label="Quarter" className="inline-flex gap-1 self-start rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                    {byQuarter.map(q => {
                        const on = q.id === active;
                        return (
                            <button
                                key={q.id}
                                type="button"
                                role="tab"
                                aria-selected={on}
                                onClick={() => setPicked({ id: q.id, scope })}
                                className={`cursor-pointer rounded-lg border-0 px-3 py-1.5 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-sky-300 ${on ? 'bg-white shadow-sm dark:bg-slate-900' : 'bg-transparent hover:bg-white/60 dark:hover:bg-slate-700/60'}`}
                            >
                                <span className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full" style={{ background: q.color }} />
                                    <span className={`text-[11px] font-black ${on ? 'text-[#08315F] dark:text-white' : 'text-slate-500'}`}>{q.short}</span>
                                </span>
                                <span className={`block font-mono text-[10px] font-bold tabular-nums ${on ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400'}`}>
                                    {formatPeso(q.total, { decimals: 0 })}
                                </span>
                            </button>
                        );
                    })}
                </div>
            }
        >
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-700">
                <div className="hidden grid-cols-[minmax(180px,1.2fr)_140px_120px_minmax(160px,2fr)] gap-4 bg-slate-50 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:bg-slate-800 md:grid">
                    <span>Intervention</span>
                    <span>Status</span>
                    <span className="text-right">Amount</span>
                    <span>Remarks / Justification</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {current.rows.map(r => (
                        <div key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 px-4 py-2.5 text-xs md:grid-cols-[minmax(180px,1.2fr)_140px_120px_minmax(160px,2fr)]">
                            <span className="flex min-w-0 items-center gap-2 font-bold text-slate-900 dark:text-white">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: r.color }} />
                                <span className="truncate">{r.title}</span>
                            </span>
                            <span className="order-3 md:order-none"><StatusPill status={r.status} /></span>
                            <span className="text-right font-mono font-black tabular-nums text-slate-900 dark:text-white">{formatPeso(r.amount)}</span>
                            <span className="order-4 col-span-2 truncate text-[11px] text-slate-500 dark:text-slate-400 md:order-none md:col-span-1" title={r.justification}>
                                {r.justification || <span className="text-slate-300 dark:text-slate-600">—</span>}
                            </span>
                        </div>
                    ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-2 text-[11px] font-bold dark:border-slate-700/60 dark:bg-slate-800/80">
                    <span className="text-slate-500">
                        {STATUS_KEYS.filter(k => current.counts[k] > 0).map(k => `${current.counts[k]} ${k}`).join(' · ')}
                    </span>
                    <span className="text-slate-700 dark:text-slate-200">
                        {current.label} total: <span className="font-mono font-black">{formatPeso(current.total)}</span>
                    </span>
                </div>
            </div>
        </DashCard>
    );
};

export default QuarterDetailsPanel;
