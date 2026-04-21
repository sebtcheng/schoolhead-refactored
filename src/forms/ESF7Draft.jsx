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
    FiClock, FiUserCheck, FiUsers, FiX, FiActivity, FiAward, FiInfo, FiChevronDown, FiDatabase, FiLock
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import PageTransition from '../components/PageTransition';
import { useAuth } from '../context/AuthContext';
import loadingLogo from "../assets/loading.gif";
import SuccessModal from '../components/SuccessModal';
import FailureModal from '../components/FailureModal';

const SubmissionLoader = ({ message }) => (
    <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/80 backdrop-blur-md"
    >
        <div className="flex flex-col items-center gap-6 text-center px-6">
            <div className="w-32 h-32 flex items-center justify-center">
                <img src={loadingLogo} className="w-full h-full object-contain drop-shadow-xl" alt="InsightEd Loading" />
            </div>
            <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-800 italic uppercase tracking-tighter">{message}</h3>
                <div className="flex items-center justify-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce"></span>
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-4">Connecting to InsightEd Secure Cloud</p>
            </div>
        </div>
    </motion.div>
);

const ESF7Draft = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    
    // Core State
    const [driveLink, setDriveLink] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [scanResult, setScanResult] = useState(null); // { rowCount, sampleRows, headers }
    const [error, setError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    
    // Status State
    const [statusData, setStatusData] = useState(null); // { status, uploaded_at, row_count, link }
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

    useEffect(() => {
        if (user?.school_id) fetchStatus();
    }, [user?.school_id]);

    const fetchStatus = async () => {
        setIsLoadingStatus(true);
        try {
            const res = await fetch(`/api/esf7/link-status/${user.school_id}`);
            const data = await res.json();
            if (data.success) {
                setStatusData(data.data);
                if (data.data.status === 'VERIFIED' || data.data.status === 'NEEDS_RESUBMISSION') fetchPersonnelData();
            }
        } catch (err) {
            console.error("Status check failed:", err);
        } finally {
            setIsLoadingStatus(false);
        }
    };

    const fetchPersonnelData = async () => {
        setIsFetchingData(true);
        try {
            const res = await fetch(`/api/esf7/data/${user.school_id}`);
            const data = await res.json();
            if (data.success) setPersonnelData(data.data);
        } catch (err) {
            console.error("Data fetch failed:", err);
        } finally {
            setIsFetchingData(false);
        }
    };

    const getComputedSummary = () => {
        // High-integrity fallback: if statusData.summary is missing, calculate from personnelData
        const s = statusData?.summary || {};
        if (Object.keys(s).length > 0 && (s.teaching || s.nonTeaching)) return s;

        if (!personnelData || personnelData.length === 0) return s;

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
        const specCounts = {};
        SPEC_LIST.forEach(spec => specCounts[spec] = 0);
        specCounts["OTHERS"] = 0;

        personnelData.forEach(r => {
            const pos = (r.position || "").toUpperCase();
            
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

        const admin = personnelData.find(p => {
            const pos = (p.position || "").toUpperCase();
            return pos.includes("PRINCIPAL") || pos.includes("HEAD TEACHER") || pos.includes("TIC") || pos.includes("OIC");
        });
        const schoolHead = admin ? `${admin.last}, ${admin.first}` : (user?.username || "N/A");
        const schoolHeadPosition = admin?.position || "School Head";

        return { 
            teaching, 
            relatedTeaching, 
            nonTeaching, 
            schoolHead, 
            schoolHeadPosition: admin?.position || "School Head",
            specializations: specCounts
        };
    };

    const computedSummary = getComputedSummary();

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

    const handleQuickScan = async () => {
        if (!driveLink.includes('drive.google.com')) {
            setError("Please provide a valid Google Drive link.");
            return;
        }
        setIsScanning(true);
        setError(null);
        setScanResult(null);

        try {
            // Rapid validation endpoint: checks service account access and returns metadata + small preview
            const res = await fetch('/api/esf7/link-scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ driveLink, school_id: user.school_id })
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "Access Denied. Ensure the service account was added.");

            setScanResult(result.data);
        } catch (err) {
            setFailureMessage(err.message);
            setShowFailure(true);
        } finally {
            setIsScanning(false);
        }
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
            // Check Non-Teaching FIRST to avoid 'Teaching Staff' string overlap
            if (category.includes("Non-Teaching")) {
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
            const res = await fetch(`/api/esf7/data/${user.school_id}`, {
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
        handleSubmit();
    };

    const handleSubmit = async () => {
        if (!scanResult || !user?.school_id) return;
        setIsSubmitting(true);
        try {
            const res = await fetch('/api/esf7/link-submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    school_id: user.school_id,
                    driveLink,
                    rowCount: scanResult.rowCount,
                    previewData: scanResult.sampleRows,
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
            setFailureMessage(err.message);
            setShowFailure(true);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmitRequest = async () => {
        if (!window.confirm("Are you sure you want to request a resubmission? This will be reviewed by the SDO.")) return;
        setIsSubmitting(true);
        try {
            const res = await fetch('/api/esf7/request-resubmission', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ school_id: user.school_id })
            });
            if (res.ok) {
                await fetchStatus();
            } else {
                const data = await res.json();
                throw new Error(data.error || "Request failed.");
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const isLocked = statusData && ['QUEUED', 'HARVESTING', 'VERIFIED', 'PENDING_RESUBMISSION'].includes(statusData.status);
    const isVerified = statusData && (statusData.status === 'VERIFIED' || statusData.status === 'NEEDS_RESUBMISSION');
    const isPendingResubmission = statusData && (statusData.status === 'PENDING_RESUBMISSION' || (statusData.request_status === 'PENDING' && statusData.status === 'VERIFIED'));
    const needsResubmission = statusData && (statusData.status === 'NEEDS_RESUBMISSION' || statusData.request_status === 'PENDING');
    const canUpload = !isLocked || needsResubmission;

    return (
        <PageTransition>
            <AnimatePresence>
                {(isScanning || isLoadingStatus) && (
                    <SubmissionLoader message={isScanning ? "Scanning Cloud File..." : "Checking Link Registry..."} />
                )}
                {isSubmitting && <SubmissionLoader message="Finalizing Submission..." />}
            </AnimatePresence>

            <div className="min-h-screen bg-[#fafbff] pb-24 font-sans relative overflow-hidden">
                <SuccessModal 
                    isOpen={showSuccess}
                    onClose={() => setShowSuccess(false)}
                    message="Final Registry Harvest Initiated! Your ESF7 link has been secured."
                    redirectUrl="/nodes-dashboard"
                />

                <FailureModal 
                    isOpen={showFailure}
                    onClose={() => setShowFailure(false)}
                    message={failureMessage}
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
                                 Form has been **FLAGGED**. Please review the remarks above. 
                                 The resubmission upload field will be opened by the SDO on the last week of the deadline.
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
                                                {statusData.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Registry Depth</p>
                                        <p className="text-3xl font-black text-slate-800 tracking-tighter">{statusData.row_count || 0}</p>
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

                    {/* --- CASE 3: VERIFIED RECORDS VIEW --- */}
                    {(isVerified && !needsResubmission) && (
                        <div className="space-y-8">
                            <div className="flex items-center justify-between px-2">
                                <div className="space-y-1">
                                    <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase italic">Verified Registry</h2>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest italic">Audited & Secure</p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <div className="bg-emerald-50 px-5 py-2.5 rounded-2xl border border-emerald-100 flex items-center gap-2">
                                        <FiShield className="text-emerald-500" />
                                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none">STATUS: {statusData.status}</span>
                                    </div>
                                    <button 
                                        onClick={handleSubmitRequest}
                                        disabled={isSubmitting}
                                        className="text-[9px] font-black text-slate-400 hover:text-blue-600 uppercase tracking-widest underline underline-offset-4 transition-all"
                                    >
                                        {isSubmitting ? "Requesting..." : "Request Resubmission"}
                                    </button>
                                </div>
                            </div>

                            {/* School Head Banner (Aesthetic Match) */}
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

                            {/* Categorization Grid (Aesthetic Match) */}
                            <div className="grid grid-cols-3 gap-4 sm:gap-6">
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

                            <div className="grid md:grid-cols-3 gap-6">
                                <div className="md:col-span-2 space-y-6">
                                    {/* SPECIALIZATION SUMMARY (Synchronized with Review Hub) */}
                                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                                                    <FiAward />
                                                </div>
                                                <div>
                                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Teaching Personnel</h3>
                                                    <p className="text-lg font-black text-slate-800 tracking-tight leading-none mt-1 uppercase italic">Specialization Breakdown</p>
                                                </div>
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
                                                 ))
                                             }
                                         </div>
                                         <div className="pt-2">
                                             <p className="text-center text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] italic">
                                                 Click cards above to audit individual names.
                                             </p>
                                         </div>
                                     </div>
                                 </div>

                                {/* Metadata Column */}
                                <div className="space-y-6">
                                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
                                        <div className="space-y-4">
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Total Row Registry</p>
                                                <div className="flex items-baseline gap-2">
                                                    <p className="text-5xl font-black text-slate-800 tracking-tighter">{derivedDepEdCount}</p>
                                                    <p className="text-xs font-bold text-slate-400 uppercase italic">
                                                        Personnel <span className="font-black not-italic text-[10px] text-blue-500 tracking-widest ml-1">(DepEd Funded)</span>
                                                    </p>
                                                </div>
                                            </div>

                                            {derivedLocalCount > 0 && (
                                                <div className="pt-4 border-t border-slate-100 space-y-3">
                                                    {Object.entries(otherFundSources).map(([fund, count]) => (
                                                        <div key={fund} className="flex items-baseline gap-2">
                                                            <p className="text-2xl font-black text-rose-600 tracking-tighter">{count}</p>
                                                            <p className="text-[10px] font-bold text-rose-400 uppercase italic">
                                                                Personnel <span className="font-black not-italic text-[9px] tracking-widest opacity-80">({fund})</span>
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-4">
                                            {statusData.uploaded_at && (
                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-slate-400 shadow-sm">
                                                        <FiArrowLeft className="rotate-180" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1 text-xs">Submission Log</p>
                                                        <p className="text-[10px] font-bold text-slate-700 uppercase italic leading-none">
                                                            {(() => {
                                                                const d = statusData.uploaded_at;
                                                                const date = new Date(d.toString().endsWith('Z') || d.toString().includes('+') ? d : d.toString().replace(' ', 'T') + 'Z');
                                                                return date.toLocaleString();
                                                            })()}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 space-y-2">
                                                <div className="flex items-center gap-2 text-blue-600">
                                                    <FiClock className="w-4 h-4" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">System Ingestion</span>
                                                </div>
                                                <p className="text-[10px] font-bold text-blue-800/60 uppercase leading-relaxed">
                                                    Data harvested and secured. Audit review is periodically updated by the SDO.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Staff Detail Modal (Mirrored from Review) */}
                    <AnimatePresence>
                        {showStaffModal && (
                            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
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
                                                                <div key={idx} className="p-5 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between group hover:bg-blue-50 hover:border-blue-200 transition-all">
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
                                                                    {Array.from({ length: Math.ceil(staffModalData.length / staffItemsPerPage) }, (_, i) => i + 1)
                                                                        .filter(p => p === 1 || p === Math.ceil(staffModalData.length / staffItemsPerPage) || (p >= staffCurrentPage - 1 && p <= staffCurrentPage + 1))
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

                                                        {/* Category-Specific Safeguard at the bottom of the list (Only for New Submissions) */}
                                                        {(!isVerified || statusData?.status === 'NEEDS_RESUBMISSION') && (
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
                                                    </>
                                                ) : (
                                                    <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">No filtered personnel found</p>
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
                        <div className="space-y-6">
                            <div className="text-center space-y-2">
                                <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase italic">Phase 1: Cloud Link</h2>
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.1em]">Automated Personnel Ingestion</p>
                            </div>

                            <motion.div 
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-10 shadow-2xl shadow-slate-200/50 space-y-8"
                            >
                                {/* Step 1: Shared Access */}
                                <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-6 space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl shrink-0 shadow-sm">
                                            <FiShield className="w-5 h-5" />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-black text-indigo-900 uppercase tracking-widest">1. Share with Service Account</h4>
                                            <p className="text-[10px] font-bold text-indigo-700/70 leading-relaxed uppercase">
                                                Grant <span className="text-indigo-900">"Viewer"</span> access to our automated harvester to enable extraction.
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-3 bg-white border-2 border-indigo-50 p-3 rounded-xl shadow-sm">
                                        <div className="flex-1 px-2 overflow-hidden">
                                            <span className="text-[9px] font-black text-slate-700 tracking-tight select-all leading-tight break-all">insighted-drive-access@insighted-drive-api.iam.gserviceaccount.com</span>
                                        </div>
                                        <button 
                                            onClick={handleCopyEmail}
                                            className="px-4 py-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2"
                                        >
                                            {copied ? <FiCheckCircle /> : <FiCopy />}
                                            {copied ? 'Copied' : 'Copy'}
                                        </button>
                                    </div>
                                </div>

                                {/* Step 2: Paste Link */}
                                <div className="space-y-4">
                                    <div className="space-y-1.5 ml-3">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">2. Paste Google Drive Link</h4>
                                    </div>
                                    <div className="flex items-center gap-4 bg-slate-50 border-2 border-slate-100 rounded-2xl p-5 focus-within:border-blue-400 focus-within:bg-white transition-all">
                                        <FiLink className="text-blue-500 w-6 h-6" />
                                        <input 
                                            type="text" 
                                            placeholder="https://drive.google.com/file/d/..."
                                            className="bg-transparent border-none outline-none flex-1 text-sm font-bold text-slate-700 placeholder:text-slate-300"
                                            value={driveLink}
                                            onChange={(e) => setDriveLink(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <button 
                                    onClick={handleQuickScan}
                                    disabled={!driveLink}
                                    className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl shadow-xl shadow-slate-900/20 disabled:opacity-50 transition-all flex items-center justify-center gap-3 uppercase italic tracking-tighter"
                                >
                                    <FiSearch className="w-5 h-5" />
                                    Verify Access & Quick Scan
                                </button>
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

                    {/* --- PHASE 2: QUICK SCAN RESULTS --- */}
                    {scanResult && !isLocked && (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="space-y-8"
                        >
                            <div className="flex items-center justify-between px-2">
                                <div className="space-y-1">
                                    <h2 className="text-2xl font-black text-slate-800 tracking-tighter uppercase italic">Phase 2: Data Audit</h2>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm" />
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest italic">Found {scanResult.rowCount} Personnel Total</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setScanResult(null)}
                                    className="text-[10px] font-black text-slate-400 hover:text-rose-500 uppercase tracking-widest border border-slate-200 px-4 py-2 rounded-full transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>

                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
                                    <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
                                        <FiDatabase />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase">Sheet Detected</p>
                                        <p className="text-sm font-black text-slate-800 italic">DB_USER</p>
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
                                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                                        <FiSearch />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase">File Format</p>
                                        <p className="text-sm font-black text-slate-800 italic">Excel Binary</p>
                                    </div>
                                </div>
                            </div>

                            {/* Categorization Grid (Aesthetic Match for Scan Results) */}
                            <div className="grid grid-cols-3 gap-4 sm:gap-6">
                                <CategoryCard 
                                    label="Teaching staff" 
                                    value={scanResult?.summary?.teaching || 0} 
                                    icon={<FiActivity />} 
                                    color="text-indigo-600 bg-indigo-50" 
                                    onClick={() => handleCategoryClick("Teaching staff")}
                                    isConfirmed={confirmedCategories["Teaching staff"]}
                                />
                                <CategoryCard 
                                    label="Related-Teaching" 
                                    value={scanResult?.summary?.relatedTeaching || 0} 
                                    icon={<FiUserCheck />} 
                                    color="text-amber-600 bg-amber-50"
                                    onClick={() => handleCategoryClick("Related-Teaching")}
                                    isConfirmed={confirmedCategories["Related-Teaching"]}
                                />
                                <CategoryCard 
                                    label="Non-Teaching" 
                                    value={scanResult?.summary?.nonTeaching || 0} 
                                    icon={<FiUsers />} 
                                    color="text-rose-600 bg-rose-50"
                                    onClick={() => handleCategoryClick("Non-Teaching Staff")}
                                    isConfirmed={confirmedCategories["Non-Teaching Staff"]}
                                />
                            </div>

                            <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100/50 flex items-start gap-4">
                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-500 shadow-sm shrink-0">
                                    <FiShield />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-[10px] font-black text-blue-900 uppercase tracking-widest">System Audit Ready</h4>
                                    <p className="text-[10px] font-bold text-blue-700/70 leading-relaxed uppercase italic">
                                        Total of {scanResult.rowCount} records detected. The breakdown above represents valid **NATIONAL / DEPED** funded items found in your ESF7.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <button 
                                    onClick={handlePreSubmitTrigger}
                                    disabled={
                                        isSubmitting || 
                                        (statusData && statusData.status === 'QUEUED') ||
                                        (scanResult?.summary?.teaching > 0 && !confirmedCategories["Teaching staff"]) ||
                                        (scanResult?.summary?.relatedTeaching > 0 && !confirmedCategories["Related-Teaching"]) ||
                                        (scanResult?.summary?.nonTeaching > 0 && !confirmedCategories["Non-Teaching Staff"])
                                    }
                                    className="w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-700 disabled:from-slate-200 disabled:to-slate-300 text-white disabled:text-slate-400 font-black rounded-[2rem] shadow-xl shadow-blue-500/20 disabled:shadow-none active:scale-95 transition-all flex items-center justify-center gap-3 uppercase italic tracking-tight"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <FiLoader className="animate-spin" />
                                            <span>Submitting Registry...</span>
                                        </>
                                    ) : (
                                        (scanResult?.summary?.teaching > 0 && !confirmedCategories["Teaching staff"]) ||
                                        (scanResult?.summary?.relatedTeaching > 0 && !confirmedCategories["Related-Teaching"]) ||
                                        (scanResult?.summary?.nonTeaching > 0 && !confirmedCategories["Non-Teaching Staff"])
                                    ) ? (
                                        <>
                                            <FiLock className="w-5 h-5 opacity-50" />
                                            <span>Finish Reviewing All Personnel First</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Confirm & Submit {scanResult.rowCount} Personnel</span>
                                            <FiCheckCircle size={20} />
                                        </>
                                    )}
                                </button>
                                <p className="text-center text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] italic">
                                    Finalizing locks the form for SDO review.
                                </p>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>
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
