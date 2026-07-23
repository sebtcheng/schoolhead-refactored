import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TbCheck, TbChevronLeft, TbChevronRight, TbArrowLeft, TbX, TbPlus, TbTrash, TbTarget, TbList } from 'react-icons/tb';

const PIA_DATA = {
    "Access and Quality": {
        "IO1: Learners are in school and learning centers": [
            "High absenteeism rates",
            "High learner dropout rates",
            "Low enrollment participation",
            "Low intake of age-appropriate learners in Kinder",
            "High incidence of late enrollment",
            "Low school attendance",
            "Low completion rates",
            "Inadequate learner tracking and intervention mechanisms",
            "Low re-enrollment rates of returning learners and out-of-school youth"
        ],
        "IO2: Learners access programs responsive to their needs and consistent with their interests and aptitudes": [
            "Limited availability of differentiated learning programs",
            "Weak implementation of career guidance services",
            "Inadequate support for learners with special educational needs",
            "Insufficient alternative delivery modes for diverse learner circumstances",
            "Mismatch between learner interests and program offerings",
            "Low participation in technical-vocational, arts, sports, and special-interest programs",
            "Limited access to inclusive education services",
            "Inadequate learner profiling and needs assessment systems",
            "Insufficient interventions for at-risk learners",
            "Lack of access to special-interest programs"
        ],
        "IO3: Learners enjoy a learner-friendly environment": [
            "High incidence of bullying",
            "High incidence of child abuse",
            "Inadequate classroom facilities and learning spaces",
            "Poor water, sanitation, and hygiene (WASH) facilities",
            "Limited access to learning resources and equipment",
            "Weak implementation of child protection policies",
            "Inadequate psychosocial support services",
            "Lack of facilities for learners with disabilities",
            "Poor classroom management practices",
            "Insufficient disaster-resilient and climate-responsive facilities"
        ],
        "IO4: Learners actively participate in their learning environment": [
            "Low classroom engagement and participation",
            "Weak learner leadership and student voice mechanisms",
            "Poor attendance in co-curricular and extracurricular activities",
            "Limited opportunities for collaborative and experiential learning",
            "Low parental involvement in supporting learner engagement",
            "Insufficient learner motivation and self-directed learning skills",
            "Weak integration of technology to enhance participation",
            "Low participation in school governance and student organizations",
            "Inadequate feedback systems between learners and teachers"
        ],
        "IO5: Learners attain learning standards": [
            "Low literacy proficiency levels",
            "Low numeracy proficiency levels",
            "Weak learner retention",
            "Low promotion rates",
            "Poor performance in national and local assessments",
            "Significant learning losses and gaps",
            "Low mastery of curriculum competencies",
            "Weak formative and summative assessment practices",
            "Inadequate teacher capacity in content and pedagogy",
            "Lack of access to teacher professional development",
            "Limited access to quality instructional materials",
            "Poor learning outcomes among specific learner groups",
            "Weak remediation and intervention programs for struggling learners"
        ],
        "IO6: Learners are well-rounded, happy, and smart": [
            "Low levels of socio-emotional competencies",
            "High incidence of learner stress, anxiety, and mental health concerns",
            "Poor health and nutrition status of learners",
            "Limited participation in sports, arts, and cultural activities",
            "Weak development of values, character, and citizenship",
            "Low life skills and 21st-century skills competencies",
            "Inadequate guidance and counseling services",
            "Limited opportunities for creativity, innovation, and critical thinking",
            "Low learner well-being and school satisfaction",
            "Weak programs supporting holistic learner development"
        ]
    },
    "Governance": {
        "IO1: Education leaders and managers practice participative and inclusive management processes": [
            "Limited stakeholder participation in planning and decision-making",
            "Weak shared governance mechanisms at school, district, and division levels",
            "Inadequate stakeholder representation in committees and councils",
            "Low transparency in management decisions and resource allocation",
            "Insufficient consultation processes with teachers, learners, parents, and communities",
            "Weak feedback and grievance redress mechanisms",
            "Limited leadership competencies in participative and inclusive management",
            "Low engagement of marginalized and vulnerable groups in governance processes",
            "Poor communication between management and stakeholders",
            "Limited use of data and evidence in participatory decision-making"
        ],
        "IO2: Internal systems and processes needed for continuous improvement are in place": [
            "Weak monitoring, evaluation, and reporting systems",
            "Inadequate use of data for planning and decision-making",
            "Lack of institutionalized quality assurance mechanisms",
            "Weak performance management and accountability systems",
            "Delays in implementation of programs and projects",
            "Inadequate risk management and internal control systems",
            "Limited capacity for organizational learning and knowledge management",
            "Weak resource planning and utilization processes",
            "Inconsistent implementation of policies, standards, and procedures",
            "Limited ICT systems supporting management and operations",
            "Insufficient mechanisms for innovation and continuous improvement"
        ],
        "IO3: Growing number of stakeholders actively participate and collaborate in convergence mechanisms at all levels": [
            "Low stakeholder participation in education programs and initiatives",
            "Weak partnerships with local government units, NGOs, civil society organizations, and private sector partners",
            "Limited functionality of school-community partnership mechanisms",
            "Inadequate stakeholder mobilization and engagement strategies",
            "Weak inter-agency coordination and collaboration",
            "Low parental involvement in school activities and learner support",
            "Insufficient community participation in school governance",
            "Limited engagement of alumni and volunteer groups",
            "Weak communication and information-sharing among stakeholders",
            "Lack of sustainable partnership agreements and resource-sharing arrangements",
            "Limited stakeholder recognition and incentive mechanisms",
            "Poor monitoring of partnership effectiveness and stakeholder contributions"
        ]
    }
};

const PriorityImprovementAreaCard = ({ value = [], onChange, onConfirm, onClose, readOnly }) => {
    const [screen, setScreen] = useState('form'); // 'form' | 'summary'
    const [confirmText, setConfirmText] = useState('');
    const [confirmError, setConfirmError] = useState(false);

    // Form Sub-screens: 'list' | 'category' | 'io' | 'pias'
    const [subScreen, setSubScreen] = useState('list');

    // Drill-down state
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedIO, setSelectedIO] = useState('');
    const [draftPIAs, setDraftPIAs] = useState([]); // PIAs selected in the current session

    console.log('🛡️ [PriorityImprovementAreaCard] Rendered with:', { readOnly, value, screen, subScreen });

    const handleRemove = (index) => {
        if (readOnly) return;
        const next = value.filter((_, i) => i !== index);
        onChange(next);
    };

    const handleBack = () => {
        if (screen === 'summary') {
            setScreen('form');
            setSubScreen('list');
        } else {
            if (subScreen === 'pias') setSubScreen('io');
            else if (subScreen === 'io') setSubScreen('category');
            else if (subScreen === 'category') setSubScreen('list');
            else onClose();
        }
    };

    const toggleDraftPIA = (pia) => {
        if (draftPIAs.includes(pia)) {
            setDraftPIAs(draftPIAs.filter(p => p !== pia));
        } else {
            setDraftPIAs([...draftPIAs, pia]);
        }
    };

    const saveDraftPIAs = () => {
        const newEntries = draftPIAs.map(pia => `[${selectedCategory}] ${selectedIO} - ${pia}`);

        // Prevent exact duplicates
        const uniqueNext = [...value];
        newEntries.forEach(entry => {
            if (!uniqueNext.includes(entry)) uniqueNext.push(entry);
        });

        onChange(uniqueNext);

        // Reset and go back to list
        setDraftPIAs([]);
        setSelectedCategory('');
        setSelectedIO('');
        setSubScreen('list');
    };

    const goToSummary = () => {
        setScreen('summary');
    };

    const handleSave = () => {
        if (readOnly) {
            onClose();
            return;
        }
        if (confirmText.trim().toUpperCase() !== 'CONFIRM') {
            setConfirmError(true);
            setTimeout(() => setConfirmError(false), 1500);
            return;
        }
        onConfirm();
    };

    // ── FORM SCREEN ─────────────────────────────────────────────────────────────
    const renderFormScreen = () => {
        if (subScreen === 'category') {
            return (
                <div className="flex-1 overflow-y-auto px-5 py-6 space-y-3 pb-36">
                    <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm mb-4">
                        <h3 className="text-sm font-black text-slate-800 mb-1 leading-snug">
                            Select Category
                        </h3>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                            Choose the broad category for your intermediate outcomes.
                        </p>
                    </div>

                    {Object.keys(PIA_DATA).map((cat) => (
                        <button
                            key={cat}
                            onClick={() => {
                                setSelectedCategory(cat);
                                setSubScreen('io');
                            }}
                            className="siif-card w-full p-5 rounded-3xl border-2 border-transparent bg-white hover:border-slate-200 shadow-sm text-left flex items-center gap-4 transition-all duration-300 active:scale-[0.98]"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-siif-blue flex items-center justify-center shrink-0">
                                <TbTarget size={24} />
                            </div>
                            <div className="flex-1">
                                <p className="font-black text-[15px] uppercase tracking-tight leading-snug text-slate-700">{cat}</p>
                            </div>
                            <TbChevronRight className="text-slate-400" size={20} />
                        </button>
                    ))}

                    <div className="pt-2 mt-4">
                        <button
                            onClick={() => setSubScreen('list')}
                            className="w-full py-4 bg-white text-slate-600 rounded-2xl font-black text-sm uppercase tracking-widest border-2 border-slate-200 hover:bg-slate-50 hover:text-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <TbArrowLeft size={18} /> Back to List
                        </button>
                    </div>
                </div>
            );
        }

        if (subScreen === 'io') {
            const ios = Object.keys(PIA_DATA[selectedCategory]);
            return (
                <div className="flex-1 overflow-y-auto px-5 py-6 space-y-3 pb-36">
                    <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm mb-4">
                        <p className="text-[10px] text-siif-blue font-black uppercase tracking-widest mb-1">{selectedCategory}</p>
                        <h3 className="text-sm font-black text-slate-800 mb-1 leading-snug">
                            Select Intermediate Outcome
                        </h3>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                            Choose the specific outcome of focus.
                        </p>
                    </div>

                    {ios.map((io) => {
                        const [ioKey, ...rest] = io.split(':');
                        const ioDesc = rest.join(':').trim();
                        return (
                            <button
                                key={io}
                                onClick={() => {
                                    setSelectedIO(io);
                                    setDraftPIAs([]); // Reset drafts when changing IO
                                    setSubScreen('pias');
                                }}
                                className="siif-card w-full p-5 rounded-3xl border-2 border-transparent bg-white hover:border-slate-200 shadow-sm text-left flex items-start gap-4 transition-all duration-300 active:scale-[0.98]"
                            >
                                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                                    <span className="font-black text-xs">{ioKey}</span>
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-sm leading-snug text-slate-700">{ioDesc}</p>
                                </div>
                                <TbChevronRight className="text-slate-400 mt-2" size={20} />
                            </button>
                        );
                    })}

                    <div className="pt-2 mt-4">
                        <button
                            onClick={() => setSubScreen('category')}
                            className="w-full py-4 bg-white text-slate-600 rounded-2xl font-black text-sm uppercase tracking-widest border-2 border-slate-200 hover:bg-slate-50 hover:text-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <TbArrowLeft size={18} /> Back to Categories
                        </button>
                    </div>
                </div>
            );
        }

        if (subScreen === 'pias') {
            const pias = PIA_DATA[selectedCategory][selectedIO];
            return (
                <div className="flex-1 overflow-y-auto px-5 py-6 pb-36 flex flex-col">
                    <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm mb-4 shrink-0">
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1 line-clamp-1">{selectedCategory} / {selectedIO.split(':')[0]}</p>
                        <h3 className="text-sm font-black text-slate-800 mb-1 leading-snug">
                            Select Priority Areas
                        </h3>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                            Select priority areas serving as basis of SIIF interventions.
                        </p>
                    </div>

                    <div className="space-y-3 flex-1 mb-6">
                        {pias.map((pia) => {
                            const active = draftPIAs.includes(pia);
                            // Check if this PIA is already in the main value array
                            const isAlreadyAdded = value.includes(`[${selectedCategory}] ${selectedIO} - ${pia}`);

                            return (
                                <button
                                    key={pia}
                                    onClick={() => toggleDraftPIA(pia)}
                                    disabled={isAlreadyAdded}
                                    className={`siif-card w-full p-4 rounded-3xl border-2 text-left flex items-center gap-4 transition-all duration-300 ${!isAlreadyAdded ? 'active:scale-[0.98]' : ''} ${active
                                        ? 'border-siif-blue bg-blue-50/40 shadow-lg shadow-blue-100/50'
                                        : isAlreadyAdded
                                            ? 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
                                            : 'border-transparent bg-white hover:border-slate-200 shadow-sm'
                                        }`}
                                >
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${active || isAlreadyAdded ? 'border-siif-blue bg-siif-blue' : 'border-slate-200 bg-white'
                                        }`}>
                                        {(active || isAlreadyAdded) && <TbCheck size={13} className="text-white" />}
                                    </div>
                                    <div className="flex-1">
                                        <p className={`font-semibold text-[13px] leading-snug ${active || isAlreadyAdded ? 'text-siif-blue' : 'text-slate-700'
                                            }`}>{pia}</p>
                                        {isAlreadyAdded && <p className="text-[10px] text-slate-500 mt-1 italic">Already added to list</p>}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <div className="pt-2 flex items-center gap-3 w-full shrink-0">
                        <button
                            onClick={() => setSubScreen('io')}
                            className="flex-1 py-5 bg-white text-slate-600 rounded-2xl font-black text-sm uppercase tracking-widest border-2 border-slate-200 hover:bg-slate-50 hover:text-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <TbArrowLeft size={18} /> Back
                        </button>
                        <button
                            onClick={saveDraftPIAs}
                            disabled={draftPIAs.length === 0}
                            className="flex-[2] py-5 bg-deped-blue text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-900/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <TbCheck size={18} /> Save {draftPIAs.length} Selection{draftPIAs.length !== 1 ? 's' : ''}
                        </button>
                    </div>
                </div>
            );
        }

        // Default 'list' view
        return (
            <div className="flex-1 overflow-y-auto px-5 py-6 space-y-3 pb-36">
                <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm mb-2">
                    <h3 className="text-sm font-black text-slate-800 mb-1 leading-snug">
                        Priority Improvement Areas
                    </h3>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                        {readOnly
                            ? "Viewing priority improvement areas for this fiscal year."
                            : "List down the relevant Priority Improvement Areas (PIAs) of your school based on your approved SIP."}
                    </p>
                </div>

                <div className="space-y-3">
                    {/* Display existing PIAs */}
                    {value.map((area, index) => {
                        // Try to parse out category and IO for better styling if it matches our format
                        const match = area.match(/^\[(.*?)\] (IO\d+:.*?) - (.*)$/);
                        if (match) {
                            const [_, cat, io, pia] = match;
                            return (
                                <div key={index} className="flex gap-3 items-start bg-white p-4 rounded-3xl border-2 border-slate-100 shadow-sm group">
                                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-siif-blue flex items-center justify-center shrink-0">
                                        <span className="font-black text-xs">{index + 1}</span>
                                    </div>
                                    <div className="flex-1 pt-1">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 line-clamp-1">{cat} / {io.split(':')[0]}</p>
                                        <p className="text-sm font-bold text-slate-700 whitespace-pre-wrap leading-snug">{pia}</p>
                                    </div>
                                    {!readOnly && (
                                        <button
                                            onClick={() => handleRemove(index)}
                                            className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-red-50 hover:text-red-500 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                                            title="Remove"
                                        >
                                            <TbTrash size={18} />
                                        </button>
                                    )}
                                </div>
                            );
                        }

                        // Fallback for custom/legacy strings
                        return (
                            <div key={index} className="flex gap-3 items-start bg-white p-4 rounded-3xl border-2 border-slate-100 shadow-sm group">
                                <div className="w-8 h-8 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center shrink-0">
                                    <span className="font-black text-xs">{index + 1}</span>
                                </div>
                                <p className="w-full text-sm font-medium text-slate-700 whitespace-pre-wrap pt-1">{area}</p>
                                {!readOnly && (
                                    <button
                                        onClick={() => handleRemove(index)}
                                        className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-red-50 hover:text-red-500 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                                        title="Remove"
                                    >
                                        <TbTrash size={18} />
                                    </button>
                                )}
                            </div>
                        );
                    })}

                    {value.length === 0 && !readOnly && (
                        <div className="text-center p-8 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                                <TbTarget size={24} />
                            </div>
                            <p className="text-sm font-bold text-slate-700 mb-1">No Areas Specified</p>
                            <p className="text-xs text-slate-500 mb-4 px-4">Start by adding your first priority improvement area from the predefined categories.</p>
                            <button
                                onClick={() => setSubScreen('category')}
                                className="px-6 py-3 bg-siif-blue text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-900/20 active:scale-95 transition-all mx-auto flex items-center gap-2"
                            >
                                <TbPlus size={16} /> Select Area
                            </button>
                        </div>
                    )}
                </div>

                {!readOnly && value.length > 0 && (
                    <button
                        onClick={() => setSubScreen('category')}
                        className="w-full py-4 mt-2 bg-white text-siif-blue hover:bg-blue-50 border-2 border-blue-100 border-dashed rounded-3xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                    >
                        <TbPlus size={18} /> Add Another Area
                    </button>
                )}

                {value.length > 0 && (
                    <div className="mt-6">
                        <motion.button
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={goToSummary}
                            className="w-full py-5 bg-siif-blue hover:bg-[var(--blue)] text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-900/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                        >
                            {readOnly ? 'View Summary' : 'Review Summary'} <TbChevronRight size={18} />
                        </motion.button>
                    </div>
                )}
            </div>
        );
    };

    // ── SUMMARY SCREEN ───────────────────────────────────────────────────────────
    const renderSummaryScreen = () => (
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4 pb-36">
            <div className="p-5 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Summary — Priority Improvement Areas</p>
                <div className="space-y-3">
                    {value.filter(v => v && v.trim().length > 0).map((area, index) => {
                        const match = area.match(/^\[(.*?)\] (IO\d+:.*?) - (.*)$/);
                        return (
                            <div key={index} className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0">
                                <div className="w-8 h-8 rounded-xl bg-blue-50 text-deped-blue flex items-center justify-center shrink-0 mt-1">
                                    <span className="font-black text-sm">{index + 1}</span>
                                </div>
                                <div className="flex-1">
                                    {match ? (
                                        <>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{match[1]} / {match[2].split(':')[0]}</p>
                                            <p className="text-xs font-bold text-slate-700 leading-relaxed whitespace-pre-wrap">{match[3]}</p>
                                        </>
                                    ) : (
                                        <p className="text-xs font-bold text-slate-700 leading-relaxed whitespace-pre-wrap pt-1">{area}</p>
                                    )}
                                </div>
                                <TbCheck className="ml-auto text-emerald-500 shrink-0 mt-1.5" size={16} />
                            </div>
                        );
                    })}
                    {value.filter(v => v && v.trim().length > 0).length === 0 && (
                        <p className="text-xs text-slate-500 italic">No priority improvement areas specified.</p>
                    )}
                </div>
            </div>

            {/* Navigation / Edit */}
            {!readOnly && (
                <button
                    onClick={() => {
                        setScreen('form');
                        setSubScreen('list');
                    }}
                    className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-slate-200 hover:bg-slate-200 transition-colors"
                >
                    ← Edit List
                </button>
            )}

            <div className="p-5 bg-white rounded-[2rem] border border-slate-100 shadow-sm space-y-3">
                {readOnly ? (
                    <div className="space-y-4">
                        <p className="text-[11px] font-bold text-slate-600 leading-relaxed text-center">
                            This plan has been finalized and submitted.
                        </p>
                        <button
                            onClick={onClose}
                            className="w-full py-5 bg-slate-800 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-slate-900/20 active:scale-95 transition-transform"
                        >
                            Close View
                        </button>
                    </div>
                ) : (
                    <>
                        <p className="text-[11px] font-bold text-slate-600 leading-relaxed">
                            Please confirm that the list above is accurate and complete for your school's plan.
                        </p>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            Type <span className="text-deped-blue font-black">CONFIRM</span> to save
                        </p>
                        <input
                            type="text"
                            placeholder="Type CONFIRM here..."
                            value={confirmText}
                            onChange={e => setConfirmText(e.target.value)}
                            className={`w-full px-5 py-4 rounded-2xl border-2 font-black text-sm tracking-widest text-center transition-all focus:outline-none ${confirmError
                                ? 'border-red-400 bg-red-50 text-red-600'
                                : 'border-slate-200 bg-slate-50 text-slate-800 focus:border-deped-blue focus:bg-white'
                                }`}
                        />
                        {confirmError && (
                            <p className="text-center text-[10px] text-red-500 font-bold animate-bounce">Please type CONFIRM exactly</p>
                        )}
                        <div className="mt-3">
                            <button
                                onClick={handleSave}
                                className="w-full py-5 bg-deped-blue text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-900/20 active:scale-95 transition-transform"
                            >
                                Save Priority Areas ✓
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );

    const getHeaderTitle = () => {
        if (screen === 'summary') return 'Review & Confirm';
        if (subScreen === 'list') return 'List Areas';
        if (subScreen === 'category') return 'Select Category';
        if (subScreen === 'io') return 'Select Outcome';
        if (subScreen === 'pias') return 'Select Priority';
        return 'Priority Areas';
    };

    const getMainHeaderTitle = () => {
        if (screen === 'summary') return 'Review & Confirm';
        if (subScreen === 'list') return 'Priority Improvement Areas';
        if (subScreen === 'category') return 'Category';
        if (subScreen === 'io') return 'Intermediate Outcomes';
        if (subScreen === 'pias') return 'Priority Improvement Areas';
        return 'List Priority Improvement Areas';
    };

    const getEyebrowText = () => {
        if (screen === 'summary') return 'Step 1 of 5 — REVIEW';
        if (subScreen === 'list') return 'Step 1 of 5 — LIST';
        return 'Step 1 of 5 — SELECT';
    };

    return (
        <div className="w-full h-full flex flex-col bg-slate-50 overflow-hidden">
            {/* Header */}
            <div className="siif-topbar !m-0 !border-x-0 !border-t-0 !rounded-b-[2rem] flex-col items-stretch !items-start !justify-start shrink-0 z-20 print:hidden relative">
                <div className="flex items-center justify-between w-full mb-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleBack}
                            className="p-3 bg-white hover:bg-slate-50 shadow-sm border border-slate-200 rounded-2xl transition-all text-slate-600"
                        >
                            {screen === 'summary' || subScreen === 'list' ? <TbX size={20} /> : <TbArrowLeft size={20} />}
                        </button>
                        <div>
                            <p className="eyebrow">
                                {getEyebrowText()}
                            </p>
                            <h1 className="text-xl font-black italic uppercase tracking-tight text-slate-800">{getMainHeaderTitle()}</h1>
                        </div>
                    </div>
                    {screen !== 'summary' && subScreen !== 'list' && (
                        <button
                            onClick={onClose}
                            className="p-3 bg-white hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 shadow-sm border border-slate-200 rounded-2xl transition-all text-slate-600 shrink-0"
                            title="Close"
                        >
                            <TbX size={20} />
                        </button>
                    )}
                </div>
                {/* Step tabs */}
                <div className="flex gap-2 w-full mt-2">
                    {['form', 'summary'].map((s) => (
                        <div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${screen === s || s === 'form' ? 'bg-siif-blue' : 'bg-slate-200'} ${screen === 'summary' && s === 'summary' ? 'bg-siif-blue' : screen === 'form' && s === 'summary' ? 'bg-slate-200' : ''}`} />
                    ))}
                </div>
            </div>

            <AnimatePresence mode="wait">
                <motion.div
                    key={`${screen}-${subScreen}`}
                    initial={{ x: screen === 'summary' || subScreen !== 'list' ? 20 : -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: screen === 'summary' || subScreen !== 'list' ? -20 : 20, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex-1 flex flex-col overflow-hidden"
                >
                    {screen === 'form' ? renderFormScreen() : renderSummaryScreen()}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default PriorityImprovementAreaCard;

