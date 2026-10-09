import React from 'react';
import { TbChartBar, TbTarget } from 'react-icons/tb';
import { INTERVENTION_ICONS } from '../../constants/siifConstants';
import { formatPeso } from '../utilization/utilizationUi';
import { quarterIdsFor } from './dashboardData';
import { DashCard } from './DashboardParts';

/** Ranked list of the school's interventions by amount spent in the selected quarter(s). */
const InterventionSpending = ({ interventions, scope, scopeLabel, scopeUtilized }) => {
    const max = Math.max(...interventions.map(iv => iv.total), 0);
    const inScope = new Set(quarterIdsFor(scope));

    return (
        <DashCard
            icon={<TbChartBar />}
            title="Intervention Spending"
            subtitle={`${scopeLabel} · ${interventions.length} intervention${interventions.length === 1 ? '' : 's'} tracked`}
            className="h-full"
        >
            <ul className="flex flex-col gap-2.5">
                {interventions.map(iv => {
                    const share = scopeUtilized > 0 ? (iv.total / scopeUtilized) * 100 : 0;
                    const width = max > 0 ? (iv.total / max) * 100 : 0;
                    return (
                        <li key={iv.id} className="rounded-2xl border border-slate-100 p-3 transition-colors hover:border-slate-200 hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40">
                            <div className="flex items-center gap-3">
                                <span
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm [&>svg]:h-[17px] [&>svg]:w-[17px]"
                                    style={{ background: iv.color }}
                                    aria-hidden="true"
                                >
                                    {INTERVENTION_ICONS[iv.id] || <TbTarget />}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="truncate text-sm font-extrabold text-slate-900 dark:text-white" title={iv.label}>{iv.label}</span>
                                        <span className="shrink-0 font-mono text-sm font-black tabular-nums text-slate-900 dark:text-white">{formatPeso(iv.total)}</span>
                                    </div>
                                    <div className="mt-1 flex items-center gap-2">
                                        <span className="text-[11px] font-bold tabular-nums text-slate-400">{share.toFixed(1)}% of spending</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${width}%`, background: iv.color }} />
                            </div>

                            {/* Per-quarter split */}
                            <div className="mt-2 grid grid-cols-3 gap-1.5">
                                {iv.quarters.map(q => (
                                    <div
                                        key={q.id}
                                        className={`rounded-lg px-2 py-1 text-[10px] font-bold transition-opacity ${inScope.has(q.id) ? 'bg-slate-50 dark:bg-slate-800/60' : 'opacity-40'}`}
                                        title={`${q.label}: ${formatPeso(q.amount)}`}
                                    >
                                        <span className="flex items-center gap-1 text-slate-400">
                                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: q.color }} /> {q.short}
                                        </span>
                                        <span className="block font-mono tabular-nums text-slate-700 dark:text-slate-200">{formatPeso(q.amount, { decimals: 0 })}</span>
                                    </div>
                                ))}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </DashCard>
    );
};

export default InterventionSpending;
