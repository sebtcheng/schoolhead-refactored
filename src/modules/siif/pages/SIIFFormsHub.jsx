// SIIFFormsHub.jsx
// The /forms route — 4-card hub with sequential locking
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TbChevronLeft, TbCircleCheck, TbLock,
    TbTarget, TbUsers, TbBulb, TbCurrencyPeso,
    TbChevronRight, TbClock, TbTrendingUp,
    TbArrowLeft, TbX, TbCheck, TbArrowRight
} from 'react-icons/tb';
import { FiSave, FiAlertCircle } from 'react-icons/fi';
import { logger } from '../../../utils/logger';
import InterventionsCard from './cards/InterventionsCard';
import BeneficiariesCard from './cards/BeneficiariesCard';
import ActivitiesCard from './cards/ActivitiesCard';
import BudgetCard from './cards/BudgetCard';
import { INTERVENTIONS, INTERVENTION_ICONS, KEY_STAGES, GRADE_LABELS, emptyIntData } from '../constants/siifConstants';
import { submitPlan } from '../services/siifService';
import { useSIIFSubmission } from '../hooks/useSIIFSubmission';

// Custom Flaticon Icons
import interventionIcon from '../assets/icons/intervention.png';
import beneficiaryIcon from '../assets/icons/beneficiary.png';
import activitiesIcon from '../assets/icons/activities.png';
import budgetIcon from '../assets/icons/project.png';

// ─── Card Metadata ────────────────────────────────────────────────────────────
const CARDS = [
    {
        id: 'interventions',
        step: 1,
        label: 'Interventions',
        sublabel: 'Select what your school will implement',
        icon: interventionIcon,
        color: 'bg-siif-blue',
    },
    {
        id: 'beneficiaries',
        step: 2,
        label: 'Beneficiaries',
        sublabel: 'Who will be served by each intervention?',
        icon: beneficiaryIcon,
        color: 'bg-siif-blue',
    },
    {
        id: 'activities',
        step: 3,
        label: 'Activities',
        sublabel: 'Plan activities per intervention',
        icon: activitiesIcon,
        color: 'bg-siif-blue',
    },
    {
        id: 'budget',
        step: 4,
        label: 'Budget Estimation',
        sublabel: 'Enter estimated budget per intervention',
        icon: budgetIcon,
        color: 'bg-siif-blue',
    },
];

const TOTAL_STEPS = CARDS.length;

// ─── Main Component ───────────────────────────────────────────────────────────
const SIIFFormsHub = ({ user, token }) => {
    const navigate = useNavigate();
    const [activeCard, setActiveCard] = useState(null);
    const [saving, setSaving] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [syncStatus, setSyncStatus] = useState('saved'); // 'saved', 'saving', 'error'

    // Summary modal states
    const [showSummaryModal, setShowSummaryModal] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [confirmError, setConfirmError] = useState(false);

    // ─── Data + state from hook ───────────────────────────────────────────────
    const {
        loading, error,
        deadline, openDate, isExpired, isNotYetOpen,
        submissionId, isLocked, isDisapproved, rejectionReason, allocation,
        selectedInterventions, setSelectedInterventions,
        aral, setAral,
        beneficiaries, setBeneficiaries,
        activities, setActivities,
        budgets, setBudgets,
        confirmed, setConfirmed,
    } = useSIIFSubmission(user, token);

    logger.debug('SIIF', 'SIIFFormsHub Rendered', { confirmed, selectedInterventions });

    // ─── Debounced Auto-save ──────────────────────────────────────────────────
    useEffect(() => {
        if (isExpired || isNotYetOpen || selectedInterventions.length === 0) return;

        // Prevent auto-save on initial load (if data is still null)
        if (Object.keys(beneficiaries).length === 0 && selectedInterventions.length > 0) return;

        setSyncStatus('saving');
        const timer = setTimeout(() => {
            handleSaveDraft(true)
                .then(() => setSyncStatus('saved'))
                .catch(() => setSyncStatus('error'));
        }, 3000); // 3-second debounce for "Master Architect" resilience

        return () => clearTimeout(timer);
    }, [selectedInterventions, beneficiaries, activities, budgets, aral, isExpired, isNotYetOpen]);

    // ─── Derived ──────────────────────────────────────────────────────────────
    const confirmedCount = Object.values(confirmed).filter(Boolean).length;
    const progressPct = Math.round((confirmedCount / TOTAL_STEPS) * 100);
    const allConfirmed = confirmedCount === TOTAL_STEPS;
    const totalBudget = Object.values(budgets || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0);

    // Calculate total beneficiaries (learners) and total activities for summary
    let totalLearners = 0;
    selectedInterventions.forEach(intId => {
        const data = (beneficiaries && beneficiaries[intId]) || {};
        if (data.beneficiaryCounts && typeof data.beneficiaryCounts === 'object') {
            Object.values(data.beneficiaryCounts).forEach(count => {
                totalLearners += (parseInt(count) || 0);
            });
        }
    });

    let totalActivities = 0;
    selectedInterventions.forEach(intId => {
        const data = (activities && activities[intId]) || {};
        if (data.selectedActivities && typeof data.selectedActivities === 'object') {
            Object.values(data.selectedActivities).forEach(list => {
                if (Array.isArray(list)) {
                    totalActivities += list.filter(a => a !== 'Others (specify)').length;
                }
            });
        }
        if (typeof data.otherActivity === 'string' && data.otherActivity.trim().length > 0) {
            totalActivities += 1;
        }
    });

    // ─── Lock chain: interventions → beneficiaries → activities → budget ──────
    const isCardLocked = (cardId) => {
        // 1. [TEMPORAL LOCK] If deadline expired or not yet open, unlock for READ-ONLY viewing
        if (isExpired || isNotYetOpen) return false;

        // 2. [ARCHITECTURAL BYPASS] If submission exists in DB, unlock ALL cards
        // This allows users to jump directly to any section when re-editing.
        if (submissionId) {
            console.log(`🔓 [SIIF_BYPASS] Submission ID ${submissionId} exists. Unlocking ${cardId} for direct access.`);
            return false;
        }

        // 3. [SEQUENTIAL LOCK] Fresh submission hierarchy
        if (cardId === 'interventions') return false;
        if (cardId === 'beneficiaries') return !confirmed.interventions;
        if (cardId === 'activities') return !confirmed.beneficiaries;
        if (cardId === 'budget') return !confirmed.activities;

        return false;
    };

    const getCardStatus = (cardId) => {
        if (isNotYetOpen) return 'locked';
        if (confirmed[cardId]) return 'confirmed';
        if (isCardLocked(cardId)) return 'locked';
        return 'pending';
    };

    const handleCardClick = (cardId) => {
        const locked = isCardLocked(cardId);
        const readOnlyMode = isExpired || isNotYetOpen;

        console.log('🛡️ [SIIF_HUB_DIAGNOSTIC]', {
            cardId,
            isLockedState: isLocked,
            isExpiredState: isExpired,
            isNotYetOpenState: isNotYetOpen,
            isCardLocked: locked,
            finalReadOnly: readOnlyMode
        });

        if (locked) {
            console.warn(`🔒 [SIIFFormsHub] Access Denied: Card "${cardId}" is locked or requires previous steps.`);
            return;
        }

        console.log(`🌐 [SIIFFormsHub] Rendering Card Interface: ${cardId} ${readOnlyMode ? '(READ-ONLY)' : '(EDITABLE)'}`);
        setActiveCard(cardId);
    };

    const closeCard = (cardId) => {
        console.log(`👈 [SIIFFormsHub] Closing ${cardId}.`);
        setActiveCard(null);
    };

    // ─── Confirm handlers ─────────────────────────────────────────────────────
    const confirm = (cardId) => {
        if (isExpired || isNotYetOpen) {
            setActiveCard(null);
            return;
        }
        console.log(`✅ [SIIFFormsHub] ${cardId} confirmed. State updated.`);
        setConfirmed(p => ({ ...p, [cardId]: true }));
        setActiveCard(null);
        handleSaveDraft(true);
    };

    // ─── Build API payload ────────────────────────────────────────────────────
    const buildPayload = (status) => {
        // Robustly resolve schoolId from user object
        const schoolId = user?.school_id || user?.schoolId || user?.id || user?.sub;

        console.log('🏗️ [SIIFFormsHub] buildPayload derived schoolId:', schoolId);
        console.log('👤 [SIIFFormsHub] user state:', {
            hasUser: !!user,
            idKeys: {
                school_id: user?.school_id,
                schoolId: user?.schoolId,
                id: user?.id,
                sub: user?.sub
            },
            tokenExists: !!user?.token
        });

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
            status,
            interventions: selectedInterventions,
            aral,
            budgetEstimates: budgets,
            totalBudget,
            interventionData,
        };

        console.log(`📤 [SIIFFormsHub] Built Payload (${status}):`, JSON.stringify(payload, null, 2));
        return payload;
    };

    // ─── Save Draft ───────────────────────────────────────────────────────────
    const handleSaveDraft = async (silent = false) => {
        if (selectedInterventions.length === 0) {
            console.warn('⚠️ [SIIFFormsHub] No interventions to draft.');
            return;
        }
        if (!silent) setSaving(true);
        const currentStatus = isLocked ? 'submitted' : 'draft';
        const payload = buildPayload(currentStatus);
        console.log('📤 [SIIFFormsHub] Saving draft (silent=' + silent + ', status=' + currentStatus + ')');
        try {
            const data = await submitPlan(payload, token);
            console.log('📬 [SIIFFormsHub] Draft response:', data);
            console.log('✅ [SIIFFormsHub] Draft saved. ID:', data.submissionId);
            if (!silent) alert('Draft saved successfully!');
        } catch (err) {
            console.error('🔥 [SIIFFormsHub] Draft save failed:', err);
            if (!silent) alert(`Error saving draft: ${err.message}`);
        } finally {
            if (!silent) setSaving(false);
        }
    };

    const proceedToSummary = async () => {
        setSaving(true);
        await handleSaveDraft(true);
        setSaving(false);
        navigate('/siif/summary', {
            state: {
                selectedInterventions,
                aral,
                beneficiaries,
                activities,
                budgets,
                allocation,
                deadline,
                status: isDisapproved ? 'Disapproved' : (isLocked ? 'submitted' : 'draft'),
                rejectionReason: rejectionReason
            }
        });
    };

    // ─── Final Submit ─────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!allConfirmed) {
            alert('Please confirm all cards before submitting.');
            return;
        }
        setSubmitting(true);
        const payload = buildPayload('submitted');

        // ─── Budget Validation ──────────────────────────────────────────────
        const allocAmt = allocation ? (parseFloat(allocation.allocation_amount) || 0) : 0;

        // If allocation is null or 0, we prevent submission to be safe
        if (!allocation || allocAmt <= 0) {
            alert(`⚠️ Allocation Missing\n\nYou cannot submit a plan without a verified budget allocation. Please wait for the allocation to load or contact the Division Office.`);
            setSubmitting(false);
            return;
        }

        if (totalBudget > allocAmt) {
            alert(`⛔ Budget Over Limit\n\nYour total estimate (₱${totalBudget.toLocaleString()}) exceeds the official allocation (₱${allocAmt.toLocaleString()}).\n\nPlease go back and adjust your budget before submitting.`);
            setSubmitting(false);
            return;
        }

        if (!payload.schoolId) {
            console.warn('⚠️ [SIIFFormsHub] schoolId missing in payload, relying on backend fallback.');
        }

        console.log('🚀 [SIIFFormsHub] Final submit payload built.');
        try {
            const data = await submitPlan(payload, token);
            console.log('📬 [SIIFFormsHub] Submit response:', data);
            console.log('✅ [SIIFFormsHub] Submitted. ID:', data.submissionId);
            if (isLocked) {
                alert(`✅ Plan Updated Successfully!\n\nIMPORTANT: Your latest updates have been submitted and are For Review of Division. You can still make changes and submit updates until the deadline (${deadline ? new Date(deadline).toLocaleString() : 'N/A'}).`);
            } else {
                alert(`✅ Plan Submitted Successfully!\n\nIMPORTANT: Your plan has been submitted and is now For Review of Division. You can still edit and submit updates until the deadline (${deadline ? new Date(deadline).toLocaleString() : 'N/A'}).\n\nOnce submitted, you can also start updating your fund utilization in the main dashboard.`);
            }
            navigate('/siif');
        } catch (err) {
            console.error('🔥 [SIIFFormsHub] Submit failed:', err);
            alert(`Error submitting: ${err.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    // ─── Card summary text ────────────────────────────────────────────────────
    const getCardSummary = (cardId) => {
        if (!confirmed[cardId]) return null;
        if (cardId === 'interventions') {
            return `${selectedInterventions.length} intervention${selectedInterventions.length !== 1 ? 's' : ''} selected`;
        }
        if (cardId === 'beneficiaries') {
            const summary = Object.entries(beneficiaries || {}).map(([id, d]) => {
                if (!d) return null;
                const count = Object.values(d.beneficiaryCounts || {}).reduce((a, v) => a + (parseInt(v) || 0), 0);
                if (count === 0) return null;
                const label = INTERVENTIONS.find(i => i.id === id)?.label || id;
                return `${label}: ${count.toLocaleString()}`;
            }).filter(Boolean).join(' • ');
            return summary || 'No learners selected';
        }
        if (cardId === 'activities') {
            const summary = Object.entries(activities || {}).map(([id, d]) => {
                if (!d) return null;
                const count = Object.values(d.selectedActivities || {}).flat().length;
                if (count === 0) return null;
                const label = INTERVENTIONS.find(i => i.id === id)?.label || id;
                return `${label}: ${count} activities`;
            }).filter(Boolean).join(' • ');
            return summary || 'No activities planned';
        }
        if (cardId === 'budget') {
            return `₱${totalBudget.toLocaleString('en-PH', { minimumFractionDigits: 2 })} total`;
        }
        return null;
    };

    // ─── Render ───────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-deped-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-sm font-black text-slate-800 uppercase tracking-widest italic animate-pulse">Initializing Planner...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="bg-white p-8 rounded-[3rem] shadow-2xl border border-red-100 max-w-sm w-full text-center">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <FiAlertCircle size={32} />
                    </div>
                    <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-2">Connection Error</h2>
                    <p className="text-xs text-slate-500 font-bold leading-relaxed mb-6">
                        We couldn't load your submission data. Please check your internet connection and try again.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="w-full py-4 bg-deped-blue text-white rounded-2xl font-black text-sm uppercase tracking-widest"
                    >
                        Retry Loading
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="pb-32 text-lg">

            {/* ── Header ── */}
            <div className="siif-topbar siif-topbar-flush flex-col items-stretch !items-start !justify-start gap-4 sm:gap-6 pb-6 sm:pb-8 print:hidden">
                <div className="flex items-center justify-between w-full relative z-10 mb-2">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/siif')} className="p-3 bg-white hover:bg-slate-50 shadow-sm border border-slate-200 rounded-2xl transition-all text-slate-600">
                            <TbChevronLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-xl font-black italic tracking-tight uppercase leading-none text-slate-800">Planning Hub</h1>
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                                {deadline ? `Deadline: ${new Date(deadline).toLocaleDateString()} @ ${new Date(deadline).toLocaleTimeString()}` : 'No Deadline Set'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleSaveDraft}
                        disabled={saving || selectedInterventions.length === 0 || isExpired || isNotYetOpen}
                        className="p-3 bg-white hover:bg-slate-50 shadow-sm border border-slate-200 rounded-2xl disabled:opacity-40 relative text-slate-600"
                        title="Save Draft"
                    >
                        <FiSave size={20} />
                        {syncStatus === 'saving' && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-siif-yellow rounded-full border-2 border-white animate-pulse" />
                        )}
                        {syncStatus === 'saved' && selectedInterventions.length > 0 && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white" />
                        )}
                    </button>
                </div>

                {/* Progress donut */}
                <div className="relative z-10 flex items-center gap-6 w-full">
                    <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="4" />
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none" stroke="var(--blue)" strokeWidth="4"
                                strokeDasharray={`${progressPct}, 100`}
                                style={{ transition: 'stroke-dasharray 0.6s ease' }}
                            />
                        </svg>
                        <span className="absolute text-sm font-black text-slate-800">{progressPct}%</span>
                    </div>
                    <div>
                        <p className="text-xl font-black italic leading-tight text-slate-800">
                            {isExpired ? 'Deadline Passed' : isNotYetOpen ? 'Waiting to Open' : allConfirmed ? 'Ready to Submit!' : confirmedCount === 0 ? "Let's Get Started" : `${confirmedCount}/${TOTAL_STEPS} Complete`}
                        </p>
                        <p className="text-slate-500 text-[11px] font-bold mt-1">
                            {isExpired
                                ? (deadline ? `Window closed on ${new Date(deadline).toLocaleString()}.` : 'Submission window is closed.')
                                : isNotYetOpen
                                    ? `Opening on ${new Date(openDate).toLocaleString()}.`
                                    : syncStatus === 'saving'
                                        ? '🔄 Syncing changes...'
                                        : isLocked
                                            ? `✅ Submitted (Editable until ${deadline ? new Date(deadline).toLocaleString([], { dateStyle: 'long', timeStyle: 'short' }) : 'deadline'})`
                                            : `${TOTAL_STEPS - confirmedCount} section${TOTAL_STEPS - confirmedCount !== 1 ? 's' : ''} remaining`}
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Warning Banner Area (Repositioned to Top) ── */}
            <div className="px-5 relative z-20 mt-4 space-y-3">
                <AnimatePresence>
                    {isExpired && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-4 bg-slate-900 text-white rounded-3xl border border-slate-800 flex items-center gap-4 shadow-xl"
                        >
                            <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center shrink-0">
                                <TbLock size={20} className="text-slate-300" />
                            </div>
                            <div className="flex-1">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Window Closed</p>
                                <p className="text-[11px] font-bold leading-tight">The submission deadline for FY 2026 has passed. Read-only mode active.</p>
                            </div>
                        </motion.div>
                    )}

                    {isNotYetOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-4 bg-siif-blue text-white rounded-3xl border border-white/10 flex items-center gap-4 shadow-xl"
                        >
                            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                                <TbClock size={20} className="text-white animate-pulse" />
                            </div>
                            <div className="flex-1">
                                <p className="text-[10px] font-black uppercase tracking-widest text-blue-200">Opening Soon</p>
                                <p className="text-[11px] font-bold leading-tight">Scheduled to open on {openDate ? new Date(openDate).toLocaleString() : 'a future date'}.</p>
                            </div>
                        </motion.div>
                    )}

                    {isDisapproved && !isExpired && !isNotYetOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-5 bg-red-500/10 text-slate-900 rounded-[2.5rem] border-2 border-red-500/30 backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg"
                        >
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-red-500/20 text-red-600 rounded-xl flex items-center justify-center shrink-0 border border-red-500/20">
                                    <TbX size={24} className="animate-pulse" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-red-600">Plan Disapproved by Division Office</p>
                                    <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mt-1.5">Remarks / Correction Instructions:</p>
                                    <p className="text-xs text-slate-700 font-extrabold italic mt-1.5 bg-red-500/5 p-3.5 rounded-xl border border-red-500/10 leading-relaxed">
                                        "{rejectionReason || 'No remarks provided.'}"
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Cards ── */}
            <div className={`px-5 relative z-20 space-y-4 mt-4`}>
                {CARDS.map((card, idx) => {
                    const status = getCardStatus(card.id);
                    const locked = status === 'locked';
                    const done = status === 'confirmed';
                    const summary = getCardSummary(card.id);
                    const Icon = card.icon;

                    return (
                        <motion.div
                            key={card.id}
                            initial={{ opacity: 0, y: 24 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.07, duration: 0.3 }}
                        >
                            <button
                                onClick={() => handleCardClick(card.id)}
                                disabled={locked}
                                className={`w-full p-6 rounded-[2.5rem] border border-slate-100 border-b-8 flex items-center gap-5 text-left relative transition-all duration-300 active:scale-[0.98] ${locked
                                    ? 'bg-slate-100 border-slate-100 opacity-60 cursor-not-allowed'
                                    : done
                                        ? 'bg-white border-slate-100 shadow-md border-b-slate-200'
                                        : 'bg-white border-blue-50 border-b-blue-500 shadow-lg shadow-blue-500/10 hover:border-blue-100'
                                    }`}
                            >
                                {/* Status strip */}
                                {!locked && (
                                    <div className={`absolute left-0 top-6 bottom-6 w-1.5 rounded-r-full ${done ? 'bg-emerald-400' : 'bg-orange-400 animate-pulse'}`} />
                                )}

                                {/* Icon */}
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shrink-0 ${locked ? 'bg-slate-300' : done ? 'bg-emerald-500' : card.color
                                    } shadow-md`}>
                                    {locked
                                        ? <TbLock size={24} />
                                        : done
                                            ? <TbCircleCheck size={26} />
                                            : (typeof Icon === 'string' 
                                                ? <img src={Icon} alt={card.label} className="w-8 h-8 object-contain" />
                                                : <Icon size={26} />
                                              )}
                                </div>

                                {/* Text */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <p className={`font-black text-sm uppercase tracking-tight ${locked ? 'text-slate-400' : 'text-slate-800'}`}>
                                            {card.label}
                                        </p>
                                        {done && (
                                            <span className="text-[8px] font-black bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-100 uppercase tracking-widest">Done</span>
                                        )}
                                        {!done && !locked && (
                                            <FiAlertCircle className="text-orange-400 text-xs animate-pulse" />
                                        )}
                                        {locked && (
                                            <span className="text-[8px] font-black bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-widest">Locked</span>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-slate-400 leading-relaxed">
                                        {done && summary ? summary : locked ? (isNotYetOpen ? 'Scheduled to open soon' : `Complete step ${card.step - 1} first`) : card.sublabel}
                                    </p>
                                </div>

                                {!locked && <TbChevronRight className="text-slate-300 shrink-0" size={20} />}
                            </button>
                        </motion.div>
                    );
                })}

                {/* ── Submit / View Summary CTA ── */}
                <AnimatePresence>
                    {(selectedInterventions.length > 0 || isLocked || isExpired) && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="mt-6 space-y-4 px-5"
                        >
                            <button
                                onClick={() => setShowSummaryModal(true)}
                                className="w-full py-6 bg-siif-blue hover:bg-siif-blue/90 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                            >
                                {isLocked || isExpired ? 'View Submitted Plan Summary' : 'View Summary'}
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Full-screen card panels ── */}
            <AnimatePresence>
                {activeCard === 'interventions' && (
                    <motion.div key="int" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.25 }} className="fixed inset-0 z-[1050] flex flex-col overflow-hidden bg-slate-50">
                        <InterventionsCard
                            value={selectedInterventions}
                            aral={aral}
                            onChange={setSelectedInterventions}
                            onAralChange={setAral}
                            onConfirm={() => confirm('interventions')}
                            onClose={() => closeCard('interventions')}
                            readOnly={isExpired || isNotYetOpen}
                        />
                    </motion.div>
                )}
                {activeCard === 'beneficiaries' && (
                    <motion.div key="ben" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.25 }} className="fixed inset-0 z-[1050] flex flex-col overflow-hidden bg-slate-50">
                        <BeneficiariesCard
                            selectedInterventions={selectedInterventions}
                            value={beneficiaries}
                            aral={aral}
                            onChange={setBeneficiaries}
                            onConfirm={() => confirm('beneficiaries')}
                            onClose={() => closeCard('beneficiaries')}
                            readOnly={isExpired || isNotYetOpen}
                        />
                    </motion.div>
                )}
                {activeCard === 'activities' && (
                    <motion.div key="act" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.25 }} className="fixed inset-0 z-[1050] flex flex-col overflow-hidden bg-slate-50">
                        <ActivitiesCard
                            selectedInterventions={selectedInterventions}
                            value={activities}
                            onChange={setActivities}
                            onConfirm={() => confirm('activities')}
                            onClose={() => closeCard('activities')}
                            readOnly={isExpired || isNotYetOpen}
                        />
                    </motion.div>
                )}
                {activeCard === 'budget' && (
                    <motion.div key="bud" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.25 }} className="fixed inset-0 z-[1050] flex flex-col overflow-hidden bg-slate-50">
                        <BudgetCard
                            user={user}
                            interventions={selectedInterventions}
                            budgets={budgets}
                            setBudgets={setBudgets}
                            beneficiaries={beneficiaries}
                            onConfirm={() => confirm('budget')}
                            onClose={() => closeCard('budget')}
                            isLocked={isExpired || isNotYetOpen}
                            allocation={allocation}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── View Summary Overlay Modal ── */}
            <AnimatePresence>
                {showSummaryModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{ zIndex: 9999 }}
                        className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[9999] flex flex-col justify-center items-center p-4 overflow-hidden"
                    >
                        <motion.div
                            initial={{ y: '100%', opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: '100%', opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="bg-slate-50 w-full sm:max-w-2xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-200"
                        >
                            {/* Modal Header */}
                            <div className="bg-siif-blue text-white px-6 py-5 rounded-b-[2rem] shadow-lg relative overflow-hidden shrink-0">
                                <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />
                                <div className="relative z-10 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setShowSummaryModal(false)}
                                            className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-all border border-white/10 text-white"
                                        >
                                            <TbArrowLeft size={16} />
                                        </button>
                                        <div>
                                            <h2 className="text-base font-black italic uppercase tracking-tight">Implementation Plan Summary</h2>
                                            <p className="text-[9px] font-bold text-blue-200 uppercase tracking-widest mt-0.5">
                                                FY {allocation?.fiscal_year || new Date().getFullYear()} · {allocation?.school_name || user?.school_name || 'Your School'}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowSummaryModal(false)}
                                        className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all border border-white/10 text-white"
                                    >
                                        <TbX size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
                                
                                {/* Metrics Cards Grid */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Interventions</p>
                                        <p className="text-base font-black text-siif-blue">{selectedInterventions.length}</p>
                                    </div>
                                    <div className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Total Learners</p>
                                        <p className="text-base font-black text-siif-blue">{totalLearners.toLocaleString()}</p>
                                    </div>
                                    <div className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Total Budget</p>
                                        <p className="text-base font-black text-emerald-600">₱{totalBudget.toLocaleString('en-PH', { maximumFractionDigits: 0 })}</p>
                                    </div>
                                </div>

                                {/* Budget Progress vs Allocation */}
                                {allocation && (
                                    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-3">
                                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-500">
                                            <span>Budget vs. Allocation Limit</span>
                                            <span className="text-siif-blue">
                                                ₱{totalBudget.toLocaleString('en-PH', { maximumFractionDigits: 0 })} / ₱{(parseFloat(allocation.allocation_amount) || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}
                                            </span>
                                        </div>
                                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden p-[2px]">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${
                                                    totalBudget > (parseFloat(allocation.allocation_amount) || 0)
                                                        ? 'bg-red-500 shadow-[0_0_10px_#ef4444]'
                                                        : 'bg-siif-blue'
                                                }`}
                                                style={{ width: `${Math.min(100, (totalBudget / (parseFloat(allocation.allocation_amount) || 1)) * 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                                    {selectedInterventions.map((intId, idx) => {
                                        const info = INTERVENTIONS.find(i => i.id === intId);
                                        const budget = budgets?.[intId] || 0;
                                        
                                        // Beneficiary Info
                                        const benData = beneficiaries?.[intId] || {};
                                        const selectedGrades = Array.isArray(benData.selectedGrades) ? benData.selectedGrades : [];
                                        const beneficiaryCounts = benData.beneficiaryCounts || {};
                                        const grades = selectedGrades.filter(g => (parseInt(beneficiaryCounts?.[g]) || 0) > 0);
                                        
                                        // Activities Info
                                        const actData = activities?.[intId] || {};
                                        const selectedActivities = actData.selectedActivities || {};
                                        const otherActivity = actData.otherActivity || '';
                                        const categories = [
                                            { key: 'sip_aip', label: 'SIP–AIP Aligned' },
                                            { key: 'action_research', label: 'Action Research' },
                                            { key: 'remaining', label: 'Remaining Balance' }
                                        ];

                                        return (
                                            <div key={intId} className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
                                                <div className="flex justify-between items-start border-b border-slate-50 pb-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-siif-blue/5 text-siif-blue flex items-center justify-center shrink-0">
                                                            {INTERVENTION_ICONS[intId] || <TbTarget size={20} />}
                                                        </div>
                                                        <div>
                                                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">{info?.label || intId}</h4>
                                                            <span className="text-[8px] font-black bg-blue-50 text-siif-blue px-2 py-0.5 rounded-md uppercase tracking-wider">Intervention #{idx + 1}</span>
                                                        </div>
                                                    </div>
                                                    <p className="text-xs font-black text-emerald-600 bg-emerald-50/50 px-3 py-1 rounded-full border border-emerald-100">
                                                        ₱{(parseFloat(budget) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                                    </p>
                                                </div>

                                                {/* Beneficiaries Section - Grouped by Key Stage */}
                                                <div className="space-y-1.5">
                                                    <p className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest">Target Beneficiaries (Key Stages)</p>
                                                    {grades.length > 0 ? (
                                                        <div className="grid grid-cols-1 gap-2 pl-1">
                                                            {KEY_STAGES.map(ks => {
                                                                const activeGradesInKs = ks.grades.filter(g => grades.includes(g));
                                                                if (activeGradesInKs.length === 0) return null;
                                                                const ksTotal = activeGradesInKs.reduce((sum, g) => sum + (parseInt(beneficiaryCounts?.[g]) || 0), 0);
                                                                return (
                                                                    <div key={ks.id} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col gap-1">
                                                                        <div className="flex justify-between items-center text-[8.5px] font-black text-slate-500 uppercase">
                                                                            <span>{ks.label}</span>
                                                                            <span className="text-siif-blue bg-siif-blue/5 px-2 py-0.5 rounded-md">Total: {ksTotal.toLocaleString()}</span>
                                                                        </div>
                                                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                                                            {activeGradesInKs.map(g => (
                                                                                <span key={g} className="text-[8px] font-black bg-white text-slate-600 px-2 py-0.5 rounded-lg border border-slate-100">
                                                                                    {GRADE_LABELS[g] || g}: <span className="text-siif-blue">{beneficiaryCounts?.[g] || 0}</span>
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <p className="text-[10px] text-slate-400 italic pl-1">No beneficiaries configured.</p>
                                                    )}
                                                </div>

                                                {/* Activities Section - Grouped by Category */}
                                                <div className="space-y-1.5">
                                                    <p className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest">Planned Activities</p>
                                                    <div className="pl-1 space-y-2">
                                                        {categories.map(cat => {
                                                            const items = Array.isArray(selectedActivities?.[cat.key]) ? selectedActivities[cat.key] : [];
                                                            if (items.length === 0) return null;
                                                            return (
                                                                <div key={cat.key} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-wider mb-1">{cat.label}</p>
                                                                    <div className="space-y-1">
                                                                        {items.map((act, i) => {
                                                                            const display = act === 'Others (specify)' ? (otherActivity ? `Other: ${otherActivity}` : 'Other') : act;
                                                                            return (
                                                                                <div key={i} className="flex items-start gap-2 bg-white px-2 py-1 rounded-lg border border-slate-100">
                                                                                    <div className="w-3.5 h-3.5 rounded bg-siif-blue text-white flex items-center justify-center shrink-0 mt-0.5">
                                                                                        <TbCheck size={8} />
                                                                                    </div>
                                                                                    <p className="text-[9px] text-slate-600 font-bold leading-snug">{display}</p>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                        {!categories.some(cat => (Array.isArray(selectedActivities?.[cat.key]) ? selectedActivities[cat.key] : []).length > 0) && (
                                                            <p className="text-[10px] text-slate-400 italic">No activities planned.</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                            {/* Modal Footer / Submit Attestation */}
                            <div className="p-6 bg-white border-t border-slate-200 shrink-0">
                                {isExpired ? (
                                    <div className="space-y-4">
                                        <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center gap-3">
                                            <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center shrink-0">
                                                <TbLock size={16} className="text-slate-300" />
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black uppercase text-slate-400">Read-Only Mode</p>
                                                <p className="text-[10px] font-bold leading-tight">
                                                    The submission deadline has passed. This proposal cannot be modified.
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setShowSummaryModal(false)}
                                            className="w-full py-4.5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-md transition-all active:scale-[0.98]"
                                        >
                                            Close Summary View
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {/* Plan Status Banner for Division Disapproval */}
                                        {isDisapproved && (
                                            <div className="p-4.5 bg-red-50 text-red-600 rounded-3xl border border-red-100 flex flex-col gap-2 mb-2 shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-red-100 rounded-2xl flex items-center justify-center shrink-0 border border-red-200">
                                                        <TbX size={20} className="text-red-600 animate-pulse" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-red-600">Plan Status: Disapproved by Division</p>
                                                        <p className="text-[10.5px] font-bold leading-snug text-slate-700">
                                                            Please address the SDO comments below before resubmitting.
                                                        </p>
                                                    </div>
                                                </div>
                                                <p className="text-xs font-extrabold italic text-slate-700 bg-white p-3 rounded-xl border border-slate-100 mt-1 leading-relaxed">
                                                    "{rejectionReason || 'No remarks provided.'}"
                                                </p>
                                            </div>
                                        )}

                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                                            {!allConfirmed && (
                                                <p className="text-[10px] text-amber-600 font-bold text-center mb-1 leading-snug animate-pulse">
                                                    ⚠️ PLAN INCOMPLETE: You must confirm all cards in the Planning Hub before you can finalize and submit.
                                                </p>
                                            )}
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">
                                                Type <span className="text-siif-blue font-black">CONFIRM</span> to Finalize and Submit
                                            </p>
                                            <input
                                                type="text"
                                                placeholder="Type CONFIRM here..."
                                                disabled={!allConfirmed}
                                                value={confirmText}
                                                onChange={e => setConfirmText(e.target.value)}
                                                className={`w-full px-5 py-3 rounded-xl border-2 font-black text-xs tracking-widest text-center transition-all focus:outline-none ${
                                                    !allConfirmed
                                                        ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                                                        : confirmError
                                                            ? 'border-red-400 bg-red-50 text-red-600 animate-shake'
                                                            : 'border-slate-200 bg-white text-slate-800 focus:border-siif-blue'
                                                }`}
                                            />
                                        </div>

                                        <div className="flex gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setShowSummaryModal(false)}
                                                className="py-4 px-6 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-[0.98]"
                                            >
                                                Back
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    if (!allConfirmed) {
                                                        alert('Please confirm all cards before submitting.');
                                                        return;
                                                    }
                                                    if (confirmText.trim().toUpperCase() !== 'CONFIRM') {
                                                        setConfirmError(true);
                                                        setTimeout(() => setConfirmError(false), 2000);
                                                        return;
                                                    }
                                                    setShowSummaryModal(false);
                                                    await handleSubmit();
                                                }}
                                                disabled={submitting || totalBudget > (parseFloat(allocation?.allocation_amount) || 0) || !allConfirmed}
                                                className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {submitting ? 'Submitting...' : isLocked ? 'Update Submitted Plan 🚀' : 'Submit Final Plan 🚀'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SIIFFormsHub;
