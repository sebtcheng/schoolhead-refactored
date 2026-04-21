import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiArrowRight, FiBookOpen, FiAward, FiMoreVertical, FiLogOut, FiLock, FiShield, FiGrid } from 'react-icons/fi';
import { TbReportAnalytics, TbTarget, TbCloudSearch } from "react-icons/tb";
import { useAuth } from '../context/AuthContext';
import { normalizeRole } from '../config/roleGroups';
import loadingLogo from '../assets/loading.gif';
import PageTransition from '../components/PageTransition';

const SDONexusDashboard = () => {
    const navigate = useNavigate();
    const { user, confirmLogout } = useAuth();
    const [loading, setLoading] = useState(true);
    const [isNavigating, setIsNavigating] = useState(false);
    const [dynamicLocks, setDynamicLocks] = useState({});

    useEffect(() => {
        const loadNexusSettings = async () => {
            try {
                const locksRes = await fetch('/api/settings/nexus_module_locks');
                if (locksRes.ok) {
                    const locksData = await locksRes.json();
                    if (locksData && locksData.value) {
                        try {
                            setDynamicLocks(JSON.parse(locksData.value));
                        } catch (e) {
                            console.error("Failed to parse nexus locks", e);
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to load nexus settings", err);
            } finally {
                setLoading(false);
            }
        };
        loadNexusSettings();
    }, []);

    const handleCardClick = (route, state = {}) => {
        setIsNavigating(true);
        setTimeout(() => {
            navigate(route, { state });
        }, 600);
    };

    if (loading || isNavigating) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-white">
                <div className="w-32 h-32 flex items-center justify-center">
                    <img src={loadingLogo} className="w-full h-full object-contain drop-shadow-xl" alt="InsightED Loading" />
                </div>
                {isNavigating && (
                    <motion.p 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mt-6 italic"
                    >
                        Initializing Command Center Hub...
                    </motion.p>
                )}
            </div>
        );
    }

    // Role-Based Module Configuration
    const normalizedUserRole = normalizeRole(user?.role);
    const isSGOD = user?.office?.toUpperCase() === 'SCHOOL GOVERNANCE AND OPERATIONS DIVISION (SGOD)';
    const isRO = normalizedUserRole === 'Regional Division Office' || normalizedUserRole === 'Regional Office';
    
    const modules = [
        {
            id: 'cloud-monitoring',
            title: 'CLOUD Hub',
            subtitle: 'Monitoring & Analysis',
            type: 'MONITORING',
            icon: <TbCloudSearch className="w-8 h-8" />,
            color: 'from-[#004A99] to-blue-800',
            textColor: 'text-[#004A99]',
            bgLight: 'bg-blue-50',
            route: '/monitoring-dashboard',
            description: 'Console for Live Overview and Unified Data monitoring across all schools.',
            isLocked: dynamicLocks['cloud-monitoring'] || false,
            isVisible: true
        },
        {
            id: 'esf7-review',
            title: 'ESF7 Review',
            subtitle: 'Personnel Audit',
            type: 'AUDIT',
            icon: <TbReportAnalytics className="w-8 h-8" />,
            color: 'from-emerald-600 to-teal-700',
            textColor: 'text-emerald-600',
            bgLight: 'bg-emerald-50',
            route: '/esf7-review',
            description: 'Verify and audit teacher personnel itemization reports for compliance.',
            isLocked: dynamicLocks['esf7-review'] || false,
            isVisible: isSGOD || isRO // VISIBLE IF SGOD OR REGIONAL
        },
        {
            id: 'nspp-review',
            title: 'NSPP Review',
            subtitle: 'Assessment Audit',
            type: 'AUDIT',
            icon: <TbTarget className="w-8 h-8" />,
            color: 'from-amber-500 to-orange-600',
            textColor: 'text-amber-600',
            bgLight: 'bg-amber-50',
            route: '/nspp-review',
            badge: 'COMING SOON',
            description: 'Registry monitoring for the deployment of administrative staff.',
            isLocked: true, // Locked for now
            isVisible: true
        },
        {
            id: 'user-management',
            title: 'USER Lookup',
            subtitle: 'Account Credentials',
            type: 'SECURITY',
            icon: <FiShield className="w-8 h-8" />,
            color: 'from-blue-600 to-indigo-700',
            textColor: 'text-blue-600',
            bgLight: 'bg-blue-50',
            route: '/user-management',
            description: 'Retrieve email and passcodes for school head accounts in your division.',
            isLocked: false,
            isVisible: !isRO
        }
    ].filter(m => m.isVisible);

    return (
        <PageTransition>
            <div className="min-h-screen bg-[#fafbff] pb-32 font-sans text-slate-900 overflow-y-auto relative overflow-hidden">
                {/* Decorative Background Glows */}
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-100/40 rounded-full blur-[140px] -mr-80 -mt-80 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-100/20 rounded-full blur-[120px] -ml-64 -mb-64 pointer-events-none" />
                
                <div className="px-8 pt-12 pb-10 flex justify-between items-start">
                    <div className="flex flex-col">
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight uppercase italic">
                            {isRO ? "Regional Nexus" : "Division Nexus"}
                        </h1>
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">
                            {isRO ? `Region ${user?.region || "Region"}` : `${user?.division || "Schools Division Office"} • ${user?.region || "Region"}`}
                        </p>
                        <div className="flex items-center gap-2 mt-3">
                            <div className="px-3 py-1 bg-blue-600 text-white rounded-full text-[9px] font-black tracking-widest uppercase">
                                {user?.role || "OFFICIAL"}
                            </div>
                            <div className="px-3 py-1 bg-slate-900 text-white rounded-full text-[9px] font-black tracking-widest uppercase italic">
                                {user?.office || "DEPARTAMENTAL"}
                            </div>
                        </div>
                    </div>
                    <button 
                        onClick={confirmLogout}
                        className="p-4 bg-white rounded-3xl border border-slate-100 text-slate-400 hover:text-red-500 hover:bg-red-50 hover:border-red-100 transition-all active:scale-95 shadow-xl shadow-slate-200/40"
                        title="Logout"
                    >
                        <FiLogOut size={24} />
                    </button>
                </div>

                <div className="px-6 grid grid-cols-1 gap-6">
                    {modules.map((mod, idx) => {
                        const isPrimary = mod.id === 'cloud-monitoring';
                        return (
                            <motion.div
                                key={mod.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                onClick={() => !mod.isLocked && handleCardClick(mod.route, mod.state)}
                                className={`
                                    flex flex-col p-8 rounded-[3rem] cursor-pointer relative transition-all duration-300 active:scale-95 active:translate-y-1
                                    ${mod.isLocked ? 'grayscale opacity-60 pointer-events-none' : ''}
                                    ${isPrimary 
                                        ? 'bg-[#10346B] text-white shadow-2xl shadow-blue-900/40 border-b-8 border-blue-950' 
                                        : 'bg-white border border-slate-100 text-slate-900 shadow-[0_15px_35px_rgba(0,0,0,0.1)] border-b-8 border-slate-200'}
                                `}
                            >
                                <div className="flex justify-between items-start mb-8">
                                    <div className="flex flex-col">
                                        <h4 className={`font-black leading-tight mb-1 ${isPrimary ? 'text-2xl' : 'text-xl uppercase italic'}`}>{mod.title}</h4>
                                        <p className={`text-[12px] font-black uppercase tracking-[0.15em] leading-tight ${isPrimary ? 'text-blue-200' : 'text-slate-400'}`}>{mod.subtitle}</p>
                                    </div>
                                    {mod.isLocked ? (
                                        <div className={`p-2 rounded-xl ${isPrimary ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                            <FiLock size={18} />
                                        </div>
                                    ) : (
                                        <div className={`p-2 rounded-xl ${isPrimary ? 'bg-white/10 text-blue-200' : 'bg-slate-50 text-slate-300'}`}>
                                            <FiArrowRight size={18} />
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-6 mb-8">
                                    <motion.div 
                                        animate={{ y: [0, -5, 0] }}
                                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                        className={`w-20 h-20 rounded-[2rem] flex items-center justify-center shrink-0 shadow-lg ${isPrimary ? 'bg-white/10 text-white' : 'bg-slate-50 border border-slate-100 text-[#10346B]'}`}
                                    >
                                        {React.cloneElement(mod.icon, { className: "w-10 h-10" })}
                                    </motion.div>
                                    
                                    <div className="flex-1">
                                        <p className={`text-sm font-bold leading-relaxed ${isPrimary ? 'text-blue-100' : 'text-slate-500 italic'}`}>
                                            {mod.description}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-auto flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isPrimary ? 'bg-white/10' : 'bg-slate-100'}`}>
                                            <FiGrid className={isPrimary ? 'text-blue-200' : 'text-slate-400'} size={14} />
                                        </div>
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${isPrimary ? 'text-blue-200/60' : 'text-slate-400'}`}>
                                            Type: {mod.type}
                                        </span>
                                    </div>
                                    {mod.badge && (
                                        <span className="px-3 py-1 rounded-full text-[9px] font-black tracking-widest bg-slate-900 text-white">
                                            {mod.badge}
                                        </span>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </PageTransition>
    );
};

export default SDONexusDashboard;
