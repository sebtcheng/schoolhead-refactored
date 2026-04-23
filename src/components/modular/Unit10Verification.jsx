import React, { useState, useEffect } from 'react';
import { FiCheckCircle, FiXCircle, FiAlertCircle, FiClipboard, FiClock, FiUser, FiInfo, FiActivity } from 'react-icons/fi';
import { TbTrophy, TbShieldCheck, TbMessageDots } from 'react-icons/tb';
import { motion, AnimatePresence } from 'framer-motion';
import SuccessModal from '../SuccessModal';

const Unit10Verification = ({ targetSchoolId }) => {
    const [loading, setLoading] = useState(true);
    const [remarks, setRemarks] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [stats, setStats] = useState({
        totalXP: 0,
        completionRate: 0,
        riskIndex: 0,
        lastUpdated: null,
        status: 'SUBMITTED'
    });
    const [showSuccess, setShowSuccess] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        const fetchSummary = async () => {
            if (!targetSchoolId) return;
            try {
                // Fetch progress and location (for risk index)
                const [progRes, locRes] = await Promise.all([
                    fetch(`/api/ph_schools/progress/${targetSchoolId}`),
                    fetch(`/api/school-location/${targetSchoolId}`)
                ]);

                const progData = await progRes.json();
                const locData = await locRes.json();

                let xp = 0;
                let completed = 0;
                if (progData.success && progData.progress) {
                    xp = progData.progress.xp || 0;
                    completed = progData.progress.completedUnits?.length || 0;
                }

                setStats({
                    totalXP: xp,
                    completionRate: Math.round((completed / 10) * 100),
                    riskIndex: locData.success ? (locData.data?.risk_index || 0) : 0,
                    lastUpdated: progData.progress?.timestamps?.unit9 || progData.progress?.timestamps?.unit1 || new Date(),
                    status: 'SUBMITTED' // Default
                });
            } catch (err) {
                console.error("Summary fetch error:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchSummary();
    }, [targetSchoolId]);

    const handleAction = async (action) => {
        if (!targetSchoolId) return;
        if (!remarks && action === 'return') {
            alert("Please provide remarks/feedback for returning the submission.");
            return;
        }

        const confirmMsg = action === 'verify' 
            ? "Confirm and Verify this school profile? This will officially commit the audit data."
            : "Return this submission to the school head for correction?";
        
        if (!window.confirm(confirmMsg)) return;

        setActionLoading(true);
        try {
            const endpoint = action === 'verify' ? '/api/esf7/approve' : '/api/esf7/return';
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    school_id: targetSchoolId,
                    remarks: remarks 
                })
            });

            if (res.ok) {
                setSuccessMessage(action === 'verify' ? "School Profile Verified Successfully! The profile is now officially committed." : "Profile returned to School Head for correction.");
                setShowSuccess(true);
            } else {
                const err = await res.json();
                throw new Error(err.error || "Action failed");
            }
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 animate-pulse text-slate-400">
            <FiActivity className="w-12 h-12 mb-4 animate-bounce" />
            <p className="font-black uppercase tracking-widest text-[10px]">Assembling Final Data...</p>
        </div>
    );

    return (
        <div className="space-y-8 pb-32">
            <AnimatePresence>
                {showSuccess && (
                    <SuccessModal 
                        isOpen={showSuccess} 
                        onClose={() => window.location.reload()} 
                        message={successMessage}
                        redirectUrl="/modular-dashboard"
                    />
                )}
            </AnimatePresence>
            {/* Completion Hero */}
            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl mx-4 mt-6">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
                <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="bg-blue-600/20 p-4 rounded-3xl mb-4 backdrop-blur-sm border border-white/10">
                        <TbShieldCheck size={48} className="text-blue-400" />
                    </div>
                    <h2 className="text-2xl font-black uppercase italic tracking-tighter">Final Audit Review</h2>
                    <p className="text-blue-200/60 text-[10px] font-bold uppercase tracking-[0.3em] mt-1">Verification Phase 10</p>
                    
                    <div className="grid grid-cols-3 gap-6 w-full mt-8">
                        <div>
                            <p className="text-blue-300/40 text-[8px] font-black uppercase tracking-widest mb-1">Total Score</p>
                            <p className="text-2xl font-black flex items-center justify-center gap-1">
                                {stats.totalXP} <span className="text-[10px] text-amber-400">XP</span>
                            </p>
                        </div>
                        <div className="border-x border-white/10">
                            <p className="text-blue-300/40 text-[8px] font-black uppercase tracking-widest mb-1">Completion</p>
                            <p className="text-2xl font-black">{stats.completionRate}%</p>
                        </div>
                        <div>
                            <p className="text-blue-300/40 text-[8px] font-black uppercase tracking-widest mb-1">Risk Rank</p>
                            <p className="text-2xl font-black">{stats.riskIndex}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Checklist Section */}
            <section className="px-6 space-y-4">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Audit Readiness Checklist</h3>
                </div>
                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-6 space-y-4">
                    <CheckItem label="Unit 1-3: Identity & Basic Ops" done={stats.completionRate >= 33} />
                    <CheckItem label="Unit 4-6: Learners & Personnel" done={stats.completionRate >= 66} />
                    <CheckItem label="Unit 7-9: Logistics & Infrastructure" done={stats.completionRate >= 100} />
                    <CheckItem label="Data Integrity Verification" done={true} />
                </div>
            </section>

            {/* Feedback & Actions */}
            <section className="px-6 space-y-4">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-amber-500 rounded-full" />
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Auditor's Remarks</h3>
                </div>
                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-6 space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                            <TbMessageDots /> Feedback to School Head
                        </label>
                        <textarea 
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            placeholder="Add notes, clarifications, or reasons for return..."
                            className="w-full min-h-[120px] bg-slate-50 border-none rounded-3xl p-5 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-300"
                        />
                    </div>

                    <div className="flex flex-col gap-3">
                        <button 
                            disabled={actionLoading}
                            onClick={() => handleAction('verify')}
                            className="w-full py-5 rounded-[2rem] bg-slate-900 text-white font-black text-base italic flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all disabled:opacity-50"
                        >
                            {actionLoading ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <FiCheckCircle className="text-blue-400" size={20} />}
                            <span>Approve & Verify Profile</span>
                        </button>
                        
                        <button 
                            disabled={actionLoading}
                            onClick={() => handleAction('return')}
                            className="w-full py-5 rounded-[2rem] bg-rose-50 text-rose-600 border-2 border-rose-100 font-bold text-sm uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
                        >
                            <FiXCircle size={18} />
                            <span>Return for Correction</span>
                        </button>
                    </div>
                </div>
            </section>

            {/* Bottom Info Banner */}
            <div className="mx-6 px-6 py-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex items-center gap-4 text-blue-600">
                <FiInfo className="shrink-0" />
                <p className="text-[10px] font-bold leading-relaxed">
                    Verifying this profile will commit all 9 Units to the regional database and mark the school as "Verified" for the current audit phase.
                </p>
            </div>
        </div>
    );
};

const CheckItem = ({ label, done }) => (
    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">{label}</span>
        {done ? (
            <div className="bg-emerald-500 text-white p-1 rounded-full shadow-lg shadow-emerald-500/20">
                <FiCheckCircle size={14} />
            </div>
        ) : (
            <div className="bg-slate-200 text-slate-400 p-1 rounded-full">
                <FiClock size={14} />
            </div>
        )}
    </div>
);

export default Unit10Verification;
