import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    FiArrowLeft, 
    FiLink, 
    FiCheckCircle, 
    FiAlertCircle, 
    FiLoader,
    FiSearch,
    FiCopy,
    FiShield,
    FiExternalLink,
    FiUpload,
    FiClock, FiUserCheck, FiUsers, FiX, FiActivity, FiAward, FiInfo, FiChevronDown, FiDatabase, FiLock
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { resolveApiUrl } from '../utils/assetHelper';

import PageTransition from '../components/PageTransition';
import { useAuth } from '../context/AuthContext';
import loadingLogo from "../assets/loading.gif";
import SuccessModal from '../components/SuccessModal';
import FailureModal from '../components/FailureModal';
import PremiumSuccessModal from '../components/PremiumSuccessModal';

const SubmissionLoader = ({ message, progress, jobId }) => (
    <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/90 backdrop-blur-xl"
    >
        <div className="flex flex-col items-center gap-8 text-center px-6 max-w-sm">
            <div className="w-32 h-32 flex items-center justify-center relative">
                <div className="absolute inset-0 bg-blue-500/10 rounded-full animate-ping" />
                <img src={loadingLogo} className="w-full h-full object-contain drop-shadow-2xl relative z-10" alt="InsightEd Loading" />
            </div>
            
            <div className="space-y-4 w-full">
                <div className="space-y-1">
                    <h3 className="text-2xl font-black text-slate-800 italic uppercase tracking-tighter">{message}</h3>
                    {jobId && (
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] italic">
                            TICKET: #{jobId.substring(0, 8).toUpperCase()}
                        </p>
                    )}
                </div>

                {progress !== undefined && (
                    <div className="space-y-2">
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 shadow-inner">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ type: "spring", damping: 20 }}
                                className="h-full bg-gradient-to-r from-blue-600 to-indigo-600"
                            />
                        </div>
                        <div className="flex justify-between items-center px-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Process Volume</span>
                            <span className="text-sm font-black text-blue-600 italic">{progress}%</span>
                        </div>
                    </div>
                )}

                <div className="pt-4 flex flex-col items-center gap-3">
                    <div className="flex items-center justify-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce"></span>
                    </div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                        {progress < 100 ? "Syncing with InsightEd Secure Cloud Infrastructure" : "Finalizing Secure Data Registry"}
                    </p>
                </div>
            </div>
        </div>
    </motion.div>
);

const ESF7Draft = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    
    // Core State
    const [isScanning, setIsScanning] = useState(false);

    const [scanResult, setScanResult] = useState(null); 
    const [error, setError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [forceResubmit, setForceResubmit] = useState(false);

    
    // Hybrid Flow State
    const [uploadedFileName, setUploadedFileName] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [activeJobId, setActiveJobId] = useState(null);

    const [auditProgress, setAuditProgress] = useState(0);
    const [originalFileName, setOriginalFileName] = useState(null);

    
    // Status State
    const [statusData, setStatusData] = useState(null); 
    const [isLoadingStatus, setIsLoadingStatus] = useState(true);
    const [copied, setCopied] = useState(false);
    const [personnelData, setPersonnelData] = useState([]);
    const [isFetchingData, setIsFetchingData] = useState(false);
    const [verifySearchTerm, setVerifySearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    
    // Feedback Modals
    const [showSuccess, setShowSuccess] = useState(false);
    const [showFailure, setShowFailure] = useState(false);
    const [failureMessage, setFailureMessage] = useState('');
    const [failureDetails, setFailureDetails] = useState('');
    const itemsPerPage = 10;

    // Staff Detail Modal State
    const [showStaffModal, setShowStaffModal] = useState(false);
    const [staffModalTitle, setStaffModalTitle] = useState("");
    const [staffModalData, setStaffModalData] = useState([]);
    const [staffLoading, setStaffLoading] = useState(false);
    const [staffCurrentPage, setStaffCurrentPage] = useState(1);
    const [staffItemsPerPage] = useState(25);
    const [staffSort, setStaffSort] = useState('name'); // 'name', 'fund', 'position'
    const [categoryConfirmInput, setCategoryConfirmInput] = useState("");
    const [confirmedCategories, setConfirmedCategories] = useState({}); // { "Teaching staff": true, ... }

    // Submission Confirmation Safeguard
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmInput, setConfirmInput] = useState("");

    // Edit Modal State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingStaff, setEditingStaff] = useState(null);
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    const SPEC_LIST = [
        "GENERAL EDUCATION", "FAMILY LIFE AND CHILD DEVELOPMENT", "SPECIAL NEEDS EDUCATION",
        "EARLY CHILDHOOD EDUCATION", "FILIPINO", "ENGLISH", "MATHEMATICS", "SCIENCE",
        "ARALING PANLIPUNAN", "TLE/EPP", "MAPEH", "ESP/VALUES EDUCATION", "BIOLOGICAL SCIENCES",
        "PHYSICAL SCIENCES", "AGRICULTURE AND FISHERY ARTS"
    ];

    const FUND_SOURCES = [
        "NATIONAL", "DEPARTMENT OF EDUCATION (DEPED)", "LOCAL GOVERNMENT UNIT (LGU)", 
        "SPECIAL EDUCATION FUND (SEF)", "OTHERS"
    ];

    const CIVIL_STATUSES = ["SINGLE", "MARRIED", "WIDOWED", "SEPARATED", "ANNULLED"];
    const ITEM_STATUSES = ["OWN STATION", "PERMANENT", "PROVISIONAL", "SUBSTITUTE", "CONTRACTUAL", "OTHERS"];

    const MONTH_NAMES = [
        "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
        "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
    ];




    const currentYear = new Date().getFullYear();
    const BIRTH_YEARS = Array.from({length: currentYear - 1949}, (_, i) => currentYear - i);
    const APPT_YEARS = Array.from({length: currentYear - 1959}, (_, i) => currentYear - i);


    useEffect(() => {
        if (user?.school_id) fetchStatus();
    }, [user?.school_id]);

    const fetchStatus = async () => {
        setIsLoadingStatus(true);
        try {
            const res = await fetch(resolveApiUrl(`api/esf7/link-status/${user.school_id}`));

            const data = await res.json();
            if (data.success) {
                setStatusData(data.data);
                if (['VERIFIED', 'NEEDS_RESUBMISSION', 'SUBMITTED'].includes(data.data.status)) fetchPersonnelData();
            }
        } catch (err) {
            console.error("Status check failed:", err);
        } finally {
            setIsLoadingStatus(false);
        }
    };

    useEffect(() => {
        let pollInterval;
        if (activeJobId && isScanning) {
            pollInterval = setInterval(async () => {
                try {
                    const response = await fetch(resolveApiUrl(`api/esf7/job-status/${activeJobId}`));


                    const data = await response.json();
                    
                    if (data.status === 'COMPLETED') {
                        setScanResult(data.result);
                        setIsScanning(false);
                        setActiveJobId(null);
                        setAuditProgress(100);
                        clearInterval(pollInterval);
                    } else if (data.status === 'FAILED') {
                        setError(`Audit Failed: ${data.error || 'Unknown Error'}`);
                        setIsScanning(false);
                        setActiveJobId(null);
                        setAuditProgress(0);
                        clearInterval(pollInterval);
                    } else {
                        // Update real-time progress from backend
                        if (data.progress !== undefined) {
                            setAuditProgress(data.progress);
                        }
                    }
                } catch (err) {
                    console.error("Job polling error:", err);
                }
            }, 2000);
        }
        return () => clearInterval(pollInterval);
    }, [activeJobId, isScanning]);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.xlsb')) {
            setError("Only .XLSB files are accepted for ESF7 audits.");
            return;
        }

        setError(null);
        setIsScanning(true);
        setUploadProgress(0);
        setAuditProgress(0);

        const formData = new FormData();
        formData.append('school_id', user.school_id);
        formData.append('file', file);

        try {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', resolveApiUrl('api/esf7/upload'));


            
            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percent = Math.round((event.loaded / event.total) * 100);
                    setUploadProgress(percent);
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200) {
                    const data = JSON.parse(xhr.responseText);
                    setUploadedFileName(data.fileName);
                    setOriginalFileName(file.name);
                    setActiveJobId(data.jobId);

                } else {
                    const errData = JSON.parse(xhr.responseText);
                    setError(errData.error || "Upload failed.");
                    setIsScanning(false);
                }
            };

            xhr.onerror = () => {
                setError("Network error during upload.");
                setIsScanning(false);
            };

            xhr.send(formData);
        } catch (err) {
            setError(err.message);
            setIsScanning(false);
        }
    };

    // Link Check Logic Removed (Legacy Workflow)


    const fetchPersonnelData = async () => {
        setIsFetchingData(true);
        try {
            const res = await fetch(resolveApiUrl(`api/esf7/data/${user.school_id}`));


            const data = await res.json();
            if (data.success) setPersonnelData(data.data);
        } catch (err) {
            console.error("Data fetch failed:", err);
        } finally {
            setIsFetchingData(false);
        }
    };

    const getComputedSummary = () => {
        // [Priority] If we have actual personnel records from ESF7_Database, use those to calculate counts
        if (personnelData && personnelData.length > 0) {
            // Calculation logic follows below...
        } else {
            // Fallback: Use the summary stored in statusData (esf7_link)
            const s = statusData?.summary || {};
            if (Object.keys(s).length > 0 && (s.teaching || s.nonTeaching)) return s;
            if (!personnelData || personnelData.length === 0) return s;
        }

        const TEACHING = ["TEACHER I", "TEACHER II", "TEACHER III", "MASTER TEACHER I", "MASTER TEACHER II", "MASTER TEACHER III", "MASTER TEACHER IV", "SPET I", "SPET II", "SPET III", "SPET IV", "SST I", "SST II", "SST III"];
        const RELATED = ["PRINCIPAL I", "PRINCIPAL II", "PRINCIPAL III", "PRINCIPAL IV", "HEAD TEACHER I", "HEAD TEACHER II", "HEAD TEACHER III", "HEAD TEACHER IV", "HEAD TEACHER V", "HEAD TEACHER VI", "GUIDANCE COUNSELOR I", "GUIDANCE COUNSELOR II", "GUIDANCE COUNSELOR III", "LIBRARIAN I", "LIBRARIAN II", "LIBRARIAN III"];
        const SPEC_LIST = [
            "GENERAL EDUCATION", "FAMILY LIFE AND CHILD DEVELOPMENT", "SPECIAL NEEDS EDUCATION",
            "EARLY CHILDHOOD EDUCATION", "FILIPINO", "ENGLISH", "MATHEMATICS", "SCIENCE",
            "ARALING PANLIPUNAN", "TLE/EPP", "MAPEH", "ESP/VALUES EDUCATION", "BIOLOGICAL SCIENCES",
            "PHYSICAL SCIENCES", "AGRICULTURE AND FISHERY ARTS"
        ];
        
        let teaching = 0;
        let relatedTeaching = 0;
        let nonTeaching = 0;
        let schoolHead = { name: "N/A", position: "N/A", rank: -1 };
        const specCounts = {};
        SPEC_LIST.forEach(spec => specCounts[spec] = 0);
        specCounts["OTHERS"] = 0;

        personnelData.forEach(r => {
            const pos = (r.position || "").toUpperCase();
            
            // School Head Detection (Ranked: Principal > Head Teacher)
            let currentRank = -1;
            if (pos.includes("PRINCIPAL")) {
                const level = parseInt(pos.replace(/[^0-9]/g, '')) || 1;
                currentRank = 100 + level;
            } else if (pos.includes("HEAD TEACHER")) {
                const level = parseInt(pos.replace(/[^0-9]/g, '')) || 1;
                currentRank = 50 + level;
            }

            if (currentRank > schoolHead.rank) {
                schoolHead = {
                    name: `${r.first} ${r.last}`.trim(),
                    position: r.position,
                    rank: currentRank
                };
            }

            // Category Assignment (ALL ROWS)
            if (TEACHING.some(t => pos.includes(t))) {
                teaching++;
                // Specialization Assignment (Only for Teaching)
                const major = (r.major__specialization || r.specialization || "").toUpperCase().trim();
                if (SPEC_LIST.includes(major)) specCounts[major]++;
                else if (major) specCounts["OTHERS"]++;
            }
            else if (RELATED.some(r => pos.includes(r))) relatedTeaching++;
            else nonTeaching++;
        });

        return { 
            teaching, 
            relatedTeaching, 
            nonTeaching, 
            total: personnelData.length,
            schoolHead: schoolHead.name === "N/A" ? (user?.username || "N/A") : schoolHead.name, 
            schoolHeadPosition: schoolHead.position === "N/A" ? "School Head" : schoolHead.position,
            specializations: specCounts
        };
    };

    const computedSummary = getComputedSummary();
    const allAuditConfirmed = scanResult && (
        (scanResult.summary.teaching === 0 || confirmedCategories["Teaching Staff"]) &&
        (scanResult.summary.relatedTeaching === 0 || confirmedCategories["Related-Teaching"]) &&
        (scanResult.summary.nonTeaching === 0 || confirmedCategories["Non-Teaching Staff"]) &&
        confirmedCategories["School Head"]
    );

    const derivedDepEdCount = personnelData?.length > 0 
        ? personnelData.filter(p => {
            const f = (p.fund_source || p.funding_source || "").toUpperCase();
            return f.includes("NATIONAL") || f.includes("DEPED");
          }).length
        : statusData?.row_count || 0;

    const derivedLocalCount = personnelData?.length > 0
        ? personnelData.length - derivedDepEdCount
        : 0;

    const otherFundSources = {};
    if (personnelData?.length > 0) {
        personnelData.forEach(p => {
            const f = (p.fund_source || p.funding_source || "").toUpperCase();
            if (!f.includes("NATIONAL") && !f.includes("DEPED")) {
                const label = f || "UNSPECIFIED";
                otherFundSources[label] = (otherFundSources[label] || 0) + 1;
            }
        });
    }

    const handleCopyEmail = () => {
        navigator.clipboard.writeText('insighted-drive-access@insighted-drive-api.iam.gserviceaccount.com');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };



    const handleCategoryClick = async (category) => {
        setStaffModalTitle(category);
        setShowStaffModal(true);
        setStaffLoading(true);
        setStaffModalData([]);
        setStaffCurrentPage(1);
        setCategoryConfirmInput("");

        // If we are in the SCAN phase (Phase 2), use the scanResult data directly
        if (scanResult && scanResult.scannedPersonnel) {
            let filtered = [];
            if (category === "School Head") {
                // Special case: just show the detected head
                filtered = [{
                    first: scanResult.summary.schoolHead.split(',')[1]?.trim() || scanResult.summary.schoolHead,
                    last: scanResult.summary.schoolHead.split(',')[0]?.trim() || '',
                    position: scanResult.summary.schoolHeadPosition,
                    fund_source: "DEPARTMENT OF EDUCATION (DEPED)"
                }];
            } else if (category.includes("Non-Teaching")) {
                filtered = scanResult.scannedPersonnel.nonTeaching || [];
            } else if (category === "Teaching Staff" || category === "Teaching staff") {
                filtered = scanResult.scannedPersonnel.teaching || [];
            } else if (category === "Related-Teaching") {
                filtered = scanResult.scannedPersonnel.related || [];
            }
            setStaffModalData(filtered);
            setStaffLoading(false);
            return;
        }

        // For Phase 3 (Verified), fetch from official database
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(resolveApiUrl(`api/esf7/data/${user.school_id}`), {

                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (data.success) {
                const TEACHING = ["TEACHER I", "TEACHER II", "TEACHER III", "MASTER TEACHER I", "MASTER TEACHER II", "MASTER TEACHER III", "MASTER TEACHER IV", "SPET I", "SPET II", "SPET III", "SPET IV", "SST I", "SST II", "SST III"];
                const RELATED = ["PRINCIPAL I", "PRINCIPAL II", "PRINCIPAL III", "PRINCIPAL IV", "HEAD TEACHER I", "HEAD TEACHER II", "HEAD TEACHER III", "HEAD TEACHER IV", "HEAD TEACHER V", "HEAD TEACHER VI", "GUIDANCE COUNSELOR I", "GUIDANCE COUNSELOR II", "GUIDANCE COUNSELOR III", "LIBRARIAN I", "LIBRARIAN II", "LIBRARIAN III"];

                let filtered = [];
                const raw = data.data || [];

                if (category === "Teaching Staff" || category === "Teaching staff") {
                    filtered = raw.filter(r => {
                        const pos = (r.position || "").toUpperCase();
                        return TEACHING.some(t => pos.includes(t));
                    });
                } else if (category === "Related-Teaching") {
                    filtered = raw.filter(r => {
                        const pos = (r.position || "").toUpperCase();
                        return RELATED.some(t => pos.includes(t));
                    });
                } else { // Non-Teaching
                    filtered = raw.filter(r => {
                        const pos = (r.position || "").toUpperCase();
                        const isTeaching = TEACHING.some(t => pos.includes(t));
                        const isRelated = RELATED.some(t => pos.includes(t));
                        return !isTeaching && !isRelated;
                    });
                }
                setStaffModalData(filtered);
            }
        } catch (err) { console.error(err); }
        setStaffLoading(false);
    };

    const handlePreSubmitTrigger = () => {
        setConfirmInput("");
        setShowConfirmModal(true);
    };


    const handleSubmitRegistry = async () => {
        if (!scanResult || !user?.school_id) return;
        setIsSubmitting(true);
        try {
            const res = await fetch(resolveApiUrl('api/esf7/submit'), {


                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    school_id: user.school_id,
                    driveLink: 'LOCAL_BINARY',
                    fileName: uploadedFileName,
                    summary: scanResult.summary
                })
            });

            if (res.ok) {
                setShowSuccess(true);
            } else {
                const data = await res.json();
                throw new Error(data.error || "Submission failed.");
            }
        } catch (err) {
            setFailureMessage("Submission Error");
            setFailureDetails(err.message);
            setShowFailure(true);
        } finally {
            setIsSubmitting(false);
        }
    };


    const handleEditPersonnel = (staff) => {
        // [Normalization] Ensure consistent mapping from DB to UI state
        const normalized = {
            ...staff,
            major_specialization: (staff.major_specialization || staff.major__specialization || "").toUpperCase().trim(),
            fund_source: (staff.fund_source || staff.funding_source || "").toUpperCase().trim(),
            status_item_: (staff.status_item_ || staff.status__item_ || "").toUpperCase().trim(),
            birthday_mm: (staff.birthday_mm || "").toUpperCase().trim(),
            appt_mm: (staff.appt_mm || "").toUpperCase().trim(),
            appt_dd: staff.appt_dd || staff["1"] || "01"
        };





        setEditingStaff(normalized);
        setShowEditModal(true);
    };

    const handleSaveEdit = async () => {
        if (!editingStaff || isSavingEdit) return;
        setIsSavingEdit(true);
        try {
            const res = await fetch(resolveApiUrl('api/esf7/update-personnel'), {

                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    school_id: user.school_id,
                    esf7_id: editingStaff.esf7_id || editingStaff.source_id,
                    ...editingStaff
                })
            });
            const data = await res.json();
            if (data.success) {
                setShowEditModal(false);
                setEditingStaff(null);
                fetchPersonnelData(); // Refresh list
            } else {
                alert(data.error || "Failed to update record.");
            }
        } catch (err) {
            console.error(err);
            alert("Error connecting to server.");
        } finally {
            setIsSavingEdit(false);
        }
    };

    const isLocked = statusData && ['QUEUED', 'HARVESTING', 'VERIFIED', 'PENDING_RESUBMISSION', 'SUBMITTED'].includes(statusData.status);

    const isVerified = statusData && (statusData.status === 'VERIFIED' || statusData.status === 'NEEDS_RESUBMISSION' || statusData.status === 'SUBMITTED');
    const isPendingResubmission = statusData && (statusData.status === 'PENDING_RESUBMISSION' || (statusData.request_status === 'PENDING' && statusData.status === 'VERIFIED'));
    const needsResubmission = statusData && (statusData.status === 'NEEDS_RESUBMISSION' || statusData.request_status === 'PENDING');
    const canUpload = !isLocked || needsResubmission || forceResubmit;


    return (
        <PageTransition>
            <AnimatePresence>
                {(isScanning || isLoadingStatus) && (
                    <SubmissionLoader 
                        key="submission-loader"
                        jobId={activeJobId}
                        progress={activeJobId ? auditProgress : (uploadProgress > 0 && uploadProgress < 100 ? uploadProgress : undefined)}
                        message={
                            activeJobId ? (auditProgress < 10 ? "Queuing for Audit..." : "Auditing Personnel Data...") : 
                            (uploadProgress > 0 && uploadProgress < 100) ? `Uploading Template...` :
                            isScanning ? "Analyzing Template..." : 
                            "Initializing Connection..."
                        } 
                    />
                )}
                {isScanning && (
                    <div key="cancel-button" className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
                        <button 
                            onClick={() => { setIsScanning(false); setActiveJobId(null); }}
                            className="bg-red-500/20 hover:bg-red-500/40 text-red-400 px-4 py-2 rounded-full text-sm border border-red-500/30 backdrop-blur-md transition-all"
                        >
                            Cancel Audit
                        </button>
                    </div>
                )}
            </AnimatePresence>


            <div className="min-h-screen bg-[#fafbff] pb-24 font-sans relative overflow-hidden">
                <PremiumSuccessModal 
                    isOpen={showSuccess}
                    onClose={() => setShowSuccess(false)}
                    title="Submission Secured"
                    message="Final Registry Harvest Initiated! Your ESF7 link has been secured."
                    redirectUrl="/nodes-dashboard"
                />

                <FailureModal 
                    isOpen={showFailure} 
                    onClose={() => setShowFailure(false)} 
                    title="Data Audit Failed"
                    message={failureMessage}
                    details={failureDetails}
                />
                {/* Decorative Background Elements */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-100/30 rounded-full blur-[120px] -mr-64 -mt-64" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-100/20 rounded-full blur-[100px] -ml-48 -mb-48" />

                {/* --- HEADER --- */}
                <header className="bg-white/70 backdrop-blur-xl border-b border-slate-200/50 px-6 py-5 flex items-center justify-between sticky top-0 z-50 shadow-sm">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/nodes-dashboard')} className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all shadow-sm active:scale-95">
                            <FiArrowLeft className="w-5 h-5 text-slate-600" />
                        </button>
                        <div>
                            <h1 className="text-xl font-black text-slate-800 tracking-tight leading-none uppercase italic">ESF7 Connection Hub</h1>
                            <div className="flex items-center gap-2 mt-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest italic">National Scale Ingestion</p>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
                    {/* --- AUDIT REMARKS BANNER (NEEDS_RESUBMISSION) --- */}
                    {needsResubmission && (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-rose-50 border-2 border-rose-200 rounded-[2rem] p-8 shadow-xl shadow-rose-500/10 space-y-4"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-rose-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
                                    <FiAlertCircle size={24} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-xl font-black text-rose-800 tracking-tighter uppercase italic">Resubmission Required</h3>
                                    <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest italic">SDO Auditor Feedback Received</p>
                                </div>
                            </div>
                            
                            <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl border border-rose-100 shadow-inner">
                                <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2 italic">Auditor Remarks:</p>
                                <p className="text-sm font-bold text-slate-700 leading-relaxed italic">
                                    "{statusData.audit_remarks || "No specific remarks provided. Please re-check your data and re-submit."}"
                                </p>
                            </div>

                              <p className="text-[10px] font-bold text-rose-600/70 text-center uppercase tracking-widest leading-relaxed">
                                  Form has been **FLAGGED** for resubmission. 
                                  Please review the remarks above and upload the corrected file below.
                              </p>

                        </motion.div>
                    )}
                    {/* --- CASE 1: MODULE LOCKED (IN-PROGRESS) --- */}
                    {(isLocked && !isVerified && !isPendingResubmission) && (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-10 shadow-xl shadow-slate-200/40 relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-10 -mt-10 blur-3xl opacity-50" />
                            <div className="space-y-6 relative">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Current Status</p>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                                            <span className="text-2xl font-black italic uppercase tracking-tighter text-blue-600 italic">
                                                {statusData?.status?.replace('_', ' ') || 'LOADING...'}
                                            </span>

                                        </div>
                                    </div>
                                    <div className="flex items-center gap-12">
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Registry Depth</p>
                                            <p className="text-3xl font-black text-slate-800 tracking-tighter leading-none">{statusData.row_count || 0}</p>
                                        </div>
                                        {statusData.summary && (
                                            <div className="flex items-center gap-4 border-l border-slate-100 pl-8">
                                                {(() => {
                                                    const s = typeof statusData.summary === 'string' ? JSON.parse(statusData.summary) : statusData.summary;
                                                    return (
                                                        <>
                                                            <div className="text-center">
                                                                <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">T</p>
                                                                <p className="text-lg font-black text-slate-800 leading-none">{s.teaching || 0}</p>
                                                            </div>
                                                            <div className="text-center">
                                                                <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest">RT</p>
                                                                <p className="text-lg font-black text-slate-800 leading-none">{s.relatedTeaching || 0}</p>
                                                            </div>
                                                            <div className="text-center">
                                                                <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest">NT</p>
                                                                <p className="text-lg font-black text-slate-800 leading-none">{s.nonTeaching || 0}</p>
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>

                                </div>

                                <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100/50 flex items-start gap-4">
                                    <FiShield className="text-blue-600 w-6 h-6 shrink-0 mt-1" />
                                    <div className="space-y-1">
                                        <h4 className="text-xs font-black text-blue-900 uppercase">Input Registry Locked</h4>
                                        <p className="text-[10px] font-bold text-blue-700/70 leading-relaxed uppercase">
                                            Your link has been submitted and is currently in the SDO Review queue. 
                                            To maintain audit integrity, modifications are disabled.
                                        </p>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">
                                        Submitted: {(() => {
                                            const d = statusData.uploaded_at;
                                            if (!d) return 'N/A';
                                            // Ensure UTC parsing by appending Z if missing
                                            const date = new Date(d.toString().endsWith('Z') || d.toString().includes('+') ? d : d.toString().replace(' ', 'T') + 'Z');
                                            return date.toLocaleString();
                                        })()}
                                    </p>
                                    <button 
                                        className="text-[10px] font-black text-slate-400 hover:text-blue-600 uppercase italic transition-all"
                                        onClick={() => window.open(statusData.link, '_blank')}
                                    >
                                        View submitted link <FiExternalLink className="inline ml-1" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {isVerified && !needsResubmission && !forceResubmit && (
                        <div className="space-y-8">
                            <div className="flex items-center justify-between px-2">
                                <div className="space-y-1">
                                    <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase italic">
                                        {statusData?.status === 'SUBMITTED' ? 'Submission Pending Review' : 'Verified Registry'}
                                    </h2>


                                    <div className="flex items-center gap-2">
                                        <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${statusData?.status === 'SUBMITTED' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />

                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest italic">
                                            {statusData?.status === 'SUBMITTED' 
                                                ? `Awaiting SDO Audit for ${computedSummary?.total || 0} Personnel` 
                                                : 'Audited & Secure'}
                                        </p>

                                    </div>
                                </div>
                                    <div className="flex flex-col items-end gap-2">
                                        {(!statusData || statusData.status === 'NOT_STARTED' || statusData.status === 'NEEDS_RESUBMISSION') && (
                                            <button 
                                                onClick={() => setForceResubmit(true)}
                                                className="px-6 py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center gap-2 italic"
                                            >
                                                <FiUpload /> Resubmit New File
                                            </button>
                                        )}
                                    </div>

                            </div>

                            {statusData.status === 'SUBMITTED' ? (
                                <div className="space-y-6">
                                    {/* Simplified Receipt Style for Submitted */}
                                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-6">
                                        <div className="w-16 h-16 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg">
                                            <FiShield size={24} className="text-amber-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Authenticated School Head</h3>
                                            <p className="text-xl font-black text-slate-800 tracking-tight leading-none uppercase italic">{computedSummary?.schoolHead || "N/A"}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 text-center space-y-1 shadow-sm">
                                            <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Teaching</p>
                                            <p className="text-3xl font-black text-slate-800 italic">{computedSummary?.teaching || 0}</p>
                                        </div>
                                        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 text-center space-y-1 shadow-sm">
                                            <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Related</p>
                                            <p className="text-3xl font-black text-slate-800 italic">{computedSummary?.relatedTeaching || 0}</p>
                                        </div>
                                        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 text-center space-y-1 shadow-sm">
                                            <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Non-T</p>
                                            <p className="text-3xl font-black text-slate-800 italic">{computedSummary?.nonTeaching || 0}</p>
                                        </div>
                                    </div>

                                    <div className="bg-blue-50/50 p-8 rounded-[2.5rem] border border-dashed border-blue-200 text-center space-y-3">
                                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto text-blue-600">
                                            <FiInfo size={18} />
                                        </div>
                                        <p className="text-xs font-bold text-blue-900 uppercase tracking-tight leading-relaxed max-w-md mx-auto">
                                            Your registry link is safely transmitted. Individual personnel names will be visible here once the SDO harvests and moves records to the main database.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* High Fidelity Interactive for Harvested/Verified */}
                                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between gap-6 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl opacity-40 -mr-10 -mt-10 transition-all group-hover:scale-150" />
                                        <div className="flex items-center gap-6 relative">
                                            <div className="w-20 h-20 rounded-3xl bg-slate-900 flex flex-col items-center justify-center text-white text-center shadow-2xl shadow-slate-900/20">
                                                <FiShield className="text-blue-400 mb-1" />
                                                <span className="text-[8px] font-black uppercase tracking-tighter">Harvested</span>
                                            </div>
                                            <div>
                                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Authenticated School Head</h3>
                                                <p className="text-2xl font-black text-slate-800 tracking-tight leading-none italic uppercase">{computedSummary?.schoolHead || "N/A"}</p>
                                                <p className="text-[10px] font-bold text-blue-500 mt-2 uppercase tracking-widest italic">{computedSummary?.schoolHeadPosition || "No Position Assigned"}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="px-8 py-5 bg-blue-50/50 rounded-[2rem] border border-blue-100 flex items-center gap-4 transition-all hover:bg-blue-50 group">
                                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                                            <FiInfo className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-blue-700 uppercase tracking-widest leading-none">Full Registry Visibility</p>
                                            <p className="text-[10px] font-bold text-blue-600/80 mt-1 uppercase italic tracking-tight">
                                                Showing 100% of rows. **Red-flagged** items are National/DepEd funded records subject to SDO audit.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-6">
                                        <CategoryCard 
                                            label="Teaching staff" 
                                            value={computedSummary?.teaching || 0} 
                                            icon={<FiActivity />} 
                                            color="text-indigo-600 bg-indigo-50" 
                                            onClick={() => handleCategoryClick("Teaching Staff")}
                                        />
                                        <CategoryCard 
                                            label="Related-Teaching" 
                                            value={computedSummary?.relatedTeaching || 0} 
                                            icon={<FiUserCheck />} 
                                            color="text-amber-600 bg-amber-50"
                                            onClick={() => handleCategoryClick("Related-Teaching")}
                                        />
                                        <CategoryCard 
                                            label="Non-Teaching" 
                                            value={computedSummary?.nonTeaching || 0} 
                                            icon={<FiUsers />} 
                                            color="text-rose-600 bg-rose-50"
                                            onClick={() => handleCategoryClick("Non-Teaching Staff")}
                                        />
                                    </div>

                                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                                                <FiAward />
                                            </div>
                                            <div>
                                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Teaching Personnel</h3>
                                                <p className="text-lg font-black text-slate-800 tracking-tight leading-none mt-1 uppercase italic">Specialization Breakdown</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                             {Object.entries(computedSummary.specializations || {})
                                                 .filter(([_, count]) => count > 0)
                                                 .sort((a, b) => b[1] - a[1])
                                                 .map(([spec, count]) => (
                                                     <div key={spec} className="px-4 py-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:bg-white hover:border-orange-200 transition-all">
                                                         <p className="text-[9px] font-black text-slate-500 uppercase tracking-tight leading-[1.1] pr-2 group-hover:text-orange-600 truncate">{spec.replace(/_/g, ' ')}</p>
                                                         <span className="text-xs font-black text-slate-900 group-hover:scale-110 transition-transform">{count}</span>
                                                     </div>
                                                 ))}
                                        </div>
                                        <div className="pt-2 text-center">
                                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Click cards above to audit individual names.</p>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Staff Detail Modal */}
                    <AnimatePresence>
                        {showStaffModal && (
                            <div key="staff-detail-modal" className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">

                                <motion.div 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setShowStaffModal(false)}
                                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                                />
                                <motion.div 
                                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                                    animate={{ scale: 1, opacity: 1, y: 0 }}
                                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                                    className="relative w-full max-w-4xl max-h-[85vh] bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col"
                                >
                                    <div className="p-8 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-20">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/20">
                                                <FiUsers className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-slate-800 tracking-tight leading-none uppercase italic">{staffModalTitle}</h3>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Order by:</p>
                                                    <select 
                                                        value={staffSort}
                                                        onChange={(e) => {
                                                            setStaffSort(e.target.value);
                                                            setStaffCurrentPage(1);
                                                        }}
                                                        className="bg-blue-50 border-none text-[9px] font-black uppercase tracking-widest text-blue-600 py-1 px-2 rounded-lg focus:ring-0 cursor-pointer hover:bg-blue-100 transition-colors"
                                                    >
                                                        <option value="name">Name (A-Z)</option>
                                                        <option value="fund">Audit Priority (Red First)</option>
                                                        <option value="position">Position Title</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => setShowStaffModal(false)}
                                            className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-slate-100 transition-colors"
                                        >
                                            <FiX />
                                        </button>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                        {staffLoading ? (
                                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                                <FiLoader className="w-10 h-10 text-blue-600 animate-spin" />
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Retrieving Registry...</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {staffModalData.length > 0 ? (
                                                    <>
                                                        {(() => {
                                                            const sorted = [...staffModalData].sort((a, b) => {
                                                                if (staffSort === 'name') {
                                                                    return `${a.last}, ${a.first}`.localeCompare(`${b.last}, ${b.first}`);
                                                                }
                                                                if (staffSort === 'fund') {
                                                                    const fA = (a.fund_source || a.funding_source || "").toUpperCase();
                                                                    const fB = (b.fund_source || b.funding_source || "").toUpperCase();
                                                                    const priorityA = (fA.includes("NATIONAL") || fA.includes("DEPED")) ? 0 : 1;
                                                                    const priorityB = (fB.includes("NATIONAL") || fB.includes("DEPED")) ? 0 : 1;
                                                                    return priorityA - priorityB || `${a.last}, ${a.first}`.localeCompare(`${b.last}, ${b.first}`);
                                                                }
                                                                if (staffSort === 'position') {
                                                                    return (a.position || "").localeCompare(b.position || "") || `${a.last}, ${a.first}`.localeCompare(`${b.last}, ${b.first}`);
                                                                }
                                                                return 0;
                                                            });
                                                            return sorted.slice((staffCurrentPage - 1) * staffItemsPerPage, staffCurrentPage * staffItemsPerPage).map((staff, idx) => (
                                                                <div 
                                                                    key={idx} 
                                                                    onClick={() => handleEditPersonnel(staff)}
                                                                    className="p-5 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between group hover:bg-blue-50 hover:border-blue-200 transition-all cursor-pointer"
                                                                >
                                                                    <div className="flex items-center gap-5">
                                                                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 text-xs font-black group-hover:text-blue-600 group-hover:border-blue-100 transition-all">
                                                                            {(staffCurrentPage - 1) * staffItemsPerPage + idx + 1}
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-sm font-black text-slate-800 uppercase tracking-tight group-hover:text-blue-900 transition-colors italic">{staff.last}, {staff.first}</p>
                                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{staff.position}</p>
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex items-center gap-4">
                                                                         <div className="text-right">
                                                                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Fund Source</p>
                                                                             <p className={`text-[10px] font-bold uppercase italic leading-none ${((staff.fund_source || staff.funding_source || "").toUpperCase().includes("NATIONAL") || (staff.fund_source || staff.funding_source || "").toUpperCase().includes("DEPED")) ? "text-red-500" : "text-blue-600"}`}>
                                                                                 {staff.fund_source || staff.funding_source || "LOCAL"}
                                                                             </p>
                                                                         </div>
                                                                        {staff.gender && (
                                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${staff.gender === 'M' || staff.gender === 'MALE' ? 'bg-blue-100 text-blue-600' : 'bg-rose-100 text-rose-600'}`}>
                                                                                {staff.gender.charAt(0)}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ));
                                                        })()}

                                                        {staffModalData.length > staffItemsPerPage && (
                                                            <div className="mt-8 flex items-center justify-center gap-2 pb-8 border-b border-slate-100">
                                                                <button 
                                                                    onClick={() => setStaffCurrentPage(prev => Math.max(1, prev - 1))}
                                                                    disabled={staffCurrentPage === 1}
                                                                    className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 disabled:opacity-50 transition-all"
                                                                >
                                                                    Prev
                                                                </button>
                                                                <div className="flex items-center gap-1">
                                                                    {[...new Set(Array.from({ length: Math.ceil(staffModalData.length / staffItemsPerPage) }, (_, i) => i + 1)
                                                                        .filter(p => p === 1 || p === Math.ceil(staffModalData.length / staffItemsPerPage) || (p >= staffCurrentPage - 1 && p <= staffCurrentPage + 1)))]
                                                                        .map((p, i, arr) => (

                                                                            <React.Fragment key={p}>
                                                                                {i > 0 && p !== arr[i-1] + 1 && <span className="text-slate-300">...</span>}
                                                                                <button 
                                                                                    onClick={() => setStaffCurrentPage(p)}
                                                                                    className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all ${staffCurrentPage === p ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white border border-slate-100 text-slate-400 hover:bg-slate-50'}`}
                                                                                >
                                                                                    {p}
                                                                                </button>
                                                                            </React.Fragment>
                                                                        ))
                                                                    }
                                                                </div>
                                                                <button 
                                                                    onClick={() => setStaffCurrentPage(prev => Math.min(Math.ceil(staffModalData.length / staffItemsPerPage), prev + 1))}
                                                                    disabled={staffCurrentPage === Math.ceil(staffModalData.length / staffItemsPerPage)}
                                                                    className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 disabled:opacity-50 transition-all"
                                                                >
                                                                    Next
                                                                </button>
                                                            </div>
                                                        )}

                                                    </>
                                                ) : (
                                                    <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">No filtered personnel found</p>
                                                    </div>
                                                )}



                                                {/* Category-Specific Safeguard (Always shown for New/Resubmit) */}
                                                {(!isVerified || statusData?.status === 'NEEDS_RESUBMISSION' || forceResubmit) && (
                                                    <div className="mt-12 bg-white border-2 border-slate-100 rounded-[2.5rem] p-8 shadow-sm space-y-6">
                                                        <div className="text-center space-y-2">
                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                                                                Please acknowledge your review of these {staffModalData.length} records.
                                                            </p>
                                                            <h4 className="text-xs font-black text-slate-800 uppercase italic">Acknowledge Category Review</h4>
                                                        </div>

                                                        <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Type <span className="text-blue-600 font-bold">CONFIRM</span> to finish review</p>
                                                            <input 
                                                                type="text" 
                                                                placeholder="..."
                                                                className="w-full bg-white border-2 border-slate-200 rounded-2xl py-4 px-6 text-center text-sm font-black tracking-[0.3em] uppercase transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none"
                                                                value={categoryConfirmInput}
                                                                onChange={(e) => setCategoryConfirmInput(e.target.value)}
                                                            />
                                                        </div>

                                                        <button 
                                                            onClick={() => {
                                                                setConfirmedCategories(prev => ({ ...prev, [staffModalTitle]: true }));
                                                                setShowStaffModal(false);
                                                            }}
                                                            disabled={categoryConfirmInput.toUpperCase() !== "CONFIRM"}
                                                            className="w-full py-5 bg-slate-900 disabled:bg-slate-100 disabled:text-slate-300 text-white rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-slate-900/20 active:scale-95 flex items-center justify-center gap-3"
                                                        >
                                                            {confirmedCategories[staffModalTitle] ? <FiCheckCircle /> : <FiLock />}
                                                            {confirmedCategories[staffModalTitle] ? "Category Reviewed" : "Acknowledge & Close"}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>

            {/* --- CASE 4: PENDING RESUBMISSION --- */}
                    {isPendingResubmission && (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-10 shadow-xl shadow-slate-200/40 relative overflow-hidden text-center space-y-6"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-full -mr-10 -mt-10 blur-3xl opacity-50" />
                            <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center text-amber-500 mx-auto shadow-sm">
                                <FiClock size={32} />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-black text-slate-800 tracking-tighter uppercase italic">Request is Pending</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Waiting for SDO Audit Review</p>
                            </div>
                            <p className="text-[11px] font-bold text-slate-500 uppercase leading-relaxed max-w-sm mx-auto">
                                You have requested to unseal your ESF7 registry for correction. 
                                The SDO will review your request during the final week of the deadline.
                            </p>
                            <div className="pt-6 border-t border-slate-50">
                                <button 
                                    onClick={() => navigate('/nodes-dashboard')}
                                    className="px-8 py-4 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-slate-900/10 hover:scale-105 transition-all italic"
                                >
                                    Return to Nexus
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* --- CASE 2: NEW SUBMISSION / RESUBMIT --- */}
                    {canUpload && !scanResult && (
                        <div className="space-y-12">
                            <div className="text-center space-y-4">
                                {forceResubmit && (
                                    <button 
                                        onClick={() => setForceResubmit(false)}
                                        className="mb-4 text-[10px] font-black text-slate-400 hover:text-rose-500 uppercase tracking-widest flex items-center gap-2 mx-auto transition-all"
                                    >
                                        <FiX /> Cancel Resubmission & Return to Dashboard
                                    </button>
                                )}
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600/10 rounded-full border border-blue-600/20">

                                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest italic">Phase 1: Ingestion</span>
                                </div>
                                <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase leading-none italic">Hybrid Audit</h2>
                                <p className="text-[12px] font-bold text-slate-400 uppercase tracking-[0.3em] italic">
                                    {needsResubmission ? "Correct & Re-upload Audit Template" : "Upload file for audit & link for cloud registry"}
                                </p>
                            </div>

                            {needsResubmission && statusData?.audit_remarks && (
                                <div className="bg-rose-50 border border-rose-100 p-6 rounded-3xl flex items-start gap-4 shadow-sm italic">
                                    <FiAlertCircle className="text-rose-500 w-5 h-5 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Active Auditor Instructions</p>
                                        <p className="text-sm font-bold text-rose-800 leading-relaxed italic">"{statusData.audit_remarks}"</p>
                                    </div>
                                </div>
                            )}


                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1)] space-y-10 relative overflow-hidden group"
                            >
                                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600" />
                                
                                {/* STEP 1: DIRECT UPLOAD */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs">01</div>
                                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight italic">Direct File Upload</h4>
                                    </div>

                                    <div className="relative group/upload">
                                        <input 
                                            type="file" 
                                            accept=".xlsb"
                                            onChange={handleFileUpload}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                            disabled={isScanning}
                                        />
                                        <div className={`border-2 border-dashed rounded-3xl p-10 transition-all flex flex-col items-center gap-4 ${isScanning ? 'bg-slate-50 border-slate-200' : 'bg-slate-50/50 border-slate-200 group-hover/upload:border-blue-400 group-hover/upload:bg-blue-50/30'}`}>
                                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${isScanning ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-white text-blue-600 shadow-sm border border-slate-100'}`}>
                                                {isScanning ? <FiLoader className="animate-spin" size={32} /> : <FiUpload size={32} />}
                                            </div>
                                            <div className="text-center">
                                                <p className="text-sm font-black text-slate-900 uppercase tracking-tight italic">
                                                    {isScanning ? (uploadProgress < 100 ? `Uploading... ${uploadProgress}%` : 'Auditing Data...') : 'Click to select .XLSB file'}
                                                </p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic">Binary Template required for audit</p>
                                            </div>
                                            {isScanning && (
                                                <div className="w-full max-w-xs h-1.5 bg-slate-200 rounded-full overflow-hidden mt-2">
                                                    <motion.div 
                                                        className="h-full bg-blue-600"
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${uploadProgress}%` }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* STEP 2: LINK ENDPOINT (LOCKED UNTIL UPLOAD DONE) */}
                                <div className="space-y-6 opacity-50 select-none grayscale">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-400 text-white flex items-center justify-center font-black text-xs">02</div>
                                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight italic">Google Drive Link</h4>
                                    </div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase italic">Complete file audit to unlock registry linking</p>
                                </div>
                            </motion.div>

                            {/* Critical Audit Notice */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-slate-900 rounded-[2rem] p-6 text-white space-y-4 shadow-xl shadow-slate-900/30 relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full -mr-8 -mt-8 blur-2xl" />
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-rose-500/20 text-rose-500 rounded-xl flex items-center justify-center shadow-inner">
                                        <FiAlertCircle size={20} className="animate-pulse" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <h4 className="text-sm font-black uppercase tracking-tighter italic leading-none">Critical Audit Notice</h4>
                                        <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest">Mandatory Field Enforcement</p>
                                    </div>
                                </div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed italic">
                                    The system will **AUTOMATICALLY REJECT** your submission if any of the following fields is <span className="text-rose-400">n/a</span> or <span className="text-white">empty</span>.
                                </p>
                                <div className="grid grid-cols-2 gap-x-6 gap-y-2 bg-white/5 p-4 rounded-2xl border border-white/5">
                                    {[
                                        'NAME', 'GENDER', 'FUND SOURCE', 'POSITION', 
                                        'NATURE OF APPOINTMENT', 'STATUS (ITEM)', 'BACCALAUREATE', 
                                        'MAJOR/PRC SPECIALIZATION', 'BIRTHDAY', 'APPOINTMENT DATE', 
                                        'CIVIL STATUS', 'TEACHING LOAD'
                                    ].map(col => (
                                        <div key={col} className="flex items-center gap-2 group">
                                            <div className="w-1 h-1 rounded-full bg-rose-500 group-hover:scale-150 transition-transform" />
                                            <span className="text-[8px] font-black text-slate-300 tracking-widest uppercase italic">{col}</span>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[8px] font-black text-slate-500 text-center uppercase tracking-widest italic">
                                    Ensure 100% data compliance before scanning.
                                </p>
                            </motion.div>

                            {error && (
                                <motion.div 
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="bg-rose-50 border border-rose-100 p-5 rounded-2xl flex items-start gap-3 text-rose-700"
                                >
                                    <FiAlertCircle className="shrink-0 mt-0.5" size={16} />
                                    <div className="space-y-1">
                                        <p className="text-xs font-black uppercase tracking-widest">Validation Error</p>
                                        <p className="text-[10px] font-bold opacity-80 uppercase leading-relaxed">{error}</p>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    )}

                    {/* --- CASE 3: AUDIT COMPLETE - VERIFY LINK --- */}
                    {canUpload && scanResult && !isSubmitting && (
                        <div className="space-y-12">
                            <div className="text-center space-y-4">
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600/10 rounded-full border border-emerald-600/20">
                                    <span className="w-2 h-2 rounded-full bg-emerald-600 shadow-sm" />
                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest italic">Phase 2: Data Audit Review</span>
                                </div>
                                <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase leading-none italic">Verify Audit</h2>
                                <p className="text-[12px] font-bold text-slate-400 uppercase tracking-[0.3em] italic">Confirm detected personnel to unlock registry</p>
                            </div>

                            {/* Verification Summary (High Fidelity) */}
                            <div className="space-y-8">
                                {/* School Head Banner */}
                                <div 
                                    onClick={() => handleCategoryClick("School Head")}
                                    className={`p-8 rounded-[2.5rem] border ${confirmedCategories["School Head"] ? 'border-emerald-500 ring-4 ring-emerald-50' : 'border-slate-100'} bg-white shadow-sm flex items-center justify-between gap-6 relative overflow-hidden group cursor-pointer transition-all hover:border-blue-200`}
                                >
                                    <div className="flex items-center gap-6 relative">
                                        <div className="w-20 h-20 rounded-3xl bg-slate-900 flex flex-col items-center justify-center text-white text-center shadow-2xl">
                                            <FiShield className={confirmedCategories["School Head"] ? "text-emerald-400" : "text-blue-400"} />
                                            <span className="text-[8px] font-black uppercase tracking-tighter mt-1">{confirmedCategories["School Head"] ? "Verified" : "Confirm"}</span>
                                        </div>
                                        <div>
                                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Authenticated School Head</h3>
                                            <p className="text-2xl font-black text-slate-800 tracking-tight leading-none italic uppercase">{scanResult.summary.schoolHead}</p>
                                            <p className="text-[10px] font-bold text-blue-500 mt-2 uppercase tracking-widest italic">{scanResult.summary.schoolHeadPosition}</p>
                                        </div>
                                    </div>
                                    {confirmedCategories["School Head"] && <FiCheckCircle className="text-emerald-500 w-8 h-8" />}
                                </div>

                                {/* Categorization Grid */}
                                <div className="grid grid-cols-3 gap-6">
                                    <CategoryCard 
                                        label="Teaching staff" 
                                        value={scanResult.summary.teaching} 
                                        icon={<FiActivity />} 
                                        color="text-indigo-600 bg-indigo-50" 
                                        isConfirmed={confirmedCategories["Teaching Staff"]}
                                        onClick={() => handleCategoryClick("Teaching Staff")}
                                    />
                                    <CategoryCard 
                                        label="Related-Teaching" 
                                        value={scanResult.summary.relatedTeaching} 
                                        icon={<FiUserCheck />} 
                                        color="text-amber-600 bg-amber-50"
                                        isConfirmed={confirmedCategories["Related-Teaching"]}
                                        onClick={() => handleCategoryClick("Related-Teaching")}
                                    />
                                    <CategoryCard 
                                        label="Non-Teaching" 
                                        value={scanResult.summary.nonTeaching} 
                                        icon={<FiUsers />} 
                                        color="text-rose-600 bg-rose-50"
                                        isConfirmed={confirmedCategories["Non-Teaching Staff"]}
                                        onClick={() => handleCategoryClick("Non-Teaching Staff")}
                                    />
                                </div>

                                {/* Specialization Summary */}
                                {scanResult.summary.specializations && (
                                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                                                <FiAward />
                                            </div>
                                            <div>
                                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Teaching Personnel</h3>
                                                <p className="text-lg font-black text-slate-800 tracking-tight leading-none mt-1 uppercase italic">Detected Specializations</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {Object.entries(scanResult.summary.specializations)
                                                .filter(([_, count]) => count > 0)
                                                .map(([spec, count]) => (
                                                    <div key={spec} className="px-4 py-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                                                        <p className="text-[9px] font-black text-slate-500 uppercase truncate pr-2">{spec}</p>
                                                        <span className="text-xs font-black text-slate-900">{count}</span>
                                                    </div>
                                                ))
                                            }
                                        </div>
                                    </div>
                                )}

                                <div className="pt-4 text-center">
                                    <button 
                                        onClick={() => setScanResult(null)}
                                        className="text-[10px] font-black text-slate-400 hover:text-rose-500 uppercase tracking-widest underline underline-offset-8 transition-all"
                                    >
                                        Audit is incorrect? Click here to re-upload.
                                    </button>
                                </div>
                            </div>

                            {/* Phase 3: Registry Linking (ONLY SHOW AFTER CONFIRMATION) */}
                            {allAuditConfirmed ? (
                                <motion.div 
                                    initial={{ opacity: 0, y: 30 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white border-2 border-emerald-500 rounded-[2.5rem] p-10 shadow-2xl shadow-emerald-500/10 space-y-10 relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 bg-emerald-500 text-white px-6 py-2 rounded-bl-3xl flex items-center gap-2">
                                        <FiCheckCircle size={14} />
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Audit Verified</span>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-xs">03</div>
                                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight italic">Finalize Data Ingestion</h4>
                                        </div>
                                        
                                        <div className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100 flex items-start gap-4">
                                            <FiShield className="text-emerald-600 w-6 h-6 shrink-0 mt-1" />
                                            <div className="space-y-1">
                                                <h4 className="text-xs font-black text-emerald-900 uppercase">Secure Submission Ready</h4>
                                                <p className="text-[10px] font-bold text-emerald-700/70 leading-relaxed uppercase">
                                                    Your Personnel Registry has been successfully audited and matched with the National Database.
                                                    Proceed to finalize the submission to the SDO Secure Vault.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6 bg-emerald-50 border-2 border-emerald-500 rounded-3xl p-6 transition-all shadow-lg shadow-emerald-500/10">
                                            <div className="p-4 rounded-xl bg-emerald-500 text-white shadow-sm border border-emerald-400">
                                                <FiCheckCircle size={24} />
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-emerald-900 uppercase tracking-widest leading-none">Integrity Verified</p>
                                                <p className="text-[10px] font-bold text-emerald-700 mt-1 uppercase italic tracking-tight">Binary parsing complete</p>
                                            </div>
                                        </div>
                                    </div>

                                    <button 
                                        onClick={handlePreSubmitTrigger}
                                        disabled={isSubmitting}
                                        className="w-full py-6 bg-emerald-600 text-white rounded-[2rem] font-black uppercase tracking-[0.3em] transition-all shadow-2xl shadow-emerald-600/30 active:scale-[0.98] disabled:bg-slate-100 disabled:text-slate-300 disabled:shadow-none italic"
                                    >
                                        {isSubmitting ? "Syncing Registry..." : "Finalize Registry Submission"}
                                    </button>
                                </motion.div>

                            ) : (
                                <motion.div 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[3rem] p-12 text-center space-y-8"
                                >
                                    <div className="space-y-2">
                                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto text-slate-300 shadow-sm border border-slate-100">
                                            <FiLock size={28} />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-tighter italic">Phase 3 Registry Locked</h4>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Complete all audit acknowledgements to proceed</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
                                        {[
                                            { id: "School Head", label: "School Head" },
                                            { id: "Teaching Staff", label: "Teaching" },
                                            { id: "Related-Teaching", label: "Related" },
                                            { id: "Non-Teaching Staff", label: "Non-Teaching" }
                                        ].map(check => {
                                            const countKey = check.id === "Teaching Staff" ? "teaching" : 
                                                           check.id === "Related-Teaching" ? "relatedTeaching" : 
                                                           check.id === "Non-Teaching Staff" ? "nonTeaching" : "schoolHead";
                                            
                                            const finalPass = (countKey === "schoolHead" ? confirmedCategories["School Head"] : confirmedCategories[check.id]);

                                            return (


                                                <div key={check.id} className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${finalPass ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-slate-100 text-slate-300'}`}>
                                                    {finalPass ? <FiCheckCircle size={12} /> : <div className="w-3 h-3 rounded-full border-2 border-slate-100" />}
                                                    <span className="text-[9px] font-black uppercase tracking-widest">{check.label}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Final Submission Confirmation Modal */}
            <AnimatePresence>
                {showConfirmModal && (
                    <div key="confirm-modal" className="fixed inset-0 z-[200] flex items-center justify-center p-6">

                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowConfirmModal(false)}
                            className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
                        />
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="relative w-full max-w-lg bg-white rounded-[3rem] shadow-2xl p-10 text-center space-y-8 overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500" />
                            
                            <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center text-emerald-500 mx-auto shadow-sm">
                                <FiShield size={32} />
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-2xl font-black text-slate-800 tracking-tighter uppercase italic">Final Registry Seal</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic leading-relaxed">
                                    You are about to finalize the personnel registry for your school. 
                                    This action will lock your submission for SDO audit.
                                </p>
                            </div>

                            <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 space-y-4">
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Type <span className="text-emerald-600 font-bold tracking-widest">CONFIRM</span> to finalize</p>
                                <input 
                                    type="text" 
                                    placeholder="..."
                                    className="w-full bg-white border-2 border-slate-200 rounded-2xl py-5 px-6 text-center text-xl font-black tracking-[0.4em] uppercase transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 outline-none shadow-inner"
                                    value={confirmInput}
                                    onChange={(e) => setConfirmInput(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div className="flex flex-col gap-3">
                                <button 
                                    onClick={() => {
                                        if (confirmInput.toUpperCase() === "CONFIRM") {
                                            setShowConfirmModal(false);
                                            handleSubmitRegistry();
                                        }
                                    }}
                                    disabled={confirmInput.toUpperCase() !== "CONFIRM"}
                                    className="w-full py-6 bg-emerald-600 disabled:bg-slate-100 disabled:text-slate-300 text-white rounded-2xl font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-emerald-600/20 active:scale-95 italic"
                                >
                                    Seal & Submit Registry
                                </button>
                                <button 
                                    onClick={() => setShowConfirmModal(false)}
                                    className="text-[10px] font-black text-slate-400 hover:text-rose-500 uppercase tracking-widest transition-all"
                                >
                                    Wait, let me double check
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Edit Personnel Modal */}
            <AnimatePresence>
                {showEditModal && editingStaff && (
                    <div key="edit-modal" className="fixed inset-0 z-[250] flex items-center justify-center p-6">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowEditModal(false)}
                            className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
                        />
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl p-10 flex flex-col max-h-[90vh] overflow-hidden"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg">
                                        <FiUserCheck size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-slate-800 tracking-tighter uppercase italic">Edit Personnel</h3>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Manual Record Correction</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setShowEditModal(false)}
                                    className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-slate-100 transition-colors"
                                >
                                    <FiX />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-8 pr-4 custom-scrollbar">
                                {/* Name Section */}
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">First Name</label>
                                        <input 
                                            value={editingStaff.first || ""}
                                            onChange={(e) => setEditingStaff({...editingStaff, first: e.target.value.toUpperCase()})}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-xs font-bold text-slate-700 focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Last Name</label>
                                        <input 
                                            value={editingStaff.last || ""}
                                            onChange={(e) => setEditingStaff({...editingStaff, last: e.target.value.toUpperCase()})}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-xs font-bold text-slate-700 focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Middle Name</label>
                                        <input 
                                            value={editingStaff.middle || ""}
                                            onChange={(e) => setEditingStaff({...editingStaff, middle: e.target.value.toUpperCase()})}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-xs font-bold text-slate-700 focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                {/* Employee & TIN Section */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Employee Number</label>
                                        <input 
                                            value={editingStaff.employee_no || ""}
                                            onChange={(e) => setEditingStaff({...editingStaff, employee_no: e.target.value})}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-xs font-bold text-slate-700 focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">TIN</label>
                                        <input 
                                            value={editingStaff.tin || ""}
                                            onChange={(e) => setEditingStaff({...editingStaff, tin: e.target.value})}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-xs font-bold text-slate-700 focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                {/* Birthday Section */}
                                <div className="space-y-3">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Birthday (MM/DD/YYYY)</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        <select 
                                            value={editingStaff.birthday_mm || ""}
                                            onChange={(e) => setEditingStaff({...editingStaff, birthday_mm: e.target.value})}
                                            className="bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-xs font-bold text-slate-700 outline-none"
                                        >
                                            <option value="">Month</option>
                                            {MONTH_NAMES.map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>

                                        <select 
                                            value={editingStaff.birthday_dd || ""}
                                            onChange={(e) => setEditingStaff({...editingStaff, birthday_dd: e.target.value})}
                                            className="bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-xs font-bold text-slate-700 outline-none"
                                        >
                                            <option value="">Day</option>
                                            {Array.from({length: 31}, (_, i) => i + 1).map(d => (
                                                <option key={d} value={d}>{d.toString().padStart(2, '0')}</option>
                                            ))}
                                        </select>
                                        <select 
                                            value={editingStaff.birthday_yyyy || ""}
                                            onChange={(e) => setEditingStaff({...editingStaff, birthday_yyyy: e.target.value})}
                                            className="bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-xs font-bold text-slate-700 outline-none"
                                        >
                                            <option value="">Year</option>
                                            {BIRTH_YEARS.map(y => (
                                                <option key={y} value={y}>{y}</option>
                                            ))}
                                        </select>

                                    </div>
                                </div>

                                {/* Appointment Date Section */}
                                <div className="space-y-3">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Appointment Date (MM/DD/YYYY)</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        <select 
                                            value={editingStaff.appt_mm || ""}
                                            onChange={(e) => setEditingStaff({...editingStaff, appt_mm: e.target.value})}
                                            className="bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-xs font-bold text-slate-700 outline-none"
                                        >
                                            <option value="">Month</option>
                                            {MONTH_NAMES.map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>
                                        <select 
                                            value={editingStaff.appt_dd || "01"}
                                            onChange={(e) => setEditingStaff({...editingStaff, appt_dd: e.target.value})}
                                            className="bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-xs font-bold text-slate-700 outline-none"
                                        >
                                            <option value="">Day</option>
                                            {Array.from({length: 31}, (_, i) => i + 1).map(d => (
                                                <option key={d} value={d.toString().padStart(2, '0')}>{d.toString().padStart(2, '0')}</option>
                                            ))}
                                        </select>
                                        <select 
                                            value={editingStaff.appt_yyyy || ""}
                                            onChange={(e) => setEditingStaff({...editingStaff, appt_yyyy: e.target.value})}
                                            className="bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-xs font-bold text-slate-700 outline-none"
                                        >
                                            <option value="">Year</option>
                                            {APPT_YEARS.map(y => (
                                                <option key={y} value={y}>{y}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>


                                {/* Dropdowns Section */}
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Gender</label>
                                        <select 
                                            value={editingStaff.gender || ""}
                                            onChange={(e) => setEditingStaff({...editingStaff, gender: e.target.value})}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-xs font-bold text-slate-700 outline-none"
                                        >
                                            <option value="">Select Gender</option>
                                            <option value="MALE">MALE</option>
                                            <option value="FEMALE">FEMALE</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Civil Status</label>
                                        <select 
                                            value={editingStaff.civil_status || ""}
                                            onChange={(e) => setEditingStaff({...editingStaff, civil_status: e.target.value})}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-xs font-bold text-slate-700 outline-none"
                                        >
                                            <option value="">Select Status</option>
                                            {CIVIL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Fund Source</label>
                                        <select 
                                            value={editingStaff.fund_source || ""}
                                            onChange={(e) => setEditingStaff({...editingStaff, fund_source: e.target.value})}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-xs font-bold text-slate-700 outline-none"
                                        >
                                            <option value="">Select Source</option>
                                            {FUND_SOURCES.map(f => <option key={f} value={f}>{f}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Item Status</label>
                                        <select 
                                            value={editingStaff.status_item_ || ""}
                                            onChange={(e) => setEditingStaff({...editingStaff, status_item_: e.target.value})}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-xs font-bold text-slate-700 outline-none"
                                        >
                                            <option value="">Select Status</option>
                                            {ITEM_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>


                                <div className="space-y-1.5 pb-10">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Specialization</label>
                                    <select 
                                        value={editingStaff.major_specialization || ""}
                                        onChange={(e) => setEditingStaff({...editingStaff, major_specialization: e.target.value})}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-xs font-bold text-slate-700 outline-none"
                                    >
                                        <option value="">Select Specialization</option>
                                        {SPEC_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                                        <option value="OTHERS">OTHERS</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-8 border-t border-slate-100 flex gap-4">
                                <button 
                                    onClick={() => setShowEditModal(false)}
                                    className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all italic"
                                >
                                    Discard Changes
                                </button>
                                <button 
                                    onClick={handleSaveEdit}
                                    disabled={isSavingEdit}
                                    className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all disabled:bg-slate-100 disabled:text-slate-300 italic"
                                >
                                    {isSavingEdit ? "Securing Record..." : "Save Corrections"}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </PageTransition>


    );
};

const CategoryCard = ({ label, value, icon, color, onClick, isConfirmed }) => (
    <div onClick={onClick} className={`bg-white p-6 rounded-[2rem] border ${isConfirmed ? 'border-emerald-500 ring-4 ring-emerald-50' : 'border-slate-100'} shadow-sm space-y-3 cursor-pointer hover:border-blue-200 hover:shadow-xl hover:shadow-blue-500/5 transition-all group relative overflow-hidden`}>
        {isConfirmed && (
            <div className="absolute top-0 right-0 bg-emerald-500 text-white px-3 py-1.5 rounded-bl-2xl flex items-center gap-1 shadow-sm opacity-90">
                <FiCheckCircle className="w-3 h-3" />
                <span className="text-[8px] font-black uppercase tracking-widest pt-0.5">Reviewed</span>
            </div>
        )}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${color} group-hover:scale-110 transition-transform shadow-sm`}>
            {icon}
        </div>
        <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
            <p className="text-2xl font-black text-slate-800 tracking-tight group-hover:translate-x-1 transition-transform">{value}</p>
        </div>
    </div>
);

export default ESF7Draft;

