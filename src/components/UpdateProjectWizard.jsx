import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiCheck, FiCamera, FiUpload, FiAlertCircle } from 'react-icons/fi';

// STATUS ENUMS
const ProcurementStatus = {
    NotYetProcured: "Not yet procured",
    UnderProcurement: "Under procurement",
    ProcurementComplete: "Procurement Complete"
};

const ConstructionStatus = {
    NotYetStarted: "Not Yet Started",
    Ongoing: "Ongoing",
    Suspended: "Suspended",
    Terminated: "Terminated",
    ForFinalInspection: "For Final Inspection",
    Completed: "Completed"
};

const REASON_OPTIONS = {
    'Not yet procured': [
        'Lacking Buildability Requirements: Incomplete Detailed Engineering Design (DED) or Program of Works (POW)',
        'Site Ownership Issues: No Deed of Donation, missing Transfer Certificate of Title (TCT), or ongoing land disputes',
        'Permitting Delays: Pending Environmental Compliance Certificate (ECC) or Building Permits from the LGU',
        'Site Readiness: The location requires demolition of old structures or massive earth-filling before a contractor can bid',
        'Budget Realignment: The initial allocation is insufficient for current material costs, requiring a request for additional funds',
    ],
    'Under procurement': [
        'Pre-Procurement Conference: Finalizing the Bidding Documents',
        'Advertisement/Posting: Published on PhilGEPS',
        'Pre-Bid Conference: Clarifications with potential contractors',
        'Submission and Receipt of Bids: The "Opening of Bids" stage',
        'Bid Evaluation: Determining the Lowest Calculated Bid (LCB)',
        'Post-Qualification: Validating the contractor\'s legal and technical capacity',
        'Notice of Award (NOA): The project is officially assigned to a winner',
        'Contract Signing & Notice to Proceed (NTP): Finalizing the legal start date',
    ],
    'Not Yet Started': [
        'Right-of-Way (ROW) Issues: Access to the school site is blocked by private property or informal settlers',
        'Obstruction Removal: Existing utility lines (electric poles, water pipes) need relocation',
        'Adverse Weather: Premature heavy rains or typhoons preventing mobilization',
        'Contractor Mobilization Delay: Failure of the contractor to bring equipment or manpower to the site on time',
        'Unavailability of Materials: Shortage of specific supplies in remote areas (e.g., Oriental Mindoro)',
    ],
    'Suspended': [
        'Variation Order Pending: Changes in design require a budget/contract adjustment',
        'Force Majeure: Natural disasters or unforeseen site conditions (e.g., discovering a sinkhole)',
        'Peace and Order: Security threats in the immediate area',
        'Non-Payment of Claims: Contractor stops work due to delayed progress billing payments',
    ],
    'Terminated': [
        'Default by Contractor: Negative slippage (delay) exceeds 15% of the total project duration',
        'Abandonment: The contractor has pulled out all staff and equipment without notice',
        'Fundamental Design Flaw: The site is found to be geologically unsafe for the proposed structure',
        'Convenience of the Government: Project is canceled due to a change in department priority or policy',
    ],
};

// SINGLE STEPS ARRAY — skip logic in handleNextStep/handlePrevStep
const STEPS = [
    { id: 1, label: "Procurement", icon: "🔄" },
    { id: 2, label: "Construction", icon: "🏗️" },
    { id: 3, label: "Accomplishment", icon: "📸" },
    { id: 4, label: "Checklist", icon: "📋" },
    { id: 5, label: "Confirm", icon: "✅" },
];

const PHOTO_DESCRIPTIONS = {
    Internal: "Required: Snapshots of interior progress, structural elements, or indoor finishing.",
    External: "Required: Snapshots of facade, site perimeter, or overall building exterior."
};

const PROCUREMENT_OPTIONS = [
    { label: "Not yet procured", value: "Not yet procured", icon: "🔴" },
    { label: "Under procurement", value: "Under procurement", icon: "🟡" },
    { label: "Procurement Complete", value: "Procurement Complete", icon: "✅" }
];

const CONSTRUCTION_OPTIONS = [
    { value: "Not Yet Started", label: "Not Yet Started", icon: "⚪", color: "slate" },
    { value: "Ongoing", label: "Ongoing", icon: "🚧", color: "blue" },
    { value: "Suspended", label: "Suspended", icon: "⏸️", color: "amber" },
    { value: "Terminated", label: "Terminated", icon: "🚫", color: "red" },
    { value: "For Final Inspection", label: "For Final Inspection", icon: "🔍", color: "purple" },
    { value: "Completed", label: "Completed", icon: "✅", color: "emerald" },
];

const BIDDING_MILESTONES = [
    { key: 'preProcurementDate', label: 'Pre-Procurement Conference' },
    { key: 'issuanceOfInvitationToBid', label: 'Advertisement/Posting of IB' },
    { key: 'preBidConference', label: 'Pre-bid Conference' },
    { key: 'openingOfTechnicalProposal', label: 'Opening of Technical Proposal' },
    { key: 'openingOfFinancialProposal', label: 'Opening of Financial Proposal' },
    { key: 'postQualDate', label: 'Post-qualification' },
    { key: 'dateNoticeOfAward', label: 'Notice of Award' },
    { key: 'contractSigningDate', label: 'Contract Signing' },
];

const PhotoCard = ({ categoryColor, activePreviews, activePhotoCategory, removePhoto, internalCameraRef, externalCameraRef, internalInputRef, externalInputRef }) => {
    const isInternal = activePhotoCategory === 'Internal';
    const cameraRef = isInternal ? internalCameraRef : externalCameraRef;
    const inputRef = isInternal ? internalInputRef : externalInputRef;
    const previews = activePreviews[activePhotoCategory] || [];

    return (
        <div className={`p-5 rounded-3xl border-2 border-dashed transition-all duration-300 ${categoryColor.bg} ${categoryColor.border}`}>
            <div className="flex flex-col items-center text-center space-y-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${categoryColor.iconBg} ${categoryColor.icon}`}>
                    <FiCamera size={26} />
                </div>
                <div>
                    <h4 className={`text-sm font-black uppercase tracking-tight ${categoryColor.text}`}>{activePhotoCategory} Photos</h4>
                    <p className="text-[10px] text-slate-500 font-medium mt-1 px-4 leading-relaxed italic">
                        {PHOTO_DESCRIPTIONS[activePhotoCategory]}
                    </p>
                </div>

                <div className="flex gap-2 w-full">
                    <button onClick={() => cameraRef.current?.click()}
                        className={`flex-1 flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white border border-slate-100 shadow-sm hover:border-blue-200 transition-all active:scale-95`}>
                        <FiCamera size={18} className="text-blue-600" />
                        <span className="text-[9px] font-black text-slate-700 uppercase">Camera</span>
                    </button>
                    <button onClick={() => inputRef.current?.click()}
                        className={`flex-1 flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white border border-slate-100 shadow-sm hover:border-blue-200 transition-all active:scale-95`}>
                        <FiUpload size={18} className="text-blue-400" />
                        <span className="text-[9px] font-black text-slate-700 uppercase">Gallery</span>
                    </button>
                </div>

                {previews.length > 0 && (
                    <div className="w-full pt-2">
                        <div className="grid grid-cols-4 gap-2">
                            {previews.map((src, i) => (
                                <div key={i} className="relative aspect-square group">
                                    <img src={src} className="w-full h-full object-cover rounded-xl shadow-sm ring-1 ring-black/5" />
                                    <button onClick={() => removePhoto(activePhotoCategory, i)}
                                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg active:scale-75">
                                        <FiX size={10} strokeWidth={4} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const UpdateProjectWizard = ({ project, onSave, onClose, isOpen }) => {
    // States
    const [step, setStep] = useState(1);
    const [isUploading, setIsUploading] = useState(false);
    const [activePhotoCategory, setActivePhotoCategory] = useState('Internal');

    // Form Data
    const [procurementStatus, setProcurementStatus] = useState(project?.procurementStatus || "");
    const [constructionStatus, setConstructionStatus] = useState(project?.status || ConstructionStatus.NotYetStarted);
    const [percentage, setPercentage] = useState(project?.percentage || 0);
    const [actualCompletionDate, setActualCompletionDate] = useState(project?.actualCompletionDate || "");
    const [statusAsOfDate, setStatusAsOfDate] = useState(new Date().toISOString());
    const [remarks, setRemarks] = useState("");
    const [selectedReasons, setSelectedReasons] = useState([]);
    const [checkedState, setCheckedState] = useState({});

    // Reset reasons when status changes
    useEffect(() => {
        setSelectedReasons([]);
    }, [procurementStatus, constructionStatus]);

    // Files and Previews
    const [internalFiles, setInternalFiles] = useState([]);
    const [externalFiles, setExternalFiles] = useState([]);
    const [activePreviews, setActivePreviews] = useState({ Internal: [], External: [] });

    // Procurement specific states
    const [biddingDates, setBiddingDates] = useState({
        preProcurementDate: project?.preProcurementDate || "",
        issuanceOfInvitationToBid: project?.issuanceOfInvitationToBid || project?.adPostDate || "",
        preBidConference: project?.preBidConference || project?.preBidConfDate || "",
        openingOfTechnicalProposal: project?.openingOfTechnicalProposal || "",
        openingOfFinancialProposal: project?.openingOfFinancialProposal || "",
        postQualDate: project?.postQualDate || "",
        dateNoticeOfAward: project?.dateNoticeOfAward || project?.noaDate || "",
        contractSigningDate: project?.contractSigningDate || "",
    });

    const [contractAward, setContractAward] = useState({
        contractId: project?.contractId || "",
        noticeToProceed: project?.noticeToProceed || "",
        constructionStartDate: project?.constructionStartDate || "",
        targetCompletionDate: project?.targetCompletionDate || "",
        contractorName: project?.contractorName || "",
    });

    const [details, setDetails] = useState({
        projectAllocation: project?.projectAllocation || "",
        contractAmount: project?.contractAmount || "",
        batchOfFunds: project?.batchOfFunds || "",
    });

    // Refs
    const bodyRef = useRef(null);
    const internalInputRef = useRef(null);
    const internalCameraRef = useRef(null);
    const externalInputRef = useRef(null);
    const externalCameraRef = useRef(null);

    // Triangulated progress logic
    const checklist = [
        { id: 1, task: 'Mobilization & Site Layout', weight: 5 },
        { id: 2, task: 'Excavation & Foundation Work', weight: 15 },
        { id: 3, task: 'Structural Framing (Beams/Columns)', weight: 20 },
        { id: 4, task: 'Roofing & Gutter System', weight: 15 },
        { id: 5, task: 'Masonry & Wall Finishes', weight: 15 },
        { id: 6, task: 'Electrical & Plumbing Rough-ins', weight: 10 },
        { id: 7, task: 'Windows, Doors & Glass Works', weight: 10 },
        { id: 8, task: 'Final Painting & Cleansing', weight: 10 }
    ];

    // Reset state when opened for a different project
    useEffect(() => {
        if (isOpen && project) {
            setStep(1);
            setIsUploading(false); // <--- RESET LOADING STATE ON STEP RESET
            setProcurementStatus(project.procurement_status || project.procurementStatus || "");
            setConstructionStatus(project.status || ConstructionStatus.NotYetStarted);
            setPercentage(Number(project.accomplishmentPercentage || project.accomplishment_percentage || 0));
            setRemarks('');
            setStatusAsOfDate(new Date().toISOString());
            setActualCompletionDate(project.actualCompletionDate || '');
            const saved = project.checklist;
            setCheckedState((saved && typeof saved === 'object' && !Array.isArray(saved)) ? saved : {});
            setInternalFiles([]);
            setExternalFiles([]);
            setActivePreviews({ Internal: [], External: [] });

            setBiddingDates({
                preProcurementDate: project.preProcurementDate || '',
                issuanceOfInvitationToBid: project.issuanceOfInvitationToBid || project.adPostDate || '',
                preBidConference: project.preBidConference || project.preBidConfDate || '',
                openingOfTechnicalProposal: project.openingOfTechnicalProposal || '',
                openingOfFinancialProposal: project.openingOfFinancialProposal || '',
                postQualDate: project.postQualDate || '',
                dateNoticeOfAward: project.dateNoticeOfAward || project.noaDate || '',
                contractSigningDate: project.contractSigningDate || '',
            });

            setContractAward({
                contractId: project.contractId || '',
                noticeToProceed: project.noticeToProceed || '',
                constructionStartDate: project.constructionStartDate || '',
                targetCompletionDate: project.targetCompletionDate || '',
                contractorName: project.contractorName || '',
            });

            setDetails({
                projectCategory: project.projectCategory || '',
                scopeOfWork: project.scopeOfWork || '',
                numberOfClassrooms: project.numberOfClassrooms || 0,
                numberOfStoreys: project.numberOfStoreys || 0,
                numberOfSites: project.numberOfSites || 1,
                fundsUtilized: project.fundsUtilized || 0,
                projectAllocation: project.projectAllocation || project.amount || 0,
                contractAmount: project.contractAmount || project.contract_amount || 0,
                batchOfFunds: project.batchOfFunds || '',
            });
        }
    }, [isOpen, project?.id]);

    const triangulatedPercentage = Object.entries(checkedState).reduce((acc, [id, checked]) => {
        if (!checked) return acc;
        const task = checklist.find(t => t.id === parseInt(id));
        return acc + (task ? task.weight : 0);
    }, 0);

    // Derived state for skip logic
    const isProcurementComplete = procurementStatus === ProcurementStatus.ProcurementComplete;
    const isConstructionActive = constructionStatus && constructionStatus !== ConstructionStatus.NotYetStarted;

    // Compute only the steps visible in the stepper based on current selection
    const visibleSteps = React.useMemo(() => {
        const steps = [STEPS[0]]; // Procurement (always)
        
        // --- [Procurement Enforcement] ---
        // Soft-lock exception: If the project is already in a construction phase, 
        // we always show the Construction/Accomplishment steps so they can update progress.
        const wasAlreadyInConstruction = [
            ConstructionStatus.Ongoing, 
            ConstructionStatus.Completed, 
            ConstructionStatus.ForFinalInspection, 
            ConstructionStatus.Suspended, 
            ConstructionStatus.Terminated
        ].includes(project?.status);

        if (isProcurementComplete || wasAlreadyInConstruction) {
            steps.push(STEPS[1]); // Construction
            if (isConstructionActive || wasAlreadyInConstruction) {
                steps.push(STEPS[2]); // Accomplishment
                steps.push(STEPS[3]); // Checklist
            }
        }
        steps.push(STEPS[4]); // Confirm (always)
        return steps;
    }, [isProcurementComplete, isConstructionActive, project?.status]);


    // Skip-aware navigation
    const getNextStep = () => {
        const wasAlreadyInConstruction = [
            ConstructionStatus.Ongoing, 
            ConstructionStatus.Completed, 
            ConstructionStatus.ForFinalInspection, 
            ConstructionStatus.Suspended, 
            ConstructionStatus.Terminated
        ].includes(project?.status);

        if (step === 1) return (isProcurementComplete || wasAlreadyInConstruction) ? 2 : 5;
        if (step === 2) return (isConstructionActive || wasAlreadyInConstruction) ? 3 : 5;
        return step + 1;
    };


    const getPrevStep = () => {
        if (step === 5) {
            if (!isProcurementComplete) return 1;
            return isConstructionActive ? 4 : 2;
        }
        if (step === 3) return 2;
        return step - 1;
    };

    const handlePhotoSelect = (e, category) => {
        const files = Array.from(e.target.files);
        if (category === 'Internal') setInternalFiles(prev => [...prev, ...files]);
        else setExternalFiles(prev => [...prev, ...files]);

        const newPreviews = files.map(f => URL.createObjectURL(f));
        setActivePreviews(prev => ({
            ...prev,
            [category]: [...prev[category], ...newPreviews]
        }));
    };

    const removePhoto = (category, index) => {
        if (category === 'Internal') {
            setInternalFiles(prev => prev.filter((_, i) => i !== index));
            setActivePreviews(prev => ({ ...prev, Internal: prev.Internal.filter((_, i) => i !== index) }));
        } else {
            setExternalFiles(prev => prev.filter((_, i) => i !== index));
            setActivePreviews(prev => ({ ...prev, External: prev.External.filter((_, i) => i !== index) }));
        }
    };

    const handleConstructionChange = (val) => {
        setConstructionStatus(val);
        if (val === ConstructionStatus.Completed) setPercentage(100);
        else if (val === ConstructionStatus.NotYetStarted) setPercentage(0);
        else if (percentage === 0 || percentage === 100) setPercentage(5);
    };

    const handlePercentageChange = (num) => {
        setPercentage(num);
        if (num === 0 && constructionStatus && constructionStatus !== ConstructionStatus.NotYetStarted) {
            setConstructionStatus(ConstructionStatus.NotYetStarted);
        } else if (num === 100 && constructionStatus !== ConstructionStatus.Completed) {
            setConstructionStatus(ConstructionStatus.ForFinalInspection);
        } else if (num > 0 && num < 100 && [ConstructionStatus.Completed, ConstructionStatus.ForFinalInspection].includes(constructionStatus)) {
            setConstructionStatus(ConstructionStatus.Ongoing);
        }
    };

    const canProceedNext = () => {
        if (step === 1) {
            if (!procurementStatus) return { ok: false, reason: "Please select a procurement status." };
            if (REASON_OPTIONS[procurementStatus] && selectedReasons.length === 0) {
                return { ok: false, reason: "Please select at least one justification/reason." };
            }
            if (isProcurementComplete) {
                if (!biddingDates.dateNoticeOfAward) return { ok: false, reason: "Notice of Award Date is required for 'Complete' status." };
                if (!contractAward.contractId) return { ok: false, reason: "Contract ID / Number is required for 'Complete' status." };
            }
            return { ok: true };
        }
        if (step === 2) {
            if (!constructionStatus) return { ok: false, reason: "Please select a construction status." };
            if (REASON_OPTIONS[constructionStatus] && selectedReasons.length === 0) {
                return { ok: false, reason: "Please select at least one justification/reason." };
            }
            if (constructionStatus === ConstructionStatus.Completed && !actualCompletionDate) {
                return { ok: false, reason: "Please enter the Actual Completion Date." };
            }
            return { ok: true };
        }

        if (step === 3) {
            const needsPhotos = [ConstructionStatus.Ongoing, ConstructionStatus.ForFinalInspection, ConstructionStatus.Completed].includes(constructionStatus);
            if (needsPhotos && (internalFiles.length === 0 || externalFiles.length === 0)) {
                let missing = [];
                if (internalFiles.length === 0) missing.push("Internal");
                if (externalFiles.length === 0) missing.push("External");
                return { ok: false, reason: `Please upload both Internal and External photos for "${constructionStatus}" status. Missing: ${missing.join(" & ")}.` };
            }
        }
        return { ok: true };
    };

    const handleNextStep = () => {
        const check = canProceedNext();
        if (!check.ok) { alert(`⚠️ ${check.reason}`); return; }
        setStep(getNextStep());
    };

    const handleSubmit = () => {
        setIsUploading(true);
        const finalRemarks = selectedReasons.length > 0
            ? `[Justification: ${selectedReasons.join(', ')}] ${remarks}`.trim()
            : remarks;

        const finalStatus = isProcurementComplete ? constructionStatus : project.status;
        const finalPercentage = isProcurementComplete ? percentage : (project.accomplishmentPercentage || project.accomplishment_percentage || 0);

        onSave({
            ...project,
            procurementStatus: procurementStatus,
            procurement_status: procurementStatus,
            status: finalStatus,
            percentage: finalPercentage,
            accomplishmentPercentage: finalPercentage,
            actualCompletionDate: isProcurementComplete ? actualCompletionDate : (project.actualCompletionDate || ""),
            statusAsOfDate,
            remarks: finalRemarks,
            statusDesignPhase: isProcurementComplete ? "Completed" : (project?.statusDesignPhase || "Ongoing"),
            triangulatedPercentage: isProcurementComplete ? triangulatedPercentage : (project.triangulatedPercentage || 0),
            ...biddingDates,
            ...contractAward,
            ...details
        }, internalFiles, externalFiles).finally(() => setIsUploading(false));
    };

    const handleClose = () => {
        if (internalFiles.length > 0 || externalFiles.length > 0 || remarks) {
            if (window.confirm("Discard changes?")) onClose();
        } else onClose();
    };

    useEffect(() => {
        if (bodyRef.current) bodyRef.current.scrollTo(0, 0);
    }, [step]);

    const originalProcurement = project?.procurementStatus || "None";
    const originalConstruction = project?.status || "None";
    const procChanged = procurementStatus !== project?.procurementStatus;
    const constChanged = constructionStatus !== project?.status;

    const getStatusColor = (status) => {
        if (!status) return { bg: 'bg-slate-50', text: 'text-slate-400', border: 'border-slate-100' };
        if (status === ConstructionStatus.Completed || status === ProcurementStatus.ProcurementComplete)
            return { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' };
        if (status === ConstructionStatus.Suspended || status === ConstructionStatus.Terminated)
            return { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-100' };
        return { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100' };
    };

    const procCols = getStatusColor(procurementStatus);
    const displayedConstructionStatus = isProcurementComplete ? constructionStatus : (project?.status || ConstructionStatus.NotYetStarted);
    const constCols = getStatusColor(displayedConstructionStatus);

    const categoryColor = activePhotoCategory === 'Internal'
        ? { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: 'text-blue-500', iconBg: 'bg-blue-100' }
        : { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: 'text-emerald-500', iconBg: 'bg-emerald-100' };

    const modal = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-sm h-full max-h-[700px] rounded-[30px] shadow-2xl flex flex-col overflow-hidden relative border border-white/20">
                {/* Header */}
                <div className="px-6 pt-6 pb-4 bg-white/80 backdrop-blur-xl border-b border-slate-50 relative shrink-0">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
                                <FiCamera className="text-white text-lg" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-slate-800 tracking-tight leading-none uppercase">Project Wizard</h3>
                                <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest leading-none">Update & Evidence</p>
                            </div>
                        </div>
                        <button onClick={handleClose} className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 active:scale-95 transition-all">
                            <FiX size={16} />
                        </button>
                    </div>

                    {/* Progress Stepper — shows only relevant steps */}
                    <div className="flex items-center gap-1.5 px-0.5">
                        {visibleSteps.map((s, idx) => (
                            <React.Fragment key={s.id}>
                                <div className="flex flex-col items-center gap-1">
                                    <div className={`h-1 tracking-tighter rounded-full transition-all duration-500 ${step >= s.id ? 'bg-blue-600 w-12' : 'bg-slate-100 w-4'}`} />
                                    <span className={`text-[8px] font-black uppercase tracking-[0.1em] ${step === s.id ? 'text-blue-600' : 'text-slate-300'}`}>{s.label}</span>
                                </div>
                                {idx < visibleSteps.length - 1 && <div className="flex-1 h-[1px] bg-slate-50 mb-2.5 mx-1" />}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* Scrollable Body */}
                <div ref={bodyRef} className="flex-1 overflow-y-auto p-6 space-y-4">

                    {/* ── STEP 1: PROCUREMENT ── */}
                    {step === 1 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                            {/* Procurement Selector */}
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Procurement Status</label>
                                <select
                                    value={procurementStatus || ""}
                                    onChange={(e) => setProcurementStatus(e.target.value)}
                                    className="w-full border rounded-2xl p-3 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all bg-white border-slate-200 text-slate-700 cursor-pointer"
                                >
                                    <option value="" disabled>— Please select —</option>
                                    {PROCUREMENT_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Procurement Justification */}
                            {REASON_OPTIONS[procurementStatus] && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-300 bg-blue-50/30 p-4 rounded-2xl border border-blue-100/50">
                                    <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <FiAlertCircle size={12} />
                                        Justification:
                                    </label>
                                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                        {REASON_OPTIONS[procurementStatus].map((reason, idx) => {
                                            const isSelected = selectedReasons.includes(reason);
                                            return (
                                                <label key={idx} className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${isSelected ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
                                                    <div className={`mt-0.5 w-4 h-4 rounded flex-shrink-0 border-2 transition-all flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>
                                                        {isSelected && <FiCheck size={10} className="text-white" />}
                                                        <input type="checkbox" className="hidden" checked={isSelected}
                                                            onChange={() => setSelectedReasons(prev => prev.includes(reason) ? prev.filter(r => r !== reason) : [...prev, reason])} />
                                                    </div>
                                                    <span className={`text-[10px] font-bold leading-relaxed ${isSelected ? 'text-blue-700' : 'text-slate-600'}`}>{reason}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Bidding Milestones (Under Procurement / Complete) */}
                            {([ProcurementStatus.UnderProcurement, ProcurementStatus.ProcurementComplete].includes(procurementStatus)) && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-300 bg-blue-50 p-4 rounded-2xl border border-blue-100">
                                    <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-4 text-center">
                                        {procurementStatus === ProcurementStatus.ProcurementComplete ? "Final Procurement Details" : "Bidding Milestones"}
                                    </h4>
                                    <div className="space-y-4">
                                        {procurementStatus === ProcurementStatus.ProcurementComplete ? (
                                            <>
                                                <div>
                                                    <label className="block text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1.5">Notice of Award Date *</label>
                                                    <input
                                                        type="date"
                                                        value={biddingDates.dateNoticeOfAward}
                                                        onChange={(e) => setBiddingDates(prev => ({ ...prev, dateNoticeOfAward: e.target.value }))}
                                                        className="w-full p-2.5 rounded-xl border border-blue-200 bg-white text-xs font-bold text-slate-700 outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1.5">Contract ID / Number *</label>
                                                    <input
                                                        type="text"
                                                        placeholder="e.g. 24INF-001"
                                                        value={contractAward.contractId}
                                                        onChange={(e) => setContractAward(prev => ({ ...prev, contractId: e.target.value }))}
                                                        className="w-full p-2.5 rounded-xl border border-blue-200 bg-white text-xs font-bold text-slate-700 outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1.5">Contractor Name</label>
                                                    <input
                                                        type="text"
                                                        placeholder="Enter company name"
                                                        value={contractAward.contractorName}
                                                        onChange={(e) => setContractAward(prev => ({ ...prev, contractorName: e.target.value }))}
                                                        className="w-full p-2.5 rounded-xl border border-blue-200 bg-white text-xs font-bold text-slate-700 outline-none"
                                                    />
                                                </div>
                                            </>
                                        ) : (
                                            <div className="relative space-y-8 mt-2">
                                                <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-blue-200 z-0"></div>
                                                {BIDDING_MILESTONES.map((m, i) => {
                                                    const hasDate = !!biddingDates[m.key];
                                                    return (
                                                        <div key={m.key} className="relative z-10 flex flex-col gap-2">
                                                            <div className="flex items-center gap-4">
                                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${hasDate ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-300'}`}>
                                                                    {hasDate ? <FiCheck size={14} /> : <span className="text-[10px] font-black">{i + 1}</span>}
                                                                </div>
                                                                <label className={`text-[11px] font-black uppercase tracking-tight ${hasDate ? 'text-slate-800' : 'text-slate-400'}`}>
                                                                    {m.label}
                                                                </label>
                                                            </div>
                                                            <div className="pl-12">
                                                                <input
                                                                    type="date"
                                                                    value={biddingDates[m.key]}
                                                                    onChange={(e) => setBiddingDates(prev => ({ ...prev, [m.key]: e.target.value }))}
                                                                    className={`w-full p-2.5 rounded-xl border text-xs font-bold outline-none transition-all ${hasDate ? 'border-blue-200 bg-white text-slate-800 shadow-sm' : 'border-slate-100 bg-slate-50/50 text-slate-400'}`}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}


                            {/* Date and Remarks */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Status As Of Date</label>
                                    <input
                                        type="date"
                                        value={statusAsOfDate.split('T')[0]}
                                        max={new Date().toISOString().split('T')[0]}
                                        onChange={e => {
                                            const timePart = new Date().toISOString().split('T')[1];
                                            setStatusAsOfDate(`${e.target.value}T${timePart}`);
                                        }}
                                        className="w-full p-3 rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-700 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Remarks (Optional)</label>
                                    <textarea rows={3} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Add any notes..."
                                        className="w-full p-3 rounded-2xl border border-slate-200 text-xs font-medium outline-none resize-none" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 2: CONSTRUCTION ── */}
                    {step === 2 && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {/* Construction Status */}
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Construction Status</label>
                                <select
                                    value={constructionStatus || ""}
                                    onChange={(e) => handleConstructionChange(e.target.value)}
                                    className="w-full border rounded-2xl p-3 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all bg-white border-slate-200 text-slate-700 cursor-pointer"
                                >
                                    <option value="" disabled>— Please select —</option>
                                    {CONSTRUCTION_OPTIONS.map(opt => (
                                        <option
                                            key={opt.value}
                                            value={opt.value}
                                            disabled={false}
                                        >
                                            {opt.icon} {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Construction Justification */}
                            {REASON_OPTIONS[constructionStatus] && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-300 bg-amber-50/30 p-4 rounded-2xl border border-amber-100/50">
                                    <label className="block text-[10px] font-black text-amber-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <FiAlertCircle size={12} />
                                        Construction Justification:
                                    </label>
                                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                        {REASON_OPTIONS[constructionStatus].map((reason, idx) => {
                                            const isSelected = selectedReasons.includes(reason);
                                            return (
                                                <label key={idx} className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${isSelected ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
                                                    <div className={`mt-0.5 w-4 h-4 rounded flex-shrink-0 border-2 transition-all flex items-center justify-center ${isSelected ? 'bg-amber-600 border-amber-600' : 'bg-white border-slate-300'}`}>
                                                        {isSelected && <FiCheck size={10} className="text-white" />}
                                                        <input type="checkbox" className="hidden" checked={isSelected}
                                                            onChange={() => setSelectedReasons(prev => prev.includes(reason) ? prev.filter(r => r !== reason) : [...prev, reason])} />
                                                    </div>
                                                    <span className={`text-[10px] font-bold leading-relaxed ${isSelected ? 'text-amber-700' : 'text-slate-600'}`}>{reason}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Actual Completion Date */}
                            {constructionStatus === ConstructionStatus.Completed && (
                                <div>
                                    <label className="block text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Actual Completion Date *</label>
                                    <input type="date" value={actualCompletionDate} onChange={e => setActualCompletionDate(e.target.value)}
                                        max={new Date().toISOString().split('T')[0]}
                                        className="w-full p-3 rounded-2xl border-2 border-emerald-200 bg-emerald-50/30 text-sm font-bold text-slate-700 outline-none" />
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── STEP 3: ACCOMPLISHMENT ── */}
                    {step === 3 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {/* Accomplishment Slider */}
                            <div className={`p-4 rounded-2xl border ${constCols.bg} ${constCols.border}`}>
                                <div className="flex items-center justify-between mb-3">
                                    <label className={`text-[10px] font-black uppercase tracking-widest ${constCols.text}`}>Accomplishment %</label>
                                    <span className={`text-xl font-black tabular-nums ${constCols.text}`}>{percentage}%</span>
                                </div>
                                <input
                                    type="range" min="0" max="100" value={percentage}
                                    onChange={e => handlePercentageChange(Number(e.target.value))}
                                    disabled={[ConstructionStatus.Completed, ConstructionStatus.ForFinalInspection, ConstructionStatus.Suspended, ConstructionStatus.Terminated].includes(constructionStatus)}
                                    className="w-full accent-blue-600"
                                />
                                <div className="flex justify-between text-[9px] text-slate-400 font-bold mt-1">
                                    {['0%', '25%', '50%', '75%', '100%'].map(l => <span key={l}>{l}</span>)}
                                </div>
                            </div>

                            {/* Photos */}
                            <p className="text-[11px] text-slate-500 font-medium leading-relaxed px-1">
                                Attach internal and external site photos. Required for <span className="font-black text-blue-600">Ongoing, For Final Inspection, and Completed</span> statuses.
                            </p>
                            <div className="flex p-1 bg-slate-100 rounded-2xl gap-1">
                                {['Internal', 'External'].map(cat => {
                                    const count = cat === 'Internal' ? internalFiles.length : externalFiles.length;
                                    return (
                                        <button key={cat} onClick={() => setActivePhotoCategory(cat)}
                                            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activePhotoCategory === cat ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}>
                                            {cat === 'Internal' ? '🏗️' : '🌳'} {cat}
                                            {count > 0 && <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full text-[9px] font-black">{count}</span>}
                                        </button>
                                    );
                                })}
                            </div>
                            <PhotoCard
                                categoryColor={categoryColor}
                                activePreviews={activePreviews}
                                activePhotoCategory={activePhotoCategory}
                                removePhoto={removePhoto}
                                internalCameraRef={internalCameraRef}
                                externalCameraRef={externalCameraRef}
                                internalInputRef={internalInputRef}
                                externalInputRef={externalInputRef}
                            />
                            <input ref={internalInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handlePhotoSelect(e, 'Internal')} />
                            <input ref={internalCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handlePhotoSelect(e, 'Internal')} />
                            <input ref={externalInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handlePhotoSelect(e, 'External')} />
                            <input ref={externalCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handlePhotoSelect(e, 'External')} />
                        </div>
                    )}

                    {/* ── STEP 4: CHECKLIST ── */}
                    {step === 4 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                                <div className="flex items-center justify-between mb-1">
                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Checklist Calculation</p>
                                    <span className="text-xl font-black text-blue-700">{triangulatedPercentage}%</span>
                                </div>
                                <p className="text-[9px] text-blue-400 font-bold mb-3">
                                    {project?.numberOfStoreys || 1}-Storey building · {checklist.length} tasks
                                </p>
                                <div className="w-full bg-blue-100 rounded-full h-2 mb-3">
                                    <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${triangulatedPercentage}%` }} />
                                </div>
                                <div className="flex items-center justify-between text-[9px] font-bold">
                                    <span className="text-slate-500">Manual Progress: <span className="text-slate-700">{percentage}%</span></span>
                                    {Math.abs(triangulatedPercentage - percentage) > 10 && (
                                        <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                            ⚠ {Math.abs(triangulatedPercentage - percentage)}% variance
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                {checklist.map(task => (
                                    <button
                                        key={task.id}
                                        onClick={() => setCheckedState(prev => ({ ...prev, [task.id]: !prev[task.id] }))}
                                        className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${checkedState[task.id] ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100 hover:border-slate-200'}`}
                                    >
                                        <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${checkedState[task.id] ? 'bg-emerald-500 border-emerald-500' : 'border-slate-200'}`}>
                                            {checkedState[task.id] && <FiCheck size={11} className="text-white" />}
                                        </div>
                                        <span className={`text-[11px] font-bold flex-1 leading-tight ${checkedState[task.id] ? 'text-emerald-700' : 'text-slate-600'}`}>
                                            {task.task}
                                        </span>
                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${checkedState[task.id] ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                                            {task.weight}%
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── STEP 5: CONFIRM ── */}
                    {step === 5 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Project</p>
                                <p className="text-sm font-black text-slate-800 leading-snug">{project?.projectName}</p>
                            </div>

                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Changes Summary</p>

                            <div className="space-y-3">
                                <div className={`p-3 rounded-2xl border ${procChanged ? `${procCols.bg} ${procCols.border}` : 'bg-slate-50 border-slate-100'}`}>
                                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Procurement Status</p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-slate-500 line-through">{originalProcurement}</span>
                                        <span className="text-slate-300">→</span>
                                        <span className={`text-[11px] font-black ${procCols.text}`}>{procurementStatus}</span>
                                        {procChanged && <span className={`ml-auto text-[8px] font-black px-2 py-0.5 rounded-full border bg-white border-current uppercase ${procCols.text}`}>Changed</span>}
                                    </div>
                                </div>

                                {constructionStatus && (
                                    <div className={`p-3 rounded-2xl border ${constChanged ? `${constCols.bg} ${constCols.border}` : 'bg-slate-50 border-slate-100'}`}>
                                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Construction Status</p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-slate-500 line-through">{originalConstruction || 'N/A'}</span>
                                            <span className="text-slate-300">→</span>
                                            <span className={`text-[11px] font-black ${constCols.text}`}>
                                                {displayedConstructionStatus}
                                            </span>
                                            {(constChanged || !isProcurementComplete) && <span className={`ml-auto text-[8px] font-black px-2 py-0.5 rounded-full border bg-white border-current uppercase ${constCols.text}`}>
                                                {isProcurementComplete ? 'Changed' : 'Preserved'}
                                            </span>}
                                        </div>
                                    </div>
                                )}

                                {isConstructionActive && (
                                    <div className="p-3 rounded-2xl border bg-slate-50 border-slate-100">
                                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Accomplishment</p>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[11px] font-black text-slate-700">{percentage}% manual</span>
                                            <span className={`text-[11px] font-black ${Math.abs(triangulatedPercentage - percentage) > 10 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                · {triangulatedPercentage}% checklist
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div className={`p-3 rounded-2xl border ${(internalFiles.length + externalFiles.length) > 0 ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-100'}`}>
                                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Site Photos</p>
                                    <span className="text-[11px] font-black text-blue-600">
                                        {internalFiles.length > 0 && `${internalFiles.length} Internal`}
                                        {internalFiles.length > 0 && externalFiles.length > 0 && ', '}
                                        {externalFiles.length > 0 && `${externalFiles.length} External`}
                                        {internalFiles.length === 0 && externalFiles.length === 0 && <span className="text-slate-400 font-bold">No new photos</span>}
                                    </span>
                                </div>

                                {remarks && (
                                    <div className="p-3 rounded-2xl border bg-slate-50 border-slate-100">
                                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Remarks</p>
                                        <p className="text-[11px] font-medium text-slate-700 italic">"{remarks}"</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
                    <button
                        onClick={step === 1 ? handleClose : () => setStep(getPrevStep())}
                        className="flex items-center gap-2 px-5 py-3 bg-slate-100 text-slate-600 rounded-2xl text-xs font-bold"
                    >
                        {step === 1 ? "Cancel" : "← Back"}
                    </button>

                    <button
                        onClick={step === 5 ? handleSubmit : handleNextStep}
                        disabled={isUploading}
                        className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-wider ${isUploading ? 'bg-slate-200 text-slate-400' : 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 hover:-translate-y-0.5 active:scale-95'}`}
                    >
                        {isUploading ? "Saving..." : step === 5 ? "Submit Update" : "Next →"}
                    </button>
                </div>
            </div>
        </div>
    );

    if (!isOpen || !project) return null;

    return createPortal(modal, document.body);
};

export default UpdateProjectWizard;
