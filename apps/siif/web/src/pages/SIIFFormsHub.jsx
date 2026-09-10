// SIIFFormsHub.jsx
// The /forms route — 4-card hub with sequential locking
import React, { useState, useEffect, useRef } from 'react';
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
    const [showChangesModal, setShowChangesModal] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [confirmError, setConfirmError] = useState(false);
    const [activePiaCategory, setActivePiaCategory] = useState('Access and Quality');

    // ─── Snapshot of originally loaded server payload (for dirty-check) ────────
    const originalPayload = useRef(null);

    // ─── Data + state from hook ───────────────────────────────────────────────
    const {
        loading, isHydrated, error,
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

    // ─── Helper: Validate Empty Payload ───────────────────────────────────────
    const isEmptyPayload = (p) => {
        if (!p) return true;
        const hasPriority = Array.isArray(p.priorityAreas) && p.priorityAreas.filter(a => a && String(a).trim().length > 0).length > 0;
        const hasInterventions = Array.isArray(p.interventions) && p.interventions.length > 0;
        const hasBudget = parseFloat(p.totalBudget) > 0;
        return !hasPriority && !hasInterventions && !hasBudget;
    };

    // ─── Capture original server payload on first load ────────────────────────
    useEffect(() => {
        if (!loading && isHydrated && originalPayload.current === null) {
            originalPayload.current = JSON.stringify({
                priorityAreas,
                selectedInterventions,
                aral,
                beneficiaries,
                activities,
                budgets,
            });
        }
    }, [loading, isHydrated]);

    // ─── Dirty-check: compare current state vs original server snapshot ───────
    const currentSnapshot = JSON.stringify({
        priorityAreas,
        selectedInterventions,
        aral,
        beneficiaries,
        activities,
        budgets,
    });
    const isDirty = isSubmitted
        ? (originalPayload.current !== null && currentSnapshot !== originalPayload.current)
        : false;

    // ─── Build a human-readable diff summary for the modal ───────────────────
    const buildChangeSummary = () => {
        if (!originalPayload.current) return [];
        const orig = JSON.parse(originalPayload.current);
        const diffs = [];
        if (JSON.stringify(orig.priorityAreas) !== JSON.stringify(priorityAreas))
            diffs.push('Modified Priority Improvement Areas');
        if (JSON.stringify(orig.selectedInterventions) !== JSON.stringify(selectedInterventions))
            diffs.push('Modified Selected Interventions');
        if (JSON.stringify(orig.aral) !== JSON.stringify(aral))
            diffs.push('Modified Remediation Subject Areas');
        if (JSON.stringify(orig.beneficiaries) !== JSON.stringify(beneficiaries))
            diffs.push('Modified Target Beneficiaries');
        if (JSON.stringify(orig.activities) !== JSON.stringify(activities))
            diffs.push('Modified Planned Activities');
        if (JSON.stringify(orig.budgets) !== JSON.stringify(budgets))
            diffs.push('Updated Budget Allocation');
        return diffs;
    };

    logger.debug('SIIF', 'SIIFFormsHub Rendered', { confirmed, selectedInterventions });

    // ─── Debounced Auto-save ──────────────────────────────────────────────────
    useEffect(() => {
        // Block auto-save if form state is not hydrated, loading, has errors, or is locked/submitted/reviewed
        if (!isHydrated || loading || error || isExpired || isNotYetOpen || isLocked || isSubmitted || isReviewed) return;

        // Prevent auto-save on initial load (if data is still null)
        if (Object.keys(beneficiaries).length === 0 && selectedInterventions.length > 0) return;

        // Prevent auto-saving an empty payload
        const testPayload = buildPayload('draft');
        if (isEmptyPayload(testPayload)) {
            logger.warn('SIIF', 'Auto-save skipped: empty payload detected');
            return;
        }

        setSyncStatus('saving');
        const timer = setTimeout(() => {
            handleSaveDraft(true)
                .then(() => setSyncStatus('saved'))
                .catch(() => setSyncStatus('error'));
        }, 3000); // 3-second debounce for "Master Architect" resilience

        return () => clearTimeout(timer);
    }, [loading, isHydrated, error, priorityAreas, selectedInterventions, beneficiaries, activities, budgets, aral, isExpired, isNotYetOpen, isLocked, isSubmitted, isReviewed]);

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
            form_completion_percentage: progressPct,
            shform_completion: progressPct,
        };

        console.log(`📤 [SIIFFormsHub] Built Payload (${status}):`, JSON.stringify(payload, null, 2));
        return payload;
    };

    // ─── Save Draft ───────────────────────────────────────────────────────────
    const handleSaveDraft = async (silent = false) => {
        if (!isHydrated || loading || error) {
            console.warn('⚠️ [SIIFFormsHub] Save blocked: Form state not hydrated or error state present.');
            if (!silent) alert('Cannot save draft: Form data failed to load or is still loading.');
            return;
        }
        if (isLocked || isSubmitted || isReviewed) {
            console.warn('⚠️ [SIIFFormsHub] Plan is submitted/reviewed or locked, skipping draft auto-save.');
            return;
        }
        const currentStatus = (isSubmitted || isReviewed) ? (isReviewed ? 'Reviewed' : 'submitted') : 'draft';
        const payload = buildPayload(currentStatus);

        if (isEmptyPayload(payload)) {
            console.warn('⚠️ [SIIFFormsHub] Save blocked: Attempted to save empty payload.');
            if (!silent) alert('Cannot save empty draft. Please fill in at least one section before saving.');
            return;
        }

        if (!silent) setSaving(true);
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

    if (error || (!isHydrated && !loading)) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="bg-white p-8 rounded-[3rem] shadow-2xl border border-red-100 max-w-sm w-full text-center">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <FiAlertCircle size={32} />
                    </div>
                    <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-2">Connection Error</h2>
                    <p className="text-xs text-slate-500 font-bold leading-relaxed mb-4">
                        {error || "We couldn't load your submission data from the server."}
                    </p>
                    <p className="text-[11px] font-extrabold text-red-600 bg-red-50 p-3 rounded-xl border border-red-100 leading-relaxed mb-6">
                        ⚠️ Saving is disabled to protect your existing submission from being overwritten.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="w-full py-4 bg-deped-blue text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-900 transition-all active:scale-95"
                    >
                        Retry Loading
                    </button>
                </div>
            </div>
        );
    }

    // ─── NOT YET OPEN LOCK SCREEN (Matching SIIFUtilization.jsx design) ──────
    if (isNotYetOpen) {
        return (
            <main className="w-full pt-3 sm:pt-4 lg:pt-8 pb-32 text-lg">
                <div className="max-w-2xl mx-auto mt-12 px-4">
                    <article className="siif-card">
                        <div className="siif-card-inner text-center p-8 sm:p-10">
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0, y: 10 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                                className="relative mx-auto w-32 h-32 mb-8"
                            >
                                <div className="absolute inset-0 bg-amber-400 blur-[32px] opacity-20 rounded-full animate-pulse" />
                                <div className="relative w-full h-full bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-100/60 rounded-[2.5rem] flex items-center justify-center shadow-xl shadow-amber-900/5 rotate-3 hover:rotate-0 transition-all duration-300">
                                    <TbClock size={56} className="text-amber-500 animate-pulse" />
                                </div>
                                <div className="absolute -bottom-3 -right-3 bg-white rounded-2xl p-2.5 shadow-lg border border-slate-100 -rotate-6">
                                    <TbLock size={28} className="text-amber-600" />
                                </div>
                            </motion.div>

                            <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-slate-900 to-slate-500 mb-6 tracking-tight uppercase italic" style={{ fontFamily: 'var(--font-heading)' }}>
                                Submission Window Scheduled
                            </h1>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1, duration: 0.4 }}
                                className="relative overflow-hidden bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-8 mb-8 max-w-lg mx-auto shadow-2xl shadow-slate-200/40 text-left"
                            >
                                <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-amber-400 to-orange-400" />

                                <p className="text-base text-slate-600 mb-6 leading-relaxed font-medium">
                                    The <strong className="text-slate-900 font-black px-2 py-1 bg-slate-100 rounded-lg shadow-sm border border-slate-200/60 mx-1">SIIF Planning Form</strong> is currently not open for submission of plans. Forms will unlock automatically on the scheduled start date.
                                </p>

                                <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-4 md:p-5 border border-amber-100/50 flex flex-col md:flex-row items-start gap-4">
                                    <div className="p-3 bg-white rounded-xl shadow-sm shrink-0 border border-amber-100">
                                        <TbClock size={24} className="text-amber-500" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] md:text-xs text-amber-800 font-black leading-relaxed uppercase tracking-widest mb-1.5">
                                            Scheduled Opening Date
                                        </p>
                                        <p className="text-sm text-slate-900 font-bold leading-relaxed">
                                            {openDate ? new Date(openDate).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' }) : 'To Be Announced'}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>

                            <button
                                onClick={() => navigate('/siif')}
                                className="w-full py-4 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-[0.98]"
                                style={{ background: 'linear-gradient(135deg, var(--navy), var(--blue))' }}
                            >
                                Return to Dashboard
                                <TbChevronRight size={18} />
                            </button>
                        </div>
                    </article>
                </div>
            </main>
        );
    }

    return (
        <div className="w-full min-h-screen pb-48 sm:pb-48 text-lg">

            {/* ── Topbar Header matching SIIFDashboard.jsx full width ── */}
            <main className="siif-main-area w-full pt-3 sm:pt-4 lg:pt-8 print:hidden">
                <header className="topbar print:hidden">
                    <div className="page-title">
                        <p className="eyebrow">
                            DEPARTMENT OF EDUCATION | HUMAN RESOURCE AND ORGANIZATIONAL DEVELOPMENT AND INFRASTRUCTURE
                        </p>
                        <h1>School Innovation and Improvement Fund</h1>

                        {/* Deadline & Lock badges — Identical Sizing & Alignment */}
                        <div className="flex flex-row items-center gap-2 mt-2 flex-wrap max-w-full">
                            {deadline && (
                                <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-wider sm:tracking-widest flex items-start sm:items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg shadow-sm leading-tight max-w-[170px] xs:max-w-[210px] sm:max-w-none break-words sm:whitespace-nowrap" style={{ backgroundColor: '#EF4444', color: '#FFFFFF', border: '1px solid #DC2626' }}>
                                    <TbClock size={14} className="shrink-0 text-white mt-0.5 sm:mt-0" />
                                    <span className="leading-snug">Deadline: {new Date(deadline).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                </span>
                            )}
                            {(isLocked || isExpired) ? (
                                <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-wider sm:tracking-widest px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 whitespace-nowrap" style={{ backgroundColor: '#F59E0B', color: '#FFFFFF', border: '1px solid #D97706' }}>
                                    <TbLock size={14} className="shrink-0 text-white" />
                                    <span>Read-Only</span>
                                </span>
                            ) : (
                                <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-wider sm:tracking-widest px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 whitespace-nowrap" style={{ backgroundColor: '#059669', color: '#FFFFFF', border: '1px solid #047857' }}>
                                    <TbEdit size={14} className="shrink-0 text-white" />
                                    <span>Editable</span>
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="siif-topbar-actions shrink-0">
                        {/* Submission Status Pill — Solid High-Contrast Dark Navy Badge */}
                        <div
                            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl font-black text-[10px] sm:text-[11px] uppercase tracking-wider shadow-md shrink-0"
                            style={{
                                backgroundColor: isReviewed ? '#059669' : isDisapproved ? '#DC2626' : isSubmitted ? '#0284C7' : '#08315F',
                                color: '#FFFFFF',
                                border: '1.5px solid rgba(255, 255, 255, 0.4)',
                                boxShadow: '0 4px 12px rgba(8, 49, 95, 0.3)',
                                opacity: 1,
                            }}
                        >
                            {isReviewed ? <TbCheck size={15} className="text-white" /> :
                                isDisapproved ? <TbX size={15} className="text-white" /> :
                                    isSubmitted ? <TbArrowRight size={15} className="text-white" /> :
                                        <TbEdit size={15} style={{ color: '#FBBF24' }} />}
                            <span style={{ color: '#FFFFFF', fontWeight: 900 }}>{isReviewed ? 'Reviewed' : isDisapproved ? 'Rejected' : isSubmitted ? 'Submitted' : 'Draft'}</span>
                        </div>

                        {/* Overall Progress Square Pill */}
                        <section className="siif-school-pill">
                            <small style={{ fontSize: '8px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--slate-500)', letterSpacing: '0.03em', lineHeight: 1.2, textAlign: 'center', display: 'block' }}>Forms<br />Completion</small>
                            <strong style={{ fontSize: '20px', background: 'linear-gradient(to right, var(--navy), var(--blue))', WebkitBackgroundClip: 'text', color: 'transparent', margin: '2px 0', lineHeight: 1, fontWeight: 900, display: 'block', textAlign: 'center' }}>
                                {progressPct}%
                            </strong>
                            <div style={{ width: '80%', height: '4px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', margin: '2px auto 0' }}>
                                <div style={{ width: `${progressPct}%`, height: '100%', background: 'var(--blue)', transition: 'width 0.3s ease' }} />
                            </div>
                        </section>
                    </div>
                </header>

                {/* ── Center Form Step Cards Stack (Narrower max-w-2xl layout) ── */}
                <div className="w-full max-w-lg sm:max-w-xl md:max-w-2xl mx-auto px-4">
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
                    <div className="px-1 relative z-20 flex flex-col gap-3 mt-4 mb-40 pb-16">
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
                </div>
            </main>

            {/* ── Persistent Sticky Bottom Navigation Bar ── */}
            <div className="siif-forms-footer">
                <div className="max-w-lg sm:max-w-xl md:max-w-2xl mx-auto flex items-center justify-between gap-4">
                    {(() => {
                        const isSubmitDisabled = !isLocked && !isExpired && (progressPct < 100 || (isSubmitted && !isDirty));
                        return (
                            <button
                                onClick={() => {
                                    if (isLocked || isExpired) {
                                        setShowSummaryModal(true);
                                        return;
                                    }
                                    if (isSubmitted && isDirty) {
                                        setShowChangesModal(true);
                                    } else {
                                        setShowSummaryModal(true);
                                    }
                                }}
                                disabled={isSubmitDisabled}
                                className={`w-full flex items-center justify-center gap-2 px-6 py-3.5 font-semibold rounded-xl text-base shadow-md transition-all focus:ring-4 focus:ring-blue-500 focus:outline-none min-h-[48px] ${
                                    isSubmitDisabled
                                        ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-60'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
                                }`}
                            >
                                {isLocked || isExpired
                                    ? 'View Submitted Plan Summary'
                                    : (isSubmitted && !isDirty)
                                        ? 'Submitted (No Changes)'
                                        : 'Submit Plan'}
                            </button>
                        );
                    })()}
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
                            className="bg-slate-50 dark:bg-slate-900 w-full max-w-lg sm:max-w-xl md:max-w-2xl lg:max-w-3xl max-h-[90vh] sm:max-h-[85vh] h-auto rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800"
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
                            className="bg-white dark:bg-slate-900 w-full max-w-lg sm:max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh] border border-slate-200 dark:border-slate-800"
                        >
                            {/* Modal Header */}
                            <div
                                className="text-white px-6 py-5 shrink-0 relative overflow-hidden"
                                style={{ background: 'linear-gradient(135deg, #0B1F4D 0%, #10346B 100%)' }}
                            >
                                <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />
                                <div className="relative z-10 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setShowSummaryModal(false)}
                                            className="p-2 rounded-xl transition-all border text-white"
                                            style={{ background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.15)' }}
                                        >
                                            <TbArrowLeft size={16} />
                                        </button>
                                        <div>
                                            <h2 className="text-base font-black italic uppercase tracking-tight" style={{ color: '#FBBF24' }}>Implementation Plan Summary</h2>
                                            <p className="text-[9px] font-bold uppercase tracking-widest mt-0.5" style={{ color: '#93C5FD' }}>
                                                FY {allocation?.fiscal_year || new Date().getFullYear()} · School ID: {user?.school_id || allocation?.school_id || '999163'}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowSummaryModal(false)}
                                        className="p-2 rounded-xl transition-all border text-white"
                                        style={{ background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.15)' }}
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
                                                            <div key={cat.key} className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100/50">
                                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-1">{cat.label}</p>
                                                                <div className="space-y-1.5">
                                                                    {items.map((act, actIdx) => {
                                                                        const display = act === 'Others (specify)' ? (otherActivity ? `Other: ${otherActivity}` : 'Other') : act;
                                                                        return (
                                                                            <div key={actIdx} className="flex items-start gap-2 bg-white p-2 rounded-lg border border-slate-100">
                                                                                <div className="w-3.5 h-3.5 rounded bg-siif-blue text-white flex items-center justify-center shrink-0 mt-0.5">
                                                                                    <TbCheck size={8} />
                                                                                </div>
                                                                                <p className="text-[9px] text-slate-600 font-bold leading-normal">{display}</p>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Modal Footer / Submit Attestation */}
                            <div className="p-3.5 sm:p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0 space-y-2.5">
                                {isReviewed ? (
                                    <div className="space-y-3">
                                        <div className="p-3.5 bg-emerald-950 text-white rounded-2xl flex items-center gap-3 shadow-md border border-emerald-800/60">
                                            <div className="w-8 h-8 bg-emerald-500/20 rounded-xl flex items-center justify-center shrink-0 border border-emerald-400/30">
                                                <TbCheck size={18} className="text-emerald-400" />
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Official Plan Reviewed</p>
                                                <p className="text-[11px] font-bold leading-snug text-slate-200">
                                                    This implementation plan has been reviewed and approved by the SDO.
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setShowSummaryModal(false)}
                                            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-md transition-all active:scale-[0.98]"
                                        >
                                            Close Summary View
                                        </button>
                                    </div>
                                ) : isExpired ? (
                                    <div className="space-y-3">
                                        <div className="p-3.5 bg-slate-900 text-white rounded-2xl flex items-center gap-3 shadow-md border border-slate-800">
                                            <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center shrink-0 border border-white/20">
                                                <TbLock size={18} className="text-slate-300" />
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Read-Only Mode</p>
                                                <p className="text-[11px] font-bold leading-snug text-slate-200">
                                                    The submission deadline has passed. This proposal cannot be modified.
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setShowSummaryModal(false)}
                                            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-md transition-all active:scale-[0.98]"
                                        >
                                            Close Summary View
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-2.5">
                                        {/* Plan Status Banner for Division Disapproval */}
                                        {isDisapproved && (
                                            <div className="p-3 bg-red-50 text-red-600 rounded-2xl border border-red-100 flex flex-col gap-1.5 shadow-sm">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center shrink-0 border border-red-200">
                                                        <TbX size={16} className="text-red-600 animate-pulse" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[8px] font-black uppercase tracking-widest text-red-600">Plan Status: Disapproved by Division</p>
                                                        <p className="text-[10px] font-bold leading-snug text-slate-700">
                                                            Please address the SDO comments below before resubmitting.
                                                        </p>
                                                    </div>
                                                </div>
                                                <p className="text-xs font-extrabold italic text-slate-700 bg-white p-2 rounded-lg border border-slate-100 leading-relaxed">
                                                    "{remarks || 'No remarks provided.'}"
                                                </p>
                                            </div>
                                        )}

                                        {/* Low-profile Compact Confirm Input Box */}
                                        <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2">
                                            <div className="flex-1 min-w-0 text-center sm:text-left">
                                                {!allConfirmed ? (
                                                    <p className="text-[10px] text-amber-600 font-bold leading-tight animate-pulse">
                                                        ⚠️ PLAN INCOMPLETE: Confirm all cards before final submission.
                                                    </p>
                                                ) : (
                                                    <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                        Type <span className="text-siif-blue font-black">CONFIRM</span> to finalize and submit:
                                                    </p>
                                                )}
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="CONFIRM..."
                                                disabled={!allConfirmed}
                                                value={confirmText}
                                                onChange={e => setConfirmText(e.target.value)}
                                                className={`w-full sm:w-44 px-3.5 py-2 rounded-xl border-2 font-black text-xs tracking-widest text-center transition-all focus:outline-none ${!allConfirmed
                                                    ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                                                    : confirmError
                                                        ? 'border-red-400 bg-red-50 text-red-600 animate-shake'
                                                        : 'border-slate-200 bg-white text-slate-800 focus:border-siif-blue'
                                                    }`}
                                            />
                                        </div>

                                        <div className="flex gap-2.5">
                                            <button
                                                type="button"
                                                onClick={() => setShowSummaryModal(false)}
                                                className="py-3 px-5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-[0.98]"
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
                                                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-md transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
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

            {/* ── Changes Detected in Submitted Plan Modal ── */}
            <AnimatePresence>
                {showChangesModal && (() => {
                    const changeSummary = buildChangeSummary();
                    return (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{ zIndex: 10000 }}
                            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4"
                        >
                            <motion.div
                                initial={{ y: '100%', opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: '100%', opacity: 0 }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                className="bg-white dark:bg-slate-900 w-full max-w-lg sm:max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh] border border-slate-200 dark:border-slate-800"
                            >
                                {/* Modal Header */}
                                <div
                                    className="px-6 py-5 shrink-0 relative overflow-hidden"
                                    style={{ background: 'linear-gradient(135deg, #92400E 0%, #B45309 100%)' }}
                                >
                                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />
                                    <div className="relative z-10 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-white/15 rounded-2xl flex items-center justify-center shrink-0 border border-white/20">
                                                <TbEdit size={20} className="text-amber-200" />
                                            </div>
                                            <div>
                                                <h2 className="text-base font-black italic uppercase tracking-tight text-amber-200">Changes Detected in Submitted Plan</h2>
                                                <p className="text-[9px] font-bold uppercase tracking-widest mt-0.5 text-amber-300/80">
                                                    Local changes differ from the submitted version
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setShowChangesModal(false)}
                                            className="p-2 rounded-xl transition-all border text-white"
                                            style={{ background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)' }}
                                        >
                                            <TbX size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Modal Body */}
                                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                                    <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-800/50">
                                        <p className="text-[10px] font-black text-amber-800 dark:text-amber-300 uppercase tracking-widest mb-3">
                                            Detected Modifications ({changeSummary.length})
                                        </p>
                                        <div className="space-y-2">
                                            {changeSummary.length > 0 ? changeSummary.map((change, idx) => (
                                                <div key={idx} className="flex items-center gap-3 bg-white dark:bg-slate-800 px-4 py-3 rounded-xl border border-amber-100 dark:border-amber-900/50 shadow-sm">
                                                    <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{change}</p>
                                                </div>
                                            )) : (
                                                <p className="text-sm text-slate-500 italic">No specific changes detected.</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                                        <p className="text-xs font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
                                            Choose how to proceed with these local changes:
                                        </p>
                                        <ul className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                            <li>• <strong className="text-slate-700 dark:text-slate-200">Confirm Change</strong> — Uploads your local changes as the new submitted version.</li>
                                            <li>• <strong className="text-slate-700 dark:text-slate-200">Revert Change</strong> — Discards all local modifications and restores the original submitted data.</li>
                                        </ul>
                                    </div>
                                </div>

                                {/* Modal Footer */}
                                <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 shrink-0 flex gap-3 bg-white dark:bg-slate-900">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            // Revert: restore original server snapshot into all state setters
                                            if (originalPayload.current) {
                                                const orig = JSON.parse(originalPayload.current);
                                                setPriorityAreas(orig.priorityAreas);
                                                setSelectedInterventions(orig.selectedInterventions);
                                                setAral(orig.aral);
                                                setBeneficiaries(orig.beneficiaries);
                                                setActivities(orig.activities);
                                                setBudgets(orig.budgets);
                                            }
                                            setShowChangesModal(false);
                                        }}
                                        style={{ background: '#F1F5F9', color: '#334155', borderColor: '#CBD5E1' }}
                                        className="flex-1 py-3.5 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-[0.98] border"
                                    >
                                        ↩ Revert Change
                                    </button>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            setShowChangesModal(false);
                                            await handleSubmit();
                                            // Update snapshot to reflect the new submitted state
                                            originalPayload.current = currentSnapshot;
                                        }}
                                        disabled={submitting}
                                        style={{ background: 'linear-gradient(135deg, #D97706 0%, #B45309 100%)', color: '#FFFFFF' }}
                                        className="flex-1 py-3.5 hover:brightness-110 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-md transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-amber-600/40"
                                    >
                                        <TbCheck size={18} className="text-white shrink-0" />
                                        <span>{submitting ? 'Submitting...' : 'Confirm Change'}</span>
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

export default SIIFFormsHub;
