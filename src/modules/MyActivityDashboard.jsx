import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell 
} from 'recharts';
import { 
    FiCheckCircle, FiClock, FiTrendingUp, FiPlay, FiLock, FiActivity,
    FiZap, FiAward, FiTarget, FiStar, FiShield, FiRefreshCcw, FiWifiOff, FiPrinter,
    FiHome, FiSettings, FiBookOpen, FiLogOut
} from 'react-icons/fi';
import { LuCompass } from "react-icons/lu";
import { TbSchool, TbHeadset, TbShieldCheck, TbShieldX } from "react-icons/tb";
import PageTransition from '../components/PageTransition';
import { DASHBOARD_METADATA } from '../config/dashboardMetadata';
import { useAuth } from '../context/AuthContext';
import { getModularOutbox } from '../db';
import { downloadPrintableReport } from '../utils/PrintableExportGenerator';
import { api } from "../lib/api";

// --- Circular Progress Ring ---
const ProgressRing = ({ percentage = 0, validationPercentage = 0, size = 160, strokeWidth = 10 }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;
    
    // Nested validation ring
    const innerRadius = radius - strokeWidth - 4;
    const innerCircumference = innerRadius * 2 * Math.PI;
    const innerOffset = innerCircumference - (validationPercentage / 100) * innerCircumference;

    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="transform -rotate-90">
                {/* Background track (Outer) */}
                <circle cx={size/2} cy={size/2} r={radius} fill="none"
                    stroke="rgba(0,0,0,0.05)" strokeWidth={strokeWidth} />
                {/* Animated progress (Outer - Reported) */}
                <motion.circle cx={size/2} cy={size/2} r={radius} fill="none"
                    stroke="url(#ringGradient)" strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                />
                
                {/* Background track (Inner) */}
                <circle cx={size/2} cy={size/2} r={innerRadius} fill="none"
                    stroke="rgba(0,0,0,0.03)" strokeWidth={strokeWidth - 2} />
                {/* Animated progress (Inner - Validated) */}
                <motion.circle cx={size/2} cy={size/2} r={innerRadius} fill="none"
                    stroke="#10b981" strokeWidth={strokeWidth - 2}
                    strokeLinecap="round"
                    strokeDasharray={innerCircumference}
                    initial={{ strokeDashoffset: innerCircumference }}
                    animate={{ strokeDashoffset: innerOffset }}
                    transition={{ duration: 1.8, ease: "easeOut", delay: 0.3 }}
                    className="drop-shadow-[0_0_5px_rgba(16,185,129,0.2)]"
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
                <div className="flex flex-col items-center -mt-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Reported</span>
                    <span className="text-[8px] font-bold text-emerald-500 uppercase tracking-tighter mt-0.5">{Math.round(validationPercentage)}% Validated</span>
                </div>
            </div>
        </div>
    );
};

// --- XP calculation helper ---
const getXPForUnits = (unitsArray, flags) => {
    if (flags && Object.keys(flags).length > 0) {
        return DASHBOARD_METADATA.units.reduce((total, unit) => {
            if (flags[`unit${unit.id}`]) total += unit.xp;
            return total;
        }, 0);
    }
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
    const { user, confirmLogout } = useAuth();
    
    // Parse UID from query params for Super User impersonation
    const queryParams = new URLSearchParams(location.search);
    const impersonatedUid = queryParams.get('uid');
    
    const [data, setData] = useState(() => {
        if (!impersonatedUid) {
            const cached = localStorage.getItem('activity_data');
            try {
                return cached && cached !== 'undefined' ? JSON.parse(cached) : null;
            } catch (e) {
                console.error('Failed to parse cached activity_data', e);
                return null;
            }
        }
        return null;
    });
    
    const [loading, setLoading] = useState(true);
    const [targetSchoolId, setTargetSchoolId] = useState(null);
    const [pendingCount, setPendingCount] = useState(0);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [exporting, setExporting] = useState(false);

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
                
                if (user?.role === 'Super User' && impersonatedUid) {
                    const profileRes = await fetch(api(`/school-by-user/${impersonatedUid}`));
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

                const response = await fetch(api(`/ph_schools/progress/${schoolId}`));
                if (response.ok) {
                    const json = await response.json();
                    if (json.data) {
                        setData(json.data);
                        if (!impersonatedUid) {
                            localStorage.setItem('activity_data', JSON.stringify(json.data));
                        }
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
            getModularOutbox().then(items => setPendingCount(items.length));
        }

        return () => {
            window.removeEventListener('online', handleStatus);
            window.removeEventListener('offline', handleStatus);
        };
    }, [user, impersonatedUid]);

    const handleExportPrintable = async () => {
        if (!targetSchoolId || exporting) return;
        setExporting(true);
        try {
            const phRes = await fetch(api(`/ph_schools/${targetSchoolId}`));
            const phJson = await phRes.json();
            
            const u7Res = await fetch(api(`/ph_schools/unit7/${targetSchoolId}/master`));
            const u7Json = await u7Res.json();
            
            const u8Res = await fetch(api(`/school-location/${targetSchoolId}`));
            const u8Json = await u8Res.json();

            if (phJson.exists && phJson.data) {
                downloadPrintableReport(
                    phJson, 
                    u7Json.data?.inventory || [], 
                    u8Json.data,
                    user?.role,
                    u7Json.data?.repairs || []
                );
            } else {
                alert("Failed to retrieve school data for export.");
            }
        } catch (err) {
            console.error('Export Error:', err);
            alert("An error occurred while generating the printable report.");
        } finally {
            setExporting(false);
        }
    };

    const filteredCompletedUnits = useMemo(() => {
        const units = Array.isArray(data?.progress?.completedUnits) ? data.progress.completedUnits : [];
        return units.filter(id => DASHBOARD_METADATA.units.some(u => u.id == id));
    }, [data]);

    const xp = useMemo(() => getXPForUnits(filteredCompletedUnits, data?.progress?.flags), [filteredCompletedUnits, data]);
    const maxXP = useMemo(() => DASHBOARD_METADATA.units.reduce((sum, u) => sum + u.xp, 0), []);
    const levelInfo = useMemo(() => getLevelFromXP(xp, maxXP), [xp, maxXP]);

    const displayPercentage = useMemo(() => {
        return data?.progress?.percentage || 0;
    }, [data]);

    const displayValidationPercentage = useMemo(() => {
        return data?.progress?.validation_percentage || 0;
    }, [data]);

    const nextUnit = useMemo(() => {
        if (!data?.progress?.flags) return unitMap[0];
        return unitMap.find(u => !data.progress.flags[`unit${u.flagId}`]) || null;
    }, [data, unitMap]);

    const achievements = useMemo(() => {
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
        
        const myScore = data?.progress?.percentage || 0;
        return [
            { name: 'Division Avg', completed: 42 },
            { name: 'District Avg', completed: 58 },
            { name: 'My School', completed: myScore },
            { name: 'Top Performer', completed: 92 },
        ];
    }, [data]);

    if (loading) return (
        <div className="min-h-screen bg-white flex items-center justify-center">
            <div className="flex flex-col items-center">
                <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full"
                />
                <p className="mt-4 text-sky-600 font-bold text-sm uppercase tracking-widest">Loading quest data...</p>
            </div>
        </div>
    );

    return (
        <PageTransition>
            <div className="nodes-app-layout">
                {/* Scope-specific Stylesheets for exact visual guidelines */}
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@500;700;900&family=Comic+Neue:wght@400;700&display=swap');
                    
                    :root {
                      --navy: #08315F;
                      --blue: #075985;
                      --blue-600: #0284C7;
                      --blue-400: #7DD3FC;
                      --blue-100: #E0F2FE;
                      --blue-50: #F0F9FF;
                      --gold: #FBBF24;
                      --amber: #D97706;
                      --red: #B91C1C;
                      --bg: #F0F9FF;
                      --card: #FFFFFF;
                      --text: #0F172A;
                      --muted: #64748B;
                      --line: #BAE6FD;
                      --font-heading: Quicksand, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                      --font-body: 'Comic Neue', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                      --radius: 22px;
                    }

                    .nodes-app-layout {
                      display: grid;
                      grid-template-columns: 260px 1fr;
                      min-height: 100vh;
                      font-family: var(--font-body);
                      color: var(--text);
                      background-color: var(--blue-50);
                      background-attachment: fixed;
                      background-image:
                        radial-gradient(43.5% 49.5% at 10% 12%, rgba(7, 89, 133, 0.30) 0 34%, transparent 78%),
                        radial-gradient(46.5% 54% at 92% 10%, rgba(251, 191, 36, 0.42) 0 36%, transparent 80%),
                        radial-gradient(40.5% 48% at 84% 92%, rgba(125, 211, 252, 0.30) 0 34%, transparent 78%),
                        radial-gradient(45% 52.5% at 8% 92%, rgba(217, 119, 6, 0.26) 0 28%, rgba(251, 191, 36, 0.18) 42%, transparent 80%);
                    }

                    .nodes-sidebar {
                      position: relative;
                      color: white;
                      padding: 24px;
                      display: flex;
                      flex-direction: column;
                      gap: 28px;
                      background: linear-gradient(180deg, color-mix(in srgb, var(--navy) 92%, transparent), color-mix(in srgb, var(--blue) 72%, var(--navy) 28%));
                      border-right: 1px solid rgba(255, 255, 255, 0.24);
                      box-shadow: 18px 0 42px rgba(11, 31, 77, 0.16);
                      overflow: hidden;
                    }

                    .nodes-brand {
                      background: transparent;
                      padding: 8px 0px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      gap: 8px;
                    }

                    .nodes-brand img {
                      filter: drop-shadow(1px 0 0 #fff) drop-shadow(-1px 0 0 #fff) drop-shadow(0 1px 0 #fff) drop-shadow(0 -1px 0 #fff) drop-shadow(0 2px 4px rgba(0,0,0,0.15));
                    }

                    .nodes-nav {
                      display: flex;
                      flex-direction: column;
                      gap: 8px;
                    }

                    .nodes-nav a {
                      display: flex;
                      align-items: center;
                      gap: 12px;
                      padding: 12px 14px;
                      border-radius: 14px;
                      color: rgba(255, 255, 255, 0.78);
                      font-size: 14px;
                      font-weight: 700;
                      text-decoration: none;
                      transition: all 0.2s ease;
                      border: 1px solid transparent;
                    }

                    .nodes-nav a:hover {
                      color: white;
                      background: rgba(255, 255, 255, 0.08);
                    }

                    .nodes-nav a.active {
                      background: rgba(255, 255, 255, 0.16);
                      color: white;
                      border-color: rgba(255, 255, 255, 0.28);
                      box-shadow:
                        inset 0 -3px 0 var(--gold),
                        0 0 18px color-mix(in srgb, var(--blue-400) 26%, transparent);
                    }

                    .nodes-topbar {
                      position: relative;
                      isolation: isolate;
                      display: flex;
                      justify-content: space-between;
                      align-items: center;
                      gap: 25px;
                      min-height: 110px;
                      padding: 16px 32px;
                      border: 2.5px solid color-mix(in srgb, var(--blue) 64%, var(--navy) 36%);
                      background: linear-gradient(135deg, var(--blue-50), white);
                      box-shadow: 0 16px 34px color-mix(in srgb, var(--navy) 12%, transparent);
                      overflow: hidden;
                    }

                    .nodes-topbar::before {
                      content: "";
                      position: absolute;
                      left: 0;
                      top: 0;
                      bottom: 0;
                      width: 76%;
                      background:
                        radial-gradient(circle at 18% 20%, color-mix(in srgb, var(--blue-400) 24%, transparent), transparent 32%),
                        linear-gradient(135deg, var(--navy), var(--blue));
                      clip-path: polygon(0 0, 92% 0, 100% 100%, 0 100%);
                      z-index: 0;
                    }

                    .nodes-topbar::after {
                      content: "";
                      position: absolute;
                      width: 112px;
                      height: 112px;
                      right: 18px;
                      top: 50%;
                      transform: translateY(-50%);
                      border-radius: 999px;
                      background:
                        radial-gradient(circle, color-mix(in srgb, var(--gold) 20%, white 80%) 0 44%, color-mix(in srgb, var(--gold) 10%, transparent) 45% 68%, transparent 74%);
                      box-shadow:
                        0 0 0 12px color-mix(in srgb, var(--gold) 8%, transparent),
                        0 0 28px color-mix(in srgb, var(--gold) 24%, transparent);
                      z-index: 0;
                    }

                    .nodes-topbar > * {
                      position: relative;
                      z-index: 1;
                    }

                    .nodes-topbar h1 {
                      margin: 0;
                      font-family: var(--font-heading);
                      font-size: 28px;
                      line-height: 1.12;
                      font-weight: 900;
                      letter-spacing: 0.01em;
                      color: var(--blue);
                      -webkit-text-stroke: 1.15px rgba(214, 222, 235, 0.92);
                      paint-order: stroke fill;
                      text-shadow:
                        -1.25px -1.25px 0 rgba(214, 222, 235, 0.96),
                        1.25px -1.25px 0 rgba(214, 222, 235, 0.96),
                        -1.25px 1.25px 0 rgba(214, 222, 235, 0.96),
                        1.25px 1.25px 0 rgba(214, 222, 235, 0.96),
                        0 4px 10px rgba(11, 31, 77, 0.34),
                        0 12px 28px rgba(15, 23, 42, 0.26);
                    }

                    .nodes-topbar .eyebrow {
                      color: var(--gold);
                      font-size: 11px;
                      font-weight: 900;
                      letter-spacing: 0.2em;
                      text-transform: uppercase;
                      font-family: var(--font-heading);
                    }

                    .nodes-card {
                      background: var(--card);
                      border: 2.5px solid color-mix(in srgb, var(--blue) 64%, var(--navy) 36%);
                      border-radius: var(--radius);
                      box-shadow: none;
                      transition: all 0.2s ease;
                    }

                    .nodes-card:hover {
                      transform: translateY(-2px);
                    }

                    @media (max-width: 768px) {
                      .nodes-app-layout {
                        grid-template-columns: 1fr;
                        padding-bottom: 82px;
                      }

                      .nodes-sidebar {
                        position: fixed;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        top: auto;
                        z-index: 40;
                        display: block;
                        padding: 8px 10px max(8px, env(safe-area-inset-bottom));
                        border: 0;
                        border-top: 1px solid rgba(255, 255, 255, 0.46);
                        background:
                          radial-gradient(ellipse at 18% 0%, color-mix(in srgb, var(--gold) 18%, transparent), transparent 48%),
                          radial-gradient(ellipse at 84% 0%, color-mix(in srgb, var(--red) 10%, transparent), transparent 46%),
                          linear-gradient(90deg, color-mix(in srgb, var(--blue) 80%, var(--navy) 20%), var(--blue-600));
                        box-shadow:
                          0 -18px 44px rgba(11, 31, 77, 0.26),
                          inset 0 1px 0 rgba(255, 255, 255, 0.18);
                        overflow: hidden;
                      }

                      .nodes-brand {
                        display: none;
                      }

                      .nodes-nav {
                        display: grid;
                        grid-template-columns: repeat(5, 1fr);
                        gap: 4px;
                        width: min(760px, 100%);
                        margin: 0 auto;
                      }

                      .nodes-nav a {
                        display: grid;
                        place-items: center;
                        gap: 2px;
                        min-height: 48px;
                        padding: 6px 2px;
                        border-radius: 16px;
                        color: rgba(255, 255, 255, 0.82);
                        font-size: 8px;
                        line-height: 1;
                        text-align: center;
                        border: 1px solid transparent;
                        background: transparent;
                        text-decoration: none;
                      }

                      .nodes-nav a.active {
                        background: linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.10));
                        color: white;
                        border-color: rgba(255, 255, 255, 0.28);
                        box-shadow:
                          inset 0 -3px 0 var(--gold),
                          0 0 16px color-mix(in srgb, var(--blue-400) 24%, transparent);
                      }

                      .nodes-topbar {
                        min-height: 90px;
                        padding: 10px 16px;
                      }

                      .nodes-topbar h1 {
                        font-size: clamp(18px, 5.5vw, 22px);
                      }

                      .nodes-topbar::before {
                        width: 85%;
                      }

                      .nodes-card {
                        border-width: 2px;
                        border-radius: 14px;
                      }
                    }
                    `
                }} />

                {/* Left Sidebar on Desktop / Bottom Bar on Mobile */}
                <div className="nodes-sidebar">
                    <div className="nodes-brand">
                        <img 
                            src={`${import.meta.env.BASE_URL || '/'}OFFICIAL LOGO/InsightED logo 5 x 3 in white outline.png`} 
                            alt="InsightED Logo" 
                            className="object-contain"
                            style={{ width: '16rem', height: '9rem' }}
                            onError={(e) => {
                                e.target.src = "OFFICIAL LOGO/InsightED logo 5 x 3 in white outline.png";
                            }}
                        />
                    </div>

                    <div className="nodes-nav">
                        <a href="#/nodes-dashboard">
                            <FiHome size={18} />
                            <span>Home</span>
                        </a>
                        <a href="#/my-activity" className="active">
                            <FiBookOpen size={18} />
                            <span>CLOUD</span>
                        </a>
                        <a href="#/modular-dashboard">
                            <LuCompass size={18} />
                            <span>Units</span>
                        </a>
                        <a href="#/guide/school-head">
                            <TbSchool size={18} />
                            <span>Guide</span>
                        </a>
                        <a href="#/profile">
                            <FiSettings size={18} />
                            <span>Settings</span>
                        </a>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-grow flex flex-col min-h-screen overflow-y-auto pb-10">
                    
                    {/* Header / Topbar */}
                    <div className="nodes-topbar">
                        <div className="flex flex-col">
                            <span className="eyebrow">
                                LVL {levelInfo.level} • {levelInfo.title}
                            </span>
                            <h1 className="flex items-center gap-2">
                                <span className="text-white">CLOUD • {data?.schoolInfo?.school_name || 'Loading School...'}</span>
                            </h1>
                            <p className="text-[10px] font-bold text-[#E0F2FE] uppercase tracking-[0.2em] mt-0.5 relative z-10">
                                School ID: {data?.schoolInfo?.school_id || targetSchoolId || '------'} • Head: {user?.first_name || user?.firstName || 'User'} {user?.last_name || user?.lastName || ''}
                            </p>
                        </div>

                        {/* Topbar Actions */}
                        <div className="flex items-center gap-2.5 relative z-10">
                            {/* Export / Print */}
                            <button
                                onClick={handleExportPrintable}
                                disabled={exporting}
                                className={`p-2 bg-white/95 rounded-xl text-indigo-600 hover:text-blue-600 transition-all active:scale-95 shadow-md border border-slate-100 relative ${exporting ? 'opacity-50' : ''}`}
                                title="Export Report"
                            >
                                <FiPrinter size={15} className={exporting ? 'animate-pulse' : ''} />
                                {exporting && (
                                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                                        ...
                                    </span>
                                )}
                            </button>

                            {/* Sync Center */}
                            <button
                                onClick={() => navigate('/sync-center')}
                                className="p-2 bg-white/95 rounded-xl text-emerald-500 hover:text-blue-600 transition-all active:scale-95 shadow-md border border-slate-100 relative group"
                                title="Sync Center"
                            >
                                <FiRefreshCcw size={15} className={`transition-transform duration-700 ${pendingCount > 0 ? 'animate-spin-slow' : 'group-hover:rotate-180'}`} />
                                {pendingCount > 0 && (
                                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                                        {pendingCount}
                                    </span>
                                )}
                            </button>

                            {/* Technical Support */}
                            <div className="relative group">
                                <button
                                    onClick={() => window.location.href = 'mailto:support.stride@deped.gov.ph'}
                                    className="p-2 bg-white/95 rounded-xl text-[#08315F] hover:text-blue-600 transition-all shadow-md border border-slate-100"
                                    title="Technical Support"
                                >
                                    <TbHeadset size={15} />
                                </button>
                                <div className="absolute -top-2 -right-2 bg-[#B91C1C] text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-sm border border-white uppercase tracking-tighter">
                                    NEW!
                                </div>
                            </div>

                            {/* Logout */}
                            <button
                                onClick={confirmLogout}
                                className="p-2 bg-white/95 rounded-xl text-slate-500 hover:text-red-500 hover:bg-red-50 transition-all active:scale-95 shadow-md border border-slate-100"
                                title="Logout"
                            >
                                <FiLogOut size={15} />
                            </button>
                        </div>
                    </div>

                    {/* Offline Indicator Alert */}
                    <AnimatePresence>
                        {!isOnline && (
                            <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="bg-rose-500 text-white px-6 py-2 flex items-center justify-center gap-2 overflow-hidden z-[100]"
                            >
                                <FiWifiOff className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest italic">Offline Mode Active • Progress will save to Sync Center</span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* XP Progress Bar Box */}
                    <div className="px-6 md:px-8 mt-6">
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="nodes-card bg-white rounded-3xl p-5"
                        >
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                    <FiZap className="text-yellow-500" size={16} />
                                    <span className="text-slate-700 font-black text-sm">{xp.toLocaleString()} XP Earned</span>
                                </div>
                                <span className="text-slate-400 text-[10px] font-bold">{maxXP.toLocaleString()} XP MAX</span>
                            </div>
                            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min((xp / maxXP) * 100, 100)}%` }}
                                    transition={{ duration: 1.2, ease: "easeOut" }}
                                    className="h-full rounded-full bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-500 shadow-sm shadow-orange-200"
                                />
                            </div>
                        </motion.div>
                    </div>

                    {/* Quest Notification / CTAs */}
                    <div className="px-6 md:px-8 space-y-4 mt-4">
                        {/* Unit 9 Announcement Box */}
                        {data?.progress && !data.progress.flags?.unit9 && (
                            <motion.div 
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.35, type: "spring", stiffness: 100 }}
                                onClick={() => navigate('/modular/unit-9')}
                                className="bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 rounded-2xl p-4 shadow-xl shadow-blue-200/50 cursor-pointer overflow-hidden relative group border-2 border-indigo-400"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                
                                <div className="flex items-center justify-between relative z-10">
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
                                                <FiZap className="text-white fill-white" size={20} />
                                            </div>
                                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500 border-2 border-white"></span>
                                            </span>
                                        </div>
                                        <div>
                                            <h4 className="text-white font-black text-sm tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>NEW QUEST: UNIT 9</h4>
                                            <p className="text-white/80 text-[10px] font-bold uppercase tracking-wider">Infrastructure & Safety is Live!</p>
                                        </div>
                                    </div>
                                    <div className="bg-white/20 px-3 py-1.5 rounded-lg backdrop-blur-md border border-white/20">
                                        <span className="text-white text-[10px] font-black tracking-widest uppercase">Go Now →</span>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* Data Integrity Audit Alert */}
                        {data?.progress && Object.entries(data.progress.flags || {}).some(([k, v]) => v && !data.progress.validationFlags?.[k]) && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="p-4 rounded-2xl bg-gradient-to-br from-rose-50 to-red-50 border-2 border-red-200 shadow-lg shadow-red-100/50"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center text-white shadow-md animate-pulse">
                                        <FiShield size={24} />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-red-900 font-black text-sm uppercase tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>Audit Review Required</h4>
                                        <p className="text-red-800/70 text-[10px] font-bold mt-0.5 leading-relaxed">
                                            Some reported data units require your review to meet high-integrity standards.
                                        </p>
                                        <button 
                                            onClick={() => navigate('/modular-dashboard')}
                                            className="mt-3 w-full py-2 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-md shadow-red-600/20 active:scale-95 transition-all"
                                        >
                                            Revisit & Validate →
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </div>

                    {/* Main Quest Information */}
                    <div className="px-6 md:px-8 mt-6 grid grid-cols-1 gap-6">
                        
                        {/* Progress Circular Ring & Continue CTA */}
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="nodes-card bg-white rounded-3xl p-6"
                        >
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                                <div className="flex-1 text-center sm:text-left">
                                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.15em] mb-2" style={{ fontFamily: 'var(--font-heading)' }}>Mission Progress</p>
                                    <h2 className="text-3xl font-black text-[#08315F] mb-1" style={{ fontFamily: 'var(--font-heading)' }}>
                                        {filteredCompletedUnits.length} <span className="text-slate-300 text-lg">/ {DASHBOARD_METADATA.units.length}</span>
                                    </h2>
                                    <div className="flex flex-col gap-0.5">
                                        <p className="text-emerald-500 text-[10px] font-bold uppercase tracking-wide">Reported Units</p>
                                        <p className="text-blue-500 text-[9px] font-black uppercase tracking-widest">
                                            {Object.values(data?.progress?.validationFlags || {}).filter(v => v === true).length} Validated
                                        </p>
                                    </div>
                                    
                                    {/* Mini stats */}
                                    <div className="mt-4 flex flex-col gap-2 items-center sm:items-start">
                                        <div className="flex items-center gap-2">
                                            <FiClock size={12} className="text-amber-500" />
                                            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                                                {data?.gamification?.fastest_sprint?.time_text || 'No sprints yet'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <FiTrendingUp size={12} className="text-cyan-500" />
                                            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                                                {data?.gamification?.fastest_sprint ? `Best: Unit ${data.gamification.fastest_sprint.unit}` : 'Start a unit!'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex justify-center shrink-0">
                                    <ProgressRing percentage={displayPercentage} validationPercentage={displayValidationPercentage} />
                                </div>
                            </div>

                            {/* Continue Button */}
                            {nextUnit && (
                                <motion.div 
                                    onClick={() => navigate(nextUnit.path)}
                                    whileTap={{ scale: 0.97 }}
                                    className="mt-6 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-2xl p-4 flex items-center justify-between cursor-pointer group relative overflow-hidden border border-emerald-400 shadow-md"
                                >
                                    <div className="absolute inset-0 bg-white opacity-0 group-active:opacity-10 transition-opacity" />
                                    <div className="flex items-center gap-4 relative z-10">
                                        <div className="bg-white/20 p-2.5 rounded-xl">
                                            <FiPlay className="text-white fill-white" size={18} />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-white text-sm font-black" style={{ fontFamily: 'var(--font-heading)' }}>Continue Quest</p>
                                            <p className="text-white/80 text-[10px] font-bold uppercase tracking-wider">
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
                                    <p className="text-yellow-400 font-black text-sm" style={{ fontFamily: 'var(--font-heading)' }}>🎉 All Quests Complete!</p>
                                    <p className="text-yellow-400/50 text-[10px] font-bold mt-1">You are a STRIDE Master</p>
                                </div>
                            )}
                        </motion.div>
                    </div>

                    {/* Achievements & Leaderboard Snapshot Grid */}
                    <div className="px-6 md:px-8 mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Achievements */}
                        <div>
                            <h3 className="text-[#08315F] text-xs font-black uppercase tracking-wider mb-3 flex items-center gap-2" style={{ fontFamily: 'var(--font-heading)' }}>
                                <FiAward size={14} className="text-amber-500" /> Achievements
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                {achievements.map((ach, i) => (
                                    <motion.div
                                        key={ach.id}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: 0.15 * i }}
                                        className={`p-4 rounded-2xl border-2 transition-all ${
                                            ach.earned 
                                                ? 'bg-gradient-to-br from-yellow-50 to-amber-50 border-amber-400 shadow-sm shadow-amber-100' 
                                                : 'bg-white border-slate-100 opacity-60'
                                        }`}
                                    >
                                        <span className="text-2xl">{ach.icon}</span>
                                        <p className={`text-[11px] font-black mt-2 ${ach.earned ? 'text-[#08315F]' : 'text-slate-400'}`} style={{ fontFamily: 'var(--font-heading)' }}>
                                            {ach.name}
                                        </p>
                                        <p className={`text-[9px] font-bold mt-0.5 ${ach.earned ? 'text-amber-800' : 'text-slate-300'}`}>
                                            {ach.desc}
                                        </p>
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        {/* Leaderboard Snapshot */}
                        <div className="flex flex-col">
                            <h3 className="text-[#08315F] text-xs font-black uppercase tracking-wider mb-3 flex items-center gap-2" style={{ fontFamily: 'var(--font-heading)' }}>
                                <FiTarget size={14} className="text-sky-500" /> Leaderboard Snapshot
                            </h3>
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                className="nodes-card bg-white rounded-3xl p-5 flex-grow"
                            >
                                <div className="h-44 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={comparativeData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                                            <XAxis 
                                                dataKey="name" axisLine={false} tickLine={false} 
                                                tick={{ fill: 'rgba(0,0,0,0.5)', fontSize: 9, fontWeight: 700 }}
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
                        </div>
                    </div>

                    {/* Quest Log / Mission Checklist */}
                    <div className="px-6 md:px-8 mt-6 pb-6">
                        <h3 className="text-[#08315F] text-xs font-black uppercase tracking-wider mb-3 flex items-center gap-2" style={{ fontFamily: 'var(--font-heading)' }}>
                            <FiStar size={14} className="text-yellow-500" /> Quest Log
                        </h3>
                        
                        <div className="space-y-2.5">
                            {unitMap.filter(u => {
                                const completedArr = data?.progress?.completedUnits || [];
                                return Array.isArray(completedArr) ? !completedArr.includes(u.id) : !data?.progress?.flags?.[`unit${u.flagId}`];
                            }).length === 0 ? (
                                <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-8 text-center shadow-sm">
                                    <div className="text-4xl mb-3">🏆</div>
                                    <h4 className="text-emerald-800 font-black text-sm" style={{ fontFamily: 'var(--font-heading)' }}>All Quests Completed!</h4>
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
                                                className={`p-4 rounded-2xl flex items-center justify-between border-2 cursor-pointer active:scale-[0.98] transition-all ${
                                                    isNext 
                                                        ? 'bg-white border-sky-300 shadow-md shadow-sky-100/50' 
                                                        : 'bg-white border-slate-100 opacity-60'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3.5">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                                                        isNext ? 'bg-sky-50' : 'bg-slate-50'
                                                    }`}>
                                                        {unit.icon}
                                                    </div>
                                                    <div className="text-left">
                                                        <h4 className={`text-[11px] font-black ${
                                                            isNext ? 'text-sky-700' : 'text-slate-500'
                                                        }`} style={{ fontFamily: 'var(--font-heading)' }}>
                                                            {unit.name}
                                                        </h4>
                                                        <p className={`text-[9px] font-bold mt-0.5 ${
                                                            isNext ? 'text-sky-500/70' : 'text-slate-300'
                                                        }`}>
                                                            {data?.progress?.incompleteUnits?.includes(unit.id) ? (
                                                                <span className="text-amber-500 font-black">⚠️ INCOMPLETE</span>
                                                            ) : data?.progress?.validationFlags?.[`unit${unit.id}`] ? (
                                                                <span className="text-emerald-500 font-black">✅ VALIDATED</span>
                                                            ) : isNext ? (
                                                                '⚡ ACTIVE QUEST'
                                                            ) : (
                                                                `+${unit.xp} XP Reward`
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                                                    isNext ? 'bg-sky-50' : 'bg-slate-50'
                                                }`}>
                                                    {isNext 
                                                        ? <FiPlay size={12} className="text-sky-500 fill-sky-500" />
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
            </div>
        </PageTransition>
    );
};

export default MyActivityDashboard;
