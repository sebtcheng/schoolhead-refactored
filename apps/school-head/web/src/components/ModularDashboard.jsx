import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { FiHome, FiUsers, FiGrid, FiBookOpen, FiArrowLeft, FiClock, FiShield, FiStar, FiAward, FiCheck, FiMapPin, FiInfo, FiMail, FiX, FiLock, FiSettings, FiLogOut } from "react-icons/fi";
import { TbSchool, TbHeadset } from "react-icons/tb";
import { LuCompass } from "react-icons/lu";
import { motion, AnimatePresence } from "framer-motion";
import { getUnitDraft } from "../db";

import { DASHBOARD_METADATA } from "../config/dashboardMetadata";
import { useAuth } from "../context/AuthContext";
import PageTransition from "./PageTransition";
import SharedNexusSidebar from "./SharedNexusSidebar";
import { api } from "../lib/api";

const getRank = (xp) => {
    if (xp >= 500) return { title: 'Platinum', badgeClass: 'bg-slate-800 text-slate-100 border-slate-700 shadow-slate-200', icon: <FiAward /> };
    if (xp >= 300) return { title: 'Gold', badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 shadow-amber-100', icon: <FiStar /> };
    if (xp >= 150) return { title: 'Silver', badgeClass: 'bg-slate-100 text-slate-700 border-slate-300 shadow-slate-100', icon: <FiShield /> };
    return { title: 'Bronze', badgeClass: 'bg-orange-50 text-orange-800 border-orange-200 shadow-sm', icon: <FiShield /> };
};

// Map each unit to a nice vibrant icon color theme
const UNIT_THEMES = {
    1: 'from-orange-500 to-amber-500 shadow-orange-500/30 text-white',
    2: 'from-emerald-500 to-green-500 shadow-emerald-500/30 text-white',
    3: 'from-red-500 to-rose-500 shadow-red-500/30 text-white',
    4: 'from-sky-500 to-blue-500 shadow-sky-500/30 text-white',
    5: 'from-blue-600 to-indigo-600 shadow-blue-500/30 text-white',
    6: 'from-purple-500 to-violet-500 shadow-purple-500/30 text-white',
    7: 'from-fuchsia-500 to-pink-500 shadow-fuchsia-500/30 text-white',
    8: 'from-teal-500 to-cyan-500 shadow-teal-500/30 text-white',
    9: 'from-slate-600 to-slate-800 shadow-slate-600/30 text-white'
};

const ModularDashboard = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user, confirmLogout } = useAuth();

    const impersonatedUid = searchParams.get('uid');

    const [questProgress, setQuestProgress] = useState(() => {
        if (!impersonatedUid) {
            const stored = localStorage.getItem('quest_progress');
            if (stored) {
                const parsed = JSON.parse(stored);
                return { ...parsed, isFromCache: true };
            }
        }
        return { completedUnits: [], xp: 0, isFromCache: false, validationFlags: {} };
    });
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

                if (user?.role === 'Super User' && impersonatedUid) {
                    const profileRes = await fetch(api(`/school-by-user/${impersonatedUid}`));
                    const profileJson = await profileRes.json();
                    if (profileJson.exists && profileJson.data.school_id) {
                        schoolId = profileJson.data.school_id;
                    }
                }

                if (schoolId) {
                    const res = await fetch(api(`/ph_schools/progress/${schoolId}`));
                    if (res.ok) {
                        const json = await res.json();
                        if (json.success && json.data && json.data.progress) {
                            const { progress, schoolInfo } = json.data;

                            if (progress.curricular_offering) {
                                setCurricularOffering(progress.curricular_offering);
                            }
                            setQuestProgress({
                                ...progress,
                                schoolId: schoolInfo?.school_id || schoolId,
                                school_name: schoolInfo?.school_name,
                                isFromCache: false
                            });

                            if (progress.timestamps) {
                                setUnitTimestamps(progress.timestamps);
                            }

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
            const unitIds = [1, 2, 3, 4, 5, 6, 7, 8, 9];

            await Promise.all(unitIds.map(async (i) => {
                try {
                    const draft = await getUnitDraft(i, schoolId);
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
    }, [user, impersonatedUid]);

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
        let units = DASHBOARD_METADATA.units;

        return units.map(u => {
            let title = u.title;
            const Icon = u.icon;
            const isExcluded = u.id === 1 || u.id === 2;

            return {
                id: u.id,
                title: title,
                icon: <Icon className="w-6 h-6" />,
                path: u.path,
                locked: false,
                hasDraft: !!unitDrafts[u.id],
                lastUpdated: unitTimestamps[`unit${u.id}`],
                isValidated: isExcluded ? false : (questProgress.validationFlags?.[`unit${u.id}`] === true),
                showsValidation: !isExcluded
            };
        });
    }, [questProgress, unitDrafts, unitTimestamps]);

    const handleModuleClick = (mod) => {
        if (mod.locked) return;
        const targetPath = impersonatedUid ? `${mod.path}?uid=${impersonatedUid}` : mod.path;
        navigate(targetPath);
    };

    if (isLoading) return (
        <div className="min-h-screen bg-white flex items-center justify-center">
            <div className="flex flex-col items-center">
                <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full"
                />
                <p className="mt-4 text-sky-600 font-bold text-sm uppercase tracking-widest">Loading units dashboard...</p>
            </div>
        </div>
    );

    return (
        <PageTransition>
            <div className="nodes-app-layout lg:pl-[80px]">
                {/* Scope-specific Stylesheets for exact visual guidelines */}
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap');
                    
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
                      --font-heading: "Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                      --font-body: "DM Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                      --radius: 22px;
                    }

                    .nodes-app-layout {
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
                      transition: grid-template-columns 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    }

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

                    .nodes-brand:hover {
                      transform: scale(1.08);
                    }

                    .nodes-sidebar:hover .nodes-brand {
                      justify-content: flex-start;
                      padding-left: 8px;
                    }

                    .logo-collapsed {
                      display: block !important;
                    }
                    .logo-expanded {
                      display: none !important;
                    }

                    .nodes-sidebar:hover .logo-collapsed {
                      display: none !important;
                    }
                    .nodes-sidebar:hover .logo-expanded {
                      display: block !important;
                      max-width: 170px;
                      height: auto;
                    }

                    .nodes-brand img {
                      filter: drop-shadow(1px 0 0 #fff) drop-shadow(-1px 0 0 #fff) drop-shadow(0 1px 0 #fff) drop-shadow(0 -1px 0 #fff) drop-shadow(0 2px 4px rgba(0,0,0,0.15));
                    }

                    .nodes-nav {
                      display: flex;
                      flex-direction: column;
                      align-items: center;
                      gap: 16px;
                      width: 100%;
                      transition: align-items 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    }

                    .nodes-sidebar:hover .nodes-nav {
                      align-items: flex-start;
                    }

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
                    }

                    .nodes-sidebar:hover .nodes-nav a {
                      justify-content: flex-start;
                      width: 100%;
                      padding: 12px 14px;
                      height: auto;
                    }

                    .nodes-nav a span {
                      display: none;
                      opacity: 0;
                      transition: opacity 0.3s ease;
                      white-space: nowrap;
                    }

                    .nodes-sidebar:hover .nodes-nav a span {
                      display: inline-block;
                      opacity: 1;
                    }

                    .nodes-nav a:hover {
                      color: white;
                      background: rgba(255, 255, 255, 0.08);
                      transform: translateY(-2px);
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
                      min-height: 130px;
                      padding: 24px 44px;
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
                      font-size: 36px;
                      line-height: 1.12;
                      font-weight: 900;
                      letter-spacing: -0.01em;
                      color: #ffffff;
                    }

                    .nodes-topbar .eyebrow {
                      color: var(--gold);
                      font-size: 11px;
                      font-weight: 900;
                      letter-spacing: 0.15em;
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
                        padding-bottom: 120px;
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

                      .nodes-nav a span {
                        display: block !important;
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
                        padding: 16px;
                        margin: 12px 12px 0 12px;
                        border-radius: 14px;
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

                <SharedNexusSidebar activeTab="Units" />

                {/* Main Content Area */}
                <div className="flex-grow flex flex-col min-h-screen overflow-y-auto pb-32 lg:pb-10">
                    

                    {/* Developer Info Modal */}
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
                                    className="w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl overflow-hidden relative border border-slate-200"
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
                                            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-blue-100">
                                                <FiUsers className="w-8 h-8 text-blue-600" />
                                            </div>
                                            <h2 className="text-xl font-black text-slate-800 tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>Meet the Team</h2>
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
                                                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
                                                        {dev.name.split(' ').pop().charAt(0)}
                                                    </div>
                                                    <div className="text-left">
                                                        <p className="text-sm font-black text-slate-800">{dev.name}</p>
                                                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">{dev.role}</p>
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

                                    <div className="bg-slate-50 py-3 text-center border-t border-slate-100">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Powered by STRIDE • 2024</p>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Main Content Layout Grid */}
                    <div className="max-w-6xl mx-auto px-6 md:px-8 pt-6 relative z-10 flex flex-col gap-8">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-12 gap-x-6 mt-6">
                            {modules.map((mod, idx) => {
                                const isCompleted = questProgress.completedUnits.includes(mod.id);
                                const isLocked = mod.locked;
                                const isNextActiveRound = !isCompleted && !isLocked &&
                                    modules.slice(0, idx).every(m => questProgress.completedUnits.includes(m.id));
                                const ringProgress = isCompleted ? 100 : (isNextActiveRound ? 25 : 0);
                                const themeClass = UNIT_THEMES[mod.id] || 'from-blue-500 to-indigo-500';

                                return (
                                    <motion.div
                                        key={mod.id}
                                        initial={{ opacity: 0, y: 30 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.06 }}
                                        className="relative pt-6"
                                    >
                                        {/* Center-Top Overlapping Icon Frame */}
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center absolute -top-0.5 left-1/2 -translate-x-1/2 shadow-md z-20 bg-gradient-to-br transition-all duration-300
                                            ${isLocked
                                                ? 'from-slate-700 to-slate-800 text-slate-400 border border-slate-600/30'
                                                : themeClass}`}
                                        >
                                            {isLocked ? (
                                                <FiLock className="w-4 h-4" />
                                            ) : isCompleted ? (
                                                <FiCheck className="w-5 h-5" />
                                            ) : (
                                                mod.icon
                                            )}
                                        </div>

                                        {/* Card Component Container */}
                                        <button
                                            onClick={() => !isLocked && handleModuleClick(mod)}
                                            className={`nodes-card w-full pt-8 pb-4 px-5 text-center transition-all duration-300 flex flex-col h-[180px] justify-between relative
                                                ${isLocked ? 'grayscale opacity-60 pointer-events-none' : ''}
                                                ${isNextActiveRound ? 'bg-[#f0f6ff]/80 shadow-md ring-1 ring-sky-300/30' : 'bg-white'}
                                            `}
                                        >
                                            <div className="flex flex-col items-center w-full">
                                                {/* Subtitle / Unit label */}
                                                <span className={`text-[9px] font-mono uppercase tracking-[0.15em] mb-1.5
                                                    ${isLocked ? 'text-slate-400' : isCompleted ? 'text-slate-400' : 'text-blue-600'}`}
                                                >
                                                    Unit {mod.id}
                                                </span>

                                                {/* Title */}
                                                <h3 className="text-base font-black tracking-tight leading-snug max-w-[200px] mb-2 text-[#08315F]" style={{ fontFamily: 'var(--font-heading)' }}>
                                                    {mod.title}
                                                </h3>

                                                {/* Badges / Status Indicator - Draft badge */}
                                                {mod.hasDraft ? (
                                                    <span className="px-2 py-0.5 rounded-lg bg-amber-500 text-white text-[8px] font-black uppercase tracking-wider shadow-sm">
                                                        Draft
                                                    </span>
                                                ) : null}
                                            </div>

                                            {/* Progress Bar block */}
                                            <div className="w-full mt-auto">
                                                <div className="flex justify-between items-center mb-1.5 text-[9px] font-mono font-bold">
                                                    <span className="text-slate-400">PROGRESS</span>
                                                    <span className="text-slate-700">{ringProgress}%</span>
                                                </div>
                                                <div className="h-1.5 w-full rounded-full overflow-hidden bg-slate-100 border border-slate-200/40">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${ringProgress}%` }}
                                                        transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
                                                        className="h-full rounded-full"
                                                        style={{
                                                            background: mod.isValidated 
                                                                ? 'linear-gradient(90deg, #10b981, #34d399)' 
                                                                : 'linear-gradient(90deg, var(--blue), var(--blue-600))'
                                                        }}
                                                    />
                                                </div>
                                                <div className="flex items-center justify-center gap-1 mt-2">
                                                    <FiClock className={`w-2.5 h-2.5 ${isLocked ? 'text-slate-700' : 'text-slate-300'}`} />
                                                    <span className={`text-[8px] font-mono uppercase tracking-tighter ${isLocked ? 'text-slate-600' : 'text-slate-400'}`}>
                                                        {formatTimestamp(mod.lastUpdated)}
                                                    </span>
                                                </div>
                                            </div>
                                        </button>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>

                </div>
            </div>
        </PageTransition>
    );
};

export default ModularDashboard;
