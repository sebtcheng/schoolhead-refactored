import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    FiArrowLeft, FiInfo, FiUsers, FiTrendingUp, FiLayout, FiBox, 
    FiLayers, FiUser, FiActivity, FiServer, FiHeart, FiCheckCircle, 
    FiMessageSquare, FiX, FiSend, FiAlertTriangle, FiChevronDown, FiChevronUp 
} from 'react-icons/fi';
import { TbSchool, TbReportAnalytics } from "react-icons/tb";
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

// Import Modular Units
import Unit1SchoolIdentity from '../components/modular/Unit1SchoolIdentity';
import Unit2Learners from '../components/modular/Unit2Learners';
import Unit3OrganizedClasses from '../components/modular/Unit3OrganizedClasses';
import Unit4LearnerProfile from '../components/modular/Unit4LearnerProfile';
import Unit5ShiftingModality from '../components/modular/Unit5ShiftingModality';
import Unit6SchoolResources from '../components/modular/Unit6SchoolResources';
import Unit7PhysicalFacilities from '../components/modular/Unit7PhysicalFacilities';
import Unit8SchoolLocation from '../components/modular/Unit8SchoolLocation';
import Unit9Infrastructure from '../components/modular/Unit9Infrastructure';

const SchoolAuditView = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [expandedUnit, setExpandedUnit] = useState('u1'); // Track which unit is expanded
    const [schoolData, setSchoolData] = useState(null);
    
    // Remarks Logic
    const [remarks, setRemarks] = useState([]);
    const [isRemarkModalOpen, setIsRemarkModalOpen] = useState(false);
    const [remarkUnitId, setRemarkUnitId] = useState(''); // Target unit for remark
    const [newRemark, setNewRemark] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchRemarks = async (schoolId) => {
        try {
            const res = await fetch(`/api/audit/remarks/${schoolId}`);
            if (res.ok) {
                const result = await res.json();
                setRemarks(result.data || []);
            }
        } catch (e) {
            console.error('Failed to fetch remarks:', e);
        }
    };

    const handleAddRemark = async () => {
        if (!newRemark.trim() || !schoolData || !remarkUnitId) return;
        setIsSubmitting(true);
        try {
            const res = await fetch('/api/audit/remarks', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    school_id: schoolData.id,
                    unit_id: remarkUnitId,
                    remark: newRemark,
                    auditor_uid: user?.uid || null,
                    auditor_name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || 'Unknown Auditor'
                })
            });
            if (res.ok) {
                setNewRemark('');
                setIsRemarkModalOpen(false);
                fetchRemarks(schoolData.id);
            } else {
                let errorMessage = 'Failed to submit remark. Please try again.';
                try {
                    const errorData = await res.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (jsonErr) {
                    console.error('Could not parse error JSON:', jsonErr);
                }
                alert(errorMessage);
            }
        } catch (e) {
            console.error('Failed to add remark:', e);
            alert('Failed to submit remark. Please check your connection.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleVerifyRemark = async (remarkId) => {
        try {
            const res = await fetch(`/api/audit/remarks/${remarkId}/resolve`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            if (res.ok) {
                fetchRemarks(schoolData.id);
                setExpandedUnit(null); // Auto-collapse on resolve
            } else {
                const errorData = await res.json();
                alert(errorData.error || 'Failed to verify remark. Please try again.');
            }
        } catch (e) {
            console.error('Failed to verify remark:', e);
            alert('An error occurred while verifying the remark.');
        }
    };

    useEffect(() => {
        const storedId = sessionStorage.getItem('targetSchoolId');
        const storedName = sessionStorage.getItem('targetSchoolName');

        if (!storedId) {
            navigate('/jurisdiction-schools');
            return;
        }

        sessionStorage.setItem("isViewingAsSuperUser", "true");

        setSchoolData({
            id: storedId,
            name: storedName || "Unknown School"
        });

        fetchRemarks(storedId);

        return () => {
            sessionStorage.removeItem("isViewingAsSuperUser");
        };
    }, [navigate]);

    const handleBack = () => navigate(-1);

    if (!schoolData) return null;

    const auditUnits = [
        { id: 'u1', label: 'School Identity (Unit 1)', icon: <TbSchool />, Component: Unit1SchoolIdentity },
        { id: 'u2', label: 'Enrollment Statistics (Unit 2)', icon: <FiUsers />, Component: Unit2Learners },
        { id: 'u3', label: 'Organized Classes (Unit 3)', icon: <FiLayers />, Component: Unit3OrganizedClasses },
        { id: 'u4', label: 'Learner Profile & Stats (Unit 4)', icon: <FiActivity />, Component: Unit4LearnerProfile },
        { id: 'u5', label: 'Shifting & Modality (Unit 5)', icon: <TbReportAnalytics />, Component: Unit5ShiftingModality },
        { id: 'u6', label: 'School Resources (Unit 6)', icon: <FiBox />, Component: Unit6SchoolResources },
        { id: 'u7', label: 'Physical Facilities (Unit 7)', icon: <FiServer />, Component: Unit7PhysicalFacilities },
        { id: 'u8', label: 'School Terrain & Location (Unit 8)', icon: <FiActivity />, Component: Unit8SchoolLocation },
        { id: 'u9', label: 'Infrastructure & Safety (Unit 9)', icon: <FiServer />, Component: Unit9Infrastructure },
    ];

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans pb-20">
            {/* Header */}
            <div className="bg-slate-900 text-white p-6 pt-10 pb-10 rounded-b-[2.5rem] shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-32 bg-blue-500/10 rounded-full blur-3xl"></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-4">
                        <button onClick={handleBack} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                            <FiArrowLeft size={24} />
                        </button>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500 text-amber-950">
                                    Audit Review Mode
                                </span>
                                <span className="text-slate-400 text-xs font-mono">ID: {schoolData.id}</span>
                            </div>
                            <h1 className="text-xl font-bold mt-1 tracking-tight">{schoolData.name}</h1>
                        </div>
                    </div>
                </div>
            </div>

            {/* Accordion Container */}
            <div className="px-4 -mt-3 relative z-20 space-y-4">
                {auditUnits.map((unit) => (
                    <div key={unit.id} className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden transition-all duration-300">
                        {/* Accordion Header */}
                        <button
                            onClick={() => setExpandedUnit(expandedUnit === unit.id ? null : unit.id)}
                            className="w-full flex items-center justify-between p-6 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                        >
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-2xl ${expandedUnit === unit.id ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'} transition-all`}>
                                    {unit.icon}
                                </div>
                                <div className="text-left">
                                    <h3 className={`font-black uppercase tracking-tight ${expandedUnit === unit.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                        {unit.label}
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                        {remarks.filter(r => r.unit_id === unit.id && !r.is_resolved).length} Pending Remarks
                                    </p>
                                </div>
                            </div>
                            <div className="text-slate-400">
                                {expandedUnit === unit.id ? <FiChevronUp size={20} /> : <FiChevronDown size={20} />}
                            </div>
                        </button>

                        {/* Accordion Content */}
                        <AnimatePresence>
                            {expandedUnit === unit.id && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                                    className="border-t border-slate-50 dark:border-slate-700"
                                >
                                    <div className="p-6 relative">
                                        {/* Watermark */}
                                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.02] z-0">
                                            <span className="text-7xl font-black -rotate-45">AUDIT MODE</span>
                                        </div>

                                        {/* Remarks Section */}
                                        <div className="relative z-10 mb-8 p-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                                            <div className="flex justify-between items-center mb-6">
                                                <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-[0.1em] flex items-center gap-2">
                                                    <FiMessageSquare className="text-rose-500" />
                                                    Audit Remarks
                                                </h4>
                                                {user?.role === 'School Division Office' && (
                                                    <button 
                                                        onClick={() => {
                                                            setRemarkUnitId(unit.id);
                                                            setIsRemarkModalOpen(true);
                                                        }}
                                                        className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
                                                    >
                                                        Add Remark
                                                    </button>
                                                )}
                                            </div>

                                            {remarks.filter(r => r.unit_id === unit.id && !r.is_resolved).length > 0 ? (
                                                <div className="space-y-4">
                                                    {remarks.filter(r => r.unit_id === unit.id && !r.is_resolved).map(rem => (
                                                        <div key={rem.id} className={`p-4 rounded-2xl border ${rem.status === 'verified' ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800' : rem.status === 'fixed' ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800' : 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-800'}`}>
                                                            <div className="flex justify-between items-center mb-2">
                                                                <span className={`text-[9px] font-black uppercase tracking-wider ${rem.status === 'verified' ? 'text-emerald-600' : rem.status === 'fixed' ? 'text-amber-600' : 'text-rose-600'}`}>
                                                                    {rem.status === 'verified' ? 'Verified & Resolved' : rem.status === 'fixed' ? 'Fixed - Awaiting Verification' : rem.status === 'reopened' ? 'Reopened - Needs Fix' : 'Requires Attention'}
                                                                </span>
                                                                <span className="text-[9px] font-bold text-slate-400">{new Date(rem.created_at).toLocaleDateString()}</span>
                                                            </div>
                                                            <p className="text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed">"{rem.remark}"</p>
                                                            <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-100/50">
                                                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">By: {rem.auditor_name}</div>
                                                                {rem.status === 'fixed' && (
                                                                    <button 
                                                                        onClick={() => handleVerifyRemark(rem.id)}
                                                                        className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[8px] font-black uppercase tracking-widest transition-all"
                                                                    >
                                                                        Verify & Close
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-center py-6 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
                                                    <p className="text-xs text-slate-400 font-medium italic">No remarks found for this unit.</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Component Render */}
                                        <div className="relative z-10 bg-white dark:bg-slate-800 rounded-3xl overflow-hidden">
                                            <unit.Component targetSchoolId={schoolData.id} isReadOnly={!unit.noReadOnly} />
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ))}
            </div>

            {/* Remark Modal */}
            <AnimatePresence>
                {isRemarkModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsRemarkModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden border border-slate-100 dark:border-slate-800">
                            <div className="p-8 pb-4 flex justify-between items-center">
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 dark:text-white">Flag for Correction</h3>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Targeting: {remarkUnitId.toUpperCase()}</p>
                                </div>
                                <button onClick={() => setIsRemarkModalOpen(false)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                                    <FiX size={20} />
                                </button>
                            </div>
                            <div className="p-8 pt-4">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Detailed Observation</label>
                                <textarea
                                    value={newRemark}
                                    onChange={(e) => setNewRemark(e.target.value)}
                                    placeholder="Be specific about what needs correction..."
                                    className="w-full h-32 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all dark:text-white resize-none"
                                />
                                <div className="mt-6 flex gap-3">
                                    <button onClick={() => setIsRemarkModalOpen(false)} className="flex-1 px-4 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">Cancel</button>
                                    <button onClick={handleAddRemark} disabled={isSubmitting || !newRemark.trim()} className="flex-[2] bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-2xl px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2 transition-all active:scale-95">
                                        {isSubmitting ? 'Sending...' : <><FiSend /> Submit Remark</>}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SchoolAuditView;
