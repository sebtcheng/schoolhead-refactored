import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TbCheck, TbChevronLeft, TbChevronRight, TbArrowLeft, TbX, TbPlus, TbTrash, TbTarget, TbList, TbBook2, TbBuildingBank, TbShieldCheck, TbTrendingUp, TbChecklist } from 'react-icons/tb';

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

    const getCategoryRibbon = (category) => {
        if (!category) return 'border-l-4 border-l-slate-400';
        if (category.toUpperCase().includes('ACCESS')) return 'border-l-4 border-l-emerald-500';
        if (category.toUpperCase().includes('QUALITY')) return 'border-l-4 border-l-blue-500';
        return 'border-l-4 border-l-amber-500';
    };

    const handleDragStart = (e, index) => {
        e.dataTransfer.setData('text/plain', index.toString());
    };

    const handleDrop = (e, targetIndex) => {
        e.preventDefault();
        const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;
        const next = [...value];
        const [moved] = next.splice(sourceIndex, 1);
        next.splice(targetIndex, 0, moved);
        onChange(next);
    };

    const handleKeyboardReorder = (e, index) => {
        if (readOnly) return;
        if (e.key === 'ArrowUp' && index > 0) {
            e.preventDefault();
            const next = [...value];
            const [moved] = next.splice(index, 1);
            next.splice(index - 1, 0, moved);
            onChange(next);
        } else if (e.key === 'ArrowDown' && index < value.length - 1) {
            e.preventDefault();
            const next = [...value];
            const [moved] = next.splice(index, 1);
            next.splice(index + 1, 0, moved);
            onChange(next);
        }
    };

    // ── FORM SCREEN ─────────────────────────────────────────────────────────────
    const renderFormScreen = () => {
        if (subScreen === 'category') {
            const CATEGORY_META = {
                "Access and Quality": {
                    desc: "Enrollment rates, learner retention, literacy, numeracy, inclusive education, & quality learning environments",
                    icon: <TbBook2 size={24} color="#ffffff" className="text-white shrink-0" />,
                    bgColor: "#2563eb",
                    badge: "6 Outcomes",
                    ribbonColor: "border-l-blue-500",
                    badgeBg: "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200"
                },
                "Governance": {
                    desc: "Participative management, continuous improvement, accountability, & community stakeholder convergence",
                    icon: <TbBuildingBank size={24} color="#ffffff" className="text-white shrink-0" />,
                    bgColor: "#d97706",
                    badge: "3 Outcomes",
                    ribbonColor: "border-l-amber-500",
                    badgeBg: "bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200"
                }
            };

            return (
                <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4 pb-36">
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
                        <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest block mb-0.5">Step 1 — Domain Category</span>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">
                            Select Improvement Domain
                        </h3>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            Choose an official DepEd domain category to filter your school's intermediate outcomes.
                        </p>
                    </div>

                    <div className="space-y-3.5">
                        {Object.keys(PIA_DATA).map((cat) => {
                            const meta = CATEGORY_META[cat] || {
                                desc: "Department of Education strategic objectives and intermediate outcomes.",
                                icon: <TbTarget size={26} />,
                                gradient: "from-slate-700 to-slate-800",
                                badge: "Outcomes Available",
                                ribbonColor: "border-l-slate-400",
                                badgeBg: "bg-slate-100 text-slate-700"
                            };

                            return (
                                <button
                                    key={cat}
                                    onClick={() => {
                                        setSelectedCategory(cat);
                                        setSubScreen('io');
                                    }}
                                    className={`group relative w-full p-5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 hover:border-blue-500 shadow-md hover:shadow-xl text-left flex items-start gap-4 transition-all duration-200 active:scale-[0.98] overflow-hidden ${meta.ribbonColor}`}
                                >
                                    <div
                                        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform mt-0.5 text-white"
                                        style={{ backgroundColor: meta.bgColor || '#2563eb' }}
                                    >
                                        {meta.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <h4 className="font-extrabold text-base tracking-tight leading-snug text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                {cat}
                                            </h4>
                                            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${meta.badgeBg}`}>
                                                {meta.badge}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                            {meta.desc}
                                        </p>
                                    </div>
                                    <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:bg-blue-600 group-hover:text-white text-slate-400 flex items-center justify-center shrink-0 transition-all mt-1">
                                        <TbChevronRight size={18} />
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <div className="pt-2 mt-2">
                        <button
                            onClick={() => setSubScreen('list')}
                            className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl font-bold text-xs uppercase tracking-widest border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 flex items-center justify-center gap-2"
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
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mb-4">
                        <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">{selectedCategory}</p>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 leading-snug">
                            Select Intermediate Outcome
                        </h3>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            Swipe horizontally to explore outcomes or tap to select.
                        </p>
                    </div>

                    {/* Vertical Fallback Deck */}
                    <div className="space-y-3">
                        {ios.map((io) => {
                            const [ioKey, ...rest] = io.split(':');
                            const ioDesc = rest.join(':').trim();
                            return (
                                <button
                                    key={io}
                                    onClick={() => {
                                        setSelectedIO(io);
                                        setDraftPIAs([]);
                                        setSubScreen('pias');
                                    }}
                                    className={`w-full p-4 rounded-2xl border bg-white dark:bg-slate-900 hover:border-blue-400 shadow-sm text-left flex items-start gap-4 transition-all duration-200 active:scale-[0.98] ${getCategoryRibbon(selectedCategory)}`}
                                >
                                    <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                                        <span className="font-extrabold text-xs">{ioKey}</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold text-sm leading-snug text-slate-800 dark:text-slate-100">{ioDesc}</p>
                                    </div>
                                    <TbChevronRight className="text-slate-400 mt-2" size={20} />
                                </button>
                            );
                        })}
                    </div>

                    <div className="pt-2 mt-4">
                        <button
                            onClick={() => setSubScreen('category')}
                            className="w-full py-4 bg-white text-slate-600 rounded-2xl font-bold text-xs uppercase tracking-widest border-2 border-slate-200 hover:bg-slate-50 hover:text-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2"
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
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mb-4 shrink-0">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 line-clamp-1">{selectedCategory} / {selectedIO.split(':')[0]}</p>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 leading-snug">
                            Select Priority Areas
                        </h3>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            Select priority areas serving as basis of SIIF interventions.
                        </p>
                    </div>

                    <div className="space-y-3 flex-1 mb-6">
                        {pias.map((pia) => {
                            const active = draftPIAs.includes(pia);
                            const isAlreadyAdded = value.includes(`[${selectedCategory}] ${selectedIO} - ${pia}`);

                            return (
                                <button
                                    key={pia}
                                    onClick={() => toggleDraftPIA(pia)}
                                    disabled={isAlreadyAdded}
                                    className={`w-full p-4 rounded-2xl border text-left flex items-center gap-4 transition-all duration-200 ${getCategoryRibbon(selectedCategory)} ${!isAlreadyAdded ? 'active:scale-[0.98]' : ''} ${active
                                        ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/30 shadow-md pod-glow'
                                        : isAlreadyAdded
                                            ? 'border-slate-200 bg-slate-100 dark:bg-slate-800 opacity-60 cursor-not-allowed'
                                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-300 shadow-sm'
                                        }`}
                                >
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${active || isAlreadyAdded ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white'
                                        }`}>
                                        {(active || isAlreadyAdded) && <TbCheck size={13} className="text-white" />}
                                    </div>
                                    <div className="flex-1">
                                        <p className={`font-semibold text-sm leading-snug ${active || isAlreadyAdded ? 'text-blue-900 dark:text-blue-200 font-bold' : 'text-slate-800 dark:text-slate-100'
                                            }`}>{pia}</p>
                                        {isAlreadyAdded && <p className="text-xs text-slate-500 mt-1 italic">Already added to list</p>}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <div className="pt-2 flex items-center gap-3 w-full shrink-0">
                        <button
                            onClick={() => setSubScreen('io')}
                            className="flex-1 py-4 bg-white text-slate-600 rounded-2xl font-bold text-xs uppercase tracking-widest border-2 border-slate-200 hover:bg-slate-50 hover:text-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <TbArrowLeft size={18} /> Back
                        </button>
                        <button
                            onClick={saveDraftPIAs}
                            disabled={draftPIAs.length === 0}
                            className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                <div className="bg-white p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mb-2">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 leading-snug">
                        Select or Review Improvement Areas
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                        {readOnly
                            ? "Viewing priority improvement areas for this fiscal year."
                            : "List down the relevant Priority Improvement Areas (PIAs) of your school based on your approved SIP. Drag handle (⋮⋮) or use Arrow Up/Down keys to reorder."}
                    </p>
                </div>

                <div className="space-y-2.5">
                    {/* Display existing PIAs with HTML5 drag handle and Arrow key support */}
                    {value.map((area, index) => {
                        const match = area.match(/^\[(.*?)\] (IO\d+:.*?) - (.*)$/);
                        const cat = match ? match[1] : '';
                        const io = match ? match[2] : '';
                        const piaText = match ? match[3] : area;

                        return (
                            <div
                                key={index}
                                draggable={!readOnly}
                                onDragStart={(e) => handleDragStart(e, index)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => handleDrop(e, index)}
                                tabIndex="0"
                                onKeyDown={(e) => handleKeyboardReorder(e, index)}
                                className={`flex items-center gap-3 p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl cursor-grab active:cursor-grabbing hover:shadow-md hover:scale-[1.01] active:tactile-tilt active:shadow-xl focus-within:ring-2 focus-within:ring-blue-500 transition-all duration-150 outline-none select-none min-h-[48px] ${getCategoryRibbon(cat)}`}
                            >
                                {!readOnly && (
                                    <div
                                        className="text-slate-400 font-bold select-none cursor-row-resize py-2 px-1 min-h-[44px] flex items-center justify-center text-base"
                                        title="Drag or select and press Arrow Up/Down to reorder"
                                    >
                                        ⋮⋮
                                    </div>
                                )}
                                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-900 dark:bg-blue-900/50 dark:text-blue-200 flex items-center justify-center shrink-0 font-bold text-xs">
                                    {index + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    {cat && (
                                        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold text-blue-950 bg-blue-100 rounded-md mr-2 select-none">
                                            {cat} • {io.split(':')[0]}
                                        </span>
                                    )}
                                    <p className="text-base font-medium text-slate-800 dark:text-slate-100 leading-snug mt-0.5">
                                        {piaText}
                                    </p>
                                </div>
                                {!readOnly && (
                                    <button
                                        onClick={() => handleRemove(index)}
                                        className="p-2 text-slate-400 hover:text-red-500 rounded-lg transition-colors shrink-0"
                                        title="Remove"
                                    >
                                        <TbTrash size={18} />
                                    </button>
                                )}
                            </div>
                        );
                    })}

                    {value.length === 0 && !readOnly && (
                        <div className="text-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50/50 dark:bg-slate-800/20">
                            <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto mb-3 text-slate-400">
                                <TbTarget size={24} />
                            </div>
                            <p className="text-base font-bold text-slate-900 dark:text-white mb-1">No Areas Specified</p>
                            <p className="text-xs text-slate-500 mb-4 px-4">Start by adding your first priority improvement area from the predefined categories.</p>
                            <button
                                onClick={() => setSubScreen('category')}
                                className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-md active:scale-95 transition-all mx-auto flex items-center gap-2 min-h-[44px]"
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
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800 shadow-xs">
                        <TbTrendingUp size={18} className="text-blue-600 dark:text-blue-400 shrink-0" />
                        <span className="text-xs font-black uppercase tracking-wider">
                            Priority Improvement Areas Summary
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-black text-xs border border-slate-200/80 dark:border-slate-700">
                        <TbChecklist size={14} className="text-blue-600 dark:text-blue-400" />
                        <span>{value.filter(v => v && v.trim().length > 0).length} Specified</span>
                    </div>
                </div>

                <div className="space-y-2.5">
                    {value.filter(v => v && v.trim().length > 0).map((area, index) => {
                        const match = area.match(/^\[(.*?)\] (IO\d+:.*?) - (.*)$/);
                        return (
                            <div key={index} className="flex items-start gap-3.5 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                                <div className="w-8 h-8 rounded-xl bg-blue-600 dark:bg-blue-500 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                                    {index + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    {match ? (
                                        <>
                                            <span className="text-[9px] font-black text-blue-700 dark:text-blue-300 uppercase tracking-widest bg-blue-100/70 dark:bg-blue-900/50 px-2 py-0.5 rounded mr-2">
                                                {match[1]} • {match[2].split(':')[0]}
                                            </span>
                                            <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100 leading-relaxed mt-1">{match[3]}</p>
                                        </>
                                    ) : (
                                        <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100 leading-relaxed">{area}</p>
                                    )}
                                </div>
                                <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                                    <TbCheck size={14} className="font-black" />
                                </div>
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
                    className="w-full py-3.5 px-4 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-300 rounded-xl font-extrabold text-xs uppercase tracking-widest border border-rose-200 dark:border-rose-800 transition-all flex items-center justify-center gap-2 active:scale-[0.98] shadow-sm"
                >
                    <TbArrowLeft size={16} /> Edit Priority Areas List
                </button>
            )}

            <div className="p-5 bg-gradient-to-br from-blue-50/90 via-slate-50 to-indigo-50/70 dark:from-slate-900 dark:to-blue-950/40 rounded-2xl border-2 border-blue-200/90 dark:border-blue-800/80 shadow-md space-y-4">
                {readOnly ? (
                    <div className="space-y-4 text-center">
                        <p className="text-xs font-bold text-slate-500 leading-relaxed">
                            This section is finalized and read-only as the plan is submitted.
                        </p>
                        <button
                            onClick={onClose}
                            className="w-full py-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-extrabold text-xs uppercase tracking-widest shadow-md active:scale-95 transition-all"
                        >
                            Close View
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Authenticity & Accuracy Declaration Card */}
                        <div className="flex items-start gap-3 p-3.5 bg-white/90 dark:bg-slate-800/90 rounded-xl border border-blue-200/80 dark:border-blue-900/50 shadow-sm">
                            <div className="w-10 h-10 rounded-xl bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-md">
                                <TbShieldCheck size={22} />
                            </div>
                            <div className="space-y-0.5 min-w-0">
                                <p className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                                    Data Authenticity & Accuracy Declaration
                                </p>
                                <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 leading-snug">
                                    By typing <span className="font-extrabold text-blue-700 dark:text-blue-300">CONFIRM</span> below, you certify that the priority improvement area data submitted above is true, accurate, and officially authorized.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <input
                                type="text"
                                placeholder="Type CONFIRM to certify..."
                                value={confirmText}
                                onChange={e => setConfirmText(e.target.value)}
                                className={`w-full px-4 py-3.5 rounded-xl border-2 font-mono font-black text-sm tracking-widest text-center transition-all focus:outline-none focus:ring-4 ${
                                    confirmError
                                        ? 'border-red-400 bg-red-50 text-red-600 focus:ring-red-500/20 dark:bg-red-950/40 dark:text-red-300'
                                        : 'border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:ring-blue-500/20'
                                }`}
                            />
                            {confirmError && (
                                <p className="text-center text-xs text-red-500 font-extrabold animate-bounce">Please type CONFIRM exactly to certify data</p>
                            )}
                        </div>

                        <div className="pt-0.5">
                            <button
                                onClick={handleSave}
                                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-xl font-extrabold text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                            >
                                <TbShieldCheck size={18} /> Confirm & Certify Priority Areas
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
        <div className="w-full h-full flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden">
            {/* ── v5 Ultra-Compact Low-Profile Header ── */}
            <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 z-20">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <button
                        onClick={handleBack}
                        className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-all text-slate-600 dark:text-slate-300 shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center"
                    >
                        {screen === 'summary' || subScreen === 'list' ? <TbX size={17} /> : <TbArrowLeft size={17} />}
                    </button>
                    <div className="min-w-0 flex-1">
                        <span className="block text-[9px] font-extrabold uppercase tracking-widest text-blue-600 dark:text-blue-400 siif-font-header leading-none mb-0.5">
                            {getEyebrowText()}
                        </span>
                        <h2 className="siif-font-header text-sm font-extrabold text-slate-800 dark:text-slate-100 tracking-tight leading-tight truncate">
                            {getMainHeaderTitle()}
                        </h2>
                    </div>
                </div>
                {screen !== 'summary' && subScreen !== 'list' && (
                    <button
                        onClick={onClose}
                        className="p-2 bg-slate-100 hover:bg-rose-100 hover:text-rose-600 dark:bg-slate-800 rounded-xl transition-all text-slate-500 shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center"
                        title="Close"
                    >
                        <TbX size={17} />
                    </button>
                )}
                {(screen === 'summary' || subScreen === 'list') && (
                    <button
                        onClick={onClose}
                        className="p-2 bg-slate-100 hover:bg-rose-100 hover:text-rose-600 dark:bg-slate-800 rounded-xl transition-all text-slate-500 shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center"
                        title="Close"
                    >
                        <TbX size={17} />
                    </button>
                )}
            </div>
            {/* Step progress dots */}
            <div className="flex gap-1.5 px-3 py-1 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shrink-0">
                {['form', 'summary'].map((s) => (
                    <div key={s} className={`h-0.5 flex-1 rounded-full transition-all duration-300 ${(screen === s) || (s === 'form' && screen !== 'summary') ? 'bg-blue-600' : screen === 'summary' && s === 'summary' ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
                ))}
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

export default PriorityImprovementAreaCard;


