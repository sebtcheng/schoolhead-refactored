import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { 
    FiCloud, FiWifi, FiCheckCircle, FiAlertCircle, FiTrash2, 
    FiRefreshCcw, FiArrowLeft, FiZap, FiBox, FiCpu, 
    FiDatabase, FiSettings
} from 'react-icons/fi';
import { getModularOutbox, deleteModularFromOutbox } from '../db';
import BottomNav from './BottomNav';
import PageTransition from '../components/PageTransition';

const SyncCenter = () => {
    const navigate = useNavigate();
    const [pendingItems, setPendingItems] = useState([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState(0);
    const [syncStatus, setSyncStatus] = useState({}); // itemID -> 'syncing' | 'success' | 'error'
    const [syncErrors, setSyncErrors] = useState({}); // itemID -> string message

    const loadData = async () => {
        try {
            const data = await getModularOutbox();
            setPendingItems(data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
        } catch (error) {
            console.error("Failed to load modular outbox:", error);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadData();
    }, []);

    const handleSync = async () => {
        if (!navigator.onLine) {
            alert("⚠️ Connection Required: Please check your internet connectivity to synchronize your mission data.");
            return;
        }

        if (pendingItems.length === 0) return;

        setIsSyncing(true);
        setSyncProgress(0);
        let successCount = 0;

        for (let i = 0; i < pendingItems.length; i++) {
            const item = pendingItems[i];
            setSyncStatus(prev => ({ ...prev, [item.id]: 'syncing' }));
            setSyncErrors(prev => ({ ...prev, [item.id]: null }));

            try {
                // Ensure URL starts with / if it's relative
                const fetchUrl = item.url.startsWith('http') ? item.url : 
                               (item.url.startsWith('/') ? item.url : `/${item.url}`);

                const response = await fetch(fetchUrl, {
                    method: item.method || 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    credentials: 'include', // Support session cookies if used
                    body: JSON.stringify(item.payload)
                });

                if (response.ok) {
                    setSyncStatus(prev => ({ ...prev, [item.id]: 'success' }));
                    await deleteModularFromOutbox(item.id);
                    successCount++;
                } else {
                    let errorMsg = `Server returned ${response.status}`;
                    try {
                        const errorData = await response.json();
                        errorMsg = errorData.error || errorData.message || errorMsg;
                    } catch {
                        // Not JSON or no error field
                    }
                    setSyncStatus(prev => ({ ...prev, [item.id]: 'error' }));
                    setSyncErrors(prev => ({ ...prev, [item.id]: errorMsg }));
                    console.error(`Sync error for ${item.label}:`, errorMsg);
                }
            } catch (err) {
                const diag = err.message || "Network request failed";
                console.error("Sync failed for item:", item.id, err);
                setSyncStatus(prev => ({ ...prev, [item.id]: 'error' }));
                setSyncErrors(prev => ({ ...prev, [item.id]: diag }));
            }

            setSyncProgress(((i + 1) / pendingItems.length) * 100);
            await new Promise(r => setTimeout(r, 600)); // Smooth animation delay
        }

        setIsSyncing(false);
        loadData();
        
        if (successCount === pendingItems.length) {
            alert("✅ Synchronization Success: All unit data has been successfully transmitted to the server.");
        } else if (successCount > 0) {
            alert(`⚠️ Partial Sync: Successfully transmitted ${successCount} units, but some failures occurred. Please check the logs.`);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Discard Mission Data? This will permanently remove the offline submission.")) {
            await deleteModularFromOutbox(id);
            loadData();
        }
    };

    const countStatus = (status) => Object.values(syncStatus).filter(s => s === status).length;

    return (
        <PageTransition>
            <div className="min-h-screen bg-[#070b14] text-white font-sans pb-32 relative overflow-hidden">
                {/* Tech Background */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px]" />
                    <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-600/10 rounded-full blur-[100px]" />
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20" />
                </div>

                {/* Header */}
                <div className="relative z-10 px-6 pt-14 pb-10">
                    <div className="flex items-center justify-between mb-8">
                        <button 
                            onClick={() => navigate(-1)}
                            className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-md hover:bg-white/10 transition-all active:scale-90"
                        >
                            <FiArrowLeft />
                        </button>
                        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                            <div className={`w-2 h-2 rounded-full ${navigator.onLine ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                            <span className="text-[10px] font-black uppercase tracking-widest">{navigator.onLine ? 'Link: Online' : 'Link: Offline'}</span>
                        </div>
                    </div>

                    <div className="flex items-end gap-4">
                         <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-600/20">
                            <FiDatabase size={32} className="animate-pulse" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight mb-1">Sync Center</h1>
                            <p className="text-blue-400/60 text-[10px] font-bold uppercase tracking-[0.2em]">Mission Data Terminal</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="relative z-10 px-6 space-y-6">
                    
                    {/* Status Dashboard */}
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-2xl relative overflow-hidden group"
                    >
                        {/* Progress Pulse */}
                        {isSyncing && (
                            <div className="absolute top-0 left-0 h-1 bg-gradient-to-r from-blue-500 via-emerald-500 to-blue-500 animate-shimmer" style={{ width: '100%' }} />
                        )}

                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h2 className="text-sm font-black text-white/40 uppercase tracking-widest mb-2">Sync Queue</h2>
                                <div className="flex items-baseline gap-3">
                                    <span className="text-5xl font-black tabular-nums">{pendingItems.length}</span>
                                    <span className="text-blue-400 font-bold text-xs">UNITS PENDING</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                                    <FiDatabase size={20} />
                                </div>
                            </div>
                        </div>

                        {isSyncing ? (
                            <div className="space-y-4">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-blue-400">
                                    <span>Synchronizing Files...</span>
                                    <span>{Math.round(syncProgress)}%</span>
                                </div>
                                <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/10">
                                    <motion.div 
                                        className="h-full bg-gradient-to-r from-blue-600 to-emerald-500"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${syncProgress}%` }}
                                    />
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex-1 bg-white/5 p-3 rounded-2xl border border-white/5 text-center">
                                        <p className="text-[10px] font-black text-white/30 uppercase mb-1">Success</p>
                                        <p className="text-lg font-black text-emerald-500">{countStatus('success')}</p>
                                    </div>
                                    <div className="flex-1 bg-white/5 p-3 rounded-2xl border border-white/5 text-center">
                                        <p className="text-[10px] font-black text-white/30 uppercase mb-1">Failed</p>
                                        <p className="text-lg font-black text-rose-500">{countStatus('error')}</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleSync}
                                disabled={pendingItems.length === 0}
                                className={`w-full py-5 rounded-[1.5rem] font-black text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all ${
                                    pendingItems.length > 0 
                                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-xl shadow-blue-600/30 text-white' 
                                    : 'bg-white/5 text-white/20 border border-white/5 cursor-not-allowed'
                                }`}
                            >
                                <FiRefreshCcw className={pendingItems.length > 0 ? "animate-spin-slow" : ""} />
                                {pendingItems.length > 0 ? 'Initialize Synchronization' : 'Systems Synchronized'}
                            </motion.button>
                        )}
                    </motion.div>

                    {/* Pending List */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Transmission Queue</h3>
                            <span className="text-[9px] font-bold text-blue-500/50 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">BUFFER READY</span>
                        </div>

                        <AnimatePresence mode="popLayout">
                            {pendingItems.map((item) => (
                                <motion.div 
                                    key={item.id}
                                    layout
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="bg-white/5 border border-white/5 rounded-3xl p-5 flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl relative ${
                                            syncStatus[item.id] === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                                            syncStatus[item.id] === 'error' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' :
                                            'bg-white/5 text-blue-400 border border-white/10'
                                        }`}>
                                            {syncStatus[item.id] === 'syncing' ? <FiRefreshCcw className="animate-spin text-blue-500" /> : <FiBox />}
                                            {syncStatus[item.id] === 'success' && <FiCheckCircle className="absolute -top-1 -right-1 text-xs" />}
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-black text-white tracking-tight">{item.label}</h4>
                                            <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mt-0.5">
                                                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Unit {item.unitId}
                                            </p>
                                            {syncErrors[item.id] && (
                                                <p className="text-[9px] font-bold text-rose-400 mt-2 bg-rose-500/5 p-2 rounded-lg border border-rose-500/10 italic">
                                                    Error: {syncErrors[item.id]}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {!isSyncing && syncStatus[item.id] !== 'success' && (
                                        <button 
                                            onClick={() => handleDelete(item.id)}
                                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white/20 hover:text-rose-500 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <FiTrash2 />
                                        </button>
                                    )}
                                    {syncStatus[item.id] === 'success' && (
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-emerald-500">
                                            <FiCheckCircle />
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {pendingItems.length === 0 && (
                            <div className="py-20 text-center">
                                <div className="w-20 h-20 bg-emerald-500/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/10">
                                    <FiCheckCircle className="text-emerald-500/20" size={40} />
                                </div>
                                <h4 className="text-white/40 font-black text-sm uppercase tracking-widest">All Units Restored</h4>
                                <p className="text-white/20 text-[10px] font-bold mt-2 uppercase tracking-widest">Mission status: Green</p>
                            </div>
                        )}
                    </div>

                </div>

                <BottomNav userRole="School Head" />
            </div>
            
            <style jsx="true">{`
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
                .animate-shimmer {
                    animation: shimmer 2s infinite linear;
                }
                .animate-spin-slow {
                    animation: spin 3s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </PageTransition>
    );
};

export default SyncCenter;
