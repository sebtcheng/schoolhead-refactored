import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { TbArrowRight, TbClipboardList, TbAlertTriangle } from 'react-icons/tb';
import { useModifiedSIIFUtilization } from '../hooks/useModifiedSIIFUtilization';
import SiifLoader from '../components/SiifLoader';
import { formatPeso, formatSavedAt } from '../components/utilization/utilizationUi';
import { ALL_QUARTERS, DASH_QUARTERS, buildDashboard } from '../components/dashboard/dashboardData';
import { StatusPill } from '../components/dashboard/DashboardParts';
import InterventionSpending from '../components/dashboard/InterventionSpending';
import StatusDonut from '../components/dashboard/StatusDonut';
import QuarterlyDisbursementChart from '../components/dashboard/QuarterlyDisbursementChart';

// ─── School SIIF Dashboard ────────────────────────────────────────────────────
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

const SIIFDashboard = ({ user, token }) => {
    const navigate = useNavigate();
    const [scope, setScope] = useState(ALL_QUARTERS);

    const {
        loading,
        selectedInterventions,
        utilizationData,
        officialAllocation,
        lastSavedAt,
    } = useModifiedSIIFUtilization(user, token);

    const dash = useMemo(
        () => buildDashboard(selectedInterventions, utilizationData, scope),
        [selectedInterventions, utilizationData, scope]
    );

    if (loading) {
        return <SiifLoader text="Loading SIIF Dashboard..." />;
    }

    const totalAllocated = parseFloat(officialAllocation?.allocation_amount) || 0;
    const fiscalYear = officialAllocation?.fiscal_year || new Date().getFullYear();
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
        <main className="siif-dashboard-page w-full pt-3 pb-16 sm:pt-4 lg:pt-6">

            {/* ── Topbar ── */}
            <header className="topbar mb-6">
                <div className="page-title">
                    <p className="eyebrow">
                        DEPARTMENT OF EDUCATION | HUMAN RESOURCE AND ORGANIZATIONAL DEVELOPMENT AND INFRASTRUCTURE
                    </p>
                    <h1>{user?.school_name || 'School Innovation and Improvement Fund'}</h1>
                    <p className="mt-1 text-xs font-bold uppercase tracking-wider text-sky-200/90">
                        SIIF Utilization Dashboard · FY {fiscalYear}
                    </p>
                </div>

                {/* Wrapper does the hiding: siif.css forces .siif-topbar-actions to display:flex,
                    which beats Tailwind's `hidden`. Phones get the rate from the KPI card instead. */}
                <div className="hidden sm:block">
                    <div className="siif-topbar-actions">
                        <div className="flex min-w-[180px] flex-col items-end gap-1 rounded-2xl border border-slate-100 bg-white/95 px-4 py-2.5 shadow-md">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Fund Utilization Rate</span>
                            <span className="text-lg font-black leading-none text-[#08315F]">{rate.toFixed(1)}%</span>
                            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
                                <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.min(100, rate)}%` }} />
                            </div>
                            <StatusPill status={dash.schoolStatus} />
                        </div>
                    </div>
                </div>
            </header>

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
                                    onClick={() => setScope(opt.id)}
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
                        {/* ── Spending + status ── */}
                        <section className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
                            <div className="lg:col-span-8">
                                <InterventionSpending
                                    interventions={dash.interventions}
                                    scope={scope}
                                    scopeLabel={scopeLabel}
                                    scopeUtilized={dash.scopeUtilized}
                                />
                            </div>
                            <div className="lg:col-span-4">
                                <StatusDonut counts={dash.statusCounts} scopeLabel={scopeLabel} />
                            </div>
                        </section>

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
        </main>
    );
};

export default SIIFDashboard;
