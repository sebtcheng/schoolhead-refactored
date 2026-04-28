import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BottomNav from './BottomNav';
import PageTransition from '../components/PageTransition';
import { FiSearch, FiChevronRight, FiMapPin, FiBarChart2, FiHardDrive, FiFileText, FiTrendingUp, FiCheckCircle, FiClock, FiBell, FiRefreshCw } from 'react-icons/fi';
import debounce from 'lodash/debounce'; // If lodash is available? Probably not efficiently. Let's write a simple hook or utility.

// Simple debounce utility since we might not have lodash
const useDebounce = (value, delay) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
};

const SchoolJurisdictionList = () => {
    const { user, token } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [userData, setUserData] = useState(null);
    const [schools, setSchools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const debouncedSearch = useDebounce(searchQuery, 500);

    // Pagination State
    const [page, setPage] = useState(1);
    const [totalSchools, setTotalSchools] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [loadingMore, setLoadingMore] = useState(false);

    // Determine effective filters
    const filterRegion = searchParams.get('region');
    const filterDivision = searchParams.get('division');

    const fetchSchools = useCallback(async (isLoadMore = false, currentPage = 1, currentSearch = "") => {
        if (!isLoadMore) setLoading(true);
        else setLoadingMore(true);

        if (!user) return;

        try {
            // We need userData. If not yet loaded, we might need to wait or it's already in state.
            // If this is called from useEffect deps on [userData], it's fine.
            // Fallback to user data if not provided in URL
            if (!regionToUse) {
                regionToUse = user.region;
                divisionToUse = user.division;
            }

            if (!regionToUse) return; // Should not happen for valid users

            const params = new URLSearchParams({
                region: regionToUse,
                page: currentPage.toString(),
                limit: '20',
                search: currentSearch
            });

            if (divisionToUse) params.append('division', divisionToUse);

            const res = await fetch(`api/monitoring/schools?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                const data = await res.json();

                // Handle Pagination Response
                if (data.data) {
                    if (isLoadMore) {
                        setSchools(prev => [...prev, ...data.data]);
                    } else {
                        setSchools(data.data);
                    }
                    setTotalSchools(data.total);
                    setTotalPages(data.totalPages);
                } else {
                    // Fallback for legacy (if API revert)
                    setSchools(data);
                }
            }
        } catch (err) {
            console.error("Fetch Schools Error:", err);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [filterRegion, filterDivision, userData]);

    // Trigger Fetch on Filters/Search Change
    useEffect(() => {
        if (user || filterRegion) {
            setPage(1); // Reset page on filter change
            fetchSchools(false, 1, debouncedSearch);
        }
    }, [debouncedSearch, user, filterRegion, filterDivision, fetchSchools]);

    const handleLoadMore = () => {
        if (page < totalPages) {
            const nextPage = page + 1;
            setPage(nextPage);
            fetchSchools(true, nextPage, debouncedSearch);
        }
    };

    const StatusBadge = ({ active, label }) => (
        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${active ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
            {label}
        </span>
    );

    if (loading && page === 1) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
    );

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-24 font-sans">
                {/* Header */}
                <div className="bg-[#004A99] p-6 pt-12 rounded-b-[2rem] shadow-lg text-white mb-6 sticky top-0 z-30">

                    <div className="flex justify-between items-end">
                        <div className="flex-1 mr-4">
                            <h1 className="text-2xl font-black tracking-tight">Schools List</h1>
                            <p className="text-blue-200/70 text-xs mt-0.5 truncate">
                                {user?.role === 'Central Office' ? (
                                    `Monitoring: ${filterDivision || filterRegion || 'National'}`
                                ) : (
                                    user?.role === 'Regional Office' ? `Regional Monitoring: Region ${user?.region}` : `Division Monitoring: ${user?.division}`
                                )}
                            </p>
                        </div>
                        <div className="text-right flex flex-col items-end min-w-[60px]">
                            <span className="text-2xl font-black">{totalSchools}</span>
                            <p className="text-[10px] font-bold opacity-60 uppercase mb-2">Total</p>

                            <button
                                onClick={() => { setPage(1); fetchSchools(false, 1, debouncedSearch); }}
                                className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all hover:rotate-180 active:scale-95 backdrop-blur-md"
                                title="Refresh List"
                            >
                                <FiRefreshCw size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Search Bar - Moved inside header for better UX on scroll */}
                    <div className="relative mt-4">
                        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search school name or ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white dark:bg-slate-800 text-slate-800 border-none rounded-2xl py-3 pl-12 pr-4 shadow-sm text-sm focus:ring-2 focus:ring-blue-400 outline-none dark:text-white placeholder:text-slate-400"
                        />
                    </div>
                </div>

                <div className="px-5 space-y-4">
                    {/* School Cards */}
                    <div className="space-y-3">
                        {schools.map((school) => (
                            <div
                                key={school.school_id}
                                onClick={() => {
                                    sessionStorage.setItem('targetSchoolId', school.school_id);
                                    sessionStorage.setItem('targetSchoolName', school.school_name);
                                    navigate('/school-audit');
                                }}
                                className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-900 transition-all group cursor-pointer ring-2 ring-transparent hover:ring-blue-400"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex-1 pr-4">
                                        <h3 className="font-extrabold text-slate-800 dark:text-slate-100 leading-snug group-hover:text-blue-600 transition-colors">
                                            {school.school_name || "Unknown School"}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ID: {school.school_id}</p>

                                            {/* COMPLETION INDICATOR */}
                                            {(() => {
                                                const isComplete = school.u1_status && school.u2_status && school.u3_status &&
                                                    school.u4_status && school.u5_status && school.u6_status &&
                                                    school.u7_status && school.u8_status && school.u9_status;
                                                return isComplete ? (
                                                    <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                        <FiCheckCircle size={10} /> Completed
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                        <FiClock size={10} /> {Math.round(school.completion_percentage)}%
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-1 justify-end max-w-[150px]">
                                        <StatusBadge active={school.u1_status} label="Info" />
                                        <StatusBadge active={school.u2_status} label="Enrol" />
                                        <StatusBadge active={school.u3_status} label="Class" />
                                        <StatusBadge active={school.u4_status} label="Stats" />
                                        <StatusBadge active={school.u5_status} label="Mode" />
                                        <StatusBadge active={school.u6_status} label="Staff" />
                                        <StatusBadge active={school.u7_status} label="Bldg" />
                                        <StatusBadge active={school.u8_status} label="Site" />
                                        <StatusBadge active={school.u9_status} label="Safety" />
                                    </div>
                                </div>

                                {/* --- DATA HEALTH SCORE --- (Hidden for RO/SDO) */}
                                {user?.role !== 'Regional Office' && user?.role !== 'School Division Office' && (
                                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                                        <div className="flex items-center gap-3">
                                            {/* Score Badge */}
                                            <div className={`flex items-center justify-center w-12 h-12 rounded-xl font-black text-lg text-white shadow-sm ${
                                                school.data_health_score === 100
                                                    ? 'bg-gradient-to-br from-emerald-500 to-emerald-600'
                                                    : school.data_health_score >= 80
                                                        ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                                                        : school.data_health_score >= 50
                                                            ? 'bg-gradient-to-br from-amber-500 to-amber-600'
                                                            : school.data_health_score > 0
                                                                ? 'bg-gradient-to-br from-red-500 to-red-600'
                                                                : 'bg-gradient-to-br from-slate-300 to-slate-400'
                                            }`}>
                                                {school.data_health_score ?? '--'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data Health</p>
                                                <p className={`text-sm font-bold ${
                                                    school.data_health_description === 'Excellent' ? 'text-emerald-600' :
                                                    school.data_health_description === 'Good' ? 'text-blue-600' :
                                                    school.data_health_description === 'Fair' ? 'text-amber-600' :
                                                    school.data_health_description === 'Critical' ? 'text-red-600' :
                                                    'text-slate-400'
                                                }`}>
                                                    {school.data_health_description || 'Pending Validation'}
                                                </p>
                                            </div>
                                        </div>
                                        {/* Issues */}
                                        {school.data_quality_issues && school.data_quality_issues !== 'None' && school.data_quality_issues.trim() !== '' && (
                                            <div className="mt-2 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl p-3">
                                                <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">Issues Detected</p>
                                                <p className="text-xs text-red-700 dark:text-red-300 font-semibold leading-relaxed whitespace-pre-wrap">
                                                    {school.data_quality_issues}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-700/50">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">View Selection</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        <button
                                            onClick={() => navigate(`/school-profile?viewOnly=true&schoolId=${school.school_id}`)}
                                            className="p-2 aspect-square flex flex-col items-center justify-center bg-blue-50 dark:bg-blue-900/40 rounded-xl hover:bg-blue-100 transition-colors"
                                            title="Profile"
                                        >
                                            <FiFileText className="text-blue-600 dark:text-blue-400" size={16} />
                                            <span className="text-[8px] font-bold mt-1 text-blue-900/60 dark:text-blue-200/60">Profile</span>
                                        </button>
                                        <button
                                            onClick={() => navigate(`/school-information?viewOnly=true&schoolId=${school.school_id}`)}
                                            className="p-2 aspect-square flex flex-col items-center justify-center bg-indigo-50 dark:bg-indigo-900/40 rounded-xl hover:bg-indigo-100 transition-colors"
                                            title="School Head"
                                        >
                                            <FiBarChart2 className="text-indigo-600 dark:text-indigo-400" size={16} />
                                            <span className="text-[8px] font-bold mt-1 text-indigo-900/60 dark:text-indigo-200/60">HdInfo</span>
                                        </button>
                                        <button
                                            onClick={() => navigate(`/enrolment?viewOnly=true&schoolId=${school.school_id}`)}
                                            className="p-2 aspect-square flex flex-col items-center justify-center bg-emerald-50 dark:bg-emerald-900/40 rounded-xl hover:bg-emerald-100 transition-colors"
                                            title="Enrolment"
                                        >
                                            <FiTrendingUp className="text-emerald-600 dark:text-emerald-400" size={16} />
                                            <span className="text-[8px] font-bold mt-1 text-emerald-900/60 dark:text-emerald-200/60">Enrol</span>
                                        </button>
                                        <button
                                            onClick={() => navigate(`/organized-classes?viewOnly=true&schoolId=${school.school_id}`)}
                                            className="p-2 aspect-square flex flex-col items-center justify-center bg-cyan-50 dark:bg-cyan-900/40 rounded-xl hover:bg-cyan-100 transition-colors"
                                            title="Classes"
                                        >
                                            <FiCheckCircle className="text-cyan-600 dark:text-cyan-400" size={16} />
                                            <span className="text-[8px] font-bold mt-1 text-cyan-900/60 dark:text-cyan-200/60">Class</span>
                                        </button>
                                        <button
                                            onClick={() => navigate(`/shifting-modalities?viewOnly=true&schoolId=${school.school_id}`)}
                                            className="p-2 aspect-square flex flex-col items-center justify-center bg-purple-50 dark:bg-purple-900/40 rounded-xl hover:bg-purple-100 transition-colors"
                                            title="Modalities"
                                        >
                                            <FiMapPin className="text-purple-600 dark:text-purple-400" size={16} />
                                            <span className="text-[8px] font-bold mt-1 text-purple-900/60 dark:text-purple-200/60">Mode</span>
                                        </button>
                                        <button
                                            onClick={() => navigate(`/teaching-personnel?viewOnly=true&schoolId=${school.school_id}`)}
                                            className="p-2 aspect-square flex flex-col items-center justify-center bg-orange-50 dark:bg-orange-900/40 rounded-xl hover:bg-orange-100 transition-colors"
                                            title="Personnel"
                                        >
                                            <FiFileText className="text-orange-600 dark:text-orange-400" size={16} />
                                            <span className="text-[8px] font-bold mt-1 text-orange-900/60 dark:text-orange-200/60">Staff</span>
                                        </button>
                                        <button
                                            onClick={() => navigate(`/teacher-specialization?viewOnly=true&schoolId=${school.school_id}`)}
                                            className="p-2 aspect-square flex flex-col items-center justify-center bg-pink-50 dark:bg-pink-900/40 rounded-xl hover:bg-pink-100 transition-colors"
                                            title="Specialization"
                                        >
                                            <FiTrendingUp className="text-pink-600 dark:text-pink-400" size={16} />
                                            <span className="text-[8px] font-bold mt-1 text-pink-900/60 dark:text-pink-200/60">Spec</span>
                                        </button>
                                        <button
                                            onClick={() => navigate(`/school-resources?viewOnly=true&schoolId=${school.school_id}`)}
                                            className="p-2 aspect-square flex flex-col items-center justify-center bg-amber-50 dark:bg-amber-900/40 rounded-xl hover:bg-amber-100 transition-colors"
                                            title="Resources"
                                        >
                                            <FiClock className="text-amber-600 dark:text-amber-400" size={16} />
                                            <span className="text-[8px] font-bold mt-1 text-amber-900/60 dark:text-amber-200/60">Res</span>
                                        </button>
                                        {user?.role !== 'Regional Office' && user?.role !== 'School Division Office' && (
                                            <button
                                                onClick={() => navigate(`/project-validation?schoolId=${school.school_id}`)}
                                                className="col-span-4 mt-2 flex items-center justify-center gap-2 py-3 bg-[#CC0000] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-colors shadow-lg shadow-red-500/20"
                                            >
                                                <FiHardDrive /> Infrastructure Monitoring
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* LOAD MORE BUTTON */}
                    {page < totalPages && (
                        <button
                            onClick={handleLoadMore}
                            disabled={loadingMore}
                            className="w-full py-4 text-center text-blue-600 font-bold text-xs uppercase tracking-widest bg-blue-50 hover:bg-blue-100 rounded-2xl transition-all"
                        >
                            {loadingMore ? "Loading..." : "Load More Schools"}
                        </button>
                    )}

                    {schools.length === 0 && !loading && (
                        <div className="text-center py-10 text-slate-400">
                            <p>No schools found.</p>
                        </div>
                    )}
                </div>

                <BottomNav userRole={user?.role} />
            </div>
        </PageTransition>
    );
};

export default SchoolJurisdictionList;
