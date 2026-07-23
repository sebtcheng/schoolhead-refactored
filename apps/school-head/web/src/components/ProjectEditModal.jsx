import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiCheck, FiChevronRight, FiLock, FiUnlock } from 'react-icons/fi';
import LocationPickerMap from './LocationPickerMap';
import { api } from "../lib/api";


/**
 * ProjectEditModal
 * ----------------
 * A single modal with 3 tabs: Details (multi-step form), VO, Realign.
 * Opened from DetailedProjInfo via one "Edit" button.
 */

const DETAILS_STEPS = [
    { id: 1, label: "Info", icon: "🏫", desc: "Project name, school & classification" },
    { id: 2, label: "Contract", icon: "📋", desc: "Bidding milestones & contract" },
    { id: 3, label: "Finance", icon: "💰", desc: "Costs & contractor details" },
    { id: 4, label: "Location", icon: "📍", desc: "Coordinates & address" },
    { id: 5, label: "Docs", icon: "📂", desc: "Upload POW, DUPA & Contract PDF" },
];

const STATUS_OPTIONS = [
    { value: "Not Yet Started", label: "Not Yet Started", icon: "⏸️", color: "slate" },
    { value: "Under Procurement", label: "Under Procurement", icon: "📋", color: "amber" },
    { value: "Ongoing", label: "Ongoing", icon: "🔧", color: "blue" },
    { value: "For Final Inspection", label: "For Final Inspection", icon: "🔍", color: "purple" },
    { value: "Completed", label: "Completed", icon: "✅", color: "emerald" },
];

const PROJECT_CATEGORIES = [
    "New Construction", "Repair and Rehab", "Last Mile Schools", "Health facilities",
    "Gabaldon Restoration", "Library Hub",
    "SpEd Inclusive Learning Resource Centers (ILRC)",
    "Alternative Learning System - Community Based Learning Centers (ALS-CLC)",
    "Midrise School Building", "QRF", "Electrification"
];

const colorMap = {
    slate: { bg: "bg-slate-50", border: "border-slate-300", text: "text-slate-700" },
    amber: { bg: "bg-amber-50", border: "border-amber-400", text: "text-amber-700" },
    blue: { bg: "bg-blue-50", border: "border-blue-500", text: "text-blue-700" },
    purple: { bg: "bg-purple-50", border: "border-purple-500", text: "text-purple-700" },
    emerald: { bg: "bg-emerald-50", border: "border-emerald-500", text: "text-emerald-700" },
};

// ---- Shared Input style ----
const inputCls = "w-full p-3 rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-100 outline-none transition-all";
const labelCls = "block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5";

const Field = ({ label, children }) => (
    <div>
        <label className={labelCls}>{label}</label>
        {children}
    </div>
);

// ---- Main Modal ----
const ProjectEditModal = ({ project, isOpen, onClose, onSaveDetails, onSaveVO, onSaveRealign }) => {
    const [activeTab, setActiveTab] = useState('vo'); // 'vo' | 'realign'
    const [detailsStep, setDetailsStep] = useState(1);
    const [formData, setFormData] = useState({});
    const [voForm, setVoForm] = useState({});
    const [realignForm, setRealignForm] = useState({});
    const [realignCandidates, setRealignCandidates] = useState([]);
    const [isFetchingCandidates, setIsFetchingCandidates] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [documentFiles, setDocumentFiles] = useState({ POW: null, DUPA: null, CONTRACT: null });
    const [internalFiles, setInternalFiles] = useState([]);
    const [externalFiles, setExternalFiles] = useState([]);
    const [activePhotoCategory, setActivePhotoCategory] = useState('Internal');
    const [isCheckingSchool, setIsCheckingSchool] = useState(false);
    const [isSchoolChecked, setIsSchoolChecked] = useState(false);
    const [isLocationEditing, setIsLocationEditing] = useState(false);

    // Reset map lock whenever the modal closes
    useEffect(() => {
        if (!isOpen) setIsLocationEditing(false);
    }, [isOpen]);
    const [lookupOptions, setLookupOptions] = useState({ provinces: [], municipalities: [], legDistricts: [], fundingYears: [] });
    const bodyRef = useRef(null);
    const internalInputRef = useRef(null);
    const externalInputRef = useRef(null);

    useEffect(() => {
        if (isOpen && project) {
            setActiveTab('vo');
            setDetailsStep(1);
            setDocumentFiles({ POW: null, DUPA: null, CONTRACT: null });
            setInternalFiles([]);
            setExternalFiles([]);
            setActivePhotoCategory('Internal');
            setFormData({
                status: project.status || '',
                accomplishmentPercentage: Number(project.accomplishmentPercentage || 0),
                statusAsOf: project.statusAsOf || new Date().toISOString(),
                actualCompletionDate: project.actualCompletionDate || '',
                otherRemarks: project.otherRemarks || '',
                // Project Info
                projectName: project.projectName || '',
                schoolId: project.schoolId || '',
                schoolName: project.schoolName || '',
                projectCategory: project.projectCategory || '',
                program_type: project.program_type || '',
                funding_year: project.funding_year || project.fundingYear || '',
                batchOfFunds: project.batchOfFunds || '',
                numberOfClassrooms: project.numberOfClassrooms || '',
                numberOfStoreys: project.numberOfStoreys || '',
                numberOfSites: project.numberOfSites || '',
                scopeOfWork: project.scopeOfWork || '',
                // Contract
                contractId: project.contractId || project.contract_id || '',
                contractorName: project.contractorName || '',
                noticeToProceed: project.noticeToProceed || '',
                constructionStartDate: project.constructionStartDate || '',
                targetCompletionDate: project.targetCompletionDate || '',
                issuance_of_invitation_to_bid: project.issuance_of_invitation_to_bid || '',
                pre_bid_conference: project.pre_bid_conference || '',
                opening_of_technical_proposal: project.opening_of_technical_proposal || '',
                opening_of_financial_proposal: project.opening_of_financial_proposal || '',
                date_notice_of_award: project.date_notice_of_award || '',
                // Finance
                projectAllocation: project.projectAllocation || '',
                contractAmount: project.contractAmount || project.contract_amount || '',
                fundsUtilized: project.fundsUtilized || '',
                implementing_agency: project.implementing_agency || '',
                // Location
                latitude: project.latitude || '',
                longitude: project.longitude || '',
                province: project.province || '',
                municipality: project.municipality || '',
                legislative_district: project.legislative_district || '',
            });
            setVoForm({
                vo_type: 'Combined',
                vo_number: '',
                additive_amount: '',
                deductive_amount: '',
                time_extension_days: '',
                vo_requested_date: new Date().toISOString().split('T')[0],
                justification_details: '',
            });
            setRealignForm({ targetIpc: '', justification: '' });
            setRealignCandidates([]);
            setIsSchoolChecked(!!project.schoolId);
            
            // Load initial dropdown options
            fetch(api(`/reference/funding-years`)).then(r => r.json()).then(years => setLookupOptions(prev => ({ ...prev, fundingYears: years }))).catch(() => {});
            
            if (project.province) {
                // If we have a province, maybe try to load its municipalities if needed, 
                // but usually for edit we just show existing text. 
                // For the "Check School" flow we want them as dropdowns.
            }
        }
    }, [isOpen, project?.id]);

    // Scroll body to top on tab or step change
    useEffect(() => { bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }, [activeTab, detailsStep]);

    // Fetch realignment candidates when Realign tab is opened
    useEffect(() => {
        if (activeTab === 'realign' && project && realignCandidates.length === 0) {
            setIsFetchingCandidates(true);
            fetch(api(`/projects?category=${encodeURIComponent(project.projectCategory || '')}&district=${encodeURIComponent(project.legislative_district || project.division || '')}`))
                .then(r => r.json())
                .then(data => setRealignCandidates(Array.isArray(data) ? data.filter(p => p.id !== project.id) : []))
                .catch(() => setRealignCandidates([]))
                .finally(() => setIsFetchingCandidates(false));
        }
    }, [activeTab]);

    if (!isOpen || !project) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(p => ({ ...p, [name]: value }));
    };

    const currentStatusOpt = STATUS_OPTIONS.find(s => s.value === formData.status) || STATUS_OPTIONS[0];
    const statusColors = colorMap[currentStatusOpt.color];

    const handleSaveDetails = async () => {
        setIsSaving(true);
        try {
            const formDataToSubmit = new FormData();
            
            // Append all JSON data fields
            Object.keys(formData).forEach(key => {
                if (formData[key] !== null && formData[key] !== undefined) {
                    formDataToSubmit.append(key, formData[key]);
                }
            });

            // Append ID and identification fields explicitly for clarity
            formDataToSubmit.append('id', project.id);
            formDataToSubmit.append('ipc', project.ipc);
            formDataToSubmit.append('uid', localStorage.getItem('uid') || '');
            formDataToSubmit.append('update_type', 'Details Update');

            // Append Document Files (POW, DUPA, Contract)
            if (documentFiles.POW) {
                formDataToSubmit.append('pow_pdf', documentFiles.POW);
                formDataToSubmit.append('pow_filename', documentFiles.POW.name);
            }
            if (documentFiles.DUPA) {
                formDataToSubmit.append('dupa_pdf', documentFiles.DUPA);
                formDataToSubmit.append('dupa_filename', documentFiles.DUPA.name);
            }
            if (documentFiles.CONTRACT) {
                formDataToSubmit.append('contract_pdf', documentFiles.CONTRACT);
                formDataToSubmit.append('contract_filename', documentFiles.CONTRACT.name);
            }

            // Pass Site Images separately for orchestration in the callback
            const siteImages = [
                ...internalFiles.map(f => ({ file: f, category: 'Internal' })),
                ...externalFiles.map(f => ({ file: f, category: 'External' }))
            ];

            await onSaveDetails(formDataToSubmit, siteImages);
        } catch (err) {
            console.error("Save Error:", err);
            alert("Failed to save details. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSingleUpload = async (docKey) => {
        if (!documentFiles[docKey]) return;
        setIsSaving(true);
        try {
            const formDataToSubmit = new FormData();
            formDataToSubmit.append('id', project.id);
            formDataToSubmit.append('ipc', project.ipc);
            formDataToSubmit.append('uid', localStorage.getItem('uid') || '');
            formDataToSubmit.append('update_type', `Upload ${docKey}`);
            
            const fieldName = docKey === 'POW' ? 'pow_pdf' : docKey === 'DUPA' ? 'dupa_pdf' : 'contract_pdf';
            const filenameField = docKey.toLowerCase() + '_filename';
            
            formDataToSubmit.append(fieldName, documentFiles[docKey]);
            formDataToSubmit.append(filenameField, documentFiles[docKey].name);

            await onSaveDetails(formDataToSubmit, []);
            setDocumentFiles(p => ({ ...p, [docKey]: null }));
        } catch (err) {
            console.error("Upload Error:", err);
            alert(`Failed to upload ${docKey}. Please try again.`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveVO = async () => {
        setIsSaving(true);
        try {
            await onSaveVO({ ...project, ...voForm, update_type: 'VO' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveRealign = async () => {
        if (!realignForm.targetIpc) { alert('Please select a target project.'); return; }
        setIsSaving(true);
        try {
            await onSaveRealign({ ...project, ...realignForm, update_type: 'Realignment' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCheckSchool = async () => {
        const schoolId = formData.schoolId;
        if (!schoolId || schoolId.length !== 6) {
            alert("Please enter a valid 6-digit School ID.");
            return;
        }

        setIsCheckingSchool(true);
        try {
            const response = await fetch(api(`/schools_iern/${schoolId}`));
            
            if (response.status === 404) {
                alert("School ID not found. Please contact us in support.stride@deped.gov.ph");
                setIsCheckingSchool(false);
                return;
            }

            const result = await response.json();

            if (result.exists && result.data) {
                const data = result.data;
                const newSchoolName = data.School_Name || data.SchoolName || data.school_name || formData.schoolName;
                const region = data.Region || data.region;

                setFormData(prev => ({
                    ...prev,
                    schoolName: newSchoolName,
                    latitude: data.Latitude || data.latitude || prev.latitude,
                    longitude: data.Longitude || data.longitude || prev.longitude,
                    province: data.Province || data.province || prev.province,
                    municipality: data.Municipality || data.municipality || prev.municipality,
                    legislative_district: data.Legislative_District || data.LegislativeDistrict || data.legislative_district || prev.legislative_district,
                }));
                setIsSchoolChecked(true);

                // Fetch options for dropdowns based on the found school's region/province
                if (region) {
                    const province = data.Province || data.province;
                    Promise.all([
                        fetch(api(`/locations/provinces?region=${encodeURIComponent(region)}`)).then(r => r.json()),
                        fetch(api(`/locations/leg-districts?region=${encodeURIComponent(region)}`)).then(r => r.json()),
                        fetch(api(`/locations/municipalities-by-province?region=${encodeURIComponent(region)}&province=${encodeURIComponent(province || '')}`)).then(r => r.json())
                    ]).then(([provinces, legDistricts, municipalities]) => {
                        const pOpts = provinces || [];
                        const lOpts = legDistricts || [];
                        const mOpts = municipalities || [];
                        if (region === 'BLANK REGION') {
                            if (!pOpts.includes('BLANK PROVINCE')) pOpts.unshift('BLANK PROVINCE');
                            if (!lOpts.includes('BLANK LEGISLATIVE DISTRICT')) lOpts.unshift('BLANK LEGISLATIVE DISTRICT');
                        }
                        if (province === 'BLANK PROVINCE' && !mOpts.includes('BLANK MUNICIPALITY')) mOpts.unshift('BLANK MUNICIPALITY');
                        setLookupOptions(prev => ({ ...prev, provinces: pOpts, legDistricts: lOpts, municipalities: mOpts }));
                    }).catch(err => console.error("Error fetching location options:", err));
                }
            } else {
                alert("School ID not found. Please contact us in support.stride@deped.gov.ph");
            }
        } catch (error) {
            console.error("Check School Error:", error);
            alert("Failed to fetch school details. Please check your connection.");
        } finally {
            setIsCheckingSchool(false);
        }
    };

    // ---- Details Steps renderer ----
    const renderDetailsStep = () => {
        switch (detailsStep) {
            // STEP 1: PROJECT INFO
            case 1:
                return (
                    <div className="space-y-4">
                        <Field label="Project Name">
                            <input name="projectName" value={formData.projectName} onChange={handleChange} className={inputCls} placeholder="Project name" />
                        </Field>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label="School ID">
                                <div className="relative">
                                    <input 
                                        name="schoolId" 
                                        value={formData.schoolId} 
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                                            setFormData(p => ({ ...p, schoolId: val }));
                                        }} 
                                        className={inputCls + " pr-24"} 
                                        placeholder="6-digit ID"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleCheckSchool}
                                        disabled={isCheckingSchool || formData.schoolId?.length !== 6}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-sm"
                                    >
                                        {isCheckingSchool ? '...' : 'Check'}
                                    </button>
                                </div>
                            </Field>
                            <Field label="School Name">
                                <input 
                                    name="schoolName" 
                                    value={formData.schoolName} 
                                    onChange={handleChange} 
                                    className={`${inputCls} ${isSchoolChecked ? 'bg-slate-50 text-slate-500 cursor-not-allowed border-dashed' : ''}`} 
                                    placeholder="School name" 
                                    disabled={isSchoolChecked}
                                />
                                {isSchoolChecked && <p className="text-[9px] text-blue-500 font-bold mt-1 uppercase tracking-tighter">✓ Locked via Registry</p>}
                            </Field>
                        </div>
                        <Field label="Category">
                            <select name="projectCategory" value={formData.projectCategory} onChange={handleChange} className={inputCls}>
                                <option value="">Select Category...</option>
                                {PROJECT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </Field>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label="Program Type">
                                <select name="program_type" value={formData.program_type} onChange={handleChange} className={inputCls}>
                                    <option value="">Select...</option>
                                    <option>BEFF</option><option>GAA</option><option>Donated</option><option>LGU</option>
                                </select>
                            </Field>
                            <Field label="Funding Year">
                                <select name="funding_year" value={formData.funding_year} onChange={handleChange} className={inputCls}>
                                    <option value="">Select Year...</option>
                                    {lookupOptions.fundingYears.length > 0 ? (
                                        lookupOptions.fundingYears.map(y => <option key={y} value={y}>{y}</option>)
                                    ) : (
                                        [2021, 2022, 2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)
                                    )}
                                </select>
                            </Field>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <Field label="Classrooms">
                                <input type="number" name="numberOfClassrooms" value={formData.numberOfClassrooms} onChange={handleChange} className={inputCls} />
                            </Field>
                            <Field label="Storeys">
                                <input type="number" name="numberOfStoreys" value={formData.numberOfStoreys} onChange={handleChange} className={inputCls} />
                            </Field>
                            <Field label="Sites">
                                <input type="number" name="numberOfSites" value={formData.numberOfSites} onChange={handleChange} className={inputCls} />
                            </Field>
                        </div>
                        <Field label="Scope of Work">
                            <textarea name="scopeOfWork" rows={3} value={formData.scopeOfWork} onChange={handleChange} className={inputCls + " resize-none"} placeholder="Brief scope description..." />
                        </Field>
                    </div>
                );

            // STEP 2: CONTRACT
            case 2:
                return (
                    <div className="space-y-4">
                        <div>
                            <p className={labelCls}>Construction Phase Status</p>
                            <div className="space-y-2">
                                {STATUS_OPTIONS.map(opt => {
                                    const c = colorMap[opt.color];
                                    const sel = formData.status === opt.value;
                                    return (
                                        <button key={opt.value}
                                            onClick={() => {
                                                const updates = { status: opt.value };
                                                if (['Not Yet Started', 'Under Procurement'].includes(opt.value)) {
                                                    // Remove automatic status reset to 'Not Yet Started' to allow placeholder
                                                    // updates.accomplishmentPercentage = 0;
                                                }
                                                else if (['For Final Inspection', 'Completed'].includes(opt.value)) updates.accomplishmentPercentage = 100;
                                                setFormData(p => ({ ...p, ...updates }));
                                            }}
                                            className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-all ${sel ? `${c.bg} ${c.border}` : 'bg-white border-slate-100 hover:border-slate-200'}`}
                                        >
                                            <span className="text-lg">{opt.icon}</span>
                                            <span className={`flex-1 text-xs font-black ${sel ? c.text : 'text-slate-600'}`}>{opt.label}</span>
                                            {sel && <FiCheck size={16} className={c.text} />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {!['Not Yet Started', 'Under Procurement'].includes(formData.status) && (
                            <div className={`p-4 rounded-2xl border ${statusColors.bg} ${statusColors.border}`}>
                                <div className="flex items-center justify-between mb-3">
                                    <p className={`text-[10px] font-black uppercase tracking-widest ${statusColors.text}`}>Accomplishment %</p>
                                    <span className={`text-2xl font-black tabular-nums ${statusColors.text}`}>{formData.accomplishmentPercentage}%</span>
                                </div>
                                <input type="range" min="0" max="100"
                                    value={formData.accomplishmentPercentage}
                                    onChange={e => setFormData(p => ({ ...p, accomplishmentPercentage: Number(e.target.value) }))}
                                    disabled={['Completed', 'For Final Inspection'].includes(formData.status)}
                                    className="w-full accent-blue-600"
                                />
                                <div className="flex justify-between text-[9px] text-slate-400 font-bold mt-1">
                                    {['0%', '25%', '50%', '75%', '100%'].map(l => <span key={l}>{l}</span>)}
                                </div>
                            </div>
                        )}

                        {formData.status === 'Completed' && (
                            <Field label="Actual Completion Date *">
                                <input type="date" name="actualCompletionDate" value={formData.actualCompletionDate} onChange={handleChange}
                                    className={inputCls + " border-emerald-200 bg-emerald-50/40 focus:ring-emerald-100"} />
                            </Field>
                        )}

                        <Field label="Status As Of Date">
                            <input 
                                type="date" 
                                name="statusAsOf" 
                                value={formData.statusAsOf ? formData.statusAsOf.split('T')[0] : ''} 
                                onChange={e => {
                                    const datePart = e.target.value;
                                    const timePart = new Date().toISOString().split('T')[1];
                                    setFormData(p => ({ ...p, statusAsOf: `${datePart}T${timePart}` }));
                                }} 
                                className={inputCls} 
                            />
                        </Field>

                        <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 space-y-3">
                            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Bidding Milestones</p>
                            <div className="grid grid-cols-1 gap-3">
                                {[
                                    { label: "Invitation to Bid", name: "issuance_of_invitation_to_bid" },
                                    { label: "Pre-Bid Conference", name: "pre_bid_conference" },
                                    { label: "Opening of Tech. Proposal", name: "opening_of_technical_proposal" },
                                    { label: "Opening of Fin. Proposal", name: "opening_of_financial_proposal" },
                                    { label: "Notice of Award (NOA)", name: "date_notice_of_award" },
                                ].map(f => (
                                    <Field key={f.name} label={f.label}>
                                        <input type="date" name={f.name} value={formData[f.name]} onChange={handleChange} className={inputCls} />
                                    </Field>
                                ))}
                            </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                            <p className="text-[8px] font-black tracking-widest text-slate-400 mb-1">CONTRACT DETAILS</p>
                            <Field label="Contract ID">
                                <input name="contractId" value={formData.contractId} onChange={handleChange} className={inputCls} placeholder="Contract reference number" />
                            </Field>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Field label="Notice to Proceed (NTP)">
                                    <input type="date" name="noticeToProceed" value={formData.noticeToProceed} onChange={handleChange} className={inputCls} />
                                </Field>
                                <Field label="Construction Start">
                                    <input type="date" name="constructionStartDate" value={formData.constructionStartDate} onChange={handleChange} className={inputCls} />
                                </Field>
                            </div>
                            <Field label="Target Completion Date">
                                <input type="date" name="targetCompletionDate" value={formData.targetCompletionDate} onChange={handleChange} className={inputCls} />
                            </Field>
                            <Field label="Contractor Name">
                                <input name="contractorName" value={formData.contractorName} onChange={handleChange} className={inputCls} placeholder="Contractor or supplier name" />
                            </Field>
                        </div>
                    </div>
                );

            // STEP 3: FINANCE
            case 3:
                return (
                    <div className="space-y-4">
                        <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 space-y-3">
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Financial Records</p>
                            {[
                                { label: "Approved Budget (ABC)", name: "projectAllocation", ph: "0.00" },
                                { label: "Contract Amount", name: "contractAmount", ph: "0.00" },
                                { label: "Funds Utilized", name: "fundsUtilized", ph: "0.00" },
                            ].map(f => (
                                <Field key={f.name} label={f.label}>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">₱</span>
                                        <input type="text" name={f.name} value={formData[f.name]} onChange={handleChange}
                                            className={inputCls + " pl-7"} placeholder={f.ph} />
                                    </div>
                                </Field>
                            ))}
                        </div>
                        <Field label="Implementing Agency">
                            <input name="implementing_agency" value={formData.implementing_agency} onChange={handleChange} className={inputCls} />
                        </Field>
                    </div>
                );

            // STEP 4: LOCATION
            case 4:
                return (
                    <div className="space-y-4">
                        <div className={`rounded-2xl border-2 overflow-hidden bg-slate-50 shadow-sm transition-all ${isLocationEditing ? 'border-amber-300' : 'border-slate-100 hover:border-slate-200'}`}>
                            <div className="p-2.5 bg-white border-b border-slate-100 flex items-center justify-between">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">📍 Site Map Picker</span>
                                <button
                                    type="button"
                                    onClick={() => setIsLocationEditing(prev => !prev)}
                                    className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                                        isLocationEditing
                                            ? 'bg-amber-50 border-amber-300 text-amber-600 shadow-sm shadow-amber-200'
                                            : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-blue-200 hover:text-blue-500'
                                    }`}
                                >
                                    {isLocationEditing ? <FiUnlock size={11} /> : <FiLock size={11} />}
                                    {isLocationEditing ? 'Editing' : 'Edit Location'}
                                </button>
                            </div>
                            <div className="h-[280px]">
                                <LocationPickerMap
                                    latitude={formData.latitude}
                                    longitude={formData.longitude}
                                    onChange={(lat, lng) => {
                                        setFormData(prev => ({ ...prev, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }));
                                    }}
                                    disabled={!isLocationEditing}
                                    className="h-full border-none rounded-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label="Latitude">
                                <input type="text" name="latitude" value={formData.latitude} onChange={handleChange} className={inputCls + " font-mono"} placeholder="e.g. 14.5995" />
                            </Field>
                            <Field label="Longitude">
                                <input type="text" name="longitude" value={formData.longitude} onChange={handleChange} className={inputCls + " font-mono"} placeholder="e.g. 120.9842" />
                            </Field>
                        </div>
                        <Field label="Province">
                            {lookupOptions.provinces.length > 0 ? (
                                <select name="province" value={formData.province} onChange={handleChange} className={inputCls}>
                                    <option value="">Select Province...</option>
                                    {lookupOptions.provinces.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            ) : (
                                <input name="province" value={formData.province} onChange={handleChange} className={inputCls} placeholder="Province" />
                            )}
                        </Field>
                        <Field label="Municipality / City">
                            {lookupOptions.municipalities.length > 0 ? (
                                <select name="municipality" value={formData.municipality} onChange={handleChange} className={inputCls}>
                                    <option value="">Select Municipality...</option>
                                    {lookupOptions.municipalities.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            ) : (
                                <input name="municipality" value={formData.municipality} onChange={handleChange} className={inputCls} placeholder="Municipality / City" />
                            )}
                        </Field>
                        <Field label="Legislative District">
                            {lookupOptions.legDistricts.length > 0 ? (
                                <select name="legislative_district" value={formData.legislative_district} onChange={handleChange} className={inputCls}>
                                    <option value="">Select District...</option>
                                    {lookupOptions.legDistricts.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            ) : (
                                <input name="legislative_district" value={formData.legislative_district} onChange={handleChange} className={inputCls} placeholder="Legislative District" />
                            )}
                        </Field>
                    </div>
                );

            // STEP 5: DOCUMENTATION
            case 5: {
                const DOCS = [
                    { key: 'POW', label: 'Program of Works / POW', icon: '📐', desc: 'Upload the Program of Works or Progress of Work PDF', hasExisting: project.hasPow || project.pow_pdf, existingName: project.pow_filename },
                    { key: 'DUPA', label: 'DUPA', icon: '📊', desc: 'Detailed Unit Price Analysis document', hasExisting: project.hasDupa || project.dupa_pdf, existingName: project.dupa_filename },
                    { key: 'CONTRACT', label: 'Signed Contract', icon: '✍️', desc: 'Signed Contract Agreement / Agreement Document', hasExisting: project.hasContract || project.contract_pdf, existingName: project.contract_filename },
                ];
                return (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                            <span className="text-2xl">📂</span>
                            <div>
                                <p className="text-xs font-black text-slate-700">Project Documents</p>
                                <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">Upload or replace the POW, DUPA, and Signed Contract PDFs for this project. Now available at any stage.</p>
                            </div>
                        </div>
                        {DOCS.map(doc => (
                            <div key={doc.key} className={`p-4 rounded-2xl border-2 transition-all ${ documentFiles[doc.key] ? 'border-blue-300 bg-blue-50/40' : 'border-slate-100 bg-white hover:border-slate-200' }`}>
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="text-xl">{doc.icon}</span>
                                    <div className="flex-1">
                                        <p className="text-xs font-black text-slate-800">{doc.label}</p>
                                        <p className="text-[9px] text-slate-400 leading-tight">{doc.desc}</p>
                                    </div>
                                    {doc.hasExisting && !documentFiles[doc.key] && (
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full text-[8px] font-black uppercase tracking-wide">✓ On File</span>
                                            {doc.existingName && <span className="text-[8px] text-slate-400 font-bold truncate max-w-[100px]">{doc.existingName}</span>}
                                        </div>
                                    )}
                                    {documentFiles[doc.key] && (
                                        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-full text-[8px] font-black uppercase tracking-wide">New File Selected</span>
                                    )}
                                </div>
                                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border bg-white ${ documentFiles[doc.key] ? 'border-blue-200' : 'border-slate-100' }`}>
                                    <span className="text-slate-300 text-xs">📄</span>
                                    <input
                                        type="file"
                                        accept="application/pdf"
                                        onChange={e => setDocumentFiles(p => ({ ...p, [doc.key]: e.target.files[0] || null }))}
                                        className="flex-1 text-[11px] font-medium text-slate-600 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100 cursor-pointer"
                                    />
                                    {documentFiles[doc.key] && (
                                        <button onClick={() => setDocumentFiles(p => ({ ...p, [doc.key]: null }))} className="text-red-400 hover:text-red-600 text-xs font-black">✕</button>
                                    )}
                                </div>
                                {documentFiles[doc.key] && (
                                    <div className="flex items-center justify-between mt-2 pl-1">
                                        <p className="text-[9px] text-blue-500 font-bold truncate flex-1 mr-2">📎 {documentFiles[doc.key].name}</p>
                                        <button 
                                            onClick={() => handleSingleUpload(doc.key)}
                                            disabled={isSaving}
                                            className="px-3 py-1 bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-blue-700 disabled:bg-slate-300 transition-all flex items-center gap-1"
                                        >
                                            {isSaving ? '...' : <><FiCheck size={10} /> Upload Now</>}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                );
            }

            // STEP 7: SITE PHOTOS
            case 7: {
                const activeFiles = activePhotoCategory === 'Internal' ? internalFiles : externalFiles;
                return (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                            <span className="text-2xl">📸</span>
                            <div>
                                <p className="text-xs font-black text-slate-700">Progress Photos</p>
                                <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">Attach internal and external site photos to document progress.</p>
                            </div>
                        </div>

                        <div className="flex p-1 bg-slate-100 rounded-2xl gap-1">
                            {['Internal', 'External'].map(cat => {
                                const count = cat === 'Internal' ? internalFiles.length : externalFiles.length;
                                return (
                                    <button key={cat} onClick={() => setActivePhotoCategory(cat)}
                                        className={`flex-1 py-2 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1.5 ${activePhotoCategory === cat ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}>
                                        {cat === 'Internal' ? '🏗️' : '🌳'} {cat}
                                        {count > 0 && <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full text-[9px] font-black">{count}</span>}
                                    </button>
                                );
                            })}
                        </div>

                        <div className={`border-2 rounded-3xl overflow-hidden border-${activePhotoCategory === 'Internal' ? 'blue' : 'emerald'}-100`}>
                            {activeFiles.length > 0 ? (
                                <div className="grid grid-cols-3 gap-2 p-3">
                                    {activeFiles.map((file, i) => (
                                        <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-slate-100 group">
                                            <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                                            <button 
                                                onClick={() => {
                                                    const setter = activePhotoCategory === 'Internal' ? setInternalFiles : setExternalFiles;
                                                    setter(p => p.filter((_, idx) => idx !== i));
                                                }}
                                                className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-8 text-center text-slate-300">
                                    <p className="text-3xl mb-1">📸</p>
                                    <p className="text-[10px] font-black uppercase tracking-widest">No photos attached</p>
                                </div>
                            )}

                            <div className="flex gap-2 p-3 pt-0">
                                <button onClick={() => (activePhotoCategory === 'Internal' ? internalInputRef : externalInputRef).current.click()}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-500 text-[10px] font-black uppercase hover:bg-slate-100 transition-all`}>
                                    Upload File
                                </button>
                            </div>
                        </div>

                        <input ref={internalInputRef} type="file" accept="image/*" multiple className="hidden" 
                            onChange={e => setInternalFiles(p => [...p, ...Array.from(e.target.files)])} />
                        <input ref={externalInputRef} type="file" accept="image/*" multiple className="hidden" 
                            onChange={e => setExternalFiles(p => [...p, ...Array.from(e.target.files)])} />
                    </div>
                );
            }

            default: return null;
        }
    };

    const progressPct = ((detailsStep - 1) / (DETAILS_STEPS.length - 1)) * 100;

    const modal = (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-6 pb-6 px-4 bg-slate-900/70 backdrop-blur-sm">
            <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-3rem)]">

                {/* Header */}
                <div className="px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-black text-slate-800">Edit Project</h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate max-w-[280px]">{project.schoolName}</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400"><FiX size={20} /></button>
                    </div>

                    {/* 3 Tabs */}
                    <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl">
                        {[
                            { id: 'vo', label: '⚖️ V.O.', color: 'amber' },
                            { id: 'realign', label: '🔄 Realign', color: 'purple' },
                        ].map(tab => (
                            <button key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 py-2 rounded-xl text-[11px] font-black transition-all ${activeTab === tab.id ? 'bg-white shadow-sm text-' + tab.color + '-600' : 'text-slate-500 hover:bg-white/50'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Scrollable Body */}
                <div ref={bodyRef} className="flex-1 overflow-y-auto p-6 space-y-4">

                    {/* ----- VO TAB ----- */}
                    {activeTab === 'vo' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-200">
                                <span className="text-2xl">⚖️</span>
                                <div>
                                    <p className="text-xs font-black text-amber-900">Variation Order</p>
                                    <p className="text-[10px] text-amber-700 mt-0.5 leading-tight">Record a change to the scope, cost, or timeline of this project.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Field label="VO Number">
                                    <input name="vo_number" value={voForm.vo_number || ''} onChange={e => setVoForm(p => ({ ...p, vo_number: e.target.value }))} className={inputCls} placeholder="e.g. VO-01" />
                                </Field>
                                <Field label="VO Type">
                                    <select value={voForm.vo_type} onChange={e => setVoForm(p => ({ ...p, vo_type: e.target.value }))} className={inputCls}>
                                        <option>Additive</option>
                                        <option>Deductive</option>
                                        <option>Combined</option>
                                    </select>
                                </Field>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Field label="Additive Amount (₱)">
                                    <input type="number" value={voForm.additive_amount || ''} onChange={e => setVoForm(p => ({ ...p, additive_amount: e.target.value }))} className={inputCls} placeholder="0.00" />
                                </Field>
                                <Field label="Deductive Amount (₱)">
                                    <input type="number" value={voForm.deductive_amount || ''} onChange={e => setVoForm(p => ({ ...p, deductive_amount: e.target.value }))} className={inputCls} placeholder="0.00" />
                                </Field>
                            </div>
                            <Field label="Time Extension (Days)">
                                <input type="number" value={voForm.time_extension_days || ''} onChange={e => setVoForm(p => ({ ...p, time_extension_days: e.target.value }))} className={inputCls} placeholder="0" />
                            </Field>
                            <Field label="VO Date">
                                <input type="date" value={voForm.vo_requested_date || ''} onChange={e => setVoForm(p => ({ ...p, vo_requested_date: e.target.value }))} className={inputCls} />
                            </Field>
                            <Field label="Justification / Reason">
                                <textarea rows={4} value={voForm.justification_details || ''} onChange={e => setVoForm(p => ({ ...p, justification_details: e.target.value }))}
                                    placeholder="Describe the reason for the variation order..."
                                    className={inputCls + " resize-none"} />
                            </Field>
                        </div>
                    )}

                    {/* ----- REALIGNMENT TAB ----- */}
                    {activeTab === 'realign' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-2xl border border-purple-200">
                                <span className="text-2xl">🔄</span>
                                <div>
                                    <p className="text-xs font-black text-purple-900">Project Realignment</p>
                                    <p className="text-[10px] text-purple-700 mt-0.5 leading-tight">Transfer budget to another project within the same category and district.</p>
                                </div>
                            </div>

                            <Field label="Target Project">
                                {isFetchingCandidates ? (
                                    <div className="flex items-center gap-2 p-3 text-[11px] text-slate-400 font-medium">
                                        <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /> Searching eligible projects...
                                    </div>
                                ) : realignCandidates.length > 0 ? (
                                    <select value={realignForm.targetIpc} onChange={e => setRealignForm(p => ({ ...p, targetIpc: e.target.value }))} className={inputCls}>
                                        <option value="">Select target project...</option>
                                        {realignCandidates.map(c => (
                                            <option key={c.id} value={c.ipc || c.id}>{c.schoolName} – {c.projectName}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="p-3 bg-red-50 border border-red-100 rounded-2xl text-xs text-red-500 font-medium">
                                        ⚠️ No eligible projects found in the same category and district.
                                    </div>
                                )}
                            </Field>
                            <Field label="Justification">
                                <textarea rows={4} value={realignForm.justification || ''} onChange={e => setRealignForm(p => ({ ...p, justification: e.target.value }))}
                                    placeholder="Explain the reason for realignment..."
                                    className={inputCls + " resize-none"} />
                            </Field>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 shrink-0 flex items-center gap-3">
                    {activeTab === 'vo' ? (
                        <>
                            <button onClick={onClose} className="flex items-center gap-2 px-5 py-3 bg-slate-100 text-slate-600 rounded-2xl text-xs font-bold hover:bg-slate-200 transition-all">Cancel</button>
                            <div className="flex-1" />
                            <button onClick={handleSaveVO} disabled={isSaving}
                                className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-wider ${isSaving ? 'bg-slate-200 text-slate-400' : 'bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-500/25 hover:-translate-y-0.5 active:scale-95'}`}>
                                {isSaving ? <><div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> Saving...</> : <><FiCheck size={14} /> Submit V.O.</>}
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={onClose} className="flex items-center gap-2 px-5 py-3 bg-slate-100 text-slate-600 rounded-2xl text-xs font-bold hover:bg-slate-200 transition-all">Cancel</button>
                            <div className="flex-1" />
                            <button onClick={handleSaveRealign} disabled={isSaving || !realignForm.targetIpc}
                                className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-wider ${isSaving || !realignForm.targetIpc ? 'bg-slate-200 text-slate-400' : 'bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-500/25 hover:-translate-y-0.5 active:scale-95'}`}>
                                {isSaving ? <><div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> Saving...</> : <><FiCheck size={14} /> Submit Realignment</>}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(modal, document.body);
};

export default ProjectEditModal;

