import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TbLayoutDashboard, TbChartBar, TbClipboardList } from 'react-icons/tb';
import { FiSettings, FiGrid, FiLogOut } from 'react-icons/fi';
import { useAuth } from '../../../../school-head/web/src/context/AuthContext';
import InsightEdLogoExpanded from '../../../../school-head/web/src/assets/InsightEdLogoApp.png';
import InsightEdLogoCollapsed from '../../../../school-head/web/src/assets/insightedlogo.png';

const BottomNav = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, confirmLogout } = useAuth();

    // Insert Nexus in the middle for mobile layout
    const navItems = [
        { label: 'Dashboard', path: '/siif/dashboard', icon: TbLayoutDashboard },
        // Optional plan submission — independent from Utilization
        { label: 'Forms', path: '/siif/forms', icon: TbClipboardList, badge: 'Optional' },
        { label: 'Nexus', path: '/nodes-dashboard', icon: FiGrid, isFab: true },
        { label: 'Utilization', path: '/siif/utilization', icon: TbChartBar },
        { label: 'Settings', path: '/siif/settings', icon: FiSettings },
    ];

    // Same order on mobile so Nexus sits dead-center; Sign Out lives in Settings
    const mobileNavItems = navItems;

    const isActivePath = (path) => {
        const current = location.pathname.replace(/\/+$/, '') || '/';
        return current === path;
    };

    return (
        <>
            {/* Desktop Collapsible Sidebar (>= 768px / md) */}
            <aside className="hidden md:flex siif-sidebar z-[9500] print:hidden">
                <div className="siif-brand">
                    <img
                        src={InsightEdLogoCollapsed}
                        alt="InsightEd Logo Icon"
                        className="siif-brand-logo-collapsed object-contain w-10 h-10"
                    />
                    <img
                        src={InsightEdLogoExpanded}
                        alt="InsightEd Logo"
                        className="siif-brand-logo object-contain"
                        style={{ width: '10rem', height: '4rem' }}
                    />
                </div>

                <nav className="siif-nav">
                    {navItems.map((item) => {
                        const isActive = isActivePath(item.path);
                        const Icon = item.icon;

                        if (item.isFab) {
                            return (
                                <a
                                    key={item.label}
                                    href="#"
                                    className="siif-mobile-fab"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.currentTarget.blur();
                                        navigate(item.path);
                                    }}
                                >
                                    <div className="w-10 h-10 bg-[#10346B] text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white/20">
                                        <Icon size={20} />
                                    </div>
                                    <span className="mt-1">{item.label}</span>
                                </a>
                            );
                        }

                        return (
                            <a
                                key={item.label}
                                href="#"
                                className={isActive ? 'active' : ''}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.currentTarget.blur();
                                    navigate(item.path);
                                }}
                            >
                                <Icon size={20} />
                                <span>{item.label}</span>
                                {item.badge && (
                                    <span className="siif-text-label ml-auto text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-white/10 text-[#7DD3FC]">
                                        {item.badge}
                                    </span>
                                )}
                            </a>
                        );
                    })}
                </nav>

                <div className="siif-sidebar-footer mt-auto pt-4 border-t border-white/10 flex flex-col gap-2 transition-all duration-300 w-full">
                    <div className="px-2 siif-text-label overflow-hidden">
                        <p className="text-xs font-bold truncate text-[#7DD3FC]">SCHOOL HEAD</p>
                        <p className="text-[10px] uppercase tracking-wider text-white/50 truncate">{user?.school_name || "SIIF Hub"}</p>
                    </div>

                    <button
                        onClick={confirmLogout}
                        className="w-full mt-1 flex items-center gap-3 px-3 py-2.5 rounded-xl text-rose-300 hover:text-rose-400 hover:bg-rose-950/20 text-xs font-bold transition-all overflow-hidden border-0 bg-transparent cursor-pointer"
                    >
                        <FiLogOut size={16} className="shrink-0" />
                        <span className="siif-text-label">Secure Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Mobile Sticky Bottom Navigation Bar (< 768px / md) */}
            {/* Two items per side so Nexus sits dead-center: Dashboard · Forms · Nexus · Utilization · Settings */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-[1000] bg-[#08315F] text-white border-t border-white/15 shadow-2xl px-2 py-2 grid grid-cols-5 items-center print:hidden" style={{ height: '64px' }}>
                {mobileNavItems.map((item) => {
                    const isActive = isActivePath(item.path);
                    const Icon = item.icon;

                    // Nexus: raised center button — the only way back to the portal on mobile
                    if (item.isFab) {
                        return (
                            <button
                                key={item.label}
                                type="button"
                                aria-label="Back to Nexus Portal"
                                onClick={() => navigate(item.path)}
                                className="flex flex-col items-center justify-end bg-transparent border-0 cursor-pointer text-slate-300 hover:text-white transition-colors"
                            >
                                <span className="-mt-7 w-12 h-12 rounded-full bg-[#10346B] text-[#FBBF24] flex items-center justify-center border-[3px] border-[#FBBF24] shadow-lg shadow-amber-400/30 ring-4 ring-[#08315F] transition-transform active:scale-95">
                                    <Icon size={20} />
                                </span>
                                <span className="text-[9px] font-bold tracking-tight mt-0.5">{item.label}</span>
                            </button>
                        );
                    }

                    return (
                        <button
                            key={item.label}
                            onClick={() => navigate(item.path)}
                            className={`flex flex-col items-center justify-center py-1 bg-transparent border-0 cursor-pointer transition-all ${isActive ? 'text-[#FBBF24]' : 'text-slate-300 hover:text-white'}`}
                        >
                            <Icon size={20} className={isActive ? 'transform scale-110' : ''} />
                            <span className={`text-[9px] font-bold tracking-tight mt-0.5 ${isActive ? 'font-black text-white' : ''}`}>
                                {item.label}
                            </span>
                            {isActive && <div className="w-1.5 h-1.5 bg-[#FBBF24] rounded-full mt-0.5" />}
                        </button>
                    );
                })}
            </div>
        </>
    );
};

export default BottomNav;


