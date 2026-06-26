import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FiCheckCircle, FiClock, FiTrendingUp, FiPlay, FiLock, FiActivity,
    FiZap, FiAward, FiTarget, FiStar, FiShield, FiRefreshCcw, FiWifiOff, FiPrinter,
    FiHome, FiSettings, FiBookOpen, FiLogOut, FiUsers, FiLayers, FiAlertCircle,
    FiArrowRight, FiEdit3, FiCalendar, FiInfo,
    FiAlertTriangle, FiCheck, FiUpload
} from 'react-icons/fi';
import { LuCompass } from "react-icons/lu";
import { TbSchool, TbHeadset, TbShieldCheck, TbShieldX, TbTicket } from "react-icons/tb";
import PageTransition from '../components/PageTransition';
import SharedNexusSidebar from '../components/SharedNexusSidebar';
import { DASHBOARD_METADATA } from '../config/dashboardMetadata';
import { useAuth } from '../context/AuthContext';
import { getModularOutbox } from '../db';
import { downloadPrintableReport } from '../utils/PrintableExportGenerator';
import { api } from "../lib/api";

// ─── Circular Progress Ring ───────────────────────────────────────────────────
const ProgressRing = ({ percentage = 0, validationPercentage = 0, size = 140, strokeWidth = 10 }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;
    const innerRadius = radius - strokeWidth - 4;
    const innerCircumference = innerRadius * 2 * Math.PI;
    const innerOffset = innerCircumference - (validationPercentage / 100) * innerCircumference;
    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="transform -rotate-90">
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={strokeWidth} />
                <motion.circle cx={size / 2} cy={size / 2} r={radius} fill="none"
                    stroke="url(#ringGradient)" strokeWidth={strokeWidth} strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                />
                <circle cx={size / 2} cy={size / 2} r={innerRadius} fill="none" stroke="rgba(0,0,0,0.04)" strokeWidth={strokeWidth - 2} />
                <motion.circle cx={size / 2} cy={size / 2} r={innerRadius} fill="none"
                    stroke="#10b981" strokeWidth={strokeWidth - 2} strokeLinecap="round"
                    strokeDasharray={innerCircumference}
                    initial={{ strokeDashoffset: innerCircumference }}
                    animate={{ strokeDashoffset: innerOffset }}
                    transition={{ duration: 1.8, ease: "easeOut", delay: 0.3 }}
                />
                <defs>
                    <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="50%" stopColor="#06b6d4" />
                        <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span className="text-3xl font-black text-slate-800"
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ delay: 0.5, type: "spring", bounce: 0.5 }}>
                    {Math.round(percentage)}%
                </motion.span>
                <div className="flex flex-col items-center -mt-0.5">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Reported</span>
                    <span className="text-[7px] font-bold text-emerald-500 uppercase tracking-tighter mt-0.5">{Math.round(validationPercentage)}% Validated</span>
                </div>
            </div>
        </div>
    );
};

// ─── XP Helpers ───────────────────────────────────────────────────────────────
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
    if (xp >= 800) return { level: 5, title: '💎 Data Champion', color: 'from-cyan-400 to-blue-500' };
    if (xp >= 500) return { level: 4, title: '🚀 Pathfinder', color: 'from-emerald-400 to-teal-500' };
    if (xp >= 250) return { level: 3, title: '🛡️ Builder', color: 'from-blue-400 to-indigo-500' };
    if (xp >= 100) return { level: 2, title: '📝 Explorer', color: 'from-green-400 to-emerald-500' };
    return { level: 1, title: '🌱 Rookie', color: 'from-slate-400 to-slate-500' };
};

// ─── Unit State Helper ────────────────────────────────────────────────────────
const getUnitState = (unit, data) => {
    const flags = data?.progress?.flags || {};
    const validationFlags = data?.progress?.validationFlags || {};
    const completedArr = data?.progress?.completedUnits || [];

    const isCompleted = Array.isArray(completedArr)
        ? completedArr.includes(unit.id)
        : !!flags[`unit${unit.id}`];

    const isValidated = !!validationFlags[`unit${unit.id}`];
    const hasRemarks = !!data?.progress?.remarks?.[`unit${unit.id}`];
    const lastUpdated = data?.progress?.lastUpdated?.[`unit${unit.id}`] || null;

    if (hasRemarks) return { state: 'remarks', isCompleted, isValidated, lastUpdated };
    if (isValidated) return { state: 'validated', isCompleted, isValidated, lastUpdated };
    if (isCompleted) return { state: 'completed', isCompleted, isValidated, lastUpdated };
    return { state: 'pending', isCompleted: false, isValidated: false, lastUpdated };
};

// ─── Confetti / Celebration ───────────────────────────────────────────────────
const CelebrationBanner = () => (
    <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-6 md:mx-8 mt-6 rounded-3xl overflow-hidden relative"
        style={{
            background: 'linear-gradient(135deg, #08315F, #0284C7, #10b981)',
            padding: '28px 32px',
        }}
    >
        <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '30px 30px' }}
        />
        <div className="relative z-10 flex items-center gap-6">
            <motion.div
                animate={{ rotate: [0, -10, 10, -10, 10, 0], scale: [1, 1.2, 1.2, 1.2, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 3 }}
                className="text-5xl"
            >🏆</motion.div>
            <div>
                <h2 className="text-white font-black text-2xl" style={{ fontFamily: 'var(--font-heading)' }}>
                    All Units Completed! 🎉
                </h2>
                <p className="text-white/80 font-bold text-sm mt-1">
                    Congratulations! You've submitted all 9 reporting units for STRIDE. Outstanding work, School Head!
                </p>
            </div>
        </div>
    </motion.div>
);

// ─── Hero "Next Up" Card ──────────────────────────────────────────────────────
const NextUpCard = ({ unit, onGo, impersonatedUid }) => {
    if (!unit) return null;
    return (
        <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative overflow-hidden rounded-3xl"
            style={{
                background: 'linear-gradient(135deg, #08315F 0%, #0369A1 55%, #0284C7 100%)',
                padding: '24px 28px',
                boxShadow: '0 8px 32px rgba(8,49,95,0.28)',
            }}
        >
            {/* Decorative glow */}
            <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/5 blur-2xl pointer-events-none" />
            <div className="absolute right-20 bottom-0 w-24 h-24 rounded-full bg-amber-400/10 blur-xl pointer-events-none" />

            <div className="relative z-10 flex items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-3xl shrink-0 border border-white/20">
                        {unit.icon}
                    </div>
                    <div>
                        <span className="text-amber-300 text-[9px] font-black uppercase tracking-[0.2em] block">👉 Your Next Mission</span>
                        <h2 className="text-white font-black text-xl mt-0.5" style={{ fontFamily: 'var(--font-heading)' }}>
                            Unit {unit.id}: {unit.name}
                        </h2>
                        <p className="text-white/60 font-bold text-[11px] mt-0.5">+{unit.xp} XP upon completion</p>
                    </div>
                </div>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onGo(unit)}
                    className="shrink-0 flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-400 text-[#08315F] font-black text-sm uppercase tracking-wide shadow-lg shadow-amber-400/30 hover:bg-amber-300 transition-colors"
                >
                    <FiPlay size={14} className="fill-[#08315F]" /> Continue
                </motion.button>
            </div>
        </motion.div>
    );
};

// ─── Unit Mission Card ────────────────────────────────────────────────────────
const UnitCard = ({ unit, stateInfo, onGo, impersonatedUid, index }) => {
    const { state, isValidated, lastUpdated } = stateInfo;

    const config = {
        completed: {
            border: 'border-emerald-200',
            bg: 'bg-gradient-to-br from-emerald-50/60 to-white',
            badge: 'bg-emerald-100 text-emerald-700',
            badgeText: '✅ Submitted',
            iconBg: 'bg-emerald-50',
            btnLabel: 'View / Edit',
            btnClass: 'bg-white text-emerald-700 border-2 border-emerald-200 hover:bg-emerald-50',
        },
        validated: {
            border: 'border-emerald-400',
            bg: 'bg-gradient-to-br from-emerald-50/80 to-white',
            badge: 'bg-emerald-500 text-white',
            badgeText: '🛡️ Validated',
            iconBg: 'bg-emerald-100',
            btnLabel: 'View',
            btnClass: 'bg-white text-emerald-700 border-2 border-emerald-300 hover:bg-emerald-50',
        },
        remarks: {
            border: 'border-amber-300',
            bg: 'bg-gradient-to-br from-amber-50/60 to-white',
            badge: 'bg-amber-100 text-amber-700',
            badgeText: '⚠️ Has Remarks',
            iconBg: 'bg-amber-50',
            btnLabel: 'Review Remarks',
            btnClass: 'bg-amber-500 text-white border-2 border-amber-500 hover:bg-amber-600',
        },
        pending: {
            border: 'border-slate-150',
            bg: 'bg-white',
            badge: 'bg-slate-100 text-slate-500',
            badgeText: '🔴 Pending',
            iconBg: 'bg-slate-50',
            btnLabel: 'Start Now',
            btnClass: 'bg-[#08315F] text-white border-2 border-[#08315F] hover:bg-[#075985]',
        },
    };

    const c = config[state];

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 * index }}
            className={`rounded-2xl border-2 ${c.border} ${c.bg} p-4 flex items-center gap-4 transition-all hover:-translate-y-0.5 hover:shadow-md cursor-default`}
        >
            {/* Icon */}
            <div className={`w-11 h-11 rounded-xl ${c.iconBg} flex items-center justify-center text-2xl shrink-0`}>
                {unit.icon}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-[12px] font-black text-slate-800" style={{ fontFamily: 'var(--font-heading)' }}>
                        Unit {unit.id}: {unit.name}
                    </h4>
                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${c.badge}`}>
                        {c.badgeText}
                    </span>
                </div>
                {lastUpdated ? (
                    <p className="text-[9px] text-slate-400 font-bold mt-0.5">
                        <FiCalendar size={7} className="inline mr-1" />
                        Last updated: {new Date(lastUpdated).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                ) : (
                    <p className="text-[9px] text-slate-400 font-bold mt-0.5">+{unit.xp} XP • Not yet submitted</p>
                )}
            </div>

            {/* Action Button */}
            <button
                onClick={() => onGo(unit)}
                className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all active:scale-95 ${c.btnClass}`}
            >
                {state === 'pending' ? <FiArrowRight size={12} /> : <FiEdit3 size={11} />}
                {c.btnLabel}
            </button>
        </motion.div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const MyActivityDashboard = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, confirmLogout } = useAuth();

    const queryParams = new URLSearchParams(location.search);
    const impersonatedUid = queryParams.get('uid');

    const [data, setData] = useState(() => {
        if (!impersonatedUid) {
            const cached = localStorage.getItem('activity_data');
            try { return cached && cached !== 'undefined' ? JSON.parse(cached) : null; }
            catch (e) { return null; }
        }
        return null;
    });

    const [loading, setLoading] = useState(true);
    const [targetSchoolId, setTargetSchoolId] = useState(null);
    const [pendingCount, setPendingCount] = useState(0);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [exporting, setExporting] = useState(false);
    const [schoolDetails, setSchoolDetails] = useState(null);

    const unitMap = useMemo(() => DASHBOARD_METADATA.units.map(u => ({
        id: u.id,
        flagId: u.id,
        name: u.title,
        path: u.path,
        xp: u.xp,
        icon: u.emoji,
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

                if (!schoolId) { setLoading(false); return; }
                setTargetSchoolId(schoolId);

                const response = await fetch(api(`/ph_schools/progress/${schoolId}`));
                if (response.ok) {
                    const json = await response.json();
                    if (json.data) {
                        setData(json.data);
                        if (!impersonatedUid) localStorage.setItem('activity_data', JSON.stringify(json.data));
                    }
                }

                const detailsResponse = await fetch(api(`/ph_schools/${schoolId}`));
                if (detailsResponse.ok) {
                    const detJson = await detailsResponse.json();
                    if (detJson.exists && detJson.data) setSchoolDetails(detJson.data);
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
                downloadPrintableReport(phJson, u7Json.data?.inventory || [], u8Json.data, user?.role, u7Json.data?.repairs || []);
            } else {
                alert("Failed to retrieve school data for export.");
            }
        } catch (err) {
            console.error('Export Error:', err);
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
        if (data?.progress?.percentage !== undefined && data?.progress?.percentage !== null) return data.progress.percentage;
        const total = DASHBOARD_METADATA.units.length;
        if (!total) return 0;
        return Math.round((filteredCompletedUnits.length / total) * 100);
    }, [data, filteredCompletedUnits]);

    const displayValidationPercentage = useMemo(() => {
        if (data?.progress?.validation_percentage !== undefined && data?.progress?.validation_percentage !== null) return data.progress.validation_percentage;
        const total = DASHBOARD_METADATA.units.length;
        if (!total) return 0;
        const validatedCount = Object.values(data?.progress?.validationFlags || {}).filter(v => v === true).length;
        return Math.round((validatedCount / total) * 100);
    }, [data]);

    const nextUnit = useMemo(() => {
        if (!data?.progress?.flags) return unitMap[0];
        return unitMap.find(u => !data.progress.flags[`unit${u.flagId}`]) || null;
    }, [data, unitMap]);

    const isAllDone = useMemo(() => filteredCompletedUnits.length >= DASHBOARD_METADATA.units.length, [filteredCompletedUnits]);

    const handleGo = (unit) => {
        const targetPath = impersonatedUid ? `${unit.path}?uid=${impersonatedUid}` : unit.path;
        navigate(targetPath);
    };

    // Sort units: pending/remarks first, then completed
    const sortedUnits = useMemo(() => {
        return [...unitMap].sort((a, b) => {
            const stateOrder = { remarks: 0, pending: 1, completed: 2, validated: 3 };
            const sa = getUnitState(a, data).state;
            const sb = getUnitState(b, data).state;
            if (stateOrder[sa] !== stateOrder[sb]) return stateOrder[sa] - stateOrder[sb];
            return a.id - b.id;
        });
    }, [unitMap, data]);

    if (loading) return (
        <div className="min-h-screen bg-[#F0F9FF] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full" />
                <p className="text-sky-600 font-black text-sm uppercase tracking-widest">Loading Mission Board...</p>
            </div>
        </div>
    );

    return (
        <PageTransition>
            <div className="ab-layout lg:pl-[80px]">
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
                      --font-heading: Quicksand, ui-sans-serif, system-ui, sans-serif;
                      --font-body: 'Comic Neue', ui-sans-serif, system-ui, sans-serif;
                      --radius: 22px;
                    }

                    /* ── Main layout: sidebar | content ── */
                    .ab-layout {
                      min-height: 100vh;
                      font-family: var(--font-body);
                      color: var(--text);
                      background-color: var(--blue-50);
                      background-attachment: fixed;
                      background-image:
                        radial-gradient(43.5% 49.5% at 10% 12%, rgba(7, 89, 133, 0.28) 0 34%, transparent 78%),
                        radial-gradient(46.5% 54% at 92% 10%, rgba(251, 191, 36, 0.36) 0 36%, transparent 80%),
                        radial-gradient(40.5% 48% at 84% 92%, rgba(125, 211, 252, 0.28) 0 34%, transparent 78%);
                    }

                    /* ── Sidebar ── */
                    .nodes-sidebar {
                      display: flex;
                      width: 80px;
                      position: relative;
                      color: white;
                      padding: 24px 8px;
                      flex-direction: column;
                      align-items: center;
                      gap: 28px;
                      background: linear-gradient(180deg, color-mix(in srgb, var(--navy) 92%, transparent), color-mix(in srgb, var(--blue) 72%, var(--navy) 28%));
                      border-right: 1px solid rgba(255, 255, 255, 0.24);
                      box-shadow: 18px 0 42px rgba(11, 31, 77, 0.16);
                      overflow: hidden;
                      transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), padding 0.3s cubic-bezier(0.4, 0, 0.2, 1), align-items 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                      z-index: 50;
                    }

                    .nodes-sidebar:hover {
                      width: 260px;
                      padding: 24px 16px;
                      align-items: flex-start;
                    }

                    .nodes-brand {
                      display: flex;
                      justify-content: center;
                      width: 100%;
                      margin-bottom: 8px;
                      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), justify-content 0.3s ease, padding 0.3s ease;
                    }
                    .nodes-brand:hover { transform: scale(1.08); }
                    .nodes-sidebar:hover .nodes-brand { justify-content: flex-start; padding-left: 8px; }

                    .logo-collapsed { display: block !important; }
                    .logo-expanded { display: none !important; }
                    .nodes-sidebar:hover .logo-collapsed { display: none !important; }
                    .nodes-sidebar:hover .logo-expanded { display: block !important; max-width: 170px; height: auto; }
                    .nodes-brand img { filter: drop-shadow(1px 0 0 #fff) drop-shadow(-1px 0 0 #fff) drop-shadow(0 1px 0 #fff) drop-shadow(0 -1px 0 #fff) drop-shadow(0 2px 4px rgba(0,0,0,0.15)); }

                    .nodes-nav {
                      display: flex;
                      flex-direction: column;
                      align-items: center;
                      gap: 16px;
                      width: 100%;
                      transition: align-items 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    }
                    .nodes-sidebar:hover .nodes-nav { align-items: flex-start; }
                    .nodes-nav a {
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      width: 44px;
                      height: 44px;
                      border-radius: 14px;
                      color: rgba(255, 255, 255, 0.78);
                      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                      border: 1px solid transparent;
                      gap: 12px;
                      text-decoration: none;
                    }
                    .nodes-sidebar:hover .nodes-nav a { justify-content: flex-start; width: 100%; padding: 12px 14px; height: auto; }
                    .nodes-nav a span { display: none; opacity: 0; transition: opacity 0.3s ease; white-space: nowrap; }
                    .nodes-sidebar:hover .nodes-nav a span { display: inline-block; opacity: 1; }
                    .nodes-nav a:hover { color: white; background: rgba(255, 255, 255, 0.08); transform: translateY(-2px); }
                    .nodes-nav a.active {
                      background: rgba(255, 255, 255, 0.16);
                      color: white;
                      border-color: rgba(255, 255, 255, 0.28);
                      box-shadow: inset 0 -3px 0 var(--gold), 0 0 18px color-mix(in srgb, var(--blue-400) 26%, transparent);
                    }

                    /* ── Topbar ── */
                    .nodes-topbar {
                      position: relative;
                      isolation: isolate;
                      display: flex;
                      justify-content: space-between;
                      align-items: center;
                      gap: 25px;
                      min-height: 120px;
                      padding: 20px 36px;
                      border: 2.5px solid color-mix(in srgb, var(--blue) 64%, var(--navy) 36%);
                      background: linear-gradient(135deg, var(--blue-50), white);
                      box-shadow: 0 16px 34px color-mix(in srgb, var(--navy) 12%, transparent);
                      overflow: hidden;
                      border-radius: var(--radius);
                      margin: 24px 24px 0 24px;
                    }
                    .nodes-topbar::before {
                      content: "";
                      position: absolute;
                      left: 0; top: 0; bottom: 0;
                      width: 76%;
                      background: radial-gradient(circle at 18% 20%, color-mix(in srgb, var(--blue-400) 24%, transparent), transparent 32%), linear-gradient(135deg, var(--navy), var(--blue));
                      clip-path: polygon(0 0, 92% 0, 100% 100%, 0 100%);
                      z-index: 0;
                    }
                    .nodes-topbar::after {
                      content: "";
                      position: absolute;
                      width: 100px;
                      height: 100px;
                      right: 18px;
                      top: 50%;
                      transform: translateY(-50%);
                      border-radius: 999px;
                      background: radial-gradient(circle, color-mix(in srgb, var(--gold) 20%, white 80%) 0 44%, color-mix(in srgb, var(--gold) 10%, transparent) 45% 68%, transparent 74%);
                      z-index: 0;
                    }
                    .nodes-topbar > * { position: relative; z-index: 1; }
                    .nodes-topbar h1 {
                      margin: 0;
                      font-family: var(--font-heading);
                      font-size: 28px;
                      line-height: 1.12;
                      font-weight: 900;
                      letter-spacing: -0.01em;
                      color: #ffffff;
                    }
                    .nodes-topbar .eyebrow {
                      color: var(--gold);
                      font-size: 10px;
                      font-weight: 900;
                      letter-spacing: 0.15em;
                      text-transform: uppercase;
                      font-family: var(--font-heading);
                    }

                    /* ── nodes-card ── */
                    .nodes-card {
                      background: var(--card);
                      border: 2px solid color-mix(in srgb, var(--blue) 40%, transparent 60%);
                      border-radius: var(--radius);
                      transition: all 0.2s ease;
                    }

                    /* ── XP Bar ── */
                    .ab-xp-bar {
                      background: white;
                      border-radius: 18px;
                      padding: 14px 20px;
                      border: 2px solid color-mix(in srgb, var(--blue) 20%, transparent 80%);
                    }

                    /* ── Responsive ── */
                    @media (max-width: 1024px) {
                      .ab-layout {
                        grid-template-columns: 80px 1fr;
                      }
                      .ab-layout:has(.nodes-sidebar:hover) {
                        grid-template-columns: 260px 1fr;
                      }
                    }

                    @media (max-width: 768px) {
                      .ab-layout {
                        grid-template-columns: 1fr;
                        padding-bottom: 120px;
                      }
                      .nodes-sidebar {
                        position: fixed;
                        left: 0; right: 0; bottom: 0; top: auto;
                        z-index: 40;
                        display: block;
                        padding: 8px 10px max(8px, env(safe-area-inset-bottom));
                        border: 0;
                        border-top: 1px solid rgba(255, 255, 255, 0.46);
                        background: linear-gradient(90deg, color-mix(in srgb, var(--blue) 80%, var(--navy) 20%), var(--blue-600));
                        box-shadow: 0 -18px 44px rgba(11, 31, 77, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.18);
                        overflow: hidden;
                      }
                      .nodes-brand { display: none; }
                      .nodes-nav { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; width: min(760px, 100%); margin: 0 auto; }
                      .nodes-nav a {
                        display: grid; place-items: center; gap: 2px;
                        min-height: 48px; padding: 6px 2px; border-radius: 16px;
                        color: rgba(255,255,255,0.82); font-size: 8px; line-height: 1;
                        text-align: center; border: 1px solid transparent; background: transparent; text-decoration: none;
                      }
                      .nodes-nav a span { display: block !important; }
                      .nodes-nav a.active {
                        background: linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.10));
                        color: white; border-color: rgba(255,255,255,0.28);
                        box-shadow: inset 0 -3px 0 var(--gold), 0 0 16px color-mix(in srgb, var(--blue-400) 24%, transparent);
                      }
                      .nodes-topbar { min-height: 80px; padding: 14px 16px; margin: 10px 10px 0 10px; border-radius: 14px; }
                      .nodes-topbar h1 { font-size: clamp(16px, 5.5vw, 20px); }
                      .nodes-topbar::before { width: 85%; }
                    }
                    `
                }} />

                {/* ── Sidebar ── */}
                <SharedNexusSidebar activeTab="CLOUD" />

                {/* ── Main Content ── */}
                <div className="flex flex-col min-h-screen overflow-y-auto pb-32 lg:pb-10">

                    {/* Topbar */}
                    <div className="nodes-topbar">
                        <div className="flex flex-col flex-grow select-none pr-6">
                            <span className="eyebrow">DepEd BHROD | STRIDE Action Board</span>
                            <h1>Mission Control</h1>
                            <p className="text-[10px] font-bold text-white/70 mt-1.5 leading-relaxed">
                                School: <span className="font-black text-white">{data?.schoolInfo?.school_name || 'Loading...'}</span>
                                {' '}(ID: <span className="font-black text-white">{data?.schoolInfo?.school_id || targetSchoolId || '---'}</span>)
                                {' '}• <span className="text-amber-300 font-black">{user?.first_name || 'User'} {user?.last_name || ''}</span>
                                {' '}• Lv.{levelInfo.level} {levelInfo.title}
                            </p>
                        </div>
                        <div className="flex items-center gap-2 relative z-10">
                            <button onClick={handleExportPrintable} disabled={exporting}
                                className="p-2 bg-white/90 rounded-xl text-indigo-600 hover:text-blue-600 transition-all active:scale-95 shadow-md border border-white/30 relative"
                                title="Export Report">
                                <FiPrinter size={15} className={exporting ? 'animate-pulse' : ''} />
                            </button>
                            <button onClick={() => navigate('/sync-center')}
                                className="p-2 bg-white/90 rounded-xl text-emerald-500 hover:text-blue-600 transition-all active:scale-95 shadow-md border border-white/30 relative group"
                                title="Sync Center">
                                <FiRefreshCcw size={15} className={`transition-transform duration-700 ${pendingCount > 0 ? 'animate-spin-slow' : 'group-hover:rotate-180'}`} />
                                {pendingCount > 0 && (
                                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                                        {pendingCount}
                                    </span>
                                )}
                            </button>
                            <button onClick={confirmLogout}
                                className="p-2 bg-white/90 rounded-xl text-slate-500 hover:text-red-500 hover:bg-red-50 transition-all active:scale-95 shadow-md border border-white/30"
                                title="Logout">
                                <FiLogOut size={15} />
                            </button>
                        </div>
                    </div>

                    {/* Offline Banner */}
                    <AnimatePresence>
                        {!isOnline && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                className="bg-rose-500 text-white px-6 py-2 flex items-center justify-center gap-2 mx-6 mt-3 rounded-2xl overflow-hidden">
                                <FiWifiOff className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest italic">Offline Mode Active • Progress will save to Sync Center</span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Pending Sync Alert */}
                    <AnimatePresence>
                        {pendingCount > 0 && isOnline && (
                            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                className="mx-6 md:mx-8 mt-3 bg-amber-50 border-2 border-amber-200 rounded-2xl px-4 py-2.5 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FiUpload size={14} className="text-amber-600" />
                                    <span className="text-[11px] font-black text-amber-800">
                                        {pendingCount} item{pendingCount > 1 ? 's' : ''} waiting to sync
                                    </span>
                                </div>
                                <button onClick={() => navigate('/sync-center')}
                                    className="text-[10px] font-black text-amber-700 bg-amber-100 px-3 py-1.5 rounded-xl hover:bg-amber-200 transition-colors flex items-center gap-1">
                                    Sync Now <FiArrowRight size={10} />
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Celebration Banner */}
                    {isAllDone && <CelebrationBanner />}

                    {/* XP Bar + Progress Ring + Support Row */}
                    <div className="px-6 md:px-8 mt-5 grid grid-cols-1 md:grid-cols-[1fr_160px_220px] lg:grid-cols-[1fr_180px_280px] xl:grid-cols-[1fr_180px_320px] gap-4 items-stretch">
                        {/* XP Bar */}
                        <div className="ab-xp-bar flex flex-col justify-between">
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                    <FiZap className="text-amber-400" size={16} />
                                    <span className="text-slate-700 font-black text-sm">{xp.toLocaleString()} XP Earned</span>
                                    <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">{levelInfo.title}</span>
                                </div>
                                <span className="text-slate-400 text-[10px] font-bold">{maxXP.toLocaleString()} XP MAX</span>
                            </div>
                            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min((xp / maxXP) * 100, 100)}%` }}
                                    transition={{ duration: 1.2, ease: "easeOut" }}
                                    className="h-full rounded-full bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-500"
                                />
                            </div>
                            <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-50">
                                <span className="text-[10px] text-slate-500 font-bold">{filteredCompletedUnits.length}/{DASHBOARD_METADATA.units.length} units submitted</span>
                                <span className="text-[10px] text-emerald-600 font-bold">{displayValidationPercentage}% validated by division</span>
                            </div>
                        </div>

                        {/* Progress Ring */}
                        <div className="ab-xp-bar flex flex-col items-center justify-center gap-2">
                            <ProgressRing percentage={displayPercentage} validationPercentage={displayValidationPercentage} size={120} strokeWidth={9} />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Overall Progress</span>
                        </div>

                        {/* Support Card */}
                        <div className="ab-xp-bar flex flex-col items-center justify-center gap-3 text-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Technical Support</span>
                            <div className="w-16 h-16 rounded-full bg-sky-50 text-sky-500 flex items-center justify-center border-4 border-sky-100/50 mb-1">
                                <TbHeadset size={28} />
                            </div>
                            <a
                                href="https://stride.deped.gov.ph/insighted-ticketing/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full mt-1 px-4 py-2.5 bg-[#08315F] text-white rounded-xl text-[10px] font-black uppercase tracking-wide hover:bg-[#075985] active:scale-95 transition-all flex justify-center items-center gap-2"
                            >
                                <TbTicket size={14} /> Open Ticket
                            </a>
                        </div>
                    </div>

                    {/* Bottom Area: Units (Left) + Announcements (Right) */}
                    <div className="px-6 md:px-8 mt-5 grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start">
                        {/* Left Column: Next Up + Units List */}
                        <div className="flex flex-col">
                            {/* Next Up Hero Card */}
                            {!isAllDone && nextUnit && (
                                <div className="mb-6">
                                    <NextUpCard unit={nextUnit} onGo={handleGo} impersonatedUid={impersonatedUid} />
                                </div>
                            )}

                            {/* Units Grid — Section Label */}
                            <div className="mb-3 flex items-center gap-3">
                                <h3 className="text-[#08315F] text-xs font-black uppercase tracking-wider flex items-center gap-2" style={{ fontFamily: 'var(--font-heading)' }}>
                                    <FiTarget size={14} className="text-amber-500" /> All Reporting Units
                                </h3>
                                <div className="h-px flex-1 bg-slate-200/60" />
                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{filteredCompletedUnits.length}/{DASHBOARD_METADATA.units.length} done</span>
                            </div>

                            {/* Units List */}
                            <div className="flex flex-col gap-3">
                                {sortedUnits.map((unit, i) => {
                                    const stateInfo = getUnitState(unit, data);
                                    return (
                                        <UnitCard
                                            key={unit.id}
                                            unit={unit}
                                            stateInfo={stateInfo}
                                            onGo={handleGo}
                                            impersonatedUid={impersonatedUid}
                                            index={i}
                                        />
                                    );
                                })}
                            </div>
                        </div>

                        {/* Right Column: Announcements & Widgets */}
                        <div className="flex flex-col gap-6">
                            <AnnouncementPanel />
                            <SchoolCalendarCard />
                            <RecentActivityFeedCard />
                        </div>
                    </div>

                    {/* Bottom info */}
                    <div className="px-6 md:px-8 mt-6 mb-2">
                        <div className="bg-sky-50/70 border border-sky-100 rounded-2xl px-4 py-3 flex items-center gap-3">
                            <FiInfo size={14} className="text-sky-500 shrink-0" />
                            <p className="text-[10px] text-sky-700 font-bold leading-relaxed">
                                Units are sorted by priority — pending and flagged units appear first. Completed units remain accessible for viewing and editing. All changes are synced automatically.
                            </p>
                        </div>
                    </div>

                </div>

            </div>
        </PageTransition>
    );
};
const AnnouncementPanel = () => {
    const [announcement, setAnnouncement] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLatest = async () => {
            try {
                const res = await fetch(api('/api/announcements/latest'));
                if (res.ok) {
                    const json = await res.json();
                    if (json.success && json.data) {
                        setAnnouncement(json.data.content);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch latest announcement:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchLatest();
    }, []);

    if (!announcement && !loading) return null;

    return (
        <div className="bg-gradient-to-br from-[#08315F] to-[#075985] rounded-2xl p-6 text-white shadow-xl flex flex-col relative overflow-hidden border-2 border-[#075985]/30">
            {/* Subtle glow effect */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center gap-2 mb-4">
                    <FiActivity className="w-5 h-5 text-amber-400" />
                    <h3 className="text-sm font-black uppercase tracking-wider text-amber-400">Latest Announcement</h3>
                </div>
                {loading ? (
                    <div className="animate-pulse flex flex-col gap-2">
                        <div className="h-4 bg-white/20 rounded w-full"></div>
                        <div className="h-4 bg-white/20 rounded w-5/6"></div>
                        <div className="h-4 bg-white/20 rounded w-4/6"></div>
                    </div>
                ) : (
                    <div className="text-sm leading-relaxed font-medium opacity-90" style={{ fontFamily: 'var(--font-body)' }}>
                        {announcement}
                    </div>
                )}
            </div>
        </div>
    );
};

const SchoolCalendarCard = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const currentDate = today.getDate();

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

    const blanks = Array.from({ length: firstDay }, (_, i) => i);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border-2 border-slate-100 flex flex-col relative overflow-hidden">
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                    <FiCalendar className="w-5 h-5 text-sky-500" />
                    <h3 className="text-sm font-black uppercase tracking-wider text-[#08315F]">
                        {monthNames[currentMonth]} {currentYear}
                    </h3>
                </div>
            </div>
            
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {dayNames.map(day => (
                    <div key={day} className="text-[10px] font-black text-slate-400 uppercase tracking-widest py-1">
                        {day}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
                {blanks.map(blank => (
                    <div key={`blank-${blank}`} className="p-2"></div>
                ))}
                {days.map(day => {
                    const isToday = day === currentDate;
                    return (
                        <div key={day} className="flex justify-center items-center p-1">
                            <span 
                                className={`w-7 h-7 flex items-center justify-center text-xs font-bold rounded-full transition-all ${
                                    isToday 
                                        ? 'bg-sky-500 text-white shadow-md ring-4 ring-sky-50 font-black' 
                                        : 'text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                {day}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const RecentActivityFeedCard = () => {
    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border-2 border-slate-100 flex flex-col relative overflow-hidden">
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                    <FiClock className="w-5 h-5 text-emerald-500" />
                    <h3 className="text-sm font-black uppercase tracking-wider text-[#08315F]">Recent Activity</h3>
                </div>
            </div>
            
            <div className="relative border-l-2 border-slate-100 ml-3 pl-5 flex flex-col gap-6 py-2 mt-2">
                <div className="relative">
                    <div className="absolute -left-[27px] top-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-4 ring-white" />
                    <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wide">Unit 3 Validated</h4>
                    <p className="text-[10px] font-bold text-slate-500 mt-1">Division verified Organized Classes.</p>
                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block mt-1.5">2 hours ago</span>
                </div>
                <div className="relative">
                    <div className="absolute -left-[27px] top-0.5 w-3 h-3 rounded-full bg-sky-400 ring-4 ring-white" />
                    <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wide">Learner Profile Saved</h4>
                    <p className="text-[10px] font-bold text-slate-500 mt-1">Draft saved for Unit 4.</p>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mt-1.5">Yesterday</span>
                </div>
                <div className="relative">
                    <div className="absolute -left-[27px] top-0.5 w-3 h-3 rounded-full bg-amber-400 ring-4 ring-white" />
                    <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wide">Help Ticket Opened</h4>
                    <p className="text-[10px] font-bold text-slate-500 mt-1">Issue reported regarding LRN format.</p>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mt-1.5">2 days ago</span>
                </div>
            </div>
        </div>
    );
};

export default MyActivityDashboard;
