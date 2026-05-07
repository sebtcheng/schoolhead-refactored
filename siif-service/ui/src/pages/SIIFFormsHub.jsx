// SIIFFormsHub.jsx
// The /forms route — 4-card hub with sequential locking
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TbChevronLeft, TbCircleCheck, TbLock,
    TbTarget, TbUsers, TbBulb, TbCurrencyPeso,
    TbChevronRight, TbClock, TbTrendingUp
} from 'react-icons/tb';
import { FiSave, FiAlertCircle } from 'react-icons/fi';
import InterventionsCard from './cards/InterventionsCard';
import BeneficiariesCard from './cards/BeneficiariesCard';
import ActivitiesCard from './cards/ActivitiesCard';
import BudgetCard from './cards/BudgetCard';
import { INTERVENTIONS, emptyIntData } from './cards/siifConstants.jsx';

// ─── Card Metadata ────────────────────────────────────────────────────────────
const CARDS = [
    {
        id: 'interventions',
        step: 1,
        label: 'Interventions',
        sublabel: 'Select what your school will implement',
        icon: TbTarget,
        color: 'bg-deped-blue',
    },
    {
        id: 'beneficiaries',
        step: 2,
        label: 'Beneficiaries',
        sublabel: 'Who will be served by each intervention?',
        icon: TbUsers,
        color: 'bg-emerald-500',
    },
    {
        id: 'activities',
        step: 3,
        label: 'Activities',
        sublabel: 'Plan activities per intervention',
        icon: TbBulb,
        color: 'bg-amber-500',
    },
    {
        id: 'budget',
        step: 4,
        label: 'Budget Estimation',
        sublabel: 'Enter estimated budget per intervention',
        icon: TbCurrencyPeso,
        color: 'bg-violet-600',
    },
];

const TOTAL_STEPS = CARDS.length;

// ─── Main Component ───────────────────────────────────────────────────────────
const SIIFFormsHub = ({ user }) => {
    const navigate = useNavigate();
    const [activeCard, setActiveCard] = useState(null);
    const [confirmed, setConfirmed] = useState({
        interventions: false,
        beneficiaries: false,
        activities: false,
        budget: false,
    });
    const [submissionId, setSubmissionId] = useState(null);
    const [isLocked, setIsLocked] = useState(false); // submitted lock
    const [deadline, setDeadline] = useState(null);
    const [isExpired, setIsExpired] = useState(false); // temporal lock
    const [utilizationData, setUtilizationData] = useState({});
    const [allocation, setAllocation] = useState(null);
    const [saving, setSaving] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [syncStatus, setSyncStatus] = useState('saved'); // 'saved', 'saving', 'error'
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // ─── Shared form state ────────────────────────────────────────────────────
    const [selectedInterventions, setSelectedInterventions] = useState([]);
    const [aral, setAral] = useState({ planned: null, subjects: [] });
    const [beneficiaries, setBeneficiaries] = useState({});
    const [activities, setActivities] = useState({});
    const [budgets, setBudgets] = useState({});

    console.log('🏠 [SIIFFormsHub] Rendered. confirmed:', confirmed, ' interventions:', selectedInterventions);

    useEffect(() => {
        // 🔍 Resolve 6-digit ID if possible, otherwise backend lookup will handle it
        const schoolId = user?.school_id || user?.schoolId || user?.uid || user?.id || user?.sub;
        if (!schoolId) {
            console.error('❌ [SIIFFormsHub] No schoolId found in user session.');
            return;
        }

        // ─── Load Allocation & Draft ───
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const headers = { 'Authorization': `Bearer ${user.token}` };

                // 1. Fetch Allocation (Always needed for validation)
                const allocRes = await fetch(`/api/siif/allocation/${schoolId}`, { headers });
                if (allocRes.ok) {
                    const allocData = await allocRes.json();
                    console.log('💰 [SIIFFormsHub] Fetched allocation:', allocData);
                    setAllocation(allocData);
                }

                // 2. Fetch Deadline
                try {
                    const dlRes = await fetch('/api/siif/settings/deadline', { headers });
                    if (dlRes.ok) {
                        const dlData = await dlRes.json();
                        if (dlData && dlData.deadline) {
                            setDeadline(dlData.deadline);
                            const dlDate = new Date(dlData.deadline);
                            const now = new Date();
                            console.log(`🛡️ [SIIF_LOCK] Global Deadline: ${dlDate.toLocaleString()}`);

                            if (dlDate < now) {
                                console.warn('⌛ [SIIF_LOCK] STATUS: EXPIRED. Locking all forms.');
                                setIsExpired(true);
                            } else {
                                setIsExpired(false);
                            }
                        }
                    }
                } catch (dlErr) {
                    console.error('🔥 [SIIFFormsHub] Failed to fetch deadline:', dlErr);
                }

                // 3. Fetch Submission Draft
                const res = await fetch(`/api/siif/submission/${schoolId}`, { headers });
                if (res.ok) {
                    const responseText = await res.text();
                    let data = null;
                    try {
                        data = responseText ? JSON.parse(responseText) : null;
                    } catch (jsonErr) {
                        console.error('🔥 [SIIF-API] Non-JSON response:', responseText);
                    }

                    if (data && data.success) {
                        const ints = data.interventions || [];
                        setSubmissionId(data.submissionId || data.siif_sub_id || null);
                        setIsLocked(data.status === 'submitted');
                        setSelectedInterventions(ints);
                        setAral(data.aral || { planned: null, subjects: [] });
                        setBudgets(data.budgetEstimates || {});

                        const bens = {};
                        const acts = {};
                        ints.forEach(intId => {
                            const d = data.interventionData?.[intId] || emptyIntData();
                            bens[intId] = {
                                selectedGrades: d.selectedGrades || [],
                                beneficiaryCounts: d.beneficiaryCounts || {}
                            };
                            acts[intId] = {
                                selectedActivities: d.selectedActivities || {},
                                otherActivity: d.otherActivity || ''
                            };
                        });
                        setBeneficiaries(bens);
                        setActivities(acts);

                        const nextConfirmed = {
                            interventions: ints.length > 0,
                            beneficiaries: ints.some(id => (bens[id]?.selectedGrades || []).length > 0),
                            activities: ints.some(id => Object.values(acts[id]?.selectedActivities || {}).flat().length > 0),
                            budget: ints.some(id => parseFloat(data.budgetEstimates?.[id]) > 0),
                        };

                        if (data.status === 'submitted') {
                            Object.keys(nextConfirmed).forEach(k => nextConfirmed[k] = true);
                        }
                        setConfirmed(nextConfirmed);
                        if (data.allocation) setAllocation(data.allocation);
                    }
                }
            } catch (err) {
                console.error('🔥 [SIIFFormsHub] Failed to load data:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [user]);

    // ─── Debounced Auto-save ──────────────────────────────────────────────────
    useEffect(() => {
        if (isExpired || selectedInterventions.length === 0 || isLocked) return;

        // Prevent auto-save on initial load (if data is still null)
        if (Object.keys(beneficiaries).length === 0 && selectedInterventions.length > 0) return;

        setSyncStatus('saving');
        const timer = setTimeout(() => {
            handleSaveDraft(true)
                .then(() => setSyncStatus('saved'))
                .catch(() => setSyncStatus('error'));
        }, 3000); // 3-second debounce for "Master Architect" resilience

        return () => clearTimeout(timer);
    }, [selectedInterventions, beneficiaries, activities, budgets, aral, isExpired, isLocked]);

    // ─── Derived ──────────────────────────────────────────────────────────────
    const confirmedCount = Object.values(confirmed).filter(Boolean).length;
    const progressPct = Math.round((confirmedCount / TOTAL_STEPS) * 100);
    const allConfirmed = confirmedCount === TOTAL_STEPS;
    const totalBudget = Object.values(budgets).reduce((s, v) => s + (parseFloat(v) || 0), 0);

    // ─── Lock chain: interventions → beneficiaries → activities → budget ──────
    const isCardLocked = (cardId) => {
        // 1. [TEMPORAL LOCK] If deadline expired, unlock for READ-ONLY viewing
        if (isExpired) return false;

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
        if (isExpired) return 'confirmed'; // Show as done if locked
        if (confirmed[cardId]) return 'confirmed';
        if (isCardLocked(cardId)) return 'locked';
        return 'pending';
    };

    const handleCardClick = (cardId) => {
        const locked = isCardLocked(cardId);
        const readOnlyMode = isExpired;

        console.log('🛡️ [SIIF_HUB_DIAGNOSTIC]', {
            cardId,
            isLockedState: isLocked,
            isExpiredState: isExpired,
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
        if (isExpired) {
            setActiveCard(null);
            return;
        }
        console.log(`✅ [SIIFFormsHub] ${cardId} confirmed. State updated.`);
        setConfirmed(p => ({ ...p, [cardId]: true }));
        setActiveCard(null);
        // Auto-save useEffect will handle the persistence
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
            schoolName: user?.school_name || user?.schoolName || '',
            region: user?.region || '',
            division: user?.division || '',
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
        const payload = buildPayload('draft');
        console.log('📤 [SIIFFormsHub] Saving draft (silent=' + silent + '):', JSON.stringify(payload, null, 2));
        try {
            const res = await fetch('/api/siif/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            console.log('📬 [SIIFFormsHub] Draft response:', data);
            if (data.success) {
                console.log('✅ [SIIFFormsHub] Draft saved. ID:', data.submissionId);
                if (!silent) alert('Draft saved successfully!');
            } else {
                if (!silent) throw new Error(data.error || 'Unknown server error');
            }
        } catch (err) {
            console.error('🔥 [SIIFFormsHub] Draft save failed:', err);
            if (!silent) alert(`Error saving draft: ${err.message}`);
        } finally {
            if (!silent) setSaving(false);
        }
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

        console.log('🚀 [SIIFFormsHub] Final submit:', JSON.stringify(payload, null, 2));
        try {
            const res = await fetch('/api/siif/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
                body: JSON.stringify(payload),
            });

            const responseText = await res.text();
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (jsonErr) {
                console.error('🔥 [SIIF-API] Non-JSON response:', responseText);
                throw new Error(`Server returned invalid response. Please check terminal logs.`);
            }

            console.log('📬 [SIIFFormsHub] Submit response:', data);
            if (data.success) {
                console.log('✅ [SIIFFormsHub] Submitted. ID:', data.submissionId);
                alert('Plan submitted successfully!');
                navigate('/');
            } else {
                console.error('❌ [SIIFFormsHub] Server rejected submission:', data);
                throw new Error(data.error || 'Unknown server error');
            }
        } catch (err) {
            console.error('🔥 [SIIFFormsHub] Submit failed:', err);
            // Check for specific backend details in error handling if possible
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
            const summary = Object.entries(beneficiaries).map(([id, d]) => {
                if (!d) return null;
                const count = Object.values(d.beneficiaryCounts || {}).reduce((a, v) => a + (parseInt(v) || 0), 0);
                if (count === 0) return null;
                const label = INTERVENTIONS.find(i => i.id === id)?.label || id;
                return `${label}: ${count.toLocaleString()}`;
            }).filter(Boolean).join(' • ');
            return summary || 'No learners selected';
        }
        if (cardId === 'activities') {
            const summary = Object.entries(activities).map(([id, d]) => {
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
        <div className="min-h-screen bg-slate-50 pb-32">

            {/* ── Header ── */}
            <div className="bg-deped-blue text-white pt-16 pb-20 px-6 rounded-b-[3.5rem] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-deped-red/10 rounded-full blur-3xl -ml-24 -mb-24 pointer-events-none" />

                <div className="relative z-10 flex items-center justify-between mb-6">
                    <button onClick={() => navigate('/')} className="p-3 bg-white/10 rounded-2xl border border-white/20">
                        <TbChevronLeft size={20} />
                    </button>
                    <div className="text-center">
                        <h1 className="text-xl font-black italic tracking-tighter uppercase">SIIF Planner</h1>
                        <p className="text-[9px] font-bold text-blue-200 uppercase tracking-[0.3em]">School Innovation &amp; Intervention Fund</p>
                    </div>
                    <button
                        onClick={handleSaveDraft}
                        disabled={saving || selectedInterventions.length === 0 || isExpired}
                        className="p-3 bg-white/10 rounded-2xl border border-white/20 disabled:opacity-40 relative"
                        title="Save Draft"
                    >
                        <FiSave size={20} />
                        {syncStatus === 'saving' && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border-2 border-deped-blue animate-pulse" />
                        )}
                        {syncStatus === 'saved' && selectedInterventions.length > 0 && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-deped-blue" />
                        )}
                    </button>
                </div>

                {/* Progress donut */}
                <div className="relative z-10 flex items-center gap-6">
                    <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none" stroke="white" strokeWidth="4"
                                strokeDasharray={`${progressPct}, 100`}
                                style={{ transition: 'stroke-dasharray 0.6s ease' }}
                            />
                        </svg>
                        <span className="absolute text-sm font-black text-white">{progressPct}%</span>
                    </div>
                    <div>
                        <p className="text-2xl font-black italic leading-tight">
                            {isExpired ? 'Deadline Passed' : allConfirmed ? 'Ready to Submit!' : confirmedCount === 0 ? "Let's Get Started" : `${confirmedCount}/${TOTAL_STEPS} Complete`}
                        </p>
                        <p className="text-blue-200 text-[11px] font-bold mt-1">
                            {isExpired
                                ? (deadline ? `Window closed on ${new Date(deadline).toLocaleString()}.` : 'Submission window is closed.')
                                : syncStatus === 'saving'
                                    ? '🔄 Syncing changes...'
                                    : isLocked
                                        ? '✅ Submitted (Editable until deadline)'
                                        : `${TOTAL_STEPS - confirmedCount} section${TOTAL_STEPS - confirmedCount !== 1 ? 's' : ''} remaining`}
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Deadline Warning ── */}
            {isExpired && (
                <div className="mx-6 -mt-6 relative z-20">
                    <div className="bg-amber-100 border border-amber-200 p-4 rounded-2xl flex items-center gap-4 shadow-lg shadow-amber-900/10">
                        <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white shrink-0">
                            <TbClock size={24} />
                        </div>
                        <div>
                            <p className="text-amber-900 font-black text-xs uppercase tracking-wider">Read-Only Mode</p>
                            <p className="text-amber-800 text-[11px] font-bold leading-tight">The submission deadline has passed. You can view your data but changes cannot be saved.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Cards ── */}
            <div className="px-5 -mt-10 relative z-20 space-y-4">
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
                                className={`w-full p-6 rounded-[2.5rem] border-2 flex items-center gap-5 text-left relative transition-all duration-300 active:scale-[0.98] ${locked
                                        ? 'bg-slate-100 border-slate-100 opacity-60 cursor-not-allowed'
                                        : done
                                            ? 'bg-white border-slate-100 shadow-md hover:shadow-lg'
                                            : 'bg-white border-orange-100 shadow-lg shadow-orange-100/50 hover:-translate-y-0.5 hover:shadow-xl'
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
                                            : <Icon size={26} />}
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
                                        {done && summary ? summary : locked ? `Complete step ${card.step - 1} first` : card.sublabel}
                                    </p>
                                </div>

                                {!locked && <TbChevronRight className="text-slate-300 shrink-0" size={20} />}
                            </button>
                        </motion.div>
                    );
                })}

                {/* ── Submit CTA ── */}
                <AnimatePresence>
                    {(allConfirmed && !isExpired) && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="mt-6 space-y-4"
                        >
                            {/* Plan summary */}
                            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-md">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-1.5 h-6 bg-deped-red rounded-full" />
                                    <p className="text-sm font-black text-slate-800 italic uppercase tracking-tight">Plan Summary</p>
                                </div>
                                {[
                                    { label: 'Interventions', val: `${selectedInterventions.length} selected` },
                                    {
                                        label: 'Total Learners',
                                        val: (() => {
                                            const t = Object.values(beneficiaries).reduce((s, d) => {
                                                if (!d) return s;
                                                return s + Object.values(d.beneficiaryCounts || {}).reduce((a, v) => a + (parseInt(v) || 0), 0);
                                            }, 0);
                                            return t.toLocaleString();
                                        })()
                                    },
                                    {
                                        label: 'Total Activities',
                                        val: (() => {
                                            const t = Object.values(activities).reduce((s, d) => {
                                                if (!d) return s;
                                                return s + Object.values(d.selectedActivities || {}).flat().length;
                                            }, 0);
                                            return `${t} activit${t !== 1 ? 'ies' : 'y'}`;
                                        })()
                                    },
                                    { label: 'Total Budget', val: `₱${totalBudget.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` },
                                ].map(row => (
                                    <div key={row.label} className="flex justify-between items-center py-2.5 border-b border-slate-50 last:border-0">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{row.label}</p>
                                        <p className="text-xs font-black text-slate-800">{row.val}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Warning */}
                            <div className="p-4 bg-amber-50 rounded-[2rem] border border-amber-100 flex items-start gap-3">
                                <FiAlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                                <p className="text-[10px] text-amber-800 font-bold leading-relaxed">
                                    Please ensure all details are consistent with your SIP/AIP plans before submitting. Submission cannot be undone.
                                </p>
                            </div>

                            {/* Submit */}
                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className={`w-full py-7 ${isLocked ? 'bg-deped-blue' : 'bg-deped-red'} text-white rounded-[2.5rem] font-black text-base uppercase tracking-widest shadow-2xl shadow-red-900/30 hover:scale-[1.02] active:scale-95 transition-all flex flex-col items-center gap-1`}
                            >
                                <span className="text-[9px] opacity-60 tracking-[0.3em]">{isLocked ? 'Update Plan' : 'Final Step'}</span>
                                {submitting ? 'Submitting...' : isLocked ? 'Update Submission' : 'Confirm & Submit Plan'}
                            </button>
                            <p className="text-center text-[9px] text-slate-400 font-bold uppercase tracking-widest italic pb-4">
                                {isLocked ? 'Updating will overwrite your previous submission.' : 'By submitting, you confirm this plan has been reviewed.'}
                            </p>
                        </motion.div>
                    )}

                    {isExpired && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            className="mt-6 p-6 bg-slate-100 rounded-[2.5rem] border border-slate-200 flex flex-col items-center text-center gap-2"
                        >
                            <TbLock size={32} className="text-slate-500 mb-2" />
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Window Closed</h3>
                            <p className="text-[10px] text-slate-600 font-bold leading-relaxed max-w-[250px]">
                                The submission deadline for FY 2026 has passed. This plan is now archived and read-only.
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Full-screen card panels ── */}
            <AnimatePresence>
                {activeCard === 'interventions' && (
                    <motion.div key="int" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.25 }}>
                        <InterventionsCard
                            value={selectedInterventions}
                            aral={aral}
                            onChange={setSelectedInterventions}
                            onAralChange={setAral}
                            onConfirm={() => confirm('interventions')}
                            onClose={() => closeCard('interventions')}
                            readOnly={isExpired}
                        />
                    </motion.div>
                )}
                {activeCard === 'beneficiaries' && (
                    <motion.div key="ben" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.25 }}>
                        <BeneficiariesCard
                            selectedInterventions={selectedInterventions}
                            value={beneficiaries}
                            onChange={setBeneficiaries}
                            onConfirm={() => confirm('beneficiaries')}
                            onClose={() => closeCard('beneficiaries')}
                            readOnly={isExpired}
                        />
                    </motion.div>
                )}
                {activeCard === 'activities' && (
                    <motion.div key="act" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.25 }}>
                        <ActivitiesCard
                            selectedInterventions={selectedInterventions}
                            value={activities}
                            onChange={setActivities}
                            onConfirm={() => confirm('activities')}
                            onClose={() => closeCard('activities')}
                            readOnly={isExpired}
                        />
                    </motion.div>
                )}
                {activeCard === 'budget' && (
                    <motion.div key="bud" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.25 }}>
                        <BudgetCard
                            user={user}
                            interventions={selectedInterventions}
                            budgets={budgets}
                            setBudgets={setBudgets}
                            onConfirm={() => confirm('budget')}
                            onClose={() => closeCard('budget')}
                            isLocked={isExpired}
                            allocation={allocation}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SIIFFormsHub;
