import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiAlertTriangle, FiCheckCircle, FiSend } from 'react-icons/fi';
import { api } from "../../lib/api";

const UnitRemarkAlert = ({ unitId, schoolId, sdoRemark: propSdoRemark }) => {
    const [remarks, setRemarks] = useState([]);
    const [sdoRemark, setSdoRemark] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchRemarks = async () => {
        if (propSdoRemark) {
            setSdoRemark(typeof propSdoRemark === 'string' ? { status: 'returned', remarks: propSdoRemark } : propSdoRemark);
        }
        if (!schoolId || !unitId) {
            setLoading(false);
            return;
        }
        try {
            // 1. Fetch SDO Validation remarks from unified submissions endpoint
            if (!propSdoRemark) {
                const progRes = await fetch(api(`/api/ph_schools/progress/${schoolId}`));
                if (progRes.ok) {
                    const progData = await progRes.json();
                    const uKey = typeof unitId === 'number' ? `unit${unitId}` : (unitId.startsWith('unit') ? unitId : `unit${unitId.replace(/[^0-9]/g, '')}`);
                    const sub = progData.data?.submissions?.[uKey];
                    if (sub && (sub.status === 'returned' || sub.status === 'rejected')) {
                        setSdoRemark({
                            status: sub.status,
                            remarks: sub.remarks || 'Revisions requested by Schools Division Office.',
                            validated_by: sub.validated_by || 'SDO Officer',
                            validated_at: sub.validated_at
                        });
                    } else {
                        setSdoRemark(null);
                    }
                }
            }

            // 2. Fetch legacy audit remarks as secondary task items
            const res = await fetch(api(`/audit/remarks/${schoolId}`));
            if (res.ok) {
                const result = await res.json();
                const active = (Array.isArray(result) ? result : (result.data || [])).filter(r => r.unit_id === unitId && !r.is_resolved);
                setRemarks(active);
            }
        } catch (e) {
            console.error('Failed to fetch unit remarks:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRemarks();
    }, [unitId, schoolId]);

    const handleMarkFixed = async (remarkId) => {
        try {
            const res = await fetch(api(`/api/audit/remarks/${remarkId}/status`), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'fixed' })
            });
            if (res.ok) {
                fetchRemarks();
            }
        } catch (e) {
            console.error('Failed to update remark status:', e);
        }
    };

    if (loading) return null;
    if (!sdoRemark && remarks.length === 0) return null;

    return (
        <div className="mb-6 space-y-3">
            {/* SDO Validation Remark Banner */}
            {sdoRemark && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-5 rounded-3xl border shadow-md ${
                        sdoRemark.status === 'returned'
                            ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-300 dark:border-amber-700'
                            : 'bg-rose-50 dark:bg-rose-900/10 border-rose-300 dark:border-rose-700'
                    }`}
                >
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg text-white ${sdoRemark.status === 'returned' ? 'bg-amber-500' : 'bg-rose-500'}`}>
                                <FiAlertTriangle size={16} />
                            </div>
                            <span className={`text-[11px] font-black uppercase tracking-wider ${sdoRemark.status === 'returned' ? 'text-amber-700 dark:text-amber-400' : 'text-rose-700 dark:text-rose-400'}`}>
                                {sdoRemark.status === 'returned' ? 'Revisions Requested by Division Office' : 'Module Rejected by Division Office'}
                            </span>
                        </div>
                        {sdoRemark.validated_by && (
                            <span className="text-[10px] font-bold text-slate-400">
                                SDO Officer: {sdoRemark.validated_by}
                            </span>
                        )}
                    </div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-2">
                        "{sdoRemark.remarks}"
                    </p>
                    <p className="text-[10px] text-slate-400 mt-2 italic">
                        Please update and resubmit this module to clear division remarks.
                    </p>
                </motion.div>
            )}

            {/* Legacy Audit Remarks */}
            {remarks.map((rem) => (
                <motion.div
                    key={rem.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-5 rounded-3xl border shadow-sm ${
                        rem.status === 'fixed' 
                        ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800' 
                        : 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-800'
                    }`}
                >
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg ${rem.status === 'fixed' ? 'bg-blue-500' : 'bg-rose-500'} text-white`}>
                                {rem.status === 'fixed' ? <FiCheckCircle size={14} /> : <FiAlertTriangle size={14} />}
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-widest ${rem.status === 'fixed' ? 'text-blue-600' : 'text-rose-600'}`}>
                                {rem.status === 'fixed' ? 'Awaiting Verification' : 'Correction Requested'}
                            </span>
                        </div>
                        <span className="text-[9px] font-bold text-slate-400">
                            Auditor: {rem.auditor_name}
                        </span>
                    </div>

                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">
                        "{rem.instruction || rem.remark}"
                    </p>

                    {rem.status !== 'fixed' && (
                        <button
                            onClick={() => handleMarkFixed(rem.id)}
                            className="w-full py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-500/10 active:scale-95"
                        >
                            <FiSend size={12} />
                            Submit for Verification
                        </button>
                    )}

                    {rem.status === 'fixed' && (
                        <div className="text-center py-2 px-4 rounded-xl bg-blue-100/50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-[10px] font-bold italic">
                            You've marked this as fixed. Waiting for auditor to verify.
                        </div>
                    )}
                </motion.div>
            ))}
        </div>
    );
};

export default UnitRemarkAlert;
