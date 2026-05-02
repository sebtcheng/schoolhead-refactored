import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { FiHome, FiUsers, FiGrid, FiBookOpen, FiArrowLeft, FiClock, FiShield, FiStar, FiAward, FiCheck, FiMapPin, FiInfo, FiMail, FiX } from "react-icons/fi";
import { TbShieldCheck, TbShieldX } from "react-icons/tb";
import { motion, AnimatePresence } from "framer-motion";
import { getUnitDraft } from "../db";

import BottomNav from "../modules/BottomNav";
import { DASHBOARD_METADATA } from "../config/dashboardMetadata";
import { useAuth } from "../context/AuthContext";

const CircularProgress = ({ progress = 0, size = 60, strokeWidth = 5, children, isLocked, isLoading, isValidated }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const dashoffset = circumference - (progress / 100) * circumference;

    return (
        <div className="relative flex items-center justify-center font-bold" style={{ width: size, height: size }}>
            <svg className="absolute top-0 left-0 transform -rotate-90 pointer-events-none" width={size} height={size}>
                <circle
                    className={isLocked ? "text-slate-100" : "text-slate-100"}
                    strokeWidth={strokeWidth}
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
                <motion.circle
                    animate={isLoading ? { opacity: [0.3, 0.8, 0.3] } : {}}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    className={isLocked ? "text-slate-200" : isValidated ? "text-emerald-500" : "text-[#FDB913] transition-all duration-1000 ease-out"}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={dashoffset}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
            </svg>
            <div className={`absolute inset-0 flex items-center justify-center rounded-full ${isLocked ? 'grayscale opacity-60' : ''} ${isLoading ? 'animate-pulse' : ''}`}>
                {children}
            </div>
        </div>
    );
};

const StatusSkeleton = () => (
    <motion.div 
        animate={{ opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        className="h-4 w-14 bg-slate-100 rounded-full"
    />
);

const getRank = (xp) => {
    if (xp >= 500) return { title: 'Platinum', badgeClass: 'bg-slate-800 text-slate-100 border-slate-700 shadow-slate-200', icon: <FiAward /> };
    if (xp >= 300) return { title: 'Gold', badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 shadow-amber-100', icon: <FiStar /> };
    if (xp >= 150) return { title: 'Silver', badgeClass: 'bg-slate-100 text-slate-700 border-slate-300 shadow-slate-100', icon: <FiShield /> };
    return { title: 'Bronze', badgeClass: 'bg-orange-50 text-orange-800 border-orange-200 shadow-sm', icon: <FiShield /> };
};

const ModularDashboard = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    
    // Parse UID and Mode from query params
    const impersonatedUid = searchParams.get('uid');
    const mode = searchParams.get('mode');

    const [hasDraft, setHasDraft] = useState(false);
    const [questProgress, setQuestProgress] = useState(() => {
        // Only use cache if not impersonating
        if (!impersonatedUid) {
            const stored = localStorage.getItem('quest_progress');
            if (stored) {
                const parsed = JSON.parse(stored);
                return { ...parsed, isFromCache: true };
            }
        }
        return { completedUnits: [], xp: 0, isFromCache: false, validationFlags: {} };
    });
    const [validationPercentage, setValidationPercentage] = useState(0);
    const [curricularOffering, setCurricularOffering] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [unitDrafts, setUnitDrafts] = useState({});
    const [unitTimestamps, setUnitTimestamps] = useState(() => {
        if (!impersonatedUid) {
            const stored = localStorage.getItem('quest_progress');
            if (stored) {
                const parsed = JSON.parse(stored);
                return parsed.timestamps || {};
            }
        }
        return {};
    });
    const [showDevInfo, setShowDevInfo] = useState(false);

    useEffect(() => {
        const loadProgress = async () => {
            try {
                let schoolId = localStorage.getItem('schoolId');
                
                // --- SUPER USER IMPERSONATION ---
                if (user?.role === 'Super User' && impersonatedUid) {
                    console.log(`[ModularDashboard] Impersonating UID: ${impersonatedUid}`);
                    const profileRes = await fetch(`api/school-by-user/${impersonatedUid}`);
                    const profileJson = await profileRes.json();
                    if (profileJson.exists && profileJson.data.school_id) {
                        schoolId = profileJson.data.school_id;
                        console.log(`[ModularDashboard] Found impersonated School ID: ${schoolId}`);
                    }
                }

                if (schoolId) {
                    const res = await fetch(`api/ph_schools/progress/${schoolId}`);
                    if (res.ok) {
                        const json = await res.json();
                        // [Fix] Backend now returns data nested under 'data' property
                        if (json.success && json.data && json.data.progress) {
                            const { progress, schoolInfo } = json.data;
                            
                            if (progress.curricular_offering) {
                                setCurricularOffering(progress.curricular_offering);
                            }
                            // Sync if server has more/different data
                            setQuestProgress({ 
                                ...progress, 
                                schoolId: schoolInfo?.school_id || schoolId, 
                                school_name: schoolInfo?.school_name,
                                isFromCache: false 
                            });
                            
                            if (progress.timestamps) {
                                setUnitTimestamps(progress.timestamps);
                            }
                            
                            if (progress.validation_percentage) {
                                setValidationPercentage(progress.validation_percentage);
                            }
                            
                            // Only cache if not impersonating
                            if (!impersonatedUid) {
                                localStorage.setItem('quest_progress', JSON.stringify(progress));
                            }
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to sync quest progress from server", err);
            }
            setIsLoading(false);
        };
        
        if (user) {
            loadProgress();
        }

        const checkAllDrafts = async () => {
            const schoolId = localStorage.getItem('schoolId');
            if (!schoolId) return;

            const drafts = {};
            // Check Units 1-8 (Unit 6 Teaching Personnel has been removed)
            const unitIds = [1, 2, 3, 4, 5, 6, 7, 8, 9];
            
            await Promise.all(unitIds.map(async (i) => {
                try {
                    const draft = await getUnitDraft(i, schoolId);
                    // Auto-seeded drafts are baseline data, not real pending edits
                    if (draft && !draft.isAutoSeeded) {
                        drafts[i] = true;
                    }
                } catch (e) {
                    console.warn(`Error checking draft for unit ${i}`, e);
                }
            }));
            
            setUnitDrafts(drafts);
        };
        checkAllDrafts();
    }, [user]);

    const formatTimestamp = (ts) => {
        if (!ts) return "Not started";
        const date = new Date(ts);
        if (isNaN(date.getTime())) return "Not started";
        
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        
        const timeStr = new Intl.DateTimeFormat('en-PH', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        }).format(date);
        
        if (isToday) return `Today, ${timeStr}`;
        
        return new Intl.DateTimeFormat('en-PH', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        }).format(date);
    };

    const handleBack = () => {
        navigate(-1);
    };

    const modules = React.useMemo(() => {
        const offering = (curricularOffering || "").toLowerCase();
        
        const hasHighSchool = offering.includes('7') || offering.includes('8') || offering.includes('9') || 
                              offering.includes('10') || offering.includes('11') || offering.includes('12') || 
                              offering.includes('high school');

        let units = DASHBOARD_METADATA.units;

        return units.map(u => {
            let title = u.title;

            const Icon = u.icon;

            return {
                id: u.id,
                title: title,
                icon: <Icon className="w-5 h-5" />,
                path: u.path,
                locked: false, // Logic for locking can be added here if needed
                hasDraft: !!unitDrafts[u.id],
                lastUpdated: unitTimestamps[`unit${u.id}`],
                isValidated: questProgress.validationFlags?.[`unit${u.id}`] === true
            };
        });
    }, [curricularOffering, questProgress, mode]);

    const handleModuleClick = (mod) => {
        if (mod.locked) return;
        const targetPath = impersonatedUid ? `${mod.path}?uid=${impersonatedUid}` : mod.path;
        navigate(targetPath);
    };



    const userRank = getRank(questProgress.xp);

    return (
        <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="min-h-screen flex flex-col items-center bg-slate-50 font-sans pb-32"
        >
            <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md rounded-b-[2rem] shadow-[0_4px_20px_rgba(0,0,0,0.03)] border-b border-slate-100 px-4 py-4 sm:px-6">
                <div className="max-w-md mx-auto relative flex items-center justify-between">
                    <button
                        onClick={handleBack}
                        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
                        aria-label="Go back"
                    >
                        <FiArrowLeft className="w-5 h-5" />
                    </button>

                    <div className="flex flex-col items-center absolute left-1/2 -translate-x-1/2 pointer-events-none w-full max-w-[200px]">
                        <h1 className="text-sm font-black text-[#004A99] tracking-tight truncate w-full text-center">
                            {questProgress.school_name || "InsightEd Quest"}
                        </h1>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            ID: {questProgress.schoolId || "------"}
                        </p>
                    </div>

                    <button
                        onClick={() => setShowDevInfo(true)}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-50 text-[#004A99] hover:bg-blue-100 transition-colors shadow-sm"
                        aria-label="Developer Info"
                    >
                        <FiInfo className="w-4 h-4" />
                    </button>
                </div>
            </header>

            <AnimatePresence>
                {showDevInfo && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm"
                        onClick={() => setShowDevInfo(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.9, y: 20, opacity: 0 }}
                            className="w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl overflow-hidden relative"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="absolute top-4 right-4">
                                <button 
                                    onClick={() => setShowDevInfo(false)}
                                    className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                                >
                                    <FiX className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="p-8">
                                <div className="flex flex-col items-center mb-8">
                                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
                                        <FiUsers className="w-8 h-8 text-[#004A99]" />
                                    </div>
                                    <h2 className="text-xl font-black text-slate-800 tracking-tight">Meet the Team</h2>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Developers</p>
                                </div>

                                <div className="space-y-4 mb-8">
                                    {[
                                        { name: "Mr. Sebastian Cheng", role: "Project Lead" },
                                        { name: "Ms. Clea Monique Sacriz", role: "Software Developer" },
                                        { name: "Mr. Klein Catapang", role: "Software Developer" }
                                    ].map((dev, i) => (
                                        <motion.div 
                                            key={i}
                                            initial={{ x: -10, opacity: 0 }}
                                            animate={{ x: 0, opacity: 1 }}
                                            transition={{ delay: 0.1 + i * 0.1 }}
                                            className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-[#004A99] text-white flex items-center justify-center font-black text-xs shadow-md">
                                                {dev.name.split(' ').pop().charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-slate-800">{dev.name}</p>
                                                <p className="text-[10px] font-bold text-[#004A99] uppercase tracking-wider">{dev.role}</p>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>

                                <div className="border-t border-slate-100 pt-6">
                                    <a 
                                        href="mailto:support.stride@deped.gov.ph"
                                        className="flex flex-col items-center gap-2 group"
                                    >
                                        <div className="flex items-center gap-2 bg-slate-50 hover:bg-blue-50 transition-colors px-4 py-3 rounded-2xl border border-slate-100 w-full justify-center group-hover:border-blue-200">
                                            <FiMail className="w-4 h-4 text-blue-500" />
                                            <span className="text-xs font-black text-slate-700 tracking-tight">support.stride@deped.gov.ph</span>
                                        </div>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Contact Support</p>
                                    </a>
                                </div>
                            </div>

                            <div className="bg-[#004A99] py-3 text-center">
                                <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Powered by STRIDE • 2024</p>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            <div className="flex flex-col mt-10 w-full max-w-md relative px-4">
                <div className="absolute top-8 bottom-12 left-8 w-[2px] border-l-2 border-dashed border-slate-200 z-0" />
                
                {/* Validation Status Summary */}
                <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between shadow-sm"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-md">
                            <TbShieldCheck size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Quality Score</p>
                            <h4 className="text-sm font-black text-slate-800">{validationPercentage}% Validated</h4>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-[8px] font-bold text-slate-400 uppercase block">Data Integrity</span>
                        <span className="text-[10px] font-black text-emerald-600">PREMIUM</span>
                    </div>
                </motion.div>

                <div className="space-y-4 w-full relative z-10 pl-6">
                    {modules.map((mod, idx) => {
                        const isCompleted = questProgress.completedUnits.includes(mod.id);
                        const isLocked = mod.locked;
                        const isNextActiveRound = !isCompleted && !isLocked && 
                                                  modules.slice(0, idx).every(m => questProgress.completedUnits.includes(m.id));
                        const ringProgress = isCompleted ? 100 : (isNextActiveRound ? 25 : 0);

                        return (
                            <motion.div
                                key={mod.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.08, type: "spring", stiffness: 100 }}
                            >
                                <motion.button
                                    whileHover={!isLocked ? { scale: 1.02 } : {}}
                                    whileTap={!isLocked ? { scale: 0.98 } : {}}
                                    onClick={() => handleModuleClick(mod)}
                                    className={`relative overflow-hidden flex items-center gap-4 w-full p-3 rounded-3xl shadow-sm border transition-all duration-300 text-left cursor-pointer
                                        ${isLocked ? 'border-slate-100 bg-slate-50 cursor-not-allowed opacity-75' : 
                                          mod.isValidated ? 'border-emerald-500/30 bg-emerald-50/10 shadow-lg shadow-emerald-500/10' :
                                          (isCompleted && !mod.isValidated) ? 'border-red-400 bg-red-50/30 shadow-md shadow-red-200/50 animate-pulse-subtle' :
                                          isCompleted ? 'border-[#004A99]/20 bg-white hover:border-[#004A99]/40 hover:shadow-md' : 
                                          isNextActiveRound ? 'border-[#FDB913] bg-[#FDB913]/5 shadow-md shadow-[#FDB913]/10 ring-2 ring-[#FDB913]/20 hover:bg-white' : 
                                          'border-slate-200 bg-white hover:border-[#004A99]/30 hover:shadow-md'}
                                    `}
                                >
                                    {(isCompleted && !mod.isValidated) && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-200/10 to-transparent -translate-x-full animate-shimmer pointer-events-none" />
                                    )}
                                    <div className="flex-shrink-0 -mb-2">
                                        <CircularProgress 
                                            progress={ringProgress} 
                                            size={54} 
                                            strokeWidth={4} 
                                            isLocked={isLocked}
                                            isLoading={isLoading && !questProgress.isFromCache}
                                            isValidated={mod.isValidated}
                                        >
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors
                                                ${isLocked ? 'bg-slate-200 text-slate-400' :
                                                  mod.isValidated ? 'bg-emerald-500 text-white shadow-inner ring-2 ring-emerald-200' :
                                                  (isCompleted && !mod.isValidated) ? 'bg-red-500 text-white shadow-inner ring-4 ring-red-100 animate-pulse' :
                                                  isCompleted ? 'bg-[#004A99] text-white shadow-inner' :
                                                  isNextActiveRound ? 'bg-[#FDB913] text-[#004A99] shadow-inner shadow-yellow-600/20' :
                                                  'bg-blue-50 text-[#004A99]'
                                                }`}>
                                                {mod.isValidated ? <TbShieldCheck className="w-5 h-5" /> : isCompleted ? <FiCheck className="w-5 h-5" /> : mod.icon}
                                            </div>
                                        </CircularProgress>
                                    </div>

                                    <div className="flex flex-col flex-grow py-1">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <span className={`text-[10px] font-black uppercase tracking-[0.15em]
                                                ${isLocked ? 'text-slate-400' : isCompleted ? 'text-slate-400' : 'text-[#004A99]'}
                                            `}>
                                                Unit {mod.id}
                                            </span>
                                            {mod.isValidated ? (
                                                <span className="flex items-center gap-1 text-[9px] font-bold text-white bg-emerald-500 px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                                                    <TbShieldCheck size={10} /> Validated
                                                </span>
                                            ) : isCompleted ? (
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className="flex items-center gap-1 text-[9px] font-black text-red-700 bg-red-100 px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse border border-red-200 shadow-sm">
                                                        <TbShieldX size={10} /> Review Needed
                                                    </span>
                                                </div>
                                            ) : questProgress.incompleteUnits?.includes(mod.id) ? (
                                                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                    Incomplete
                                                </span>
                                            ) : isLoading && !questProgress.isFromCache ? (
                                                <StatusSkeleton />
                                            ) : null}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-sm font-black tracking-tight ${isLocked ? 'text-slate-500' : 'text-slate-800'}`}>
                                                {mod.title}
                                            </span>
                                            {mod.hasDraft && (
                                                <motion.span 
                                                    initial={{ scale: 0.8, opacity: 0 }}
                                                    animate={{ scale: 1, opacity: 1 }}
                                                    className="px-2 py-0.5 rounded-lg bg-amber-500 text-white text-[8px] font-black uppercase tracking-wider shadow-sm shadow-amber-200"
                                                >
                                                    Draft
                                                </motion.span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <FiClock className="w-3 h-3 text-slate-300" />
                                            <span className="text-[10px] font-bold text-slate-400">
                                                {formatTimestamp(mod.lastUpdated)}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    {isNextActiveRound && (
                                        <div className="absolute inset-0 bg-white/40 rounded-[2rem] -z-10 pointer-events-none" />
                                    )}
                                </motion.button>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            <BottomNav userRole="School Head" />
        </motion.div>
    );
};

export default ModularDashboard;
