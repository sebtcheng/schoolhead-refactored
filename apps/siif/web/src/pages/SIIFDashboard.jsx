import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    TbHistory, TbChevronRight, TbArrowLeft, TbWallet, TbBulb, TbChecklist, TbUsers, TbCheck, TbX, TbPrinter, TbCircleCheck, TbClock
} from 'react-icons/tb';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { logger } from '../utils/logger';
import { INTERVENTIONS, INTERVENTION_ICONS, GRADE_LABELS, KEY_STAGES } from '../constants/siifConstants';
import { fetchAllocation, fetchSubmission } from '../services/siifService';
import SiifLoader from '../components/SiifLoader';

const SIIFDashboard = ({ user, token }) => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [selectedModalIntervention, setSelectedModalIntervention] = useState(null);


    const [allocation, setAllocation] = useState({
        allocation_amount: '0.00',
        spent_amount: '0.00',
        remaining_balance: '0.00',
        fiscal_year: new Date().getFullYear(),
        school_name: ''
    });
    const [submission, setSubmission] = useState(null);

    const formatCurrency = (value) =>
        new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(parseFloat(value) || 0);

    useEffect(() => {
        if (!user?.school_id) {
            logger.warn('SIIF', 'No school_id found in user context. Skipping fetch.');
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLoading(false);
            return;
        }

        Promise.all([
            fetchAllocation(user.school_id, token),
            fetchSubmission(user.school_id, token),
        ])
            .then(([allocData, subData]) => {
                setAllocation(allocData);
                if (subData && subData.success) {
                    setSubmission(subData);
                }
            })
            .catch(err => {
                logger.error('SIIF', 'Fetch Fatal Error', err);
            })
            .finally(() => {
                setLoading(false);
            });
    }, [user, token]);

    // Calculate Summary Totals
    const innovationsCount = submission?.interventions?.length || 0;
    const totalBudgetEstimate = useMemo(() => {
        if (submission?.totalBudget !== undefined && parseFloat(submission.totalBudget) > 0) {
            return parseFloat(submission.totalBudget);
        }
        if (submission?.budgetEstimates) {
            return Object.values(submission.budgetEstimates).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
        }
        return 0;
    }, [submission]);

    let totalBeneficiaries = 0;
    if (submission?.interventionData) {
        Object.values(submission.interventionData).forEach(int => {
            if (int.beneficiaryCounts) {
                Object.values(int.beneficiaryCounts).forEach(count => {
                    totalBeneficiaries += (parseInt(count) || 0);
                });
            }
        });
    }



    // Donut chart logic for Action Queue
    const chartData = useMemo(() => {
        if (!submission?.interventions || submission.interventions.length === 0) return [];

        // Sort interventions by budget descending
        const sorted = [...submission.interventions].sort((a, b) => (submission.budgetEstimates?.[b] || 0) - (submission.budgetEstimates?.[a] || 0));

        let currentOffset = 0;
        const colors = ['#10b981', '#f59e0b', '#0ea5e9', '#ec4899', '#8b5cf6', '#FCD116', '#CE1126', '#10346B', '#f43f5e', '#14b8a6', '#84cc16'];

        return sorted.map((intId, idx) => {
            const budget = submission.budgetEstimates?.[intId] || 0;
            const percentage = totalBudgetEstimate > 0 ? (budget / totalBudgetEstimate) * 100 : 0;
            const dashArray = `${percentage} ${100 - percentage}`;
            const offset = -currentOffset;
            currentOffset += percentage;

            return {
                id: intId,
                label: INTERVENTIONS.find(i => i.id === intId)?.label || intId,
                budget,
                percentage,
                color: colors[idx % colors.length],
                strokeDasharray: dashArray,
                strokeDashoffset: offset,
            };
        });
    }, [submission, totalBudgetEstimate]);

    const estimatedPercent = allocation.allocation_amount > 0
        ? Math.min(100, Math.max(0, Math.round((parseFloat(totalBudgetEstimate) / parseFloat(allocation.allocation_amount)) * 100)))
        : 0;

    const completedPhases = useMemo(() => {
        let count = 0;
        if (submission?.priorityAreas?.length > 0) count++; // PIA
        if (submission?.interventions?.length > 0) count++; // Interventions
        if (totalBeneficiaries > 0) count++; // Beneficiaries
        if (totalBudgetEstimate > 0) count++; // Budget

        let hasAct = false;
        if (submission?.interventionData) {
            hasAct = Object.values(submission.interventionData).some(int => {
                const acts = Object.values(int.selectedActivities || {}).flat().filter(Boolean);
                return acts.length > 0 || (int.otherActivity && int.otherActivity.trim().length > 0);
            });
        }
        if (hasAct) count++; // Activities
        return Math.min(count, 5);
    }, [submission, totalBeneficiaries, totalBudgetEstimate]);

    // Flagged Items Computation
    const flaggedCount = useMemo(() => {
        if (!submission?.interventions || submission.interventions.length === 0) return 0;
        let flags = 0;
        submission.interventions.forEach(intId => {
            const budget = parseFloat(submission.budgetEstimates?.[intId]) || 0;
            const intData = submission.interventionData?.[intId] || {};

            // Check Beneficiaries
            const beneficiariesCount = Object.values(intData.beneficiaryCounts || {}).reduce((s, v) => s + (parseInt(v) || 0), 0);

            // Check Activities
            const selectedActivities = intData.selectedActivities || {};
            const activitiesCount = Object.values(selectedActivities).flat().filter(Boolean).length;
            const otherAct = intData.otherActivity || '';
            const hasActivity = activitiesCount > 0 || otherAct.trim().length > 0;

            if (budget <= 0 || beneficiariesCount <= 0 || !hasActivity) {
                flags += 1;
            }
        });
        return flags;
    }, [submission]);

    if (loading) {
        return <SiifLoader text="Loading SIIF Dashboard..." />;
    }

    return (
        <div className="font-sans text-lg print:bg-white print:m-0 print:p-0 pb-32">



            <main className="w-full pt-3 sm:pt-4 lg:pt-8 pb-7 print:hidden">
                <header className="topbar print:hidden">
                    <div className="page-title">
                        <p className="eyebrow">
                            DEPARTMENT OF EDUCATION | HUMAN RESOURCE AND ORGANIZATIONAL DEVELOPMENT AND INFRASTRUCTURE
                        </p>
                        <h1>School Innovation and Improvement Fund</h1>
                    </div>

                    <div className="siif-topbar-actions shrink-0">
                        <section className="siif-school-pill">
                            <small style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--slate-500)', letterSpacing: '0.05em', lineHeight: 1.2, textAlign: 'center', display: 'block' }}>Forms Completion</small>
                            <strong style={{ fontSize: '22px', background: 'linear-gradient(to right, var(--navy), var(--blue))', WebkitBackgroundClip: 'text', color: 'transparent', margin: '3px 0', lineHeight: 1, fontWeight: 900, display: 'block' }}>
                                {Math.round((completedPhases / 5) * 100)}%
                            </strong>
                            <div style={{ width: '80%', height: '5px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', margin: '2px auto 0' }}>
                                <div style={{ width: `${(completedPhases / 5) * 100}%`, height: '100%', background: 'var(--blue)', transition: 'width 0.3s ease' }} />
                            </div>
                        </section>
                    </div>
                </header>

                <section className="siif-grid mt-3 sm:mt-6">
                    {/* KPI Cards Row - Strictly 1 Row */}
                    <div className="siif-kpis grid grid-cols-4 gap-2 sm:gap-3">
                        <div className="siif-card kpi-card" style={{ padding: '10px 12px' }}>
                            <p className="siif-card-subtitle" style={{ fontSize: 'clamp(8px, 1.1vw, 11px)', textTransform: 'uppercase', fontWeight: 900, marginTop: 0, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Total Allocated Budget</p>
                            <h3 className="kpi-number" style={{ fontSize: 'clamp(11px, 1.8vw, 24px)', color: 'var(--navy)', margin: '4px 0 0', fontWeight: 900, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatCurrency(allocation.allocation_amount)}</h3>
                        </div>
                        <div className="siif-card kpi-card" style={{ padding: '10px 12px' }}>
                            <p className="siif-card-subtitle" style={{ fontSize: 'clamp(8px, 1.1vw, 11px)', textTransform: 'uppercase', fontWeight: 900, marginTop: 0, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Total Estimated Budget</p>
                            <h3 className="kpi-number" style={{ fontSize: 'clamp(11px, 1.8vw, 24px)', color: 'var(--blue-600)', margin: '4px 0 0', fontWeight: 900, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatCurrency(totalBudgetEstimate)}</h3>
                        </div>
                        <div className="siif-card kpi-card" style={{ padding: '10px 12px' }}>
                            <p className="siif-card-subtitle" style={{ fontSize: 'clamp(8px, 1.1vw, 11px)', textTransform: 'uppercase', fontWeight: 900, marginTop: 0, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Remaining Funds</p>
                            <h3 className="kpi-number" style={{ fontSize: 'clamp(11px, 1.8vw, 24px)', color: (allocation.allocation_amount - totalBudgetEstimate) < 0 ? 'var(--red)' : 'var(--green)', margin: '4px 0 0', fontWeight: 900, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatCurrency(allocation.allocation_amount - totalBudgetEstimate)}</h3>
                        </div>
                        <div className="siif-card kpi-card" style={{ padding: '10px 12px' }}>
                            <p className="siif-card-subtitle" style={{ fontSize: 'clamp(8px, 1.1vw, 11px)', textTransform: 'uppercase', fontWeight: 900, marginTop: 0, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Budget Utilized</p>
                            <h3 className="kpi-number" style={{ fontSize: 'clamp(11px, 1.8vw, 24px)', color: 'var(--purple)', margin: '4px 0 0', fontWeight: 900, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatCurrency(allocation.spent_amount)}</h3>
                        </div>
                    </div>

                    <article className="siif-card siif-progress-highlight">
                        <div className="siif-card-inner">
                            <div className="siif-card-header">
                                <div>
                                    <h2>School Allocation Overview</h2>
                                    <p className="siif-card-subtitle">Main resource snapshot for school allocation, estimated budget, and remaining balance.</p>
                                </div>
                                <span className="siif-fy-pill">FY {allocation.fiscal_year}</span>
                            </div>

                            <div className="siif-allocation-summary" style={{ paddingTop: '24px', paddingBottom: '20px' }}>
                                <div>
                                    <p className="siif-card-subtitle">Total school allocation</p>
                                    <h3 className="siif-big-number">{formatCurrency(allocation.allocation_amount)}</h3>
                                </div>
                                <div>
                                    <span className="siif-status ok">{estimatedPercent}% Estimated</span>
                                </div>
                            </div>

                            <div className="siif-progress-track">
                                <motion.div
                                    className="siif-progress-fill"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${estimatedPercent}%` }}
                                    transition={{ duration: 1.2, ease: 'easeOut' }}
                                >
                                    {estimatedPercent}%
                                </motion.div>
                            </div>

                            <div className="siif-legend-row">
                                <span><i className="siif-dot sky"></i>Estimated · {formatCurrency(totalBudgetEstimate)}</span>
                                <span><i className="siif-dot green"></i>Remaining · {formatCurrency(allocation.allocation_amount - totalBudgetEstimate)}</span>
                            </div>
                        </div>
                    </article>

                    <section className="siif-action-layout">
                        <article className="siif-card">
                            <div className="siif-card-inner">
                                <div className="siif-card-header">
                                    <div>
                                        <h2>Action Queue</h2>
                                        <p className="siif-card-subtitle">Track the submission of your school's proposed interventions, beneficiaries, activities, and estimated budget.</p>
                                    </div>

                                    <div className="siif-queue-summary flex items-center gap-2" aria-label="Queue summary">
                                        <span className="siif-summary-pill"><strong>{innovationsCount}</strong> active items</span>
                                    </div>
                                </div>

                                {/* Visually Appealing Status Banner */}
                                {submission?.status?.toLowerCase() === 'disapproved' && (
                                    <div className="mx-4 sm:mx-6 mb-4 p-4 rounded-xl border border-red-200 bg-gradient-to-r from-red-50 to-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                            <div className="w-10 h-10 bg-red-100 text-red-600 rounded-lg flex items-center justify-center shrink-0">
                                                <TbX size={20} />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="text-sm font-bold text-red-700 flex items-center gap-1.5 truncate">
                                                    Action Required: Disapproved
                                                </h4>
                                                <p className="text-xs text-red-600/80 mt-0.5 break-words whitespace-normal">
                                                    <strong>Remarks:</strong> {submission.remarks || 'Please revise your proposal.'}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => navigate('/siif/forms')}
                                            className="w-full sm:w-auto px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs shadow-sm transition-all text-center"
                                        >
                                            Revise Proposal
                                        </button>
                                    </div>
                                )}
                                {submission?.status?.toLowerCase() === 'reviewed' && (
                                    <div className="mx-4 sm:mx-6 mb-4 p-4 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center shrink-0">
                                                <TbCircleCheck size={20} />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="text-sm font-bold text-emerald-700 flex items-center gap-1.5 truncate">
                                                    Reviewed by SDO
                                                </h4>
                                                <p className="text-xs text-emerald-600/80 mt-0.5 break-words whitespace-normal">
                                                    <strong>Remarks:</strong> {submission.remarks || 'Ready for implementation.'}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => navigate('/siif/utilization')}
                                            className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-sm transition-all text-center"
                                        >
                                            Proceed to Utilization
                                        </button>
                                    </div>
                                )}
                                {submission?.status?.toLowerCase() === 'submitted' && (
                                    <div className="mx-4 sm:mx-6 mb-4 p-4 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                            <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center shrink-0">
                                                <TbClock size={20} />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="text-sm font-bold text-amber-700 flex items-center gap-1.5 truncate">
                                                    Pending Review
                                                </h4>
                                                <p className="text-xs text-amber-600/80 mt-0.5 break-words whitespace-normal">
                                                    Your submission is currently being reviewed by the Division Office.
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => navigate('/siif/forms')}
                                            className="w-full sm:w-auto px-4 py-2.5 bg-amber-100 text-amber-800 hover:bg-amber-200 rounded-lg font-bold text-xs shadow-sm transition-all border border-amber-200 text-center"
                                        >
                                            View Submission
                                        </button>
                                    </div>
                                )}

                                <div className="siif-queue-content">
                                    {/* Donut Chart SVG */}
                                    <div className="flex-shrink-0 w-[160px] sm:w-[190px] h-[160px] sm:h-[190px] relative mx-auto sm:mx-0 group">
                                        {chartData.length > 0 ? (
                                            <>
                                                {/* Outer decorative ring */}
                                                <div className="absolute inset-0 rounded-full border border-slate-50 scale-110 transition-transform duration-500 group-hover:scale-105 opacity-50" />
                                                <svg viewBox="-4 -4 44 44" className="w-full h-full -rotate-90 drop-shadow-lg">
                                                    {chartData.map((slice) => (
                                                        <circle
                                                            key={slice.id}
                                                            r="15.9155"
                                                            cx="18"
                                                            cy="18"
                                                            fill="transparent"
                                                            stroke={slice.color}
                                                            strokeWidth="6"
                                                            strokeDasharray={slice.strokeDasharray}
                                                            strokeDashoffset={slice.strokeDashoffset}
                                                            className="transition-all duration-1000 ease-out cursor-pointer hover:stroke-[8px] hover:opacity-90"
                                                            style={{
                                                                strokeDasharray: slice.strokeDasharray,
                                                                strokeDashoffset: slice.strokeDashoffset,
                                                            }}
                                                            onClick={() => setSelectedModalIntervention(slice.id)}
                                                        />
                                                    ))}
                                                </svg>
                                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-slate-50/90 backdrop-blur-[1px] m-[20px] rounded-full shadow-inner border border-slate-100">
                                                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 mb-0.5">Total Budget Estimate</span>
                                                    <strong className="text-xs sm:text-sm font-black text-slate-800 tracking-tight leading-none text-center px-1">
                                                        {formatCurrency(totalBudgetEstimate)}
                                                    </strong>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="w-full h-full rounded-full border-8 border-dashed border-slate-100 flex flex-col items-center justify-center bg-slate-50">
                                                <TbWallet className="text-slate-300 mb-2" size={32} />
                                                <span className="text-[11px] text-slate-400 font-bold uppercase tracking-widest px-4 text-center">No Data</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Modern List */}
                                    <div className="flex-1 w-full min-w-0 custom-scrollbar overflow-y-auto max-h-[260px] pr-1 space-y-2">
                                        {chartData.length > 0 ? (
                                            chartData.map(slice => {
                                                return (
                                                    <div
                                                        key={slice.id}
                                                        className="flex items-center justify-between p-2.5 sm:p-3 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-slate-200 hover:shadow-md transition-all duration-300 cursor-pointer group gap-3"
                                                        onClick={() => setSelectedModalIntervention(slice.id)}
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                            <div
                                                                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-white shadow-sm transition-transform duration-300 group-hover:scale-105 shrink-0"
                                                                style={{ backgroundColor: slice.color, backgroundImage: 'linear-gradient(to bottom right, rgba(255,255,255,0.2), rgba(0,0,0,0.1))' }}
                                                            >
                                                                <span className="font-black text-xs">{slice.label.charAt(0)}</span>
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <span className="font-bold text-[12px] sm:text-[13px] text-slate-700 block truncate leading-tight">{slice.label}</span>
                                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                                    <div className="h-1.5 w-12 sm:w-16 bg-slate-200 rounded-full overflow-hidden shrink-0">
                                                                        <div className="h-full rounded-full" style={{ width: `${slice.percentage}%`, backgroundColor: slice.color }} />
                                                                    </div>
                                                                    <span className="text-[10px] font-black text-slate-500 shrink-0">{slice.percentage.toFixed(1)}%</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <strong className="block text-[12px] sm:text-[13px] font-black text-slate-800 leading-tight">{formatCurrency(slice.budget)}</strong>
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-siif-blue transition-colors">Details →</span>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center py-10 text-slate-400">
                                                <TbChecklist size={48} className="mb-3 opacity-20" />
                                                <p className="text-xs font-bold italic">No interventions planned yet.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                            </div>
                        </article>

                        <aside className="siif-card">
                            <div className="siif-card-inner">
                                <div className="siif-card-header">
                                    <div>
                                        <h2>Quick Actions</h2>
                                        <p className="siif-card-subtitle">Direct shortcuts for common school-level tasks.</p>
                                    </div>
                                </div>

                                <div className="siif-quick-actions">
                                    <button className="siif-action-btn" onClick={() => navigate('/siif/forms')}>
                                        <div className="siif-action-icon">＋</div>
                                        <div className="text-left">
                                            <b>Plan Intervention</b>
                                            <span>Start or edit your school proposal</span>
                                        </div>
                                        <strong className="text-siif-blue">›</strong>
                                    </button>

                                    <button className={`siif-action-btn ${flaggedCount > 0 ? 'border-red-100 hover:border-red-200 bg-red-50/30' : ''}`} onClick={() => navigate('/siif/forms')}>
                                        <div className="siif-action-icon" style={flaggedCount > 0 ? { backgroundColor: '#fee2e2', color: '#dc2626' } : {}}>
                                            {flaggedCount > 0 ? '⚠️' : '✓'}
                                        </div>
                                        <div className="text-left flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <b className={flaggedCount > 0 ? "text-red-700" : ""}>Review Flagged Items</b>
                                                {flaggedCount > 0 && (
                                                    <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black shadow-sm shrink-0 flex items-center gap-1 animate-pulse">
                                                        {flaggedCount} Action{flaggedCount !== 1 ? 's' : ''} Needed
                                                    </span>
                                                )}
                                                {flaggedCount === 0 && submission?.interventions?.length > 0 && (
                                                    <span className="bg-emerald-100 text-emerald-700 text-[9px] px-2 py-0.5 rounded-full font-black border border-emerald-200">
                                                        0 Flags
                                                    </span>
                                                )}
                                            </div>
                                            <span className={flaggedCount > 0 ? "text-red-600/80 font-semibold" : ""}>
                                                {flaggedCount > 0
                                                    ? 'Incomplete beneficiaries, budget, or activities'
                                                    : 'Fix missing details and validation issues'}
                                            </span>
                                        </div>
                                        <strong className="text-siif-blue">›</strong>
                                    </button>

                                    <button className="siif-action-btn" onClick={() => window.print()}>
                                        <div className="siif-action-icon">⇩</div>
                                        <div className="text-left">
                                            <b>Export Report</b>
                                            <span>Download the school allocation summary</span>
                                        </div>
                                        <strong className="text-siif-blue">›</strong>
                                    </button>
                                </div>
                            </div>
                        </aside>
                    </section>
                </section>
            </main>

            {/* ── Plan Summary Grid (Replacing Massive Scroller) ─────────────────────── */}
            {submission && (
                <div className="px-5 print:mt-0 print:p-0">

                    {/* Print-Only Expanded Details (Clean Document Layout) */}
                    <div className="hidden print:block text-xs font-sans text-black">
                        {/* DepEd Official Header Style */}
                        <div className="text-center mb-6 border-b-2 border-black pb-4">
                            <p className="text-xs font-bold uppercase tracking-widest">Department of Education</p>
                            <p className="text-[10px] font-bold uppercase">
                                Region {allocation?.region || user?.region || '___'}, Division of {allocation?.division || user?.division || '___'}
                            </p>
                            <h1 className="text-xl font-black uppercase tracking-widest mt-3">School Innovation & Improvement Fund (SIIF)</h1>
                            <h2 className="text-sm font-bold uppercase tracking-widest mt-1">Implementation Plan</h2>

                            <div className="mt-4 flex flex-col items-center gap-0.5">
                                <p className="text-base font-black uppercase">{allocation?.school_name || user?.school_name || 'School Name'}</p>
                                <p className="text-xs font-bold uppercase">School ID: {user?.school_id || '______'} &nbsp;|&nbsp; Fiscal Year: {allocation?.fiscal_year}</p>
                            </div>
                        </div>

                        {/* Grand Totals Table */}
                        <table className="w-full border-collapse border border-black mb-6 text-xs">
                            <tbody>
                                <tr>
                                    <td className="border border-black p-2 font-bold uppercase w-1/4">Total Interventions</td>
                                    <td className="border border-black p-2 font-black text-center w-1/4">{(submission?.interventions || []).length}</td>
                                    <td className="border border-black p-2 font-bold uppercase w-1/4">Total Learners Target</td>
                                    <td className="border border-black p-2 font-black text-center w-1/4">{totalBeneficiaries.toLocaleString()}</td>
                                </tr>
                                <tr>
                                    <td className="border border-black p-2 font-bold uppercase">Cumulative Budget Estimate</td>
                                    <td className="border border-black p-2 font-black" colSpan="3">
                                        ₱{totalBudgetEstimate.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Interventions Tables */}
                        {(submission.interventions || []).map((intId, idx) => {
                            const label = INTERVENTIONS.find(i => i.id === intId)?.label || intId;
                            const intData = submission.interventionData?.[intId] || {};
                            const budget = submission.budgetEstimates?.[intId] || 0;
                            const learners = Object.values(intData.beneficiaryCounts || {}).reduce((s, v) => s + (parseInt(v) || 0), 0);

                            return (
                                <div key={intId} className="mb-6 break-inside-avoid">
                                    <table className="w-full border-collapse border border-black text-[11px]">
                                        <tbody>
                                            <tr>
                                                <td className="border border-black p-2 font-black uppercase bg-slate-100" colSpan="4">
                                                    Intervention {idx + 1}: {label}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="border border-black p-2 font-bold uppercase w-[20%]">Est. Budget</td>
                                                <td className="border border-black p-2 font-black w-[30%]">₱{(parseFloat(budget) || 0).toLocaleString()}</td>
                                                <td className="border border-black p-2 font-bold uppercase w-[20%]">Learners</td>
                                                <td className="border border-black p-2 font-black w-[30%]">{learners.toLocaleString()}</td>
                                            </tr>
                                            <tr>
                                                <td className="border border-black p-2 font-bold uppercase align-top">Beneficiaries Breakdown</td>
                                                <td className="border border-black p-2 align-top" colSpan="3">
                                                    <ul className="list-none m-0 p-0 space-y-0.5">
                                                        {Object.entries(intData.beneficiaryCounts || {}).map(([g, c]) => {
                                                            if (parseInt(c) <= 0) return null;
                                                            const aralObj = intData.aralCounts?.[g] || {};
                                                            const aralStr = Object.entries(aralObj)
                                                                .filter(([, cnt]) => parseInt(cnt) > 0)
                                                                .map(([s, cnt]) => `${s}: ${cnt}`)
                                                                .join(', ');
                                                            return (
                                                                <li key={g} className="flex justify-between border-b border-black/10 pb-0.5 mb-0.5 last:border-0 last:mb-0 last:pb-0">
                                                                    <span className="font-bold">{GRADE_LABELS[g] || g}</span>
                                                                    <span>
                                                                        <span className="font-black">{c} Learners</span>
                                                                        {aralStr && <span className="text-[9px] italic font-normal ml-2">(ARAL: {aralStr})</span>}
                                                                    </span>
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="border border-black p-2 font-bold uppercase align-top">Planned Activities</td>
                                                <td className="border border-black p-2 align-top" colSpan="3">
                                                    <ul className="list-disc pl-4 m-0 space-y-0.5 font-bold">
                                                        {Object.entries(intData.selectedActivities || {}).map(([cat, acts]) => (
                                                            Array.isArray(acts) && acts.map((act, i) => <li key={`${cat}-${i}`}>{act}</li>)
                                                        ))}
                                                        {intData.otherActivity && <li>Other: {intData.otherActivity}</li>}
                                                    </ul>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })}
                    </div>


                </div>
            )}

            {/* ── Intervention Details Modal ─────────────────────────────────────── */}
            <AnimatePresence>
                {selectedModalIntervention && (() => {
                    const intId = selectedModalIntervention;
                    const info = INTERVENTIONS.find(i => i.id === intId);
                    const intData = submission.interventionData?.[intId] || {};
                    const learners = Object.values(intData.beneficiaryCounts || {}).reduce((s, v) => s + (parseInt(v) || 0), 0);
                    const budget = submission.budgetEstimates?.[intId] || 0;

                    const acts = [];
                    if (intData.selectedActivities) {
                        Object.values(intData.selectedActivities).forEach(list => {
                            if (Array.isArray(list)) acts.push(...list);
                        });
                    }

                    return (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="siif-modal-overlay"
                            onClick={() => setSelectedModalIntervention(null)}
                        >
                            <motion.div
                                initial={{ scale: 0.92, y: 15, opacity: 0 }}
                                animate={{ scale: 1, y: 0, opacity: 1 }}
                                exit={{ scale: 0.92, y: 15, opacity: 0 }}
                                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                                className="siif-modal-card"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div className="siif-modal-header">
                                    <div>
                                        <span className="siif-modal-eyebrow">
                                            Intervention Disaggregation
                                        </span>
                                        <h2 className="siif-modal-title">
                                            {info?.label || intId}
                                        </h2>
                                    </div>
                                    <button
                                        onClick={() => setSelectedModalIntervention(null)}
                                        className="siif-modal-close-btn"
                                        aria-label="Close modal"
                                    >
                                        <TbX size={20} />
                                    </button>
                                </div>

                                {/* Body */}
                                <div className="siif-modal-body">
                                    {/* 3 Metric Cards */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col items-center text-center">
                                            <span className="text-[9px] sm:text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Estimated Budget</span>
                                            <strong className="text-xs sm:text-sm md:text-base font-black text-emerald-600 truncate w-full">{formatCurrency(budget)}</strong>
                                        </div>
                                        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col items-center text-center">
                                            <span className="text-[9px] sm:text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Target Learners</span>
                                            <strong className="text-base sm:text-lg font-black text-[#0284C7]">{learners.toLocaleString()}</strong>
                                        </div>
                                        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col items-center text-center">
                                            <span className="text-[9px] sm:text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Planned Activities</span>
                                            <strong className="text-base sm:text-lg font-black text-purple-600">{acts.length + (intData.otherActivity ? 1 : 0)}</strong>
                                        </div>
                                    </div>

                                    {/* Beneficiaries Breakdown */}
                                    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
                                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#08315F] flex items-center gap-1.5 border-b border-slate-100 pb-2">
                                            <TbUsers size={16} className="text-[#0284C7]" />
                                            Target Beneficiaries Breakdown
                                        </h4>
                                        {Object.keys(intData.beneficiaryCounts || {}).length > 0 ? (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {Object.entries(intData.beneficiaryCounts || {}).map(([grade, count]) => {
                                                    const cntInt = parseInt(count) || 0;
                                                    if (cntInt <= 0) return null;
                                                    const aralObj = intData.aralCounts?.[grade] || {};
                                                    const aralStr = Object.entries(aralObj)
                                                        .filter(([, c]) => parseInt(c) > 0)
                                                        .map(([subj, c]) => `${subj}: ${c}`)
                                                        .join(', ');
                                                    return (
                                                        <div key={grade} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                                            <div className="min-w-0 flex-1 pr-2">
                                                                <span className="font-bold text-xs text-slate-700 block truncate">{GRADE_LABELS[grade] || grade}</span>
                                                                {aralStr && <span className="text-[10px] text-slate-500 block truncate italic">ARAL: {aralStr}</span>}
                                                            </div>
                                                            <span className="bg-blue-50 text-[#0284C7] font-black text-xs px-2.5 py-1 rounded-lg border border-blue-100 shrink-0">
                                                                {cntInt}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-slate-400 italic">No beneficiary details specified.</p>
                                        )}
                                    </div>

                                    {/* Planned Activities */}
                                    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
                                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#08315F] flex items-center gap-1.5 border-b border-slate-100 pb-2">
                                            <TbChecklist size={16} className="text-emerald-600" />
                                            Planned Activities List
                                        </h4>
                                        {acts.length > 0 || intData.otherActivity ? (
                                            <ul className="space-y-2">
                                                {acts.map((act, i) => (
                                                    <li key={i} className="flex items-start gap-2.5 text-xs text-slate-700 font-semibold p-2 rounded-xl bg-slate-50 border border-slate-100">
                                                        <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">✓</span>
                                                        <span>{act}</span>
                                                    </li>
                                                ))}
                                                {intData.otherActivity && (
                                                    <li className="flex items-start gap-2.5 text-xs text-slate-700 font-semibold p-2 rounded-xl bg-slate-50 border border-slate-100">
                                                        <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">★</span>
                                                        <span>Other: {intData.otherActivity}</span>
                                                    </li>
                                                )}
                                            </ul>
                                        ) : (
                                            <p className="text-xs text-slate-400 italic">No activities selected.</p>
                                        )}
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="siif-modal-footer">
                                    <span className="siif-modal-footer-info">SIIF Implementation Details</span>
                                    <button
                                        onClick={() => setSelectedModalIntervention(null)}
                                        className="siif-modal-btn-primary"
                                    >
                                        Close
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    );
                })()}
            </AnimatePresence>

        </div>
    );
};

export default SIIFDashboard;
