import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TbX, TbChevronRight, TbChevronLeft, TbCheck,
    TbTarget, TbUsers, TbBulb, TbWallet, TbFileSearch,
    TbCircleCheck, TbSchool, TbMoodSmile, TbBook,
    TbDeviceLaptop, TbHeartHandshake, TbChartBar, TbTrendingUp
} from 'react-icons/tb';
import { FiSave, FiInfo, FiAlertCircle } from 'react-icons/fi';

// ─── Constants ────────────────────────────────────────────────────────────────
const INTERVENTIONS = [
    { id: 'remediation', label: 'Remediation', desc: 'Help learners catch up by addressing gaps in foundational literacy and numeracy skills.' },
    { id: 'enhancement', label: 'Enhancement', desc: 'Strengthen classroom instruction so learners achieve grade-level competencies.' },
    { id: 'enrichment', label: 'Enrichment', desc: 'Deepen learning beyond minimum standards, fostering curiosity and problem-solving.' },
    { id: 'prevention', label: 'Prevention', desc: 'Identify and address learning difficulties early.' },
    { id: 'wellness', label: 'Wellness', desc: 'Address health, nutrition, and well-being factors that affect learning.' },
    { id: 'learning_environment', label: 'Learning Environment', desc: 'Provide safe, resource-rich environments for effective teaching.' },
    { id: 'acceleration', label: 'Acceleration', desc: 'Enable learners to rapidly attain foundational skills.' },
    { id: 'inclusive', label: 'Inclusive', desc: 'Ensure equitable access for all students, especially marginalized learners.' },
    { id: 'engagement', label: 'Engagement', desc: 'Improve participation and reduce absenteeism and dropout rates.' },
    { id: 'behavioral', label: 'Behavioral', desc: 'Remove social and emotional barriers that hinder learning.' },
    { id: 'instructional_improvement', label: 'Instructional Improvement', desc: 'Enhance teacher effectiveness through professional development.' },
    { id: 'technology_enabled', label: 'Technology-enabled', desc: 'Leverage technology to personalize learning and support data-informed teaching.' },
];

const KEY_STAGES = [
    { id: 'ks1', label: 'Key Stage 1', grades: ['kindergarten', 'g1', 'g2', 'g3'] },
    { id: 'ks2', label: 'Key Stage 2', grades: ['g4', 'g5', 'g6'] },
    { id: 'ks3', label: 'Key Stage 3', grades: ['g7', 'g8', 'g9', 'g10'] },
    { id: 'ks4', label: 'Key Stage 4', grades: ['g11', 'g12'] },
];

const GRADE_LABELS = {
    kindergarten: 'Kindergarten', g1: 'Grade 1', g2: 'Grade 2', g3: 'Grade 3',
    g4: 'Grade 4', g5: 'Grade 5', g6: 'Grade 6',
    g7: 'Grade 7', g8: 'Grade 8', g9: 'Grade 9', g10: 'Grade 10',
    g11: 'Grade 11', g12: 'Grade 12',
};

const SIP_AIP_ACTIVITIES = [
    'Development or enhancement of learning materials',
    'Conduct of school-level Learning Action Cell (LAC) sessions',
    'Purchase of instructional supplies and materials for classroom use',
    'Purchase of food and ingredients for school-based feeding programs',
    'Minor repairs and improvements to enhance the learning environment',
    'Printing or reproduction of learning materials',
    'Others (specify)',
];

const REMAINING_ACTIVITIES = [
    'Procurement of semi-expandable items',
    'Conduct of workshops and capacity-building activities',
    'Other day-to-day operational needs',
];

const INTERVENTION_ICONS = {
    remediation: <TbSchool size={22} />,
    enhancement: <TbBook size={22} />,
    enrichment: <TbBulb size={22} />,
    prevention: <TbHeartHandshake size={22} />,
    wellness: <TbMoodSmile size={22} />,
    learning_environment: <TbDeviceLaptop size={22} />,
    acceleration: <TbTrendingUp size={22} />,
    inclusive: <TbUsers size={22} />,
    engagement: <TbChartBar size={22} />,
    behavioral: <TbHeartHandshake size={22} />,
    instructional_improvement: <TbBook size={22} />,
    technology_enabled: <TbDeviceLaptop size={22} />,
};

const emptyIntData = () => ({
    selectedGrades: [],
    beneficiaryCounts: {},
    selectedActivities: { sip_aip: [], action_research: [], remaining: [] },
    otherActivity: '',
    budgetEstimate: '',
});

// ─── Main Component ───────────────────────────────────────────────────────────
const SIIFForm = ({ user }) => {
    const navigate = useNavigate();
    const [step, setStep] = useState(0);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        selectedInterventions: [],
        aral: { planned: null, subjects: [] },
        interventionData: {},
        budgetEstimates: {},
    });

    // Derived: total dynamic steps = 1 (selection) + N (per intervention) + 1 (review)
    const totalSteps = 1 + form.selectedInterventions.length + 1;
    const isReviewStep = step === totalSteps - 1;
    const isSelectionStep = step === 0;
    const currentIntId = (!isSelectionStep && !isReviewStep)
        ? form.selectedInterventions[step - 1]
        : null;

    // ─── Load Draft ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (!user?.school_id) return;
        console.log(`🔄 [SIIF Form] Loading draft for school: ${user.school_id}`);
        const loadDraft = async () => {
            try {
                const res = await fetch(`/api/siif/submission/${user.school_id}`, {
                    headers: { 'Authorization': `Bearer ${user.token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    console.log('📦 [SIIF Form] Draft response:', data);
                    if (data && data.status === 'draft') {
                        // Rebuild interventionData with budgetEstimates merged in
                        const mergedIntData = {};
                        for (const intId of (data.interventions || [])) {
                            mergedIntData[intId] = {
                                ...(data.interventionData?.[intId] || emptyIntData()),
                                budgetEstimate: data.budgetEstimates?.[intId] || '',
                            };
                        }
                        setForm({
                            selectedInterventions: data.interventions || [],
                            aral: data.aral || { planned: null, subjects: [] },
                            interventionData: mergedIntData,
                            budgetEstimates: data.budgetEstimates || {},
                        });
                        console.log(`✅ [SIIF Form] Draft loaded. Interventions: ${(data.interventions || []).join(', ')}`);
                    } else {
                        console.log('ℹ️ [SIIF Form] No draft found or already submitted.');
                    }
                } else {
                    console.warn(`⚠️ [SIIF Form] Draft fetch returned status ${res.status}`);
                }
            } catch (err) {
                console.error('🔥 [SIIF Form] Failed to load draft:', err);
            }
        };
        loadDraft();
    }, [user]);

    // ─── Intervention Toggle ──────────────────────────────────────────────────
    const toggleIntervention = useCallback((id) => {
        setForm(p => {
            const isSelected = p.selectedInterventions.includes(id);
            const newList = isSelected
                ? p.selectedInterventions.filter(x => x !== id)
                : [...p.selectedInterventions, id];
            const newData = { ...p.interventionData };
            if (!isSelected && !newData[id]) newData[id] = emptyIntData();
            console.log(`🔀 [SIIF Form] Toggled intervention "${id}". Now selected: [${newList.join(', ')}]`);
            return { ...p, selectedInterventions: newList, interventionData: newData };
        });
    }, []);

    // ─── Grade Toggle ─────────────────────────────────────────────────────────
    const toggleGrade = useCallback((intId, gradeId) => {
        setForm(p => {
            const d = p.interventionData[intId] || emptyIntData();
            const has = d.selectedGrades.includes(gradeId);
            const grades = has ? d.selectedGrades.filter(x => x !== gradeId) : [...d.selectedGrades, gradeId];
            console.log(`📋 [SIIF Form][${intId}] Grade toggled: ${gradeId}. Now: [${grades.join(', ')}]`);
            return { ...p, interventionData: { ...p.interventionData, [intId]: { ...d, selectedGrades: grades } } };
        });
    }, []);

    // ─── Beneficiary Count ────────────────────────────────────────────────────
    const updateBenCount = useCallback((intId, gradeId, val) => {
        setForm(p => ({
            ...p,
            interventionData: {
                ...p.interventionData,
                [intId]: {
                    ...p.interventionData[intId],
                    beneficiaryCounts: { ...p.interventionData[intId].beneficiaryCounts, [gradeId]: val }
                }
            }
        }));
    }, []);

    // ─── Activity Toggle ──────────────────────────────────────────────────────
    const toggleActivity = useCallback((intId, catId, choice) => {
        setForm(p => {
            const d = p.interventionData[intId] || emptyIntData();
            const cats = d.selectedActivities[catId] || [];
            const updated = cats.includes(choice) ? cats.filter(c => c !== choice) : [...cats, choice];
            console.log(`🎯 [SIIF Form][${intId}][${catId}] Activity toggled: "${choice}"`);
            return {
                ...p,
                interventionData: {
                    ...p.interventionData,
                    [intId]: { ...d, selectedActivities: { ...d.selectedActivities, [catId]: updated } }
                }
            };
        });
    }, []);

    // ─── Budget Update ────────────────────────────────────────────────────────
    const updateBudget = useCallback((intId, val) => {
        setForm(p => ({
            ...p,
            budgetEstimates: { ...p.budgetEstimates, [intId]: val },
            interventionData: {
                ...p.interventionData,
                [intId]: { ...p.interventionData[intId], budgetEstimate: val }
            }
        }));
    }, []);

    const totalBudget = Object.values(form.budgetEstimates).reduce((s, v) => s + (parseFloat(v) || 0), 0);

    // ─── Navigation ───────────────────────────────────────────────────────────
    const goNext = () => {
        if (isSelectionStep && form.selectedInterventions.length === 0) {
            alert('Please select at least one intervention.');
            return;
        }
        console.log(`➡️ [SIIF Form] Moving from step ${step} to ${step + 1}`);
        setStep(s => s + 1);
        window.scrollTo(0, 0);
    };

    const goBack = () => {
        if (step > 0) {
            console.log(`⬅️ [SIIF Form] Moving from step ${step} to ${step - 1}`);
            setStep(s => s - 1);
            window.scrollTo(0, 0);
        } else {
            navigate('/');
        }
    };

    // ─── Submit / Save Draft ──────────────────────────────────────────────────
    const handleSubmit = async (status) => {
        if (!user?.school_id) {
            alert('Error: User session not found. Please log in again.');
            return;
        }
        setSaving(true);
        console.log(`\n🚀 [SIIF Form] ===== INITIATING ${status.toUpperCase()} =====`);
        console.log(`👤 School: ${user.school_name} (${user.school_id})`);
        console.log(`📊 Selected Interventions: [${form.selectedInterventions.join(', ')}]`);
        console.log(`💰 Total Budget: ₱${totalBudget}`);
        console.log(`📝 Intervention Data:`, JSON.stringify(form.interventionData, null, 2));
        console.log(`🏫 ARAL:`, JSON.stringify(form.aral, null, 2));

        const payload = {
            schoolId: user.school_id,
            schoolName: user.school_name,
            region: user.region,
            division: user.division,
            interventions: form.selectedInterventions,
            budgetEstimates: form.budgetEstimates,
            interventionData: form.interventionData,
            aral: form.aral,
            totalBudget,
            status,
        };
        console.log('📤 [SIIF Form] Full payload being sent:', JSON.stringify(payload, null, 2));

        try {
            const response = await fetch('/api/siif/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`,
                },
                body: JSON.stringify(payload),
            });

            console.log(`🔁 [SIIF Form] Response status: ${response.status}`);

            if (!response.ok) {
                const errText = await response.text();
                console.error(`🔥 [SIIF Form] Non-OK response body: ${errText}`);
                throw new Error(`Server returned ${response.status}: ${errText}`);
            }

            const data = await response.json();
            console.log('📬 [SIIF Form] Response data:', data);

            if (data.success) {
                console.log(`✅ [SIIF Form] Successfully saved. Submission ID: ${data.submissionId}`);
                if (status === 'submitted') {
                    alert('Plan Submitted Successfully!');
                    navigate('/');
                } else {
                    alert('Draft Saved Successfully!');
                }
            } else {
                throw new Error(data.error || 'Unknown server error');
            }
        } catch (err) {
            console.error('🔥 [SIIF Form] Submission failed:', err);
            alert(`Error: ${err.message}`);
        } finally {
            setSaving(false);
            console.log(`===== ${status.toUpperCase()} COMPLETE =====\n`);
        }
    };

    // ─── Step Label ───────────────────────────────────────────────────────────
    const getStepLabel = () => {
        if (isSelectionStep) return 'Select Interventions';
        if (isReviewStep) return 'Review & Submit';
        const intInfo = INTERVENTIONS.find(i => i.id === currentIntId);
        return intInfo?.label || '';
    };

    const progressPct = totalSteps > 1 ? (step / (totalSteps - 1)) * 100 : 0;

    // ─── Render: Intervention Selection ──────────────────────────────────────
    const renderSelectionStep = () => (
        <div className="space-y-3">
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 mb-6">
                <h2 className="text-xl font-black text-deped-blue italic uppercase tracking-tight">What interventions does your school plan?</h2>
                <p className="text-slate-500 text-sm mt-1">Select all that apply. You will configure each one in the next steps.</p>
            </div>
            {INTERVENTIONS.map(opt => {
                const active = form.selectedInterventions.includes(opt.id);
                return (
                    <React.Fragment key={opt.id}>
                        <button onClick={() => toggleIntervention(opt.id)}
                            className={`w-full p-5 rounded-3xl border-2 text-left flex items-start justify-between gap-4 transition-all duration-300 ${active ? 'border-deped-blue bg-blue-50/50 shadow-md translate-x-1' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                        >
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all ${active ? 'bg-deped-blue text-white' : 'bg-slate-50 text-slate-400'}`}>
                                {INTERVENTION_ICONS[opt.id] || <TbTarget size={22} />}
                            </div>
                            <div className="flex-1">
                                <p className={`font-black text-sm uppercase tracking-tight ${active ? 'text-deped-blue' : 'text-slate-700'}`}>{opt.label}</p>
                                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{opt.desc}</p>
                            </div>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${active ? 'border-deped-blue bg-deped-blue' : 'border-slate-200 bg-slate-50'}`}>
                                {active && <TbCheck size={14} className="text-white" />}
                            </div>
                        </button>
                        {active && opt.id === 'remediation' && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                                className="mx-4 p-5 bg-amber-50 rounded-b-3xl border-x-2 border-b-2 border-amber-200/50 space-y-4">
                                <p className="text-xs font-bold text-amber-800 flex items-center gap-2 italic"><FiInfo /> Do you plan to implement ARAL?</p>
                                <div className="flex gap-2">
                                    <button onClick={() => setForm(p => ({ ...p, aral: { ...p.aral, planned: true } }))}
                                        className={`flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${form.aral.planned === true ? 'bg-deped-blue text-white shadow-lg' : 'bg-white text-slate-400 border border-amber-200'}`}
                                    >Yes</button>
                                    <button onClick={() => setForm(p => ({ ...p, aral: { ...p.aral, planned: false } }))}
                                        className={`flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${form.aral.planned === false ? 'bg-slate-100 text-slate-600' : 'bg-white text-slate-400 border border-amber-200'}`}
                                    >No</button>
                                </div>
                                {form.aral.planned === true && (
                                    <div className="space-y-3">
                                        <p className="text-[10px] text-amber-600 font-black uppercase tracking-widest">ARAL Subject Areas</p>
                                        <div className="flex flex-wrap gap-2">
                                            {['Reading', 'Mathematics', 'Science'].map(subj => {
                                                const checked = form.aral.subjects.includes(subj);
                                                return (
                                                    <button key={subj} onClick={() => setForm(p => ({ ...p, aral: { ...p.aral, subjects: checked ? p.aral.subjects.filter(s => s !== subj) : [...p.aral.subjects, subj] } }))}
                                                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${checked ? 'bg-deped-blue border-deped-blue text-white' : 'bg-white border-amber-200 text-amber-700'}`}
                                                    >{subj}</button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );

    // ─── Render: Per-Intervention Step ────────────────────────────────────────
    const renderInterventionStep = (intId) => {
        const intInfo = INTERVENTIONS.find(i => i.id === intId);
        const data = form.interventionData[intId] || emptyIntData();
        return (
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                    <div className="inline-flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 mb-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-deped-blue" />
                        <p className="text-deped-blue text-[9px] font-black uppercase tracking-widest">Configure Intervention</p>
                    </div>
                    <h2 className="text-2xl font-black text-deped-blue italic uppercase tracking-tight">{intInfo?.label}</h2>
                    <p className="text-slate-500 text-sm mt-1">{intInfo?.desc}</p>
                </div>

                {/* Target Learners */}
                <div className="bg-white p-6 rounded-[2.5rem] shadow-md border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><TbUsers size={14} /> Target Learners</p>
                    {KEY_STAGES.map(ks => (
                        <div key={ks.id} className="mb-5">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2">{ks.label}</p>
                            <div className="flex flex-wrap gap-2 mb-3">
                                {ks.grades.map(g => {
                                    const active = data.selectedGrades.includes(g);
                                    return (
                                        <button key={g} onClick={() => toggleGrade(intId, g)}
                                            className={`px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all duration-300 ${active ? 'bg-deped-blue text-white shadow-md' : 'bg-slate-50 text-slate-500 border border-slate-100 hover:bg-slate-100'}`}
                                        >{GRADE_LABELS[g]}</button>
                                    );
                                })}
                            </div>
                            <div className="space-y-2">
                                {ks.grades.filter(g => data.selectedGrades.includes(g)).map(g => (
                                    <div key={g} className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                        <span className="text-[10px] font-black text-slate-600 uppercase">{GRADE_LABELS[g]} Learners</span>
                                        <input type="number" min="0" placeholder="0"
                                            className="w-24 bg-white border border-slate-200 rounded-xl px-4 py-2 text-right text-xs font-black text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                                            value={data.beneficiaryCounts[g] || ''}
                                            onChange={e => updateBenCount(intId, g, e.target.value)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Activities */}
                <div className="bg-white p-6 rounded-[2.5rem] shadow-md border border-slate-100 space-y-8">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><TbBulb size={14} /> Planned Activities</p>
                    <div className="space-y-3">
                        <p className="text-sm font-black text-slate-800 italic flex items-center gap-2"><TbBook size={16} className="text-deped-blue" />SIP–AIP–Aligned</p>
                        <div className="space-y-2">
                            {SIP_AIP_ACTIVITIES.map(choice => {
                                const active = (data.selectedActivities.sip_aip || []).includes(choice);
                                return (
                                    <React.Fragment key={choice}>
                                        <button onClick={() => toggleActivity(intId, 'sip_aip', choice)}
                                            className={`w-full p-4 rounded-2xl text-left text-[11px] font-bold flex items-start gap-4 transition-all border-2 ${active ? 'border-deped-blue bg-blue-50/50 text-deped-blue' : 'border-slate-50 bg-slate-50/50 text-slate-500'}`}
                                        >
                                            <div className={`w-5 h-5 rounded-md mt-0.5 shrink-0 flex items-center justify-center ${active ? 'bg-deped-blue' : 'bg-slate-200'}`}>
                                                {active && <TbCheck size={12} className="text-white" />}
                                            </div>
                                            {choice}
                                        </button>
                                        {active && choice.includes('Others') && (
                                            <div className="px-2 pb-2">
                                                <input type="text" placeholder="Please specify activity..."
                                                    className="w-full bg-white border border-blue-100 rounded-xl px-4 py-3 text-[11px] font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                                                    value={data.otherActivity || ''}
                                                    onChange={e => setForm(p => ({ ...p, interventionData: { ...p.interventionData, [intId]: { ...data, otherActivity: e.target.value } } }))}
                                                />
                                            </div>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>
                    <div className="space-y-3">
                        <p className="text-sm font-black text-slate-800 italic flex items-center gap-2"><TbChartBar size={16} className="text-deped-blue" />Action Research (AR)</p>
                        {(() => {
                            const choice = 'Implementation of Action Research or innovative interventions designed to improve learner performance';
                            const active = (data.selectedActivities.action_research || []).includes(choice);
                            return (
                                <button onClick={() => toggleActivity(intId, 'action_research', choice)}
                                    className={`w-full p-4 rounded-2xl text-left text-[11px] font-bold flex items-start gap-4 transition-all border-2 ${active ? 'border-deped-blue bg-blue-50/50 text-deped-blue' : 'border-slate-50 bg-slate-50/50 text-slate-500'}`}
                                >
                                    <div className={`w-5 h-5 rounded-md mt-0.5 shrink-0 flex items-center justify-center ${active ? 'bg-deped-blue' : 'bg-slate-200'}`}>
                                        {active && <TbCheck size={12} className="text-white" />}
                                    </div>
                                    {choice}
                                </button>
                            );
                        })()}
                    </div>
                    <div className="space-y-3">
                        <p className="text-sm font-black text-slate-800 italic flex items-center gap-2"><TbWallet size={16} className="text-deped-blue" />Remaining SIIF Balance</p>
                        <div className="space-y-2">
                            {REMAINING_ACTIVITIES.map(choice => {
                                const active = (data.selectedActivities.remaining || []).includes(choice);
                                return (
                                    <button key={choice} onClick={() => toggleActivity(intId, 'remaining', choice)}
                                        className={`w-full p-4 rounded-2xl text-left text-[11px] font-bold flex items-start gap-4 transition-all border-2 ${active ? 'border-deped-blue bg-blue-50/50 text-deped-blue' : 'border-slate-50 bg-slate-50/50 text-slate-500'}`}
                                    >
                                        <div className={`w-5 h-5 rounded-md mt-0.5 shrink-0 flex items-center justify-center ${active ? 'bg-deped-blue' : 'bg-slate-200'}`}>
                                            {active && <TbCheck size={12} className="text-white" />}
                                        </div>
                                        {choice}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Budget Estimate */}
                <div className="bg-white p-6 rounded-[2.5rem] shadow-md border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><TbWallet size={14} /> Budget Estimate for {intInfo?.label}</p>
                    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-[2rem] border border-slate-100">
                        <div className="flex-1">
                            <p className="text-xs font-black text-slate-700 italic uppercase">{intInfo?.label}</p>
                        </div>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-deped-blue font-black text-sm">₱</span>
                            <input type="number" placeholder="0.00"
                                className="bg-white border border-slate-200 pl-10 pr-4 py-3 rounded-2xl w-44 text-right font-black text-sm text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                                value={form.budgetEstimates[intId] || ''}
                                onChange={e => updateBudget(intId, e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // ─── Render: Review Step ──────────────────────────────────────────────────
    const renderReviewStep = () => (
        <div className="space-y-6 pb-20">
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                <h2 className="text-xl font-black text-deped-blue italic uppercase tracking-tight">Final Review</h2>
                <p className="text-slate-500 text-sm mt-1">Review your plan before official submission.</p>
            </div>
            <div className="bg-white p-8 rounded-[3.5rem] shadow-2xl border border-slate-100 space-y-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full -mr-32 -mt-32 opacity-50" />
                <div className="relative z-10 space-y-8">
                    {form.selectedInterventions.map(intId => {
                        const intInfo = INTERVENTIONS.find(i => i.id === intId);
                        const data = form.interventionData[intId] || emptyIntData();
                        const allActivities = Object.values(data.selectedActivities).flat();
                        return (
                            <div key={intId} className="border-b border-slate-100 pb-8 last:border-0 last:pb-0">
                                <h3 className="text-xl font-black text-deped-blue italic uppercase mb-4">{intInfo?.label}</h3>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div className="bg-slate-50 p-4 rounded-3xl">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Target Learners</p>
                                        <p className="text-xs font-bold text-slate-700">{data.selectedGrades.length} Grade{data.selectedGrades.length !== 1 ? 's' : ''}</p>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-3xl text-right">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Budget</p>
                                        <p className="text-xs font-black text-deped-blue">₱ {(parseFloat(form.budgetEstimates[intId]) || 0).toLocaleString()}</p>
                                    </div>
                                </div>
                                {allActivities.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Planned Activities</p>
                                        {allActivities.map((act, idx) => (
                                            <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-50 shadow-sm">
                                                <div className="w-1.5 h-1.5 rounded-full bg-deped-blue" />
                                                <p className="text-[11px] font-bold text-slate-600">{act}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                <div className="p-8 bg-deped-blue rounded-[3rem] text-white flex flex-col items-center relative z-10">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 opacity-60">Total Budget Estimate</p>
                    <p className="text-3xl font-black italic tracking-tighter">₱ {totalBudget.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="p-6 bg-amber-50 rounded-[2rem] border border-amber-100 flex items-center gap-4 relative z-10">
                    <FiAlertCircle size={28} className="text-amber-500 shrink-0" />
                    <p className="text-xs font-medium text-amber-800 leading-relaxed italic">Please ensure all details are consistent with your SIP/AIP plans. Once submitted, this data will be consolidated for SDO monitoring.</p>
                </div>
            </div>
            <button onClick={() => handleSubmit('submitted')} disabled={saving}
                className="w-full py-8 bg-deped-red text-white rounded-[3rem] font-black text-lg uppercase tracking-widest shadow-2xl shadow-red-900/40 hover:scale-[1.02] active:scale-95 transition-all flex flex-col items-center justify-center gap-1 group"
            >
                <span className="text-[10px] opacity-60 tracking-[0.3em]">Final Step</span>
                <div className="flex items-center gap-3">
                    {saving ? 'Submitting...' : 'Confirm and Submit Plan'}
                    {!saving && <TbCircleCheck className="group-hover:scale-125 transition-transform" size={24} />}
                </div>
            </button>
            <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">By clicking submit, you confirm this plan has been reviewed by the school planning team.</p>
        </div>
    );

    // ─── Main Render ──────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-slate-50 pb-40">
            {/* Header */}
            <div className="bg-deped-blue text-white pt-16 pb-12 px-8 rounded-b-[4rem] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -mr-32 -mt-32" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-deped-red/10 rounded-full blur-3xl -ml-24 -mb-24" />
                <div className="relative z-10 flex items-center justify-between mb-6">
                    <button onClick={goBack} className="p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20">
                        <TbChevronLeft size={20} />
                    </button>
                    <div className="text-center">
                        <h1 className="text-xl font-black italic tracking-tighter uppercase">SIIF Planner</h1>
                        <p className="text-[9px] font-bold text-blue-200 uppercase tracking-[0.3em]">{getStepLabel()}</p>
                    </div>
                    <button onClick={() => handleSubmit('draft')} disabled={saving} className="p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20">
                        <FiSave size={20} />
                    </button>
                </div>
                {/* Progress */}
                <div className="relative z-10 mx-2">
                    <div className="flex justify-between text-[9px] font-black uppercase tracking-widest opacity-60 mb-2">
                        <span>Step {step + 1}</span><span>of {totalSteps}</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <motion.div className="h-full bg-white rounded-full"
                            animate={{ width: `${progressPct}%` }}
                            transition={{ duration: 0.4, ease: 'easeInOut' }}
                        />
                    </div>
                    {!isSelectionStep && !isReviewStep && (
                        <div className="flex justify-around mt-3">
                            {form.selectedInterventions.map((intId, idx) => {
                                const intInfo = INTERVENTIONS.find(i => i.id === intId);
                                const isDone = idx < step - 1;
                                const isActive = idx === step - 1;
                                return (
                                    <div key={intId} className={`flex flex-col items-center gap-1 transition-all ${isActive ? 'opacity-100' : 'opacity-30'}`}>
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isActive ? 'bg-white text-deped-blue' : 'bg-white/10 text-white'}`}>
                                            {isDone ? <TbCircleCheck size={16} /> : (INTERVENTION_ICONS[intId] || <TbTarget size={14} />)}
                                        </div>
                                        <span className="text-[7px] font-black uppercase tracking-wider text-white/70 max-w-[44px] text-center leading-tight">{intInfo?.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Step Content */}
            <div className="px-6 -mt-8 relative z-20">
                <AnimatePresence mode="wait">
                    <motion.div key={step}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.25 }}
                    >
                        {isSelectionStep && renderSelectionStep()}
                        {currentIntId && renderInterventionStep(currentIntId)}
                        {isReviewStep && renderReviewStep()}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Bottom Navigation */}
            {!isReviewStep && (
                <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-2xl border-t border-slate-100 flex gap-4 z-50">
                    {step > 0 && (
                        <button onClick={goBack}
                            className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-[2rem] font-black text-xs uppercase tracking-widest active:scale-95 transition-transform flex items-center justify-center gap-2"
                        >
                            <TbChevronLeft size={18} /> Back
                        </button>
                    )}
                    <button onClick={goNext}
                        className="flex-[2] py-5 bg-deped-blue text-white rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-900/20 active:scale-95 transition-transform flex items-center justify-center gap-2"
                    >
                        {isSelectionStep ? 'Start Configuring' : 'Continue'} <TbChevronRight />
                    </button>
                </div>
            )}
        </div>
    );
};

export default SIIFForm;
