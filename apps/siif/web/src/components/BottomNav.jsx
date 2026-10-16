import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TbChartBar, TbClipboardList } from 'react-icons/tb';
import { FiSettings, FiGrid, FiLogOut } from 'react-icons/fi';
import { useAuth } from '../../../../school-head/web/src/context/AuthContext';
import { useUnsavedChanges } from '../context/unsavedChanges';
import InsightEdLogoExpanded from '../../../../school-head/web/src/assets/InsightEdLogoApp.png';
import InsightEdLogoCollapsed from '../../../../school-head/web/src/assets/insightedlogo.png';

const BottomNav = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, confirmLogout } = useAuth();
    const { confirmLeave } = useUnsavedChanges();

    // Every way out of the current page asks first when it has unsaved edits
    const goTo = (path) => {
        confirmLeave().then(ok => ok && navigate(path));
    };
    const handleLogout = () => {
        confirmLeave().then(ok => ok && confirmLogout());
    };

    const submissionItem = {
        // Optional plan submission — independent from Utilization
        label: 'SIIF Submission', shortLabel: 'Submission', path: '/siif/forms', icon: TbClipboardList, badge: 'Optional',
    };
    const nexusItem = { label: 'Nexus', path: '/nodes-dashboard', icon: FiGrid, isFab: true };
    const utilizationItem = { label: 'Utilization', path: '/siif/utilization', icon: TbChartBar };
    const settingsItem = { label: 'Settings', path: '/siif/settings', icon: FiSettings };

    const navItems = [submissionItem, nexusItem, utilizationItem, settingsItem];

    // Mobile: two items per side so Nexus sits dead-center; Sign Out fills the fifth slot
    const mobileNavItems = [
        submissionItem,
        utilizationItem,
        nexusItem,
        settingsItem,
        { label: 'Sign Out', icon: FiLogOut, isLogout: true },
    ];

    const isActivePath = (path) => {
        const current = location.pathname.replace(/\/+$/, '') || '/';
        return current === path;
    };

    return (
        <>
            {/* Desktop Collapsible Sidebar (>= 1001px, matching the siif.css desktop layout) */}
            <aside className="hidden min-[1001px]:flex siif-sidebar z-[9500] print:hidden">
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
                                        goTo(item.path);
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
                                    goTo(item.path);
                                }}
                            >
                                {/* shrink-0: a long label must not squeeze the icon to nothing */}
                                <Icon size={20} className="shrink-0" />
                                {/* Badge sits under the label so "SIIF Submission" fits the 260px sidebar */}
                                <span className="flex min-w-0 flex-col leading-tight">
                                    <span className="truncate">{item.label}</span>
                                    {item.badge && (
                                        <span className="siif-text-label mt-0.5 text-[9px] font-bold uppercase tracking-wider text-[#7DD3FC]">
                                            {item.badge}
                                        </span>
                                    )}
                                </span>
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
                        onClick={handleLogout}
                        className="w-full mt-1 flex items-center gap-3 px-3 py-2.5 rounded-xl text-rose-300 hover:text-rose-400 hover:bg-rose-950/20 text-xs font-bold transition-all overflow-hidden border-0 bg-transparent cursor-pointer"
                    >
                        <FiLogOut size={16} className="shrink-0" />
                        <span className="siif-text-label">Secure Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Mobile/Tablet Sticky Bottom Navigation Bar (<= 1000px, e.g. iPad) */}
            {/* Two items per side so Nexus sits dead-center: Submission · Utilization · Nexus · Settings · Sign Out */}
            <div className="min-[1001px]:hidden fixed bottom-0 left-0 right-0 z-[1000] bg-[#08315F] text-white border-t border-white/15 shadow-2xl px-2 py-2 grid grid-cols-5 items-center print:hidden" style={{ height: '64px' }}>
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
                                onClick={() => goTo(item.path)}
                                className="flex flex-col items-center justify-end bg-transparent border-0 cursor-pointer text-slate-300 hover:text-white transition-colors"
                            >
                                <span className="-mt-7 w-12 h-12 rounded-full bg-[#10346B] text-[#FBBF24] flex items-center justify-center border-[3px] border-[#FBBF24] shadow-lg shadow-amber-400/30 ring-4 ring-[#08315F] transition-transform active:scale-95">
                                    <Icon size={20} />
                                </span>
                                <span className="text-[9px] font-bold tracking-tight mt-0.5">{item.label}</span>
                            </button>
                        );
                    }

                    if (item.isLogout) {
                        return (
                            <button
                                key={item.label}
                                type="button"
                                onClick={handleLogout}
                                className="flex flex-col items-center justify-center py-1 bg-transparent border-0 cursor-pointer text-rose-200 hover:text-white transition-all"
                            >
                                <Icon size={19} />
                                <span className="text-[9px] font-bold tracking-tight mt-0.5">{item.label}</span>
                            </button>
                        );
                    }

                    return (
                        <button
                            key={item.label}
                            onClick={() => goTo(item.path)}
                            className={`flex flex-col items-center justify-center py-1 bg-transparent border-0 cursor-pointer transition-all ${isActive ? 'text-[#FBBF24]' : 'text-slate-300 hover:text-white'}`}
                        >
                            <Icon size={20} className={isActive ? 'transform scale-110' : ''} />
                            <span className={`text-[9px] font-bold tracking-tight mt-0.5 ${isActive ? 'font-black text-white' : ''}`}>
                                {item.shortLabel || item.label}
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


