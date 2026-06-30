import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    TbHistory, TbChevronRight, TbArrowLeft, TbWallet, TbBulb, TbChecklist, TbUsers, TbCheck, TbX, TbPrinter, TbCircleCheck, TbClock
} from 'react-icons/tb';
import { motion, AnimatePresence } from 'framer-motion';
import { logger } from '../../../utils/logger';
import { INTERVENTIONS, INTERVENTION_ICONS, GRADE_LABELS, KEY_STAGES } from '../constants/siifConstants';
import { fetchAllocation, fetchSubmission } from '../services/siifService';

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
    const totalBudgetEstimate = submission?.totalBudget || 0;

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

    const spentPercent = allocation.allocation_amount > 0
        ? Math.round((parseFloat(allocation.spent_amount) / parseFloat(allocation.allocation_amount)) * 100)
        : 0;

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
        return (
            <div className="flex items-center justify-center flex-col gap-4 min-h-screen">
                <div className="w-10 h-10 rounded-full border-4 border-siif-blue border-t-transparent animate-spin" />
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest animate-pulse">Loading SIIF Dashboard...</p>
            </div>
        );
    }

    return (
        <div className="font-sans text-lg print:bg-white print:m-0 print:p-0 pb-32">



            <main className="siif-new-content pb-7 print:hidden">
                <header className="siif-new-topbar">
                    <div className="siif-page-title">
                        <p className="siif-eyebrow">National Education Command Center</p>
                        <h1>Insight<span>ED</span> Resource Dashboard</h1>
                        <p>School-level allocation, intervention planning, and resource action queue.</p>
                    </div>

                    <div className="siif-topbar-actions">
                        <section className="siif-school-pill">
                            <small>Your school</small>
                            <strong title={allocation.school_name || user.school_name || 'Your School'}>
                                {allocation.school_name || user.school_name || 'Your School'}
                            </strong>
                            <span>School ID: {user?.school_id || '------'} · FY {allocation.fiscal_year}</span>
                        </section>
                    </div>
                </header>

                <section className="siif-grid mt-6">
                    <article className="siif-card siif-progress-highlight">
                        <div className="siif-card-inner">
                            <div className="siif-card-header">
                                <div>
                                    <h2>School Allocation Overview</h2>
                                    <p className="siif-card-subtitle">Main resource snapshot for school allocation, utilization, and remaining balance.</p>
                                </div>
                                <span className="siif-fy-pill">FY {allocation.fiscal_year}</span>
                            </div>

                            <div className="siif-allocation-summary">
                                <div>
                                    <p className="siif-card-subtitle">Total school allocation</p>
                                    <h3 className="siif-big-number">{formatCurrency(allocation.allocation_amount)}</h3>
                                </div>
                                <div>
                                    <span className="siif-status ok">{spentPercent}% Utilized</span>
                                </div>
                            </div>

                            <div className="siif-progress-track">
                                <motion.div
                                    className="siif-progress-fill"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${spentPercent}%` }}
                                    transition={{ duration: 1.2, ease: 'easeOut' }}
                                >
                                    {spentPercent}%
                                </motion.div>
                            </div>

                            <div className="siif-legend-row">
                                <span><i className="siif-dot sky"></i>Utilized · {formatCurrency(allocation.spent_amount)}</span>
                                <span><i className="siif-dot green"></i>Remaining · {formatCurrency(allocation.remaining_balance)}</span>
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
                                    <div className="mx-6 mb-4 p-4 rounded-xl border border-red-200 bg-gradient-to-r from-red-50 to-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
                                        <div className="flex items-start gap-3 flex-1">
                                            <div className="w-10 h-10 bg-red-100 text-red-600 rounded-lg flex items-center justify-center shrink-0">
                                                <TbX size={20} />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-red-700 flex items-center gap-1.5">
                                                    Action Required: Disapproved
                                                </h4>
                                                <p className="text-xs text-red-600/80 mt-0.5">
                                                    <strong>Remarks:</strong> {submission.remarks || 'Please revise your proposal.'}
                                                </p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => navigate('/siif/forms')} 
                                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs shadow-sm transition-all whitespace-nowrap"
                                        >
                                            Revise Proposal
                                        </button>
                                    </div>
                                )}
                                {submission?.status?.toLowerCase() === 'reviewed' && (
                                    <div className="mx-6 mb-4 p-4 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
                                        <div className="flex items-start gap-3 flex-1">
                                            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center shrink-0">
                                                <TbCircleCheck size={20} />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-emerald-700 flex items-center gap-1.5">
                                                    Reviewed by SDO
                                                </h4>
                                                <p className="text-xs text-emerald-600/80 mt-0.5">
                                                    <strong>Remarks:</strong> {submission.remarks || 'Ready for implementation.'}
                                                </p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => navigate('/siif/utilization')} 
                                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-sm transition-all whitespace-nowrap"
                                        >
                                            Proceed to Utilization
                                        </button>
                                    </div>
                                )}
                                {submission?.status?.toLowerCase() === 'submitted' && (
                                    <div className="mx-6 mb-4 p-4 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
                                        <div className="flex items-start gap-3 flex-1">
                                            <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center shrink-0">
                                                <TbClock size={20} />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-amber-700 flex items-center gap-1.5">
                                                    Pending Review
                                                </h4>
                                                <p className="text-xs text-amber-600/80 mt-0.5">
                                                    Your submission is currently being reviewed by the Division Office.
                                                </p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => navigate('/siif/forms')} 
                                            className="px-4 py-2 bg-amber-100 text-amber-800 hover:bg-amber-200 rounded-lg font-bold text-xs shadow-sm transition-all border border-amber-200 whitespace-nowrap"
                                        >
                                            View Submission
                                        </button>
                                    </div>
                                )}

                                <div className="siif-table-wrap">
                                    <table className="siif-table">
                                        <thead>
                                            <tr>
                                                <th>Intervention</th>
                                                <th>Est. Budget</th>
                                                <th>Target Learners</th>
                                                <th>Details</th>
                                                <th>Next Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {submission?.interventions && submission.interventions.length > 0 ? (
                                                submission.interventions.map((intId, idx) => {
                                                    const label = INTERVENTIONS.find(i => i.id === intId)?.label || intId;
                                                    const budget = submission.budgetEstimates?.[intId] || 0;
                                                    const intData = submission.interventionData?.[intId] || {};
                                                    const learners = Object.values(intData.beneficiaryCounts || {}).reduce((s, v) => s + (parseInt(v) || 0), 0);

                                                    let actionBtn = "View";
                                                    if (submission.status?.toLowerCase() === 'disapproved') {
                                                        actionBtn = "Fix";
                                                    } else if (submission.status?.toLowerCase() === 'draft') {
                                                        actionBtn = "Edit";
                                                    } else if (submission.status?.toLowerCase() === 'reviewed') {
                                                        actionBtn = "View";
                                                    }

                                                    return (
                                                        <tr key={intId}>
                                                            <td>{label}</td>
                                                            <td>{formatCurrency(budget)}</td>
                                                            <td>{learners.toLocaleString()} learners</td>
                                                            <td><button onClick={() => setSelectedModalIntervention(intId)} className="text-siif-blue hover:underline text-xs font-bold">View specifics</button></td>
                                                            <td><button className="siif-row-action" onClick={() => navigate('/siif/forms')}>{actionBtn}</button></td>
                                                        </tr>
                                                    );
                                                })
                                            ) : (
                                                <tr>
                                                    <td colSpan="5" className="text-center py-8 text-slate-400 italic font-bold">No interventions planned yet.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="siif-table-footer">
                                    <span>Showing {innovationsCount} entries.</span>
                                    <div className="siif-page-controls">
                                        <select className="siif-select" disabled>
                                            <option>10 / page</option>
                                            <option>25 / page</option>
                                            <option>50 / page</option>
                                            <option>100 / page</option>
                                        </select>
                                        <button className="siif-page-btn disabled" disabled>Prev</button>
                                        <button className="siif-page-btn active">1</button>
                                        <button className="siif-page-btn disabled" disabled>Next</button>
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
                                                                .filter(([_, cnt]) => parseInt(cnt) > 0)
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
                            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-5 pb-28"
                        >
                            <motion.div
                                initial={{ scale: 0.95, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.95, y: 20 }}
                                className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
                            >
                                {/* Modal Header */}
                                <div className="bg-siif-blue text-white px-6 py-5 flex items-center justify-between shrink-0 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-xl -mr-10 -mt-10 pointer-events-none" />
                                    <div className="flex items-center gap-3 relative z-10 min-w-0 flex-1">
                                        <div className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center shrink-0 border border-white/10">
                                            {INTERVENTION_ICONS[intId] || <TbChecklist size={20} />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[8px] font-black text-blue-200 uppercase tracking-widest leading-none mb-1">Intervention details</p>
                                            <h3 className="font-black text-sm uppercase tracking-tight truncate">{info?.label}</h3>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setSelectedModalIntervention(null)}
                                        className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all border border-white/10 text-white shrink-0 ml-3 relative z-10"
                                        title="Close"
                                    >
                                        <TbX size={16} />
                                    </button>
                                </div>

                                {/* Modal Body */}
                                <div className="p-6 overflow-y-auto space-y-5 flex-1">
                                    {/* Budget and Learners overview */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Learners</p>
                                            <p className="text-base font-black text-slate-800">{learners.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Est. Budget</p>
                                            <p className="text-base font-black text-emerald-600">₱{(parseFloat(budget) || 0).toLocaleString()}</p>
                                        </div>
                                    </div>

                                    {/* Grade Levels breakdown - Grouped by Key Stage */}
                                    {intData.selectedGrades && intData.selectedGrades.length > 0 ? (
                                        <div className="space-y-2">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Target Beneficiaries (Key Stages)</p>
                                            <div className="grid grid-cols-1 gap-2.5">
                                                {KEY_STAGES.map(ks => {
                                                    const activeGradesInKs = ks.grades.filter(g => intData.selectedGrades.includes(g) && (parseInt(intData.beneficiaryCounts?.[g]) || 0) > 0);
                                                    if (activeGradesInKs.length === 0) return null;
                                                    const ksTotal = activeGradesInKs.reduce((sum, g) => sum + (parseInt(intData.beneficiaryCounts?.[g]) || 0), 0);
                                                    return (
                                                        <div key={ks.id} className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 flex flex-col gap-1.5">
                                                            <div className="flex justify-between items-center text-[9px] font-black text-slate-500 uppercase tracking-wider">
                                                                <span>{ks.label}</span>
                                                                <span className="text-siif-blue bg-blue-50 px-2 py-0.5 rounded-md text-[8px]">Total: {ksTotal.toLocaleString()}</span>
                                                            </div>
                                                            <div className="flex flex-wrap gap-1.5 mt-0.5">
                                                                {activeGradesInKs.map(g => (
                                                                    <span key={g} className="text-[9px] font-black bg-white text-slate-600 px-2.5 py-1 rounded-xl border border-slate-100 flex items-center gap-1">
                                                                        {GRADE_LABELS[g]}: <span className="text-siif-blue font-bold">{intData.beneficiaryCounts?.[g] || 0}</span>
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Grade Beneficiaries</p>
                                            <p className="text-xs text-slate-400 italic">No beneficiaries configured.</p>
                                        </div>
                                    )}

                                    {/* Planned Activities (Grouped by Category) */}
                                    <div className="space-y-2">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Planned Activities</p>
                                        <div className="space-y-2.5">
                                            {(() => {
                                                const categories = [
                                                    { key: 'sip_aip', label: 'SIP–AIP Aligned' },
                                                    { key: 'action_research', label: 'Action Research' },
                                                    { key: 'remaining', label: 'Remaining Balance' }
                                                ];
                                                const selectedActivities = intData.selectedActivities || {};
                                                const otherActivity = intData.otherActivity || '';
                                                const hasActivities = categories.some(cat => (selectedActivities[cat.key] || []).length > 0) || (otherActivity && otherActivity.trim().length > 0);

                                                if (!hasActivities) {
                                                    return <p className="text-xs text-slate-300 italic font-bold text-center py-2">No activities planned</p>;
                                                }

                                                return categories.map(cat => {
                                                    const items = selectedActivities[cat.key] || [];
                                                    if (cat.key === 'remaining' && otherActivity && otherActivity.trim().length > 0) {
                                                        // if remaining has items or not, display it along with otherActivity
                                                        const allItems = [...items];
                                                        if (!allItems.includes('Others (specify)')) {
                                                            // If user chose other in general
                                                            allItems.push('Others (specify)');
                                                        }

                                                        return (
                                                            <div key={cat.key} className="bg-slate-50/50 p-3.5 rounded-2xl border border-slate-100/50">
                                                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-2">{cat.label}</p>
                                                                <div className="space-y-1.5">
                                                                    {allItems.map((act, i) => {
                                                                        const display = act === 'Others (specify)' ? `Other: ${otherActivity}` : act;
                                                                        return (
                                                                            <div key={i} className="flex items-start gap-2 bg-white px-2.5 py-1.5 rounded-xl border border-slate-100">
                                                                                <div className="w-3.5 h-3.5 rounded bg-siif-blue text-white flex items-center justify-center shrink-0 mt-0.5">
                                                                                    <TbCheck size={8} />
                                                                                </div>
                                                                                <p className="text-[10px] text-slate-600 font-bold leading-snug">{display}</p>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        );
                                                    }

                                                    if (items.length === 0) return null;
                                                    return (
                                                        <div key={cat.key} className="bg-slate-50/50 p-3.5 rounded-2xl border border-slate-100/50">
                                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-2">{cat.label}</p>
                                                            <div className="space-y-1.5">
                                                                {items.map((act, i) => {
                                                                    const display = act === 'Others (specify)' ? (otherActivity ? `Other: ${otherActivity}` : 'Other') : act;
                                                                    return (
                                                                        <div key={i} className="flex items-start gap-2 bg-white px-2.5 py-1.5 rounded-xl border border-slate-100">
                                                                            <div className="w-3.5 h-3.5 rounded bg-siif-blue text-white flex items-center justify-center shrink-0 mt-0.5">
                                                                                <TbCheck size={8} />
                                                                            </div>
                                                                            <p className="text-[10px] text-slate-600 font-bold leading-snug">{display}</p>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
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
