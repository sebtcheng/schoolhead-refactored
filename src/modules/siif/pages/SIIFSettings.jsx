import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TbUser, TbBell, TbLock, TbLogout, TbHelp, TbLayoutDashboard } from 'react-icons/tb';

const DEPED_BLUE = '#0038A8';

const SIIFSettings = ({ user }) => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-50 pb-32">
            <div className="bg-[#0038A8] pt-12 pb-20 px-8 rounded-b-[3rem] shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                <h1 className="text-2xl font-black text-white relative z-10">Settings</h1>
                <p className="text-blue-100 text-sm relative z-10">Module Preferences & Account</p>
            </div>

            <div className="px-6 -mt-10 relative z-20 space-y-4">
                <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100 flex items-center gap-4">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-[#0038A8] font-black text-xl">
                        {user.first_name?.charAt(0)}
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-800">{user.first_name}</h2>
                        <p className="text-xs text-slate-500">School ID: {user.school_id}</p>
                    </div>
                </div>

                <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden">
                    {[
                        { icon: <TbUser />, label: 'Profile Information', desc: 'Manage your contact details' },
                        { icon: <TbBell />, label: 'Notifications', desc: 'Submission alerts & deadlines' },
                        { icon: <TbLock />, label: 'Security', desc: 'Passcode & session settings' },
                        { icon: <TbHelp />, label: 'Support', desc: 'SIIF Helpdesk & Guidelines' },
                    ].map((item, i) => (
                        <button key={i} className="w-full p-5 flex items-center gap-4 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 text-left group">
                            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-[#0038A8] transition-colors">
                                {item.icon}
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold text-slate-800">{item.label}</p>
                                <p className="text-[10px] text-slate-400 uppercase tracking-widest">{item.desc}</p>
                            </div>
                        </button>
                    ))}
                </div>

                <button 
                    onClick={() => {
                        navigate('/nodes-dashboard');
                    }}
                    className="w-full p-5 bg-blue-50 text-deped-blue rounded-3xl font-bold flex items-center justify-center gap-2 border border-blue-100"
                >
                    <TbLayoutDashboard size={18} /> Back to Nexus
                </button>
            </div>
        </div>
    );
};

export default SIIFSettings;
