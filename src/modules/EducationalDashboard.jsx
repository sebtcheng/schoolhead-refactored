import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BottomNav from './BottomNav';
import PageTransition from '../components/PageTransition';
import { 
    FiTrendingUp, FiCheckCircle, FiClock, FiFileText, 
    FiUsers, FiHome, FiBarChart2, FiActivity, FiMapPin,
    FiFilter, FiChevronRight, FiSearch, FiAward, FiInfo, FiLayers, FiLogOut, FiExternalLink
} from 'react-icons/fi';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, 
    Tooltip, Legend, ResponsiveContainer, Cell, 
    PieChart, Pie, AreaChart, Area
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

const EducationalDashboard = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    
    // DASHBOARD STATE
    const [data, setData] = useState({ summary: null, breakdown: [] });
    const [loading, setLoading] = useState(true);
    const [groupBy, setGroupBy] = useState('region');
    const [filters, setFilters] = useState({
        region: user?.region || localStorage.getItem('userRegion') || '',
        division: user?.division || localStorage.getItem('userDivision') || '',
        district: '',
        municipality: '',
    });


    useEffect(() => {
        fetchDashboardData();
    }, [groupBy, filters.region, filters.division, filters.district, filters.municipality]);


    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            let url = `/api/monitoring/hrod-dashboard?group_by=${groupBy}`;
            if (filters.region) url += `&region=${encodeURIComponent(filters.region)}`;
            if (filters.division) url += `&division=${encodeURIComponent(filters.division)}`;
            if (filters.district) url += `&district=${encodeURIComponent(filters.district)}`;
            if (filters.municipality) url += `&municipality=${encodeURIComponent(filters.municipality)}`;

            
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                const result = await res.json();
                setData(result);
            }
        } catch (err) {
            console.error("Failed to fetch HROD dashboard data:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleDrillDown = (item) => {
        if (groupBy === 'region') {
            setFilters(prev => ({ ...prev, region: item.group_name }));
            setGroupBy('division');
        } else if (groupBy === 'division') {
            setFilters(prev => ({ ...prev, division: item.group_name }));
            setGroupBy('district');
        } else if (groupBy === 'district') {
            setFilters(prev => ({ ...prev, district: item.group_name }));
            setGroupBy('municipality');
        } else if (groupBy === 'municipality') {
            setFilters(prev => ({ ...prev, municipality: item.group_name }));
            setGroupBy('school');
        } else if (groupBy === 'school') {
            // DEEP LINK TO SCHOOL AUDIT
            sessionStorage.setItem('targetSchoolId', item.school_id);
            sessionStorage.setItem('targetSchoolName', item.group_name);
            sessionStorage.setItem("isViewingAsSuperUser", "true");
            navigate('/school-audit');
        }
    };

    const resetFilters = () => {
        setFilters({ region: '', division: '', district: '', municipality: '' });
        setGroupBy('region');
    };


    // --- OPTIMIZED DATA PREP ---
    const topPerformers = React.useMemo(() => {
        return data.breakdown.slice(0, 5);
    }, [data.breakdown]);

    const chartData = React.useMemo(() => {
        return data.breakdown.slice(0, 15).map(item => ({
            name: item.group_name.length > 12 ? item.group_name.substring(0, 10) + '...' : item.group_name,
            fullName: item.group_name,
            Registered: item.registered_schools,
            Completed: item.unit_completed,
            Total: item.total_schools
        }));
    }, [data.breakdown]);


    return (
        <PageTransition>
            <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 font-sans pb-32">
                
                {/* --- PREMIUM HEADER --- */}
                <div className="bg-slate-900 pt-16 pb-24 px-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/20 rounded-full blur-[100px] -mr-48 -mt-24 select-none pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-[80px] -ml-32 -mb-24 select-none pointer-events-none"></div>
                    
                    <div className="relative z-10 max-w-4xl mx-auto">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
                                    <span className="text-blue-400 text-[10px] font-black uppercase tracking-[0.3em]">Operational Nexus</span>
                                </div>
                                <h1 className="text-3xl font-black text-white tracking-tight leading-none italic uppercase">HROD Dashboard</h1>
                                <p className="text-slate-400 text-xs font-bold mt-2 flex items-center gap-2">
                                    <FiActivity className="text-blue-500" />
                                    Educational Monitoring & Alignment
                                </p>
                            </div>
                            <div className="text-right flex items-center gap-4">
                                <button 
                                    onClick={() => {
                                        if (window.confirm("Are you sure you want to log out?")) {
                                            logout();
                                            navigate('/login');
                                        }
                                    }}
                                    className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 text-white hover:bg-red-500/20 hover:border-red-500/50 transition-all shadow-inner"
                                >
                                    <FiLogOut size={20} />
                                </button>
                                <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                                    <span className="text-white text-[10px] font-black uppercase tracking-wider">Live System Sync</span>
                                </div>
                            </div>
                        </div>

                        {/* --- OVERALL STATS RIBBON --- */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {[
                                { label: 'Total Schools', val: data.summary?.total_schools, icon: FiHome, color: 'text-blue-400', bg: 'bg-white/5' },
                                { label: 'Registered', val: data.summary?.registered_schools, icon: FiCheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                                { label: 'Unit 1-9 Done', val: data.summary?.unit_completed, icon: FiLayers, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                                { label: 'ESF7 Staged', val: data.summary?.esf7_completed, icon: FiFileText, color: 'text-amber-400', bg: 'bg-amber-500/10' }
                            ].map((kpi, i) => (
                                <motion.div 
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    key={kpi.label}
                                    className={`${kpi.bg} backdrop-blur-md border border-white/10 p-5 rounded-[2.5rem] shadow-xl`}
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <kpi.icon className={kpi.color} size={18} />
                                        <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center">
                                            <FiChevronRight className="text-white/20" size={12} />
                                        </div>
                                    </div>
                                    <h3 className="text-2xl font-black text-white tracking-tighter">{kpi.val?.toLocaleString() || '0'}</h3>
                                    <p className="text-white/40 text-[9px] font-black uppercase tracking-widest mt-1">{kpi.label}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* --- MAIN CONTENT AREA --- */}
                <div className="max-w-4xl mx-auto px-6 -mt-12 relative z-20 space-y-8">
                    
                    {/* --- FILTER & GROUPING BAR --- */}
                    <div className="bg-white dark:bg-slate-900 p-3 rounded-[2rem] shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2 pl-2">
                            <FiFilter className="text-blue-500" />
                            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                                {['region', 'division', 'district', 'municipality'].map(mode => (
                                    <button
                                        key={mode}
                                        onClick={() => setGroupBy(mode)}
                                        className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${groupBy === mode ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                    >
                                        {mode}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <button 
                            onClick={resetFilters}
                            className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all mr-1"
                        >
                            Reset
                        </button>
                    </div>

                    {/* --- DRILL-DOWN PATH (Breadcrumbs) --- */}
                    {(filters.region || filters.division || filters.district) && (
                        <div className="flex items-center gap-2 px-2 overflow-x-auto no-scrollbar">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Path:</span>
                            <div className="flex items-center gap-2 flex-nowrap">
                                <span className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full text-[10px] font-black text-blue-600 whitespace-nowrap uppercase italic">Philippines</span>
                                {filters.region && (
                                    <>
                                        <FiChevronRight className="text-slate-300 shrink-0" size={12} />
                                        <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-[10px] font-black whitespace-nowrap uppercase italic">{filters.region}</span>
                                    </>
                                )}
                                {filters.division && (
                                    <>
                                        <FiChevronRight className="text-slate-300 shrink-0" size={12} />
                                        <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-[10px] font-black whitespace-nowrap uppercase italic">{filters.division}</span>
                                    </>
                                )}
                                {filters.district && (
                                    <>
                                        <FiChevronRight className="text-slate-300 shrink-0" size={12} />
                                        <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-[10px] font-black whitespace-nowrap uppercase italic">{filters.district}</span>
                                    </>
                                )}
                                {filters.municipality && (
                                    <>
                                        <FiChevronRight className="text-slate-300 shrink-0" size={12} />
                                        <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-[10px] font-black whitespace-nowrap uppercase italic">{filters.municipality}</span>
                                    </>
                                )}

                            </div>
                        </div>
                    )}

                    {/* --- MAIN CHART SECTION --- */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2">
                            <motion.div 
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 h-full"
                            >
                                <div className="flex justify-between items-center mb-8">
                                    <div>
                                        <h2 className="text-xl font-black text-slate-800 dark:text-white italic tracking-tighter uppercase leading-none">Completion Trends</h2>
                                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Breakdown by {groupBy}</p>
                                    </div>
                                    <FiActivity className="text-blue-500" size={24} />
                                </div>
                                
                                <div className="h-[300px] w-full relative group">
                                    <AnimatePresence mode="wait">
                                        {loading ? (
                                            <motion.div 
                                                key="loading"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 backdrop-blur-[2px] rounded-2xl"
                                            >
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest animate-pulse">Syncing Level...</span>
                                                </div>
                                            </motion.div>
                                        ) : null}
                                    </AnimatePresence>

                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
                                            <XAxis 
                                                dataKey="name" 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fontSize: 9, fontWeight: 900, fill: '#94A3B8' }} 
                                                dy={10}
                                            />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#94A3B8' }} />
                                            <Tooltip 
                                                cursor={{ fill: '#F1F5F9' }}
                                                contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)', fontWeight: 900, fontSize: '10px' }} 
                                            />
                                            <Bar dataKey="Registered" fill="#3B82F6" radius={[6, 6, 0, 0]} barSize={12} />
                                            <Bar dataKey="Completed" fill="#10B981" radius={[6, 6, 0, 0]} barSize={12} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>

                            </motion.div>
                        </div>

                        {/* Top Performers (Doing Good) */}
                        <div className="lg:col-span-1">
                            <motion.div 
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-xl h-full flex flex-col"
                            >
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="w-10 h-10 bg-blue-500/20 rounded-2xl flex items-center justify-center text-blue-400 shadow-inner">
                                        <FiAward size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-white font-black text-sm uppercase italic tracking-tighter leading-none">Top Performers</h3>
                                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Highest Completion</p>
                                    </div>
                                </div>

                                <div className="space-y-4 flex-1">
                                    {topPerformers.map((item, i) => (
                                        <div key={item.group_name} className="bg-white/5 border border-white/5 p-4 rounded-2xl flex items-center justify-between hover:bg-white/10 transition-colors group cursor-pointer" onClick={() => handleDrillDown(item)}>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs font-black text-slate-600 italic">0{i+1}</span>
                                                <div className="space-y-0.5">
                                                    <p className="text-[10px] font-black text-white italic truncate max-w-[120px] uppercase">{item.group_name}</p>
                                                    <p className="text-[8px] font-bold text-slate-500 uppercase">{item.unit_completed} / {item.total_schools} Schools</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[11px] font-black text-emerald-400">{item.progress}%</span>
                                            </div>
                                        </div>
                                    ))}
                                    {topPerformers.length === 0 && (
                                        <div className="text-center py-12 space-y-3">
                                            <FiInfo className="mx-auto text-slate-700" size={32} />
                                            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Inventorying Data...</p>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="mt-8 pt-6 border-t border-white/5">
                                    <div className="flex items-center gap-2 text-indigo-400">
                                        <FiTrendingUp size={14} />
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em]">Overall Avg: {data.summary?.total_schools > 0 ? Math.round((data.summary?.unit_completed / data.summary?.total_schools) * 100) : 0}%</span>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>

                    {/* --- BREAKDOWN LIST / TABLE --- */}
                    <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 overflow-hidden">
                        <div className="px-8 py-6 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                            <div>
                                <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase italic tracking-tighter">Detailed Breakdown</h3>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Inter-level alignment statistics</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Sort by:</span>
                                <div className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1 text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase italic">Completion Rate</div>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50/30 dark:bg-slate-900">
                                    <tr>
                                        <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">{groupBy} Name</th>
                                        <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Total Schools</th>
                                        <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Unit 1-9 (%)</th>
                                        <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">ESF7 Staked (%)</th>
                                        <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">NSPP Alignment</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                    {data.breakdown.map((item) => (
                                        <tr 
                                            key={item.school_id || item.group_name} 
                                            className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors group cursor-pointer"
                                            onClick={() => handleDrillDown(item)}
                                        >
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 font-black text-xs uppercase italic">
                                                        {groupBy === 'school' ? <FiActivity /> : item.group_name.charAt(0)}
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-[13px] font-black text-slate-800 dark:text-white uppercase leading-none">{item.group_name}</p>
                                                            {groupBy === 'school' && <FiExternalLink className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" size={12} />}
                                                        </div>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                            {groupBy === 'school' ? `ID: ${item.school_id}` : `Registered: ${item.registered_schools}`}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-8 py-6 text-center">
                                                <span className="text-sm font-black text-slate-700 dark:text-slate-300 italic">{item.total_schools}</span>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between items-center text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                                        <span>{item.progress}%</span>
                                                        <span>{item.unit_completed} Schools</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                                                        <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${item.progress}%` }}></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg text-xs font-black italic">
                                                    <FiFileText size={12} />
                                                    {item.total_schools > 0 ? Math.round((item.esf7_completed / item.total_schools) * 100) : 0}%
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                <span className="text-[10px] font-black text-slate-300 dark:text-slate-700 uppercase italic tracking-widest">Coming Soon</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        
                        <div className="p-8 bg-slate-50 dark:bg-slate-800/50 flex flex-col md:flex-row items-center justify-between gap-4">
                             <div className="flex items-center gap-4">
                                 <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                     <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Unit 1-9 Done
                                 </div>
                                 <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                     <div className="w-2 h-2 rounded-full bg-amber-500"></div> ESF7 Records
                                 </div>
                             </div>
                             <p className="text-[10px] font-bold text-slate-400 italic">Values based on validated submissions from school-level portals.</p>
                        </div>
                    </div>
                </div>

                {/* Removed BottomNav as requested for National Portal view */}
            </div>
        </PageTransition>
    );
};


export default EducationalDashboard;
