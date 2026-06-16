import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FiArrowRight,
    FiBookOpen,
    FiAward,
    FiMoreVertical,
    FiLogOut,
    FiLock,
    FiGrid,
    FiArrowLeft,
    FiMapPin,
    FiLayers,
    FiBarChart2,
    FiHome,
    FiSettings
} from 'react-icons/fi';
import { TbReportAnalytics, TbTarget, TbShieldCheck, TbShieldX, TbCloudSearch, TbUsers, TbBriefcase, TbHeadset, TbSchool } from "react-icons/tb";
import { LuCompass } from "react-icons/lu";
import { useAuth } from '../context/AuthContext';
import loadingLogo from '../assets/loading.gif';
import PageTransition from '../components/PageTransition';
import { api } from "../lib/api";


const NodesDashboard = () => {
    const navigate = useNavigate();
    const { user, logout, confirmLogout } = useAuth();
    const [questProgress, setQuestProgress] = useState({ completedUnits: [], xp: 0, validation_percentage: 0 });
    const [loading, setLoading] = useState(true);
    const [isNavigating, setIsNavigating] = useState(false);
    const [showEdWelcome, setShowEdWelcome] = useState(false);
    const [dynamicLocks, setDynamicLocks] = useState({});
    const [activeView, setActiveView] = useState('main'); // 'main' or 'services'


    useEffect(() => {
        const loadCommonData = async () => {
            const isNew = localStorage.getItem('isNewUser');
            if (isNew === 'true') {
                setShowEdWelcome(true);
            }

            const schoolId = localStorage.getItem('schoolId') || user?.school_id;
            if (schoolId) {
                try {
                    const res = await fetch(api(`/ph_schools/progress/${schoolId}`));
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

                    const locksRes = await fetch(api(`/settings/nexus_module_locks`));
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
        if (id === 'other-services') {
            setActiveView('services');
            return;
        }

        if (route.startsWith('http')) {
            const token = user?.token || localStorage.getItem('token');
            const targetUrl = new URL(route);
            targetUrl.searchParams.set('token', token);
            window.location.href = targetUrl.toString();
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
                <div className="flex flex-col gap-0.5 mt-1 font-bold">
                    <div className="flex items-baseline gap-1">
                        <span className="text-[13px] text-[#075985] font-black w-3">C</span>
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">onsole for</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-[13px] text-[#075985] font-black w-3">L</span>
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">earning and</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-[13px] text-[#075985] font-black w-3">O</span>
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">peration in</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-[13px] text-[#075985] font-black w-3">U</span>
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">nified</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-[13px] text-[#075985] font-black w-3">D</span>
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">atabase</span>
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
            hideProgress: true,
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
            isLocked: dynamicLocks.hasOwnProperty('nspp') ? dynamicLocks['nspp'] : true,
        },
        {
            id: 'other-services',
            title: 'OTHER SERVICES',
            subtitle: 'Supplemental',
            emoji: '📦',
            icon: <FiGrid className="w-8 h-8" />,
            color: 'from-slate-600 to-slate-800',
            textColor: 'text-slate-700',
            bgLight: 'bg-slate-50',
            progress: 0,
            route: '#',
            description: 'Access supplemental microservices and specialized school management tools.',
            isLocked: false,
            badge: 'EXPANDING'
        }
    ];

    const SIIF_URL = import.meta.env.VITE_SIIF_URL || 'http://localhost:5174';

    const otherServicesModules = [
        {
            id: 'siif',
            title: 'SIIF HUB',
            subtitle: 'Innovation Fund',
            emoji: '💰',
            icon: <FiAward className="w-8 h-8" />,
            color: 'from-blue-600 to-blue-800',
            textColor: 'text-blue-700',
            bgLight: 'bg-blue-50',
            progress: 0,
            route: '/siif',
            description: 'Manage School Innovation and Intervention Fund submissions and utilization.',
            isLocked: false,
        },
        {
            id: 'soss',
            title: 'SOSS HUB',
            subtitle: 'Social Services',
            emoji: '🤝',
            icon: <TbUsers className="w-8 h-8" />,
            color: 'from-emerald-600 to-emerald-800',
            textColor: 'text-emerald-700',
            bgLight: 'bg-emerald-50',
            progress: 0,
            route: '#',
            description: 'Integrated platform for tracking school-based social service programs.',
            isLocked: true,
            badge: 'PLACEHOLDER'
        },
        {
            id: 'sgc',
            title: 'SGC HUB',
            subtitle: 'Governance',
            emoji: '🏛️',
            icon: <TbBriefcase className="w-8 h-8" />,
            color: 'from-indigo-600 to-indigo-800',
            textColor: 'text-indigo-700',
            bgLight: 'bg-indigo-50',
            progress: 0,
            route: '#',
            description: 'School Governance Council management and compliance tracking.',
            isLocked: true,
            badge: 'PLACEHOLDER'
        }
    ];

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
                ` }} />

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
                        <a href="#/nodes-dashboard" className="active">
                            <FiHome size={18} />
                            <span>Home</span>
                        </a>
                        <a href="#/my-activity">
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

                    {/* Header / Topbar (School Card Style) */}
                    <div className="nodes-topbar">
                        <div className="flex flex-col">
                            <span className="eyebrow">National Education Command Center</span>
                            <h1 className="flex items-center gap-2">
                                {activeView === 'services' ? (
                                    <span className="text-white">Other Services</span>
                                ) : (
                                    <span className="text-white">{questProgress.school_name || "InsightED Dashboard"}</span>
                                )}
                            </h1>
                            <p className="text-[10px] font-bold text-[#E0F2FE] uppercase tracking-[0.2em] mt-0.5 relative z-10">
                                {activeView === 'services' ? "Supplemental Microservices" : `School ID: ${questProgress.schoolId || "------"}`}
                            </p>
                        </div>

                        {/* Topbar Actions */}
                        <div className="flex items-center gap-2.5 relative z-10">
                            {activeView === 'services' && (
                                <button
                                    onClick={() => setActiveView('main')}
                                    className="p-2 bg-white/95 rounded-xl text-slate-700 hover:text-blue-600 transition-colors shadow-md border border-slate-100"
                                >
                                    <FiArrowLeft size={15} />
                                </button>
                            )}

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

                    {/* Dynamic Modules Grid */}
                    <div className="p-6 md:p-8 flex-grow">
                        <AnimatePresence mode="wait">
                            {activeView === 'main' ? (
                                <motion.div
                                    key="main-grid"
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -15 }}
                                    className="grid grid-cols-1 md:grid-cols-2 gap-6"
                                >
                                    {modules.map((mod, idx) => (
                                        <ModuleCard key={mod.id} mod={mod} idx={idx} onClick={handleCardClick} isPrimary={mod.id === 'esf7'} questProgress={questProgress} />
                                    ))}
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="services-grid"
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -15 }}
                                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                                >
                                    {otherServicesModules.map((mod, idx) => (
                                        <ModuleCard key={mod.id} mod={mod} idx={idx} onClick={handleCardClick} questProgress={questProgress} />
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

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
                            className="relative bg-white rounded-[22px] p-8 shadow-2xl border-4 border-blue-500/20 max-w-sm w-full"
                            style={{ fontFamily: 'var(--font-body)' }}
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

                                <h2 className="text-2xl font-black text-slate-800 italic uppercase leading-tight" style={{ fontFamily: 'var(--font-heading)' }}>
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
        </PageTransition>
    );
};

// --- EXTRACTED COMPONENT FOR DESIGN CONSISTENCY ---
const ModuleCard = ({ mod, idx, onClick, isPrimary, questProgress }) => {

    // Dynamic color coding for the left accent bar
    const getAccentColor = (id) => {
        switch (id) {
            case 'school-info': return 'var(--blue)';
            case 'esf7': return 'var(--gold)';
            case 'nspp': return 'var(--blue)';
            case 'other-services': return 'var(--red)';
            case 'siif': return 'var(--blue)';
            case 'soss': return 'var(--gold)';
            case 'sgc': return 'var(--navy)';
            default: return 'var(--blue)';
        }
    };

    // Dynamic progress bar styling matching the design document
    const getProgressGradient = (id) => {
        if (id === 'esf7') return 'linear-gradient(90deg, var(--gold), var(--amber))';
        if (id === 'other-services' || id === 'soss' || id === 'sgc') return 'linear-gradient(90deg, var(--red), #EF4444)';
        return 'linear-gradient(90deg, var(--blue), var(--blue-600))';
    };

    const accentColor = getAccentColor(mod.id);

    return (
        <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => !mod.isLocked && onClick(mod.route, mod.id)}
            className={`
                nodes-card flex flex-col p-6 cursor-pointer relative overflow-hidden
                ${mod.isLocked ? 'grayscale opacity-60 pointer-events-none' : ''}
            `}
            style={{
                borderLeft: `6px solid ${accentColor}`,
                fontFamily: 'var(--font-body)'
            }}
        >
            <div className="flex justify-between items-start mb-6">
                <div className="flex flex-col">
                    <h4 className="text-xl font-black leading-tight mb-1 text-[#08315F]" style={{ fontFamily: 'var(--font-heading)' }}>
                        {mod.title}
                    </h4>
                    <div className="text-[10px] font-black uppercase tracking-[0.15em] leading-tight text-slate-400">
                        {mod.subtitle}
                    </div>
                </div>

                {mod.isLocked ? (
                    <div className="p-2 rounded-xl bg-slate-100 text-slate-400">
                        <FiLock size={16} />
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        {mod.id === 'school-info' && (
                            <motion.span
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className={`px-2.5 py-1 rounded text-[8px] font-black tracking-widest flex items-center gap-1 shadow-sm border 
                                    ${questProgress.validation_percentage === 100
                                        ? 'bg-emerald-600 text-white border-emerald-400'
                                        : 'bg-red-600 text-white border-red-500 animate-pulse'}
                                `}
                            >
                                {questProgress.validation_percentage === 100 ? (
                                    <>
                                        <TbShieldCheck size={9} /> VALIDATED
                                    </>
                                ) : (
                                    <>
                                        <TbShieldX size={9} /> NEEDS VALIDATION
                                    </>
                                )}
                            </motion.span>
                        )}

                        {mod.id === 'esf7' && mod.progress === 100 && (
                            <motion.span
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="px-2.5 py-1 rounded text-[8px] font-black tracking-widest bg-emerald-500 text-white shadow-sm border border-emerald-400 flex items-center gap-1"
                            >
                                <FiAward size={9} /> COMPLETED
                            </motion.span>
                        )}
                        <FiMoreVertical className="text-slate-300" />
                    </div>
                )}
            </div>

            <div className="flex items-center gap-4 mb-6">
                <motion.div
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm bg-sky-50/50 border border-sky-100 text-[#075985]"
                >
                    {React.cloneElement(mod.icon, { className: "w-7 h-7" })}
                </motion.div>

                <div className="flex-1">
                    <p className="text-xs font-bold leading-relaxed text-slate-500">
                        {mod.description}
                    </p>
                </div>
            </div>

            {!mod.hideProgress && (
                <div className="mt-auto">
                    <div className="flex justify-between items-end mb-2">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
                                {mod.id === 'other-services' || mod.isLocked ? "Status" : "Completion Percentage"}
                            </span>
                            <span className="text-lg font-black text-[#08315F]">
                                {mod.isLocked ? "LOCKED" : `${mod.progress || 0}%`}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {mod.badge && (
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-widest ${mod.isLocked ? 'bg-slate-800 text-white' : 'bg-[#08315F] text-white'}`}>
                                    {mod.badge}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="h-2 w-full rounded-full overflow-hidden bg-slate-100">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${mod.isLocked ? 0 : (mod.progress || 0)}%` }}
                            transition={{ duration: 1.2, ease: "easeOut", delay: idx * 0.05 }}
                            className="h-full rounded-full"
                            style={{ background: getProgressGradient(mod.id) }}
                        />
                    </div>
                </div>
            )}
        </motion.div>
    );
};

export default NodesDashboard;

