import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    FiArrowRight, 
    FiBookOpen, 
    FiAward,
    FiMoreVertical,
    FiLogOut,
    FiLock
} from 'react-icons/fi';
import { TbReportAnalytics, TbTarget, TbShieldCheck, TbShieldX, TbCloudSearch } from "react-icons/tb";
import { useAuth } from '../context/AuthContext';
import loadingLogo from '../assets/loading.gif';
import PageTransition from '../components/PageTransition';


const NodesDashboard = () => {
    const navigate = useNavigate();
    const { user, logout, confirmLogout } = useAuth();
    const [questProgress, setQuestProgress] = useState({ completedUnits: [], xp: 0, validation_percentage: 0 });
    const [loading, setLoading] = useState(true);
    const [isNavigating, setIsNavigating] = useState(false);
    const [showEdWelcome, setShowEdWelcome] = useState(false);
    const [dynamicLocks, setDynamicLocks] = useState({});


    useEffect(() => {
        const loadCommonData = async () => {
            const isNew = localStorage.getItem('isNewUser');
            if (isNew === 'true') {
                setShowEdWelcome(true);
            }

            const schoolId = localStorage.getItem('schoolId') || user?.school_id;
            if (schoolId) {
                try {
                    const res = await fetch(`api/ph_schools/progress/${schoolId}`);
                    if (res.ok) {
                        const json = await res.json();
                        if (json.success && json.data) {
                            setQuestProgress({
                                ...json.data.progress,
                                schoolId: schoolId,
                                school_name: json.data.schoolInfo?.school_name,
                                is_esf7_opened: json.data.schoolInfo?.is_esf7_opened
                            });
                        }
                    }
 
                    // ESF7 Status check removed

                    const locksRes = await fetch('api/settings/nexus_module_locks');
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
                    console.error("Failed to sync progress", err);
                }
            }
            setLoading(false);
        };
        loadCommonData();
    }, [user]);

    const handleCardClick = (route, id) => {
        if (route.startsWith('http')) {
            window.location.href = route;
        } else {
            navigate(route);
        }
    };

    const calculateProgress = (unitIds) => {
        if (!questProgress.completedUnits) return 0;
        const completedCount = unitIds.filter(id => questProgress.completedUnits.includes(id)).length;
        return Math.round((completedCount / unitIds.length) * 100);
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
                        Loading...
                    </motion.p>
                )}
            </div>
        );
    }

    const modules = [
        {
            id: 'school-info',
            title: 'CLOUD',
            subtitle: (
                <div className="flex flex-col gap-1 mt-2">
                    <div className="flex items-baseline gap-1">
                        <span className="text-[15px] text-[#004A99] font-black w-4">C</span>
                        <span className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">onsole for</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-[15px] text-[#004A99] font-black w-4">L</span>
                        <span className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">earning and</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-[15px] text-[#004A99] font-black w-4">O</span>
                        <span className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">peration in</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-[15px] text-[#004A99] font-black w-4">U</span>
                        <span className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">nified</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-[15px] text-[#004A99] font-black w-4">D</span>
                        <span className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">atabase</span>
                    </div>
                </div>
            ),
            emoji: '🏛️',
            icon: <FiBookOpen className="w-8 h-8" />,
            color: 'from-blue-500 to-blue-700',
            textColor: 'text-blue-600',
            bgLight: 'bg-blue-50',
            progress: calculateProgress([1, 2, 3, 4, 5, 6, 7, 8, 9]),
            route: '/my-activity',
            description: 'CLOUD will look into getting to know more about a school.',
            isLocked: dynamicLocks['school-info'] || false,
        },
        {
            id: 'esf7',
            title: 'eSF7 Hub',
            subtitle: 'Inventory',
            emoji: '☁️',
            icon: <TbCloudSearch className="w-8 h-8" />,
            color: 'from-blue-500 to-indigo-600',
            textColor: 'text-blue-600',
            bgLight: 'bg-blue-50',
            progress: questProgress.esf7_progress || 0,
            route: 'https://stride.deped.gov.ph/insighted/Insighted-esf7/',
            badge: !questProgress.is_esf7_opened ? 'COMING SOON' : null,
            description: 'The eSF7 Hub manages the inventory of school personnel through the submission of the eSF7 tool via InsightED.',
            isLocked: !questProgress.is_esf7_opened,
        },
        {
            id: 'nspp',
            title: 'NSPP Path',
            subtitle: 'Assessment',
            emoji: '⚡',
            icon: <TbTarget className="w-8 h-8" />,
            color: 'from-amber-500 to-orange-600',
            textColor: 'text-amber-600',
            bgLight: 'bg-amber-50',
            progress: 0,
            route: '/draft/nspp',
            badge: 'COMING SOON',
            description: 'NSPP deployment will monitor the deployment of administrative staff in schools.',
            isLocked: dynamicLocks.hasOwnProperty('nspp') ? dynamicLocks['nspp'] : true, // Default to true if not set
        }
    ];


    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="w-32 h-32 flex items-center justify-center">
                    <img src={loadingLogo} className="w-full h-full object-contain drop-shadow-xl" alt="InsightED Loading" />
                </div>
            </div>
        );
    }

    return (
        <PageTransition>
            <div className="min-h-screen bg-[#fafbff] pb-32 font-sans text-slate-900 overflow-y-auto relative overflow-hidden">
                {/* Decorative Background Glows */}
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-100/40 rounded-full blur-[140px] -mr-80 -mt-80 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-100/20 rounded-full blur-[120px] -ml-64 -mb-64 pointer-events-none" />
                
                <div className="px-8 pt-12 pb-10 flex justify-between items-start">
                    <div className="flex flex-col">
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">
                            {questProgress.school_name || "Nexus Dashboard"}
                        </h1>
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">
                            School ID: {questProgress.schoolId || "------"}
                        </p>
                    </div>
                    <button 
                        onClick={confirmLogout}
                        className="p-4 bg-slate-50 rounded-3xl border border-slate-100 text-slate-400 hover:text-red-500 hover:bg-red-50 hover:border-red-100 transition-all active:scale-95 shadow-lg shadow-slate-200/50"
                        title="Logout"
                    >
                        <FiLogOut size={24} />
                    </button>
                </div>

                {/* --- 2X2 GRID MATCHING REFERENCE --- */}
                <div className="px-6 grid grid-cols-1 gap-6">
                    {modules.map((mod, idx) => {
                        const isPrimary = mod.id === 'esf7';
                        return (
                            <motion.div
                                key={mod.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                onClick={() => !mod.isLocked && handleCardClick(mod.route, mod.id)}
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
                                        <h4 className={`font-black leading-tight mb-1 ${isPrimary ? 'text-2xl' : 'text-xl'}`}>{mod.title}</h4>
                                        <p className={`text-[12px] font-black uppercase tracking-[0.15em] leading-tight ${isPrimary ? 'text-blue-200' : 'text-slate-400'}`}>{mod.subtitle}</p>
                                    </div>
                                     {mod.isLocked ? (
                                        <div className={`p-2 rounded-xl ${isPrimary ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                            <FiLock size={18} />
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3">
                                            {mod.progress === 100 && (
                                                <motion.span 
                                                    initial={{ scale: 0.5, opacity: 0 }}
                                                    animate={{ scale: 1, opacity: 1 }}
                                                    className={`px-3 py-1 rounded-lg text-[9px] font-black tracking-widest flex items-center gap-1 shadow-lg border 
                                                        ${(mod.id === 'school-info' && questProgress.validation_percentage === 100)
                                                            ? 'bg-emerald-600 text-white shadow-emerald-500/40 border-emerald-400'
                                                            : (mod.id === 'school-info' && questProgress.validation_percentage < 100)
                                                            ? 'bg-red-500 text-white shadow-red-500/30 border-red-400 animate-pulse'
                                                            : isPrimary ? 'bg-emerald-400 text-white shadow-emerald-900/20 border-emerald-400' 
                                                            : 'bg-emerald-500 text-white shadow-emerald-500/30 border-emerald-400'}
                                                    `}
                                                >
                                                    {(mod.id === 'school-info' && questProgress.validation_percentage === 100) ? (
                                                        <>
                                                            <TbShieldCheck size={10} /> VALIDATED
                                                        </>
                                                    ) : (mod.id === 'school-info' && questProgress.validation_percentage < 100) ? (
                                                        <>
                                                            <TbShieldX size={10} /> NEEDS VALIDATION
                                                        </>
                                                    ) : (
                                                        <>
                                                            <FiAward size={10} /> COMPLETED
                                                        </>
                                                    )}
                                                </motion.span>
                                            )}
                                            <FiMoreVertical className={isPrimary ? 'text-blue-200/50' : 'text-slate-300'} />
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-6 mb-8">
                                    <motion.div 
                                        animate={{ y: [0, -5, 0] }}
                                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                        className={`w-20 h-20 rounded-[2rem] flex items-center justify-center shrink-0 shadow-lg ${isPrimary ? 'bg-white/10 text-white' : 'bg-slate-50 border border-slate-100 text-slate-800'}`}
                                    >
                                        {React.cloneElement(mod.icon, { className: "w-10 h-10" })}
                                    </motion.div>
                                    
                                    <div className="flex-1">
                                        <p className={`text-sm font-bold leading-relaxed ${isPrimary ? 'text-blue-100' : 'text-slate-500'}`}>
                                            {mod.description}
                                        </p>
                                    </div>
                                </div>

                                {mod.id !== 'school-info' && (
                                    <div className="mt-auto">
                                        <div className="flex justify-between items-end mb-3">
                                            <div className="flex flex-col">
                                                <span className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isPrimary ? 'text-blue-200/60' : 'text-slate-400'}`}>Completion Percentage</span>
                                                <span className={`text-2xl font-black ${isPrimary ? 'text-white' : 'text-slate-900'}`}>{mod.progress}%</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {mod.progress === 50 && mod.id === 'esf7' && (
                                                    <motion.span 
                                                        initial={{ scale: 0.5, opacity: 0 }}
                                                        animate={{ scale: 1, opacity: 1 }}
                                                        className={`px-3 py-1 rounded-lg text-[9px] font-black tracking-widest bg-amber-500 text-white shadow-lg shadow-amber-500/30 border border-amber-400 flex items-center gap-1 animate-pulse`}
                                                    >
                                                        QUEUING
                                                    </motion.span>
                                                )}
                                                {mod.progress === 100 && mod.id !== 'school-info' && (
                                                    <motion.span 
                                                        initial={{ scale: 0.5, opacity: 0 }}
                                                        animate={{ scale: 1, opacity: 1 }}
                                                        className={`px-3 py-1 rounded-lg text-[9px] font-black tracking-widest bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 border border-emerald-400 flex items-center gap-1`}
                                                    >
                                                        <FiAward size={10} /> COMPLETED
                                                    </motion.span>
                                                )}
                                                {mod.badge && (
                                                    <span className={`px-3 py-1 rounded-full text-[9px] font-black tracking-widest ${mod.isLocked ? 'bg-slate-800 text-white' : (isPrimary ? 'bg-white/20 text-white border border-white/10' : 'bg-[#10346B] text-white')}`}>
                                                        {mod.isLocked ? 'LOCKED' : mod.badge}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className={`h-2.5 w-full rounded-full overflow-hidden ${isPrimary ? 'bg-white/10' : 'bg-slate-100'}`}>
                                            <motion.div 
                                                initial={{ width: 0 }}
                                                animate={{ width: `${mod.progress}%` }}
                                                transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 + (idx * 0.1) }}
                                                className={`h-full rounded-full ${isPrimary ? 'bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]' : 'bg-[#10346B]'}`}
                                            />
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        );
                    })}
                </div>



            </div>

            {/* --- ED WELCOME OVERLAY --- */}
            <AnimatePresence>
                {showEdWelcome && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/40 backdrop-blur-[2px] p-6 pb-20"
                    >
                        <motion.div 
                            initial={{ y: 100, scale: 0.9 }}
                            animate={{ y: 0, scale: 1 }}
                            exit={{ y: 100, scale: 0.9, opacity: 0 }}
                            className="relative bg-white rounded-[3rem] p-8 shadow-2xl border-4 border-blue-500/20 max-w-sm w-full"
                        >
                            {/* Mascot Entry */}
                            <div className="absolute -top-20 left-1/2 -translate-x-1/2 text-center">
                                <motion.div 
                                    className="text-7xl drop-shadow-2xl"
                                    animate={{ y: [0, -10, 0] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                >
                                    🦁
                                </motion.div>
                            </div>

                            <div className="mt-8 space-y-4 text-center">
                                <div className="inline-flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 mb-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                    <p className="text-blue-700 text-[10px] font-black uppercase tracking-widest">Incoming Message</p>
                                </div>
                                
                                <h2 className="text-2xl font-black text-slate-800 italic uppercase leading-tight">
                                    Hi there! <span className="text-blue-600">Magandang Araw</span> sa iyo!
                                </h2>

                                <div className="space-y-3">
                                    <p className="text-sm font-bold text-slate-600 leading-relaxed">
                                        Welcome to the <span className="text-[#004A99]">InsightED Nodes</span>. 
                                        Great job on finishing your registration!
                                    </p>
                                    <p className="text-[13px] font-medium text-slate-500 leading-relaxed italic">
                                        "I’m **Ed**, and I’ll be helping you navigate through our school management tools. 
                                        This is your command center—manage our **School Info**, check the **SHA**, or draft your **ESF7** and **NSPP** reports."
                                    </p>
                                    <p className="text-sm font-black text-slate-800">
                                        Everything is organized. Tayo na?
                                    </p>
                                </div>

                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => {
                                        localStorage.removeItem('isNewUser');
                                        setShowEdWelcome(false);
                                    }}
                                    className="w-full py-4 bg-[#004A99] text-white font-black rounded-2xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 group transition-all hover:bg-blue-800"
                                >
                                    <span>TAYO NA!</span>
                                    <FiArrowRight className="group-hover:translate-x-1 transition-transform" />
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Global Animated Scanline Effect */}
        </PageTransition>
    );
};

export default NodesDashboard;
