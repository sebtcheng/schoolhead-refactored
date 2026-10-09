import React from 'react';
import { useNavigate } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { TbArrowRight, TbClipboardList, TbAlertTriangle } from 'react-icons/tb';
import { formatPeso, formatSavedAt } from '../utilization/utilizationUi';
import { ALL_QUARTERS, DASH_QUARTERS } from './dashboardData';
import InterventionSpending from './InterventionSpending';
import QuarterlyDisbursementChart from './QuarterlyDisbursementChart';

// ─── SIIF Utilization Overview ───────────────────────────────────────────────
// School-scoped version of the RO/SDO SIIF monitoring home: same KPIs, charts and
// status rules, built only from this school's modified_siif_utilization record.

const KpiCard = ({ accent, value, valueClass, label, caption, children }) => (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: accent }} aria-hidden="true" />
        <div className={`truncate text-xl font-black tabular-nums sm:text-2xl ${valueClass}`}>{value}</div>
        <div className="mt-1 text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">{label}</div>
        <div className="mt-0.5 text-[11px] font-medium text-slate-400">{caption}</div>
        {children}
    </div>
);

/**
 * @param {object}   dash              from buildDashboard
 * @param {string}   scope             ALL_QUARTERS or a quarter id
 * @param {function} onScopeChange
 * @param {number}   totalAllocated
 * @param {number}   fiscalYear
 * @param {string}   lastSavedAt
 */
const UtilizationOverview = ({ dash, scope, onScopeChange, totalAllocated, fiscalYear, lastSavedAt }) => {
    const navigate = useNavigate();

    const remaining = Math.max(0, totalAllocated - dash.allUtilized);
    const isOver = totalAllocated > 0 && dash.allUtilized > totalAllocated;
    const rate = totalAllocated > 0 ? (dash.scopeUtilized / totalAllocated) * 100 : 0;
    const scopeLabel = scope === ALL_QUARTERS ? 'All quarters' : DASH_QUARTERS.find(q => q.id === scope).label;
    const savedLabel = formatSavedAt(lastSavedAt);
    const hasInterventions = dash.interventions.length > 0;

    const scopeOptions = [
        { id: ALL_QUARTERS, short: 'All Quarters', amount: dash.allUtilized, color: '#38BDF8' },
        ...dash.quarterTotals,
    ];

    return (
        <>
            {/* ── Quarter bar: 2×2 grid on phones; one row that sticks while scrolling from md up ── */}
            <section aria-label="Quarter filter" className="z-30 mb-6 print:hidden md:sticky md:top-3">
                <div className="flex flex-col gap-2 rounded-3xl border border-white/10 bg-gradient-to-r from-[#08315F] via-[#0A3A70] to-[#075985] p-2 shadow-xl shadow-[#08315F]/25 backdrop-blur-md lg:flex-row lg:items-center lg:justify-between">
                    <div
                        role="tablist"
                        aria-label="Quarter"
                        className="grid grid-cols-2 gap-1 sm:flex sm:snap-x sm:overflow-x-auto sm:[scrollbar-width:none] lg:flex-1 sm:[&::-webkit-scrollbar]:hidden"
                    >
                        {scopeOptions.map(opt => {
                            const on = opt.id === scope;
                            const share = totalAllocated > 0 ? Math.min(100, (opt.amount / totalAllocated) * 100) : 0;
                            return (
                                <button
                                    key={opt.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={on}
                                    aria-controls="siif-dash-panels"
                                    onClick={() => onScopeChange(opt.id)}
                                    className={`relative min-w-0 flex-1 snap-start cursor-pointer rounded-2xl border-0 bg-transparent px-3 py-2.5 sm:min-w-[132px] sm:px-3.5 text-left outline-none transition-[background-color,transform] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[#FBBF24] lg:max-w-[210px] ${on ? '' : 'hover:bg-white/10'}`}
                                >
                                    {on && (
                                        <motion.span
                                            layoutId="siif-dash-scope-pill"
                                            transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                                            className="absolute inset-0 rounded-2xl bg-[#FBBF24] shadow-lg shadow-amber-500/30"
                                            aria-hidden="true"
                                        />
                                    )}
                                    <span className="relative z-10 flex items-center gap-1.5">
                                        <span
                                            className={`h-2 w-2 rounded-full ${on ? 'ring-2 ring-[#08315F]/20' : ''}`}
                                            style={{ background: opt.color }}
                                        />
                                        <span className={`truncate text-[10px] font-black uppercase tracking-wider sm:text-[11px] ${on ? 'text-[#08315F]' : 'text-sky-100/75'}`}>
                                            {opt.short}
                                        </span>
                                    </span>
                                    <span className={`relative z-10 mt-0.5 block font-mono text-sm font-black tabular-nums ${on ? 'text-[#08315F]' : 'text-white'}`}>
                                        {formatPeso(opt.amount, { decimals: 0 })}
                                    </span>
                                    <span
                                        className={`relative z-10 mt-1.5 block h-1 w-full overflow-hidden rounded-full ${on ? 'bg-[#08315F]/15' : 'bg-white/10'}`}
                                        title={`${share.toFixed(1)}% of allocation`}
                                    >
                                        <span
                                            className="block h-full rounded-full transition-[width] duration-700 ease-out"
                                            style={{ width: `${share}%`, background: on ? '#08315F' : opt.color }}
                                        />
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-center justify-between gap-3 px-2 pb-1 lg:justify-end lg:pb-0 lg:pr-1">
                        <span className="text-[11px] font-bold text-sky-100/70">
                            {savedLabel ? `Last updated ${savedLabel}` : 'No utilization saved yet'}
                        </span>
                        <button
                            type="button"
                            onClick={() => navigate('/siif/utilization')}
                            className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border-0 bg-white/95 px-4 py-2.5 text-xs font-black text-[#08315F] shadow-md transition-all hover:-translate-y-0.5 hover:bg-[#FBBF24] focus-visible:ring-2 focus-visible:ring-[#FBBF24]"
                        >
                            <TbClipboardList size={16} /> Update Utilization <TbArrowRight size={14} />
                        </button>
                    </div>
                </div>
            </section>

            <div id="siif-dash-panels" className="space-y-6">
                {/* ── KPI cards ── */}
                <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <KpiCard
                        accent="#8B5CF6"
                        value={formatPeso(totalAllocated)}
                        valueClass="text-purple-600 dark:text-purple-400"
                        label="SIIF Allocation"
                        caption={`Fiscal Year ${fiscalYear}`}
                    />
                    <KpiCard
                        accent="#0284C7"
                        value={formatPeso(dash.scopeUtilized)}
                        valueClass="text-sky-600 dark:text-sky-400"
                        label="Total Utilized"
                        caption={`${scopeLabel} · ${dash.withSpending} of ${dash.interventions.length} interventions with spending`}
                    />
                    <KpiCard
                        accent={isOver ? '#E11D48' : '#10B981'}
                        value={isOver ? `−${formatPeso(dash.allUtilized - totalAllocated)}` : formatPeso(remaining)}
                        valueClass={isOver ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}
                        label={isOver ? 'Over Allocation' : 'Remaining Balance'}
                        caption={
                            isOver
                                ? 'Spending exceeds the allocation'
                                : `${totalAllocated > 0 ? ((remaining / totalAllocated) * 100).toFixed(1) : 0}% left after all quarters`
                        }
                    />
                    <KpiCard
                        accent="#F59E0B"
                        value={`${rate.toFixed(1)}%`}
                        valueClass="text-amber-600 dark:text-amber-400"
                        label="Utilization Rate"
                        caption={`${scopeLabel} spending ÷ allocation`}
                    >
                        <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner dark:bg-slate-800">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-500 transition-all duration-700"
                                style={{ width: `${Math.min(100, rate)}%` }}
                            />
                        </div>
                    </KpiCard>
                </section>

                {!hasInterventions ? (
                    <section className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900">
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
                            <TbAlertTriangle size={22} />
                        </span>
                        <h2 className="text-base font-black text-[#08315F] dark:text-white">No interventions tracked yet</h2>
                        <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
                            Choose your interventions and enter quarterly spending in the Utilization page. Your charts will appear here once you save.
                        </p>
                        <button
                            type="button"
                            onClick={() => navigate('/siif/utilization')}
                            className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-xl border-0 bg-[#08315F] px-4 py-2.5 text-xs font-black text-white shadow-md transition-all hover:bg-[#0B3F7A]"
                        >
                            Go to Utilization <TbArrowRight size={14} />
                        </button>
                    </section>
                ) : (
                    <>
                        {/* ── Spending ── */}
                        <InterventionSpending
                            interventions={dash.interventions}
                            scope={scope}
                            scopeLabel={scopeLabel}
                            scopeUtilized={dash.scopeUtilized}
                        />

                        {/* ── Quarterly disbursement ── */}
                        <QuarterlyDisbursementChart
                            interventions={dash.interventions}
                            rankOrder={dash.rankOrder}
                            scope={scope}
                            scopeLabel={scopeLabel}
                        />
                    </>
                )}
            </div>
        </>
    );
};

export default UtilizationOverview;
