import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
    FiUsers, 
    FiDatabase, 
    FiActivity, 
    FiLogOut,
    FiMoreVertical,
    FiChevronRight,
    FiShield,
    FiCommand,
    FiLock,
    FiAlertCircle
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import loadingLogo from '../assets/loading.gif';
import PageTransition from '../components/PageTransition';

const CentralOfficeNexus = () => {
    const navigate = useNavigate();
    const { user, logout, confirmLogout } = useAuth();
    const [loading, setLoading] = useState(false);

    // DepEd Branding Colors
    const COLORS = {
        navy: '#0038A8',
        red: '#CE1126',
        yellow: '#FCD116',
        slate: '#f8fafc'
    };

    const modules = [
        {
            id: 'officials',
            title: 'Officials Directory',
            subtitle: 'HUMAN CAPITAL REGISTRY',
            description: 'Centralized database of 3rd level career officials with forensic movement auditing.',
            icon: <FiUsers className="w-8 h-8" />,
            color: 'bg-[#0038A8]',
            textColor: 'text-white',
            badge: 'LIVE',
            route: '/officials'
        },
        {
            id: 'school-data',
            title: 'School Data Hub',
            subtitle: 'INSTITUTIONAL ASSETS',
            description: 'Comprehensive registry of public education institutions and registration statuses.',
            icon: <FiDatabase className="w-8 h-8" />,
            color: 'bg-white',
            textColor: 'text-slate-900',
            route: '/school-management',
            locked: true
        },
        {
            id: 'infrastructure',
            title: 'Infrastructure',
            subtitle: 'FACILITIES & PROJECTS',
            description: 'Monitoring gateway for BEFF projects and public education infrastructure development.',
            icon: <FiActivity className="w-8 h-8" />,
            color: 'bg-white',
            textColor: 'text-slate-900',
            route: '/beff-dashboard',
            locked: true
        }
    ];

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
                <div className="w-32 h-32">
                    <img src={loadingLogo} className="w-full h-full object-contain" alt="Loading" />
                </div>
            </div>
        );
    }

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 pb-32 font-sans text-slate-900 relative overflow-hidden">
                {/* Visual Accents */}
                <div className="absolute top-0 right-0 w-[40vw] h-[40vh] bg-blue-50 rounded-bl-[20rem] -z-0"></div>
                <div className="absolute bottom-[-5%] left-[-5%] w-64 h-64 bg-red-50 rounded-full blur-3xl opacity-60"></div>

                {/* Header Section */}
                <div className="px-8 lg:px-20 pt-16 pb-12 flex justify-between items-start relative z-10">
                    <div className="flex flex-col">
                        <div className="inline-flex items-center gap-2 bg-[#0038A8]/5 px-3 py-1 rounded-full mb-4 w-fit border border-[#0038A8]/10">
                            <FiShield className="text-[#0038A8] w-3 h-3" />
                            <p className="text-[#0038A8] text-[10px] font-black uppercase tracking-widest">Administrative Control</p>
                        </div>
                        <h1 className="text-4xl lg:text-6xl font-black text-[#0038A8] tracking-tight leading-tight italic">
                            Nexus Hub
                        </h1>
                        <p className="text-[12px] font-black text-slate-400 uppercase tracking-[0.4em] mt-2 ml-1">
                            {user?.bureauservice || "Central Office Administration"}
                        </p>
                    </div>
                    
                    <button 
                        onClick={confirmLogout}
                        className="p-5 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-100 rounded-3xl text-slate-400 hover:text-red-500 transition-all active:scale-95 shadow-xl shadow-slate-200/50 flex items-center justify-center group"
                    >
                        <FiLogOut size={28} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>

                {/* Modules Selection Area */}
                <div className="px-6 mt-6 grid grid-cols-1 gap-8 max-w-4xl mx-auto relative z-10">
                    {modules.map((mod, idx) => (
                        <motion.div
                            key={mod.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            onClick={() => !mod.locked && navigate(mod.route)}
                            className={`
                                flex flex-col md:flex-row p-10 rounded-[4rem] cursor-pointer relative transition-all duration-500 active:scale-[0.98] group overflow-hidden border-2
                                ${mod.locked ? 'opacity-60 grayscale-[0.5] border-slate-200 cursor-not-allowed' : ''}
                                ${mod.textColor === 'text-white' 
                                    ? 'bg-[#0038A8] text-white shadow-[0_30px_60px_-15px_rgba(0,56,168,0.3)] border-[#0038A8]' 
                                    : 'bg-white text-slate-900 shadow-[0_20px_50px_rgba(0,0,0,0.05)] border-white hover:border-[#0038A8]/20'}
                            `}
                        >
                            <div className="flex-1">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center transition-all duration-700 group-hover:scale-110 ${mod.textColor === 'text-white' ? 'bg-white/10' : 'bg-blue-50 text-[#0038A8]'}`}>
                                        {React.cloneElement(mod.icon, { className: "w-9 h-9" })}
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-3">
                                            <h4 className="text-3xl font-black italic tracking-tighter leading-none whitespace-nowrap">{mod.title}</h4>
                                            {mod.badge && (
                                                <span className="px-2 py-0.5 bg-[#FCD116] text-[#0038A8] text-[9px] font-black rounded-md leading-none">
                                                    {mod.badge}
                                                </span>
                                            )}
                                            {mod.locked && (
                                                <span className="px-2 py-0.5 bg-slate-900 text-white text-[9px] font-black rounded-md leading-none flex items-center gap-1">
                                                    <FiLock size={8} /> LOCKED
                                                </span>
                                            )}
                                        </div>
                                        <p className={`text-[11px] font-black uppercase tracking-[0.2em] mt-1 ${mod.textColor === 'text-white' ? 'text-blue-100/60' : 'text-slate-400'}`}>
                                            {mod.subtitle}
                                        </p>
                                    </div>
                                </div>
                                <p className={`text-[15px] font-bold leading-relaxed max-w-md ${mod.textColor === 'text-white' ? 'text-blue-100/80' : 'text-slate-500'}`}>
                                    {mod.locked ? 'Access to this system is currently restricted. Please contact the National Administrator for authorization.' : mod.description}
                                </p>
                            </div>

                            <div className="mt-8 md:mt-0 flex items-center justify-end">
                                <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-all group-hover:scale-125 ${mod.textColor === 'text-white' ? 'bg-white/10 text-white' : 'bg-slate-100 text-[#0038A8]'}`}>
                                    {mod.locked ? <FiLock size={32} className="text-slate-400" /> : <FiChevronRight size={32} />}
                                </div>
                            </div>
                            
                            {/* Accent Line */}
                            <div className={`absolute top-0 left-0 w-12 h-full -z-0 opacity-10 group-hover:opacity-20 transition-opacity ${mod.locked ? 'bg-slate-300' : mod.textColor === 'text-white' ? 'bg-red-500' : 'bg-[#FCD116]'}`}></div>
                        </motion.div>
                    ))}
                </div>

                <div className="mt-24 px-8 text-center flex flex-col items-center gap-4">
                    <div className="w-12 h-1 bg-[#0038A8]/10 rounded-full"></div>
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.6em]">
                        DepEd Intellectual Property • 2026 Registry v2
                    </p>
                </div>
            </div>
        </PageTransition>
    );
};

export default CentralOfficeNexus;
