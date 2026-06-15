import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TbLayoutDashboard, TbFileText, TbTrendingUp, TbUser } from 'react-icons/tb';
import { FiGrid } from "react-icons/fi";

const DEPED_BLUE = '#0038A8';

const BottomNav = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const items = [
        { id: 'dashboard',   label: 'Home',        path: '/siif/',           icon: <TbLayoutDashboard size={22} /> },
        { id: 'forms',       label: 'Forms',       path: '/siif/forms',      icon: <TbFileText size={22} /> },
        { id: 'utilization', label: 'Utilization', path: '/siif/utilization', icon: <TbTrendingUp size={22} /> },
        { id: 'settings',    label: 'Settings',    path: '/siif/settings',   icon: <TbUser size={22} /> },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[1000] print:hidden">
            {/* Center FAB */}
            <div className="absolute left-1/2 -top-8 -translate-x-1/2 z-[1001]">
                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => navigate('/nodes-dashboard')}
                    className="w-16 h-16 bg-[#10346B] text-white rounded-full flex items-center justify-center shadow-xl shadow-blue-900/40 border-4 border-white"
                    title="Back to Nexus"
                >
                    <FiGrid size={32} />
                </motion.button>
            </div>

            <div className="h-20 bg-white/90 backdrop-blur-xl border-t border-slate-100 flex items-center px-4 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
                <div className="w-full flex justify-between items-center max-w-md mx-auto">
                    {items.map((item, idx) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <React.Fragment key={item.id}>
                                {idx === 2 && <div className="w-16" />} {/* Gap for FAB */}
                                <button
                                    onClick={() => navigate(item.path)}
                                    className="flex-1 flex flex-col items-center justify-center h-full group relative gap-1 bg-transparent border-none"
                                >
                                    <div className={`transition-all duration-300 ${isActive ? 'text-[#0038A8] scale-110' : 'text-slate-400 group-hover:text-slate-600'}`}>
                                        {item.icon}
                                    </div>
                                    <span className={`text-[10px] font-bold transition-all duration-300 ${isActive ? 'text-[#0038A8]' : 'text-slate-400'}`}>
                                        {item.label}
                                    </span>
                                    {isActive && (
                                        <motion.div
                                            layoutId="activeNavSIIF"
                                            className="absolute -top-3 w-8 h-1 bg-[#0038A8] rounded-full"
                                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                        />
                                    )}
                                </button>
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default BottomNav;
