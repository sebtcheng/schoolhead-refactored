import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    FiArrowLeft, 
    FiUploadCloud, 
    FiLink, 
    FiCheckCircle, 
    FiAlertCircle, 
    FiFileText,
    FiLoader,
    FiSearch,
    FiMonitor,
    FiCopy,
    FiShield
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
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
    const fileInputRef = useRef(null);
    
    const [uploadMode, setUploadMode] = useState('file'); // Default to file upload flow
    const [isParsing, setIsParsing] = useState(false);
    const [error, setError] = useState(null);
    const [parsedRecords, setParsedRecords] = useState([]);
    const [parsedData, setParsedData] = useState(null);
    const [driveLink, setDriveLink] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopyEmail = () => {
        navigator.clipboard.writeText('insighted-drive-access@insighted-drive-api.iam.gserviceaccount.com');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const [existingStatus, setExistingStatus] = useState(null);
    const [existingCount, setExistingCount] = useState(0);
    const [isLoadingStatus, setIsLoadingStatus] = useState(true);
    const [resubmitRequestStatus, setResubmitRequestStatus] = useState(null); // PENDING, APPROVED, etc.
    const [resubmitReason, setResubmitReason] = useState('');

    React.useEffect(() => {
        if (user?.school_id) fetchExistingStatus();
    }, [user?.school_id]);

    const fetchExistingStatus = async () => {
        setIsLoadingStatus(true);
        try {
            const [statusRes, reqRes] = await Promise.all([
                fetch(`/api/esf7/status/${user.school_id}`),
                fetch(`/api/esf7/request-status/${user.school_id}`)
            ]);

            const statusData = await statusRes.json();
            const reqData = await reqRes.json();

            if (statusData.success) setExistingStatus(statusData.status);
            setResubmitRequestStatus(reqData.status);

            // If we have status, fetch records to get count
            if (statusData.status !== 'NOT_STARTED') {
                const recRes = await fetch(`/api/esf7/records/${user.school_id}`);
                const recData = await recRes.json();
                if (recData.success) setExistingCount(recData.data.length);
            }
        } catch (err) {
            console.error("Fetch Status Error:", err);
        } finally {
            setIsLoadingStatus(false);
        }
    };

    const handleRequestResubmit = async () => {
        if (!resubmitReason.trim()) return alert("Please provide a reason.");
        setIsSubmitting(true);
        try {
            const res = await fetch('/api/esf7/request-resubmit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    school_id: user.school_id,
                    school_name: user?.school_name,
                    reason: resubmitReason
                })
            });
            if (res.ok) {
                alert("Request sent successfully.");
                fetchExistingStatus();
            }
        } catch (err) {
            alert("Failed to send request.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Verify it's an .xlsb or .xlsx file (ideally .xlsb but xlsx also works for testing)
        if (!file.name.endsWith('.xlsb') && !file.name.endsWith('.xlsx')) {
            setError("Invalid file type. Please upload an .xlsb or .xlsx ESF7 master file.");
            return;
        }

        setIsParsing(true);
        setError(null);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'array' });
                
                // Find DB_USER sheet
                const dbUserSheet = wb.Sheets['DB_USER'];
                if (!dbUserSheet) {
                    throw new Error("Missing 'DB_USER' technical sheet. Please ensure you are uploading the correct ESF7 master file.");
                }

                // Get raw rows to handle blank headers and positional columns (like OB)
                const rows = XLSX.utils.sheet_to_json(dbUserSheet, { header: 1, defval: "" });
                if (rows.length < 2) throw new Error("The 'DB_USER' sheet is empty or invalid.");

                // Row 0 usually contains headers
                const rawHeaders = rows[0];
                
                // Process records from row 1 onwards
                const records = rows.slice(1).filter(r => r.some(v => v !== null && v !== undefined && String(v).trim() !== "")).map(row => {
                    const record = {};
                    rawHeaders.forEach((h, i) => {
                        let key = h ? String(h).trim() : `col_${i}`;
                        record[key] = row[i] || "";
                    });
                    
                    // Positional capture for OB (Index 391) which is blank in original file but is APPT_YYYY
                    if (row[391] !== undefined) {
                        record['appt_yyyy'] = row[391];
                    }
                    
                    return record;
                });

                if (!records.length) {
                    throw new Error("No valid personnel data found in the sheet.");
                }

                setParsedRecords(records);
                setParsedData({
                    totalRows: records.length,
                    sample: records.slice(0, 5).map(r => Object.values(r)),
                    headers: Object.keys(records[0])
                });

            } catch (err) {
                console.error("Parsing Error:", err);
                setError(err.message || "Failed to parse the workbook. Ensure it is a valid ESF7 file.");
            } finally {
                setIsParsing(false);
            }
        };

        reader.onerror = () => {
            setError("Failed to read file.");
            setIsParsing(false);
        };

        reader.readAsArrayBuffer(file);
    };

    const handleLinkSubmit = async () => {
        if (!driveLink.includes('drive.google.com')) {
            setError("Please provide a valid Google Drive link.");
            return;
        }
        setIsParsing(true);
        setError(null);

        try {
            const res = await fetch('/api/esf7/extract-preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ driveLink })
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "Failed to extract data from link.");

            const { records, headers, totalRows, sample } = result.data;

            setParsedRecords(records);
            setParsedData({
                totalRows,
                sample,
                headers
            });

        } catch (err) {
            console.error("Extraction Error:", err);
            setError(err.message || "An error occurred during extraction.");
        } finally {
            setIsParsing(false);
        }
    };

    const handleSubmit = async () => {
        if (!parsedRecords.length || !user?.school_id) return;

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/esf7/stage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    school_id: user.school_id,
                    records: parsedRecords
                })
            });

            if (res.ok) {
                setSubmitSuccess(true);
                setTimeout(() => navigate('/nodes-dashboard'), 2000);
            } else {
                const data = await res.json();
                throw new Error(data.error || "Failed to stage data.");
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <PageTransition>
            <AnimatePresence>
                {(isParsing || isLoadingStatus) && <SubmissionLoader message={isParsing ? "Extracting from Cloud..." : "Syncing with InsightEd Cloud..."} />}
                {isSubmitting && <SubmissionLoader message="Staging your records..." />}
            </AnimatePresence>
            <div className="min-h-screen bg-slate-50 pb-24">
                {/* --- HEADER --- */}
                <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/nodes-dashboard')} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                            <FiArrowLeft className="w-6 h-6 text-slate-600" />
                        </button>
                        <div>
                            <h1 className="text-xl font-black text-slate-800 tracking-tight leading-none uppercase italic">ESF7 Hub</h1>
                            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Implementation & Monitoring</p>
                        </div>
                    </div>
                </header>

                <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
                    {/* --- STATUS DASHBOARD (Reflection & Resubmission Request) --- */}
                    {(existingStatus === 'PENDING_SDO' || existingStatus === 'VERIFIED' || existingStatus === 'REJECTED') && (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white border-2 border-blue-50 rounded-[2.5rem] p-8 shadow-sm space-y-6"
                        >
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Submission Status</h3>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-3 h-3 rounded-full animate-pulse ${existingStatus === 'VERIFIED' ? 'bg-emerald-500' : existingStatus === 'REJECTED' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                                        <span className={`text-xl font-black uppercase italic tracking-tighter ${existingStatus === 'VERIFIED' ? 'text-emerald-600' : existingStatus === 'REJECTED' ? 'text-rose-600' : 'text-amber-600'}`}>
                                            {existingStatus.replace('_', ' ')}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Records Processed</p>
                                    <p className="text-2xl font-black text-slate-800 tracking-tighter">{existingCount}</p>
                                </div>
                            </div>
                            
                            <div className="pt-6 border-t border-slate-50 space-y-6">
                                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex items-start gap-4">
                                    <FiShield className="text-indigo-600 w-6 h-6 shrink-0" />
                                    <p className="text-[11px] font-bold text-slate-500 leading-relaxed uppercase">
                                        {existingStatus === 'VERIFIED' 
                                            ? "Module Locked: Your ESF7 has been officially verified by SGOD. Changes are no longer allowed without a formal resubmission request approval." 
                                            : existingStatus === 'REJECTED'
                                            ? "Submission Returned: The SDO has returned your data for correction. You may re-upload the corrected file below."
                                            : "Locked for Audit: Your data is currently being reviewed by the Division Office. To ensure audit integrity, the module is locked."}
                                    </p>
                                </div>

                                {existingStatus !== 'REJECTED' && (
                                    <div className="space-y-4">
                                        {resubmitRequestStatus === 'PENDING' ? (
                                            <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100 flex flex-col items-center gap-3 text-center">
                                                <FiLoader className="text-amber-500 animate-spin" />
                                                <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest italic">Resubmission Request Awaiting SGOD Approval</p>
                                                <p className="text-[9px] font-bold text-amber-600/70 leading-relaxed italic uppercase">Our system has notified the Division Office. You will be able to re-upload once they unlock this module for you.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Justification for Resubmission</label>
                                                    <textarea 
                                                        value={resubmitReason}
                                                        onChange={(e) => setResubmitReason(e.target.value)}
                                                        placeholder="e.g. Correction of teacher loading entries, missing records in previous upload..."
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] p-5 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-100 transition-all outline-none min-h-[100px]"
                                                    />
                                                </div>
                                                <button 
                                                    onClick={handleRequestResubmit}
                                                    className="w-full py-5 bg-indigo-600 text-white text-[10px] font-black rounded-3xl shadow-xl shadow-indigo-200 active:scale-95 transition-all uppercase italic tracking-widest flex items-center justify-center gap-3"
                                                >
                                                    Request Unlocking
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* --- PHASE 1: UPLOAD --- */}
                    {(!existingStatus || existingStatus === 'NOT_STARTED' || existingStatus === 'REJECTED') && !parsedData && (
                        <div className="space-y-6">
                            <div className="text-center space-y-2">
                                <h2 className="text-2xl font-black text-slate-800 tracking-tighter uppercase italic">
                                    {existingStatus ? 'Phase 1: Update Connection' : 'Phase 1: Cloud Connection'}
                                </h2>
                                <p className="text-sm font-medium text-slate-500">
                                    {existingStatus 
                                        ? "Resubmission Unlocked. Paste the new Google Drive link below." 
                                        : "Paste your ESF7 Google Drive link to start the automated extraction."}
                                </p>
                            </div>

                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-10 shadow-xl shadow-slate-200/50 space-y-6"
                            >
                                {/* Mode Selection */}
                                <div className="flex p-1 bg-slate-100 rounded-2xl">
                                    <button 
                                        onClick={() => setUploadMode('file')}
                                        className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${uploadMode === 'file' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                                    >
                                        Direct Upload
                                    </button>
                                    <button 
                                        onClick={() => setUploadMode('link')}
                                        className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${uploadMode === 'link' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                                    >
                                        Cloud Link
                                    </button>
                                </div>

                                {uploadMode === 'file' ? (
                                    <div 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-slate-200 rounded-[2rem] p-12 text-center space-y-4 hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer group"
                                    >
                                        <input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            className="hidden" 
                                            accept=".xlsb,.xlsx"
                                            onChange={handleFileUpload}
                                        />
                                        <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                                            <FiUploadCloud size={32} />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-tighter italic">Upload Personnel Intelligence Sheet</h4>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Supports .xlsb (Binary) or .xlsx</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {/* Security Advisory */}
                                        <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5 space-y-4">
                                            <div className="flex items-start gap-3">
                                                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl shrink-0">
                                                    <FiShield className="w-5 h-5" />
                                                </div>
                                                <div className="space-y-1">
                                                    <h4 className="text-xs font-black text-indigo-900 uppercase tracking-widest">Strictly Private File Sharing</h4>
                                                    <p className="text-[10px] font-bold text-indigo-700/70 leading-relaxed">
                                                        To protect sensitive personnel data, keep your Google Drive file <span className="font-black text-indigo-900">Restricted</span>. Grant viewer access <span className="underline decoration-indigo-300">only</span> to the system email below.
                                                    </p>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-3 bg-white border-2 border-indigo-50 p-2.5 rounded-xl">
                                                <div className="flex-1 px-2">
                                                    <span className="text-[10px] font-black text-slate-700 tracking-tight select-all leading-tight break-all">insighted-drive-access@insighted-drive-api.iam.gserviceaccount.com</span>
                                                </div>
                                                <button 
                                                    onClick={handleCopyEmail}
                                                    className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2"
                                                >
                                                    {copied ? <FiCheckCircle /> : <FiCopy />}
                                                    {copied ? 'Copied' : 'Copy'}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-2xl p-5 hover:border-blue-300 transition-colors">
                                            <FiLink className="text-blue-500 w-6 h-6" />
                                            <input 
                                                type="text" 
                                                placeholder="Paste Google Drive Link"
                                                className="bg-transparent border-none outline-none flex-1 text-sm font-bold text-slate-700 placeholder:text-slate-300"
                                                value={driveLink}
                                                onChange={(e) => setDriveLink(e.target.value)}
                                                disabled={isParsing}
                                            />
                                        </div>
                                        <button 
                                            onClick={handleLinkSubmit}
                                            disabled={isParsing || !driveLink}
                                            className="w-full py-5 bg-[#004A99] text-white font-black rounded-2xl shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 italic"
                                        >
                                            {isParsing ? (
                                                <>
                                                    <FiLoader className="animate-spin" />
                                                    <span>CONNECTING TO DRIVE...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <FiUploadCloud />
                                                    <span>EXTRACT FROM CLOUD</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </motion.div>

                            {error && (
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-center gap-3 text-rose-700 text-xs font-bold"
                                >
                                    <FiAlertCircle className="shrink-0" />
                                    <p>{error}</p>
                                </motion.div>
                            )}
                        </div>
                    )}

                    {/* --- PHASE 2: PREVIEW & STAGING --- */}
                    {parsedData && (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="space-y-8"
                        >
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <h2 className="text-2xl font-black text-slate-800 tracking-tighter uppercase italic">Phase 2: X-Ray Preview</h2>
                                    <div className="flex items-center gap-2">
                                        <FiCheckCircle className="text-emerald-500" />
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest underline decoration-emerald-200 underline-offset-4 decoration-2">Successfully Mapped {parsedData.totalRows} Personnel</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setParsedData(null)}
                                    className="text-[10px] font-black text-slate-400 hover:text-rose-500 uppercase tracking-widest border border-slate-200 px-3 py-1.5 rounded-full transition-colors"
                                >
                                    Reset
                                </button>
                            </div>

                            {/* Preview Grid */}
                            <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-slate-200/50">
                                <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
                                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Staging Database Preview (Draft)</span>
                                    <FiSearch className="text-slate-500" />
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100">
                                                {parsedData.headers.slice(0, 5).map((h, i) => (
                                                    <th key={i} className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{h || '-'}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {parsedData.sample.map((row, i) => (
                                                <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                                                    {row.slice(0, 5).map((cell, ci) => (
                                                        <td key={ci} className="px-6 py-4 text-xs font-bold text-slate-700 truncate max-w-[120px]">
                                                            {cell || '-'}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                                    <p className="text-[10px] font-bold text-slate-400 italic">Showing 5 of {parsedData.totalRows} records extracted from cloud link.</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <button 
                                    onClick={handleSubmit}
                                    disabled={isSubmitting || submitSuccess}
                                    className={`w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-black rounded-[2rem] shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase italic tracking-tight ${isSubmitting || submitSuccess ? 'opacity-70 cursor-not-allowed' : ''}`}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <FiLoader className="animate-spin" />
                                            <span>Staging Data...</span>
                                        </>
                                    ) : submitSuccess ? (
                                        <>
                                            <FiCheckCircle />
                                            <span>Successfully Staged!</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Submit for SDO Review</span>
                                            <FiCheckCircle size={20} />
                                        </>
                                    )}
                                </button>
                                <p className="text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                    {submitSuccess ? 'Redirecting to Nexus...' : 'Data will be staged as PENDING_SDO'}
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {/* --- HELP CARD / RESUBMIT --- */}
                    {existingStatus === 'VERIFIED' ? (
                        <div className="bg-emerald-50 border-2 border-emerald-100 rounded-[2.5rem] p-10 flex items-start gap-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-100/30 rounded-full blur-2xl"></div>
                            <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center shadow-lg border border-emerald-50 shrink-0">
                                <FiCheckCircle className="text-emerald-500 w-8 h-8" />
                            </div>
                            <div className="space-y-3 flex-1">
                                <div className="space-y-1">
                                    <h4 className="text-sm font-black text-emerald-700 uppercase tracking-tighter">Officially Verified</h4>
                                    <p className="text-xs font-medium text-slate-500 leading-relaxed">
                                        Your ESF7 data has been committed to the master database by the SDO. No further action is required.
                                    </p>
                                </div>
                                <button
                                    onClick={() => { setShowConfirmChallenge(true); setShowResubmitInput(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                    className="text-[10px] font-black text-emerald-700 border border-emerald-200 bg-white px-4 py-2 rounded-full uppercase tracking-widest hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all"
                                >
                                    Request Resubmission
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-[#004A99]/5 border-2 border-blue-100 rounded-[2.5rem] p-10 flex items-start gap-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100/30 rounded-full blur-2xl"></div>
                            <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center shadow-lg border border-blue-50 shrink-0">
                                <FiMonitor className="text-blue-500 w-8 h-8" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-sm font-black text-[#004A99] uppercase tracking-tighter">Private Cloud Policy</h4>
                                <p className="text-xs font-medium text-slate-500 leading-relaxed">
                                    InsightEd uses cloud links for data integrity. Please ensure your ESF7 file is hosted on <span className="text-blue-600 font-bold">Google Drive</span> and shared <span className="font-bold text-slate-700">only</span> with the Google Service Account email shown above to maintain privacy.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </PageTransition>
    );
};

export default ESF7Draft;
