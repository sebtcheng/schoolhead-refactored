import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    FiArrowLeft, FiSearch, FiShield, FiExternalLink, 
    FiCheckCircle, FiXCircle, FiDatabase, FiAward, FiLoader, 
    FiX, FiInfo, FiChevronDown, FiActivity, FiAlertCircle, FiClock,
    FiUserCheck, FiUsers
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
    const [activeTab, setActiveTab] = useState('all'); // queue, verified, missing, all
    const [viewMode, setViewMode] = useState('list'); // list, grid (for RO)

    const [selectedSchool, setSelectedSchool] = useState(null);
    const [schoolDetail, setSchoolDetail] = useState(null);
    const [specializationData, setSpecializationData] = useState(null);
    const [showAuditPanel, setShowAuditPanel] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [regionalSummary, setRegionalSummary] = useState([]);
    const [selectedDivision, setSelectedDivision] = useState('All Divisions');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);
    
    // Staff Detail Modal State
    const [showStaffModal, setShowStaffModal] = useState(false);
    const [staffModalTitle, setStaffModalTitle] = useState("");
    const [staffModalData, setStaffModalData] = useState([]);
    const [staffLoading, setStaffLoading] = useState(false);
    const [staffCurrentPage, setStaffCurrentPage] = useState(1);
    const [staffItemsPerPage] = useState(25);

    const isSDO = user?.role === 'School Division Office';
    const isRO = user?.role === 'Regional Division Office' || user?.role === 'Regional Office';
    const isSGOD = user?.office?.toUpperCase() === 'SCHOOL GOVERNANCE AND OPERATIONS DIVISION (SGOD)';
    const isSuperUser = user?.role === 'Super User';

    useEffect(() => {
        console.log("DEBUG [ESF7] User State:", user);
        if (user) {
            if (isSDO && !isSGOD && !isSuperUser) {
                console.warn("Unauthorized access attempt to ESF7 Review by non-SGOD office.");
                navigate('/division-nexus');
                return;
            }

            fetchStats();
            fetchSchools();
            if (isRO) fetchRegionalSummary();
        }
    }, [user, selectedDivision, isRO]);

    useEffect(() => {
        let list = [...allSchools];
        
        // Tab Filtering
        if (activeTab === 'queue') list = list.filter(s => s.status === 'VERIFIED' || s.status === 'PENDING_SDO' || s.status === 'QUEUED');
        else if (activeTab === 'needs_resubmission') list = list.filter(s => s.status === 'NEEDS_RESUBMISSION');
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
        setCurrentPage(1);
    }, [searchTerm, activeTab, allSchools]);

    const paginatedSchools = filteredSchools.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalPages = Math.ceil(filteredSchools.length / itemsPerPage);

    const fetchStats = async () => {
        try {
            const query = new URLSearchParams({
                region: user?.region || 'All',
                division: selectedDivision
            }).toString();
            const res = await fetch(`/api/esf7/stats?${query}`);
            const data = await res.json();
            if (data.success) setStats(data.data);
        } catch (err) { console.error(err); }
    };

    const fetchRegionalSummary = async () => {
        try {
            const query = new URLSearchParams({ region: user?.region || 'All' }).toString();
            const res = await fetch(`/api/esf7/regional-summary?${query}`);
            const data = await res.json();
            if (data.success) setRegionalSummary(data.data);
        } catch (err) { console.error(err); }
    };

    const fetchSchools = async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams({
                region: user?.region || 'All',
                division: selectedDivision
            }).toString();
            const res = await fetch(`/api/esf7/all-schools?${query}`);
            const data = await res.json();
            if (data.success) {
                console.log(`DEBUG [ESF7] Setting AllSchools with ${data.data?.length} items`);
                setAllSchools(data.data || []);
            }
        } catch (err) { console.error(err); }
        setLoading(false);
    };


    const fetchSpecialization = async (sid) => {
        try {
            const res = await fetch(`/api/esf7/specialization-summary/${sid}`);
            const data = await res.json();
            if (data.success) {
                setSpecializationData(data.data);
                // OVERRIDE summary personnel counts with real-time NATIONAL-only counts
                if (data.personnel) {
                    setSchoolDetail(prev => ({
                        ...prev,
                        summary: {
                            ...prev.summary,
                            ...data.personnel
                        },
                        row_count: data.personnel.total
                    }));
                }
            }
        } catch (err) { console.error(err); }
    };

    const handleCategoryClick = async (category) => {
        setStaffModalTitle(`${category} List`);
        setShowStaffModal(true);
        setStaffLoading(true);
        setStaffModalData([]);
        setStaffCurrentPage(1);

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/esf7/data/${selectedSchool}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (data.success) {
                const TEACHING = ["TEACHER I", "TEACHER II", "TEACHER III", "MASTER TEACHER I", "MASTER TEACHER II", "MASTER TEACHER III", "MASTER TEACHER IV", "SPET I", "SPET II", "SPET III", "SPET IV", "SST I", "SST II", "SST III"];
                const RELATED = ["PRINCIPAL I", "PRINCIPAL II", "PRINCIPAL III", "PRINCIPAL IV", "HEAD TEACHER I", "HEAD TEACHER II", "HEAD TEACHER III", "HEAD TEACHER IV", "HEAD TEACHER V", "HEAD TEACHER VI", "GUIDANCE COUNSELOR I", "GUIDANCE COUNSELOR II", "GUIDANCE COUNSELOR III", "LIBRARIAN I", "LIBRARIAN II", "LIBRARIAN III"];

                let filtered = [];
                const raw = data.data || [];

                if (category === "Teaching Staff") {
                    filtered = raw.filter(r => {
                        const pos = (r.position || "").toUpperCase();
                        const fund = (r.fund_source || r.funding_source || "").toUpperCase();
                        return (fund === "NATIONAL" || fund === "DEPED") && TEACHING.some(t => pos.includes(t));
                    });
                } else if (category === "Related-Teaching") {
                    filtered = raw.filter(r => {
                        const pos = (r.position || "").toUpperCase();
                        const fund = (r.fund_source || r.funding_source || "").toUpperCase();
                        return (fund === "NATIONAL" || fund === "DEPED") && RELATED.some(t => pos.includes(t));
                    });
                } else { // Non-Teaching
                    filtered = raw.filter(r => {
                        const pos = (r.position || "").toUpperCase();
                        const fund = (r.fund_source || r.funding_source || "").toUpperCase();
                        const isTeaching = TEACHING.some(t => pos.includes(t));
                        const isRelated = RELATED.some(t => pos.includes(t));
                        return (fund === "NATIONAL" || fund === "DEPED") && !isTeaching && !isRelated;
                    });
                }
                setStaffModalData(filtered);
            }
        } catch (err) { console.error(err); }
        setStaffLoading(false);
    };

    const handleViewDetails = async (school) => {
        setSelectedSchool(school.school_id);
        setSpecializationData(null);
        setActionLoading(true);
        try {
            const res = await fetch(`/api/esf7/link-detail/${school.school_id}`);
            const data = await res.json();
            if (data.success) {
                setSchoolDetail(data.data);
                // Always fetch dynamic to ensure NATIONAL filter is applied to legacy data
                await fetchSpecialization(school.school_id);
            }
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
                <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-6 sticky top-0 z-50">
                    <div className="max-w-6xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <button onClick={() => selectedSchool ? setSelectedSchool(null) : navigate('/monitoring-dashboard')} className="p-3 hover:bg-slate-100 rounded-2xl transition-all border border-slate-100 group">
                                <FiArrowLeft className="w-5 h-5 text-slate-600 group-hover:-translate-x-1 transition-transform" />
                            </button>
                            <div>
                                <h1 className="text-2xl font-black text-slate-800 tracking-tighter leading-none uppercase italic">eSF7 Ingestion Center</h1>
                                <p className="text-[10px] font-black text-blue-500 mt-1.5 uppercase tracking-widest leading-none flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                    {user?.division || "National"} • {isRO ? "Regional Oversight" : "Division Audit"}
                                </p>
                            </div>
                        </div>

                        {/* Overall Progress */}
                        <div className="hidden md:flex items-center gap-6 pr-4">
                            <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">System Completion</p>
                                <p className="text-xl font-black text-slate-800 tracking-tighter">
                                    {stats.total_registered > 0 ? ((stats.verified / stats.total_registered) * 100).toFixed(2) : "0.00"}%
                                </p>
                            </div>
                            <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${stats.total_registered > 0 ? (stats.verified / stats.total_registered) * 100 : 0}%` }}
                                    className="h-full bg-blue-600 rounded-full shadow-[0_0_10px_rgba(37,99,235,0.4)]"
                                />
                            </div>
                        </div>
                    </div>
                </header>

                <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
                    {!selectedSchool ? (
                        <>
                            {/* Regional Breadcrumbs if deep in drill-down */}
                            {isRO && selectedDivision !== 'All Divisions' && (
                                <div className="mb-6 flex items-center justify-between">
                                    <button 
                                        onClick={() => setSelectedDivision('All Divisions')}
                                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-600 uppercase tracking-widest hover:border-blue-200 transition-all shadow-sm"
                                    >
                                        <FiArrowLeft /> Back to Divisions
                                    </button>
                                    <div className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20">
                                        Viewing: {selectedDivision}
                                    </div>
                                </div>
                            )}

                            {/* Stats Summary */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <StatCard 
                                    label="Verified Schools" 
                                    value={stats.verified} 
                                    total={stats.total_registered}
                                    icon={<FiCheckCircle />} 
                                    color="from-emerald-500 to-teal-600" 
                                    isActive={activeTab === 'queue'} 
                                    onClick={() => setActiveTab('queue')} 
                                />
                                <StatCard 
                                    label="Action Required" 
                                    value={allSchools.filter(s => s.status === 'NEEDS_RESUBMISSION').length} 
                                    total={stats.total_registered}
                                    icon={<FiAlertCircle />} 
                                    color="from-rose-500 to-orange-600" 
                                    isActive={activeTab === 'needs_resubmission'} 
                                    onClick={() => setActiveTab('needs_resubmission')} 
                                />
                                <StatCard 
                                    label="Pending Ingestion" 
                                    value={stats.missing_esf7} 
                                    total={stats.total_registered}
                                    icon={<FiClock />} 
                                    color="from-slate-400 to-slate-600" 
                                    isActive={activeTab === 'missing'} 
                                    onClick={() => setActiveTab('missing')} 
                                />
                                <StatCard 
                                    label="Total Registered" 
                                    value={stats.total_registered} 
                                    icon={<FiDatabase />} 
                                    color="from-slate-700 to-slate-900" 
                                    isActive={activeTab === 'all'} 
                                    onClick={() => setActiveTab('all')} 
                                />
                            </div>


                            <div className="space-y-6">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
                                    <div className="flex flex-wrap items-center gap-2 p-1 bg-white border border-slate-200 rounded-2xl shadow-sm self-start">
                                        <TabButton active={activeTab === 'all'} onClick={() => setActiveTab('all')} label="All Schools" />
                                        <TabButton active={activeTab === 'queue'} onClick={() => setActiveTab('queue')} label="Harvested" />
                                        <TabButton active={activeTab === 'needs_resubmission'} onClick={() => setActiveTab('needs_resubmission')} label="For Resubmission" />
                                        <TabButton active={activeTab === 'missing'} onClick={() => setActiveTab('missing')} label="Missing" />
                                        {isRO && (
                                            <div className="w-px h-6 bg-slate-200 mx-2" />
                                        )}
                                        {isRO && (
                                            <button 
                                                onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
                                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === 'grid' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                {viewMode === 'list' ? 'Show Division Summary' : 'Show All Schools'}
                                            </button>
                                        )}
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
                                    {/* REGIONAL DIVISION SUMMARY VIEW */}
                                    {/* REGIONAL DIVISION SUMMARY VIEW (Only if Grid mode selected) */}
                                    {isRO && viewMode === 'grid' && selectedDivision === 'All Divisions' ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {regionalSummary.map((div) => (
                                                <div 
                                                    key={div.division}
                                                    onClick={() => {
                                                        setSelectedDivision(div.division);
                                                        setViewMode('list');
                                                    }}
                                                    className="bg-white border border-slate-100 p-8 rounded-[2.5rem] cursor-pointer hover:border-blue-200 hover:shadow-2xl hover:shadow-blue-500/5 transition-all group relative overflow-hidden"
                                                >
                                                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    <div className="relative">
                                                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter leading-none mb-6 italic group-hover:text-blue-600 transition-colors">
                                                            {div.division}
                                                        </h3>
                                                        <div className="space-y-4">
                                                            <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Schools Submitted</span>
                                                                <span className="text-sm font-black text-slate-700">{div.harvested_schools} / {div.total_schools}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Completion</span>
                                                                <span className="text-sm font-black text-blue-600">
                                                                    {div.total_schools > 0 
                                                                        ? ((div.harvested_schools / div.total_schools) * 100).toFixed(2) 
                                                                        : "0.00"}%
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="mt-8 flex items-center gap-2 text-blue-500">
                                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] italic">Open Division Audit</span>
                                                            <FiArrowLeft className="rotate-180" />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <>
                                            {paginatedSchools.map((school) => (
                                                <SchoolRow 
                                                    key={school.school_id} 
                                                    school={school} 
                                                    onClick={() => school.status !== 'NOT_STARTED' && handleViewDetails(school)} 
                                                />
                                            ))}
                                        </>
                                    )}

                                    {filteredSchools.length === 0 && (isRO && selectedDivision !== 'All Divisions' || !isRO) && (
                                        <div className="text-center py-20 bg-white rounded-[2.5rem] border border-slate-100">
                                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">No activity in this category</p>
                                        </div>
                                    )}
                                </div>

                                {/* Pagination Controls */}
                                {filteredSchools.length > 0 && (
                                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-2 pt-4 border-t border-slate-200">
                                        <div className="flex items-center gap-4">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                Page {currentPage} of {totalPages || 1} • {filteredSchools.length} schools
                                            </p>
                                            <select 
                                                value={itemsPerPage}
                                                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                                                className="bg-white border border-slate-200 rounded-xl px-3 py-1 text-[10px] font-black text-slate-600 outline-none focus:ring-2 focus:ring-blue-100"
                                            >
                                                {[25, 50, 100].map(v => <option key={v} value={v}>{v} per page</option>)}
                                            </select>
                                        </div>
                                        
                                        <div className="flex items-center gap-1">
                                            <button 
                                                disabled={currentPage === 1}
                                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                                className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                            >
                                                <FiArrowLeft className="w-4 h-4" />
                                            </button>
                                            
                                            <div className="flex items-center gap-1">
                                                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                                                    let pg = currentPage - 2 + i;
                                                    if (currentPage <= 2) pg = i + 1;
                                                    if (currentPage >= totalPages - 1) pg = totalPages - 4 + i;
                                                    if (pg < 1 || pg > totalPages) return null;
                                                    
                                                    return (
                                                        <button 
                                                            key={pg}
                                                            onClick={() => setCurrentPage(pg)}
                                                            className={`w-10 h-10 rounded-xl text-[10px] font-black transition-all ${currentPage === pg ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white border border-slate-200 text-slate-400 hover:bg-slate-50'}`}
                                                        >
                                                            {pg}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            <button 
                                                disabled={currentPage === totalPages || totalPages === 0}
                                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                                className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                            >
                                                <FiArrowLeft className="w-4 h-4 rotate-180" />
                                            </button>
                                        </div>
                                    </div>
                                )}
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
                                    <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase italic leading-tight">
                                        {allSchools.find(s => s.school_id === selectedSchool)?.school_name}
                                    </h2>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-3 py-1 rounded-full uppercase tracking-widest">School ID: {selectedSchool}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-3 gap-6">
                                {(!specializationData || Object.values(specializationData).every(v => v === 0)) && (schoolDetail?.status === 'SUBMITTED' || schoolDetail?.status === 'PENDING_SDO' || schoolDetail?.status === 'QUEUED') ? (
                                    <div className="md:col-span-3">
                                        <div className="bg-blue-50/50 p-24 rounded-[3rem] border border-blue-100 flex flex-col items-center text-center space-y-8">
                                            <div className="w-24 h-24 rounded-3xl bg-white flex items-center justify-center text-blue-500 shadow-xl shadow-blue-500/5">
                                                <FiClock className="w-12 h-12" />
                                            </div>
                                            <div>
                                                <h3 className="text-3xl font-black text-blue-800 uppercase italic tracking-tighter leading-tight">Data Sync Pending</h3>
                                                <p className="text-sm font-bold text-blue-600/70 mt-4 uppercase tracking-widest max-w-md mx-auto leading-relaxed">
                                                    Please Standby, School already submitted ESF7 but the data is not yet in the DATABASE, please check again later.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="md:col-span-2 space-y-6">
                                     {/* School Head Banner */}
                                     <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between gap-6 relative overflow-hidden group">
                                         <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl opacity-40 -mr-10 -mt-10 transition-all group-hover:scale-150" />
                                         <div className="flex items-center gap-6 relative">
                                             <div className="w-20 h-20 rounded-3xl bg-slate-900 flex flex-col items-center justify-center text-white text-center shadow-2xl shadow-slate-900/20">
                                                 <FiShield className="text-blue-400 mb-1" />
                                                 <span className="text-[8px] font-black uppercase tracking-tighter">Harvested</span>
                                             </div>
                                             <div>
                                                 <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Authenticated School Head</h3>
                                                 <p className="text-2xl font-black text-slate-800 tracking-tight leading-none italic uppercase">{schoolDetail?.summary?.schoolHead || "N/A"}</p>
                                                 <p className="text-[10px] font-bold text-blue-500 mt-2 uppercase tracking-widest italic">{schoolDetail?.summary?.schoolHeadPosition || "No Position Assigned"}</p>
                                             </div>
                                         </div>
                                     </div>

                                     <div className="px-8 py-5 bg-blue-50/50 rounded-[2rem] border border-blue-100 flex items-center gap-4 transition-all hover:bg-blue-50 group">
                                         <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                                             <FiInfo className="w-6 h-6" />
                                         </div>
                                         <div>
                                             <p className="text-xs font-black text-blue-700 uppercase tracking-widest leading-none">Funding Integrity Note</p>
                                             <p className="text-sm font-bold text-blue-600/80 mt-1 uppercase italic tracking-tight">
                                                 Only **NATIONAL / DEPED** funded personnel are counted in this specialized summary.
                                             </p>
                                         </div>
                                     </div>

                                     {/* Categorization Grid */}
                                     <div className="grid grid-cols-3 gap-6">
                                         <CategoryCard 
                                             label="Teaching staff" 
                                             value={schoolDetail?.summary?.teaching || 0} 
                                             icon={<FiActivity />} 
                                             color="text-indigo-600 bg-indigo-50" 
                                             onClick={() => handleCategoryClick("Teaching Staff")}
                                         />
                                         <CategoryCard 
                                             label="Related-Teaching" 
                                             value={schoolDetail?.summary?.relatedTeaching || 0} 
                                             icon={<FiUserCheck />} 
                                             color="text-amber-600 bg-amber-50"
                                             onClick={() => handleCategoryClick("Related-Teaching")}
                                         />
                                         <CategoryCard 
                                             label="Non-Teaching" 
                                             value={schoolDetail?.summary?.nonTeaching || 0} 
                                             icon={<FiUsers />} 
                                             color="text-rose-600 bg-rose-50"
                                             onClick={() => handleCategoryClick("Non-Teaching Staff")}
                                         />
                                     </div>

                                     {/* QUEUED STATE ILLUSTRATION */}
                                     {(!specializationData || Object.values(specializationData).every(v => v === 0)) && schoolDetail?.status === 'QUEUED' && (
                                         <div className="bg-amber-50/50 p-12 rounded-[3rem] border border-amber-100 flex flex-col items-center text-center space-y-6">
                                             <div className="w-20 h-20 rounded-3xl bg-white flex items-center justify-center text-amber-500 shadow-xl shadow-amber-500/5">
                                                 <FiLoader className="w-10 h-10 animate-spin" />
                                             </div>
                                             <div>
                                                 <h3 className="text-xl font-black text-amber-800 uppercase italic tracking-tighter">Ingestion in Progress</h3>
                                                 <p className="text-xs font-bold text-amber-600/70 mt-2 uppercase tracking-widest max-w-xs mx-auto">
                                                     The system is currently harvesting individual personnel data from the school's ESF7 link. This usually takes 1-2 minutes.
                                                 </p>
                                             </div>
                                         </div>
                                     )}

                                     {/* SPECIALIZATION SUMMARY */}
                                     {specializationData && (
                                         <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                                             <div className="flex items-center justify-between">
                                                 <div className="flex items-center gap-3">
                                                     <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                                                         <FiAward />
                                                     </div>
                                                     <div>
                                                         <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Teaching Personnel</h3>
                                                         <p className="text-lg font-black text-slate-800 tracking-tight leading-none mt-1 uppercase italic">Specialization Summary</p>
                                                     </div>
                                                 </div>
                                             </div>

                                             <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                                 {Object.entries(specializationData)
                                                     .filter(([_, count]) => count > 0)
                                                     .map(([spec, count]) => (
                                                     <div key={spec} className="px-4 py-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:bg-white hover:border-orange-200 transition-all">
                                                         <p className="text-[9px] font-black text-slate-500 uppercase tracking-tight leading-[1.1] pr-2 group-hover:text-orange-600">{spec.replace(/_/g, ' ')}</p>
                                                         <span className="text-xs font-black text-slate-900 group-hover:scale-110 transition-transform">{count}</span>
                                                     </div>
                                                 ))}
                                             </div>
                                         </div>
                                     )}


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
                                            {schoolDetail?.submitted_at && (
                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-slate-400 shadow-sm">
                                                        <FiArrowLeft className="rotate-180" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1 text-xs">Submission Log</p>
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-[10px] font-bold text-slate-700 uppercase italic leading-none">
                                                                {(() => {
                                                                    const d = schoolDetail.submitted_at;
                                                                    if (!d) return 'N/A';
                                                                    const date = new Date(d.toString().endsWith('Z') || d.toString().includes('+') ? d : d.toString().replace(' ', 'T') + 'Z');
                                                                    return date.toLocaleString();
                                                                })()}
                                                            </p>
                                                        </div>
                                                </div>
                                            </div>
                                        )}
                                        </div>

                                        <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 space-y-2">
                                                <div className="flex items-center gap-2 text-blue-600">
                                                    <FiClock className="w-4 h-4" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">System Ingestion</span>
                                                </div>
                                                <p className="text-[10px] font-bold text-blue-800/60 uppercase leading-relaxed">
                                                    Data was automatically harvested. SDO review focuses on **Audit Integrity** and **Resubmission Decisions**.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* Staff Detail Modal */}
                <AnimatePresence>
                    {showStaffModal && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowStaffModal(false)}
                                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                            />
                            <motion.div 
                                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                                className="relative w-full max-w-4xl max-h-[85vh] bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col"
                            >
                                <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center">
                                            <FiUsers className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Personnel Detail</h3>
                                            <p className="text-xl font-black text-slate-800 tracking-tight leading-none uppercase italic">{staffModalTitle}</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setShowStaffModal(false)}
                                        className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-slate-100 transition-colors"
                                    >
                                        <FiX />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                    {staffLoading ? (
                                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                                            <FiLoader className="w-10 h-10 text-blue-600 animate-spin" />
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Retrieving Registry...</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {staffModalData.length > 0 ? (
                                                <>
                                                    {staffModalData.slice((staffCurrentPage - 1) * staffItemsPerPage, staffCurrentPage * staffItemsPerPage).map((staff, idx) => (
                                                        <div key={idx} className="p-5 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between group hover:bg-blue-50 hover:border-blue-200 transition-all">
                                                            <div className="flex items-center gap-5">
                                                                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 text-xs font-black group-hover:text-blue-600 group-hover:border-blue-100 transition-all">
                                                                    {(staffCurrentPage - 1) * staffItemsPerPage + idx + 1}
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-black text-slate-800 uppercase tracking-tight group-hover:text-blue-900 transition-colors italic">{staff.last}, {staff.first}</p>
                                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{staff.position}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <div className="text-right">
                                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Fund Source</p>
                                                                    <p className="text-[10px] font-bold text-blue-600 uppercase italic leading-none">{staff.fund_source || staff.funding_source || "NATIONAL"}</p>
                                                                </div>
                                                                {staff.gender && (
                                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${staff.gender === 'M' || staff.gender === 'MALE' ? 'bg-blue-100 text-blue-600' : 'bg-rose-100 text-rose-600'}`}>
                                                                        {staff.gender.charAt(0)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}

                                                    {/* Modal Pagination */}
                                                    {staffModalData.length > staffItemsPerPage && (
                                                        <div className="mt-8 flex items-center justify-center gap-2">
                                                            <button 
                                                                onClick={() => setStaffCurrentPage(prev => Math.max(1, prev - 1))}
                                                                disabled={staffCurrentPage === 1}
                                                                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 disabled:opacity-50 transition-all"
                                                            >
                                                                Prev
                                                            </button>
                                                            <div className="flex items-center gap-1">
                                                                {Array.from({ length: Math.ceil(staffModalData.length / staffItemsPerPage) }, (_, i) => i + 1)
                                                                    .filter(p => p === 1 || p === Math.ceil(staffModalData.length / staffItemsPerPage) || (p >= staffCurrentPage - 1 && p <= staffCurrentPage + 1))
                                                                    .map((p, i, arr) => (
                                                                        <React.Fragment key={p}>
                                                                            {i > 0 && p !== arr[i-1] + 1 && <span className="text-slate-300">...</span>}
                                                                            <button 
                                                                                onClick={() => setStaffCurrentPage(p)}
                                                                                className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all ${staffCurrentPage === p ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white border border-slate-100 text-slate-400 hover:bg-slate-50'}`}
                                                                            >
                                                                                {p}
                                                                            </button>
                                                                        </React.Fragment>
                                                                    ))
                                                                }
                                                            </div>
                                                            <button 
                                                                onClick={() => setStaffCurrentPage(prev => Math.min(Math.ceil(staffModalData.length / staffItemsPerPage), prev + 1))}
                                                                disabled={staffCurrentPage === Math.ceil(staffModalData.length / staffItemsPerPage)}
                                                                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 disabled:opacity-50 transition-all"
                                                            >
                                                                Next
                                                            </button>
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">No filtered personnel found in this category</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-center">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic leading-none">Showing {staffModalData.length} Personnel Registry Entries</p>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </PageTransition>
    );
};

const CategoryCard = ({ label, value, icon, color, onClick }) => (
    <div onClick={onClick} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-3 cursor-pointer hover:border-blue-200 hover:shadow-xl hover:shadow-blue-500/5 transition-all group">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${color} group-hover:scale-110 transition-transform`}>
            {icon}
        </div>
        <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
            <p className="text-2xl font-black text-slate-800 tracking-tight group-hover:translate-x-1 transition-transform">{value}</p>
        </div>
    </div>
);

const StatCard = ({ label, value, icon, color, onClick, isActive, total }) => {
    const percentage = total > 0 ? ((value / total) * 100).toFixed(2) : null;
    
    return (
        <div 
            onClick={onClick} 
            className={`p-6 rounded-[2.5rem] bg-white border transition-all cursor-pointer relative overflow-hidden group ${
                isActive ? 'border-blue-500 ring-4 ring-blue-50 shadow-xl' : 'border-slate-100 hover:border-slate-200 shadow-sm'
            }`}
        >
            <div className="relative z-10 flex items-center gap-5">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg bg-gradient-to-br ${color} group-hover:scale-110 transition-transform`}>
                    {icon}
                </div>
                <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">{label}</h4>
                    <div className="flex items-baseline gap-2">
                        <p className="text-3xl font-black text-slate-800 tracking-tighter">{value}</p>
                        {percentage !== null && (
                            <span className="text-[10px] font-black text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">
                                {percentage}%
                            </span>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Subtle Background Arc/Accent */}
            <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full blur-3xl opacity-5 transition-opacity group-hover:opacity-20 bg-gradient-to-br ${color}`} />
        </div>
    );
};


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
                </div>

            </div>
        </div>
        <div className="flex items-center gap-2">
            {school.audit_remarks && (school.status === 'SUBMITTED' || school.status === 'PENDING_SDO' || school.status === 'QUEUED') && (
                <div className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 animate-pulse">
                    Resubmission
                </div>
            )}
            <div className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm ${
                school.status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-600' : 
                school.status === 'QUEUED' ? 'bg-blue-50 text-blue-600' :
                school.status === 'NEEDS_RESUBMISSION' ? 'bg-rose-50 text-rose-600' :
                school.status === 'PENDING_SDO' ? 'bg-amber-50 text-amber-600' : 
                'bg-slate-50 text-slate-400'
            }`}>
                {school.status === 'QUEUED' && <FiLoader className="animate-spin" />}
                {school.status.replace(/_/g, ' ')}
            </div>
        </div>
    </div>
);


export default ESF7Review;
