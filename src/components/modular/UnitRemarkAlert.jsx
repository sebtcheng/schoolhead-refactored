import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiAlertTriangle, FiCheckCircle, FiSend } from 'react-icons/fi';

const UnitRemarkAlert = ({ unitId, schoolId }) => {
    const [remarks, setRemarks] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchRemarks = async () => {
        if (!schoolId || !unitId) return;
        try {
            const res = await fetch(`/api/audit/remarks/${schoolId}`);
            if (res.ok) {
                const result = await res.json();
                // Backend returns array directly. Also using 'instruction' column from DB.
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
            const res = await fetch(`/api/audit/remarks/${remarkId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'fixed' })
            });
            if (res.ok) {
                fetchRemarks(); // Refresh
            }
        } catch (e) {
            console.error('Failed to update remark status:', e);
        }
    };

    if (loading || remarks.length === 0) return null;

    return (
        <div className="mb-6 space-y-3">
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
