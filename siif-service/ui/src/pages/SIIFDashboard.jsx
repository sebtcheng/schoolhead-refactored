import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    TbMoneybag, TbFileInvoice, TbHistory, 
    TbTrendingUp, TbChecklist, TbChevronRight, TbArrowLeft, TbBellRinging, TbWallet
} from 'react-icons/tb';
import { FiFilter, FiSettings } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

const SIIFDashboard = ({ user }) => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [allocation, setAllocation] = useState({
        allocation_amount: '0.00',
        spent_amount: '0.00',
        remaining_balance: '0.00',
        fiscal_year: new Date().getFullYear()
    });
    const [expenses, setExpenses] = useState([]);

    const formatCurrency = (value) =>
        new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(parseFloat(value) || 0);

    useEffect(() => {
        if (!user?.school_id) { setLoading(false); return; }
        const headers = { 'Authorization': `Bearer ${user.token}` };
        Promise.all([
            fetch(`/api/siif/allocation/${user.school_id}`, { headers }).then(r => r.json()),
            fetch(`/api/siif/expenses/${user.school_id}`, { headers }).then(r => r.json())
        ])
        .then(([allocData, expData]) => {
            setAllocation(allocData);
            setExpenses(Array.isArray(expData) ? expData : []);
        })
        .catch(err => console.error('[SIIF Dashboard] Fetch error:', err))
        .finally(() => setLoading(false));
    }, [user]);

    const spentPercent = allocation.allocation_amount > 0
        ? Math.round((parseFloat(allocation.spent_amount) / parseFloat(allocation.allocation_amount)) * 100)
        : 0;

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-32">

            {/* ── Dashboard Header ───────────────────────────────────── */}
            <div className="bg-deped-blue text-white pt-16 pb-12 px-8 rounded-b-[4rem] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-deped-red/10 rounded-full blur-3xl -ml-24 -mb-24 pointer-events-none" />
                
                <div className="relative z-10 flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20">
                            <TbMoneybag size={24} className="text-deped-gold" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black italic tracking-tight uppercase leading-none">SIIF Nexus</h1>
                            <p className="text-[9px] font-bold text-blue-200 uppercase tracking-widest mt-1">Innovation Control Center</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => navigate('/settings')} className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-all"><FiSettings size={20} /></button>
                    </div>
                </div>

                <div className="relative z-10 mb-8">
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                        <h2 className="text-3xl font-black italic leading-tight">
                            <span className="text-blue-200 not-italic font-bold text-xs block mb-1 uppercase tracking-[0.3em]">
                                {getGreeting()},
                            </span>
                            {user.first_name || 'School Head'}
                        </h2>
                    </motion.div>
                </div>

                {/* Fund Summary Card */}
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-[2.5rem] p-8 shadow-inner relative z-10">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em]">Current Allocation</p>
                        <span className="text-[10px] font-black bg-deped-gold text-deped-blue px-2 py-0.5 rounded-lg">FY {allocation.fiscal_year}</span>
                    </div>
                    <div className="flex items-baseline gap-2 mb-6">
                        <h3 className="text-4xl font-black tracking-tighter italic">
                            {loading ? '---' : formatCurrency(allocation.allocation_amount)}
                        </h3>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-end text-[10px] font-black uppercase tracking-widest">
                            <span className="text-white/40 italic">Fund Utilization</span>
                            <span className="text-deped-gold">{spentPercent}%</span>
                        </div>
                        <div className="h-3 bg-white/10 rounded-full p-0.5">
                            <motion.div 
                                className="h-full rounded-full bg-deped-gold shadow-[0_0_15px_#FCD116]" 
                                initial={{ width: 0 }} 
                                animate={{ width: `${spentPercent}%` }} 
                                transition={{ duration: 1.5, ease: 'easeOut' }} 
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Metrics Grid ───────────────────────────────────────── */}
            <div className="px-6 -mt-8 relative z-20 grid grid-cols-2 gap-4">
                {[
                    { label: 'Utilized', val: allocation.spent_amount, icon: <TbHistory />, color: 'bg-deped-red' },
                    { label: 'Remaining Balance', val: allocation.remaining_balance, icon: <TbWallet />, color: 'bg-emerald-500' }
                ].map((m, i) => (
                    <motion.div 
                        key={m.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + (i * 0.1) }}
                        className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-100 flex flex-col items-center text-center group active:scale-95 transition-transform"
                    >
                        <div className={`w-12 h-12 rounded-2xl ${m.color} text-white flex items-center justify-center mb-4 shadow-lg`}>
                            {React.cloneElement(m.icon, { size: 24 })}
                        </div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{m.label}</p>
                        <p className="text-sm font-black text-slate-800">{loading ? '---' : formatCurrency(m.val)}</p>
                    </motion.div>
                ))}
            </div>

            {/* ── Quick Actions ──────────────────────────────────────── */}
            <div className="px-6 mt-10">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-1.5 h-6 bg-deped-red rounded-full" />
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight italic">Quick Actions</h4>
                </div>
                <div className="grid grid-cols-1 gap-3">
                    <button 
                        onClick={() => navigate('/forms')}
                        className="p-6 bg-white rounded-[2rem] border border-slate-100 shadow-md flex items-center justify-between group active:scale-[0.98] transition-all"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-50 text-deped-blue rounded-2xl flex items-center justify-center group-hover:bg-deped-blue group-hover:text-white transition-colors">
                                <TbChecklist size={24} />
                            </div>
                            <div className="text-left">
                                <p className="font-black text-slate-800 text-sm italic">Draft New Plan</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Start your school innovation proposal</p>
                            </div>
                        </div>
                        <TbChevronRight className="text-slate-300 group-hover:translate-x-1 transition-transform" />
                    </button>

                    <button className="p-6 bg-white rounded-[2rem] border border-slate-100 shadow-md flex items-center justify-between group active:scale-[0.98] transition-all">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-red-50 text-deped-red rounded-2xl flex items-center justify-center group-hover:bg-deped-red group-hover:text-white transition-colors">
                                <TbHistory size={24} />
                            </div>
                            <div className="text-left">
                                <p className="font-black text-slate-800 text-sm italic">Liquidation Ledger</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Track Expenditures</p>
                            </div>
                        </div>
                        <TbChevronRight className="text-slate-300 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>

            {/* ── Recent Transactions ────────────────────────────────── */}
            <div className="px-6 mt-12 pb-12">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-deped-gold rounded-full" />
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight italic">Recent Activity</h4>
                    </div>
                    <button className="p-2 bg-white rounded-xl text-slate-400 border border-slate-100 shadow-sm"><FiFilter /></button>
                </div>

                {expenses.length === 0 ? (
                    <div className="bg-white p-12 rounded-[3rem] text-center border border-dashed border-slate-200">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200 shadow-inner">
                            <TbHistory size={40} />
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Recent Activity</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {expenses.map((exp, i) => (
                            <motion.div 
                                key={exp.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.5 + (i * 0.1) }}
                                className="bg-white p-5 rounded-[2.5rem] border border-slate-100 flex items-center justify-between shadow-sm"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center shadow-inner">
                                        <TbMoneybag size={28} />
                                    </div>
                                    <div className="text-left">
                                        <p className="font-black text-slate-800 text-[13px] italic mb-1">{exp.description}</p>
                                        <span className="text-[9px] bg-blue-50 text-deped-blue px-2 py-0.5 rounded-lg font-black uppercase tracking-widest">{exp.category}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-black text-slate-800 text-sm mb-0.5">{formatCurrency(exp.amount)}</p>
                                    <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest">Verified</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SIIFDashboard;
