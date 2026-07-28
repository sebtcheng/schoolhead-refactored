import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiHome, FiSettings, FiLogOut } from 'react-icons/fi';
import { TbCloudSearch, TbSchool } from 'react-icons/tb';
import { LuCompass } from 'react-icons/lu';
import { useAuth } from '../context/AuthContext';
import InsightEdLogoExpanded from '../assets/InsightEdLogoApp.png';
import InsightEdLogoCollapsed from '../assets/insightedlogo.png';

const SharedNexusSidebar = ({ activeTab }) => {
  const navigate = useNavigate();
  const { user, confirmLogout } = useAuth();
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);

  const navItems = [
    { label: 'Home', icon: <FiHome size={18} />, path: '/nodes-dashboard' },
    { label: 'CLOUD', icon: <TbCloudSearch size={18} />, path: '/my-activity' },
    { label: 'Units', icon: <LuCompass size={18} />, path: '/modular-dashboard' },
    { label: 'Guide', icon: <TbSchool size={18} />, path: '/guide/school-head' },
    { label: 'Settings', icon: <FiSettings size={18} />, path: '/profile' }
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          .nodes-sidebar {
            width: 80px;
            position: fixed;
            top: 0;
            bottom: 0;
            left: 0;
            color: white;
            padding: 24px 8px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 28px;
            background: linear-gradient(180deg, color-mix(in srgb, #06345F 92%, transparent), color-mix(in srgb, #0A6FA6 72%, #06345F 28%));
            border-right: 1px solid rgba(255, 255, 255, 0.24);
            box-shadow: 18px 0 42px rgba(11, 31, 77, 0.16);
            overflow: hidden;
            transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), padding 0.3s cubic-bezier(0.4, 0, 0.2, 1), align-items 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            z-index: 100 !important;
          }

          @media (max-width: 1023px) {
            .nodes-sidebar {
              display: none !important;
            }
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
              inset 0 -3px 0 #FDBA22,
              0 0 18px color-mix(in srgb, #0A6FA6 26%, transparent) !important;
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
        `
      }} />

      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex nodes-sidebar text-white ${isSidebarHovered ? 'sidebar-expanded' : ''}`}
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
      >
        <div className="nodes-brand">
          <img
            src={InsightEdLogoExpanded}
            alt="InsightED Logo"
            className="logo-collapsed object-contain w-10 h-10"
          />
          <img
            src={InsightEdLogoCollapsed}
            alt="InsightED Logo"
            className="logo-expanded object-contain"
            style={{ width: '10rem', height: '4rem' }}
          />
        </div>

        <nav className="nodes-nav">
          {navItems.map((item) => {
            const isActive = activeTab === item.label;
            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className={isActive ? 'active' : ''}
              >
                <span className={isActive ? 'text-[#FBBF24]' : 'text-inherit'}>{item.icon}</span>
                <span className="sidebar-text-label select-none">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto pt-4 border-t border-white/10 flex flex-col gap-2 transition-all duration-300 w-full">
          <div className="px-2 sidebar-text-label overflow-hidden">
            <p className="text-xs font-bold truncate text-[#7DD3FC]">SCHOOL HEAD</p>
            <p className="text-[10px] uppercase tracking-wider text-white/50 truncate">{user?.school_name || "Nexus Dashboard"}</p>
          </div>
          <button
            onClick={confirmLogout}
            className="w-full mt-2 flex items-center gap-3 px-3 py-2.5 rounded-xl text-rose-300 hover:text-rose-400 hover:bg-rose-950/20 text-xs font-bold transition-all overflow-hidden"
          >
            <FiLogOut size={16} className="shrink-0" />
            <span className="sidebar-text-label">Secure Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <footer className="lg:hidden fixed left-0 right-0 bottom-0 h-16 sm:h-[72px] z-40 px-2.5 pb-[max(6px,env(safe-area-inset-bottom))] pt-1.5 border-t border-white/46 shadow-[-18px_0_44px_rgba(11,31,77,0.26)] bg-gradient-to-r from-[#06335a] via-[#075985] to-[#0284C7] overflow-hidden">
        <div className="absolute top-0 left-[18%] w-24 h-6 bg-gradient-to-b from-[#FBBF24]/20 to-transparent blur-sm pointer-events-none" />
        <div className="absolute top-0 right-[20%] w-20 h-6 bg-gradient-to-b from-[#B91C1C]/15 to-transparent blur-sm pointer-events-none" />

        <div className="grid grid-cols-5 gap-1 max-w-[760px] mx-auto w-full relative z-10">
          {navItems.map((item) => {
            const isActive = activeTab === item.label;
            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center justify-center gap-0.5 h-12 px-1 rounded-xl transition-all ${isActive
                  ? 'bg-gradient-to-b from-white/18 to-white/10 text-white border border-white/28 shadow-[inset_0_-3px_0_#FBBF24,0_0_16px_rgba(125,211,252,0.24)]'
                  : 'text-white/82'
                  }`}
              >
                <div className={isActive ? 'text-[#FBBF24]' : 'text-inherit'}>
                  {React.cloneElement(item.icon, { size: 16 })}
                </div>
                <span className="text-[8px] font-bold tracking-tight leading-none text-center block">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </footer>
    </>
  );
};

export default SharedNexusSidebar;
