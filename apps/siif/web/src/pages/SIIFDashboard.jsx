import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { TbArrowRight, TbClipboardList, TbAlertTriangle } from 'react-icons/tb';
import { FiGrid, FiLogOut } from 'react-icons/fi';
import { useAuth } from '../../../../school-head/web/src/context/AuthContext';
import { useModifiedSIIFUtilization } from '../hooks/useModifiedSIIFUtilization';
import SiifLoader from '../components/SiifLoader';
import { formatPeso, formatSavedAt } from '../components/utilization/utilizationUi';
import { ALL_QUARTERS, DASH_QUARTERS, buildDashboard } from '../components/dashboard/dashboardData';
import { StatusPill } from '../components/dashboard/DashboardParts';
import InterventionSpending from '../components/dashboard/InterventionSpending';
import StatusDonut from '../components/dashboard/StatusDonut';
import QuarterlyDisbursementChart from '../components/dashboard/QuarterlyDisbursementChart';
import QuarterDetailsPanel from '../components/dashboard/QuarterDetailsPanel';

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
    const { confirmLogout } = useAuth();
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
        { id: ALL_QUARTERS, short: 'All Quarters', amount: dash.allUtilized, color: '#08315F' },
        ...dash.quarterTotals,
    ];

    return (
        <main className="w-full pt-3 pb-16 sm:pt-4 lg:pt-6">

            {/* ── Navigation & Account Bar (same as the Utilization page) ── */}
            <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
                <button
                    type="button"
                    onClick={() => navigate('/nodes-dashboard')}
                    className="group inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition-all hover:shadow dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#10346B] text-white transition-transform group-hover:scale-105">
                        <FiGrid size={13} />
                    </span>
                    <span className="hidden sm:inline">Back to Nexus Portal</span>
                    <span className="sm:hidden">Back</span>
                </button>
                <button
                    type="button"
                    onClick={confirmLogout}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 shadow-sm transition-all hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                >
                    <FiLogOut size={14} />
                    <span>Sign Out</span>
                </button>
            </div>

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

                <div className="siif-topbar-actions hidden sm:flex">
                    <div className="flex min-w-[180px] flex-col items-end gap-1 rounded-2xl border border-slate-100 bg-white/95 px-4 py-2.5 shadow-md">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Fund Utilization Rate</span>
                        <span className="text-lg font-black leading-none text-[#08315F]">{rate.toFixed(1)}%</span>
                        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.min(100, rate)}%` }} />
                        </div>
                        <StatusPill status={dash.schoolStatus} />
                    </div>
                </div>
            </header>

            <div className="space-y-6">
                {/* ── Quarter filter + actions ── */}
                <section className="flex flex-col gap-3 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
                    <div role="tablist" aria-label="Quarter" className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800 sm:grid-cols-4">
                        {scopeOptions.map(opt => {
                            const on = opt.id === scope;
                            return (
                                <button
                                    key={opt.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={on}
                                    onClick={() => setScope(opt.id)}
                                    className={`relative cursor-pointer rounded-xl border-0 bg-transparent px-3 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sky-300 ${on ? '' : 'hover:bg-white/60 dark:hover:bg-slate-700/60'}`}
                                >
                                    {on && (
                                        <motion.span
                                            layoutId="siif-dash-scope-pill"
                                            transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                                            className="absolute inset-0 rounded-xl bg-white shadow-sm dark:bg-slate-900"
                                            aria-hidden="true"
                                        />
                                    )}
                                    <span className="relative z-10 flex items-center gap-1.5">
                                        <span className="h-2 w-2 rounded-full" style={{ background: opt.color }} />
                                        <span className={`text-xs font-black ${on ? 'text-[#08315F] dark:text-white' : 'text-slate-500'}`}>{opt.short}</span>
                                    </span>
                                    <span className={`relative z-10 block font-mono text-[11px] font-bold tabular-nums ${on ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400'}`}>
                                        {formatPeso(opt.amount, { decimals: 0 })}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-center justify-between gap-3 lg:justify-end">
                        <span className="text-[11px] font-bold text-slate-400">
                            {savedLabel ? `Last updated ${savedLabel}` : 'No utilization saved yet'}
                        </span>
                        <button
                            type="button"
                            onClick={() => navigate('/siif/utilization')}
                            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border-0 bg-[#08315F] px-4 py-2.5 text-xs font-black text-white shadow-md shadow-[#08315F]/20 transition-all hover:-translate-y-0.5 hover:bg-[#0B3F7A] focus-visible:ring-2 focus-visible:ring-sky-300"
                        >
                            <TbClipboardList size={16} /> Update Utilization <TbArrowRight size={14} />
                        </button>
                    </div>
                </section>

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

                        {/* ── Details by quarter ── */}
                        <QuarterDetailsPanel interventions={dash.interventions} scope={scope} />
                    </>
                )}
            </div>
        </main>
    );
};

export default SIIFDashboard;
