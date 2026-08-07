// SIIFFormsHub.jsx
// The /forms route — 4-card hub with sequential locking
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TbChevronLeft, TbCircleCheck, TbLock,
    TbTarget, TbUsers, TbBulb, TbCurrencyPeso,
    TbChevronRight, TbClock, TbTrendingUp,
    TbArrowLeft, TbX, TbCheck, TbArrowRight, TbEdit,
    TbSettings, TbClipboardList, TbCalculator, TbChartBar
} from 'react-icons/tb';
import { FiSave, FiAlertCircle } from 'react-icons/fi';
import { logger } from '../utils/logger';
import PriorityImprovementAreaCard from './cards/PriorityImprovementAreaCard';
import InterventionsCard from './cards/InterventionsCard';
import BeneficiariesCard from './cards/BeneficiariesCard';
import ActivitiesCard from './cards/ActivitiesCard';
import BudgetCard from './cards/BudgetCard';
import { INTERVENTIONS, INTERVENTION_ICONS, KEY_STAGES, GRADE_LABELS, emptyIntData } from '../constants/siifConstants';
import { submitPlan } from '../services/siifService';
import { useSIIFSubmission } from '../hooks/useSIIFSubmission';
import SiifLoader from '../components/SiifLoader';

// Custom Flaticon Icons
import interventionIcon from '../assets/icons/intervention.png';
import beneficiaryIcon from '../assets/icons/beneficiary.png';
import activitiesIcon from '../assets/icons/activities.png';
import budgetIcon from '../assets/icons/project.png';

// ─── Card Metadata ────────────────────────────────────────────────────────────
const CARDS = [
    {
        id: 'pia',
        step: 1,
        label: 'Priority Improvement Areas',
        sublabel: 'Identify priority improvement areas',
        icon: TbTrendingUp, // Performance icon
        color: 'bg-siif-blue',
    },
    {
        id: 'interventions',
        step: 2,
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
    const [activePiaCategory, setActivePiaCategory] = useState('Access and Quality');

    // ─── Data + state from hook ───────────────────────────────────────────────
    const {
        loading, error,
        deadline, openDate, isExpired, isNotYetOpen,
        submissionId, isLocked, isReviewed, isSubmitted, isDisapproved, remarks, allocation,
        priorityAreas, setPriorityAreas,
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
        if (loading || isExpired || isNotYetOpen || isLocked) return;

        // Prevent auto-save on initial load (if data is still null)
        if (Object.keys(beneficiaries).length === 0 && selectedInterventions.length > 0) return;

        setSyncStatus('saving');
        const timer = setTimeout(() => {
            handleSaveDraft(true)
                .then(() => setSyncStatus('saved'))
                .catch(() => setSyncStatus('error'));
        }, 3000); // 3-second debounce for "Master Architect" resilience

        return () => clearTimeout(timer);
    }, [loading, priorityAreas, selectedInterventions, beneficiaries, activities, budgets, aral, isExpired, isNotYetOpen, isLocked]);

    // ─── Missing Data Check ───────────────────────────────────────────────────
    const isMissingData = (cardId) => {
        if (cardId === 'pia') {
            return !priorityAreas || priorityAreas.filter(a => a && a.trim().length > 0).length === 0;
        }

        if (selectedInterventions.length === 0) return false;

        if (cardId === 'beneficiaries') {
            return selectedInterventions.some(intId => {
                const counts = beneficiaries?.[intId]?.beneficiaryCounts || {};
                const total = Object.values(counts).reduce((s, v) => s + (parseInt(v) || 0), 0);
                return total <= 0;
            });
        }
        if (cardId === 'activities') {
            return selectedInterventions.some(intId => {
                const selectedAct = activities?.[intId]?.selectedActivities || {};
                const count = Object.values(selectedAct).flat().filter(Boolean).length;
                const other = activities?.[intId]?.otherActivity || '';
                return count === 0 && other.trim().length === 0;
            });
        }
        if (cardId === 'budget') {
            return selectedInterventions.some(intId => {
                const b = parseFloat(budgets?.[intId]) || 0;
                return b <= 0;
            });
        }
        return false;
    };

    // ─── Derived ──────────────────────────────────────────────────────────────
    const confirmedCount = CARDS.filter(card => confirmed[card.id] && !isMissingData(card.id)).length;
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
        if (isExpired || isNotYetOpen || isLocked) return false;

        // (Architectural Bypass removed to enforce strict sequential locking during drafting)

        // 3. [SEQUENTIAL LOCK] Fresh submission hierarchy
        if (cardId === 'pia') return false;
        if (cardId === 'interventions') return !confirmed.pia;
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
        const readOnlyMode = isExpired || isNotYetOpen || isLocked;

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

    const confirm = (cardId) => {
        if (isExpired || isNotYetOpen || isLocked) {
            setActiveCard(null);
            return;
        }
        console.log(`✅ [SIIFFormsHub] ${cardId} confirmed. State updated.`);

        setConfirmed(p => {
            const next = { ...p, [cardId]: true };
            // Enforce sequential confirmation: modifying an upstream card resets downstream cards
            if (cardId === 'pia') {
                next.interventions = false;
                next.beneficiaries = false;
                next.activities = false;
                next.budget = false;
            } else if (cardId === 'interventions') {
                next.beneficiaries = false;
                next.activities = false;
                next.budget = false;
            } else if (cardId === 'beneficiaries') {
                next.activities = false;
                next.budget = false;
            } else if (cardId === 'activities') {
                next.budget = false;
            }
            return next;
        });

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
            priorityAreas,
        };

        console.log(`📤 [SIIFFormsHub] Built Payload (${status}):`, JSON.stringify(payload, null, 2));
        return payload;
    };

    // ─── Save Draft ───────────────────────────────────────────────────────────
    const handleSaveDraft = async (silent = false) => {
        if (isLocked) {
            console.warn('⚠️ [SIIFFormsHub] Plan is locked, cannot save draft.');
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
        if (!isLocked) {
            await handleSaveDraft(true);
        }
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
                status: isReviewed ? 'Reviewed' : (isDisapproved ? 'Disapproved' : (isSubmitted ? 'submitted' : 'draft')),
                remarks: remarks
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
            alert(`✅ Plan Submitted Successfully!\n\nIMPORTANT: Please wait for the SDO to review your submitted plan.`);
            window.location.reload();
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
        if (cardId === 'pia') {
            const count = (priorityAreas || []).filter(a => a && a.trim().length > 0).length;
            return `${count} priority area${count !== 1 ? 's' : ''} identified`;
        }
        if (cardId === 'interventions') {
            return `${selectedInterventions.length} intervention${selectedInterventions.length !== 1 ? 's' : ''} selected`;
        }
        if (cardId === 'beneficiaries') {
            return `${totalLearners.toLocaleString()} learner${totalLearners !== 1 ? 's' : ''} targeted`;
        }
        if (cardId === 'activities') {
            return `${totalActivities.toLocaleString()} activit${totalActivities !== 1 ? 'ies' : 'y'} planned`;
        }
        if (cardId === 'budget') {
            return `₱${totalBudget.toLocaleString('en-PH', { minimumFractionDigits: 2 })} total`;
        }
        return null;
    };



    // ─── Render ───────────────────────────────────────────────────────────────
    if (loading) {
        return <SiifLoader text="Initializing Planner..." />;
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
        <div className="w-full min-h-screen pb-28 text-lg">

            {/* ── Wide Hero Card Header Container (25% wider on each side than step cards) ── */}
            <div className="w-full max-w-3xl sm:max-w-4xl md:max-w-5xl lg:max-w-6xl mx-auto px-4 pt-4 md:pt-6">
                <header className="topbar print:hidden transition-all duration-300">
                    <div className="page-title">
                    <p className="eyebrow">
                        DEPARTMENT OF EDUCATION | HUMAN RESOURCE AND ORGANIZATIONAL DEVELOPMENT AND INFRASTRUCTURE
                    </p>
                    <h1 className="text-slate-950 dark:text-white font-extrabold text-xl sm:text-2xl md:text-3xl">School Innovation and Improvement Fund</h1>
                    
                    <div className="flex flex-row items-center gap-1.5 mt-3 opacity-90 w-full overflow-hidden">
                        {deadline && (
                            <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest flex items-center gap-1 px-2 sm:px-3 py-1 rounded-md shadow-sm whitespace-nowrap shrink" style={{ backgroundColor: '#EF4444', color: 'white', border: '1px solid #DC2626' }}>
                                <TbClock size={12} className="shrink-0" style={{ color: 'white' }} />
                                <span className="hidden sm:inline">Deadline: {new Date(deadline).toLocaleString()}</span>
                                <span className="sm:hidden truncate">Due: {new Date(deadline).toLocaleDateString()}</span>
                            </p>
                        )}
                        {isLocked && (
                            <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest px-2 sm:px-3 py-1 rounded-md shadow-sm flex items-center gap-1 whitespace-nowrap shrink-0" style={{ backgroundColor: '#F59E0B', color: 'white', border: '1px solid #D97706' }}>
                                <TbLock size={12} className="shrink-0" style={{ color: 'white' }} /> 
                                <span className="hidden sm:inline">Read-Only Mode</span>
                                <span className="sm:hidden">Read-Only</span>
                            </span>
                        )}
                    </div>
                </div>

                <div className="siif-topbar-actions w-full sm:w-auto mt-4 sm:mt-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    
                    {/* Submission Status Pill */}
                    <div className={`
                        flex items-center justify-center sm:justify-start gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl sm:rounded-[14px] font-black text-[10px] sm:text-[11px] uppercase tracking-wider text-white shadow-sm border border-white/10 self-start sm:self-auto
                        ${isReviewed ? 'bg-emerald-500' : isDisapproved ? 'bg-red-500' : isSubmitted ? 'bg-blue-600' : 'bg-slate-500/80'}
                    `}>
                        {isReviewed ? <TbCheck size={16} /> :
                         isDisapproved ? <TbX size={16} /> :
                         isSubmitted ? <TbArrowRight size={16} /> :
                         <TbEdit size={16} />}
                        <span>{isReviewed ? 'Reviewed' : isDisapproved ? 'Rejected' : isSubmitted ? 'Submitted' : 'Draft'}</span>
                    </div>

                    {/* Overall Progress */}
                    <section className="siif-school-pill w-full sm:w-auto flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 sm:gap-1 shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
                        <div className="flex flex-col items-start sm:items-end">
                            <small style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--slate-500)' }}>Forms Completion</small>
                            <strong style={{ fontSize: 'clamp(20px, 5vw, 28px)', background: 'linear-gradient(to right, var(--navy), var(--blue))', WebkitBackgroundClip: 'text', color: 'transparent', margin: 0, lineHeight: 1 }}>
                                {progressPct}%
                            </strong>
                        </div>
                        <div className="flex-1 sm:w-full" style={{ maxWidth: '120px', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${progressPct}%`, height: '100%', background: 'var(--blue)', transition: 'width 0.3s ease' }} />
                        </div>
                    </section>
                </div>
            </header>
            </div>

            {/* ── Center Form Step Cards Stack (Narrower max-w-2xl layout) ── */}
            <main className="w-full max-w-lg sm:max-w-xl md:max-w-2xl mx-auto px-4">
                {/* ── Warning Banner Area (Repositioned to Top) ── */}
                <div className="relative z-20 mt-4 space-y-3">
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


                    {isDisapproved && (
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
                                        "{remarks || 'No remarks provided.'}"
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Cards ── */}
            <div className="px-1 relative z-20 flex flex-col gap-3 mt-4">
                {CARDS.map((card, idx) => {
                    const status = getCardStatus(card.id);
                    const locked = status === 'locked';
                    const isMissing = isMissingData(card.id);
                    const done = status === 'confirmed' && !isMissing;
                    const missing = !locked && !done && isMissing;
                    const summary = getCardSummary(card.id);
                    const Icon = card.icon;

                    return (
                        <motion.div
                            key={card.id}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05, duration: 0.25 }}
                            className="w-full"
                        >
                            <button
                                onClick={() => handleCardClick(card.id)}
                                disabled={locked}
                                className={`w-full p-4 sm:p-5 rounded-2xl border flex items-center gap-4 text-left relative transition-all duration-200 group active:scale-[0.98] ${locked
                                    ? 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60 cursor-not-allowed'
                                    : done
                                        ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50 shadow-sm'
                                        : missing
                                            ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800/50 shadow-sm'
                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:border-blue-300'
                                    }`}
                            >
                                {/* Status indicator bar */}
                                {!locked && (
                                    <div className={`absolute left-0 top-3 bottom-3 w-1.5 rounded-r-full ${done ? 'bg-emerald-500' : missing ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`} />
                                )}

                                {/* Icon */}
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm ${locked ? 'bg-slate-300 dark:bg-slate-700' : done ? 'bg-emerald-600' : 'bg-blue-600'}`}>
                                    {locked
                                        ? <TbLock size={22} />
                                        : done
                                            ? <TbCircleCheck size={24} />
                                            : (typeof Icon === 'string'
                                                ? <img src={Icon} alt={card.label} className="w-7 h-7 object-contain" />
                                                : <Icon size={24} />
                                            )}
                                </div>

                                {/* Text */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 mb-0.5">
                                        <p className={`font-bold text-base tracking-tight ${locked ? 'text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                                            {card.label}
                                        </p>
                                        {done && (
                                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0">Done</span>
                                        )}
                                        {!done && !locked && missing && (
                                            <span className="text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 animate-pulse">
                                                Needs Input
                                            </span>
                                        )}
                                        {locked && (
                                            <span className="text-[10px] font-bold bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0">Locked</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
                                        {done && summary ? summary : locked ? (isNotYetOpen ? 'Scheduled to open soon' : `Complete step ${card.step - 1} first`) : card.sublabel}
                                    </p>
                                </div>
                                <TbChevronRight className="text-slate-400 shrink-0" size={20} />
                            </button>
                        </motion.div>
                    );
                })}
            </div>

            {/* ── Persistent Sticky Bottom Navigation Bar ── */}
            <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-4 shadow-lg">
                <div className="max-w-lg sm:max-w-xl md:max-w-2xl mx-auto flex items-center justify-between gap-4">
                    <button
                        onClick={() => setShowSummaryModal(true)}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-base shadow-md active:scale-95 transition-all focus:ring-4 focus:ring-blue-500 focus:outline-none min-h-[48px]"
                    >
                        {isLocked || isExpired ? 'View Submitted Plan Summary' : 'Save & Next →'}
                    </button>
                </div>
            </div>

            {/* ── Mobile-First Modal Card Panels Overlay ── */}
            <AnimatePresence>
                {activeCard && (
                    <motion.div
                        key="card-modal-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{ zIndex: 9990 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9990] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden"
                    >
                        <motion.div
                            key={`card-modal-${activeCard}`}
                            initial={{ y: '100%', opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: '100%', opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="bg-slate-50 dark:bg-slate-900 w-full max-w-lg sm:max-w-xl md:max-w-2xl h-[94vh] sm:h-[88vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800"
                        >
                            {activeCard === 'pia' && (
                                <PriorityImprovementAreaCard
                                    value={priorityAreas}
                                    onChange={setPriorityAreas}
                                    onConfirm={() => confirm('pia')}
                                    onClose={() => closeCard('pia')}
                                    readOnly={isExpired || isNotYetOpen || isLocked}
                                />
                            )}
                            {activeCard === 'interventions' && (
                                <InterventionsCard
                                    value={selectedInterventions}
                                    aral={aral}
                                    onChange={setSelectedInterventions}
                                    onAralChange={setAral}
                                    onConfirm={() => confirm('interventions')}
                                    onClose={() => closeCard('interventions')}
                                    readOnly={isExpired || isNotYetOpen || isLocked}
                                />
                            )}
                            {activeCard === 'beneficiaries' && (
                                <BeneficiariesCard
                                    selectedInterventions={selectedInterventions}
                                    value={beneficiaries}
                                    aral={aral}
                                    onChange={setBeneficiaries}
                                    onConfirm={() => confirm('beneficiaries')}
                                    onClose={() => closeCard('beneficiaries')}
                                    readOnly={isExpired || isNotYetOpen || isLocked}
                                />
                            )}
                            {activeCard === 'activities' && (
                                <ActivitiesCard
                                    selectedInterventions={selectedInterventions}
                                    value={activities}
                                    onChange={setActivities}
                                    onConfirm={() => confirm('activities')}
                                    onClose={() => closeCard('activities')}
                                    readOnly={isExpired || isNotYetOpen || isLocked}
                                />
                            )}
                            {activeCard === 'budget' && (
                                <BudgetCard
                                    user={user}
                                    interventions={selectedInterventions}
                                    budgets={budgets}
                                    setBudgets={setBudgets}
                                    beneficiaries={beneficiaries}
                                    onConfirm={() => confirm('budget')}
                                    onClose={() => closeCard('budget')}
                                    isLocked={isExpired || isNotYetOpen || isLocked}
                                    allocation={allocation}
                                />
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── View Summary Overlay Bottom Sheet Modal ── */}
            <AnimatePresence>
                {showSummaryModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{ zIndex: 9999 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4"
                    >
                        <motion.div
                            initial={{ y: '100%', opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: '100%', opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="bg-white dark:bg-slate-900 w-full max-w-lg sm:max-w-2xl rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[85vh] animate-slide-up flex flex-col border border-slate-200 dark:border-slate-800"
                        >
                            {/* Modal Header */}
                            <div className="bg-gradient-to-br from-[#0B1F4D] to-[#10346B] text-white px-6 py-5 rounded-b-[2rem] shadow-lg relative overflow-hidden shrink-0">
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
                                            <h2 className="text-base font-black italic uppercase tracking-tight" style={{ color: 'var(--gold)' }}>Implementation Plan Summary</h2>
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
                                                className={`h-full rounded-full transition-all duration-500 ${totalBudget > (parseFloat(allocation.allocation_amount) || 0)
                                                    ? 'bg-red-500 shadow-[0_0_10px_#ef4444]'
                                                    : 'bg-siif-blue'
                                                    }`}
                                                style={{ width: `${Math.min(100, (totalBudget / (parseFloat(allocation.allocation_amount) || 1)) * 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Priority Improvement Areas */}
                                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                                    <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                                        <h4 className="text-[12px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                                            <TbTarget size={16} /> Priority Improvement Areas
                                        </h4>
                                    </div>

                                    {/* Category Tabs */}
                                    <div className="flex bg-slate-50 p-1.5 rounded-xl">
                                        {['Access and Quality', 'Governance'].map(cat => (
                                            <button
                                                key={cat}
                                                onClick={() => setActivePiaCategory(cat)}
                                                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-300 ${activePiaCategory === cat
                                                    ? 'bg-white text-siif-blue shadow-sm border border-slate-200'
                                                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                                    }`}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="space-y-2">
                                        {(() => {
                                            const activePias = (priorityAreas || [])
                                                .filter(a => a && a.trim().length > 0 && a.startsWith(`[${activePiaCategory}]`));

                                            if (activePias.length === 0) {
                                                return <p className="text-[12px] text-slate-500 italic px-2 py-4 text-center">No priority areas identified for {activePiaCategory}.</p>;
                                            }

                                            return activePias.map((area, idx) => (
                                                <div key={idx} className="flex items-start gap-3 bg-white p-3 rounded-xl border border-slate-100 hover:border-slate-200 shadow-sm transition-all group">
                                                    <div className="w-6 h-6 rounded-lg bg-blue-50 text-siif-blue flex items-center justify-center shrink-0 mt-0.5 border border-blue-100 group-hover:bg-siif-blue group-hover:text-white transition-all">
                                                        <span className="font-black text-[10px]">{idx + 1}</span>
                                                    </div>
                                                    <p className="text-[13px] font-bold text-slate-700 leading-relaxed flex-1 whitespace-pre-wrap">{area.replace(`[${activePiaCategory}] `, '')}</p>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                </div>

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
                                                        <h4 className="text-[15px] font-black text-slate-800 uppercase tracking-tight">{info?.label || intId}</h4>
                                                        <span className="text-[11px] font-black bg-blue-50 text-siif-blue px-2 py-0.5 rounded-md uppercase tracking-wider">Intervention #{idx + 1}</span>
                                                    </div>
                                                </div>
                                                <p className="text-[15px] font-black text-emerald-600 bg-emerald-50/50 px-3 py-1 rounded-full border border-emerald-100">
                                                    ₱{(parseFloat(budget) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                                </p>
                                            </div>

                                            {/* Beneficiaries Section - Grouped by Key Stage */}
                                            <div className="space-y-1.5">
                                                <p className="text-[15px] font-black text-slate-400 uppercase tracking-widest">Target Beneficiaries (Key Stages)</p>
                                                {grades.length > 0 ? (
                                                    <div className="grid grid-cols-1 gap-2 pl-1">
                                                        {KEY_STAGES.map(ks => {
                                                            const activeGradesInKs = ks.grades.filter(g => grades.includes(g));
                                                            if (activeGradesInKs.length === 0) return null;
                                                            const ksTotal = activeGradesInKs.reduce((sum, g) => sum + (parseInt(beneficiaryCounts?.[g]) || 0), 0);
                                                            return (
                                                                <div key={ks.id} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col gap-2">
                                                                    <div className="flex justify-between items-center text-[15px] font-black text-slate-500 uppercase">
                                                                        <span>{ks.label}</span>
                                                                        <span className="text-siif-blue bg-siif-blue/5 px-2.5 py-1 rounded-md">Total: {ksTotal.toLocaleString()}</span>
                                                                    </div>
                                                                    <div className="flex flex-wrap gap-2 mt-0.5">
                                                                        {activeGradesInKs.map(g => (
                                                                            <span key={g} className="text-[15px] font-black bg-white text-slate-600 px-3 py-1.5 rounded-lg border border-slate-100">
                                                                                {GRADE_LABELS[g] || g}: <span className="text-siif-blue">{beneficiaryCounts?.[g] || 0}</span>
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <p className="text-[15px] text-slate-400 italic pl-1">No beneficiaries configured.</p>
                                                )}
                                            </div>

                                            {/* Activities Section - Grouped by Category */}
                                            <div className="space-y-1.5">
                                                <p className="text-[15px] font-black text-slate-400 uppercase tracking-widest">Planned Activities</p>
                                                <div className="pl-1 space-y-2">
                                                    {categories.map(cat => {
                                                        const items = Array.isArray(selectedActivities?.[cat.key]) ? selectedActivities[cat.key] : [];
                                                        if (items.length === 0) return null;
                                                        return (
                                                            <div key={cat.key} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                                <p className="text-[15px] font-black text-slate-500 uppercase tracking-wider mb-2">{cat.label}</p>
                                                                <div className="space-y-2">
                                                                    {items.map((act, i) => {
                                                                        const display = act === 'Others (specify)' ? (otherActivity ? `Other: ${otherActivity}` : 'Other') : act;
                                                                        return (
                                                                            <div key={i} className="flex items-start gap-3 bg-white px-3 py-2 rounded-lg border border-slate-100">
                                                                                <div className="w-5 h-5 rounded bg-siif-blue text-white flex items-center justify-center shrink-0 mt-0.5">
                                                                                    <TbCheck size={12} />
                                                                                </div>
                                                                                <p className="text-[15px] text-slate-600 font-bold leading-snug">{display}</p>
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
                                            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-md transition-all active:scale-[0.98]"
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
                                                    "{remarks || 'No remarks provided.'}"
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
                                                className={`w-full px-5 py-3 rounded-xl border-2 font-black text-xs tracking-widest text-center transition-all focus:outline-none ${!allConfirmed
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
                                                {submitting ? 'Submitting...' : isSubmitted ? 'Update Submitted Plan 🚀' : 'Submit Final Plan 🚀'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
    </div>
    );
};

export default SIIFFormsHub;
