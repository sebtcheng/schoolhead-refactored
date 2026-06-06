// SIIFSummary.jsx — Step 5 (Dedicated Review & Submission Page)
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TbChevronLeft, TbLock, TbArrowLeft, TbCircleCheck,
    TbUsers, TbBulb, TbCurrencyPeso, TbChevronRight,
    TbTrendingUp, TbInfoCircle, TbEdit, TbCheck, TbBook, TbX
} from 'react-icons/tb';
import { FiSave, FiAlertCircle } from 'react-icons/fi';
import { logger } from '../../../utils/logger';
import { fetchAllocation, fetchSubmission, fetchDeadline, submitPlan } from '../services/siifService';
import { INTERVENTIONS, INTERVENTION_ICONS, GRADE_LABELS } from '../constants/siifConstants';

const SIIFSummary = ({ user, token }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [submitting, setSubmitting] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [confirmError, setConfirmError] = useState(false);
    const [activeSlide, setActiveSlide] = useState(0);

    // Load state from Router state, or fetch from DB if not available (direct page load)
    const [loading, setLoading] = useState(true);
    const [draftData, setDraftData] = useState({
        selectedInterventions: [],
        aral: { planned: null, subjects: [] },
        beneficiaries: {},
        activities: {},
        budgets: {},
        allocation: null,
        deadline: null,
        status: null,
        rejectionReason: null
    });

    useEffect(() => {
        const schoolId = user?.school_id || user?.schoolId || user?.uid || user?.id || user?.sub;
        if (!schoolId) {
            logger.error('SIIFSummary', 'No schoolId found in user session.');
            navigate('/siif');
            return;
        }

        if (location.state) {
            setDraftData({
                selectedInterventions: location.state.selectedInterventions || [],
                aral: location.state.aral || { planned: null, subjects: [] },
                beneficiaries: location.state.beneficiaries || {},
                activities: location.state.activities || {},
                budgets: location.state.budgets || {},
                allocation: location.state.allocation || null,
                deadline: location.state.deadline || null,
                status: location.state.status || null,
                rejectionReason: location.state.rejectionReason || null
            });
            setLoading(false);
        } else {
            // Direct load: fetch draft from DB via service layer
            const fetchDraft = async () => {
                try {
                    const [allocationData, subData, dlData] = await Promise.all([
                        fetchAllocation(schoolId, token).catch(() => null),
                        fetchSubmission(schoolId, token).catch(() => null),
                        fetchDeadline().catch(() => null),
                    ]);

                    const deadlineVal = dlData?.deadline || null;

                    if (subData?.success || subData?.interventions) {
                        setDraftData({
                            selectedInterventions: subData.interventions || [],
                            aral: subData.aral || { planned: null, subjects: [] },
                            beneficiaries: subData.interventionData || {},
                            activities: subData.interventionData || {},
                            budgets: subData.budgetEstimates || {},
                            allocation: allocationData,
                            deadline: deadlineVal,
                            status: subData.status || null,
                            rejectionReason: subData.rejectionReason || subData.rejection_reason || null
                        });
                    } else {
                        // No draft found, redirect to form
                        navigate('/siif/forms');
                    }
                } catch (err) {
                    console.error('🔥 [SIIFSummary] Failed to load draft:', err);
                    navigate('/siif/forms');
                } finally {
                    setLoading(false);
                }
            };
            fetchDraft();
        }
    }, [location.state, user, token, navigate]);

    const {
        selectedInterventions,
        beneficiaries,
        activities,
        budgets,
        allocation,
        deadline
    } = draftData;

    // Derived values
    const allocAmt = allocation ? (parseFloat(allocation.allocation_amount) || 0) : 0;
    const totalBudget = Object.values(budgets).reduce((sum, b) => sum + (parseFloat(b) || 0), 0);
    const progressPct = allocAmt > 0 ? Math.min(100, Math.round((totalBudget / allocAmt) * 100)) : 0;

    const totalLearners = Object.values(beneficiaries).reduce((sum, d) => {
        if (!d) return sum;
        return sum + Object.values(d.beneficiaryCounts || {}).reduce((a, v) => a + (parseInt(v) || 0), 0);
    }, 0);

    const totalActivities = Object.values(activities).reduce((sum, d) => {
        if (!d) return sum;
        const sipAip = d.selectedActivities?.sip_aip || [];
        const ar = d.selectedActivities?.action_research || [];
        const rem = d.selectedActivities?.remaining || [];
        return sum + sipAip.length + ar.length + rem.length;
    }, 0);

    const handleFinalSubmit = async () => {
        if (confirmText.trim().toUpperCase() !== 'CONFIRM') {
            setConfirmError(true);
            setTimeout(() => setConfirmError(false), 2000);
            return;
        }

        setSubmitting(true);
        const schoolId = user?.school_id || user?.schoolId || user?.uid || user?.id || user?.sub;

        const interventionData = {};
        for (const intId of selectedInterventions) {
            interventionData[intId] = {
                ...(activities[intId] || {}),
                ...(beneficiaries[intId] || {}),
            };
        }

        const payload = {
            schoolId,
            schoolName: allocation?.school_name || user?.school_name || user?.schoolName || '',
            region: allocation?.region || user?.region || '',
            division: allocation?.division || user?.division || '',
            district: allocation?.district || '',
            fiscalYear: new Date().getFullYear(),
            status: 'submitted',
            interventions: selectedInterventions,
            aral: draftData.aral,
            budgetEstimates: budgets,
            totalBudget,
            interventionData,
        };

        try {
            const data = await submitPlan(payload, token);
            console.log('✅ [SIIFSummary] Submitted. ID:', data.submissionId);
            alert(`✅ SIIF Plan Submitted Successfully!\n\nIMPORTANT: You can edit this plan until the deadline.`);
            navigate('/siif');
        } catch (err) {
            console.error('🔥 [SIIFSummary] Submit failed:', err);
            alert(`Error submitting plan: ${err.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col gap-4">
                <div className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Assembling Plan Summary...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col pb-24">
            {/* Header */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white pt-16 pb-12 px-6 rounded-b-[2.5rem] shadow-xl relative overflow-hidden shrink-0">
                <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />

                <div className="relative z-10 flex items-center gap-3">
                    <button
                        onClick={() => navigate('/siif/forms')}
                        className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-all text-white border border-white/10"
                    >
                        <TbArrowLeft size={20} />
                    </button>
                    <div>
                        <p className="text-[9px] font-black text-emerald-200 uppercase tracking-[0.3em]">Step 5 of 5 — Review & Submit</p>
                        <h1 className="text-xl font-black italic uppercase tracking-tight leading-none mt-1">Final Verification</h1>
                    </div>
                </div>
            </div>

            {/* General Aggregate Metrics */}
            <div className="px-5 -mt-6 relative z-10 grid grid-cols-3 gap-3">
                <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-lg flex flex-col items-center justify-center text-center">
                    <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
                        <TbUsers size={18} />
                    </div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Learners</p>
                    <p className="text-base font-black text-slate-800 leading-none">{totalLearners.toLocaleString()}</p>
                </div>

                <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-lg flex flex-col items-center justify-center text-center">
                    <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2">
                        <TbBulb size={18} />
                    </div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Activities</p>
                    <p className="text-base font-black text-slate-800 leading-none">{totalActivities}</p>
                </div>

                <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-lg flex flex-col items-center justify-center text-center">
                    <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                        <TbCurrencyPeso size={18} />
                    </div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Total Budget</p>
                    <p className="text-sm font-black text-slate-800 leading-none">₱{totalBudget.toLocaleString('en-PH', { maximumFractionDigits: 0 })}</p>
                </div>
            </div>

            {/* ── Disapproval Banner ── */}
            {draftData.status?.toLowerCase() === 'disapproved' && (
                <div className="mx-5 mt-6 p-5 bg-red-500/10 text-slate-900 rounded-[2rem] border-2 border-red-500/30 backdrop-blur-xl flex flex-col items-start gap-3 shadow-lg">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-500/20 text-red-600 rounded-xl flex items-center justify-center shrink-0 border border-red-500/20 animate-pulse">
                            <TbX size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-red-600">Plan Disapproved by Division</p>
                            <p className="text-[10.5px] font-bold leading-snug text-slate-700">Please address the remarks below in your revision.</p>
                        </div>
                    </div>
                    <p className="text-xs font-extrabold italic text-slate-700 bg-white/50 p-3.5 rounded-2xl border border-red-500/10 leading-relaxed w-full">
                        "{draftData.rejectionReason || 'No remarks provided.'}"
                    </p>
                </div>
            )}

            {/* Budget vs Allocation Progress Card */}
            <div className="px-5 mt-6">
                <div className="bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Financial Summary</p>
                            <p className="text-xs text-slate-500 font-bold mt-0.5">Total plan budget compared to school allocation</p>
                        </div>
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider border ${
                            totalBudget <= allocAmt ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'
                        }`}>
                            {totalBudget <= allocAmt ? 'Within Limit ✓' : 'Over Limit ⛔'}
                        </span>
                    </div>

                    <div className="space-y-2">
                        <div className="h-3 w-full bg-slate-50 border border-slate-100 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPct}%` }}
                                transition={{ duration: 0.8 }}
                                className={`h-full rounded-full ${
                                    totalBudget <= allocAmt ? 'bg-emerald-500' : 'bg-red-500'
                                }`}
                            />
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-400">
                            <span>Utilized: ₱{totalBudget.toLocaleString('en-PH', { maximumFractionDigits: 0 })} ({progressPct}%)</span>
                            <span>Limit: ₱{allocAmt.toLocaleString('en-PH', { maximumFractionDigits: 0 })}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Slider / Carousel Header */}
            <div className="px-6 mt-8 flex justify-between items-center">
                <div>
                    <h2 className="text-sm font-black text-slate-800 italic uppercase tracking-tight">Selected Interventions</h2>
                    <p className="text-[10px] text-slate-400 font-bold">Review detailed inputs per intervention ({selectedInterventions.length} active)</p>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                    <button
                        onClick={() => setActiveSlide(prev => Math.max(0, prev - 1))}
                        disabled={activeSlide === 0}
                        className="p-1.5 rounded-lg bg-white shadow-sm disabled:opacity-40 disabled:shadow-none text-slate-700"
                    >
                        <TbChevronLeft size={16} />
                    </button>
                    <span className="text-[10px] font-black text-slate-600 px-1.5">
                        {activeSlide + 1} / {selectedInterventions.length}
                    </span>
                    <button
                        onClick={() => setActiveSlide(prev => Math.min(selectedInterventions.length - 1, prev + 1))}
                        disabled={activeSlide === selectedInterventions.length - 1}
                        className="p-1.5 rounded-lg bg-white shadow-sm disabled:opacity-40 disabled:shadow-none text-slate-700"
                    >
                        <TbChevronRight size={16} />
                    </button>
                </div>
            </div>

            {/* Intervention Details Slides / Carousel */}
            <div className="px-5 mt-4 overflow-hidden relative min-h-[300px]">
                <AnimatePresence mode="wait">
                    {selectedInterventions.map((intId, idx) => {
                        if (idx !== activeSlide) return null;
                        const info = INTERVENTIONS.find(i => i.id === intId);
                        const benData = beneficiaries[intId] || { selectedGrades: [], beneficiaryCounts: {} };
                        const actData = activities[intId] || { selectedActivities: { sip_aip: [], action_research: [], remaining: [] } };
                        const budgetVal = budgets[intId] || 0;

                        return (
                            <motion.div
                                key={intId}
                                initial={{ opacity: 0, x: 50 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -50 }}
                                transition={{ duration: 0.2 }}
                                className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-md space-y-5"
                            >
                                {/* Slide Header */}
                                <div className="flex items-center gap-4 pb-4 border-b border-slate-50">
                                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                        {INTERVENTION_ICONS[intId] || <TbBook size={24} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Intervention details</p>
                                        <h3 className="font-black text-sm text-slate-800 uppercase tracking-tight truncate">{info?.label}</h3>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Est. Budget</p>
                                        <p className="text-base font-black text-emerald-600">₱{(parseFloat(budgetVal) || 0).toLocaleString()}</p>
                                    </div>
                                </div>

                                {/* Details Grid */}
                                <div className="space-y-4 text-xs">
                                    {/* Grade Beneficiaries */}
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Grade Beneficiaries</p>
                                        <div className="flex flex-wrap gap-2">
                                            {benData.selectedGrades.map(g => (
                                                <div key={g} className="bg-slate-50 px-3 py-1.5 rounded-2xl border border-slate-100 flex items-center gap-1.5">
                                                    <span className="text-[10px] font-black text-slate-600 uppercase">{GRADE_LABELS[g]}</span>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                                    <span className="text-[10px] font-bold text-slate-500">{benData.beneficiaryCounts[g] || 0} Learners</span>
                                                </div>
                                            ))}
                                            {benData.selectedGrades.length === 0 && (
                                                <p className="text-[10px] font-bold text-slate-400 italic">No grades selected</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Activities */}
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Planned Activities</p>
                                        <div className="space-y-2">
                                            {/* SIP/AIP */}
                                            {(actData.selectedActivities?.sip_aip || []).map((act, i) => (
                                                <div key={i} className="flex items-start gap-2.5 bg-slate-50/50 p-2.5 rounded-2xl border border-slate-100/50">
                                                    <div className="w-4 h-4 rounded bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                                                        <TbCheck size={10} />
                                                    </div>
                                                    <p className="text-[10px] text-slate-600 font-bold leading-relaxed">{act}</p>
                                                </div>
                                            ))}
                                            {/* Action Research */}
                                            {(actData.selectedActivities?.action_research || []).map((act, i) => (
                                                <div key={i} className="flex items-start gap-2.5 bg-emerald-50/30 p-2.5 rounded-2xl border border-emerald-100/30">
                                                    <div className="w-4 h-4 rounded bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                                                        <TbCheck size={10} />
                                                    </div>
                                                    <p className="text-[10px] text-emerald-800 font-bold leading-relaxed">{act}</p>
                                                </div>
                                            ))}
                                            {/* Remaining */}
                                            {(actData.selectedActivities?.remaining || []).map((act, i) => (
                                                <div key={i} className="flex items-start gap-2.5 bg-slate-50/50 p-2.5 rounded-2xl border border-slate-100/50">
                                                    <div className="w-4 h-4 rounded bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                                                        <TbCheck size={10} />
                                                    </div>
                                                    <p className="text-[10px] text-slate-600 font-bold leading-relaxed">{act}</p>
                                                </div>
                                            ))}
                                            {/* Other Activity */}
                                            {actData.otherActivity && (
                                                <div className="flex items-start gap-2.5 bg-blue-50/30 p-2.5 rounded-2xl border border-blue-100/30">
                                                    <div className="w-4 h-4 rounded bg-blue-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                                                        <TbCheck size={10} />
                                                    </div>
                                                    <p className="text-[10px] text-blue-800 font-black leading-relaxed">Other: {actData.otherActivity}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {/* Edit Button */}
            <div className="px-5 mt-6">
                <button
                    onClick={() => navigate('/siif/forms')}
                    className="w-full py-4 bg-white hover:bg-slate-50 text-slate-600 rounded-3xl font-black text-[10px] uppercase tracking-widest border border-slate-200 shadow-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                    <TbEdit size={14} /> Back to Planning Steps to Edit
                </button>
            </div>

            {/* Submission Gate (CONFIRM typing) */}
            <div className="px-5 mt-6">
                <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-lg space-y-4">
                    <div className="flex items-start gap-3">
                        <TbInfoCircle className="text-emerald-600 shrink-0 mt-0.5" size={18} />
                        <div>
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">Final Attestation</h4>
                            <p className="text-[10px] text-slate-400 font-bold leading-relaxed mt-0.5">
                                Please ensure all plans represent realistic intervention estimates.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">
                            Type <span className="text-emerald-600 font-black">CONFIRM</span> to submit
                        </p>
                        <input
                            type="text"
                            placeholder="Type CONFIRM..."
                            value={confirmText}
                            onChange={e => setConfirmText(e.target.value)}
                            disabled={submitting}
                            className={`w-full px-5 py-4 rounded-2xl border-2 font-black text-sm tracking-widest text-center transition-all focus:outline-none ${
                                confirmError
                                    ? 'border-red-400 bg-red-50 text-red-600'
                                    : 'border-slate-200 bg-slate-50 text-slate-800 focus:border-emerald-500 focus:bg-white'
                            }`}
                        />
                        {confirmError && (
                            <p className="text-center text-[9px] text-red-500 font-black animate-bounce uppercase tracking-widest">
                                Please type CONFIRM in all capitals
                            </p>
                        )}

                        <button
                            onClick={handleFinalSubmit}
                            disabled={submitting || confirmText.trim().toUpperCase() !== 'CONFIRM'}
                            className="w-full py-5 bg-emerald-600 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl disabled:shadow-none hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            {submitting ? 'Submitting Plan...' : (
                                <>
                                    <TbCircleCheck size={18} /> Submit Final SIIF Plan
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SIIFSummary;
