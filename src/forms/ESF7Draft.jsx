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
    FiDatabase,
    FiClock
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import PageTransition from '../components/PageTransition';
import { useAuth } from '../context/AuthContext';
import loadingLogo from "../assets/loading.gif";

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
    const itemsPerPage = 10;

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
                if (data.data.status === 'VERIFIED') fetchPersonnelData();
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
            setError(err.message);
        } finally {
            setIsScanning(false);
        }
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
                setSubmitSuccess(true);
                setTimeout(() => navigate('/nodes-dashboard'), 2000);
            } else {
                const data = await res.json();
                throw new Error(data.error || "Submission failed.");
            }
        } catch (err) {
            setError(err.message);
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

    const isLocked = statusData && ['PENDING_SDO', 'QUEUED', 'HARVESTING', 'VERIFIED', 'PENDING_RESUBMISSION'].includes(statusData.status);
    const isVerified = statusData && statusData.status === 'VERIFIED';
    const isPendingResubmission = statusData && statusData.status === 'PENDING_RESUBMISSION';

    return (
        <PageTransition>
            <AnimatePresence>
                {(isScanning || isLoadingStatus) && (
                    <SubmissionLoader message={isScanning ? "Scanning Cloud File..." : "Checking Link Registry..."} />
                )}
                {isSubmitting && <SubmissionLoader message="Finalizing Submission..." />}
            </AnimatePresence>

            <div className="min-h-screen bg-[#fafbff] pb-24 font-sans relative overflow-hidden">
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
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Submitted: {new Date(statusData.uploaded_at).toLocaleString()}</p>
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
                    {isVerified && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between px-2">
                                <div className="space-y-1">
                                    <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase italic">Verified Personnel</h2>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest italic">Syncing Live with ESF7 Database</p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <div className="bg-emerald-50 px-5 py-2.5 rounded-2xl border border-emerald-100 flex items-center gap-2">
                                        <FiShield className="text-emerald-500" />
                                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none">Status: VERIFIED</span>
                                    </div>
                                    <button 
                                        onClick={handleSubmitRequest}
                                        disabled={isSubmitting}
                                        className="text-[9px] font-black text-slate-400 hover:text-blue-600 uppercase tracking-widest underline decoration-slate-200 underline-offset-4 transition-all"
                                    >
                                        {isSubmitting ? "Requesting..." : "Request Resubmission"}
                                    </button>
                                </div>
                            </div>

                            {/* Policy Note */}
                            <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100/50 flex items-start gap-4 mx-2">
                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-500 shadow-sm shrink-0">
                                    <FiClock />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-[10px] font-black text-blue-900 uppercase tracking-widest">Resubmission Policy</h4>
                                    <p className="text-[10px] font-bold text-blue-700/70 leading-relaxed uppercase italic">
                                        NOTE: Resubmission will only be accommodated during the last week of the submission deadline.
                                    </p>
                                </div>
                            </div>

                            <div className="relative">
                                <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="Search Personnel Registry..." 
                                    className="w-full pl-12 pr-6 py-4 bg-white border-2 border-slate-100 rounded-3xl text-sm font-bold focus:border-emerald-400 transition-all outline-none shadow-sm"
                                    value={verifySearchTerm}
                                    onChange={(e) => {
                                        setVerifySearchTerm(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                />
                            </div>

                            <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-slate-200/40">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-900 text-white">
                                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest italic">Personnel Name</th>
                                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest italic">Position</th>
                                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest italic text-right">Appointment</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {isFetchingData ? (
                                                <tr>
                                                    <td colSpan="3" className="px-6 py-20 text-center">
                                                        <FiLoader className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-4" />
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Streaming registry data...</p>
                                                    </td>
                                                </tr>
                                            ) : (
                                                (() => {
                                                    const filtered = personnelData.filter(p => 
                                                        `${p.first} ${p.last}`.toLowerCase().includes(verifySearchTerm.toLowerCase()) ||
                                                        p.position?.toLowerCase().includes(verifySearchTerm.toLowerCase())
                                                    );
                                                    const totalPages = Math.ceil(filtered.length / itemsPerPage);
                                                    const currentItems = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

                                                    return (
                                                        <>
                                                            {currentItems.map((person, idx) => (
                                                                <tr key={idx} className="hover:bg-emerald-50/30 transition-colors">
                                                                    <td className="px-6 py-5">
                                                                        <p className="text-[11px] font-black text-slate-800 uppercase italic tracking-tight">{person.first} {person.last}</p>
                                                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{person.gender || 'N/A'}</p>
                                                                    </td>
                                                                    <td className="px-6 py-5">
                                                                        <p className="text-[10px] font-bold text-slate-600 uppercase leading-snug">{person.position}</p>
                                                                        <p className="text-[8px] font-black text-blue-500 uppercase tracking-tighter mt-1">{person.fund_source}</p>
                                                                    </td>
                                                                    <td className="px-6 py-5 text-right">
                                                                        <p className="text-[10px] font-black text-slate-700 uppercase italic">{person.appt_mm && person.appt_yyyy ? `${person.appt_mm}/${person.appt_yyyy}` : 'N/A'}</p>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                            {/* Paging Footer */}
                                                            {totalPages > 1 && (
                                                                <tr>
                                                                    <td colSpan="3" className="px-6 py-4 bg-slate-50/50">
                                                                        <div className="flex items-center justify-between">
                                                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                                                Page {currentPage} of {totalPages}
                                                                            </p>
                                                                            <div className="flex items-center gap-2">
                                                                                <button 
                                                                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                                                    disabled={currentPage === 1}
                                                                                    className="p-2 bg-white border border-slate-200 rounded-xl disabled:opacity-30 transition-all active:scale-90"
                                                                                >
                                                                                    <FiArrowLeft className="w-4 h-4" />
                                                                                </button>
                                                                                <button 
                                                                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                                                    disabled={currentPage === totalPages}
                                                                                    className="p-2 bg-white border border-slate-200 rounded-xl disabled:opacity-30 transition-all active:scale-90"
                                                                                >
                                                                                    <FiArrowLeft className="w-4 h-4 rotate-180" />
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </>
                                                    );
                                                })()
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                {!isFetchingData && personnelData.length === 0 && (
                                    <div className="py-20 text-center uppercase tracking-[0.2em] font-black text-slate-300 text-[10px] italic">
                                        No personnel matched your search criteria
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

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
                    {!isLocked && !scanResult && (
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

                            {/* Preview Table (First 5 Rows) */}
                            <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-slate-200/50">
                                <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
                                    <span className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em]">Audit Preview (First 5 Items)</span>
                                    <FiShield className="text-slate-600" />
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <tbody className="divide-y divide-slate-50">
                                            {scanResult.sampleRows.map((row, i) => (
                                                <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                                                    {row.slice(0, 4).map((cell, ci) => (
                                                        <td key={ci} className="px-6 py-4 text-[10px] font-bold text-slate-700 truncate max-w-[150px] uppercase">
                                                            {cell || '-'}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                                    <p className="text-[9px] font-bold text-slate-400 italic uppercase">Showing top {scanResult.sampleRows.length} for audit • All {scanResult.rowCount} records are secured for harvesting</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <button 
                                    onClick={handleSubmit}
                                    disabled={isSubmitting || submitSuccess}
                                    className="w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-black rounded-[2rem] shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase italic tracking-tight"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <FiLoader className="animate-spin" />
                                            <span>Submitting Registry...</span>
                                        </>
                                    ) : submitSuccess ? (
                                        <>
                                            <FiCheckCircle />
                                            <span>Link Secured!</span>
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

export default ESF7Draft;
