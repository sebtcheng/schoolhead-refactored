import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    FiArrowLeft, FiSearch, FiShield, FiExternalLink, 
    FiCheckCircle, FiAlertCircle, FiClock, FiDatabase,
    FiXCircle, FiActivity, FiLoader 
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

const PageTransition = ({ children }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 1.02, y: -10 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
        {children}
    </motion.div>
);

const ESF7Review = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [stats, setStats] = useState({
        total_registered: 0,
        pending_sdo: 0,
        verified: 0,
        rejected: 0,
        missing_esf7: 0
    });
    const [allSchools, setAllSchools] = useState([]);
    const [filteredSchools, setFilteredSchools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('queue'); // queue, verified, missing, all
    const [selectedSchool, setSelectedSchool] = useState(null);
    const [schoolDetail, setSchoolDetail] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        if (user) {
            fetchStats();
            fetchSchools();
        }
    }, [user]);

    useEffect(() => {
        let list = [...allSchools];
        
        // Tab Filtering
        if (activeTab === 'queue') list = list.filter(s => s.status === 'PENDING_SDO' || s.status === 'QUEUED');
        else if (activeTab === 'verified') list = list.filter(s => s.status === 'VERIFIED');
        else if (activeTab === 'missing') list = list.filter(s => s.status === 'NOT_STARTED');

        // Search Filtering
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            list = list.filter(s => 
                s.school_id.toLowerCase().includes(term) || 
                s.school_name.toLowerCase().includes(term)
            );
        }

        setFilteredSchools(list);
    }, [searchTerm, activeTab, allSchools]);

    const fetchStats = async () => {
        try {
            const query = new URLSearchParams({
                region: user?.region || 'All',
                division: user?.division || 'All Divisions'
            }).toString();
            const res = await fetch(`/api/esf7/stats?${query}`);
            const data = await res.json();
            if (data.success) setStats(data.data);
        } catch (err) { console.error(err); }
    };

    const fetchSchools = async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams({
                region: user?.region || 'All',
                division: user?.division || 'All Divisions'
            }).toString();
            const res = await fetch(`/api/esf7/all-schools?${query}`);
            const data = await res.json();
            if (data.success) {
                setAllSchools(data.data);
                setFilteredSchools(data.data.filter(s => s.status === 'PENDING_SDO' || s.status === 'QUEUED'));
            }
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    const handleViewDetails = async (school) => {
        setSelectedSchool(school.school_id);
        setActionLoading(true);
        try {
            const res = await fetch(`/api/esf7/link-detail/${school.school_id}`);
            const data = await res.json();
            if (data.success) setSchoolDetail(data.data);
        } catch (err) { console.error(err); }
        setActionLoading(false);
    };

    const handleEnqueue = async () => {
        setActionLoading(true);
        try {
            const res = await fetch('/api/esf7/enqueue-harvest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ school_id: selectedSchool })
            });
            const data = await res.json();
            if (data.success) {
                await fetchStats();
                await fetchSchools();
                // Update local detail status
                setSchoolDetail(prev => ({ ...prev, status: 'QUEUED' }));
            }
        } catch (err) { console.error(err); }
        setActionLoading(false);
    };

    const handleRejectLink = async () => {
        if (!window.confirm("Are you sure you want to REJECT this link submission? The school will have to re-submit.")) return;
        setActionLoading(true);
        try {
            const res = await fetch('/api/esf7/reject-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ school_id: selectedSchool })
            });
            const data = await res.json();
            if (data.success) {
                setSelectedSchool(null);
                await fetchStats();
                await fetchSchools();
            }
        } catch (err) { console.error(err); }
        setActionLoading(false);
    };

    if (!user || (loading && !allSchools.length)) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
                <FiLoader className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {loading ? "Loading Ingestion Queue" : "Verifying SDO Credentials..."}
                </p>
            </div>
        );
    }

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 pb-20">
                <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
                    <div className="flex items-center gap-4">
                        <button onClick={() => selectedSchool ? setSelectedSchool(null) : navigate('/monitoring-dashboard')} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                            <FiArrowLeft className="w-6 h-6 text-slate-600" />
                        </button>
                        <div>
                            <h1 className="text-xl font-black text-slate-800 tracking-tight leading-none uppercase italic">National ESF7 Review</h1>
                            <p className="text-[10px] font-bold text-blue-500 mt-1 uppercase tracking-widest leading-none italic underline decoration-blue-200">
                                {user?.division || "National"} Scale Ingestion Hub
                            </p>
                        </div>
                    </div>
                </header>

                <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
                    {!selectedSchool ? (
                        <>
                            {/* Stats Summary */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <StatCard label="Awaiting Review" value={stats.pending_sdo} icon={<FiActivity />} color="bg-amber-500" isActive={activeTab === 'queue'} onClick={() => setActiveTab('queue')} />
                                <StatCard label="Fully Harvested" value={stats.verified} icon={<FiCheckCircle />} color="bg-emerald-500" isActive={activeTab === 'verified'} onClick={() => setActiveTab('verified')} />
                                <StatCard label="Rejected" value={stats.rejected} icon={<FiXCircle />} color="bg-rose-500" />
                                <StatCard label="Unsubmitted" value={stats.missing_esf7} icon={<FiAlertCircle />} color="bg-slate-400" isActive={activeTab === 'missing'} onClick={() => setActiveTab('missing')} />
                            </div>

                            <div className="space-y-6">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
                                    <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-2xl shadow-sm self-start">
                                        <TabButton active={activeTab === 'queue'} onClick={() => setActiveTab('queue')} label="Active Queue" />
                                        <TabButton active={activeTab === 'verified'} onClick={() => setActiveTab('verified')} label="Certified" />
                                        <TabButton active={activeTab === 'missing'} onClick={() => setActiveTab('missing')} label="Missing" />
                                        <TabButton active={activeTab === 'all'} onClick={() => setActiveTab('all')} label="All Schools" />
                                    </div>
                                    <div className="relative">
                                        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input 
                                            type="text" 
                                            placeholder="Search School ID or Name..." 
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-11 pr-6 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold w-full md:w-64 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-3">
                                    {filteredSchools.map((school) => (
                                        <SchoolRow 
                                            key={school.school_id} 
                                            school={school} 
                                            onClick={() => school.status !== 'NOT_STARTED' && handleViewDetails(school)} 
                                        />
                                    ))}
                                    {filteredSchools.length === 0 && (
                                        <div className="text-center py-20 bg-white rounded-[2.5rem] border border-slate-100">
                                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">No submission activity in this category</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-6"
                        >
                            {/* Detail Header */}
                            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl opacity-40 -mr-10 -mt-10" />
                                <div className="space-y-2 relative">
                                    <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase italic">
                                        {allSchools.find(s => s.school_id === selectedSchool)?.school_name}
                                    </h2>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-3 py-1 rounded-full uppercase tracking-widest">School ID: {selectedSchool}</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">• Submitted Link Entry</span>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button 
                                        onClick={() => window.open(schoolDetail?.link, '_blank')}
                                        className="flex items-center gap-2 px-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-slate-900/10 italic"
                                    >
                                        <FiExternalLink /> Open Source
                                    </button>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-3 gap-6">
                                <div className="md:col-span-2 space-y-6">
                                     {/* School Head Banner */}
                                     <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between gap-6 relative overflow-hidden group">
                                         <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl opacity-40 -mr-10 -mt-10 transition-all group-hover:scale-150" />
                                         <div className="flex items-center gap-6 relative">
                                             <div className="w-20 h-20 rounded-3xl bg-slate-900 flex flex-col items-center justify-center text-white text-center shadow-2xl shadow-slate-900/20">
                                                 <FiShield className="text-blue-400 mb-1" />
                                                 <span className="text-[8px] font-black uppercase tracking-tighter">Verified</span>
                                             </div>
                                             <div>
                                                 <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Authenticated School Head</h3>
                                                 <p className="text-2xl font-black text-slate-800 tracking-tight leading-none italic uppercase">{schoolDetail?.summary?.schoolHead || "N/A"}</p>
                                                 <p className="text-[10px] font-bold text-blue-500 mt-2 uppercase tracking-widest italic">{schoolDetail?.summary?.schoolHeadPosition || "No Position Assigned"}</p>
                                             </div>
                                         </div>
                                     </div>

                                     {/* Categorization Grid */}
                                     <div className="grid grid-cols-3 gap-6">
                                         <CategoryCard 
                                             label="Teaching staff" 
                                             value={schoolDetail?.summary?.teaching || 0} 
                                             icon={<FiActivity />} 
                                             color="text-indigo-600 bg-indigo-50" 
                                         />
                                         <CategoryCard 
                                             label="Related-Teaching" 
                                             value={schoolDetail?.summary?.relatedTeaching || 0} 
                                             icon={<FiCheckCircle />} 
                                             color="text-emerald-600 bg-emerald-50" 
                                         />
                                         <CategoryCard 
                                             label="Non-Teaching" 
                                             value={schoolDetail?.summary?.nonTeaching || 0} 
                                             icon={<FiAlertCircle />} 
                                             color="text-slate-500 bg-slate-50" 
                                         />
                                     </div>
                                </div>

                                {/* Metadata & Action */}
                                <div className="space-y-6">
                                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Row Registry</p>
                                            <div className="flex items-baseline gap-2">
                                                <p className="text-5xl font-black text-slate-800 tracking-tighter">{schoolDetail?.row_count || 0}</p>
                                                <p className="text-xs font-bold text-slate-400 uppercase italic">Personnel</p>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 space-y-2">
                                                <div className="flex items-center gap-2 text-blue-600">
                                                    <FiClock className="w-4 h-4" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Ingestion Priority</span>
                                                </div>
                                                <p className="text-[10px] font-bold text-blue-800/60 uppercase leading-relaxed">
                                                    Approved schools are harvested **One-by-One** starting at 00:00 local time.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="pt-4 space-y-3">
                                            <button 
                                                onClick={handleEnqueue} 
                                                disabled={actionLoading || schoolDetail?.status === 'QUEUED'}
                                                className={`w-full py-5 font-black rounded-3xl uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl italic ${schoolDetail?.status === 'QUEUED' ? 'bg-amber-100 text-amber-600 shadow-amber-100' : 'bg-indigo-600 text-white shadow-indigo-200 hover:scale-[1.02]'}`}
                                            >
                                                {actionLoading ? <FiLoader className="animate-spin" /> : <FiDatabase />}
                                                {schoolDetail?.status === 'QUEUED' ? "Already Enqueued" : "Approve for Harvesting"}
                                            </button>
                                            <button 
                                                onClick={handleRejectLink} 
                                                disabled={actionLoading} 
                                                className="w-full py-5 bg-white border-2 border-rose-100 text-rose-500 font-black rounded-3xl uppercase text-[10px] tracking-widest hover:bg-rose-50 transition-all italic"
                                            >
                                                Reject Submission
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>
        </PageTransition>
    );
};

const CategoryCard = ({ label, value, icon, color }) => (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${color}`}>
            {icon}
        </div>
        <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
            <p className="text-2xl font-black text-slate-800 tracking-tight">{value}</p>
        </div>
    </div>
);

const StatCard = ({ label, value, icon, color, onClick, isActive }) => (
    <div onClick={onClick} className={`p-6 rounded-[2.5rem] bg-white border transition-all cursor-pointer flex items-center gap-5 ${isActive ? 'border-blue-500 ring-4 ring-blue-50 shadow-lg' : 'border-slate-100 hover:border-slate-200 shadow-sm'}`}>
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl shadow-xl ${color}`}>{icon}</div>
        <div>
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</h4>
            <p className="text-3xl font-black text-slate-800 tracking-tighter">{value}</p>
        </div>
    </div>
);

const TabButton = ({ active, onClick, label }) => (
    <button onClick={onClick} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${active ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
        {label}
    </button>
);

const SchoolRow = ({ school, onClick }) => (
    <div 
        onClick={onClick}
        className={`bg-white border border-slate-100 p-6 rounded-[2rem] flex items-center justify-between group transition-all ${school.status !== 'NOT_STARTED' ? 'cursor-pointer hover:border-blue-200 hover:shadow-xl hover:shadow-blue-500/5' : 'opacity-60 grayscale'}`}
    >
        <div className="flex items-center gap-5">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${school.status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-50 text-slate-400'} group-hover:bg-blue-50 group-hover:text-blue-600`}>
                {school.status === 'VERIFIED' ? <FiShield size={24} /> : <FiDatabase size={24} />}
            </div>
            <div>
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight leading-none group-hover:text-blue-600 transition-colors uppercase italic">{school.school_name}</h3>
                <div className="flex items-center gap-3 mt-1.5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID: {school.school_id}</p>
                    {school.row_count && <span className="text-[9px] font-black bg-blue-50 text-blue-500 px-2 py-0.5 rounded-full">{school.row_count} Rows</span>}
                </div>
            </div>
        </div>
        <div className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm ${
            school.status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-600' : 
            school.status === 'QUEUED' ? 'bg-blue-50 text-blue-600' :
            school.status === 'PENDING_SDO' ? 'bg-amber-50 text-amber-600' : 
            'bg-slate-50 text-slate-400'
        }`}>
            {school.status === 'QUEUED' && <FiLoader className="animate-spin" />}
            {school.status.replace('_', ' ')}
        </div>
    </div>
);

export default ESF7Review;
