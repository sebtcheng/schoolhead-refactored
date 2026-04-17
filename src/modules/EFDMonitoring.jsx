import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    FiFilter, FiSearch, FiLayers, FiList, FiTrendingUp, FiMapPin, FiChevronRight, 
    FiAlertCircle, FiChevronDown, FiPlus, FiGrid, FiEdit2, FiTrash2, FiUserPlus, 
    FiImage, FiX, FiCheck 
} from 'react-icons/fi';
import { LuClipboardList, LuCalendar, LuDollarSign, LuActivity } from "react-icons/lu";
import { useAuth } from '../context/AuthContext';
import BottomNav from './BottomNav';
import PageTransition from '../components/PageTransition';
import { createPortal } from 'react-dom';
import UpdateProjectWizard from '../components/UpdateProjectWizard';
import ProjectLogModal from '../components/ProjectLogModal';
import { FiActivity } from 'react-icons/fi';
import FilterDrawer from '../components/FilterDrawer';
import { useEFDFilters } from '../context/EFDFilterContext';
const EFDMonitoring = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [projects, setProjects] = useState(() => JSON.parse(sessionStorage.getItem('efd_cached_projects')) || []);
    const [loading, setLoading] = useState(!sessionStorage.getItem('efd_cached_projects'));
    const [userData, setUserData] = useState(null);
    const [viewMode, setViewMode] = useState('card'); // 'table' or 'card'
    const [currentPage, setCurrentPage] = useState(() => {
        const saved = sessionStorage.getItem('efd_currentPage');
        return saved ? parseInt(saved, 10) : 1;
    });
    const {
        selectedRegions, setSelectedRegions,
        selectedCategories, setSelectedCategories,
        selectedYears, setSelectedYears,
        selectedBatches, setSelectedBatches,
        searchQuery, setSearchQuery,
        selectedDivision, setSelectedDivision,
        selectedProvince, setSelectedProvince,
        selectedMunicipality, setSelectedMunicipality,
        selectedDistrict, setSelectedDistrict,
        searchHistory, addToSearchHistory,
        accomplishmentRange, setAccomplishmentRange,
        minPhotos, setMinPhotos,
        pendingApprovalOnly, setPendingApprovalOnly,
        clearFilters
    } = useEFDFilters();
    const [fundingYears, setFundingYears] = useState([]);
    const [allBatches, setAllBatches] = useState([]);
    const [projectCategories, setProjectCategories] = useState([]);

    const [engineers, setEngineers] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [selectedEngineers, setSelectedEngineers] = useState([]);
    const [isAssigning, setIsAssigning] = useState(false);
    const [engineerSearchTerm, setEngineerSearchTerm] = useState('');
    const [isLogOpen, setIsLogOpen] = useState(false);
    const [logProject, setLogProject] = useState(null);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [selectedProjectForEdit, setSelectedProjectForEdit] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [efdLocations, setEfdLocations] = useState([]);
    const [pagination, setPagination] = useState(() => JSON.parse(sessionStorage.getItem('efd_cached_pagination')) || { total: 0, page: 1, limit: 12, totalPages: 1 });
    const [summaryData, setSummaryData] = useState(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [globalTotal, setGlobalTotal] = useState(0); 
    const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    
    // Restore scroll position after the first data load completes
    const scrollRestored = useRef(false);
    useEffect(() => {
        if (!loading && !scrollRestored.current) {
            const savedY = sessionStorage.getItem('efd_scrollY');
            if (savedY) {
                scrollRestored.current = true;
                const y = parseInt(savedY, 10);
                // Triple rAF + small timeout to ensure PageTransition and DOM are fully settled
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            setTimeout(() => {
                                window.scrollTo(0, y);
                                // Clear only after we've actually scrolled
                                sessionStorage.removeItem('efd_scrollY');
                            }, 50);
                        });
                    });
                });
            }
        }
    }, [loading]);

    // Persistent Pagination Sync
    useEffect(() => {
        sessionStorage.setItem('efd_currentPage', currentPage.toString());
    }, [currentPage]);
    
    // Debug Telemetry
    useEffect(() => {
        const DEBUG_MODE = false; // Toggle for local development
        if (DEBUG_MODE) {
            console.log("[EFD_CACHE] Hydrated projects count:", projects?.length);
            console.log("[EFD_CACHE] Current Page:", currentPage);
        }
    }, [projects, currentPage]);
    
    // Sync local search when context changes (e.g. clear filters)
    useEffect(() => {
        setLocalSearchQuery(searchQuery);
    }, [searchQuery]);

    // Debounce search update + history tracking
    useEffect(() => {
        const timer = setTimeout(() => {
            if (localSearchQuery !== searchQuery) {
                setSearchQuery(localSearchQuery);
                if (localSearchQuery.trim().length >= 2) {
                    addToSearchHistory(localSearchQuery);
                }
                setCurrentPage(1);
            }
        }, 800);
        return () => clearTimeout(timer);
    }, [localSearchQuery, searchQuery, setSearchQuery, addToSearchHistory]);

    // For UpdateWizard internal states (though Wizard handles most)

    const [internalFiles, setInternalFiles] = useState([]);
    const [externalFiles, setExternalFiles] = useState([]);
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);

    const itemsPerPage = 12;

    const userRole = useMemo(() => {
        let role = user?.role || localStorage.getItem('userRole') || "EFD Engineer";
        if (role === 'hrodi_engineer' || role === 'HRODI Engineer' || role === 'EFD' || role === 'HRODI') return 'EFD Engineer';
        if (role === 'deped_engineer' || role === 'DepEd Engineer') return 'Division Engineer';
        return role;
    }, [user]);

    const fetchSummary = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (searchQuery) params.append('search', searchQuery);
            if (selectedRegions.length > 0) params.append('region', selectedRegions.join(','));
            if (selectedCategories.length > 0) params.append('category', selectedCategories.join(','));
            if (selectedDivision) params.append('division', selectedDivision);
            if (selectedProvince) params.append('province', selectedProvince);
            if (selectedMunicipality) params.append('municipality', selectedMunicipality);
            if (selectedDistrict) params.append('district', selectedDistrict);
            if (selectedYears.length > 0) params.append('year', selectedYears.join(','));
            if (selectedBatches.length > 0) params.append('batch', selectedBatches.join(','));

            const res = await fetch(`/api/dashboard/efd-summary?${params.toString()}`);
            if (res.ok) setSummaryData(await res.json());
        } catch (error) {
            console.error("Error fetching summary:", error);
        }
    }, [searchQuery, selectedRegions, selectedCategories, selectedDivision, selectedProvince, selectedMunicipality, selectedDistrict, selectedYears, selectedBatches]);

    const fetchProjectsPaged = useCallback(async (p = 1) => {
        setIsRefreshing(true);
        try {
            const params = new URLSearchParams({
                page: p,
                limit: 12
            });
            if (searchQuery) params.append('search', searchQuery);
            if (selectedRegions.length > 0) params.append('region', selectedRegions.join(','));
            if (selectedCategories.length > 0) params.append('category', selectedCategories.join(','));
            if (selectedDivision) params.append('division', selectedDivision);
            if (selectedProvince) params.append('province', selectedProvince);
            if (selectedMunicipality) params.append('municipality', selectedMunicipality);
            if (selectedDistrict) params.append('district', selectedDistrict);
            if (selectedYears.length > 0) params.append('year', selectedYears.join(','));
            if (selectedBatches.length > 0) params.append('batch', selectedBatches.join(','));
            if (accomplishmentRange[0] > 0) params.append('acc_min', accomplishmentRange[0]);
            if (accomplishmentRange[1] < 100) params.append('acc_max', accomplishmentRange[1]);
            if (minPhotos > 0) params.append('min_photos', minPhotos);
            if (pendingApprovalOnly) params.append('approval_status', 'Pending');

            const res = await fetch(`/api/projects?${params.toString()}`);
            if (res.ok) {
                const result = await res.json();
                setProjects(result.data || []);
                const pagMeta = result.pagination || { total: result.data?.length || 0, page: p, limit: 12, totalPages: 1 };
                setPagination(pagMeta);
                
                // Cache for snap-back navigation
                sessionStorage.setItem('efd_cached_projects', JSON.stringify(result.data || []));
                sessionStorage.setItem('efd_cached_pagination', JSON.stringify(pagMeta));
            }
        } catch (error) {
            console.error("Error fetching projects:", error);
        } finally {
            setIsRefreshing(false);
            setLoading(false);
        }
    }, [searchQuery, selectedRegions, selectedCategories, selectedDivision, selectedProvince, selectedMunicipality, selectedDistrict, selectedYears, selectedBatches, accomplishmentRange, minPhotos, pendingApprovalOnly]);

    useEffect(() => {
        const fetchInitial = async () => {
            try {
                const [engRes, locRes, yearsRes, batchRes, categoryRes] = await Promise.all([
                    fetch('/api/engineers'),
                    fetch('/api/reference/efd-locations'),
                    fetch('/api/reference/funding-years'),
                    fetch('/api/reference/batch-of-funds'),
                    fetch('/api/reference/project-categories')
                ]);
                if (engRes.ok) setEngineers(await engRes.json());
                if (locRes.ok) setEfdLocations(await locRes.json());
                if (yearsRes.ok) setFundingYears(await yearsRes.json());
                if (batchRes.ok) setAllBatches(await batchRes.json());
                if (categoryRes.ok) setProjectCategories(await categoryRes.json());

                // One-time unfiltered total to lock in the inventory count
                try {
                    const globalRes = await fetch('/api/dashboard/efd-summary');
                    if (globalRes.ok) {
                        const globalData = await globalRes.json();
                        if (globalData?.totalStats?.totalProjects != null) {
                            setGlobalTotal(globalData.totalStats.totalProjects);
                        }
                    }
                } catch (e) { /* non-critical */ }

            } catch (error) {
                console.error("Error fetching initial monitoring references:", error);
            }
        };
        fetchInitial();
        setUserData(user);
    }, [user]);

    useEffect(() => {
        fetchSummary();
        fetchProjectsPaged(currentPage);
    }, [fetchSummary, fetchProjectsPaged, currentPage]);

    // Unique filter options
    const regions = useMemo(() => {
        const pArray = Array.isArray(projects) ? projects : [];
        const unique = [...new Set(pArray.map(p => p.region).filter(Boolean))];
        return unique.sort();
    }, [projects]);

    const categories = useMemo(() => {
        const pArray = Array.isArray(projects) ? projects : [];
        const unique = [...new Set(pArray.map(p => p.projectCategory).filter(Boolean))];
        return unique.sort();
    }, [projects]);

    const filteredProjects = projects;
    const totalPages = pagination.totalPages;
    const paginatedProjects = projects;

    const allYears = useMemo(() => {
        return [...new Set(fundingYears)].sort((a, b) => b - a);
    }, [fundingYears]);

    const handleNavigateToProject = useCallback((id) => {
        sessionStorage.setItem('efd_scrollY', window.scrollY.toString());
        navigate(`/project-details/${id}`);
    }, [navigate]);

    const handleFilterApply = useCallback((filters) => {
        setSelectedRegions(filters.regions || []);
        setSelectedDivision(filters.divisions?.[0] || '');
        setSelectedProvince(filters.province || '');
        setSelectedMunicipality(filters.municipality || '');
        setSelectedDistrict(filters.district || '');
        setSelectedCategories(filters.categories || []);
        setSelectedYears(filters.years || []);
        setSelectedBatches(filters.batches || []);
        setAccomplishmentRange(filters.accRange || [0, 100]);
        setMinPhotos(filters.minPhotos ?? 0);
        setPendingApprovalOnly(filters.pendingApprovalOnly ?? false);
        setCurrentPage(1);
    }, [setSelectedRegions, setSelectedDivision, setSelectedProvince, setSelectedMunicipality, setSelectedDistrict, setSelectedCategories, setSelectedYears, setSelectedBatches, setAccomplishmentRange, setMinPhotos, setPendingApprovalOnly]);

    const handleAssign = async () => {
        if (!selectedProject || selectedEngineers.length === 0) return;
        setIsAssigning(true);
        const selectedEngs = engineers.filter(e => selectedEngineers.includes(e.uid));
        const engineerIds = selectedEngs.map(e => e.uid).join(', ');
        const engineerNames = selectedEngs.map(e => `${e.firstName || ''} ${e.lastName || ''}`.trim()).join(', ');

        try {
            const response = await fetch('/api/assign-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: selectedProject.id,
                    engineerId: engineerIds,
                    engineerName: engineerNames
                })
            });

            if (response.ok) {
                setMessage({ text: 'Project assigned successfully!', type: 'success' });
                setProjects(prev => prev.map(p => 
                    p.id === selectedProject.id ? { ...p, engineerName: engineerNames, engineerId: engineerIds } : p
                ));
                setSelectedProject(null);
                setSelectedEngineers([]);
            } else {
                setMessage({ text: 'Failed to assign project', type: 'error' });
            }
        } catch (error) {
            setMessage({ text: 'Network error', type: 'error' });
        } finally {
            setIsAssigning(false);
            setTimeout(() => setMessage({ text: '', type: '' }), 3000);
        }
    };

    const handleDeleteProject = async (e, id) => {
        e.stopPropagation();
        if (window.confirm("Are you sure you want to delete this project?")) {
            try {
                const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
                if (res.ok) {
                    setProjects(prev => prev.filter(p => p.id !== id));
                    setMessage({ text: 'Project deleted successfully', type: 'success' });
                } else {
                    setMessage({ text: 'Failed to delete project', type: 'error' });
                }
            } catch (err) {
                setMessage({ text: 'Error deleting project', type: 'error' });
            }
            setTimeout(() => setMessage({ text: '', type: '' }), 3000);
        }
    };

    const handleApproveProject = async (e, id) => {
        e.stopPropagation();
        if (window.confirm("Approve this project?")) {
            try {
                const res = await fetch(`/api/approve-project/${id}`, { method: 'PUT' });
                if (res.ok) {
                    setProjects(prev => prev.map(p => p.id === id ? { ...p, approvalStatus: 'Approved' } : p));
                    setMessage({ text: 'Project approved successfully', type: 'success' });
                } else {
                    setMessage({ text: 'Failed to approve project', type: 'error' });
                }
            } catch (err) {
                setMessage({ text: 'Error approving project', type: 'error' });
            }
            setTimeout(() => setMessage({ text: '', type: '' }), 3000);
        }
    };

    const handleEditProject = (project) => {
        setSelectedProjectForEdit(project);
        setEditModalOpen(true);
    };

    const handleSaveProject = async (updatedProject) => {
        setIsUploading(true);
        try {
            const response = await fetch(`/api/update-project/${updatedProject.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedProject),
            });
            if (response.ok) {
                setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
                setMessage({ text: 'Project updated successfully!', type: 'success' });
                setEditModalOpen(false);
            } else {
                setMessage({ text: 'Failed to update project', type: 'error' });
            }
        } catch (error) {
            setMessage({ text: 'Error saving project', type: 'error' });
        } finally {
            setIsUploading(false);
            setTimeout(() => setMessage({ text: '', type: '' }), 3000);
        }
    };

    const handleFileUpload = (e) => {
        // Mock upload logic for internal states if needed by wizard
        const files = Array.from(e.target.files);
        console.log("Files selected:", files);
    };

    const formatAllocation = (val) => {
        if (!val) return '₱0.00';
        return `₱${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    };

    const pArray = Array.isArray(projects) ? projects : [];
    const allRegions = [...new Set(pArray.map(p => p.region).filter(Boolean))].sort();
    const allCategories = [...new Set(pArray.map(p => p.projectCategory).filter(Boolean))].sort();

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 pb-24">
                {/* Header Section */}
                <div className="bg-[#004A99] text-white pt-12 pb-20 px-6 rounded-b-[4rem] shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -ml-20 -mb-20"></div>
                    
                    <div className="max-w-7xl mx-auto relative z-10">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                            <div className="space-y-2">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-400/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-400/20 text-emerald-300">
                                        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
                                        System Active
                                    </div>
                                </div>
                                <h1 className="text-4xl font-black tracking-tight leading-tight">Project Monitoring</h1>
                                <p className="text-blue-100/70 text-sm font-medium max-w-xl">
                                    Track, manage and assign resources for regional infrastructure projects in real-time.
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-4">
                                <div className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-3xl border border-white/10 min-w-[140px]">
                                    <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-1 opacity-80">Total Projects</p>
                                    <h2 className="text-2xl font-black">{(globalTotal || summaryData?.totalStats?.totalProjects || 0).toLocaleString()}</h2>
                                </div>
                                <div className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-3xl border border-white/10 min-w-[140px]">
                                    <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-1 opacity-80">Filtered</p>
                                    <h2 className="text-2xl font-black text-blue-300">{pagination.total.toLocaleString()}</h2>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="max-w-7xl mx-auto px-6 -mt-10">
                    {/* Controls Bar */}
                    <div className="relative z-[60] bg-white/80 backdrop-blur-xl p-4 rounded-[2.5rem] shadow-xl border border-white/50 mb-8 space-y-4">
                        <div className="flex flex-col lg:flex-row gap-4">
                            {/* Search */}
                            <div className="relative flex-1 group">
                                <FiSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                                <input 
                                    type="text"
                                    placeholder="Quick search projects, schools, or IDs..."
                                    value={localSearchQuery}
                                    onChange={(e) => setLocalSearchQuery(e.target.value)}
                                    onFocus={() => setIsSearchFocused(true)}
                                    onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/5 transition-all"
                                />

                                {/* Search History Dropdown */}
                                {isSearchFocused && searchHistory.length > 0 && !localSearchQuery && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="p-3 border-b border-slate-50 bg-slate-50/50">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                <FiActivity size={10} /> Recent Searches
                                            </p>
                                        </div>
                                        <div className="max-h-[240px] overflow-y-auto no-scrollbar">
                                            {searchHistory.map((item, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => {
                                                        setLocalSearchQuery(item);
                                                        setSearchQuery(item);
                                                        setIsSearchFocused(false);
                                                    }}
                                                    className="w-full text-left px-4 py-3 text-xs font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center gap-3 border-b border-slate-50 last:border-none"
                                                >
                                                    <FiSearch size={12} className="opacity-40" />
                                                    {item}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Filters & Toggles */}
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1">
                                    <button 
                                        onClick={() => setViewMode('card')}
                                        className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === 'card' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        <FiGrid size={14} /> Cards
                                    </button>
                                    <button 
                                        onClick={() => setViewMode('table')}
                                        className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === 'table' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        <FiList size={14} /> Table
                                    </button>
                                </div>
                                <button 
                                    onClick={() => setIsFilterOpen(true)}
                                    className={`h-[54px] px-6 rounded-2xl flex items-center gap-3 font-black text-[11px] uppercase tracking-wider transition-all shadow-lg active:scale-95 ${ (selectedRegions.length > 0 || selectedCategories.length > 0 || selectedDivision || selectedProvince || selectedMunicipality || selectedDistrict) ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-white border border-slate-200 text-slate-600'}`}
                                >
                                    <FiFilter size={18} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="min-h-[400px]">
                        {((loading || isRefreshing) && (!projects || projects.length === 0)) ? (
                            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hydrating data stack...</p>
                            </div>
                        ) : viewMode === 'table' ? (
                            <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100">
                                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">ID</th>
                                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Project Details</th>
                                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Regional Location</th>
                                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {paginatedProjects.map((p) => (
                                                <tr 
                                                    key={p.id} 
                                                    className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
                                                    onClick={() => handleNavigateToProject(p.id)}
                                                >
                                                    <td className="px-8 py-6">
                                                        <span className="text-xs font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">{p.id}</span>
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <div className="flex flex-col">
                                                            <h4 className="text-sm font-black text-slate-800 group-hover:text-blue-700 transition-colors uppercase leading-tight">{p.projectName}</h4>
                                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{p.projectCategory || 'General Infrastructure'}</p>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <div className="flex items-center gap-2">
                                                            <FiMapPin size={12} className="text-blue-500" />
                                                            <span className="text-xs font-bold text-slate-600 uppercase tracking-tight">{p.region} • {p.division}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <div className="flex flex-col items-center gap-1.5">
                                                            <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full border ${
                                                                p.status?.toLowerCase().includes('ongoing') ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                                p.status?.toLowerCase().includes('completed') ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                                'bg-slate-50 text-slate-500 border-slate-100'
                                                            }`}>
                                                                {p.status || 'Pending'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-6 text-right">
                                                        <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                                                            <button 
                                                                onClick={() => handleEditProject(p)}
                                                                className="p-2.5 text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-600 hover:text-white transition-all"
                                                            >
                                                                <FiEdit2 size={16} />
                                                            </button>
                                                            <button 
                                                                onClick={(e) => handleDeleteProject(e, p.id)}
                                                                className="p-2.5 text-red-500 bg-red-50 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                                                            >
                                                                <FiTrash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                {paginatedProjects.map((p) => {
                                    const hasEng = p.engineerName && p.engineerName !== 'UNASSIGNED';
                                    const progress = parseInt(p.accomplishmentPercentage || 0);
                                    const prevProgress = p.previousPercentage !== null ? parseInt(p.previousPercentage) : null;
                                    const showsProgression = prevProgress !== null && prevProgress !== progress;

                                    return (
                                        <div 
                                            key={p.id} 
                                            onClick={() => handleNavigateToProject(p.id)}
                                            className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col group cursor-pointer relative"
                                        >


                                            <div className="p-6 space-y-4 flex-1">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[8px] font-black uppercase rounded-full border border-blue-100 tracking-widest leading-normal">
                                                                {p.projectCategory || 'General'}
                                                            </span>
                                                        </div>
                                                        <h3 className="text-sm font-black text-slate-800 uppercase line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">
                                                            {p.projectName}
                                                        </h3>
                                                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter truncate mt-0.5">
                                                            IPC: {p.ipc || 'TBD'}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1 ml-3 flex-shrink-0">
                                                        <div className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 flex items-center justify-center text-[11px] font-black shadow-sm min-w-[40px]">
                                                            {showsProgression && (
                                                                <>
                                                                    <span className="text-[9px] text-red-500 mr-1 font-bold tracking-tighter">
                                                                        {prevProgress}%
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-300 mx-1 font-bold">→</span>
                                                                </>
                                                            )}
                                                            <span className="text-emerald-600 font-black text-base">{progress}%</span>
                                                        </div>
                                                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter italic pr-1">
                                                            As of {p.statusAsOf ? new Date(p.statusAsOf).toLocaleDateString() : 'No Update'}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center border border-slate-100 flex-shrink-0">
                                                        <FiMapPin size={14} />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-0.5">School Location</span>
                                                        <p className="text-[11px] font-black text-slate-700 uppercase leading-tight">
                                                            {p.schoolName}
                                                            <span className="mx-1 text-slate-300">|</span>
                                                            {p.schoolId}
                                                        </p>
                                                        <p className="text-[8px] font-bold text-slate-400 uppercase mt-1 tracking-tight leading-tight">
                                                            {[p.region, p.province, p.division, p.municipality, (p.legislative_district || p.district)].filter(Boolean).join(' | ')}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="pt-2 px-1 space-y-4">
                                                    {/* Procurement Status */}
                                                    <div className="flex flex-col gap-1.5 px-1">
                                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Procurement Status</label>
                                                        <div className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[10px] font-bold text-slate-700">
                                                            {p.procurement_status || 'Not Yet Procured'}
                                                        </div>
                                                    </div>

                                                    {/* Construction Status */}
                                                    <div className="flex flex-col gap-1.5 px-1">
                                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Construction Status</label>
                                                        <div className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[10px] font-bold text-slate-700">
                                                            {p.status || 'Not Yet Started'}
                                                        </div>
                                                    </div>


                                                </div>
                                            </div>

                                            <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex flex-col gap-2 mt-auto">
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        disabled={!p.imagesCount || Number(p.imagesCount) === 0}
                                                        onClick={(e) => { e.stopPropagation(); navigate(`/project-gallery/${p.id}`); }}
                                                        title={!p.imagesCount || Number(p.imagesCount) === 0 ? 'No photos uploaded yet' : `View ${p.imagesCount} photo${p.imagesCount !== 1 ? 's' : ''}`}
                                                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all shadow-sm active:scale-[0.98] border ${
                                                            !p.imagesCount || Number(p.imagesCount) === 0
                                                                ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed opacity-60'
                                                                : 'bg-purple-50 text-purple-600 border-purple-100/50 hover:bg-purple-600 hover:text-white cursor-pointer'
                                                        }`}
                                                    >
                                                        <FiImage size={14} />
                                                        Gallery{p.imagesCount > 0 ? ` (${p.imagesCount})` : ''}
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setLogProject(p); setIsLogOpen(true); }}
                                                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-amber-50 text-amber-600 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] hover:bg-amber-500 hover:text-white transition-all shadow-sm active:scale-[0.98] border border-amber-100/50"
                                                    >
                                                        <FiActivity size={14} />
                                                        Project Log
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {p.approvalStatus === 'Pending' && (
                                                        <button
                                                            onClick={(e) => handleApproveProject(e, p.id)}
                                                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-50 text-emerald-600 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] hover:bg-emerald-600 hover:text-white transition-all shadow-sm active:scale-[0.98] border border-emerald-100/50"
                                                        >
                                                            <FiCheck size={14} />
                                                            Approve
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={(e) => handleDeleteProject(e, p.id)}
                                                        className="p-2.5 flex items-center justify-center bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all active:scale-[0.98] border border-red-100/50"
                                                    >
                                                        <FiTrash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="mt-12 flex items-center justify-center gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="px-5 py-3 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 disabled:opacity-40 hover:bg-blue-50 hover:text-blue-600 transition-all shadow-sm active:scale-95"
                            >
                                Previous
                            </button>
                            <div className="flex gap-1.5">
                                {[...Array(totalPages)].map((_, i) => {
                                    const page = i + 1;
                                    if (totalPages > 5 && (page < currentPage - 1 || page > currentPage + 1) && page !== 1 && page !== totalPages) {
                                        if (page === currentPage - 2 || page === currentPage + 2) return <span key={page} className="w-5 flex items-center justify-center text-slate-300">...</span>;
                                        return null;
                                    }
                                    return (
                                        <button
                                            key={page}
                                            onClick={() => setCurrentPage(page)}
                                            className={`w-10 h-10 rounded-xl text-[10px] font-black transition-all ${currentPage === page ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' : 'bg-white border border-slate-200 text-slate-400 hover:bg-slate-50'}`}
                                        >
                                            {page}
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className="px-5 py-3 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 disabled:opacity-40 hover:bg-blue-50 hover:text-blue-600 transition-all shadow-sm active:scale-95"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>

                {/* Assignment Modal/Overlay */}
                {selectedProject && createPortal(
                    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300 px-4">
                        <div className="bg-white w-full max-w-xl rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col relative px-4 sm:px-8">
                            <button 
                                onClick={() => {
                                    setSelectedProject(null);
                                    setEngineerSearchTerm('');
                                    setSelectedEngineers([]);
                                }}
                                className="absolute top-6 right-6 p-2 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
                            >
                                <FiX size={20} />
                            </button>
                            
                            <div className="mb-6">
                                <h2 className="text-xl font-black text-slate-800">Assign Engineer</h2>
                                <p className="text-xs text-slate-400 font-medium">Assignment for project: <span className="text-blue-600 font-bold">{selectedProject.projectName}</span></p>
                            </div>

                            <div className="space-y-4 mb-8 h-full flex flex-col min-h-0">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Active Engineer</label>
                                
                                {/* Engineer Search Bar */}
                                <div className="relative group mb-2">
                                    <input 
                                        type="text"
                                        placeholder="Search engineer name or division..."
                                        value={engineerSearchTerm}
                                        onChange={(e) => setEngineerSearchTerm(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/5 transition-all placeholder:text-slate-300"
                                    />
                                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-500" size={16} />
                                </div>

                                <div className="grid grid-cols-1 gap-2 overflow-y-auto pr-2 custom-scrollbar flex-1 min-h-0">
                                    {(engineers || []).filter(eng => {
                                        const search = engineerSearchTerm.toLowerCase();
                                        const matchesSearch = eng.firstName?.toLowerCase().includes(search) || 
                                               eng.lastName?.toLowerCase().includes(search) || 
                                               eng.division?.toLowerCase().includes(search);
                                        
                                        const isDivEng = eng.role === 'Division Engineer' || eng.role === 'deped_engineer' || eng.account_category === 'Division Engineer' || eng.account_category === 'deped_engineer' || eng.account_category === 'DepEd Engineer';
                                        
                                        const projReg = selectedProject?.region?.trim().toLowerCase() || '';
                                        const engReg = eng.region?.trim().toLowerCase() || '';
                                        const matchesReg = !projReg || !engReg || projReg === engReg;

                                        const projDiv = selectedProject?.division?.trim().toLowerCase() || '';
                                        const engDiv = eng.division?.trim().toLowerCase() || '';
                                        const matchesDiv = !projDiv || !engDiv || engDiv === projDiv;
                                        
                                        return isDivEng && matchesReg && matchesDiv && matchesSearch;
                                    }).map((eng) => {
                                        const isSelected = selectedEngineers.includes(eng.uid);
                                        return (
                                        <button
                                            key={eng.uid}
                                            onClick={() => {
                                                setSelectedEngineers(prev => 
                                                    prev.includes(eng.uid) ? prev.filter(id => id !== eng.uid) : [...prev, eng.uid]
                                                );
                                            }}
                                            className={`flex items-center justify-between p-4 rounded-2xl transition-all border-2 ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-50 border-transparent text-slate-700 hover:bg-slate-100'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${isSelected ? 'bg-white/20' : 'bg-white'}`}>
                                                    {eng.firstName?.[0]}
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-sm font-bold">{eng.firstName} {eng.lastName}</p>
                                                    <p className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                                                        {eng.division} • {eng.position || 'Engineer'}
                                                    </p>
                                                </div>
                                            </div>
                                            {isSelected && <FiCheck size={20} />}
                                        </button>
                                    )}) }
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 mt-auto">
                                <button 
                                    onClick={() => {
                                        setSelectedProject(null);
                                        setEngineerSearchTerm('');
                                        setSelectedEngineers([]);
                                    }}
                                    className="w-full py-4 rounded-2xl bg-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleAssign}
                                    disabled={selectedEngineers.length === 0 || isAssigning}
                                    className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold text-sm shadow-xl shadow-blue-500/30 active:scale-[0.98] transition-all disabled:opacity-50"
                                >
                                    {isAssigning ? 'Updating...' : 'Confirm Assignment'}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

                {/* Edit Modal */}
                {/* Hidden Inputs for Photos */}
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                <input type="file" ref={cameraInputRef} onChange={handleFileUpload} accept="image/*" capture="environment" className="hidden" />

                <UpdateProjectWizard
                    project={selectedProjectForEdit}
                    isOpen={editModalOpen}
                    onClose={() => setEditModalOpen(false)}
                    isUploading={isUploading}
                    onSave={async (updatedProject, wizardInternalFiles, wizardExternalFiles) => {
                        const prevInternal = internalFiles;
                        const prevExternal = externalFiles;
                        setInternalFiles(wizardInternalFiles || []);
                        setExternalFiles(wizardExternalFiles || []);
                        await handleSaveProject(updatedProject);
                        setInternalFiles(prevInternal);
                        setExternalFiles(prevExternal);
                    }}
                />
                {message.text && (
                    <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[3000] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 ${message.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                        {message.type === 'success' ? <FiCheck size={20} /> : <FiAlertCircle size={20} />}
                        <p className="text-sm font-bold">{message.text}</p>
                        <button onClick={() => setMessage({ text: '', type: '' })} className="ml-2 hover:opacity-70"><FiX /></button>
                    </div>
                )}

                <BottomNav userRole={userRole} />
            </div>
            <ProjectLogModal 
                isOpen={isLogOpen} 
                onClose={() => setIsLogOpen(false)} 
                project={logProject} 
            />
            <FilterDrawer
                isOpen={isFilterOpen}
                onClose={() => setIsFilterOpen(false)}
                onApply={handleFilterApply}
                projects={projects}
                locations={efdLocations}
                initialRegions={selectedRegions}
                initialDivisions={selectedDivision ? [selectedDivision] : []}
                initialCategories={selectedCategories}
                initialYears={selectedYears}
                initialBatches={selectedBatches}
                initialAccRange={accomplishmentRange}
                initialMinPhotos={minPhotos}
                initialPendingApproval={pendingApprovalOnly}
                showPendingApproval={true}
                yearOptions={fundingYears}
                batchOptions={allBatches}
                categoryOptions={projectCategories}
            />
        </PageTransition>
    );
};

export default EFDMonitoring;
