import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TbLayoutDashboard, TbClipboardList, TbChartBar } from 'react-icons/tb';
import { FiSettings, FiGrid } from 'react-icons/fi';
import { TbBook } from 'react-icons/tb';

const BottomNav = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Insert Nexus in the middle for mobile layout
    const navItems = [
        { label: 'Dashboard', path: '/siif', icon: TbLayoutDashboard },
        { label: 'Forms', path: '/siif/forms', icon: TbClipboardList },
        { label: 'Nexus', path: '/nodes-dashboard', icon: FiGrid, isFab: true },
        { label: 'Utilization', path: '/siif/utilization', icon: TbChartBar },
        { label: 'Settings', path: '/siif/settings', icon: FiSettings },
    ];

    return (
        <aside className="siif-sidebar z-[1000]">
            {/* Desktop Brand Block */}
            <div className="siif-brand">
                <TbBook size={24} className="text-siif-blue" />
                <span className="siif-brand-text">
                    <span className="siif-brand-insight">Insight</span>
                    <span className="siif-brand-ed">ED</span>
                </span>
            </div>

            <nav className="siif-nav">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path || (item.path === '/siif' && location.pathname === '/siif/');
                    const Icon = item.icon;

                    if (item.isFab) {
                        return (
                            <a
                                key={item.label}
                                href="#"
                                className="siif-mobile-fab"
                                onClick={(e) => {
                                    e.preventDefault();
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
                                navigate(item.path);
                            }}
                        >
                            <Icon size={20} />
                            <span>{item.label}</span>
                        </a>
                    );
                })}
            </nav>
        </aside>
    );
};

export default BottomNav;


