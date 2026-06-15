import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    TbHistory, TbChevronRight, TbArrowLeft, TbWallet, TbBulb, TbChecklist, TbUsers, TbCheck, TbX, TbPrinter
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

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col gap-4">
                <div className="w-10 h-10 rounded-full border-4 border-siif-blue border-t-transparent animate-spin" />
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest animate-pulse">Loading SIIF Dashboard...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-32 font-sans text-lg print:bg-white print:m-0 print:p-0">

            {/* ── Dashboard Header (Compact & Premium) ─────────────────────────────────── */}
            <div className="bg-siif-blue text-white pt-12 pb-10 px-6 rounded-b-[2.5rem] shadow-xl relative overflow-hidden print:hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />

                <div className="relative z-10 flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/20 shrink-0">
                            <TbBulb size={24} className="text-siif-yellow" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black italic tracking-tight uppercase leading-none">SIIF Dashboard</h1>
                            <p className="text-[8px] font-bold text-blue-200 uppercase tracking-widest mt-0.5 italic">School Innovation & Improvement Fund</p>
                        </div>
                    </div>
                    <button
                        onClick={() => window.location.href = '/insighted-other-services/dashboard'}
                        className="p-2.5 bg-white/10 rounded-xl hover:bg-white/20 transition-all text-white border border-white/10 flex items-center gap-1.5"
                    >
                        <TbArrowLeft size={16} />
                        <span className="text-[9px] font-bold uppercase tracking-widest hidden md:block">Nexus</span>
                    </button>
                </div>

                <div className="relative z-10 mb-5">
                    <h2 className="text-xl font-black italic uppercase tracking-tight text-white leading-tight truncate mb-1">
                        {allocation.school_name || user.school_name || 'Your School'}
                    </h2>
                    <p className="text-[9px] font-black text-blue-200 uppercase tracking-[0.3em] opacity-85">
                        School ID: {user?.school_id || '------'}
                    </p>
                </div>

                {/* Glassmorphic Unified Finance Card */}
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-[2rem] p-6 shadow-inner relative z-10">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-black text-white/60 uppercase tracking-[0.3em]">Total School Allocation</p>
                        <span className="text-[9px] font-black bg-siif-yellow text-siif-blue px-2.5 py-0.5 rounded-lg shadow-sm">FY {allocation.fiscal_year}</span>
                    </div>
                    <div className="flex items-baseline gap-2 mb-4">
                        <h3 className="text-3xl font-black tracking-tight italic">
                            {formatCurrency(allocation.allocation_amount)}
                        </h3>
                    </div>

                    <div className="space-y-3">
                        <div className="h-3 bg-white/10 rounded-full overflow-hidden p-[2px]">
                            <motion.div
                                className="h-full rounded-full bg-siif-yellow shadow-[0_0_15px_#ffd93b]"
                                initial={{ width: 0 }}
                                animate={{ width: `${spentPercent}%` }}
                                transition={{ duration: 1.2, ease: 'easeOut' }}
                            />
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-siif-yellow shadow-[0_0_6px_#ffd93b]" />
                                <span className="text-white/70">Utilized: {formatCurrency(allocation.spent_amount)}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-red-400 shadow-[0_0_6px_#f87171]" />
                                <span className="text-white/70">Remaining: {formatCurrency(allocation.remaining_balance)}</span>
                            </div>
                            <span className="text-siif-yellow font-black">{spentPercent}%</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── SDO Disapproval Banner (Nexus Premium Style) ── */}
            {submission && submission.status?.toLowerCase() === 'disapproved' && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mx-5 mt-6 p-6 rounded-[2rem] border-2 border-red-500/30 bg-red-500/10 backdrop-blur-xl shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 print:hidden"
                >
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-red-500/20 text-red-600 rounded-xl flex items-center justify-center shrink-0 border border-red-500/20">
                            <TbX size={24} className="animate-pulse" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-black text-red-600 uppercase tracking-wide flex items-center gap-1.5">
                                ❌ Plan Disapproved by Division Office
                            </h4>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1.5">
                                SDO Comments / Correction Instructions:
                            </p>
                            <p className="text-xs text-slate-700 font-extrabold italic mt-1.5 bg-red-500/5 p-3.5 rounded-xl border border-red-500/10 leading-relaxed">
                                "{submission.rejection_reason || submission.rejectionReason || 'No remarks provided.'}"
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/siif/forms')}
                        className="py-3 px-5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shrink-0 shadow-md transition-all active:scale-[0.98] w-full md:w-auto"
                    >
                        Revise Proposal
                    </button>
                </motion.div>
            )}

            {/* ── Quick Actions ──────────────────────────────────────── */}
            <div className="px-5 mt-6 print:hidden">
                <button
                    onClick={() => navigate('/siif/forms')}
                    className="p-5 bg-white rounded-[2rem] border border-slate-100 shadow-md flex items-center justify-between group active:scale-[0.98] transition-all w-full"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 text-siif-blue rounded-xl flex items-center justify-center group-hover:bg-siif-blue group-hover:text-white transition-colors shadow-inner shrink-0">
                            <TbChecklist size={24} />
                        </div>
                        <div className="text-left">
                            <p className="font-black text-slate-800 text-sm italic uppercase tracking-tighter">Plan Interventions</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Start or edit your school proposal</p>
                        </div>
                    </div>
                    <TbChevronRight className="text-slate-300 group-hover:translate-x-1.5 transition-transform" size={20} />
                </button>
            </div>

            {/* ── Plan Summary Grid (Replacing Massive Scroller) ─────────────────────── */}
            {submission && (
                <div className="px-5 mt-8 pb-10 print:mt-0 print:p-0">
                    {/* Header removed as it is handled by the new PDS layout below */}

                    <div className="flex items-center justify-between mb-5 px-1 print:hidden">
                        <div className="flex items-center gap-2.5">
                            <div className="w-2 h-6 bg-siif-blue rounded-full shadow-[0_0_8px_rgba(14,131,189,0.3)]" />
                            <div>
                                <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight italic">Planned Interventions</h4>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Select and view your planned interventions</p>
                            </div>
                        </div>
                    </div>

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

                    {/* Master Card Container (Replacing Web-Only Card Grid & Grand Total Bar) */}
                    <div className="print:hidden">
                        {(() => {
                            const total_allocation = parseFloat(allocation.allocation_amount) || 0;
                            const alloc_pct = total_allocation > 0 ? (totalBudgetEstimate / total_allocation) * 100 : 0;
                            const isOverBudget = alloc_pct > 100;
                            
                            return (
                                <motion.div
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white rounded-[2.5rem] p-6 md:p-8 shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden flex flex-col md:flex-row gap-8"
                                >
                                    {/* Percentage Badge */}
                                    <div className="absolute top-6 right-6 md:top-8 md:right-8 z-20 text-right">
                                        <div className={`inline-flex flex-col items-end`}>
                                            <span className={`text-2xl md:text-3xl font-black leading-none ${isOverBudget ? 'text-rose-500' : 'text-siif-blue'}`}>
                                                {alloc_pct.toFixed(1)}%
                                            </span>
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                                of Total Allocation
                                            </span>
                                        </div>
                                    </div>

                                    {/* Left Sub-card: Summary Metrics */}
                                    <div className="flex-1 border-b md:border-b-0 md:border-r border-slate-100 pb-6 md:pb-0 md:pr-8 flex flex-col justify-center relative z-10 pt-16 md:pt-0">
                                        <div className="mb-6">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-siif-blue flex items-center justify-center shrink-0 border border-blue-100/50">
                                                    <TbUsers size={20} />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">Total Learners</p>
                                                    <h3 className="text-2xl font-black text-slate-900 leading-none">{totalBeneficiaries.toLocaleString()}</h3>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100/50">
                                                    <TbWallet size={20} />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">Combined Budget</p>
                                                    <h3 className="text-2xl font-black text-emerald-600 leading-none">{formatCurrency(totalBudgetEstimate)}</h3>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-8 flex gap-3">
                                            <button
                                                onClick={() => navigate('/siif/forms')}
                                                className="flex-1 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-slate-900/20 transition-all active:scale-[0.98]"
                                            >
                                                Modify Hub
                                            </button>
                                            <button
                                                onClick={() => window.print()}
                                                className="px-4 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center"
                                                title="Print Details"
                                            >
                                                <TbPrinter size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Right Sub-card: Intervention Types List */}
                                    <div className="flex-1 relative z-10 flex flex-col justify-center">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Planned Interventions</p>
                                        <div className="flex flex-wrap gap-2.5">
                                            {(submission.interventions || []).length === 0 && (
                                                <p className="text-xs font-bold text-slate-400 italic">No interventions planned.</p>
                                            )}
                                            {(submission.interventions || []).map((intId, idx) => {
                                                const label = INTERVENTIONS.find(i => i.id === intId)?.label || intId;
                                                return (
                                                    <button
                                                        key={intId}
                                                        onClick={() => setSelectedModalIntervention(intId)}
                                                        className="px-4 py-3 bg-slate-50 hover:bg-siif-blue hover:text-white border border-slate-200 hover:border-siif-blue text-slate-700 rounded-2xl text-xs font-black transition-all active:scale-[0.97] flex items-center gap-2 group shadow-sm hover:shadow-md"
                                                    >
                                                        <span className="w-2 h-2 rounded-full bg-slate-300 group-hover:bg-white transition-colors" />
                                                        {label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    
                                    {/* Background Decor */}
                                    <div className="absolute bottom-0 right-0 w-64 h-64 bg-slate-50 rounded-full blur-3xl -mr-20 -mb-20 pointer-events-none" />
                                </motion.div>
                            );
                        })()}
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
