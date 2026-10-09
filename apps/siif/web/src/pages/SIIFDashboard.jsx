import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { TbChartBar, TbClipboardList } from 'react-icons/tb';
import { useModifiedSIIFUtilization } from '../hooks/useModifiedSIIFUtilization';
import { useSIIFPlan } from '../hooks/useSIIFPlan';
import SiifLoader from '../components/SiifLoader';
import { ALL_QUARTERS, buildDashboard, formsCompletionOf } from '../components/dashboard/dashboardData';
import UtilizationOverview from '../components/dashboard/UtilizationOverview';
import PlanOverview from '../components/dashboard/PlanOverview';

// ─── School SIIF Dashboard ────────────────────────────────────────────────────
// Two separate views under one header:
//   SIIF Plan   — the optional plan from the Forms tab (siif_submissions), the default view
//   Utilization — actual spending (modified_siif_utilization)
// The active view is kept in the URL (?view=utilization) so a refresh keeps it.

const VIEWS = [
    { id: 'plan', label: 'SIIF Plan', hint: 'Optional', icon: TbClipboardList },
    { id: 'utilization', label: 'Utilization', hint: 'Actual spending', icon: TbChartBar },
];

const SIIFDashboard = ({ user, token }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const view = searchParams.get('view') === 'utilization' ? 'utilization' : 'plan';
    const setView = (id) => setSearchParams(id === 'utilization' ? { view: 'utilization' } : {}, { replace: true });

    const [scope, setScope] = useState(ALL_QUARTERS);
    const { loading, selectedInterventions, utilizationData, officialAllocation, lastSavedAt } =
        useModifiedSIIFUtilization(user, token);
    const { loading: planLoading, allocation, submission } = useSIIFPlan(user, token);

    const dash = useMemo(
        () => buildDashboard(selectedInterventions, utilizationData, scope),
        [selectedInterventions, utilizationData, scope]
    );

    if (loading || planLoading) {
        return <SiifLoader text="Loading SIIF Dashboard..." />;
    }

    const totalAllocated = parseFloat(officialAllocation?.allocation_amount) || 0;
    const fiscalYear = officialAllocation?.fiscal_year || new Date().getFullYear();
    const rate = totalAllocated > 0 ? (dash.scopeUtilized / totalAllocated) * 100 : 0;
    const formsCompletionPct = formsCompletionOf(submission);

    return (
        <main className="siif-dashboard-page w-full pt-3 pb-16 font-sans sm:pt-4 lg:pt-6 print:m-0 print:bg-white print:p-0">

            {/* ── Topbar ── */}
            <header className="topbar mb-5 print:hidden">
                <div className="page-title">
                    <p className="eyebrow">
                        DEPARTMENT OF EDUCATION | HUMAN RESOURCE AND ORGANIZATIONAL DEVELOPMENT AND INFRASTRUCTURE
                    </p>
                    <h1>{user?.school_name || 'School Innovation and Improvement Fund'}</h1>
                    <p className="mt-1 text-xs font-bold uppercase tracking-wider text-sky-200/90">
                        SIIF Dashboard · FY {fiscalYear}
                    </p>
                </div>

                {/* Context pill follows the active view; compact on phones */}
                <div className="siif-topbar-actions shrink-0">
                    <div className="flex flex-col items-end gap-1 rounded-xl border border-slate-100 bg-white/95 px-2.5 py-1.5 shadow-md sm:min-w-[180px] sm:rounded-2xl sm:px-4 sm:py-2.5">
                        {view === 'utilization' ? (
                            <>
                                <span className="text-[8px] font-black uppercase tracking-wider text-slate-500 sm:text-[9px]">
                                    <span className="hidden sm:inline">Fund </span>Utilization<span className="hidden sm:inline"> Rate</span>
                                </span>
                                <span className="text-base font-black leading-none text-[#08315F] sm:text-lg">{rate.toFixed(1)}%</span>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 sm:w-32">
                                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.min(100, rate)}%` }} />
                                </div>
                            </>
                        ) : (
                            <>
                                <span className="text-[8px] font-black uppercase tracking-wider text-slate-500 sm:text-[9px]">Forms Completion</span>
                                <span className="text-base font-black leading-none text-[#08315F] sm:text-lg">{formsCompletionPct}%</span>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 sm:w-32">
                                    <div className="h-full rounded-full bg-[#0284C7] transition-all duration-500" style={{ width: `${formsCompletionPct}%` }} />
                                </div>
                                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                    {submission ? `Plan ${String(submission.status || 'draft').toLowerCase()}` : 'No plan yet'}
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {/* ── View switcher ── */}
            <div role="tablist" aria-label="Dashboard view" className="mb-6 flex w-full gap-1 rounded-2xl border border-slate-200/80 bg-white p-1 shadow-sm sm:w-fit dark:border-slate-800 dark:bg-slate-900 print:hidden">
                {VIEWS.map(v => {
                    const on = v.id === view;
                    const Icon = v.icon;
                    return (
                        <button
                            key={v.id}
                            type="button"
                            role="tab"
                            aria-selected={on}
                            aria-controls="siif-dash-view"
                            onClick={() => setView(v.id)}
                            className={`relative flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-transparent px-4 py-2.5 text-sm font-black outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#FBBF24] sm:flex-none sm:px-5 ${on ? 'text-white' : 'text-slate-500 hover:text-[#08315F] dark:text-slate-400 dark:hover:text-white'}`}
                        >
                            {on && (
                                <motion.span
                                    layoutId="siif-dash-view-pill"
                                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                                    className="absolute inset-0 rounded-xl bg-[#08315F] shadow-md"
                                    aria-hidden="true"
                                />
                            )}
                            <Icon size={17} className="relative z-10" />
                            <span className="relative z-10">{v.label}</span>
                            <span className={`relative z-10 hidden text-[10px] font-bold uppercase tracking-wider sm:inline ${on ? 'text-sky-200' : 'text-slate-400'}`}>
                                {v.hint}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div id="siif-dash-view" role="tabpanel">
                {view === 'utilization' ? (
                    <UtilizationOverview
                        dash={dash}
                        scope={scope}
                        onScopeChange={setScope}
                        totalAllocated={totalAllocated}
                        fiscalYear={fiscalYear}
                        lastSavedAt={lastSavedAt}
                    />
                ) : (
                    <PlanOverview
                        user={user}
                        allocation={allocation}
                        submission={submission}
                    />
                )}
            </div>
        </main>
    );
};

export default SIIFDashboard;
