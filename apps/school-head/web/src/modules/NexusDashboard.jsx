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
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [activeTab, setActiveTab] = useState('Home');

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

    if (!user) {
      console.log(`[NexusDashboard] Unauthenticated click on module "${id}". Redirecting to login with target: ${route}`);
      sessionStorage.setItem('login_target_redirect', route);
      navigate('/login', { state: { from: route } });
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
            className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mt-6 italic font-sans"
          >
            Initializing Command Center Hub...
          </motion.p>
        )}
      </div>
    );
  }

  const modules = [
    {
      id: 'school-info',
      title: 'CLOUD Hub',
      subtitle: 'Monitoring & Analysis',
      icon: <TbCloudSearch className="w-6 h-6 md:w-8 h-8" />,
      progress: calculateProgress([1, 2, 3, 4, 5, 6, 7, 8, 9]),
      route: '/my-activity',
      description: 'Console for Learning and Operation in Unified Database. Access to school data.',
      isLocked: dynamicLocks['school-info'] || false,
      hideProgress: true,
      cardClass: 'support' // Emerald/Cyan theme
    },
    {
      id: 'esf7',
      title: 'eSF7 Hub',
      subtitle: 'Inventory',
      icon: <TbReportAnalytics className="w-6 h-6 md:w-8 h-8" />,
      progress: questProgress.esf7_progress || 0,
      route: 'https://stride.deped.gov.ph/insighted/Insighted-esf7/',
      badge: !questProgress.is_esf7_opened ? 'COMING SOON' : null,
      description: 'The eSF7 Hub manages the inventory of school personnel through the submission of the eSF7 tool via InsightED.',
      isLocked: !questProgress.is_esf7_opened,
      cardClass: '' // Default Blue
    },
    {
      id: 'nspp',
      title: 'NSPP Path',
      subtitle: 'Assessment Audit',
      icon: <TbTarget className="w-6 h-6 md:w-8 h-8" />,
      progress: 0,
      route: '/draft/nspp',
      badge: 'COMING SOON',
      description: 'Registry monitoring for the deployment of administrative staff in schools.',
      isLocked: dynamicLocks.hasOwnProperty('nspp') ? dynamicLocks['nspp'] : true,
      cardClass: 'reports' // Red theme
    },
    {
      id: 'other-services',
      title: 'Other Services',
      subtitle: 'Extensions',
      icon: <FiGrid className="w-6 h-6 md:w-8 h-8" />,
      progress: 0,
      route: '#',
      description: 'Access supplemental microservices and specialized school management tools.',
      isLocked: false,
      badge: 'EXPANDING',
      cardClass: 'admin' // Gold theme
    }
  ];

  const otherServicesModules = [
    {
      id: 'back',
      title: 'Back to Nexus',
      subtitle: 'Return',
      icon: <FiArrowLeft className="w-6 h-6 md:w-8 h-8" />,
      route: '#',
      description: 'Return to the main SchoolHead Nexus Dashboard.',
      isLocked: false,
      cardClass: '',
      onClick: () => setActiveView('main')
    },
    {
      id: 'siif',
      title: 'SIIF HUB',
      subtitle: 'Innovation Fund',
      icon: <FiAward className="w-6 h-6 md:w-8 h-8" />,
      progress: 0,
      route: '/siif',
      description: 'Manage School Innovation and Intervention Fund submissions and utilization.',
      isLocked: false,
      cardClass: 'support' // Emerald
    },
    {
      id: 'soss',
      title: 'SOSS HUB',
      subtitle: 'Social Services',
      icon: <TbUsers className="w-6 h-6 md:w-8 h-8" />,
      progress: 0,
      route: '#',
      description: 'Integrated platform for tracking school-based social service programs.',
      isLocked: true,
      badge: 'PLACEHOLDER',
      cardClass: 'admin' // Gold
    },
    {
      id: 'sgc',
      title: 'SGC HUB',
      subtitle: 'Governance',
      icon: <TbBriefcase className="w-6 h-6 md:w-8 h-8" />,
      progress: 0,
      route: '#',
      description: 'School Governance Council management and compliance tracking.',
      isLocked: true,
      badge: 'PLACEHOLDER',
      cardClass: '' // Default Blue
    }
  ];

  const currentModules = activeView === 'main' ? modules : otherServicesModules;

  const navItems = [
    { label: 'Home', icon: <FiHome size={18} />, path: '/nodes-dashboard' },
    { label: 'CLOUD', icon: <TbCloudSearch size={18} />, path: '/my-activity' },
    { label: 'Units', icon: <LuCompass size={18} />, path: '/modular-dashboard' },
    { label: 'Guide', icon: <TbSchool size={18} />, path: '/guide/school-head' },
    { label: 'Settings', icon: <FiSettings size={18} />, path: '/profile' }
  ];

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#EAF6FB] font-['DM_Sans'] text-[#082B4C] relative selection:bg-sky-200">
        <style dangerouslySetInnerHTML={{
          __html: `
                    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap');
                    
                    :root {
                        --navy: #06345F;
                        --navy-2: #05233F;
                        --blue: #0A6FA6;
                        --blue-deep: #04557F;
                        --sky: #BFE6F5;
                        --sky-soft: #EAF7FC;
                        --cream: #FFF2C6;
                        --gold: #FDBA22;
                        --gold-deep: #D99100;
                        --ink: #082B4C;
                        --muted: #667A91;
                        --card: #FFFFFF;
                        --radius: 24px;

                        --split-a: #05233F;
                        --split-b: #06345F;
                        --split-c: #0A6FA6;
                        --hero-accent: #FDBA22;
                        --hero-copy: #DFF2FB;
                        --hero-title: #FFFFFF;
                        --card-glass-a: rgba(255, 255, 255, 0.68);
                        --card-glass-b: rgba(255, 255, 255, 0.38);
                        --card-border: rgba(255, 255, 255, 0.78);
                        --card-shadow: rgba(8, 43, 76, 0.16);
                        --bg-1: #EAF7FC;
                        --bg-2: #F8FCFF;
                        --bg-3: #FFF2C6;
                        --orb-warm: rgba(253, 186, 34, 0.30);
                        --orb-cool: rgba(10, 111, 166, 0.18);

                        --font-heading: "Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                        --font-body: "DM Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                    }

                    /* Custom Collapsible Sidebar Styles matching SchoolHead */
                    .nodes-app-layout {
                      min-height: 100vh;
                      width: 100vw;
                      max-width: 100%;
                      overflow-x: hidden;
                      transition: grid-template-columns 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                      position: relative;
                      z-index: 10;
                    }

                    .nodes-sidebar {
                      width: 80px;
                      position: fixed;
                      top: 0;
                      bottom: 0;
                      left: 0;
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
                      z-index: 100 !important;
                    }

                    .nodes-sidebar:hover, .nodes-sidebar.sidebar-expanded {
                      width: 260px !important;
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

                    .nodes-sidebar:hover .nodes-brand, .nodes-sidebar.sidebar-expanded .nodes-brand {
                      justify-content: flex-start;
                      padding-left: 8px;
                    }

                    .logo-collapsed {
                      display: block !important;
                    }
                    .logo-expanded {
                      display: none !important;
                    }

                    .nodes-sidebar:hover .logo-collapsed, .nodes-sidebar.sidebar-expanded .logo-collapsed {
                      display: none !important;
                    }
                    .nodes-sidebar:hover .logo-expanded, .nodes-sidebar.sidebar-expanded .logo-expanded {
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

                    .nodes-sidebar:hover .nodes-nav, .nodes-sidebar.sidebar-expanded .nodes-nav {
                      align-items: flex-start;
                    }

                    .nodes-nav button {
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
                      background: transparent;
                    }

                    .nodes-sidebar:hover .nodes-nav button, .nodes-sidebar.sidebar-expanded .nodes-nav button {
                      justify-content: flex-start;
                      width: 100%;
                      padding: 12px 14px;
                      height: auto;
                    }

                    .nodes-nav button:hover {
                      color: white;
                      background: rgba(255, 255, 255, 0.08);
                      transform: translateY(-2px);
                    }

                    .nodes-nav button.active {
                      background: rgba(255, 255, 255, 0.16) !important;
                      color: white !important;
                      border-color: rgba(255, 255, 255, 0.28) !important;
                      box-shadow:
                        inset 0 -3px 0 var(--gold),
                        0 0 18px color-mix(in srgb, var(--blue) 26%, transparent) !important;
                    }

                    .sidebar-text-label {
                      display: none;
                      opacity: 0;
                      transition: opacity 0.3s ease;
                      white-space: nowrap;
                    }

                    .nodes-sidebar:hover .sidebar-text-label, .nodes-sidebar.sidebar-expanded .sidebar-text-label {
                      display: inline-block !important;
                      opacity: 1;
                    }

                    /* NEW NEXUS DESIGN CSS */
                    .nexus-preview {
                      position: relative;
                      width: 100%;
                      min-height: 100vh;
                      overflow-x: hidden;
                      display: flex;
                      flex-direction: column;
                    }

                    .preview-bg{
                      position:fixed;
                      inset:0;
                      z-index:-1;
                      background:
                        radial-gradient(circle at 78% 14%,var(--orb-warm),transparent 32%),
                        radial-gradient(circle at 70% 86%,var(--orb-cool),transparent 34%),
                        linear-gradient(135deg,var(--bg-1) 0%,var(--bg-2) 52%,var(--bg-3) 100%);
                    }

                    @media (min-width: 1000px) {
                        .nexus-preview {
                          height: 100vh;
                          overflow-y: hidden;
                        }
                        .nexus-preview::before{
                          content:"";
                          position:fixed;
                          z-index:-1;
                          left:-18%;
                          top:-18%;
                          width:68%;
                          height:136%;
                          border-radius:0;
                          background:
                            radial-gradient(circle at 18% 18%,rgba(255,255,255,.18),transparent 30%),
                            linear-gradient(160deg,var(--split-a) 0%,var(--split-b) 58%,var(--split-c) 100%);
                          clip-path:polygon(0 0,78% 0,100% 50%,78% 100%,0 100%);
                          box-shadow:34px 0 80px rgba(6,52,95,.20);
                          pointer-events:none;
                        }
                    }

                    .bg-orb{
                      position:fixed;
                      z-index:-1;
                      border-radius:999px;
                      opacity:.68;
                      pointer-events:none;
                      animation:floatOrb 13s ease-in-out infinite alternate;
                    }

                    .orb-a{
                      width:310px;
                      height:310px;
                      left:4%;
                      top:6%;
                      background:radial-gradient(circle,rgba(10,111,166,.24),transparent 68%);
                    }

                    .orb-b{
                      width:370px;
                      height:370px;
                      right:-8%;
                      top:-10%;
                      background:radial-gradient(circle,rgba(253,186,34,.34),transparent 68%);
                      animation-delay:.5s;
                    }

                    .orb-c{
                      width:280px;
                      height:280px;
                      right:14%;
                      bottom:-12%;
                      background:radial-gradient(circle,rgba(191,230,245,.34),transparent 68%);
                      animation-delay:1s;
                    }

                    .landing-stage{
                      position:relative;
                      z-index:3;
                      min-height:100vh;
                      width: 100%;
                      max-width: 1400px;
                      margin: 0 auto;
                      padding:clamp(20px,3.2vw,46px);
                      display:grid;
                      grid-template-columns:minmax(320px,.82fr) minmax(400px,1.18fr);
                      align-items:center;
                      gap:clamp(22px,3.5vw,50px);
                    }

                    .hero{
                      display:grid;
                      justify-items:start;
                      text-align:left;
                      gap:9px;
                      align-self:center;
                      margin-block:auto;
                    }

                    .logo-icon{
                      width:62px;
                      height:62px;
                      display:grid;
                      place-items:center;
                      border-radius:21px;
                      background:rgba(255,255,255,.95);
                      color:var(--navy);
                      border:1px solid rgba(6,52,95,.18);
                      box-shadow:0 16px 38px rgba(8,43,76,.14);
                      font-family:var(--font-heading);
                      font-weight:800;
                      letter-spacing:-.08em;
                      backdrop-filter:blur(14px);
                      animation:fadeDown .5s ease both;
                    }

                    .eyebrow{
                      margin:0;
                      color:var(--hero-accent);
                      font-size:11px;
                      font-weight:800;
                      letter-spacing:.22em;
                      text-transform:uppercase;
                      animation:fadeUp .55s ease .04s both;
                    }

                    .hero h1{
                      margin:0;
                      color:var(--hero-title);
                      font-family:var(--font-heading);
                      font-size:clamp(34px,4.35vw,58px);
                      font-weight:800;
                      letter-spacing:-.052em;
                      line-height:.96;
                      animation:fadeUp .55s ease .08s both;
                    }

                    .hero h1 span{
                      color:var(--hero-title);
                      font-style:italic;
                    }

                    .hero h1 .ed-red{
                      color:#E53935!important;
                    }

                    .hero p{
                      max-width:480px;
                      margin:0;
                      color:var(--hero-copy);
                      font-size:13px;
                      font-weight:700;
                      line-height:1.42;
                      animation:fadeUp .55s ease .12s both;
                    }

                    .portal-grid{
                      width:min(760px,88%);
                      max-height:calc(100vh - 72px);
                      justify-self:center;
                      align-self:center;
                      display:grid;
                      grid-template-columns:1fr;
                      gap:8px;
                    }

                    .portal-card{
                      position:relative;
                      min-height:0;
                      height:clamp(128px,20vh,145px);
                      padding:12px 18px 10px;
                      display:flex;
                      flex-direction:column;
                      overflow:hidden;
                      border-radius:22px;
                      color:var(--ink);
                      border:1.7px solid var(--card-border);
                      background:linear-gradient(135deg,var(--card-glass-a),var(--card-glass-b));
                      backdrop-filter:blur(20px);
                      box-shadow:0 28px 82px var(--card-shadow);
                      transition:transform .22s ease, box-shadow .22s ease, border-color .22s ease;
                      animation:cardIn .6s ease both;
                      cursor:pointer;
                    }

                    .portal-card.locked {
                      filter: grayscale(1);
                      opacity: 0.6;
                      cursor: not-allowed;
                    }

                    .portal-card:nth-child(2){ animation-delay:.08s; }
                    .portal-card:nth-child(3){ animation-delay:.16s; }
                    .portal-card:nth-child(4){ animation-delay:.24s; }
                    .portal-card:nth-child(5){ animation-delay:.32s; }

                    .portal-card:hover:not(.locked){
                      transform:translateY(-6px) scale(1.025);
                      box-shadow:0 34px 90px rgba(8,43,76,.20);
                    }

                    .portal-card::before,
                    .portal-card::after{
                      content:"";
                      position:absolute;
                      pointer-events:none;
                      transition:transform .24s ease, opacity .24s ease;
                    }

                    .portal-card::before{
                      inset:0;
                      background:
                        linear-gradient(135deg,rgba(255,255,255,.42),transparent 38%),
                        linear-gradient(90deg,var(--accent,var(--blue)) 0 6px,transparent 6px),
                        repeating-linear-gradient(135deg,rgba(255,255,255,.18) 0 1px,transparent 1px 12px);
                      opacity:.95;
                    }

                    .portal-card::after{
                      width:154px;
                      height:154px;
                      right:-62px;
                      bottom:-76px;
                      border-radius:999px;
                      background:
                        radial-gradient(circle at 34% 34%,rgba(255,255,255,.72),transparent 30%),
                        rgba(10,111,166,.10);
                    }

                    .portal-card:hover:not(.locked)::after{
                      transform:scale(1.16);
                    }

                    .portal-card.admin{ --accent:var(--gold); }
                    .portal-card.support{ --accent:#10B981; }
                    .portal-card.reports{ --accent:#EF4444; }

                    .card-top{
                      position:relative;
                      z-index:1;
                      display:flex;
                      align-items:center;
                      gap:10px;
                      margin-bottom:6px;
                    }

                    .portal-icon{
                      width:36px;
                      height:36px;
                      display:grid;
                      place-items:center;
                      flex:0 0 auto;
                      border-radius:12px;
                      color:white;
                      background:linear-gradient(135deg,var(--blue),var(--blue-deep));
                      box-shadow:0 14px 28px rgba(10,111,166,.20);
                    }

                    .admin .portal-icon{
                      background:linear-gradient(135deg,var(--gold),var(--gold-deep));
                    }
                    .support .portal-icon{
                      background:linear-gradient(135deg,#34D399,#059669);
                    }
                    .reports .portal-icon{
                      background:linear-gradient(135deg,#F87171,#DC2626);
                    }

                    .card-label{
                      position:relative;
                      z-index:1;
                      margin:0;
                      color:var(--accent,var(--blue));
                      font-size:9px;
                      font-weight:800;
                      letter-spacing:.14em;
                      text-transform:uppercase;
                    }

                    .portal-card h2{
                      position:relative;
                      z-index:1;
                      margin:0 0 5px;
                      color:var(--navy);
                      font-family:var(--font-heading);
                      font-size:clamp(18px,1.72vw,24px);
                      font-style:italic;
                      font-weight:800;
                      letter-spacing:-.038em;
                      line-height:1.02;
                    }

                    .portal-card p{
                      position:relative;
                      z-index:1;
                      max-width:640px;
                      margin:0;
                      color:var(--muted);
                      font-size:10px;
                      font-weight:600;
                      line-height:1.32;
                      display:-webkit-box;
                      -webkit-line-clamp:2;
                      -webkit-box-orient:vertical;
                      overflow:hidden;
                    }

                    .portal-link{
                      position:relative;
                      z-index:1;
                      min-height:20px;
                      margin-top:6px;
                      display:inline-flex;
                      align-items:center;
                      gap:8px;
                      align-self:flex-start;
                      color:var(--accent,var(--blue));
                      font-size:8.8px;
                      font-weight:800;
                      letter-spacing:.12em;
                      text-transform:uppercase;
                    }

                    .portal-link span{
                      transition:transform .2s ease;
                    }

                    .portal-card:hover:not(.locked) .portal-link span{
                      transform:translateX(5px);
                    }

                    .footer-note{
                      position:absolute;
                      left:clamp(24px,4vw,62px);
                      bottom:18px;
                      margin:0;
                      color:var(--muted);
                      font-size:9px;
                      font-weight:600;
                    }

                    .footer-note strong{
                      color:var(--navy);
                    }

                    @keyframes fadeDown{
                      from{opacity:0;transform:translateY(-12px)}
                      to{opacity:1;transform:translateY(0)}
                    }

                    @keyframes fadeUp{
                      from{opacity:0;transform:translateY(12px)}
                      to{opacity:1;transform:translateY(0)}
                    }

                    @keyframes cardIn{
                      from{opacity:0;transform:translateY(18px) scale(.98)}
                      to{opacity:1;transform:translateY(0) scale(1)}
                    }

                    @keyframes floatOrb{
                      from{transform:translate3d(0,0,0) scale(1)}
                      to{transform:translate3d(18px,-16px,0) scale(1.05)}
                    }

                    /* Mobile optimization */
                    @media(max-width:1000px){
                      .landing-stage{
                        padding:22px 16px 28px;
                        grid-template-columns:1fr;
                        align-content:start;
                        gap:18px;
                        padding-bottom: 92px;
                      }
                      .hero{
                        position:relative;
                        overflow:hidden;
                        justify-items:center;
                        text-align:center;
                        gap:8px;
                        padding:18px 14px 20px;
                        border-radius:28px;
                        background:linear-gradient(135deg,var(--split-a),var(--split-b) 58%,var(--split-c));
                        box-shadow:0 22px 56px rgba(8,43,76,.18);
                      }
                      .hero::after{
                        content:"";
                        position:absolute;
                        right:-54px;
                        bottom:-64px;
                        width:170px;
                        height:170px;
                        background:rgba(255,255,255,.16);
                        clip-path:polygon(0 0,100% 50%,0 100%);
                        pointer-events:none;
                      }
                      .logo-icon{
                        width:56px;
                        height:56px;
                        border-radius:18px;
                        font-size:13px;
                      }
                      .eyebrow{
                        max-width:100%;
                        font-size:9px;
                        letter-spacing:.18em;
                      }
                      .hero h1{
                        font-size:clamp(26px,10vw,42px);
                        line-height:.96;
                        letter-spacing:-.05em;
                      }
                      .hero p{
                        max-width:320px;
                        font-size:10px;
                        line-height:1.36;
                      }
                      .portal-grid{
                        width:100%;
                        max-width:500px;
                        justify-self:center;
                        gap:12px;
                        max-height: unset;
                      }
                      .portal-card{
                        min-height:auto;
                        padding:16px 16px 15px;
                        border-radius:20px;
                        box-shadow:0 18px 44px var(--card-shadow);
                      }
                      .portal-card:hover:not(.locked){
                        transform:none;
                      }
                      .card-top{
                        gap:10px;
                        margin-bottom:10px;
                      }
                      .portal-icon{
                        width:42px;
                        height:42px;
                        border-radius:14px;
                      }
                      .portal-icon svg{
                        width:22px;
                        height:22px;
                      }
                      .card-label{
                        font-size:9px;
                        letter-spacing:.13em;
                      }
                      .portal-card h2{
                        font-size:clamp(20px,6vw,26px);
                        margin-bottom:6px;
                      }
                      .portal-card p{
                        font-size:10px;
                        line-height:1.34;
                      }
                      .portal-link{
                        min-height:34px;
                        margin-top:7px;
                        font-size:9px;
                      }
                      .footer-note{
                        position:static;
                        max-width:320px;
                        justify-self:center;
                        text-align:center;
                        font-size:10px;
                        line-height:1.35;
                      }
                    }

                    @media(max-width:520px){
                      .landing-stage{
                        padding:16px 12px 24px;
                        gap:14px;
                      }
                      .hero{
                        padding:16px 12px 18px;
                        border-radius:24px;
                      }
                      .hero h1{
                        font-size:clamp(26px,11vw,38px);
                      }
                      .hero p{
                        font-size:10px;
                      }
                      .portal-card{
                        padding:14px;
                        border-radius:18px;
                      }
                      .portal-card h2{
                        font-size:21px;
                      }
                      .portal-card p{
                        font-size:10px;
                      }
                    }

                    @media(prefers-reduced-motion:reduce){
                      *,
                      *::before,
                      *::after{
                        animation-duration:.001ms!important;
                        animation-iteration-count:1!important;
                        transition-duration:.001ms!important;
                      }
                    }

                    @media (hover:hover) and (pointer:fine){
                      .portal-card{
                        transform-origin:center center;
                        will-change:transform;
                      }
                      .portal-card:hover:not(.locked),
                      .portal-card:focus-within:not(.locked){
                        animation:none;
                        transform:translateY(-10px) scale(1.06)!important;
                        box-shadow:0 42px 110px rgba(8,43,76,.26)!important;
                        z-index:10;
                      }
                      .portal-card:hover:not(.locked)::after,
                      .portal-card:focus-within:not(.locked)::after{
                        transform:scale(1.2);
                      }
                    }

                    @keyframes cardIn{
                      from{opacity:0;filter:blur(2px)}
                      to{opacity:1;filter:blur(0)}
                    }
                    `
        }} />

        <div className="preview-bg" aria-hidden="true"></div>
        <div className="bg-orb orb-a" aria-hidden="true"></div>
        <div className="bg-orb orb-b" aria-hidden="true"></div>
        <div className="bg-orb orb-c" aria-hidden="true"></div>

        <div className="nodes-app-layout min-h-screen w-full grid grid-cols-1 transition-all duration-300 ease-in-out">
          <main className="nexus-preview w-full">
            <section className="landing-stage">
              <section className="hero" aria-labelledby="page-title">
                <div className="logo-icon" aria-label="InsightED">IE</div>

                <p className="eyebrow">Specialized Portals Gateway</p>

                <h1 id="page-title">
                  {activeView === 'services' ? (
                    <>Supplemental<br /><span>Insight<span className="ed-red">ED</span> Services</span></>
                  ) : (
                    <>Welcome to the<br /><span>Insight<span className="ed-red">ED</span> Nexus</span></>
                  )}
                </h1>

                <p>
                  Choose the portal that matches your role, authorized workflow, and official access level.
                </p>
              </section>

              <section className="portal-grid" aria-label="Available portals">
                {currentModules.map((mod, idx) => (
                  <article
                    key={mod.id}
                    className={`portal-card ${mod.cardClass || ''} ${mod.isLocked ? 'locked' : ''}`}
                    onClick={() => {
                      if (mod.onClick) return mod.onClick();
                      if (!mod.isLocked) handleCardClick(mod.route, mod.id);
                    }}
                  >
                    <div className="card-top">
                      <div className="portal-icon" aria-hidden="true">
                        {mod.icon}
                      </div>
                      <p className="card-label">{mod.subtitle}</p>
                    </div>

                    <h2>{mod.title}</h2>
                    <p>{mod.description}</p>

                    {mod.isLocked ? (
                      <a className="portal-link" style={{ color: '#9CA3AF' }} aria-label={`Locked: ${mod.title}`}>
                        Access Restricted <FiLock className="ml-1" aria-hidden="true" />
                      </a>
                    ) : mod.id === 'back' ? (
                      <a className="portal-link" aria-label={`Go back to Nexus`}>
                        Return <span aria-hidden="true">→</span>
                      </a>
                    ) : (
                      <a className="portal-link" aria-label={`Enter ${mod.title} portal`}>
                        Enter portal <span aria-hidden="true">→</span>
                      </a>
                    )}
                  </article>
                ))}
              </section>

              <p className="footer-note hidden lg:block">
                Use your <strong>official credentials</strong>. Contact your administrator if your portal access is unavailable.
              </p>
            </section>
          </main>
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

export default NodesDashboard;
