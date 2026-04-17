import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiChevronRight, FiArrowLeft, FiClock, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import { LuClipboardList, LuActivity, LuCircleCheck, LuBuilding } from 'react-icons/lu';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../context/AuthContext';
import BottomNav from './BottomNav';
import PageTransition from '../components/PageTransition';

const STATUS_COLORS = {
    'Ongoing': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: '#3b82f6' },
    'Completed': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: '#10b981' },
    'Not Yet Started': { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200', dot: '#94a3b8' },
    'For Final Inspection': { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', dot: '#8b5cf6' },
    'Under procurement': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: '#f59e0b' },
    'Suspended': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: '#f97316' },
    'Terminated': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: '#ef4444' },
};

const ApprovalBadge = ({ status }) => {
    if (status === 'Pending') return (
        <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-orange-50 text-orange-500 border border-orange-200 animate-pulse">
            <FiClock size={9} /> Pending CO Approval
        </span>
    );
    if (status === 'Approved') return (
        <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
            <FiCheckCircle size={9} /> CO Approved
        </span>
    );
    return null;
};

const formatPeso = (v) => {
    const n = Number(v) || 0;
    if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(1)}M`;
    return `₱${n.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
};

// --- Division Summary Card ---
const DivisionCard = ({ division, stats, onClick }) => {
    const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
    const hasPending = stats.pendingApproval > 0;

    return (
        <div
            onClick={onClick}
            className="bg-white rounded-3xl shadow-sm border border-slate-100 hover:border-[#004A99] hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer active:scale-[0.98] group"
        >
            {/* Card Header */}
            <div className="bg-gradient-to-r from-[#004A99] to-[#0063cc] px-5 py-4 flex justify-between items-center">
                <div className="min-w-0">
                    <p className="text-[9px] font-black text-white/50 uppercase tracking-[0.2em] mb-0.5">Division</p>
                    <h3 className="text-[15px] font-black text-white leading-tight truncate">{division}</h3>
                </div>
                <div className="flex items-center gap-2 ml-3">
                    {hasPending && (
                        <span className="flex items-center gap-1 bg-orange-400 text-white text-[8px] font-black px-2 py-1 rounded-full animate-pulse shrink-0">
                            <FiClock size={9} /> {stats.pendingApproval}
                        </span>
                    )}
                    <FiChevronRight className="text-white/50 group-hover:text-white group-hover:translate-x-1 transition-all shrink-0" size={18} />
                </div>
            </div>

            {/* Stats Grid */}
            <div className="px-5 pt-4 pb-2">
                <div className="grid grid-cols-4 gap-2 mb-4">
                    {[
                        { label: 'Total', value: stats.total, color: 'text-slate-800' },
                        { label: 'Ongoing', value: stats.ongoing, color: 'text-blue-600' },
                        { label: 'Done', value: stats.completed, color: 'text-emerald-600' },
                        { label: 'Pending', value: stats.pending, color: 'text-amber-600' },
                    ].map(({ label, value, color }) => (
                        <div key={label} className="text-center">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
                            <p className={`text-lg font-black ${color}`}>{value}</p>
                        </div>
                    ))}
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-emerald-500 transition-all duration-1000"
                        style={{ width: `${completionRate}%` }}
                    />
                </div>
                <div className="flex justify-between items-center mt-1.5">
                    <p className="text-[9px] font-bold text-slate-400">{formatPeso(stats.allocation)} ABC</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{completionRate}% done</p>
                </div>
            </div>

            {/* Pending Approval Banner */}
            {hasPending && (
                <div className="mx-5 mb-4 flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-2xl px-3 py-2">
                    <FiClock size={12} className="text-orange-400 shrink-0" />
                    <span className="text-[9px] font-black text-orange-600 uppercase tracking-wide">
                        {stats.pendingApproval} project{stats.pendingApproval !== 1 ? 's' : ''} awaiting Central Office approval
                    </span>
                </div>
            )}
        </div>
    );
};

// --- Project List View ---
const ProjectListView = ({ division, projects, onBack, onViewProject }) => {
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('All'); // 'All' | 'Pending' | 'Approved'

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return projects.filter(p => {
            const matchesSearch = !q || p.projectName?.toLowerCase().includes(q) || p.schoolName?.toLowerCase().includes(q);
            const matchesFilter = filter === 'All' ||
                (filter === 'Pending' && p.approvalStatus === 'Pending') ||
                (filter === 'Approved' && p.approvalStatus === 'Approved');
            return matchesSearch && matchesFilter;
        });
    }, [projects, search, filter]);

    const pendingCount = useMemo(() => projects.filter(p => p.approvalStatus === 'Pending').length, [projects]);

    return (
        <div className="min-h-screen bg-slate-50 pb-28">
            {/* Header */}
            <div className="bg-gradient-to-br from-[#004A99] to-[#003366] px-6 pt-12 pb-6 rounded-b-[2.5rem] shadow-xl sticky top-0 z-10">
                <button onClick={onBack} className="text-white/70 hover:text-white mb-3 flex items-center gap-1.5 text-xs font-bold transition-colors">
                    <FiArrowLeft size={15} /> Back to Divisions
                </button>
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <p className="text-[9px] font-black text-white/50 uppercase tracking-[0.2em] mb-0.5">Division Projects</p>
                        <h2 className="text-xl font-black text-white leading-tight">{division}</h2>
                        <p className="text-white/60 text-[10px] mt-0.5 font-bold">{projects.length} total projects</p>
                    </div>
                    {pendingCount > 0 && (
                        <div className="bg-orange-400 text-white text-[9px] font-black px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg shadow-orange-900/20 animate-pulse">
                            <FiClock size={11} /> {pendingCount} pending
                        </div>
                    )}
                </div>
                {/* Search */}
                <div className="relative mb-3">
                    <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" size={14} />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search projects or schools..."
                        className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/30 text-xs px-10 py-2.5 rounded-2xl outline-none focus:bg-white/15 transition-all"
                    />
                </div>
                {/* Filter Pills */}
                <div className="flex gap-2">
                    {['All', 'Pending', 'Approved'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-all ${
                                filter === f
                                    ? 'bg-white text-[#004A99] shadow-sm'
                                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                            }`}
                        >
                            {f === 'Pending' && pendingCount > 0 ? `Pending (${pendingCount})` : f}
                        </button>
                    ))}
                </div>
            </div>

            <div className="px-4 mt-5 space-y-3">
                {filtered.map(p => {
                    const sc = STATUS_COLORS[p.status] || STATUS_COLORS['Not Yet Started'];
                    return (
                        <div
                            key={p.id}
                            onClick={() => onViewProject(p)}
                            className="bg-white rounded-2xl border border-slate-100 hover:border-[#004A99]/30 hover:shadow-md transition-all p-4 cursor-pointer active:scale-[0.98]"
                        >
                            <div className="flex justify-between items-start gap-3 mb-2.5">
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black text-slate-800 leading-snug line-clamp-2 mb-1">{p.projectName}</p>
                                    <p className="text-[10px] font-bold text-slate-400 truncate">{p.schoolName}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg border uppercase tracking-tight ${sc.bg} ${sc.text} ${sc.border}`}>
                                        {p.status || 'Unknown'}
                                    </span>
                                    <ApprovalBadge status={p.approvalStatus} />
                                </div>
                            </div>

                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] font-bold text-slate-400">{p.accomplishmentPercentage || 0}% accomplished</span>
                                <span className="text-[10px] font-black text-[#004A99]">{formatPeso(p.projectAllocation)}</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                        width: `${p.accomplishmentPercentage || 0}%`,
                                        backgroundColor: sc.dot
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}
                {filtered.length === 0 && (
                    <div className="text-center py-20 text-slate-400">
                        <LuClipboardList size={40} className="mx-auto mb-3 opacity-20" />
                        <p className="text-sm font-black text-slate-500">No projects found</p>
                        <p className="text-xs text-slate-400 mt-1">Try adjusting the search or filter</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Main Dashboard ---
const RegionalEngineerDashboard = () => {
    const { user, token } = useAuth();
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedDivision, setSelectedDivision] = useState(null);

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const uid = user?.uid || localStorage.getItem('uid');
                const res = await fetch(`/api/projects?engineer_id=${uid}&limit=all`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });
                const data = await res.json();
                setProjects(Array.isArray(data) ? data : (data.data || []));
            } catch (err) {
                console.error('RegionalEngineerDashboard fetch error:', err);
            } finally {
                setLoading(false);
            }
        };
        if (user) fetchAll();
    }, [user, token]);

    const divisionStats = useMemo(() => {
        const map = {};
        projects.forEach(p => {
            const div = p.division || 'Unknown';
            if (!map[div]) map[div] = { total: 0, ongoing: 0, completed: 0, pending: 0, pendingApproval: 0, allocation: 0, projects: [] };
            map[div].total++;
            map[div].allocation += Number(p.projectAllocation || 0);
            map[div].projects.push(p);
            if (p.status === 'Ongoing' || p.status === 'For Final Inspection') map[div].ongoing++;
            else if (p.status === 'Completed') map[div].completed++;
            else map[div].pending++;
            if (p.approvalStatus === 'Pending') map[div].pendingApproval++;
        });
        return map;
    }, [projects]);

    const filteredDivisions = useMemo(() => {
        const q = search.toLowerCase();
        return Object.entries(divisionStats).filter(([div]) => !q || div.toLowerCase().includes(q));
    }, [divisionStats, search]);

    const chartData = useMemo(() =>
        Object.entries(divisionStats)
            .map(([div, s]) => ({
                name: div.length > 12 ? div.slice(0, 12) + '…' : div,
                Ongoing: s.ongoing,
                Completed: s.completed,
                Pending: s.pending,
            }))
            .slice(0, 10),
        [divisionStats]
    );

    const overallStats = useMemo(() => ({
        divisions: Object.keys(divisionStats).length,
        total: projects.length,
        ongoing: projects.filter(p => p.status === 'Ongoing').length,
        completed: projects.filter(p => p.status === 'Completed').length,
        pendingApproval: projects.filter(p => p.approvalStatus === 'Pending').length,
    }), [projects, divisionStats]);

    if (selectedDivision) {
        return (
            <PageTransition>
                <ProjectListView
                    division={selectedDivision}
                    projects={divisionStats[selectedDivision]?.projects || []}
                    onBack={() => setSelectedDivision(null)}
                    onViewProject={(p) => navigate(`/project-details/${p.id}`)}
                />
                <BottomNav userRole="Regional Engineer" />
            </PageTransition>
        );
    }

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-28">
                {/* Header */}
                <div className="bg-gradient-to-br from-[#004A99] via-[#003366] to-[#001D3D] px-6 pt-12 pb-8 rounded-b-[3rem] shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-300/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4" />
                    <div className="relative z-10">
                        <p className="text-white/50 text-[9px] font-black uppercase tracking-[0.25em] mb-1">Regional Engineering Office</p>
                        <h1 className="text-2xl font-black text-white tracking-tight mb-0.5">Project Monitor</h1>
                        <p className="text-white/50 text-[10px] font-bold">
                            {overallStats.divisions} division{overallStats.divisions !== 1 ? 's' : ''} · {overallStats.total} projects
                        </p>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-3 mt-5">
                            <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-[9px] font-black text-white/50 uppercase tracking-widest">Divisions</p>
                                    <LuBuilding size={14} className="text-white/40" />
                                </div>
                                <p className="text-3xl font-black text-white">{overallStats.divisions}</p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-[9px] font-black text-white/50 uppercase tracking-widest">Total</p>
                                    <LuClipboardList size={14} className="text-white/40" />
                                </div>
                                <p className="text-3xl font-black text-white">{overallStats.total}</p>
                            </div>
                            <div className="bg-blue-500/20 backdrop-blur-sm border border-blue-400/20 rounded-2xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-[9px] font-black text-blue-200/70 uppercase tracking-widest">Ongoing</p>
                                    <LuActivity size={14} className="text-blue-300/50" />
                                </div>
                                <p className="text-3xl font-black text-blue-100">{overallStats.ongoing}</p>
                            </div>
                            <div className={`${overallStats.pendingApproval > 0 ? 'bg-orange-500/20 border-orange-400/20' : 'bg-emerald-500/20 border-emerald-400/20'} backdrop-blur-sm border rounded-2xl p-4`}>
                                <div className="flex items-center justify-between mb-2">
                                    <p className={`text-[9px] font-black uppercase tracking-widest ${overallStats.pendingApproval > 0 ? 'text-orange-200/70' : 'text-emerald-200/70'}`}>
                                        {overallStats.pendingApproval > 0 ? 'Pending CO' : 'Completed'}
                                    </p>
                                    {overallStats.pendingApproval > 0
                                        ? <FiClock size={14} className="text-orange-300/50" />
                                        : <LuCircleCheck size={14} className="text-emerald-300/50" />
                                    }
                                </div>
                                <p className={`text-3xl font-black ${overallStats.pendingApproval > 0 ? 'text-orange-100' : 'text-emerald-100'}`}>
                                    {overallStats.pendingApproval > 0 ? overallStats.pendingApproval : overallStats.completed}
                                </p>
                            </div>
                        </div>

                        {/* Search */}
                        <div className="mt-4 relative">
                            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" size={14} />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search divisions..."
                                className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/30 text-xs px-10 py-3 rounded-2xl outline-none focus:bg-white/15 transition-all"
                            />
                        </div>
                    </div>
                </div>

                <div className="px-4 mt-6 space-y-5 pb-4">
                    {overallStats.pendingApproval > 0 && (
                        <div className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                            <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
                                <FiAlertCircle size={16} className="text-orange-500" />
                            </div>
                            <div>
                                <p className="text-[11px] font-black text-orange-700">
                                    {overallStats.pendingApproval} project{overallStats.pendingApproval !== 1 ? 's' : ''} awaiting Central Office approval
                                </p>
                                <p className="text-[9px] text-orange-500 font-bold mt-0.5">These projects cannot be updated until approved by EFD.</p>
                            </div>
                        </div>
                    )}

                    {chartData.length > 0 && (
                        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Projects by Division</p>
                            <p className="text-[9px] text-slate-400 mb-4">Ongoing · Completed · Pending</p>
                            <ResponsiveContainer width="100%" height={160}>
                                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="name" tick={{ fontSize: 8, fontWeight: 700, fill: '#94a3b8' }} />
                                    <YAxis tick={{ fontSize: 8, fill: '#cbd5e1' }} />
                                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 11, border: '1px solid #e2e8f0' }} />
                                    <Bar dataKey="Ongoing" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={20} />
                                    <Bar dataKey="Completed" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={20} />
                                    <Bar dataKey="Pending" fill="#e2e8f0" radius={[3, 3, 0, 0]} maxBarSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {filteredDivisions.length} Division{filteredDivisions.length !== 1 ? 's' : ''}
                        </p>
                    </div>

                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="bg-white rounded-3xl h-44 animate-pulse border border-slate-100" />
                            ))}
                        </div>
                    ) : filteredDivisions.length === 0 ? (
                        <div className="text-center py-20 text-slate-400">
                            <LuBuilding size={40} className="mx-auto mb-3 opacity-20" />
                            <p className="text-sm font-black text-slate-500">No divisions found</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredDivisions.map(([division, stats]) => (
                                <DivisionCard
                                    key={division}
                                    division={division}
                                    stats={stats}
                                    onClick={() => setSelectedDivision(division)}
                                />
                            ))}
                        </div>
                    )}
                </div>

                <BottomNav userRole="Regional Engineer" />
            </div>
        </PageTransition>
    );
};

export default RegionalEngineerDashboard;
