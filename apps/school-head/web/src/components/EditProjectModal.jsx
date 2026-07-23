import React, { useState, useEffect, useRef } from 'react';
import { FiSettings, FiLock, FiUnlock } from 'react-icons/fi';
import LocationPickerMap from './LocationPickerMap';
import { compressImage } from '../utils/imageCompression'; // Assuming this utility exists or will be moved

// --- CONSTANTS ---
const ProjectStatus = {
    UnderProcurement: "Under Procurement",
    NotYetStarted: "Not Yet Started",
    Ongoing: "Ongoing",
    ForFinalInspection: "For Final Inspection",
    Completed: "Completed",
};

const DOC_TYPES = {
    POW: "Program of Works / Progress of Work",
    DUPA: "DUPA",
    CONTRACT: "Signed Contract"
};

const PROJECT_CATEGORIES = [
    "New Construction",
    "Repair and Rehab",
    "Last Mile Schools",
    "Health facilities",
    "Gabaldon Restoration",
    "Library Hub",
    "SpEd Inclusive Learning Resource Centers (ILRC)",
    "Alternative Learning System - Community Based Learning Centers (ALS-CLC)",
    "Midrise School Building",
    "QRF",
    "Electrification"
];

const formatWithCommas = (val) => {
    if (val === null || val === undefined || val === '') return '';
    let stringVal = String(val).replace(/,/g, '');
    let parts = stringVal.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join('.');
};

const stripCommas = (val) => String(val).replace(/,/g, '');

const formatDateShort = (dateString) => {
    if (!dateString) return "TBD";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "2-digit",
    });
};

const convertFullFileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
};

import { uploadFileInChunks } from '../utils/chunkedUploader';
import { api } from "../lib/api";

const EditProjectModal = ({
    project,
    isOpen,
    onClose,
    onSave,
    // mode: 'full' | 'quick'
    mode = 'full',
    readOnly = false, // Added readOnly prop

    // Handlers for external state management (if needed, or handle internally)
    // For simplicity, we can handle file state internally if we pass it out on save,
    // but EngineerProjects.jsx handles it externally. Let's keep the existing pattern 
    // where the parent manages the file state for now to minimize refactor risk, 
    // or better: encapsulate it here? 
    // Given EngineerProjects.jsx has complex file handling, let's accept props first.

    onCameraClick,
    onGalleryClick,
    internalPreviews,
    externalPreviews,
    onRemoveFile,
    isUploading,

    // Optional: For internal logic if not provided
    internalFiles, // Array of File objects
    externalFiles,  // Array of File objects
    voHistory = [], // Passed from parent
    userRole = null
}) => {
    const [formData, setFormData] = useState(null);
    const [documents, setDocuments] = useState({
        POW: null, DUPA: null, CONTRACT: null, VO: null,
        RevisedPOW: null, RevisedDUPA: null, RevisedContract: null
    });
    const [isFundingYearLocked, setIsFundingYearLocked] = useState(true);
    const [showJustificationPrompt, setShowJustificationPrompt] = useState(false);
    const [tempFundingYear, setTempFundingYear] = useState('');

    // Realignment specific state
    const [realignmentCandidates, setRealignmentCandidates] = useState([]);
    const [isFetchingCandidates, setIsFetchingCandidates] = useState(false);
    const [candidatesError, setCandidatesError] = useState(null);
    const [realignmentForm, setRealignmentForm] = useState({
        targetIpc: ''
    });

    const [isSubmittingRealignment, setIsSubmittingRealignment] = useState(false);
    const [isLocationEditing, setIsLocationEditing] = useState(false);

    // Reset location editing mode whenever the modal closes
    useEffect(() => {
        if (!isOpen) setIsLocationEditing(false);
    }, [isOpen]);

    const DEBUG_FILTERS = false;
    useEffect(() => {
        if (DEBUG_FILTERS && isOpen) {
            console.log('[EditProjectModal] DEBUG — userRole:', userRole, '| readOnly:', readOnly);
            console.log('[EditProjectModal] DEBUG — map disabled:', readOnly && userRole !== 'Division Engineer' && userRole !== 'Architect');
        }
    }, [isOpen, userRole, readOnly]);

    useEffect(() => {
        if (project && isOpen) {
            setFormData(prev => {
                // If it's a different project or we're just opening the modal, do a full reset
                if (!prev || prev.id !== project.id) {
                    return {
                        ...project,
                        // Ensure fields exist to control inputs
                        latitude: project.latitude || '',
                        longitude: project.longitude || '',
                        // Populate all fields
                        projectCategory: project.projectCategory || '',
                        projectName: project.projectName || '',
                        scopeOfWork: project.scopeOfWork || '',
                        numberOfStoreys: project.numberOfStoreys || '',
                        numberOfClassrooms: project.numberOfClassrooms || '',
                        numberOfSites: project.numberOfSites || '',
                        schoolId: project.schoolId || '',
                        schoolName: project.schoolName || '',
                        region: project.region || '',
                        province: project.province || '',
                        city: project.city || '',
                        municipality: project.municipality || '',
                        division: project.division || '',
                        targetCompletionDate: project.targetCompletionDate || '',
                        noticeToProceed: project.noticeToProceed || '',
                        constructionStartDate: project.constructionStartDate || '',
                        contractorName: project.contractorName || '',
                        approved_budget_for_contract: project.approved_budget_for_contract || project.projectAllocation || '',
                        batchOfFunds: project.batchOfFunds || '',
                        contract_amount: project.contract_amount || '',
                        fundsUtilized: project.fundsUtilized || '',
                        statusDesignPhase: project.status_design_phase || project.statusDesignPhase || '',
                        contractId: project.contract_id || project.contractId || '',
                        dateNoticeOfAward: project.date_notice_of_award || project.dateNoticeOfAward || '',
                        issuanceOfInvitationToBid: project.issuance_of_invitation_to_bid || project.issuanceOfInvitationToBid || '',
                        preBidConference: project.pre_bid_conference || project.preBidConference || '',
                        openingOfTechnicalProposal: project.opening_of_technical_proposal || project.openingOfTechnicalProposal || '',
                        openingOfFinancialProposal: project.opening_of_financial_proposal || project.openingOfFinancialProposal || '',
                        requestForQuotation: project.request_for_quotation || project.requestForQuotation || '',
                        negotiation: project.negotiation || project.negotiation || '',
                        openingOfQuotation: project.opening_of_quotation || project.openingOfQuotation || '',
                        statusAsOfDate: project.statusAsOfDate || new Date().toISOString().split('T')[0],
                        accomplishmentPercentage: project.accomplishmentPercentage || 0,
                        status: project.status_of_construction_phase || project.status || '',
                        otherRemarks: project.otherRemarks || '',
                        hasVariationOrder: project.hasVariationOrder || project.has_variation_order || false,
                        isRealignment: false,
                        variationOrderPdf: project.variationOrderPdf || project.variation_order_pdf || null,
                        vo_number: project.vo_number || '',
                        vo_requested_date: (project.vo_requested_date || project.vo_approval_date) ? (project.vo_requested_date || project.vo_approval_date).split('T')[0] : '',
                        vo_requested_by: project.vo_requested_by || project.vo_approved_by || '',
                        vo_type: project.vo_type || 'Combined',
                        vo_sequence_no: project.vo_sequence_no || '',
                        additive_amount: project.additive_amount || '',
                        deductive_amount: project.deductive_amount || '',
                        net_vo_amount: project.net_vo_amount || '',
                        time_extension_days: project.time_extension_days || '',
                        revised_expiry_date: project.revised_expiry_date ? project.revised_expiry_date.split('T')[0] : '',
                        caf_reference: project.caf_reference || '',
                        isProjectDetailsUpdate: true,
                        fundingYear: project.funding_year || project.fundingYear || '',
                        fundingYearJustification: '',
                        program_type: project.program_type || (project.isDonated || project.is_donated ? 'Donated' : 'BEFF'),
                        isDonated: project.isDonated || project.is_donated || false,
                        justification_category: project.justification_category || 'Site Condition',
                        justification_details: project.justification_details || '',
                        procurement_status: project.procurement_status || project.procurementStatus || project.statusDesignPhase || ''
                    };
                }
                
                // If it's the same project updating (likely the background fetch),
                // merge in missing PDFs and existence flags without overwriting dirty fields
                const updatedData = { ...prev };
                const pdfFields = ['pow_pdf', 'dupa_pdf', 'contract_pdf', 'moa_pdf', 'rta_pdf', 'variation_order_pdf', 'variationOrderPdf'];
                const flagFields = ['hasPow', 'hasDupa', 'hasContract', 'hasMoa', 'hasRta', 'hasVariationOrder'];
                
                [...pdfFields, ...flagFields].forEach(field => {
                    if (project[field] !== undefined && (prev[field] === undefined || prev[field] === null)) {
                        updatedData[field] = project[field];
                    }
                });

                return updatedData;
            });
            setIsFundingYearLocked(true);
            setShowJustificationPrompt(false);
            setDocuments(prev => {
                // Only reset documents if the project changed
                if (project.id !== formData?.id) {
                    return { POW: null, DUPA: null, CONTRACT: null };
                }
                return prev;
            });
        }
    }, [project, isOpen]);

    useEffect(() => {
        if (formData?.isRealignment && project?.id) {
            const fetchCandidates = async () => {
                setIsFetchingCandidates(true);
                try {
                    setCandidatesError(null);
                    const res = await fetch(api(`/projects/realignment-candidates/${project.id}`));
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.message || "Failed to fetch candidates");
                    setRealignmentCandidates(data);
                } catch (err) {
                    console.error("Candidates Fetch Error:", err);
                    setCandidatesError(err.message);
                } finally {
                    setIsFetchingCandidates(false);
                }
            };
            fetchCandidates();
        }
    }, [formData?.isRealignment, project?.id]);

    // --- Document Handlers ---
    const handleDocumentSelect = (e, type) => {
        const file = e.target.files[0];
        if (file) {
            if (file.type !== "application/pdf") {
                alert("⚠️ INVALID FORMAT\n\nPlease upload a valid PDF file.");
                return;
            }
            // Limit to 100MB (Safety buffer for payload limit)
            if (file.size > 100 * 1024 * 1024) {
                alert("⚠️ FILE TOO LARGE\n\nMaximum file size is 100MB per document.");
                return;
            }
            setDocuments(prev => ({ ...prev, [type]: file }));
        }
    };

    const removeDocument = (type) => {
        setDocuments(prev => ({ ...prev, [type]: null }));
    };

    if (!isOpen || !formData) return null;

    const handleChange = (e) => {
        let { name, value } = e.target;
        setFormData((prev) => {
            let newData = { ...prev, [name]: value };

            // Force Uppercase for Scope of Work & Batch of Funds
            if (['scopeOfWork', 'batchOfFunds', 'province', 'city', 'municipality'].includes(name)) {
                newData[name] = value.toUpperCase();
            }

            // Handle Numeric Fields with Commas
            const numericFields = [
                'numberOfClassrooms', 'numberOfStoreys', 'numberOfSites',
                'approved_budget_for_contract', 'contract_amount', 'fundsUtilized', 'tranches_count', 'tranche_amount',
                'additive_amount', 'deductive_amount', 'net_vo_amount'
            ];
            if (numericFields.includes(name)) {
                const stripped = stripCommas(value);
                newData[name] = stripped;

                // Auto-calculate Net VO Amount
                if (['additive_amount', 'deductive_amount'].includes(name)) {
                    const add = parseFloat(name === 'additive_amount' ? stripped : (prev.additive_amount || 0));
                    const ded = parseFloat(name === 'deductive_amount' ? stripped : (prev.deductive_amount || 0));
                    newData.net_vo_amount = (add - ded).toFixed(2);

                    // Update Revised Contract Amount based on ORIGINAL contract amount from project prop
                    const originalContract = parseFloat(project.contract_amount || project.approved_budget_for_contract || 0);
                    newData.contract_amount = (originalContract + (add - ded)).toFixed(2);
                }
            }

            if (name === 'revised_expiry_date' && value) {
                // Auto-calculate Time Extension (Days) based on Original Target Completion Date
                const originalExpiry = new Date(project.targetCompletionDate || project.noticeToProceed);
                const revisedExpiry = new Date(value);
                const diffTime = revisedExpiry.getTime() - originalExpiry.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                newData.time_extension_days = diffDays > 0 ? diffDays : 0;
            }

            if (name === "accomplishmentPercentage") {
                // Remove leading zeros
                if (value.length > 1 && value.startsWith('0')) {
                    value = value.replace(/^0+/, '');
                    newData.accomplishmentPercentage = value;
                }

                // Limit 0-100
                let percent = parseFloat(value);
                if (percent < 0) { percent = 0; newData.accomplishmentPercentage = 0; }
                if (percent > 100) { percent = 100; newData.accomplishmentPercentage = 100; }

                if (percent === 100) {
                    if (prev.status !== ProjectStatus.Completed)
                        newData.status = ProjectStatus.ForFinalInspection;
                } else if (percent >= 1 && percent < 100) {
                    if (
                        prev.status === ProjectStatus.Completed ||
                        prev.status === ProjectStatus.ForFinalInspection
                    )
                        newData.status = ProjectStatus.Ongoing;
                } else if (percent === 0) {
                    // Remove automatic status reset to 'Not Yet Started' to allow placeholder
                    // newData.status = ProjectStatus.NotYetStarted;
                }
            }
            if (name === "status") {
                if (
                    value === ProjectStatus.NotYetStarted ||
                    value === ProjectStatus.UnderProcurement
                )
                    newData.accomplishmentPercentage = 0;
                else if (
                    value === ProjectStatus.Completed ||
                    value === ProjectStatus.ForFinalInspection
                )
                    newData.accomplishmentPercentage = 100;
            }
            return newData;
        });
    };

    const handleUpdatePercentage = (newVal) => {
        const percent = Math.min(100, Math.max(0, Number(newVal)));
        setFormData((prev) => {
            let newData = { ...prev, accomplishmentPercentage: percent };

            if (percent === 100) {
                if (prev.status !== ProjectStatus.Completed)
                    newData.status = ProjectStatus.ForFinalInspection;
            } else if (percent >= 1 && percent < 100) {
                if (
                    prev.status === ProjectStatus.Completed ||
                    prev.status === ProjectStatus.ForFinalInspection
                )
                    newData.status = ProjectStatus.Ongoing;
            } else if (percent === 0) {
                newData.status = ProjectStatus.NotYetStarted;
            }
            return newData;
        });
    };

    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            alert("❌ Geolocation is not supported by your browser.");
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude.toFixed(6);
                const long = position.coords.longitude.toFixed(6);

                setFormData(prev => ({
                    ...prev,
                    latitude: lat,
                    longitude: long
                }));
                // alert(`✅ Coordinates Captured!\nLat: ${lat}\nLong: ${long}`);
            },
            (error) => {
                console.warn("Geolocation warning:", error);
                let msg = "Unable to retrieve location.";
                if (error.code === 1) msg = "❌ Location permission denied.";
                else if (error.code === 2) msg = "❌ Position unavailable.";
                else if (error.code === 3) msg = "❌ Timeout.";
                alert(msg);
            },
            options
        );
    };

    const handleLocationSelect = (lat, lng) => {
        setFormData(prev => ({
            ...prev,
            latitude: lat.toFixed(6),
            longitude: lng.toFixed(6)
        }));
    };

    const isDisabledPercentageInput =
        formData.status === ProjectStatus.NotYetStarted ||
        formData.status === ProjectStatus.UnderProcurement ||
        formData.status === ProjectStatus.Completed ||
        formData.status === ProjectStatus.ForFinalInspection;

    const handleUnlockFundingYear = () => {
        const reason = prompt("⚠️ STRICT UPDATE REQUIRED\n\nPlease provide a justification/reason for changing the Funding Year:");
        if (reason && reason.trim().length > 5) {
            setIsFundingYearLocked(false);
            setFormData(prev => ({
                ...prev,
                fundingYearJustification: reason.trim()
            }));
            alert("✅ Funding Year Unlocked.\nPlease proceed with the update.");
        } else if (reason !== null) {
            alert("❌ FAILED\nA valid justification (at least 6 characters) is required to unlock this field.");
        }
    };

    // --- Render Sections Helpers ---

    const renderProjectDetails = () => (
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Project Details</h3>

            {/* Category & Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Category</label>
                    {formData.hasVariationOrder ? (
                        <select
                            name="projectCategory"
                            value={formData.projectCategory}
                            onChange={handleChange}
                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                        >
                            <option value="">Select Category...</option>
                            {PROJECT_CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    ) : (
                        <input name="projectCategory" value={formData.projectCategory} onChange={handleChange} disabled={readOnly} className={`w-full p-2 bg-white border border-slate-200 rounded-lg text-xs ${readOnly ? 'bg-slate-100' : ''}`} />
                    )}
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Project Name</label>
                    <input name="projectName" value={formData.projectName} onChange={handleChange} disabled={readOnly} className={`w-full p-2 bg-white border border-slate-200 rounded-lg text-xs ${readOnly ? 'bg-slate-100' : ''}`} />
                </div>
            </div>

            {/* Program Type Selection */}
            <div className="space-y-3 mb-4">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Program Type</label>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, program_type: 'BEFF', isDonated: false }))}
                        disabled={readOnly}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${formData.program_type === 'BEFF' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'}`}
                    >
                        <span className="text-lg mb-1">🏛️</span>
                        <span className="text-[9px] font-black uppercase tracking-widest">BEFF (Gov)</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, program_type: 'Donated', isDonated: true }))}
                        disabled={readOnly}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${formData.program_type === 'Donated' ? 'border-[#004A99] bg-blue-50 text-[#004A99]' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'}`}
                    >
                        <span className="text-lg mb-1">🎁</span>
                        <span className="text-[9px] font-black uppercase tracking-widest">Donated</span>
                    </button>
                </div>
            </div>

            {/* Scope of Work */}
            <div>
                <div className="flex justify-between items-center mb-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Scope of Work</label>
                    <span className={`text-[9px] font-bold ${formData.scopeOfWork?.length >= 200 ? 'text-red-500' : 'text-slate-400'}`}>
                        {formData.scopeOfWork?.length || 0}/200
                    </span>
                </div>
                <textarea
                    name="scopeOfWork"
                    rows="2"
                    value={formData.scopeOfWork || ''}
                    onChange={handleChange}
                    disabled={readOnly}
                    maxLength="200"
                    className={`w-full p-2 bg-white border border-slate-200 rounded-lg text-xs resize-none ${readOnly ? 'bg-slate-100' : ''}`}
                />
            </div>

            {/* Stats: Classrooms, Storeys, Sites */}
            <div className="grid grid-cols-3 gap-3">
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Classrooms</label>
                    <input type="text" name="numberOfClassrooms" value={formatWithCommas(formData.numberOfClassrooms)} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Storeys</label>
                    <input type="text" name="numberOfStoreys" value={formatWithCommas(formData.numberOfStoreys)} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Sites</label>
                    <input type="text" name="numberOfSites" value={formatWithCommas(formData.numberOfSites)} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" />
                </div>
            </div>

            {/* Location Info (Editable) */}
            <div className="grid grid-cols-3 gap-3">
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Province</label>
                    <input name="province" value={formData.province} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" placeholder="Province" />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">City</label>
                    <input name="city" value={formData.city} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" placeholder="City" />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Municipality</label>
                    <input name="municipality" value={formData.municipality} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" placeholder="Municipality" />
                </div>
            </div>

            {/* School Info (ReadOnly) */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">School ID</label>
                    <input value={formData.schoolId} readOnly className="w-full p-2 bg-slate-100 text-slate-500 border border-slate-200 rounded-lg text-xs" />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">School Name</label>
                    <input value={formData.schoolName} readOnly className="w-full p-2 bg-slate-100 text-slate-500 border border-slate-200 rounded-lg text-xs" />
                </div>
            </div>
        </div>
    );

    const renderTimelineAndFunds = () => (
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                {formData.isProjectDetailsUpdate ? 'Project Timelines' : 'Timeline & Funds'}
            </h3>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Target Completion</label>
                    <input type="date" name="targetCompletionDate" value={formData.targetCompletionDate} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Notice to Proceed</label>
                    <input type="date" name="noticeToProceed" value={formData.noticeToProceed} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Construction Start</label>
                    <input type="date" name="constructionStartDate" value={formData.constructionStartDate} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Contractor</label>
                    <input name="contractorName" value={formData.contractorName} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Contract ID</label>
                    <input name="contractId" value={formData.contractId || ''} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" />
                </div>
            </div>

            {/* If NOT Details Update tab, show funds here as before. If IS Details Update, we separate them into a new section below. */}
            {!formData.isProjectDetailsUpdate && (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Approved Budget for Contract (ABC)</label>
                            <input type="text" name="approved_budget_for_contract" value={formatWithCommas(formData.approved_budget_for_contract)} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Contract Amount</label>
                            <input type="text" name="contract_amount" value={formatWithCommas(formData.contract_amount)} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Funds Utilized</label>
                            <input type="text" name="fundsUtilized" value={formatWithCommas(formData.fundsUtilized)} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Batch</label>
                            <input name="batchOfFunds" value={formData.batchOfFunds} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" />
                        </div>
                    </div>
                </>
            )}
        </div>
    );

    const renderFundsSection = () => {
        if (!formData.isProjectDetailsUpdate) return null;

        return (
            <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-400">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                        <span>💰</span> Funds
                    </h3>
                    {isFundingYearLocked && (
                        <span className="text-[8px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200 uppercase tracking-tighter">Strict Mode Active</span>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[10px] font-bold text-emerald-700 uppercase mb-1">Approved Budget for Contract (ABC)</label>
                        <input type="text" name="approved_budget_for_contract" value={formatWithCommas(formData.approved_budget_for_contract)} onChange={handleChange} className="w-full p-2 bg-white border border-emerald-100 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-emerald-700 uppercase mb-1">Contract Amount</label>
                        <input type="text" name="contract_amount" value={formatWithCommas(formData.contract_amount)} onChange={handleChange} className="w-full p-2 bg-white border border-emerald-100 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 outline-none" />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[10px] font-bold text-emerald-700 uppercase mb-1">Funds Utilized</label>
                        <input type="text" name="fundsUtilized" value={formatWithCommas(formData.fundsUtilized)} onChange={handleChange} className="w-full p-2 bg-white border border-emerald-100 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-emerald-700 uppercase mb-1">Batch of Funds</label>
                        <input name="batchOfFunds" value={formData.batchOfFunds} onChange={handleChange} className="w-full p-2 bg-white border border-emerald-100 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 outline-none" />
                    </div>
                </div>

                <div className="pt-3 border-t border-emerald-100">
                    <label className="block text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-1 flex items-center justify-between">
                        Funding Year
                        {isFundingYearLocked ? (
                            <button
                                type="button"
                                onClick={handleUnlockFundingYear}
                                className="text-[8px] text-blue-600 underline hover:text-blue-800"
                            >
                                Unlock to Edit
                            </button>
                        ) : (
                            <span className="text-[8px] text-emerald-600 font-bold italic">Unlocked (Reason: {formData.fundingYearJustification?.substring(0, 15)}...)</span>
                        )}
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            name="fundingYear"
                            value={formData.fundingYear}
                            onChange={handleChange}
                            disabled={isFundingYearLocked}
                            placeholder="YYYY"
                            className={`w-full p-2 font-black text-sm border rounded-lg transition-all ${isFundingYearLocked
                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                : 'bg-white text-emerald-700 border-emerald-400 ring-2 ring-emerald-100 outline-none shadow-sm'}`}
                        />
                        {isFundingYearLocked && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300">🔒</div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderTabs = () => {
        if (mode === 'docs_only') return null;

        return (
            <div className="flex p-1 bg-slate-100 rounded-2xl mb-4">
                <button
                    onClick={() => setFormData(prev => ({ ...prev, hasVariationOrder: false, isRealignment: false, isProjectDetailsUpdate: false }))}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${(!formData.hasVariationOrder && !formData.isRealignment && !formData.isProjectDetailsUpdate)
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-slate-500 hover:bg-white/50'}`}
                >
                    Status Update
                </button>
                <button
                    onClick={() => setFormData(prev => ({ ...prev, hasVariationOrder: false, isRealignment: false, isProjectDetailsUpdate: true }))}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${formData.isProjectDetailsUpdate
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-500 hover:bg-white/50'}`}
                >
                    Details Update
                </button>
                <button
                    onClick={() => setFormData(prev => ({ ...prev, hasVariationOrder: true, isRealignment: false, isProjectDetailsUpdate: false }))}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${formData.hasVariationOrder
                        ? 'bg-amber-500 text-white shadow-md'
                        : 'text-slate-500 hover:bg-white/50'}`}
                >
                    VO
                </button>
                <button
                    onClick={() => setFormData(prev => ({ ...prev, hasVariationOrder: false, isRealignment: true, isProjectDetailsUpdate: false }))}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${formData.isRealignment
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'text-slate-500 hover:bg-white/50'}`}
                >
                    Realign
                </button>
            </div>
        );
    };

    const renderVariationOrderHeader = () => {
        if (!formData.hasVariationOrder) return null;

        const originalAmount = parseFloat(project.contract_amount || project.approved_budget_for_contract || 0);

        // CUMULATIVE CALCULATION
        const prevVoTotal = (voHistory || []).reduce((sum, vo) => sum + parseFloat(vo.net_vo_amount || 0), 0);
        const currentNetVO = parseFloat(formData.net_vo_amount || 0);
        const cumulativeNetVO = prevVoTotal + currentNetVO;
        const percentChangeCumulative = originalAmount > 0 ? (cumulativeNetVO / originalAmount) * 100 : 0;

        const isOverLimit = percentChangeCumulative > 10;

        return (
            <>
                <div className={`border rounded-2xl p-4 mb-4 transition-all duration-300 ${isOverLimit ? 'bg-red-50 border-red-200 shadow-sm' : 'bg-amber-50 border-amber-200'}`}>
                    <div className="flex flex-col gap-3 mb-4">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-inner ${isOverLimit ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>⚖️</div>
                                <div>
                                    <h3 className={`text-sm font-black uppercase tracking-wide ${isOverLimit ? 'text-red-900' : 'text-amber-900'}`}>{isOverLimit ? 'Critical Variation Order' : 'Variation Order Mode'}</h3>
                                    <p className={`text-[10px] font-bold leading-tight ${isOverLimit ? 'text-red-700' : 'text-amber-700'}`}>
                                        {isOverLimit ? '🚨 WARNING: Cumulative variation exceeds 10% limit (RA 9184 compliance risk).' : 'Updating project specification, timelines, or funding details.'}
                                    </p>
                                </div>
                            </div>
                            {isOverLimit && (
                                <div className="bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-full animate-bounce shadow-lg">
                                    {percentChangeCumulative.toFixed(1)}% CUMULATIVE
                                </div>
                            )}
                        </div>

                        {/* Cumulative Progress Bar */}
                        <div className="w-full mt-2">
                            <div className="flex justify-between items-center mb-1">
                                <span className={`text-[9px] font-black uppercase tracking-widest ${isOverLimit ? 'text-red-600' : 'text-amber-600'}`}>Cumulative VO Threshold (RA 9184)</span>
                                <span className={`text-[9px] font-black ${isOverLimit ? 'text-red-600' : 'text-amber-600'}`}>{percentChangeCumulative.toFixed(2)}% / 10%</span>
                            </div>
                            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-500 ${isOverLimit ? 'bg-red-500' : 'bg-amber-500'}`}
                                    style={{ width: `${Math.min(percentChangeCumulative * 10, 100)}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>

                    {/* VO IDENTITY FIELDS */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-amber-200/50">
                        <div>
                            <label className="block text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1">VO Sequence No.</label>
                            <input
                                type="number"
                                name="vo_sequence_no"
                                value={formData.vo_sequence_no}
                                onChange={handleChange}
                                placeholder="e.g. 1"
                                className="w-full p-2 bg-white border border-amber-200 rounded-lg text-xs font-bold focus:ring-1 focus:ring-amber-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1">VO Type</label>
                            <select
                                name="vo_type"
                                value={formData.vo_type}
                                onChange={handleChange}
                                className="w-full p-2 bg-white border border-amber-200 rounded-lg text-xs font-bold focus:ring-1 focus:ring-amber-500 outline-none"
                            >
                                <option value="Change Order">Change Order</option>
                                <option value="Extra Work Order">Extra Work Order</option>
                                <option value="Combined">Combined (EWO + CO)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1">CAF Reference</label>
                            <input
                                name="caf_reference"
                                value={formData.caf_reference}
                                onChange={handleChange}
                                placeholder="Certificate of Availability of Funds"
                                className="w-full p-2 bg-white border border-amber-200 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 outline-none uppercase"
                            />
                        </div>
                    </div>

                    {/* FINANCIAL BREAKDOWN */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 pb-4 border-b border-amber-200/50">
                        <div>
                            <label className="block text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">Additive Amount (+)</label>
                            <input
                                type="text"
                                name="additive_amount"
                                value={formatWithCommas(formData.additive_amount)}
                                onChange={handleChange}
                                placeholder="0.00"
                                className="w-full p-2 bg-white border border-emerald-200 rounded-lg text-xs font-bold text-emerald-700 focus:ring-1 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-red-700 uppercase tracking-widest mb-1">Deductive Amount (-)</label>
                            <input
                                type="text"
                                name="deductive_amount"
                                value={formatWithCommas(formData.deductive_amount)}
                                onChange={handleChange}
                                placeholder="0.00"
                                className="w-full p-2 bg-white border border-red-200 rounded-lg text-xs font-bold text-red-700 focus:ring-1 focus:ring-red-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-blue-700 uppercase tracking-widest mb-1">Net VO Amount</label>
                            <input
                                type="text"
                                name="net_vo_amount"
                                value={formatWithCommas(formData.net_vo_amount)}
                                readOnly
                                className="w-full p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs font-black text-blue-700 outline-none"
                            />
                        </div>
                    </div>

                    {/* TIME & EXPIRY */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 pb-4">
                        <div>
                            <label className="block text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1">Revised Expiry Date</label>
                            <input
                                type="date"
                                name="revised_expiry_date"
                                value={formData.revised_expiry_date}
                                onChange={handleChange}
                                className="w-full p-2 bg-white border border-amber-200 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 outline-none font-bold"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1">Time Extension (Days)</label>
                            <input
                                type="number"
                                name="time_extension_days"
                                value={formData.time_extension_days}
                                readOnly
                                placeholder="0"
                                className="w-full p-2 bg-amber-50 border border-amber-100 rounded-lg text-xs outline-none font-bold text-amber-900"
                            />
                        </div>
                        <div className="flex flex-col justify-end">
                            <div className="bg-amber-100/50 p-2 rounded-lg border border-amber-200/50">
                                <span className="block text-[8px] font-black text-amber-600 uppercase tracking-[0.2em] mb-0.5">Current VO Summary</span>
                                <span className="text-[10px] font-bold text-amber-800">
                                    {currentNetVO >= 0 ? '➕ ADDITIVE' : '➖ DEDUCTIVE'} (₱{Number(Math.abs(currentNetVO)).toLocaleString()})
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* JUSTIFICATION HIERARCHY */}
                    <div className="pt-4 pb-4 border-t border-amber-200/50 space-y-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Justification Category</label>
                            <select
                                name="justification_category"
                                value={formData.justification_category}
                                onChange={handleChange}
                                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-amber-500 outline-none"
                            >
                                <option value="Site Condition">Change in Site Conditions (Unforeseen)</option>
                                <option value="Design Correction">Corrective Design Adjustment</option>
                                <option value="User Request">User-Requested Enhancement (Principal/SDO)</option>
                                <option value="Regulatory">Regulatory Compliance Change</option>
                                <option value="Other">Other Technical Requirement</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Detailed Reason / Justification</label>
                            <textarea
                                name="justification_details"
                                value={formData.justification_details}
                                onChange={handleChange}
                                rows="3"
                                placeholder="Provide specific technical reasoning for this variation..."
                                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-none resize-none"
                            />
                        </div>
                    </div>

                    {/* DETAILED DOCUMENT UPLOADS */}
                    <div className="mt-4 pt-4 border-t border-amber-200 space-y-3">
                        <label className="block text-[10px] font-black text-amber-700 uppercase tracking-widest mb-2">Required VO Documentation (Detailed PDFs)</label>

                        <div className="grid grid-cols-1 gap-2">
                            {/* Revised POW */}
                            <div className={`flex items-center justify-between p-2 rounded-xl border border-dashed text-[10px] font-bold ${documents.RevisedPOW ? 'bg-white border-blue-400 text-blue-700' : 'bg-white/50 border-amber-200 text-amber-600'}`}>
                                <div className="flex items-center gap-2 truncate pr-2">
                                    <span>{documents.RevisedPOW ? '📄' : '📎'}</span>
                                    <span className="truncate">{documents.RevisedPOW ? documents.RevisedPOW.name : 'REVISED PROGRAM OF WORKS (POW)'}</span>
                                </div>
                                <div className="flex gap-2">
                                    {documents.RevisedPOW && <button onClick={() => removeDocument('RevisedPOW')} className="text-red-500 hover:bg-red-50 p-1 rounded">✕</button>}
                                    <label className="cursor-pointer bg-white border border-amber-200 px-2 py-1 rounded shadow-sm hover:bg-amber-50 text-[9px] uppercase tracking-tighter">
                                        {documents.RevisedPOW ? 'Change' : 'Upload'}
                                        <input type="file" accept=".pdf" className="hidden" onChange={(e) => handleDocumentSelect(e, 'RevisedPOW')} />
                                    </label>
                                </div>
                            </div>

                            {/* Revised DUPA */}
                            <div className={`flex items-center justify-between p-2 rounded-xl border border-dashed text-[10px] font-bold ${documents.RevisedDUPA ? 'bg-white border-blue-400 text-blue-700' : 'bg-white/50 border-amber-200 text-amber-600'}`}>
                                <div className="flex items-center gap-2 truncate pr-2">
                                    <span>{documents.RevisedDUPA ? '📄' : '📎'}</span>
                                    <span className="truncate">{documents.RevisedDUPA ? documents.RevisedDUPA.name : 'REVISED DUPA (ITEMIZED)'}</span>
                                </div>
                                <div className="flex gap-2">
                                    {documents.RevisedDUPA && <button onClick={() => removeDocument('RevisedDUPA')} className="text-red-500 hover:bg-red-50 p-1 rounded">✕</button>}
                                    <label className="cursor-pointer bg-white border border-amber-200 px-2 py-1 rounded shadow-sm hover:bg-amber-50 text-[9px] uppercase tracking-tighter">
                                        {documents.RevisedDUPA ? 'Change' : 'Upload'}
                                        <input type="file" accept=".pdf" className="hidden" onChange={(e) => handleDocumentSelect(e, 'RevisedDUPA')} />
                                    </label>
                                </div>
                            </div>

                            {/* Revised Contract */}
                            <div className={`flex items-center justify-between p-2 rounded-xl border border-dashed text-[10px] font-bold ${documents.RevisedContract ? 'bg-white border-blue-400 text-blue-700' : 'bg-white/50 border-amber-200 text-amber-600'}`}>
                                <div className="flex items-center gap-2 truncate pr-2">
                                    <span>{documents.RevisedContract ? '📄' : '📎'}</span>
                                    <span className="truncate">{documents.RevisedContract ? documents.RevisedContract.name : 'SUPPLEMENTAL AGREEMENT / REVISED CONTRACT'}</span>
                                </div>
                                <div className="flex gap-2">
                                    {documents.RevisedContract && <button onClick={() => removeDocument('RevisedContract')} className="text-red-500 hover:bg-red-50 p-1 rounded">✕</button>}
                                    <label className="cursor-pointer bg-white border border-amber-200 px-2 py-1 rounded shadow-sm hover:bg-amber-50 text-[9px] uppercase tracking-tighter">
                                        {documents.RevisedContract ? 'Change' : 'Upload'}
                                        <input type="file" accept=".pdf" className="hidden" onChange={(e) => handleDocumentSelect(e, 'RevisedContract')} />
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
    };

    const renderRealignmentTab = () => {
        if (!formData.isRealignment) return null;

        return (
            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 mb-4 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-xl text-purple-600 shadow-inner">🔄</div>
                    <div>
                        <h3 className="text-sm font-black text-purple-900 uppercase tracking-wide">Project Realignment</h3>
                        <p className="text-[10px] text-purple-700 font-bold leading-tight">Transfer budget funds to another project within the same category, region, and district.</p>
                    </div>
                </div>

                <div className="pt-4 border-t border-purple-200 space-y-4">
                    {/* Target Project Selection */}
                    <div>
                        <label className="block text-[10px] font-black text-purple-700 uppercase tracking-widest mb-1">Target Project</label>
                        {isFetchingCandidates ? (
                            <div className="text-xs text-purple-400 italic py-2">Searching for eligible projects matching category and district...</div>
                        ) : candidatesError ? (
                            <div className="text-xs text-red-500 bg-red-50 p-3 rounded-xl border border-red-100 flex items-start gap-2">
                                <span className="text-sm">⚠️</span>
                                <span>{candidatesError}</span>
                            </div>
                        ) : realignmentCandidates.length > 0 ? (
                            <select
                                value={realignmentForm.targetIpc}
                                onChange={(e) => setRealignmentForm(prev => ({ ...prev, targetIpc: e.target.value }))}
                                className="w-full p-2 bg-white border border-purple-200 rounded-lg text-xs focus:ring-1 focus:ring-purple-500 outline-none"
                            >
                                <option value="">Select Target Project...</option>
                                {realignmentCandidates.map(c => (
                                    <option key={c.ipc} value={c.ipc}>
                                        {c.schoolName} - {c.projectName} (IPC: {c.ipc})
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <div className="text-xs text-red-500 bg-red-50 p-2 rounded-lg border border-red-100">
                                ⚠️ No eligible projects found matching the same category, region, and district.
                            </div>
                        )}
                    </div>

                    {/* (Amount, Date, RequestedBy and Remarks removed as per simplification) */}
                </div>
            </div>
        );
    };

    const canEditLocation = userRole === 'Division Engineer' || userRole === 'Architect';

    const renderLocation = () => (
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Project Location</h3>
                {canEditLocation && (
                    <button
                        type="button"
                        onClick={() => setIsLocationEditing(prev => !prev)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                            isLocationEditing
                                ? 'bg-amber-50 border-amber-300 text-amber-600 shadow-sm shadow-amber-200'
                                : 'bg-slate-100 border-slate-200 text-slate-400 hover:border-blue-200 hover:text-blue-500'
                        }`}
                    >
                        {isLocationEditing ? <FiUnlock size={11} /> : <FiLock size={11} />}
                        {isLocationEditing ? 'Editing' : 'Edit Location'}
                    </button>
                )}
            </div>
            <div className={`rounded-xl overflow-hidden border h-40 shadow-inner transition-colors ${isLocationEditing ? 'border-amber-300' : 'border-slate-200'}`}>
                <LocationPickerMap
                    latitude={formData.latitude}
                    longitude={formData.longitude}
                    onLocationSelect={handleLocationSelect}
                    disabled={!isLocationEditing}
                />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Latitude</label>
                    <input name="latitude" value={formData.latitude} readOnly className="w-full p-2 bg-slate-100 text-slate-500 border border-slate-200 rounded-lg text-[10px] font-mono" />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Longitude</label>
                    <input name="longitude" value={formData.longitude} readOnly className="w-full p-2 bg-slate-100 text-slate-500 border border-slate-200 rounded-lg text-[10px] font-mono" />
                </div>
            </div>
            {!readOnly && (
                <button
                    type="button"
                    onClick={handleGetLocation}
                    className="w-full py-2 bg-blue-50 text-blue-600 font-bold text-[10px] uppercase rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                >
                    <span>📡</span> {formData.latitude ? 'Refine Location' : 'Get Current Location'}
                </button>
            )}
        </div>
    );

    const renderLguDetails = () => (
        <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-200 space-y-4">
            <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">LGU Project Details</h3>

            {/* Location Details */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                    <label className="block text-[10px] font-bold text-blue-700 uppercase mb-1">Province</label>
                    <input name="province" value={formData.province || ''} onChange={handleChange} className="w-full p-2 bg-white border border-blue-100 rounded-lg text-xs" />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-blue-700 uppercase mb-1">Municipality</label>
                    <input name="municipality" value={formData.municipality || ''} onChange={handleChange} className="w-full p-2 bg-white border border-blue-100 rounded-lg text-xs" />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-blue-700 uppercase mb-1">Leg. District</label>
                    <input name="legislative_district" value={formData.legislative_district || ''} onChange={handleChange} className="w-full p-2 bg-white border border-blue-100 rounded-lg text-xs" />
                </div>
            </div>

            {/* Funding & MOA */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-[10px] font-bold text-blue-700 uppercase mb-1">Fund Source</label>
                    <input name="fund_source" value={formData.fund_source || ''} onChange={handleChange} className="w-full p-2 bg-white border border-blue-100 rounded-lg text-xs" />
                </div>
                {/* MOA Date removed as it is now a PDF upload handled below */}
            </div>

            {/* Tranches */}
            <div className="p-3 bg-white/50 rounded-xl border border-blue-100">
                <h4 className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-3">Fund tranches</h4>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[9px] font-bold text-blue-700 uppercase mb-1">No. of Tranches</label>
                        <input type="text" name="tranches_count" value={formatWithCommas(formData.tranches_count)} onChange={handleChange} className="w-full p-2 bg-white border border-blue-50 rounded-lg text-xs" />
                    </div>
                    <div>
                        <label className="block text-[9px] font-bold text-blue-700 uppercase mb-1">Amt per Tranche</label>
                        <input type="text" name="tranche_amount" value={formatWithCommas(formData.tranche_amount)} onChange={handleChange} className="w-full p-2 bg-white border border-blue-50 rounded-lg text-xs" />
                    </div>
                </div>
            </div>

            {/* Procurement Stage (Optional for VO context but included for "all fields") */}
            <div>
                <label className="block text-[10px] font-bold text-blue-700 uppercase mb-1">Procurement Stage</label>
                <select name="procurement_stage" value={formData.procurement_stage || ''} onChange={handleChange} className="w-full p-2 bg-white border border-blue-100 rounded-lg text-xs">
                    <option value="">Select Stage...</option>
                    <option value="Not Yet Started">Not Yet Started</option>
                    <option value="Under Procurement">Under Procurement</option>
                    <option value="Ongoing">Ongoing</option>
                    <option value="For Final Inspection">For Final Inspection</option>
                    <option value="Completed">Completed</option>
                </select>
            </div>
        </div>
    );

    const renderProcurementMilestones = () => (
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><span>⚖️</span> Procurement Milestones</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Invitation to Bid</label>
                    <input type="date" name="issuanceOfInvitationToBid" value={formData.issuanceOfInvitationToBid || ''} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" />
                </div>
                <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Pre-Bid Conference</label>
                    <input type="date" name="preBidConference" value={formData.preBidConference || ''} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" />
                </div>
                <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Opening of Tech. Proposal</label>
                    <input type="date" name="openingOfTechnicalProposal" value={formData.openingOfTechnicalProposal || ''} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" />
                </div>
                <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Opening of Fin. Proposal</label>
                    <input type="date" name="openingOfFinancialProposal" value={formData.openingOfFinancialProposal || ''} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" />
                </div>
                <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Request for Quotation</label>
                    <input type="date" name="requestForQuotation" value={formData.requestForQuotation || ''} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" />
                </div>
                <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Negotiation</label>
                    <input type="date" name="negotiation" value={formData.negotiation || ''} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" />
                </div>
                <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Opening of Quotation</label>
                    <input type="date" name="openingOfQuotation" value={formData.openingOfQuotation || ''} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" />
                </div>
                <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Notice of Award</label>
                    <input type="date" name="dateNoticeOfAward" value={formData.dateNoticeOfAward || ''} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" />
                </div>
            </div>
        </div>
    );

    const renderStatusAndProgress = () => {
        // Show status fields even for VO

        return (
            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status Design Phase</label>
                    <div className="relative">
                        <select
                            name="statusDesignPhase"
                            value={formData.statusDesignPhase || ''}
                            onChange={handleChange}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                        >
                            <option value="Not Yet Started">Not Yet Started</option>
                            <option value="Under Procurement">Under Procurement</option>
                            <option value="Ongoing">Ongoing</option>
                            <option value="For Final Inspection">For Final Inspection</option>
                            <option value="Completed">Completed</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            <FiSettings className="text-slate-400" />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status of Construction Phase</label>
                        <div className="relative">
                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                            >
                                {Object.values(ProjectStatus).map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                <FiSettings className="text-slate-400" />
                            </div>
                        </div>
                    </div>

                    {!['Not Yet Started', 'Under Procurement'].includes(formData.status) && (
                        <div className="space-y-2">
                            <div className="flex justify-between items-center ml-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Percentage (%)</label>
                                <div className="flex gap-1.5">
                                    <button type="button" onClick={() => handleUpdatePercentage(Number(formData.accomplishmentPercentage || 0) + 5)} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-black rounded hover:bg-blue-100 transition">+5%</button>
                                    <button type="button" onClick={() => handleUpdatePercentage(Number(formData.accomplishmentPercentage || 0) + 10)} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-black rounded hover:bg-blue-100 transition">+10%</button>
                                </div>
                            </div>
                            <input
                                type="number"
                                name="accomplishmentPercentage"
                                value={formData.accomplishmentPercentage}
                                onChange={handleChange}
                                min="0"
                                max="100"
                                disabled={isDisabledPercentageInput}
                                className={`w-full p-3 border rounded-2xl text-sm font-black text-center ${isDisabledPercentageInput
                                    ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                    : "bg-blue-50 text-[#004A99] border-blue-100 focus:ring-2 focus:ring-blue-500 outline-none"
                                    }`}
                            />
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderFundsUtilized = () => (
        // For Quick Mode: Standalone Funds Utilized input
        <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Funds Utilized</label>
            <input type="text" name="fundsUtilized" value={formatWithCommas(formData.fundsUtilized)} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
    );

    const renderSitePhotos = (isVo = false) => {
        if (formData.status === ProjectStatus.NotYetStarted || formData.status === ProjectStatus.UnderProcurement) return null;

        const isRequiredStatus = [ProjectStatus.Ongoing, ProjectStatus.ForFinalInspection, ProjectStatus.Completed].includes(formData.status);
        const hasPhotos = (internalPreviews?.length || 0) > 0 || (externalPreviews?.length || 0) > 0;

        return (
            <div className={`${isVo ? 'bg-white shadow-sm' : 'bg-slate-50'} p-4 rounded-2xl border border-slate-200`}>
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Site Photos {isVo ? '(VO Proof)' : ''}
                    </h3>
                    {isRequiredStatus && !hasPhotos && !readOnly && (
                        <span className="text-[9px] font-black text-red-500 bg-red-50 px-2 py-0.5 rounded uppercase animate-pulse">Required for {formData.status}</span>
                    )}
                </div>
                <div className="space-y-4">
                    {/* External */}
                    <div className={`${isVo ? 'bg-slate-50' : 'bg-white'} p-3 rounded-xl border border-slate-100 shadow-sm`}>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-bold text-slate-600 uppercase">External Photos</span>
                            <span className="text-[9px] font-bold text-blue-500">{externalPreviews?.length || 0} Added</span>
                        </div>
                        <div className="text-[9px] text-slate-400 mb-2 italic space-y-0.5">
                            <p>• Front, Left, Right, Rear (wide shots)</p>
                            <p>• Orthographic at height 20-30m (optional)</p>
                        </div>
                        {!readOnly && (
                            <div className="flex gap-2 mb-2">
                                <button onClick={() => onCameraClick('External')} className={`flex-1 py-3 ${isVo ? 'bg-white' : 'bg-slate-50'} border border-dashed border-slate-300 rounded-xl text-slate-500 text-[9px] font-black uppercase hover:border-blue-400 hover:text-blue-500 transition-all`}>📷 Camera</button>
                                <button onClick={() => onGalleryClick('External')} className={`flex-1 py-3 ${isVo ? 'bg-white' : 'bg-slate-50'} border border-dashed border-slate-300 rounded-xl text-slate-500 text-[9px] font-black uppercase hover:border-blue-400 hover:text-blue-500 transition-all`}>🖼️ Gallery</button>
                            </div>
                        )}
                        {externalPreviews?.length > 0 && (
                            <div className="grid grid-cols-4 gap-2">
                                {externalPreviews.map((url, index) => (
                                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden ring-1 ring-slate-200">
                                        <img src={url} alt="external" className="w-full h-full object-cover" />
                                        {!readOnly && <button onClick={() => onRemoveFile(index, 'External')} className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-4 h-4 text-[8px] flex items-center justify-center">✕</button>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    {/* Internal */}
                    <div className={`${isVo ? 'bg-slate-50' : 'bg-white'} p-3 rounded-xl border border-slate-100 shadow-sm`}>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-bold text-slate-600 uppercase">Internal Photos</span>
                            <span className="text-[9px] font-bold text-blue-500">{internalPreviews?.length || 0} Added</span>
                        </div>
                        <div className="text-[9px] text-slate-400 mb-2 italic space-y-0.5">
                            <p>• Classrooms: Longest wall, Lighting, Outlets, etc.</p>
                            <p>• Camera at 1.4-1.6m height, Facing longest wall.</p>
                        </div>
                        {!readOnly && (
                            <div className="flex gap-2 mb-2">
                                <button onClick={() => onCameraClick('Internal')} className={`flex-1 py-3 ${isVo ? 'bg-white' : 'bg-slate-50'} border border-dashed border-slate-300 rounded-xl text-slate-500 text-[9px] font-black uppercase hover:border-blue-400 hover:text-blue-500 transition-all`}>📷 Camera</button>
                                <button onClick={() => onGalleryClick('Internal')} className={`flex-1 py-3 ${isVo ? 'bg-white' : 'bg-slate-50'} border border-dashed border-slate-300 rounded-xl text-slate-500 text-[9px] font-black uppercase hover:border-blue-400 hover:text-blue-500 transition-all`}>🖼️ Gallery</button>
                            </div>
                        )}
                        {internalPreviews?.length > 0 && (
                            <div className="grid grid-cols-4 gap-2">
                                {internalPreviews.map((url, index) => (
                                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden ring-1 ring-slate-200">
                                        <img src={url} alt="internal" className="w-full h-full object-cover" />
                                        {!readOnly && <button onClick={() => onRemoveFile(index, 'Internal')} className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-4 h-4 text-[8px] flex items-center justify-center">✕</button>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderDocumentUploads = () => (
        <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">📄</span>
                <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">{readOnly ? 'Project Documents' : 'Update Documents'}</h3>
            </div>
            {!readOnly && <p className="text-xs text-slate-400 -mt-2 mb-2">Each document must be a PDF file.</p>}

            <div className="space-y-2">
                {Object.entries(DOC_TYPES)
                    .map(([key, label]) => (
                        <div key={key} className={`p-3 rounded-xl border transition-all ${documents[key] ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200 border-dashed'}`}>
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className={`text-[10px] font-black uppercase tracking-widest ${documents[key] ? 'text-emerald-700' : 'text-slate-500'}`}>
                                        {label}
                                    </p>
                                    {documents[key] ? (
                                        <p className="text-[9px] text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                            {documents[key].name}
                                        </p>
                                    ) : (
                                        project && project[`${key.toLowerCase()}_pdf`] ? (
                                            <div className="flex flex-col mt-0.5">
                                                <p className="text-[9px] text-blue-500 font-bold mb-1">Existing File Available</p>
                                                <a
                                                    href={(() => { 
                                                        const v = project[`${key.toLowerCase()}_pdf`]; 
                                                        if (v?.startsWith('/uploads/')) {
                                                            const baseUrl = import.meta.env.BASE_URL || "/";
                                                            const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
                                                            const normalizedPath = v.startsWith('/') ? v.substring(1) : v;
                                                            return `${normalizedBase}${normalizedPath}`;
                                                        }
                                                        return (v?.startsWith('data:')) ? v : `data:application/pdf;base64,${v}`; 
                                                    })()}
                                                    download={`${formData.schoolName}_${label}.pdf`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-block w-fit px-3 py-1.5 bg-blue-50 text-blue-700 text-[9px] font-black rounded-lg border border-blue-100 hover:bg-blue-100 transition-all uppercase tracking-wider"
                                                >
                                                    View Document
                                                </a>
                                            </div>
                                        ) : (
                                            <p className="text-[9px] text-slate-400 mt-0.5">No file uploaded</p>
                                        )
                                    )}
                                </div>
                                <div>
                                    {documents[key] ? (
                                        <button
                                            onClick={() => removeDocument(key)}
                                            className="w-6 h-6 rounded-full bg-white text-red-500 shadow-sm border border-red-100 flex items-center justify-center hover:bg-red-50"
                                        >
                                            ✕
                                        </button>
                                    ) : (
                                        !readOnly && (
                                            <label className="cursor-pointer px-3 py-1.5 bg-white border border-slate-200 shadow-sm rounded-lg text-[9px] font-bold text-slate-600 uppercase tracking-wider hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all active:scale-95">
                                                Select PDF
                                                <input
                                                    type="file"
                                                    accept=".pdf"
                                                    className="hidden"
                                                    onChange={(e) => handleDocumentSelect(e, key)}
                                                />
                                            </label>
                                        )
                                    )}
                                    {readOnly && !documents[key] && !project[`${key.toLowerCase()}_pdf`] && (
                                        <span className="text-[9px] text-slate-300 font-bold italic px-2">N/A</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-end sm:items-center justify-center z-[1100] p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-lg max-h-[90vh] flex flex-col rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
                {/* --- HEADER --- */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">{readOnly ? 'View Project Details' : 'Update Project'}</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                            {mode === 'quick' ? 'Quick Status Update' : (mode === 'docs_only' ? (readOnly ? 'Project Documents' : 'Upload Documents') : 'Full Project Edit')}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* --- BODY --- */}
                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">

                    {/* TABS SWITCHER */}
                    {renderTabs()}

                    {/* IF REGULAR UPDATE: Show status/progress/photos */}
                    {/* IF REGULAR UPDATE: Show status/progress/photos */}
                    {!formData.hasVariationOrder && !formData.isRealignment && !formData.isProjectDetailsUpdate && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {renderStatusAndProgress()}
                            {renderFundsUtilized()}
                            {renderSitePhotos()}
                        </div>
                    )}

                    {/* IF PROJECT DETAILS UPDATE: Show timelines and documents */}
                    {!formData.hasVariationOrder && !formData.isRealignment && formData.isProjectDetailsUpdate && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {renderTimelineAndFunds()}
                            {renderFundsSection()}
                            {renderProcurementMilestones()}
                            {renderDocumentUploads()}
                        </div>
                    )}

                    {/* IF VARIATION ORDER: Show creation fields in Amber Container */}
                    {formData.hasVariationOrder && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 bg-amber-50/50 p-4 sm:p-6 rounded-[2rem] border border-amber-200 shadow-inner">
                            {renderVariationOrderHeader()}
                            <div className="space-y-6">
                                {renderProjectDetails()}
                                {/* {renderStatusAndProgress()} */}
                                {renderFundsUtilized()}

                                {renderTimelineAndFunds()}
                                {renderProcurementMilestones()}
                                {renderLocation()}
                                {(formData.province || formData.municipality || formData.userRole === 'Local Government Unit') && renderLguDetails()}
                            </div>
                        </div>
                    )}

                    {/* IF REALIGNMENT: Show realignment fields */}
                    {formData.isRealignment && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {renderRealignmentTab()}
                        </div>
                    )}



                    {/* LOCATION REMOVED PER USER REQUEST */}

                    {mode === 'quick' && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status Date</label>
                            <input
                                type="date"
                                name="statusAsOfDate"
                                value={formData.statusAsOfDate}
                                onChange={handleChange}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                max={new Date().toISOString().split('T')[0]}
                            />
                        </div>
                    )}

                    {/* CHECK: Conditional Actual Completion Date for Completed Status */}
                    {mode === 'quick' && formData.status === ProjectStatus.Completed && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-4 duration-300">
                            <div className="flex justify-between items-center ml-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Actual Completion Date</label>
                                {formData.actualCompletionDate && formData.targetCompletionDate && new Date(formData.actualCompletionDate) > new Date(formData.targetCompletionDate) && (
                                    <span className="text-[9px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded border border-red-100 uppercase tracking-widest animate-pulse">
                                        ⚠️ Late Completion
                                    </span>
                                )}
                            </div>
                            <input
                                type="date"
                                name="actualCompletionDate"
                                value={formData.actualCompletionDate || ""}
                                onChange={handleChange}
                                className={`w-full p-3 border rounded-2xl text-sm font-bold shadow-sm transition-all outline-none ${formData.actualCompletionDate && formData.targetCompletionDate && new Date(formData.actualCompletionDate) > new Date(formData.targetCompletionDate)
                                    ? "bg-red-50 border-red-200 text-red-700 focus:ring-2 focus:ring-red-200"
                                    : "bg-emerald-50 border-emerald-200 text-emerald-700 focus:ring-2 focus:ring-emerald-200"
                                    }`}
                            />
                            <p className="text-[9px] text-slate-400 ml-1 italic">
                                Target was: {formatDateShort(formData.targetCompletionDate)}
                            </p>
                        </div>
                    )}

                    {/* --- TIMELINE DELAY TRACKING (EFD DEPED PROCESS) --- */}
                    {(mode === 'quick' || mode === 'full') &&
                        !['Completed', 'For Final Inspection'].includes(formData.status) &&
                        formData.targetCompletionDate &&
                        new Date() > new Date(formData.targetCompletionDate) && (
                            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl space-y-3 animate-in fade-in zoom-in duration-500">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xl">⏳</span>
                                    <div>
                                        <h3 className="text-xs font-bold text-red-700 uppercase">Timeline Delay Tracking</h3>
                                        <p className="text-[9px] text-red-600 font-medium">Project has exceeded its original target completion date.</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-red-500 uppercase mb-1">Time Lapsed (Days)</label>
                                        <div className="p-3 bg-white border border-red-100 rounded-xl text-sm font-black text-red-700 shadow-sm">
                                            {Math.floor((new Date() - new Date(formData.targetCompletionDate)) / (1000 * 60 * 60 * 24))} Days
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-red-500 uppercase mb-1">Time Lapsed (%)</label>
                                        <div className="p-3 bg-white border border-red-100 rounded-xl text-sm font-black text-red-700 shadow-sm">
                                            {formData.accomplishmentPercentage || 0}%
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-bold text-red-500 uppercase">Reason for Delay <span className="text-red-600">*</span></label>
                                    <textarea
                                        name="delay_reason"
                                        value={formData.delay_reason || ""}
                                        onChange={handleChange}
                                        placeholder="Explain why the project is delayed (EFD DepEd requirement)..."
                                        rows="2"
                                        className="w-full p-3 bg-white border border-red-200 rounded-xl text-sm focus:ring-2 focus:ring-red-400 outline-none transition-all placeholder:text-red-200 shadow-inner"
                                        required={new Date() > new Date(formData.targetCompletionDate)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-bold text-red-500 uppercase">Revised Target Completion Date</label>
                                    <input
                                        type="date"
                                        name="revised_target_completion_date"
                                        value={formData.revised_target_completion_date || ""}
                                        onChange={handleChange}
                                        min={new Date().toISOString().split('T')[0]}
                                        className="w-full p-3 bg-white border border-red-200 rounded-xl text-sm font-bold text-red-700 focus:ring-2 focus:ring-red-400 outline-none"
                                    />
                                </div>
                            </div>
                        )}

                    {/* (mode === 'full' || mode === 'quick') Remarks */}
                    {(mode === 'full' || mode === 'quick') && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Remarks / Update Context</label>
                            <textarea
                                name="otherRemarks"
                                value={formData.otherRemarks || ""}
                                onChange={handleChange}
                                rows={mode === 'quick' ? 2 : 3}
                                placeholder="Enter site observations or issues..."
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                            />
                        </div>
                    )}

                </div>

                {/* --- FOOTER --- */}
                <div className="p-6 border-t border-slate-100 flex gap-4 bg-white">
                    <button
                        onClick={onClose}
                        className={`flex-1 py-4 text-slate-500 font-black text-xs uppercase tracking-widest bg-slate-100 rounded-2xl hover:bg-slate-200 transition-colors ${readOnly ? 'w-full' : ''}`}
                    >
                        {readOnly ? 'Close' : 'Cancel'}
                    </button>
                    {!readOnly && (
                        <button
                            onClick={async () => {
                                // REALIGNMENT SUBMISSION
                                if (formData.isRealignment) {
                                    if (!realignmentForm.targetIpc) {
                                        alert("⚠️ MISSING FIELD\n\nPlease select a target project.");
                                        return;
                                    }

                                    // Trigger realignment API
                                    setIsSubmittingRealignment(true);
                                    try {
                                        const res = await fetch(api(`/api/projects/realign`), {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                sourceProjectId: project.id,
                                                ...realignmentForm
                                            })
                                        });

                                        if (!res.ok) throw new Error("Realignment failed");

                                        alert("✅ SUCCESS\n\nProject realignment completed successfully.");
                                        onClose(); // Close modal on success
                                    } catch (err) {
                                        alert("❌ ERROR\n\nFailed to process realignment: " + err.message);
                                    } finally {
                                        setIsSubmittingRealignment(false);
                                    }
                                    return;
                                }

                                // CONTRACT AMOUNT VALIDATION
                                const abcAmt = Number(formData.approved_budget_for_contract?.toString().replace(/,/g, '') || 0);
                                const contractAmt = Number(formData.contract_amount?.toString().replace(/,/g, '') || 0);
                                if (contractAmt > abcAmt) {
                                    alert("⚠️ INVALID AMOUNT\n\nContract Amount must be equal to or less than the Approved Budget for Contract (ABC).");
                                    return;
                                }

                                // VALIDATION
                                if (formData.hasVariationOrder) {
                                    // Mandate VO PDF
                                    if (!documents.VO && !formData.variationOrderPdf) {
                                        alert("⚠️ DOCUMENT REQUIRED\n\nVariation Order updates MUST include the VO document (PDF).");
                                        return;
                                    }
                                } else {
                                    const requiredFields = [
                                        { key: 'statusAsOfDate', label: 'Status Date' },
                                        { key: 'accomplishmentPercentage', label: 'Accomplishment %' }
                                    ];

                                    for (const field of requiredFields) {
                                        if (formData[field.key] === "" || formData[field.key] === null || formData[field.key] === undefined) {
                                            alert(`⚠️ MISSING FIELD\n\nPlease enter the ${field.label}.`);
                                            return;
                                        }
                                    }
                                }

                                // Mandate Photos for Ongoing/Completed statuses (Exempt VO and Realignment)
                                const isRequiredStatus = [ProjectStatus.Ongoing, ProjectStatus.ForFinalInspection, ProjectStatus.Completed].includes(formData.status);
                                const hasPhotos = (internalPreviews?.length || 0) > 0 || (externalPreviews?.length || 0) > 0;
                                const canSkipPhotos = formData.hasVariationOrder || formData.isRealignment || formData.isProjectDetailsUpdate;

                                if (isRequiredStatus && !hasPhotos && !canSkipPhotos) {
                                    alert(`⚠️ PROOF REQUIRED\n\nAccording to COA requirements, you must attach at least one site photo for projects in ${formData.status} status.`);
                                    return;
                                }

                                // CONVERT DOCUMENTS (Replacing Base64 with Chunked Uploads to Cloud)
                                const finalData = { ...formData };

                                const processDoc = async (docKey, destinationKey) => {
                                    if (documents[docKey]) {
                                        try {
                                            const cloudUrl = await uploadFileInChunks(documents[docKey]);
                                            if (cloudUrl) finalData[destinationKey] = cloudUrl;
                                        } catch (e) {
                                            console.error(`Failed to upload chunked doc: ${docKey}`, e);
                                        }
                                    }
                                };

                                await processDoc('POW', 'pow_pdf');
                                await processDoc('DUPA', 'dupa_pdf');
                                await processDoc('CONTRACT', 'contract_pdf');
                                await processDoc('VO', 'variationOrderPdf');

                                // New VO Documents
                                await processDoc('RevisedPOW', 'revised_pow_pdf');
                                await processDoc('RevisedDUPA', 'revised_dupa_pdf');
                                await processDoc('RevisedContract', 'revised_contract_pdf');
                                await processDoc('RTA', 'rta_pdf');
                                await processDoc('MOA', 'moa_pdf');

                                // Ensure delay tracking values are explicitly included for persistence
                                if (new Date() > new Date(formData.targetCompletionDate)) {
                                    finalData.time_lapsed_percentage = formData.accomplishmentPercentage || 0;
                                    finalData.time_lapsed_days = Math.floor((new Date() - new Date(formData.targetCompletionDate)) / (1000 * 60 * 60 * 24));
                                    finalData.delay_reason = formData.delay_reason || formData.remarks || "";
                                    finalData.revised_target_completion_date = formData.targetCompletionDate;
                                }

                                // Determine Update Type for tracking
                                let updateType = 'Details Update';
                                if (!formData.isProjectDetailsUpdate) updateType = 'Status Update';
                                if (formData.hasVariationOrder) updateType = 'Variation Order';
                                if (formData.isRealignment) updateType = 'Realignment';

                                // Ensure procurement_status is explicitly set in final payload if it exists in formData
                                const savePayload = { 
                                    ...finalData, 
                                    update_type: updateType, 
                                    actions: updateType 
                                };
                                
                                if (formData.procurement_status) {
                                    savePayload.procurement_status = formData.procurement_status;
                                }

                                onSave(savePayload);
                            }}
                            disabled={isUploading || isSubmittingRealignment}
                            className="flex-[2] py-4 text-white font-black text-xs uppercase tracking-widest bg-gradient-to-r from-[#004A99] to-[#003366] rounded-2xl shadow-xl shadow-blue-900/20 disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                        >
                            {(isUploading || isSubmittingRealignment) ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Syncing Data...
                                </>
                            ) : "Confirm & Save"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EditProjectModal;
