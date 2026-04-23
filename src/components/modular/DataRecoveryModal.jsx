import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiAlertCircle, FiCheckCircle, FiRefreshCw, FiExternalLink, FiX, FiShield } from 'react-icons/fi';
import { getUnitDraft } from '../../db';

const DataRecoveryModal = ({ schoolId, isOpen, onClose }) => {
    const [status, setStatus] = useState('idle'); // idle, scanning, found, harvesting, completed, healthy
    const [repairableFields, setRepairableFields] = useState([]);
    const [harvestCount, setHarvestCount] = useState(0);

    useEffect(() => {
        if (isOpen && status === 'idle') {
            performSanityCheck();
        }
    }, [isOpen]);

    const performSanityCheck = async () => {
        setStatus('scanning');
        try {
            // Aggregate all local draft data across modular units
            const unitIds = [1, 2, 3, 4, 5, 7, 9];
            let masterPayload = {};
            
            await Promise.all(unitIds.map(async (unitId) => {
                const draft = await getUnitDraft(unitId, schoolId);
                if (draft && draft.formData) {
                    masterPayload = { ...masterPayload, ...draft.formData };
                }
            }));

            // Call the backend sanity check
            const res = await fetch(`/api/check-school-data-sanity/${schoolId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(masterPayload)
            });
            
            const data = await res.json();
            
            if (data.healthy) {
                setStatus('healthy');
            } else {
                setRepairableFields(data.repairable);
                setStatus('found');
            }
        } catch (err) {
            console.error("Sanity Check Error:", err);
            setStatus('error');
        }
    };

    const handleHarvest = async () => {
        setStatus('harvesting');
        try {
            const res = await fetch(`/api/harvest-master/${schoolId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repairable: repairableFields })
            });
            
            const data = await res.json();
            if (data.success) {
                setHarvestCount(data.harvested);
                setStatus('completed');
                // Optional: Refresh parent state or just let the user see success
            }
        } catch (err) {
            console.error("Harvesting Error:", err);
            setStatus('error');
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative"
                >
                    {/* Header */}
                    <div className="bg-slate-50 p-6 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-[#FDB913]/20 p-2 rounded-xl text-[#FDB913]">
                                <FiShield size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg">Data Health Recovery</h3>
                                <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">System Audit v1.0</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-2">
                            <FiX size={20} />
                        </button>
                    </div>

                    <div className="p-8">
                        {status === 'scanning' && (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <motion.div 
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                    className="text-[#FDB913] mb-6"
                                >
                                    <FiRefreshCw size={48} />
                                </motion.div>
                                <h4 className="text-xl font-bold text-slate-800 mb-2">Analyzing Data Integrity</h4>
                                <p className="text-slate-500 text-sm max-w-[280px]">Scanning for discrepancies between your local drafts and the database.</p>
                            </div>
                        )}

                        {status === 'found' && (
                            <div className="flex flex-col items-center py-4 text-center">
                                <div className="text-amber-500 mb-6 bg-amber-50 p-6 rounded-full">
                                    <FiAlertCircle size={48} />
                                </div>
                                <h4 className="text-xl font-bold text-slate-800 mb-2">Inconsistencies Detected</h4>
                                <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                                    We found <span className="font-bold text-slate-800">{repairableFields.length} data points</span> that were saved in your local draft but are currently <span className="text-red-500 font-semibold">zero or missing</span> in our database.
                                </p>
                                
                                <div className="bg-slate-50 rounded-2xl p-5 w-full mb-8 border border-slate-100 text-left">
                                    <div className="flex items-center gap-2 mb-3 text-slate-400">
                                        <FiCheckCircle size={14} />
                                        <span className="text-[10px] font-bold tracking-widest uppercase">Safe Recovery Protocol</span>
                                    </div>
                                    <ul className="text-xs space-y-2 text-slate-600 font-medium">
                                        <li className="flex gap-2">
                                            <span className="text-[#FDB913]">•</span>
                                            Non-destructive: No existing data will be deleted.
                                        </li>
                                        <li className="flex gap-2">
                                            <span className="text-[#FDB913]">•</span>
                                            Validation: Only repairs empty or zero values.
                                        </li>
                                    </ul>
                                </div>

                                <button 
                                    onClick={handleHarvest}
                                    className="w-full bg-[#FDB913] hover:bg-[#e5a812] text-white font-bold py-4 rounded-2xl shadow-lg shadow-[#FDB913]/30 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                                >
                                    Rectify Now
                                </button>
                            </div>
                        )}

                        {status === 'harvesting' && (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <div className="flex gap-1 mb-8">
                                    {[0, 1, 2].map(i => (
                                        <motion.div 
                                            key={i}
                                            animate={{ y: [0, -8, 0] }}
                                            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
                                            className="w-3 h-3 bg-[#FDB913] rounded-full"
                                        />
                                    ))}
                                </div>
                                <h4 className="text-xl font-bold text-slate-800 mb-2">Harvesting Data...</h4>
                                <p className="text-slate-500 text-sm">Safely syncing missing points to the master database.</p>
                            </div>
                        )}

                        {status === 'completed' && (
                            <div className="flex flex-col items-center py-4 text-center">
                                <div className="text-emerald-500 mb-6 bg-emerald-50 p-6 rounded-full ring-8 ring-emerald-50/50">
                                    <FiCheckCircle size={48} />
                                </div>
                                <h4 className="text-2xl font-black text-slate-800 mb-2">Recovery Success!</h4>
                                <p className="text-slate-500 text-sm mb-10 leading-relaxed max-w-[280px]">
                                    Successfully recovered <span className="font-bold text-emerald-600">{harvestCount} data points</span>. Your database is now synchronized with your local work.
                                </p>
                                <button 
                                    onClick={onClose}
                                    className="w-full bg-slate-900 hover:bg-black text-white font-bold py-4 rounded-2xl shadow-lg shadow-slate-900/20 transition-all active:scale-[0.98]"
                                >
                                    Return to Dashboard
                                </button>
                            </div>
                        )}

                        {status === 'healthy' && (
                            <div className="flex flex-col items-center py-4 text-center">
                                <div className="text-[#00573F] mb-6 bg-emerald-50 p-6 rounded-full ring-8 ring-emerald-50/50">
                                    <FiShield size={48} />
                                </div>
                                <h4 className="text-2xl font-black text-slate-800 mb-2">Systems Nominal</h4>
                                <p className="text-slate-500 text-sm mb-10 leading-relaxed max-w-[280px]">
                                    Our audit confirms your cloud data correctly matches your local drafts. No repairs are needed at this time.
                                </p>
                                <button 
                                    onClick={onClose}
                                    className="w-full bg-slate-900 hover:bg-black text-white font-bold py-4 rounded-2xl shadow-lg shadow-slate-900/20 transition-all active:scale-[0.98]"
                                >
                                    Dismiss
                                </button>
                            </div>
                        )}

                        {status === 'error' && (
                            <div className="flex flex-col items-center py-4 text-center">
                                <div className="text-red-500 mb-6 bg-red-50 p-6 rounded-full">
                                    <FiAlertCircle size={48} />
                                </div>
                                <h4 className="text-xl font-bold text-slate-800 mb-2">Connection Error</h4>
                                <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                                    We couldn't complete the health audit. Please check your internet connection and try again.
                                </p>
                                <button 
                                    onClick={performSanityCheck}
                                    className="w-full bg-slate-900 hover:bg-black text-white font-bold py-4 rounded-2xl transition-all mb-3 active:scale-[0.98]"
                                >
                                    Retry Audit
                                </button>
                                <button 
                                    onClick={onClose}
                                    className="text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default DataRecoveryModal;
