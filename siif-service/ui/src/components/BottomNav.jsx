import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TbLayoutDashboard, TbFileText, TbTrendingUp, TbSettings } from 'react-icons/tb';

const DEPED_BLUE = '#0038A8';

const BottomNav = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const items = [
        { id: 'dashboard',   label: 'Home',        path: '/',            icon: <TbLayoutDashboard size={22} /> },
        { id: 'forms',       label: 'Forms',       path: '/forms',       icon: <TbFileText size={22} /> },
        { id: 'utilization', label: 'Utilization', path: '/utilization', icon: <TbTrendingUp size={22} /> },
        { id: 'settings',    label: 'Settings',    path: '/settings',    icon: <TbSettings size={22} /> },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 h-20 bg-white/90 backdrop-blur-xl border-t border-slate-100 flex items-center justify-around px-6 z-[100] shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
            {items.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                    <button
                        key={item.id}
                        onClick={() => navigate(item.path)}
                        className="relative flex flex-col items-center gap-1 group"
                    >
                        <div className={`transition-all duration-300 ${isActive ? 'text-[#0038A8] scale-110' : 'text-slate-400 group-hover:text-slate-600'}`}>
                            {item.icon}
                        </div>
                        <span className={`text-[10px] font-bold transition-all duration-300 ${isActive ? 'text-[#0038A8]' : 'text-slate-400'}`}>
                            {item.label}
                        </span>
                        {isActive && (
                            <motion.div
                                layoutId="activeNav"
                                className="absolute -top-3 w-8 h-1 bg-[#0038A8] rounded-full"
                                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            />
                        )}
                    </button>
                );
            })}
        </div>
    );
};

export default BottomNav;
