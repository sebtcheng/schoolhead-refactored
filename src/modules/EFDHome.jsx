import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiFilter, FiSearch, FiLayers, FiList, FiTrendingUp, FiMapPin, FiChevronRight, FiAlertCircle, FiChevronDown, FiCheckSquare, FiTrash2, FiGrid, FiEdit2, FiUserPlus, FiImage, FiPlus, FiX, FiCheck } from 'react-icons/fi';
import { LuClipboardList, LuCalendar, LuDollarSign, LuActivity } from "react-icons/lu";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, LabelList, Legend } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useEFDFilters } from '../context/EFDFilterContext';
import BottomNav from './BottomNav';
import PageTransition from '../components/PageTransition';
import EditProjectModal from '../components/EditProjectModal';
import { createPortal } from 'react-dom';
import ProjectLogModal from '../components/ProjectLogModal';
import FilterDrawer from '../components/FilterDrawer';
import { FiActivity } from 'react-icons/fi';

const MultiSelectDropdown = ({ label, options, selected, onChange, icon: Icon }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    return (
        <div className="relative group flex-1 min-w-[200px]">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-4 py-3 bg-white/60 backdrop-blur-md border border-white/40 rounded-2xl shadow-sm text-sm font-bold text-slate-700 hover:bg-white/80 transition-all text-left"
            >
                <div className="flex items-center gap-2 truncate">
                    {Icon && <Icon size={14} className="text-blue-500" />}
                    <span className="truncate">{selected.length > 0 ? `${label} (${selected.length})` : `Select ${label}`}</span>
                </div>
                <FiChevronDown className={`shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-[100]" onClick={() => setIsOpen(false)}></div>
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[101] py-2 max-h-[300px] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-200">
                        <div 
                            onClick={() => onChange([])}
                            className="px-4 py-2 hover:bg-blue-50 text-[10px] font-black text-blue-600 uppercase tracking-widest cursor-pointer border-b border-slate-50 mb-1"
                        >
                            Reset {label}
                        </div>
                        {options.map(option => (
                            <div 
                                key={option}
                                onClick={() => {
                                    const next = selected.includes(option) 
                                        ? selected.filter(s => s !== option)
                                        : [...selected, option];
                                    onChange(next);
                                }}
                                className="px-4 py-2 hover:bg-slate-50 flex items-center justify-between cursor-pointer group/item"
                            >
                                <span className={`text-xs ${selected.includes(option) ? 'text-blue-600 font-bold' : 'text-slate-600 font-medium'}`}>
                                    {option}
                                </span>
                                {selected.includes(option) && <FiCheckSquare size={14} className="text-blue-500" />}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

const formatLargeCurrency = (value) => {
    if (value >= 1e12) return `₱${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `₱${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `₱${(value / 1e6).toFixed(2)}M`;
    return `₱${value.toLocaleString()}`;
};

const formatLargeNumber = (value) => {
    if (value >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    return value.toLocaleString();
};

const EFDHome = () => {
    const { user, token } = useAuth();
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userData, setUserData] = useState(null);
    const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem('efd_activeTab') || 'summary');
    const [viewMode, setViewMode] = useState('card'); 
    const [engineers, setEngineers] = useState([]);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [selectedProjectForAssignment, setSelectedProjectForAssignment] = useState(null);
    const [selectedEngineers, setSelectedEngineers] = useState([]);
    const [isAssigning, setIsAssigning] = useState(false);
    const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
    const [engineerSearchTerm, setEngineerSearchTerm] = useState('');
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [selectedProjectForEdit, setSelectedProjectForEdit] = useState(null);
    const [isLogOpen, setIsLogOpen] = useState(false);
    const [logProject, setLogProject] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [internalFiles, setInternalFiles] = useState([]);
    const [internalPreviews, setInternalPreviews] = useState([]);
    const [externalFiles, setExternalFiles] = useState([]);
    const [externalPreviews, setExternalPreviews] = useState([]);
    const [activeCategory, setActiveCategory] = useState(null);
    const [summaryData, setSummaryData] = useState(null);
    const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 15, totalPages: 1 });
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);
    
    useEffect(() => {
        sessionStorage.setItem('efd_activeTab', activeTab);
    }, [activeTab]);

    // Restore scroll position after the first data load completes
    const scrollRestored = useRef(false);
    useEffect(() => {
        if (!loading && !scrollRestored.current) {
            const savedY = sessionStorage.getItem('efd_scrollY');
            if (savedY) {
                scrollRestored.current = true;
                const y = parseInt(savedY, 10);
                // Triple rAF + small timeout for maximum stability
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            setTimeout(() => {
                                window.scrollTo(0, y);
                                // Cleanup AFTER scroll
                                sessionStorage.removeItem('efd_scrollY');
                            }, 50);
                        });
                    });
                });
            }
        }
    }, [loading]);

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
        selectedSource, setSelectedSource,
        selectedDonated, setSelectedDonated,
        selectedDocStatus, setSelectedDocStatus,
        searchHistory, addToSearchHistory,
        accomplishmentRange, setAccomplishmentRange,
        minPhotos, setMinPhotos,
        clearFilters
    } = useEFDFilters();

    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(() => {
        const saved = sessionStorage.getItem('efd_currentPage');
        return saved ? parseInt(saved, 10) : 1;
    });
    const [fundingYears, setFundingYears] = useState([]);
    const [allBatches, setAllBatches] = useState([]);
    const [projectCategories, setProjectCategories] = useState([]);
    const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
    const [globalTotal, setGlobalTotal] = useState(0); // fixed total inventory, never filtered
    const [efdLocations, setEfdLocations] = useState([]);
    const [isBeffMode, setIsBeffMode] = useState(() => window.location.pathname.toLowerCase().includes('beff'));
    const [chartMetric, setChartMetric] = useState('count'); // 'count' or 'abc'
    const [userRole, setUserRole] = useState(() => {
        let role = user?.role || localStorage.getItem('userRole') || "EFD Engineer";
        if (role === 'hrodi_engineer' || role === 'HRODI Engineer' || role === 'EFD' || role === 'HRODI') return 'EFD Engineer';
        if (role === 'deped_engineer' || role === 'DepEd Engineer') return 'Division Engineer';
        return role;
    });

    // Persistent Pagination Sync
    useEffect(() => {
        sessionStorage.setItem('efd_currentPage', currentPage.toString());
    }, [currentPage]);

    // Debounce: update shared searchQuery 800ms after user stops typing
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearchQuery(localSearchQuery);
            if (localSearchQuery.trim().length >= 2) {
                addToSearchHistory(localSearchQuery);
            }
            setCurrentPage(1); // reset pagination on new search
        }, 800);
        return () => clearTimeout(timer);
    }, [localSearchQuery]);

    // Sync local input when searchQuery is reset externally (e.g. Clear Filters)
    useEffect(() => {
        setLocalSearchQuery(searchQuery);
    }, [searchQuery]);

    // Building Standards State
    const [dataMode, setDataMode] = useState('masterlist');
    const [drillDownLevel, setDrillDownLevel] = useState('storey'); 
    const [selectedStorey, setSelectedStorey] = useState(null);
    const [storeyBreakdown, setStoreyBreakdown] = useState([]);
 
    useEffect(() => {
        const syncUser = () => {
            // EFD/HRODI roles: prioritize user.role over account_category because the
            // login API may have set account_category = 'DepEd Engineer' for these users,
            // which would incorrectly resolve to 'Division Engineer' nav items.
            const roleField = user?.role || '';
            const efdRoles = ['EFD', 'HRODI', 'EFD Engineer', 'hrodi_engineer', 'HRODI Engineer'];
            const currentRole = efdRoles.includes(roleField)
                ? roleField
                : (user?.account_category || user?.role || localStorage.getItem('userRole'));
            if (currentRole) {
                let normalized = currentRole;
                if (normalized === 'hrodi_engineer' || normalized === 'HRODI Engineer' || normalized === 'EFD' || normalized === 'HRODI') normalized = 'EFD Engineer';
                if (normalized === 'deped_engineer' || normalized === 'DepEd Engineer') normalized = 'Division Engineer';
                setUserRole(normalized);
            }
            if (user) {
                setUserData(user);
            }
        };
        syncUser();
    }, [user, user?.uid]);

    const handleClearFilters = () => {
        clearFilters();
        setCurrentPage(1);
    };

    const handleNavigateToProject = useCallback((id) => {
        sessionStorage.setItem('efd_scrollY', window.scrollY.toString());
        navigate(`/project-details/${id}`);
    }, [navigate]);

    const handleFilterApply = useCallback(({ regions, divisions, categories, years, province, municipality, district, batches, accRange, minPhotos: mp }) => {
        setSelectedRegions(regions || []);
        setSelectedDivision(divisions?.[0] || '');
        setSelectedProvince(province || '');
        setSelectedMunicipality(municipality || '');
        setSelectedDistrict(district || '');
        setSelectedCategories(categories || []);
        setSelectedYears(years || []);
        setSelectedBatches(batches || []);
        setAccomplishmentRange(accRange || [0, 100]);
        setMinPhotos(mp ?? 0);
        setCurrentPage(1);
    }, [setAccomplishmentRange, setMinPhotos]);

    const allCategories = [
        "New Construction",
        "Repair and Rehab",
        "Last Mile Schools",
        "Health facilities",
        "Gabaldon Restoration",
        "Library Hub",
        "SpEd Inclusive Learning Resource Centers (ILRC)",
        "Alternative Learning System - Community Based Learning Centers (ALS-CLC)",
        "Midrise School Building",
        "QRF",
        "Electrification",
        "Uncategorized"
    ];

    const normalizeCategory = (cat) => {
        if (!cat) return "Uncategorized";
        const upper = cat.trim().toUpperCase();
        if (upper === 'NEW CONSTRUCTION') return "New Construction";
        if (upper === 'REPAIR' || upper === 'REPAIR AND REHAB') return "Repair and Rehab";
        if (upper === 'LMS' || upper === 'LAST MILE SCHOOLS') return "Last Mile Schools";
        if (upper === 'GABALDON' || upper === 'GABALDON RESTORATION') return "Gabaldon Restoration";
        if (upper === 'ILRC' || upper === 'SPED INCLUSIVE LEARNING RESOURCE CENTERS (ILRC)') return "SpEd Inclusive Learning Resource Centers (ILRC)";
        if (upper === 'ALS-CLC' || upper === 'ALTERNATIVE LEARNING SYSTEM - COMMUNITY BASED LEARNING CENTERS (ALS-CLC)') return "Alternative Learning System - Community Based Learning Centers (ALS-CLC)";
        if (upper === 'LIBRARY HUB') return "Library Hub";
        if (upper === 'SCHOOL HEALTH FACILITIES' || upper === 'HEALTH FACILITIES') return "Health facilities";
        if (upper === 'ELECTRIFICATION') return "Electrification";
        if (upper === 'MIDRISE SCHOOL BUILDING') return "Midrise School Building";
        if (upper === 'QRF') return "QRF";
        
        // Final fallback: Match against allCategories case-insensitively
        const found = allCategories.find(c => c.toUpperCase() === upper);
        return found || cat; // Keep original if no match found
    };

    const categoryColors = {
        "New Construction": "#3b82f6",
        "Repair and Rehab": "#10b981",
        "Last Mile Schools": "#f59e0b",
        "Health facilities": "#ec4899",
        "Gabaldon Restoration": "#8b5cf6",
        "Library Hub": "#06b6d4",
        "SpEd Inclusive Learning Resource Centers (ILRC)": "#6366f1",
        "Alternative Learning System - Community Based Learning Centers (ALS-CLC)": "#f43f5e",
        "Midrise School Building": "#fbbf24",
        "QRF": "#ef4444",
        "Electrification": "#eab308",
        "Uncategorized": "#94a3b8"
    };

    // Colors for Pie Chart
    const COLORS = [
        '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#d0ed57', '#a4de6c', '#8dd1e1'
    ];

    const fetchSummary = useCallback(async () => {
        if (!user) return;
        try {
            const params = new URLSearchParams({
                engineer_id: user.uid,
                is_donated: selectedDonated,
                region: selectedRegions[0] || '',
                division: selectedDivision,
                province: selectedProvince,
                municipality: selectedMunicipality,
                district: selectedDistrict,
                search: searchQuery,
                category: selectedCategories[0] || '',
                year: selectedYears[0] || '',
                batch: selectedBatches[0] || ''
            });
            const res = await fetch(`/api/dashboard/efd-summary?${params.toString()}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (res.ok) {
                const data = await res.json();
                setSummaryData(data);
            }
        } catch (error) {
            console.error("Error fetching summary:", error);
        }
    }, [user, token, selectedDonated, selectedRegions, selectedDivision, selectedProvince, selectedMunicipality, selectedDistrict, searchQuery, selectedCategories, selectedYears, selectedBatches]);

    const fetchProjectsPaged = useCallback(async (p = 1) => {
        if (!user) return;
        setLoading(true);
        try {
            const params = new URLSearchParams({
                engineer_id: user.uid,
                is_donated: selectedDonated,
                region: selectedRegions[0] || '',
                division: selectedDivision,
                province: selectedProvince,
                municipality: selectedMunicipality,
                district: selectedDistrict,
                search: searchQuery,
                category: selectedCategories[0] || '',
                year: selectedYears[0] || '',
                batch: selectedBatches[0] || '',
                page: p,
                limit: 15
            });
            const res = await fetch(`/api/projects?${params.toString()}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (res.ok) {
                const result = await res.json();
                setProjects(result.data || []);
                setPagination(result.pagination);
            }
        } catch (error) {
            console.error("Error fetching projects:", error);
        } finally {
            setLoading(false);
        }
    }, [user, token, selectedDonated, selectedRegions, selectedDivision, selectedProvince, selectedMunicipality, selectedDistrict, searchQuery, selectedCategories, selectedYears, selectedBatches]);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                if (!user) return;
                setUserData(user);

                const [fyRes, locRes, engRes, batchRes, globalRes, categoryRes] = await Promise.all([
                    fetch('/api/reference/funding-years', { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
                    fetch('/api/reference/efd-locations', { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
                    fetch('/api/engineers', { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
                    fetch('/api/reference/batch-of-funds', { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
                    fetch(`/api/dashboard/efd-summary?engineer_id=${user.uid}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
                    fetch('/api/reference/project-categories', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
                ]);

                const [fyData, locData, engData, batchData, globalData, categoryData] = await Promise.all([
                    fyRes.ok ? fyRes.json() : [],
                    locRes.ok ? locRes.json() : [],
                    engRes.ok ? engRes.json() : [],
                    batchRes.ok ? batchRes.json() : [],
                    globalRes.ok ? globalRes.json() : null,
                    categoryRes.ok ? categoryRes.json() : []
                ]);

                setFundingYears(fyData);
                setEfdLocations(locData);
                setEngineers(engData);
                setAllBatches(batchData);
                setProjectCategories(categoryData);
                if (globalData?.totalStats?.totalProjects != null) {
                    setGlobalTotal(globalData.totalStats.totalProjects);
                }

            } catch (error) {
                console.error("Error fetching reference data:", error);
            }
        };

        fetchInitialData();
    }, [user, token]);

    useEffect(() => {
        fetchSummary();
    }, [fetchSummary]);

    useEffect(() => {
        fetchProjectsPaged(currentPage);
    }, [fetchProjectsPaged, currentPage]);

    useEffect(() => {
        const loadBreakdown = async () => {
            try {
                const endpoint = dataMode === 'masterlist' 
                    ? '/api/masterlist/storey-breakdown' 
                    : '/api/monitoring/engineer-storey-breakdown';
                const res = await fetch(endpoint, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });
                if (res.ok) {
                    const data = await res.json();
                    setStoreyBreakdown(data);
                }
            } catch (err) {
                console.error("Load Breakdown Error:", err);
            }
        };
        loadBreakdown();
    }, [dataMode, token]);

    const storeyAggregated = useMemo(() => {
        const counts = {};
        storeyBreakdown.forEach(item => {
            const s = Number(item.storey);
            counts[s] = (counts[s] || 0) + Number(item.count);
        });
        return Object.entries(counts).map(([s, count]) => ({
            name: `${s}sty`,
            count,
            storey: Number(s)
        })).sort((a, b) => a.storey - b.storey);
    }, [storeyBreakdown]);

    const prototypeAggregated = useMemo(() => {
        if (!selectedStorey) return [];
        return storeyBreakdown
            .filter(item => Number(item.storey) === selectedStorey)
            .map(item => ({
                name: `${item.storey}sty ${item.classrooms}cl`,
                count: Number(item.count),
                storey: item.storey,
                classrooms: item.classrooms
            })).sort((a, b) => a.classrooms - b.classrooms);
    }, [storeyBreakdown, selectedStorey]);

    const activeChartData = drillDownLevel === 'storey' ? storeyAggregated : prototypeAggregated;

    const normalize = (val) => val?.toString().trim().toUpperCase() || 'UNASSIGNED';

    const regionalData = useMemo(() => {
        if (!summaryData?.regionalData) return [];
        const stats = {};
        summaryData.regionalData.forEach(item => {
            const reg = normalize(item.name);
            const cat = normalizeCategory(item.category || 'Uncategorized');
            if (!stats[reg]) stats[reg] = { name: reg, totalValue: 0 };
            const val = chartMetric === 'count' ? parseInt(item.count || 0) : parseFloat(item.total_abc || 0);
            stats[reg][cat] = (stats[reg][cat] || 0) + val;
            stats[reg].totalValue += val;
            stats[reg].labelAnchor = 0;
        });
        return Object.values(stats).sort((a, b) => b.totalValue - a.totalValue);
    }, [summaryData, chartMetric]);

    const allRegions = useMemo(() => {
        const regions = new Set();
        efdLocations.forEach(loc => {
            if (loc.region) regions.add(loc.region.trim().toUpperCase());
        });
        return Array.from(regions).sort();
    }, [efdLocations]);

    const allDivisions = useMemo(() => {
        if (selectedRegions.length === 0) return [];
        const set = new Set();
        efdLocations
            .filter(loc => selectedRegions.some(reg => normalize(loc.region) === normalize(reg)))
            .forEach(loc => { if (loc.division) set.add(loc.division.trim().toUpperCase()); });
        return Array.from(set).sort();
    }, [efdLocations, selectedRegions]);

    const allProvinces = useMemo(() => {
        if (selectedRegions.length === 0) return [];
        const set = new Set();
        efdLocations
            .filter(loc => selectedRegions.some(reg => normalize(loc.region) === normalize(reg)))
            .filter(loc => !selectedDivision || normalize(loc.division) === normalize(selectedDivision))
            .forEach(loc => { if (loc.province) set.add(loc.province.trim().toUpperCase()); });
        return Array.from(set).sort();
    }, [efdLocations, selectedRegions, selectedDivision]);

    const allMunicipalities = useMemo(() => {
        if (selectedRegions.length === 0) return [];
        const set = new Set();
        efdLocations
            .filter(loc => selectedRegions.some(reg => normalize(loc.region) === normalize(reg)))
            .filter(loc => !selectedDivision || normalize(loc.division) === normalize(selectedDivision))
            .filter(loc => !selectedProvince || normalize(loc.province) === normalize(selectedProvince))
            .forEach(loc => { if (loc.municipality) set.add(loc.municipality.trim().toUpperCase()); });
        return Array.from(set).sort();
    }, [efdLocations, selectedRegions, selectedDivision, selectedProvince]);

    const allDistricts = useMemo(() => {
        if (selectedRegions.length === 0) return [];
        const set = new Set();
        efdLocations
            .filter(loc => selectedRegions.some(reg => normalize(loc.region) === normalize(reg)))
            .filter(loc => !selectedDivision || normalize(loc.division) === normalize(selectedDivision))
            .filter(loc => !selectedProvince || normalize(loc.province) === normalize(selectedProvince))
            .filter(loc => !selectedMunicipality || normalize(loc.municipality) === normalize(selectedMunicipality))
            .forEach(loc => { if (loc.legislative_district) set.add(loc.legislative_district.trim().toUpperCase()); });
        return Array.from(set).sort();
    }, [efdLocations, selectedRegions, selectedDivision, selectedProvince, selectedMunicipality]);

    const allYears = useMemo(() => {
        return [...new Set(fundingYears)].sort((a, b) => b - a);
    }, [fundingYears]);

    const divisionData = useMemo(() => {
        if (!summaryData?.divisionData) return [];
        const stats = {};
        summaryData.divisionData.forEach(item => {
            const div = normalize(item.name);
            const cat = normalizeCategory(item.category || 'Uncategorized');
            if (!stats[div]) stats[div] = { name: div, totalValue: 0 };
            const val = chartMetric === 'count' ? parseInt(item.count || 0) : parseFloat(item.total_abc || 0);
            stats[div][cat] = (stats[div][cat] || 0) + val;
            stats[div].totalValue += val;
            stats[div].labelAnchor = 0;
        });
        return Object.values(stats).sort((a, b) => b.totalValue - a.totalValue);
    }, [summaryData, chartMetric]);

    const pieChartData = useMemo(() => {
        if (!summaryData?.categoryData) return [];
        const aggregated = {};
        summaryData.categoryData.forEach(item => {
            const name = normalizeCategory(item.name || 'Uncategorized');
            aggregated[name] = (aggregated[name] || 0) + parseInt(item.value || 0);
        });
        return Object.entries(aggregated).map(([name, value]) => ({
            name,
            value
        })).sort((a, b) => b.value - a.value);
    }, [summaryData]);

    const yearData = useMemo(() => {
        if (!summaryData?.yearData) return [];
        return summaryData.yearData.map(item => ({
            name: `FY ${item.name || 'N/A'}`,
            value: parseInt(item.count || 0)
        })).sort((a, b) => a.name.localeCompare(b.name));
    }, [summaryData]);





    const filteredProjects = useMemo(() => {
        if (!Array.isArray(projects)) return [];
        return projects.filter(p => {
            const matchesSearch = !searchQuery ||
                p.projectName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.schoolName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.school_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.schoolId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.division?.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesRegion = selectedRegions.length === 0 ||
                selectedRegions.some(reg => p.region?.toUpperCase() === reg.toUpperCase());

            const matchesDivision = !selectedDivision ||
                p.division?.toUpperCase() === selectedDivision.toUpperCase();

            const matchesCategory = selectedCategories.length === 0 ||
                selectedCategories.includes(p.category || p.project_category || p.projectCategory);

            const acc = parseInt(p.accomplishmentPercentage ?? p.accomplishment_percentage ?? 0);
            const matchesAccRange = acc >= accomplishmentRange[0] && acc <= accomplishmentRange[1];

            const photoCount = parseInt(p.imagesCount ?? p.images_count ?? 0);
            const matchesMinPhotos = minPhotos === 0 || photoCount >= minPhotos;

            return matchesSearch && matchesRegion && matchesDivision && matchesCategory && matchesAccRange && matchesMinPhotos;
        });
    }, [projects, searchQuery, selectedRegions, selectedDivision, selectedCategories, accomplishmentRange, minPhotos]);

    const totalABC = useMemo(() => {
        // Prioritize aggregate budget from summary API, fallback to 0
        return summaryData?.totalStats?.totalABC || 0;
    }, [summaryData]);

    const paginatedProjects = filteredProjects; 
    const totalPages = pagination.totalPages;

    const handleDeleteProject = async (e, id) => {
        e.stopPropagation();
        if (window.confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
            try {
                const res = await fetch(`/api/projects/${id}`, { 
                    method: 'DELETE',
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });
                if (res.ok) {
                    setProjects(prev => prev.filter(p => !p.id.toString().includes(id.toString())));
                    alert("Project deleted successfully.");
                } else {
                    const data = await res.json();
                    alert(data.message || "Failed to delete project.");
                }
            } catch (err) {
                console.error("Delete error:", err);
                alert("An error occurred while deleting.");
            }
        }
    };

    const handleApproveProject = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm("Approve this project? The engineer will be able to update it.")) return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/approve-project/${id}`, {
                method: 'PUT',
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (res.ok) {
                setProjects(prev => prev.map(p => p.id === id ? { ...p, approvalStatus: 'Approved' } : p));
            } else {
                const data = await res.json();
                alert(data.message || "Failed to approve project.");
            }
        } catch (err) {
            console.error("Approve error:", err);
            alert("An error occurred while approving.");
        }
    };

    const handleAssign = async () => {
        if (!selectedProjectForAssignment || selectedEngineers.length === 0) return;

        setIsAssigning(true);
        const selectedEngs = engineers.filter(e => selectedEngineers.includes(e.uid));
        const engineerIds = selectedEngs.map(e => e.uid).join(', ');
        const engineerNames = selectedEngs.map(e => `${e.firstName || ''} ${e.lastName || ''}`.trim()).join(', ');

        try {
            const response = await fetch('/api/assign-project', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    projectId: selectedProjectForAssignment.id,
                    engineerId: engineerIds,
                    engineerName: engineerNames
                })
            });

            if (response.ok) {
                alert(`Project assigned successfully!`);
                setProjects(prev => prev.map(p => 
                    p.id === selectedProjectForAssignment.id ? { ...p, engineerName: engineerNames, engineerId: engineerIds } : p
                ));
                setIsAssignmentModalOpen(false);
                setSelectedProjectForAssignment(null);
                setSelectedEngineers([]);
                setEngineerSearchTerm('');
            } else {
                const err = await response.json();
                alert(err.message || "Failed to assign project");
            }
        } catch (error) {
            alert("Network error");
        } finally {
            setIsAssigning(false);
        }
    };

    const handleCameraClick = (category) => {
        setActiveCategory(category);
        cameraInputRef.current?.click();
    };

    const handleGalleryClick = (category) => {
        setActiveCategory(category);
        fileInputRef.current?.click();
    };

    const handleFileUpload = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const validFiles = files.filter(file => file.size <= 100 * 1024 * 1024);
        const newPreviews = validFiles.map(file => URL.createObjectURL(file));

        if (activeCategory === 'Internal') {
            setInternalFiles(prev => [...prev, ...validFiles]);
            setInternalPreviews(prev => [...prev, ...newPreviews]);
        } else {
            setExternalFiles(prev => [...prev, ...validFiles]);
            setExternalPreviews(prev => [...prev, ...newPreviews]);
        }

        e.target.value = null;
    };

    const handleEditProject = (project) => {
        setSelectedProjectForEdit(project);
        setEditModalOpen(true);
    };

    const handleSaveProject = async (updatedProject) => {
        const uid = localStorage.getItem('uid');
        if (!uid) return;

        setIsUploading(true);
        try {
            const response = await fetch(`/api/update-project/${updatedProject.id}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    ...updatedProject,
                    uid: uid,
                    modifiedBy: 'EFD Engineer'
                }),
            });

            if (!response.ok) throw new Error('Failed to update project');

            setEditModalOpen(false);
            
            // Upload Images if any
            const allFiles = [
                ...internalFiles.map(f => ({ file: f, category: 'Internal' })),
                ...externalFiles.map(f => ({ file: f, category: 'External' }))
            ];

            if (allFiles.length > 0) {
                for (const item of allFiles) {
                    try {
                        const formData = new FormData();
                        formData.append('image', item.file);
                        formData.append('projectId', updatedProject.id);
                        formData.append('uploadedBy', uid);
                        formData.append('category', item.category);
                        await fetch('/api/upload-image', { 
                            method: 'POST', 
                            body: formData,
                            headers: token ? { Authorization: `Bearer ${token}` } : {}
                        });
                    } catch (err) {
                        console.error("Upload failed for file:", item.file.name, err);
                    }
                }
            }

            setInternalFiles([]);
            setInternalPreviews([]);
            setExternalFiles([]);
            setExternalPreviews([]);

            const projRes = await fetch('/api/projects', {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (projRes.ok) {
                const data = await projRes.json();
                setProjects(Array.isArray(data) ? data : (data.data || []));
            }
            alert('Project updated successfully!');

        } catch (error) {
            console.error('Save Error:', error);
            alert(error.message || 'Failed to update project');
        } finally {
            setIsUploading(false);
        }
    };

    const renderCustomizedLabel = useCallback(({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name, value }) => {
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
        const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);
    
        if (value === 0 || percent < 0.03) return null; // Don't show if 0 or too small
    
        return (
            <text 
                x={x} 
                y={y} 
                fill="white" 
                textAnchor="middle" 
                dominantBaseline="central" 
                className="text-[9px] font-black drop-shadow-md"
            >
                {value}
            </text>
        );
    }, []);

    const activeFilters = useMemo(() => {
        const filters = [];
        if (selectedRegions.length > 0) filters.push({ type: 'Region', value: selectedRegions.join(', '), onClear: () => setSelectedRegions([]) });
        if (selectedDivision) filters.push({ type: 'Division', value: selectedDivision, onClear: () => setSelectedDivision('') });
        if (selectedProvince) filters.push({ type: 'Province', value: selectedProvince, onClear: () => setSelectedProvince('') });
        if (selectedMunicipality) filters.push({ type: 'Municipality', value: selectedMunicipality, onClear: () => setSelectedMunicipality('') });
        if (selectedDistrict) filters.push({ type: 'District', value: selectedDistrict, onClear: () => setSelectedDistrict('') });
        if (selectedCategories.length > 0) filters.push({ type: 'Category', value: selectedCategories.join(', '), onClear: () => setSelectedCategories([]) });
        if (selectedYears.length > 0) filters.push({ type: 'Year', value: selectedYears.join(', '), onClear: () => setSelectedYears([]) });
        if (selectedBatches.length > 0) filters.push({ type: 'Batch', value: selectedBatches.join(', '), onClear: () => setSelectedBatches([]) });
        if (searchQuery) filters.push({ type: 'Search', value: searchQuery, onClear: () => setSearchQuery('') });
        return filters;
    }, [selectedRegions, selectedDivision, selectedProvince, selectedMunicipality, selectedDistrict, selectedCategories, selectedYears, selectedBatches, searchQuery]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 pb-24">
                <div className="bg-[#004A99] text-white pt-8 pb-10 px-6 rounded-b-[3rem] shadow-xl mb-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl -mr-20 -mt-20"></div>

                    <div className="relative z-10">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <p className="text-sm font-bold text-blue-200 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                    Infrastructure Management
                                </p>
                                <h1 className="text-2xl font-black tracking-tight leading-none">HRODI Dashboard</h1>
                                <p className="text-blue-200 text-[10px] font-bold uppercase tracking-[0.2em] mt-2">
                                    {userData?.region || 'Central Office'} • Infrastructure Monitoring
                                </p>
                            </div>
                            <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/10">
                                <FiTrendingUp size={20} className="text-blue-200" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10 sm:col-span-1 min-w-0">
                                <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest mb-1.5 opacity-80 truncate">Total Projects</p>
                                <h2 className="text-2xl lg:text-3xl font-black truncate">
                                    {(globalTotal || summaryData?.totalStats?.totalProjects || 0).toLocaleString()}
                                </h2>
                            </div>
                            <div className="bg-blue-400/20 backdrop-blur-sm p-4 rounded-2xl border border-white/10 sm:col-span-1 min-w-0 flex flex-col">
                                <p className="text-[10px] font-black text-blue-100 uppercase tracking-widest mb-1.5 opacity-80 truncate">Filtered Results</p>
                                <h2 className="text-2xl lg:text-3xl font-black truncate">{pagination.total.toLocaleString()}</h2>
                                {activeFilters.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-1.5 overflow-hidden">
                                        {activeFilters.map((f, i) => (
                                            <div key={i} className="flex items-center gap-1 px-1.5 py-0.5 bg-white/10 rounded-lg border border-white/5 hover:bg-white/20 transition-all group">
                                                <span className="text-[7px] font-black uppercase tracking-tighter text-blue-200">{f.type}:</span>
                                                <span className="text-[8px] font-black text-white truncate max-w-[60px]">{f.value}</span>
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        f.onClear();
                                                    }} 
                                                    className="text-white/40 hover:text-white transition-colors"
                                                >
                                                    <FiX size={8} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl border border-white/10 sm:col-span-2 min-w-0">
                                <p className="text-[10px] font-black text-blue-100 uppercase tracking-widest mb-1.5 opacity-80 truncate">Total ABC Allocation</p>
                                <h2 className="text-2xl lg:text-3xl font-black truncate">{formatLargeCurrency(totalABC)}</h2>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="px-5 mb-8 space-y-4">
                        

                    {/* --- FILTER CONTROL PANEL --- */}
                    <div className="relative z-[60] space-y-4">
                        {/* Search Bar & Filter Toggle */}
                        <div className="flex gap-4">
                            <div className="relative group flex-1">
                                <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                <input 
                                    type="text"
                                    placeholder="Search by project name, school ID, or location..."
                                    value={localSearchQuery}
                                    onChange={(e) => setLocalSearchQuery(e.target.value)}
                                    onFocus={() => setIsSearchFocused(true)}
                                    onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                                    className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-3xl shadow-sm text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all placeholder:text-slate-300"
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

                            <button 
                                onClick={() => setIsFilterOpen(true)}
                                className={`p-4 rounded-[1.5rem] transition-all active:scale-95 flex items-center justify-center shadow-sm ${
                                    selectedRegions.length > 0 || selectedCategories.length > 0 || selectedDivision || selectedProvince || selectedMunicipality || selectedDistrict
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                                    : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'
                                }`}
                                title="Open Advanced Filters"
                            >
                                <FiFilter size={20} />
                            </button>
                        </div>

                        {/* Reset All Filters Button (Always Visible) */}
                        <button 
                            onClick={handleClearFilters}
                            className={`w-full flex items-center justify-center gap-2 py-3 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95 border border-slate-200 shadow-sm ${
                                (selectedRegions.length > 0 || selectedCategories.length > 0 || selectedDivision || selectedProvince || selectedMunicipality || selectedDistrict) ? 'block' : 'hidden'
                            }`}
                        >
                            <FiFilter size={12} /> Reset All Active Filters
                        </button>
                    </div>
                </div>

                {/* Tab Bar */}
                <div className="px-5 mb-6">
                    <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-sm">
                        <button
                            onClick={() => setActiveTab('summary')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${
                                activeTab === 'summary'
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            <FiTrendingUp size={13} />
                            Summary
                        </button>
                        <button
                            onClick={() => setActiveTab('list')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${
                                activeTab === 'list'
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            <LuClipboardList size={13} />
                            Projects
                        </button>
                    </div>
                </div>

                <div className="px-5">
                    {activeTab === 'summary' ? (
                        <div className="space-y-6 animate-in fade-in duration-700 pb-10">
                            {/* Analytics Drilldown Layout */}
                            <div className="max-w-7xl mx-auto w-full px-0 space-y-6">
                                <div className="flex flex-col lg:flex-row gap-6">
                                    {/* Left Column Container */}
                                    <div className="w-full lg:w-96 shrink-0 flex flex-col gap-6">
                                        {/* Pie Chart */}
                                        <div className="bg-white px-5 py-8 rounded-[2.5rem] shadow-sm border border-slate-100 min-h-[500px] flex flex-col">
                                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                            <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></span>
                                            National Category Distribution
                                        </h3>
                                        <div className="flex-1 w-full relative">
                                            <ResponsiveContainer width="100%" height={260}>
                                                <PieChart>
                                                    <Pie
                                                        data={pieChartData}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={40}
                                                        outerRadius={120}
                                                        paddingAngle={5}
                                                        dataKey="value"
                                                        labelLine={false}
                                                        label={renderCustomizedLabel}
                                                        stroke="none"
                                                    >
                                                        {pieChartData.map((entry, index) => (
                                                            <Cell 
                                                                key={`cell-${index}`} 
                                                                fill={COLORS[index % COLORS.length]}
                                                                className="hover:opacity-80 transition-opacity cursor-pointer outline-none"
                                                            />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip 
                                                        contentStyle={{ 
                                                            borderRadius: '16px', 
                                                            border: 'none', 
                                                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                                            fontSize: '11px',
                                                            fontWeight: 'bold'
                                                        }} 
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                            
                                            <div className="mt-6 space-y-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar border-t border-slate-50 pt-4 px-1">
                                                {pieChartData.filter(e => e.value > 0).map((entry) => (
                                                    <div key={entry.name} className="flex items-start justify-between text-[9px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 p-1.5 rounded-lg transition-colors gap-2">
                                                        <div className="flex items-start gap-2 min-w-0 flex-1">
                                                            <div className="w-2 h-2 rounded-full shadow-sm shrink-0 mt-1" style={{ backgroundColor: categoryColors[entry.name] || '#94a3b8' }}></div>
                                                            <span className="break-words leading-tight whitespace-normal">{entry.name}</span>
                                                        </div>
                                                        <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md font-black min-w-[30px] text-center shrink-0">{entry.value}</span>
                                                    </div>
                                                ))}
                                                {pieChartData.every(e => e.value === 0) && (
                                                    <div className="text-center py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">No data available</div>
                                                )}
                                            </div>
                                        </div>
                                        </div>
                                        
                                        {/* Funding Year Histogram */}
                                        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col">
                                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                                <span className="w-2 h-2 bg-blue-600 rounded-full shadow-[0_0_8px_rgba(37,99,235,0.4)]"></span>
                                                Funding Year Distribution
                                            </h3>
                                            <div className="w-full max-h-[350px] overflow-y-auto no-scrollbar pr-1">
                                                <div style={{ height: Math.max(200, (yearData?.length || 0) * 45) + 'px' }} className="w-full">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart
                                                            data={yearData}
                                                            layout="vertical"
                                                            margin={{ top: 5, right: 50, left: 10, bottom: 5 }}
                                                        >
                                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                                            <YAxis
                                                                dataKey="name"
                                                                type="category"
                                                                tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }}
                                                                axisLine={false}
                                                                tickLine={false}
                                                                width={45}
                                                            />
                                                            <XAxis type="number" hide domain={[0, 'auto']} />
                                                            <Tooltip
                                                                cursor={{ fill: '#f8fafc' }}
                                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                                            />
                                                            <Bar dataKey="value" fill="#004A99" radius={[0, 6, 6, 0]} barSize={22}>
                                                                <LabelList dataKey="value" position="right" style={{ fontSize: '10px', fontWeight: '900', fill: '#004A99' }} />
                                                            </Bar>
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Main Area: Consolidated Drilldown Chart & Building Standards */}
                                    <div className="flex-1 space-y-6 flex flex-col">
                                        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col">
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                                                <div>
                                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                                        <FiMapPin className="text-blue-600" />
                                                        {selectedRegions.length === 1 ? `Division Analysis for ${selectedRegions[0]}` : 'Regional Analysis'}
                                                    </h3>
                                                    <p className="text-[9px] font-bold text-slate-400 mt-1.5 uppercase tracking-widest">
                                                        {selectedRegions.length === 1 ? 'Viewing breakdown per division' : 'National overview by region'}
                                                    </p>
                                                </div>
                                                
                                                <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full sm:w-auto self-end">
                                                    <button
                                                        onClick={() => setChartMetric('count')}
                                                        className={`flex-1 sm:px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${chartMetric === 'count' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                                                    >
                                                        Count
                                                    </button>
                                                    <button
                                                        onClick={() => setChartMetric('abc')}
                                                        className={`flex-1 sm:px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${chartMetric === 'abc' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                                                    >
                                                        Allocation
                                                    </button>
                                                </div>
                                            </div>

                                            {selectedRegions.length === 1 && (
                                                <button 
                                                    onClick={() => {setSelectedRegions([]); setSelectedDivision('');}}
                                                    className="mb-6 self-start flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-4 py-2.5 rounded-2xl hover:bg-blue-100 transition-all group active:scale-95"
                                                >
                                                    <FiChevronRight className="rotate-180 group-hover:-translate-x-1 transition-transform" /> 
                                                    <span>Back to Regions</span>
                                                </button>
                                            )}

                                            <div className="h-[450px] w-full animate-in fade-in slide-in-from-right-4 duration-500" key={selectedRegions.join(',') + chartMetric}>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart
                                                        data={selectedRegions.length === 1 ? divisionData.slice(0, 50) : regionalData.slice(0, 30)}
                                                        layout="vertical"
                                                        margin={{ right: 90, left: 10, top: 10, bottom: 10 }}
                                                        onClick={(data) => {
                                                            if (data && data.activeLabel) {
                                                                if (selectedRegions.length === 0) {
                                                                    setSelectedRegions([data.activeLabel]);
                                                                    setSelectedDivision('');
                                                                } else if (selectedRegions.length === 1) {
                                                                    setSelectedDivision(data.activeLabel);
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                                        <XAxis type="number" hide />
                                                        <YAxis
                                                            dataKey="name"
                                                            type="category"
                                                            tick={{ fontSize: 9, fontWeight: 800, fill: '#64748b' }}
                                                            width={selectedRegions.length === 1 ? 140 : 90}
                                                            axisLine={false}
                                                            tickLine={false}
                                                        />
                                                        <Tooltip
                                                            cursor={{ fill: '#f8fafc' }}
                                                            formatter={(val, name) => {
                                                                const formattedVal = chartMetric === 'abc' ? formatLargeCurrency(val) : `${val} Projects`;
                                                                return [formattedVal, name];
                                                            }}
                                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '11px', fontWeight: 'bold' }}
                                                        />
                                                        {allCategories.map((cat) => (
                                                            <Bar 
                                                                key={cat}
                                                                dataKey={cat} 
                                                                stackId="a" 
                                                                fill={categoryColors[cat] || '#94a3b8'} 
                                                                barSize={28}
                                                                className="hover:opacity-80 transition-opacity cursor-pointer"
                                                            />
                                                        ))}
                                                        
                                                        {/* Transparent anchor for the total label at the end of stack */}
                                                        <Bar dataKey="labelAnchor" stackId="a" isAnimationActive={false}>
                                                            <LabelList 
                                                                dataKey="totalValue" 
                                                                position="right"
                                                                offset={12}
                                                                formatter={(val) => chartMetric === 'abc' ? formatLargeCurrency(val) : val}
                                                                style={{ fontSize: '10px', fontWeight: '900', fill: '#475569', pointerEvents: 'none' }} 
                                                            />
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                        
                                        {/* Building Standards Chart (Moved) */}
                                        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 min-w-0 overflow-hidden">
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-8 w-full">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                                                        <FiLayers size={24} />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                                                            Building Standards 
                                                        </h3>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                                            {drillDownLevel === 'storey' ? 'Select storey level to explore classrooms' : `Classroom prototypes for ${selectedStorey} Storey buildings`}
                                                        </p>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center gap-3">
                                                    <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                                                        <button 
                                                            onClick={() => { setDataMode('masterlist'); setDrillDownLevel('storey'); setSelectedStorey(null); }}
                                                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${dataMode === 'masterlist' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                        >
                                                            Masterlist
                                                        </button>
                                                        <button 
                                                            onClick={() => { setDataMode('2026'); setDrillDownLevel('storey'); setSelectedStorey(null); }}
                                                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${dataMode === '2026' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                        >
                                                            2026
                                                        </button>
                                                    </div>

                                                    <select 
                                                        className="bg-white border-2 border-slate-100 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-400 transition-all cursor-pointer hover:border-indigo-200 shadow-sm"
                                                        value={selectedStorey || ''}
                                                        onChange={(e) => {
                                                            const val = e.target.value ? Number(e.target.value) : null;
                                                            setSelectedStorey(val);
                                                            setDrillDownLevel(val ? 'prototype' : 'storey');
                                                        }}
                                                    >
                                                        <option value="">All Storeys</option>
                                                        {storeyAggregated.map(s => <option key={s.storey} value={s.storey}>{s.storey} Storey</option>)}
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="h-[370px] w-full mt-4">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart
                                                        layout="vertical"
                                                        data={activeChartData}
                                                        margin={{ top: 5, right: 20, left: -25, bottom: 5 }}
                                                    >
                                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                                        <XAxis type="number" hide />
                                                        <YAxis 
                                                            dataKey="name" 
                                                            type="category" 
                                                            axisLine={false} 
                                                            tickLine={false} 
                                                            tick={{ fill: '#475569', fontSize: 9, fontWeight: 900 }} 
                                                            width={65}
                                                        />
                                                        <Tooltip 
                                                            cursor={{ fill: '#f8fafc' }}
                                                            contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                                                            labelStyle={{ fontWeight: 900, color: '#1e293b', marginBottom: '4px' }}
                                                        />
                                                        <Bar 
                                                            dataKey="count" 
                                                            radius={[0, 8, 8, 0]} 
                                                            barSize={32} 
                                                            className="cursor-pointer"
                                                            onClick={(payload) => {
                                                                if (payload) {
                                                                    if (drillDownLevel === 'storey') {
                                                                        setSelectedStorey(payload.storey);
                                                                        setDrillDownLevel('prototype');
                                                                    } else if (drillDownLevel === 'prototype') {
                                                                        // Set filters for the list view to show relevant projects
                                                                        setSelectedCategories(['New Construction']);
                                                                        // Use a search query that typically matches the naming convention
                                                                        setSearchQuery(`${payload.storey} Storey ${payload.classrooms} Classroom`);
                                                                        setActiveTab('list');
                                                                    }
                                                                }
                                                            }}
                                                        >
                                                            {activeChartData.map((entry, index) => (
                                                                <Cell 
                                                                    key={`cell-${index}`} 
                                                                    fill={drillDownLevel === 'storey' ? '#818cf8' : '#c7d2fe'} 
                                                                    className="transition-all duration-300 hover:opacity-80"
                                                                />
                                                            ))}
                                                            <LabelList dataKey="count" position="right" offset={10} style={{ fill: '#6366f1', fontSize: 11, fontWeight: 900 }} />
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    </div>
                                </div>



                            </div>
                        </div>
                    ) : (
                        <div className="animate-in fade-in duration-700">
                            <div className="flex items-center justify-between gap-4 mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-[#004A99] text-white rounded-2xl shadow-lg">
                                        <LuClipboardList size={22} />
                                    </div>
                                    <div className="hidden sm:block">
                                        <h2 className="text-xl font-black text-slate-800 tracking-tight leading-none mb-1">Project Inventory</h2>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Granular project details</p>
                                    </div>
                                </div>

                                {/* View Toggle */}
                                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-sm">
                                    <button
                                        onClick={() => setViewMode('card')}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${viewMode === 'card' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        <FiGrid size={13} />
                                        <span className="hidden xs:inline">Cards</span>
                                    </button>
                                    <button
                                        onClick={() => setViewMode('table')}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${viewMode === 'table' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        <FiList size={14} />
                                        <span className="hidden xs:inline">Table</span>
                                    </button>
                                </div>
                            </div>

                            {filteredProjects.length === 0 ? (
                                <div className="text-center py-20">
                                    <FiAlertCircle size={48} className="mx-auto text-slate-200 mb-4" />
                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No projects found</p>
                                </div>
                            ) : viewMode === 'table' ? (
                                <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden max-w-7xl mx-auto w-full">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-100">
                                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-20">ID</th>
                                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Project Details</th>
                                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Division</th>
                                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Progress</th>
                                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Docs & Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {(Array.isArray(paginatedProjects) ? paginatedProjects : []).map((p) => (
                                                    <tr 
                                                        key={p.id} 
                                                        onClick={() => handleNavigateToProject(p.id)}
                                                        className="hover:bg-blue-50/30 transition-colors cursor-pointer group"
                                                    >
                                                        <td className="px-6 py-4">
                                                            <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">{p.id}</span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div>
                                                                <h4 className="text-sm font-bold text-slate-800 group-hover:text-blue-700 transition-colors">{p.projectName}</h4>
                                                                <p className="text-[10px] text-slate-500 font-medium">{p.schoolName} • {p.schoolId}</p>
                                                                {p.approvalStatus === 'Pending' && (
                                                                    <span className="mt-1 inline-block text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200 tracking-widest animate-pulse">
                                                                        ⚠️ FOR VALIDATION
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                                                            {p.division}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${
                                                                p.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                                                p.status === 'Ongoing' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                                                            }`}>
                                                                {p.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-xs font-black text-slate-700 min-w-[30px]">{p.accomplishmentPercentage}%</span>
                                                                <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                                                    <div 
                                                                        className="h-full bg-blue-500 transition-all" 
                                                                        style={{ width: `${p.accomplishmentPercentage}%` }}
                                                                    ></div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex justify-end items-center gap-3">
                                                                <div className="flex justify-end gap-1">
                                                                    {!p.hasMoa && !p.hasRta ? (
                                                                        <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-red-50 text-red-500 border border-red-100">None</span>
                                                                    ) : p.hasMoa && p.hasRta ? (
                                                                        <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100">Full</span>
                                                                    ) : !p.hasMoa ? (
                                                                        <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 border border-orange-100">RTA Only</span>
                                                                    ) : (
                                                                        <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 border border-orange-100">MOA Only</span>
                                                                    )}
                                                                </div>
                                                                {p.approvalStatus === 'Pending' && userRole === 'EFD Engineer' && (
                                                                    <button
                                                                        onClick={(e) => handleApproveProject(e, p.id)}
                                                                        className="p-1 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors"
                                                                        title="Approve Project"
                                                                    >
                                                                        <FiCheck size={16} />
                                                                    </button>
                                                                )}
                                                                {userRole === 'EFD Engineer' && (
                                                                    <button
                                                                        onClick={(e) => handleDeleteProject(e, p.id)}
                                                                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                                                        title="Delete Project"
                                                                    >
                                                                        <FiTrash2 size={16} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Pagination Controls */}
                                    <div className="bg-slate-50/50 px-6 py-4 flex items-center justify-between border-t border-slate-100">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            Showing {((currentPage - 1) * pagination.limit) + 1} to {Math.min(currentPage * pagination.limit, pagination.total)} of {pagination.total} Records
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <button 
                                                onClick={() => setCurrentPage(1)}
                                                disabled={currentPage === 1}
                                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white transition-all shadow-sm active:scale-95"
                                            >
                                                First
                                            </button>
                                            <button 
                                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                                disabled={currentPage === 1}
                                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white transition-all shadow-sm active:scale-90"
                                            >
                                                <FiChevronRight className="rotate-180" size={12} />
                                            </button>
                                            
                                            <div className="px-4 text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] bg-blue-50 py-1.5 rounded-lg border border-blue-100">
                                                Page {currentPage} of {totalPages || 1}
                                            </div>

                                            <button 
                                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                                disabled={currentPage === totalPages || totalPages === 0}
                                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white transition-all shadow-sm active:scale-90"
                                            >
                                                <FiChevronRight size={12} />
                                            </button>
                                            <button 
                                                onClick={() => setCurrentPage(totalPages)}
                                                disabled={currentPage === totalPages || totalPages === 0}
                                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white transition-all shadow-sm active:scale-95"
                                            >
                                                Last
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {(Array.isArray(paginatedProjects) ? paginatedProjects : []).map((p) => {
                                        const isUnassigned = !p.engineerName && !p.assigned_engineer_name;
                                        const engrName = p.assigned_engineer_name || p.engineerName;
                                        const progress = parseInt(p.accomplishmentPercentage || 0);
                                        const parsedPrev = parseInt(p.previousPercentage);
                                        const prevProgress = !isNaN(parsedPrev) ? parsedPrev : null;
                                        const showsProgression = prevProgress !== null && prevProgress !== progress;
                                        
                                        return (
                                            <div key={p.id} onClick={() => handleNavigateToProject(p.id)} className="group bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl hover:border-blue-200 transition-all duration-500 relative flex flex-col cursor-pointer">

                                                {/* Card Header (Category & Status) */}
                                                <div className="p-6 pb-0">
                                                    <div className="flex items-center justify-between gap-4 mb-3">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 tracking-widest whitespace-nowrap">
                                                                {p.projectCategory || 'General'}
                                                            </span>
                                                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter truncate">
                                                                IPC: {p.ipc || 'TBD'}
                                                            </span>
                                                            {p.approvalStatus === 'Pending' && (
                                                                <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200 tracking-widest animate-pulse whitespace-nowrap">
                                                                    ⚠️ FOR VALIDATION
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="bg-blue-600 text-white rounded-xl px-2.5 py-1.5 flex items-center justify-center text-[10px] font-black shadow-lg shadow-blue-100 flex-shrink-0 min-w-[35px]">
                                                            {showsProgression && (
                                                                <span className="text-[7px] opacity-60 mr-1 font-bold tracking-tighter">
                                                                    {prevProgress}% →
                                                                </span>
                                                            )}
                                                            <span>{progress}%</span>
                                                        </div>
                                                    </div>
                                                    <h3 className="text-sm font-black text-slate-800 leading-tight group-hover:text-blue-600 transition-colors line-clamp-2 uppercase">
                                                        {p.projectName}
                                                    </h3>
                                                </div>

                                                {/* Card Body */}
                                                <div className="p-6 pt-4 flex-1 space-y-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center border border-slate-100">
                                                            <FiMapPin size={14} />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-0.5">School Location</span>
                                                            <span className="text-[11px] font-black text-slate-700 leading-tight uppercase">{p.schoolName}</span>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4 pl-1">
                                                        <div className="flex flex-col gap-1.5">
                                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Procurement</label>
                                                            <select 
                                                                value={p.procurement_status || 'Not Yet Procured'}
                                                                onChange={(e) => {
                                                                    e.stopPropagation();
                                                                    handleSaveProject({ ...p, procurement_status: e.target.value });
                                                                }}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-2 py-1.5 text-[9px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/10 appearance-none cursor-pointer"
                                                            >
                                                                <option value="Not Yet Procured">Not Yet Procured</option>
                                                                <option value="Under Procurement">Under Procurement</option>
                                                                <option value="Procurement Complete">Procurement Complete</option>
                                                            </select>
                                                        </div>
                                                        <div className="flex flex-col gap-1.5">
                                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Construction</label>
                                                            <select 
                                                                value={p.status || 'Not Yet Started'}
                                                                onChange={(e) => {
                                                                    e.stopPropagation();
                                                                    handleSaveProject({ ...p, status: e.target.value });
                                                                }}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-2 py-1.5 text-[9px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/10 appearance-none cursor-pointer"
                                                            >
                                                                <option value="Not Yet Started">Not Yet Started</option>
                                                                <option value="Ongoing">Ongoing</option>
                                                                <option value="For Final Inspection">For Final Inspection</option>
                                                                <option value="Completed">Completed</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Card Footer (Assignment Action) */}
                                                <div className="p-4 px-6 bg-slate-50/30 border-t border-slate-50 flex flex-col gap-3 mt-auto">
                                                    {/* 
                                                        Assign Engineer button commented out as projects now follow 
                                                        shared regional/divisional logic. 
                                                    */}
                                                    {/* isUnassigned ? (
                                                        <button 
                                                            onClick={(e) => { 
                                                                e.stopPropagation(); 
                                                                setSelectedProjectForAssignment(p);
                                                                setSelectedEngineers(p.assigned_engineer_id ? p.assigned_engineer_id.split(',').map(s=>s.trim()) : []);
                                                                setIsAssignmentModalOpen(true);
                                                            }}
                                                            className="w-full flex items-center justify-center gap-2 py-3 bg-[#FFF8F1] text-orange-600 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] hover:bg-orange-600 hover:text-white transition-all shadow-sm active:scale-[0.98] border border-orange-100/50"
                                                        >
                                                            <FiUserPlus size={14} />
                                                            Assign Engineer
                                                        </button>
                                                    ) : (
                                                        <div className="flex items-center justify-between w-full">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-[10px] font-black text-white shadow-lg shadow-blue-200">
                                                                    {engrName?.[0] || 'E'}
                                                                </div>
                                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Engineer</span>
                                                            </div>
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handleNavigateToProject(p.id); }}
                                                                className="w-8 h-8 flex items-center justify-center bg-white text-blue-600 rounded-xl border border-slate-100 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                                                title="See Insights"
                                                            >
                                                                <FiChevronRight size={14} />
                                                            </button>
                                                        </div>
                                                    ) */}

                                                    {/* Simplified status footer since assignment button is hidden */}
                                                    <div className="flex items-center justify-between w-full">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-200">
                                                                {engrName?.[0] || 'EP'}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Project Access</span>
                                                                <span className="text-[8px] font-bold text-blue-500 uppercase">Regional Shared</span>
                                                            </div>
                                                        </div>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleNavigateToProject(p.id); }}
                                                            className="w-8 h-8 flex items-center justify-center bg-white text-blue-600 rounded-xl border border-slate-100 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                                            title="See Insights"
                                                        >
                                                            <FiChevronRight size={14} />
                                                        </button>
                                                    </div>
                                                    {/* Action Buttons Row */}
                                                    <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                                                        <div className="flex items-center gap-2">
                                                            {userRole !== 'EFD Engineer' && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleEditProject(p); }}
                                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all border border-blue-100"
                                                                    title="Edit Details"
                                                                >
                                                                    <FiEdit2 size={11} /> Edit
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setLogProject(p); setIsLogOpen(true); }}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-amber-500 hover:text-white transition-all border border-amber-100"
                                                                title="View Activity Log"
                                                            >
                                                                <FiActivity size={11} /> Log
                                                            </button>
                                                            {userRole === 'EFD Engineer' && p.approvalStatus === 'Pending' && (
                                                                <button
                                                                    onClick={(e) => handleApproveProject(e, p.id)}
                                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all border border-emerald-100"
                                                                    title="Approve Project"
                                                                >
                                                                    <FiCheck size={11} /> Approve
                                                                </button>
                                                            )}
                                                        </div>
                                                        {userRole === 'EFD Engineer' && (
                                                            <button
                                                                onClick={(e) => handleDeleteProject(e, p.id)}
                                                                className="w-7 h-7 flex items-center justify-center bg-red-50 text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-all border border-red-100"
                                                                title="Delete Project"
                                                            >
                                                                <FiTrash2 size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                            {/* Pagination Controls for Card View */}
                            {pagination.total > 0 && (
                                <div className="bg-slate-50/50 px-6 py-4 flex items-center justify-between border-t border-slate-100 mt-6 rounded-[2.5rem]">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        Showing {((currentPage - 1) * pagination.limit) + 1} to {Math.min(currentPage * pagination.limit, pagination.total)} of {pagination.total} Records
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <button 
                                            onClick={() => setCurrentPage(1)}
                                            disabled={currentPage === 1}
                                            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white transition-all shadow-sm active:scale-95"
                                        >
                                            First
                                        </button>
                                        <button 
                                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                            disabled={currentPage === 1}
                                            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white transition-all shadow-sm active:scale-90"
                                        >
                                            <FiChevronRight className="rotate-180" size={12} />
                                        </button>
                                        
                                        <div className="px-4 text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] bg-blue-50 py-1.5 rounded-lg border border-blue-100">
                                            Page {currentPage} of {totalPages || 1}
                                        </div>

                                        <button 
                                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                            disabled={currentPage === totalPages || totalPages === 0}
                                            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white transition-all shadow-sm active:scale-90"
                                        >
                                            <FiChevronRight size={12} />
                                        </button>
                                        <button 
                                            onClick={() => setCurrentPage(totalPages)}
                                            disabled={currentPage === totalPages || totalPages === 0}
                                            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white transition-all shadow-sm active:scale-95"
                                        >
                                            Last
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <BottomNav userRole={userRole} />
            </div>

            {/* Assignment Modal */}
            {isAssignmentModalOpen && createPortal(
                <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300 px-4">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                        <div className="bg-[#004A99] p-8 text-white relative">
                            <div className="flex justify-between items-center mb-1">
                                <h3 className="text-xl font-black tracking-tight">Assign Engineer</h3>
                                <button onClick={() => setIsAssignmentModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                    <FiX size={20} />
                                </button>
                            </div>
                            <p className="text-blue-200 text-[10px] font-bold uppercase tracking-[0.2em]">{selectedProjectForAssignment?.projectName}</p>
                        </div>
                        
                        <div className="p-8 space-y-6 overflow-y-auto no-scrollbar">
                            <div className="relative">
                                <input 
                                    type="text" 
                                    placeholder="Search engineer by name..."
                                    value={engineerSearchTerm}
                                    onChange={(e) => setEngineerSearchTerm(e.target.value)}
                                    className="w-full bg-slate-50 border-none rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/5 transition-all"
                                />
                                <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            </div>

                            <div className="space-y-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Available Resource Pool</span>
                                <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2 no-scrollbar">
                                    {(engineers || []).filter(e => 
                                        `${e.firstName} ${e.lastName}`.toLowerCase().includes(engineerSearchTerm.toLowerCase()) ||
                                        e.uid?.toLowerCase().includes(engineerSearchTerm.toLowerCase())
                                    ).map(eng => {
                                        const isSelected = selectedEngineers.includes(eng.uid);
                                        return (
                                            <div 
                                                key={eng.uid}
                                                onClick={() => {
                                                    const next = isSelected ? selectedEngineers.filter(id => id !== eng.uid) : [...selectedEngineers, eng.uid];
                                                    setSelectedEngineers(next);
                                                }}
                                                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between group ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-slate-200'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black transition-colors ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'}`}>
                                                        {eng.firstName?.[0]}{eng.lastName?.[0]}
                                                    </div>
                                                    <div>
                                                        <p className={`text-xs font-black uppercase ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>{eng.firstName} {eng.lastName}</p>
                                                        <p className="text-[9px] font-bold text-slate-400 italic">{eng.role || 'Regional Engineer'}</p>
                                                    </div>
                                                </div>
                                                {isSelected && <FiCheckSquare className="text-blue-600" size={18} />}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
                            <button 
                                onClick={() => setIsAssignmentModalOpen(false)}
                                className="flex-1 py-4 text-slate-500 text-[11px] font-black uppercase tracking-widest hover:text-slate-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                disabled={selectedEngineers.length === 0 || isAssigning}
                                onClick={handleAssign}
                                className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                            >
                                {isAssigning ? 'Processing...' : 'Modify Assignment'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Edit Project Modal */}
            {selectedProjectForEdit && (
                <EditProjectModal
                    isOpen={editModalOpen}
                    onClose={() => setEditModalOpen(false)}
                    project={selectedProjectForEdit}
                    onSave={handleSaveProject}
                    isUploading={isUploading}
                    userRole="EFD Engineer"
                    internalFiles={internalFiles}
                    externalFiles={externalFiles}
                    internalPreviews={internalPreviews}
                    externalPreviews={externalPreviews}
                    onCameraClick={handleCameraClick}
                    onGalleryClick={handleGalleryClick}
                    onRemoveFile={(idx, cat) => {
                        if (cat === 'Internal') {
                            setInternalFiles(prev => prev.filter((_, i) => i !== idx));
                            setInternalPreviews(prev => prev.filter((_, i) => i !== idx));
                        } else {
                            setExternalFiles(prev => prev.filter((_, i) => i !== idx));
                            setExternalPreviews(prev => prev.filter((_, i) => i !== idx));
                        }
                    }}
                />
            )}

            {/* Hidden Inputs for Photos */}
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
            <input type="file" ref={cameraInputRef} onChange={handleFileUpload} accept="image/*" capture="environment" className="hidden" />
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
                yearOptions={allYears}
                batchOptions={allBatches}
                categoryOptions={projectCategories}
            />
        </PageTransition>
    );
};

export default EFDHome;
