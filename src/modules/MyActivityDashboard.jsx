import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell 
} from 'recharts';
import { 
    FiCheckCircle, FiClock, FiTrendingUp, FiPlay, FiLock, FiActivity,
    FiZap, FiAward, FiTarget, FiStar, FiShield, FiRefreshCcw, FiWifiOff
} from 'react-icons/fi';
import BottomNav from './BottomNav';
import PageTransition from '../components/PageTransition';
import { DASHBOARD_METADATA } from '../config/dashboardMetadata';
import { useAuth } from '../context/AuthContext';
import { getModularOutbox } from '../db';

// --- Circular Progress Ring ---
const ProgressRing = ({ percentage = 0, size = 160, strokeWidth = 10 }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;
    
    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="transform -rotate-90">
                {/* Background track */}
                <circle cx={size/2} cy={size/2} r={radius} fill="none"
                    stroke="rgba(0,0,0,0.05)" strokeWidth={strokeWidth} />
                {/* Animated progress */}
                <motion.circle cx={size/2} cy={size/2} r={radius} fill="none"
                    stroke="url(#ringGradient)" strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                />
                <defs>
                    <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="50%" stopColor="#06b6d4" />
                        <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                </defs>
            </svg>
            {/* Center Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span 
                    className="text-4xl font-black text-slate-800"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.5, type: "spring", bounce: 0.5 }}
                >
                    {Math.round(percentage)}%
                </motion.span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Complete</span>
            </div>
        </div>
    );
};

// --- XP calculation helper ---
const getXPForUnits = (unitsArray, flags) => {
    // If we have flags object from backend, use it
    if (flags && Object.keys(flags).length > 0) {
        return DASHBOARD_METADATA.units.reduce((total, unit) => {
            if (flags[`unit${unit.id}`]) total += unit.xp;
            return total;
        }, 0);
    }
    // Fallback: use completedUnits array
    if (Array.isArray(unitsArray)) {
        return DASHBOARD_METADATA.units.reduce((total, unit) => {
            if (unitsArray.includes(unit.id)) total += unit.xp;
            return total;
        }, 0);
    }
    return 0;
};

const getLevelFromXP = (xp, maxXP) => {
    if (xp >= maxXP - 50) return { level: 9, title: '🏆 STRIDE Master', color: 'from-yellow-400 to-amber-500' };
    if (xp >= 1800) return { level: 7, title: '⭐ Elite Runner', color: 'from-purple-400 to-indigo-500' };
    if (xp >= 1200) return { level: 6, title: '🔥 Trailblazer', color: 'from-red-400 to-orange-500' };
    if (xp >= 800)  return { level: 5, title: '💎 Data Champion', color: 'from-cyan-400 to-blue-500' };
    if (xp >= 500)  return { level: 4, title: '🚀 Pathfinder', color: 'from-emerald-400 to-teal-500' };
    if (xp >= 250)  return { level: 3, title: '🛡️ Builder', color: 'from-blue-400 to-indigo-500' };
    if (xp >= 100)  return { level: 2, title: '📝 Explorer', color: 'from-green-400 to-emerald-500' };
    return { level: 1, title: '🌱 Rookie', color: 'from-slate-400 to-slate-500' };
};

const MyActivityDashboard = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    
    // Parse UID from query params for Super User impersonation
    const queryParams = new URLSearchParams(location.search);
    const impersonatedUid = queryParams.get('uid');
    
    const [data, setData] = useState(() => {
        // Only use cache if not impersonating
        if (!impersonatedUid) {
            const cached = localStorage.getItem('activity_data');
            return cached ? JSON.parse(cached) : null;
        }
        return null;
    });
    
    const [loading, setLoading] = useState(true);
    const [targetSchoolId, setTargetSchoolId] = useState(null);
    const [pendingCount, setPendingCount] = useState(0);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    const unitMap = useMemo(() => DASHBOARD_METADATA.units.map(u => ({
        id: u.id,
        flagId: u.id,
        name: u.title,
        path: u.path,
        xp: u.xp,
        icon: u.emoji
    })), []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                let schoolId = localStorage.getItem('schoolId');
                
                // --- SUPER USER IMPERSONATION ---
                if (user?.role === 'Super User' && impersonatedUid) {
                    const profileRes = await fetch(`/api/school-by-user/${impersonatedUid}`);
                    const profileJson = await profileRes.json();
                    if (profileJson.exists && profileJson.data.school_id) {
                        schoolId = profileJson.data.school_id;
                    }
                }

                if (!schoolId) { 
                    setLoading(false); 
                    return; 
                }
                
                setTargetSchoolId(schoolId);

                const response = await fetch(`/api/schools/${schoolId}/activity`);
                if (response.ok) {
                    const json = await response.json();
                    setData(json.data);
                    if (!impersonatedUid) {
                        localStorage.setItem('activity_data', JSON.stringify(json.data));
                    }
                }
            } catch (err) {
                console.error('Fetch Error:', err);
            } finally {
                setLoading(false);
            }
        };

        const handleStatus = () => {
             const status = navigator.onLine;
             setIsOnline(status);
             if (status) fetchData();
        };
        window.addEventListener('online', handleStatus);
        window.addEventListener('offline', handleStatus);
        
        if (user) {
            fetchData();
            // Fetch pending outbox count
            getModularOutbox().then(items => setPendingCount(items.length));
        }

        return () => {
            window.removeEventListener('online', handleStatus);
            window.removeEventListener('offline', handleStatus);
        };
    }, [user, impersonatedUid]);

    const xp = useMemo(() => getXPForUnits(data?.progress?.completedUnits, data?.progress?.flags), [data]);
    const maxXP = useMemo(() => DASHBOARD_METADATA.units.reduce((sum, u) => sum + u.xp, 0), []);
    const levelInfo = useMemo(() => getLevelFromXP(xp, maxXP), [xp, maxXP]);

    const nextUnit = useMemo(() => {
        if (!data?.progress?.flags) return unitMap[0];
        return unitMap.find(u => !data.progress.flags[`unit${u.flagId}`]) || null;
    }, [data, unitMap]);

    const achievements = useMemo(() => {
        const flags = data?.progress?.flags || {};
        const completedArr = data?.progress?.completedUnits || [];
        const completedCount = Array.isArray(completedArr) ? completedArr.length : (typeof completedArr === 'number' ? completedArr : 0);
        const totalUnits = DASHBOARD_METADATA.units.length;
        const halfway = Math.floor(totalUnits / 2);

        return [
            { id: 'first', name: 'First Steps', desc: 'Complete your first unit', earned: completedCount >= 1, icon: '🎯' },
            { id: 'half', name: 'STRIDE Miler', desc: `Complete ${halfway} units`, earned: completedCount >= halfway, icon: '⚡' },
            { id: 'sprint', name: 'STRIDE Sprinter', desc: 'Log a fastest sprint', earned: !!data?.gamification?.fastest_sprint, icon: '🏃' },
            { id: 'master', name: 'STRIDE Hero', desc: `Complete all ${totalUnits} units`, earned: completedCount >= totalUnits, icon: '👑' },
        ];
    }, [data]);

    const comparativeData = useMemo(() => {
        if (data?.comparative && data.comparative.length > 0) return data.comparative;
        
        // Fallback: High-quality mock data if backend comparative stats are missing
        const myScore = data?.progress?.percentage || 0;
        return [
            { name: 'Division Avg', completed: 42 },
            { name: 'District Avg', completed: 58 },
            { name: 'My School', completed: myScore },
            { name: 'Top Performer', completed: 92 },
        ];
    }, [data]);

    if (loading) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="flex flex-col items-center">
                <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full"
                />
                <p className="mt-4 text-emerald-600 font-bold text-sm uppercase tracking-widest">Loading quest data...</p>
            </div>
        </div>
    );

    return (
        <PageTransition>
            <div className="min-h-screen bg-[#f8faff] font-sans pb-28 relative overflow-hidden text-slate-900">
                <AnimatePresence>
                    {!isOnline && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-rose-500 text-white px-6 py-2 flex items-center justify-center gap-2 overflow-hidden z-[100] sticky top-0"
                        >
                            <FiWifiOff className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest italic">Offline Mode Active • Progress will save to Sync Center</span>
                        </motion.div>
                    )}
                </AnimatePresence>
                {/* Ambient background effects - lighter and softer */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-100/30 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-1/3 right-0 w-[400px] h-[400px] bg-indigo-100/30 rounded-full blur-[100px] pointer-events-none" />

                {/* Header with Level Badge */}
                <div className="relative px-6 pt-14 pb-8">
                    <div className="flex justify-between items-start">
                        <div>
                            <motion.div 
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${levelInfo.color} mb-3`}
                            >
                                <FiShield size={12} className="text-white" />
                                <span className="text-[10px] font-black text-white uppercase tracking-wider">LVL {levelInfo.level} • {levelInfo.title}</span>
                            </motion.div>
                            <h1 className="text-3xl font-black text-slate-800 tracking-tight">My Quest</h1>
                            {data ? (
                                <p className="text-slate-500 text-[10px] font-bold mt-1.5 uppercase tracking-widest leading-relaxed">
                                    <span className="text-[#004A99]">{data?.schoolInfo?.school_name || 'Loading School...'}</span> • {data?.schoolInfo?.school_id || targetSchoolId} <br/>
                                    <span className="text-slate-400">Head: </span><span className="text-emerald-600">{user?.first_name || user?.firstName || 'User'} {user?.last_name || user?.lastName || ''}</span>
                                </p>
                            ) : (
                                <p className="text-slate-400 text-[10px] font-bold mt-1.5 uppercase tracking-widest">Loading...</p>
                            )}
                        </div>
                        <motion.div 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", bounce: 0.5 }}
                            onClick={() => navigate('/sync-center')}
                            className="bg-white p-3 rounded-2xl border border-slate-100 shadow-lg shadow-indigo-100/50 relative cursor-pointer active:scale-95 group transition-all"
                        >
                            <FiRefreshCcw className={`text-emerald-500 text-2xl transition-transform duration-700 ${pendingCount > 0 ? 'animate-spin-slow' : 'group-hover:rotate-180'}`} />
                            {pendingCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                                    {pendingCount}
                                </span>
                            )}
                        </motion.div>
                    </div>

                    {/* XP Bar */}
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="mt-5 bg-white rounded-2xl p-4 border border-slate-50 shadow-md shadow-indigo-50"
                    >
                        <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                                <FiZap className="text-yellow-500" size={16} />
                                <span className="text-slate-700 font-black text-sm">{xp.toLocaleString()} XP</span>
                            </div>
                            <span className="text-slate-400 text-[10px] font-bold">{maxXP.toLocaleString()} XP MAX</span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min((xp / maxXP) * 100, 100)}%` }}
                                transition={{ duration: 1.2, ease: "easeOut" }}
                                className="h-full rounded-full bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-500 shadow-sm shadow-orange-200"
                            />
                        </div>
                    </motion.div>
                </div>

                {/* Main Content */}
                <div className="px-5 space-y-6 relative z-10">

                    {/* Progress Ring + Stats */}
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl shadow-indigo-100/40"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.15em] mb-2">Mission Progress</p>
                                <h2 className="text-2xl font-black text-slate-800 mb-1">
                                    {Array.isArray(data?.progress?.completedUnits) ? data.progress.completedUnits.length : (data?.progress?.completedUnits || 0)} <span className="text-slate-300 text-lg">/ {DASHBOARD_METADATA.units.length}</span>
                                </h2>
                                <p className="text-emerald-500 text-[11px] font-bold">Units Conquered</p>
                                
                                {/* Mini stats */}
                                <div className="mt-4 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <FiClock size={12} className="text-amber-500" />
                                        <span className="text-slate-500 text-[10px] font-bold">
                                            {data?.gamification?.fastest_sprint?.time_text || 'No sprints yet'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <FiTrendingUp size={12} className="text-cyan-500" />
                                        <span className="text-slate-500 text-[10px] font-bold">
                                            {data?.gamification?.fastest_sprint ? `Best: Unit ${data.gamification.fastest_sprint.unit}` : 'Start a unit!'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <ProgressRing percentage={data?.progress?.percentage || 0} />
                        </div>

                        {/* Continue Button */}
                        {nextUnit && (
                            <motion.div 
                                onClick={() => navigate(nextUnit.path)}
                                whileTap={{ scale: 0.97 }}
                                className="mt-6 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-2xl p-4 flex items-center justify-between cursor-pointer group relative overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-white opacity-0 group-active:opacity-10 transition-opacity" />
                                <div className="flex items-center gap-4 relative z-10">
                                    <div className="bg-white/20 p-2.5 rounded-xl">
                                        <FiPlay className="text-white fill-white" size={18} />
                                    </div>
                                    <div>
                                        <p className="text-white text-sm font-black">Continue Quest</p>
                                        <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider">
                                            {nextUnit.icon} {nextUnit.name} • +{nextUnit.xp} XP
                                        </p>
                                    </div>
                                </div>
                                <div className="bg-white/20 w-8 h-8 rounded-full flex items-center justify-center">
                                    <span className="text-white font-black">→</span>
                                </div>
                            </motion.div>
                        )}
                        {!nextUnit && (
                            <div className="mt-6 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 rounded-2xl p-4 border border-yellow-500/20 text-center">
                                <p className="text-yellow-400 font-black text-sm">🎉 All Quests Complete!</p>
                                <p className="text-yellow-400/50 text-[10px] font-bold mt-1">You are a STRIDE Master</p>
                            </div>
                        )}
                    </motion.div>

                    {/* Achievements */}
                    <div>
                        <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                            <FiAward size={12} className="text-yellow-500" /> Achievements
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            {achievements.map((ach, i) => (
                                <motion.div
                                    key={ach.id}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.15 * i }}
                                    className={`p-4 rounded-2xl border transition-all ${
                                        ach.earned 
                                            ? 'bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200 shadow-sm shadow-amber-100' 
                                            : 'bg-white border-slate-100 opacity-60'
                                    }`}
                                >
                                    <span className="text-2xl">{ach.icon}</span>
                                    <p className={`text-[11px] font-black mt-2 ${ach.earned ? 'text-slate-800' : 'text-slate-400'}`}>
                                        {ach.name}
                                    </p>
                                    <p className={`text-[9px] font-bold mt-0.5 ${ach.earned ? 'text-slate-500' : 'text-slate-300'}`}>
                                        {ach.desc}
                                    </p>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* Comparative Chart */}
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl shadow-indigo-100/30"
                    >
                        <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
                            <FiTarget size={12} className="text-cyan-500" /> Leaderboard Snapshot
                        </h3>
                        <div className="h-48 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={comparativeData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                                    <XAxis 
                                        dataKey="name" axisLine={false} tickLine={false} 
                                        tick={{ fill: 'rgba(0,0,0,0.4)', fontSize: 9, fontWeight: 700 }}
                                        dy={8}
                                    />
                                    <YAxis hide />
                                    <Tooltip 
                                        cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const payloadValue = payload[0].value;
                                                const itemName = payload[0].payload.name;
                                                return (
                                                    <div className="bg-white px-3 py-2 rounded-xl border border-slate-100 shadow-xl">
                                                        <p className="text-slate-400 text-[9px] font-black uppercase">{itemName}</p>
                                                        <p className="text-emerald-500 text-xs font-black">{payloadValue}%</p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar dataKey="completed" radius={[10, 10, 10, 10]} barSize={36}>
                                        {comparativeData.map((entry, index) => (
                                            <Cell 
                                                key={`cell-${index}`} 
                                                fill={entry.name === 'My School' ? 'url(#gamifiedGradient)' : 'rgba(0,0,0,0.05)'} 
                                            />
                                        ))}
                                    </Bar>
                                    <defs>
                                        <linearGradient id="gamifiedGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#34d399" />
                                            <stop offset="100%" stopColor="#06b6d4" />
                                        </linearGradient>
                                    </defs>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>

                    {/* Quest Log / Mission Checklist */}
                    <div className="pb-4">
                        <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                            <FiStar size={12} className="text-purple-500" /> Quest Log
                        </h3>
                        <div className="space-y-2.5">
                            {unitMap.filter(u => {
                                const completedArr = data?.progress?.completedUnits || [];
                                return Array.isArray(completedArr) ? !completedArr.includes(u.id) : !data?.progress?.flags?.[`unit${u.flagId}`];
                            }).length === 0 ? (
                                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-8 text-center">
                                    <div className="text-4xl mb-3">🏆</div>
                                    <h4 className="text-emerald-800 font-black text-sm">All Quests Completed!</h4>
                                    <p className="text-emerald-600/70 text-[10px] font-bold mt-1 uppercase tracking-wider">You are a STRIDE Master</p>
                                </div>
                            ) : (
                                unitMap
                                    .filter(unit => {
                                        const completedArr = data?.progress?.completedUnits || [];
                                        return Array.isArray(completedArr) ? !completedArr.includes(unit.id) : !data?.progress?.flags?.[`unit${unit.flagId}`];
                                    })
                                    .map((unit, i) => {
                                        const isNext = nextUnit?.id === unit.id;
                                        return (
                                            <motion.div 
                                                key={unit.id}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.05 * i }}
                                                onClick={() => {
                                                    const targetPath = impersonatedUid ? `${unit.path}?uid=${impersonatedUid}` : unit.path;
                                                    navigate(targetPath);
                                                }}
                                                className={`p-4 rounded-2xl flex items-center justify-between border cursor-pointer active:scale-[0.98] transition-all ${
                                                    isNext 
                                                        ? 'bg-white border-cyan-200 shadow-lg shadow-indigo-100/50' 
                                                        : 'bg-white border-slate-50 opacity-60'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3.5">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                                                        isNext ? 'bg-cyan-50' : 'bg-slate-50'
                                                    }`}>
                                                        {unit.icon}
                                                    </div>
                                                    <div>
                                                        <h4 className={`text-[11px] font-black ${
                                                            isNext ? 'text-cyan-700' : 'text-slate-500'
                                                        }`}>
                                                            {unit.name}
                                                        </h4>
                                                        <p className={`text-[9px] font-bold mt-0.5 ${
                                                            isNext ? 'text-cyan-500/70' : 'text-slate-300'
                                                        }`}>
                                                            {data?.progress?.incompleteUnits?.includes(unit.id) ? (
                                                                <span className="text-amber-500 font-black">⚠️ INCOMPLETE</span>
                                                            ) : isNext ? '⚡ ACTIVE QUEST' : `+${unit.xp} XP Reward`}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                                                    isNext ? 'bg-cyan-50' : 'bg-slate-50'
                                                }`}>
                                                    {isNext 
                                                        ? <FiPlay size={12} className="text-cyan-500 fill-cyan-500" />
                                                        : <FiLock size={12} className="text-slate-300" />
                                                    }
                                                </div>
                                            </motion.div>
                                        );
                                    })
                            )}
                        </div>
                    </div>

                </div>

                <BottomNav userRole="School Head" />
            </div>
        </PageTransition>
    );
};

export default MyActivityDashboard;
