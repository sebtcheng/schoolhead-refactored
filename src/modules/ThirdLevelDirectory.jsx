import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FiSearch,
    FiFilter,
    FiUser,
    FiMail,
    FiPhone,
    FiArrowRight,
    FiClock,
    FiRepeat,
    FiChevronLeft,
    FiMoreVertical,
    FiCheckCircle,
    FiXCircle,
    FiActivity,
    FiMenu,
    FiX,
    FiLayers,
    FiTrendingUp,
    FiCalendar,
    FiGlobe,
    FiSmartphone,
    FiMapPin,
    FiAward,
    FiTrash2,
    FiInbox,
    FiUserX,
    FiBriefcase,
    FiUsers,
    FiSettings,
    FiLogOut,
    FiInfo,
    FiSave,
    FiBook,
    FiFileText,
    FiShield,
    FiPlus,
    FiStar,
    FiHome,
    FiAlertTriangle,
    FiUpload,
    FiToggleLeft,
    FiToggleRight
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import PageTransition from '../components/PageTransition';

const ThirdLevelDirectory = () => {
    const navigate = useNavigate();
    const [officials, setOfficials] = useState([]);
    const [previousOfficials, setPreviousOfficials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStrand, setSelectedStrand] = useState('All');
    const [activeCategory, setActiveCategory] = useState('CESO'); // 'CESO' (3rd Level) or 'CHIEFS' (Chiefs/OICs)
    
    // Helper to identify 3rd Level (CESO/CES) positions
    const isThirdLevel = (position) => {
        if (!position) return false;
        const p = position.toUpperCase();
        // Core 3rd Level Roles
        const keywords = [
            'SECRETARY', 'DIRECTOR', 'RD', 'ARD', 'SDS', 'ASDS', 
            'DIRECTOR-GENERAL', 'EXECUTIVE DIRECTOR', 'SUPERINTENDENT'
        ];
        return keywords.some(k => p.includes(k));
    };
    
    // UI States & Modals
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showPreviousModal, setShowPreviousModal] = useState(false);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [showReplaceModal, setShowReplaceModal] = useState(false);
    const [showVacateModal, setShowVacateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    
    // Core Data
    const [selectedOfficial, setSelectedOfficial] = useState(null);
    const [history, setHistory] = useState([]);
    const [positionHistory, setPositionHistory] = useState([]);
    const [careerPath, setCareerPath] = useState([]);
    const [formData, setFormData] = useState({});
    const [selectedReasons, setSelectedReasons] = useState([]);
    const [otherReason, setOtherReason] = useState('');
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [taxonomy, setTaxonomy] = useState({ strands: [], offices: [], positions: [] });

    // Profiling State
    const [profileTab, setProfileTab] = useState('overview');
    const [profileEdits, setProfileEdits] = useState({});
    const [profileSaving, setProfileSaving] = useState(false);
    const [prevPositions, setPrevPositions] = useState([]);
    const [trainings, setTrainings] = useState([]);

    useEffect(() => {
        fetchOfficials();
        fetchPreviousOfficials();
        fetchTaxonomy();
    }, []);

    const fetchTaxonomy = async () => {
        try {
            const res = await fetch('/api/officials/taxonomy');
            const data = await res.json();
            if (data.success) setTaxonomy(data.data);
        } catch (err) {
            console.error("Failed to fetch taxonomy", err);
        }
    };

    const fetchOfficials = async () => {
        setLoading(true);
        try {
            // Fetch All active and vacant slots
            const [resActive, resVacant] = await Promise.all([
                fetch('/api/officials?status=Active'),
                fetch('/api/officials?status=Vacant')
            ]);
            const dataActive = await resActive.json();
            const dataVacant = await resVacant.json();
            
            let combined = [];
            if (dataActive.success) combined = [...combined, ...dataActive.data];
            if (dataVacant.success) combined = [...combined, ...dataVacant.data];
            
            // Ensure hierarchy by strictly following sort_index
            combined.sort((a,b) => a.sort_index - b.sort_index);
            
            setOfficials(combined);
        } catch (err) {
            console.error("Failed to fetch officials", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchPreviousOfficials = async () => {
        try {
            const res = await fetch('/api/officials?status=Inactive');
            const data = await res.json();
            if (data.success) {
                setPreviousOfficials(data.data);
            }
        } catch (err) {
            console.error("Failed to fetch previous officials", err);
        }
    };

    // Card Consolidation Logic: Group by Name, but keep Vacancies separate per slot
    const consolidatedOfficials = useMemo(() => {
        const groups = {};
        officials.forEach(o => {
            // Vacancies shouldn't be merged by "name" since multiple positions can be Vacant
            if (o.status === 'Vacant' || o.name === 'VACANT') {
                const vacantKey = `VACANT-${o.tlid}`;
                groups[vacantKey] = {
                    ...o,
                    isVacant: true,
                    roles: [{ tlid: o.tlid, office: o.office, position: o.position, strand: o.strand, sort_index: o.sort_index }]
                };
                return;
            }

            if (!groups[o.name]) {
                groups[o.name] = {
                    ...o,
                    roles: [{ tlid: o.tlid, office: o.office, position: o.position, strand: o.strand, sort_index: o.sort_index }]
                };
            } else {
                groups[o.name].roles.push({ tlid: o.tlid, office: o.office, position: o.position, strand: o.strand, sort_index: o.sort_index });
            }
        });
        
        const list = Object.values(groups).sort((a,b) => {
            const minA = Math.min(...a.roles.map(r => r.sort_index));
            const minB = Math.min(...b.roles.map(r => r.sort_index));
            return minA - minB;
        });

        // Calculate counts
        const all3rdCount = list.filter(o => o.roles.some(r => isThirdLevel(r.position))).length;
        const allChiefCount = list.length - all3rdCount;

        return { officials: list, counts: { reso: all3rdCount, chiefs: allChiefCount } };
    }, [officials]);

    const categorizedOfficials = useMemo(() => {
        return consolidatedOfficials.officials.filter(o => {
            const hasThirdLevelRole = o.roles.some(r => isThirdLevel(r.position));
            return activeCategory === 'CESO' ? hasThirdLevelRole : !hasThirdLevelRole;
        });
    }, [consolidatedOfficials, activeCategory]);

    // Grouping by Strand for the Messy-Free UI
    const groupedByStrand = useMemo(() => {
        const term = searchTerm.toLowerCase();

        // 1. If Personnel Master Registry, show all unique names alphabetically
        if (selectedStrand === 'PERSONNEL_MASTER_REGISTRY') {
            // Include ALL (Active + Inactive)
            const allPossible = [
                ...categorizedOfficials,
                ...previousOfficials
                    .filter(p => {
                        const is3rd = isThirdLevel(p.position);
                        return activeCategory === 'CESO' ? is3rd : !is3rd;
                    })
                    .map(p => ({ ...p, roles: [{ tlid: p.tlid, office: p.office, position: p.position, strand: p.strand, sort_index: 9999 }] }))
            ].filter(o => o.name && o.name !== 'VACANT');

            const uniquePeople = {};
            allPossible.forEach(p => {
                if (!uniquePeople[p.name]) uniquePeople[p.name] = p;
                else {
                    // Update roles if they aren't already there
                    p.roles.forEach(r => {
                       if (!uniquePeople[p.name].roles.find(er => er.tlid === r.tlid)) {
                           uniquePeople[p.name].roles.push(r);
                       }
                    });
                    // Prefer 'Active' status for the main display if one entry is active
                    if (p.status === 'Active') uniquePeople[p.name].status = 'Active';
                }
            });

            const filteredPeople = Object.values(uniquePeople)
                .filter(p => p.name.toLowerCase().includes(term))
                .sort((a,b) => a.name.localeCompare(b.name));

            return { "PERSONNEL MASTER REGISTRY": filteredPeople };
        }

        // 2. Standard Strand-based Registry
        const filtered = categorizedOfficials.filter(o => {
            const matchesName = o.name.toLowerCase().includes(term);
            const matchesRole = o.roles.some(r => r.office.toLowerCase().includes(term) || r.position.toLowerCase().includes(term));
            const matchesStrand = selectedStrand === 'All' || o.roles.some(r => r.strand === selectedStrand);
            return (matchesName || matchesRole) && matchesStrand;
        });

        const strands = {};
        filtered.forEach(o => {
            const targetStrands = [...new Set(o.roles.map(r => r.strand))];
            targetStrands.forEach(s => {
                if (selectedStrand !== 'All' && s !== selectedStrand) return;
                if (!strands[s]) strands[s] = [];
                // ONLY prevent duplicates if it's NOT a vacancy (Vacancies must all be shown per slot)
                const isDuplicate = strands[s].find(existing => existing.name === o.name && existing.status === o.status);
                if (!isDuplicate || o.isVacant) {
                    strands[s].push(o);
                }
            });
        });

        return strands;
    }, [categorizedOfficials, previousOfficials, searchTerm, selectedStrand, activeCategory]);

    const activeStrands = useMemo(() => Object.keys(groupedByStrand).sort((a,b) => {
        if (a === "PERSONNEL MASTER REGISTRY") return -1;
        if (b === "PERSONNEL MASTER REGISTRY") return 1;
        return a.localeCompare(b);
    }), [groupedByStrand]);

    const computeAge = (dob) => {
        if (!dob) return '';
        const today = new Date();
        const birth = new Date(dob);
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        return age;
    };

    const fetchFullProfile = async (official) => {
        setSelectedOfficial(official);
        setShowProfileModal(true);
        setProfileTab('overview');
        setHistory([]);
        setPositionHistory([]);
        setCareerPath([]);
        setProfileEdits({});
        setPrevPositions([]);
        setTrainings([]);
        const primaryTlid = official.roles[0].tlid;

        try {
            const [histRes, posRes, profileRes] = await Promise.all([
                fetch(`/api/officials/history/${primaryTlid}`),
                fetch(`/api/officials/position-history?strand=${encodeURIComponent(official.roles[0].strand)}&office=${encodeURIComponent(official.roles[0].office)}&position=${encodeURIComponent(official.roles[0].position)}`),
                fetch(`/api/third-level/${primaryTlid}/profile`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                }),
            ]);

            const histData = await histRes.json();
            if (histData.success) { setHistory(histData.data); setCareerPath(histData.data); }

            const posData = await posRes.json();
            if (posData.success) setPositionHistory(posData.data);

            if (profileRes.ok) {
                const pd = await profileRes.json();
                if (pd.success) {
                    const d = pd.data;
                    setProfileEdits({
                        last_name: d.last_name || '',
                        first_name: d.first_name || '',
                        middle_name: d.middle_name || '',
                        suffix: d.suffix || '',
                        gender: d.gender || '',
                        date_of_birth: d.date_of_birth ? d.date_of_birth.split('T')[0] : '',
                        age: d.age ?? '',
                        civil_status: d.civil_status || '',
                        position_title: d.position_title || '',
                        appointment_date: d.appointment_date ? d.appointment_date.split('T')[0] : '',
                        emt_passer: d.emt_passer ?? null,
                        emt_date: d.emt_date ? d.emt_date.split('T')[0] : '',
                        ces_stage: d.ces_stage || '',
                        ces_conferment_date: d.ces_conferment_date ? d.ces_conferment_date.split('T')[0] : '',
                        total_years_third_level: d.total_years_third_level ?? '',
                        permanent_address: d.permanent_address || '',
                        highest_education: d.highest_education || '',
                        education_program: d.education_program || '',
                        education_year_graduated: d.education_year_graduated ?? '',
                        notable_achievements: d.notable_achievements || '',
                        performance_rating_ipcrf: d.performance_rating_ipcrf || '',
                        performance_rating_cespes: d.performance_rating_cespes || '',
                        pending_admin_case: d.pending_admin_case || '',
                        ombudsman_case: d.ombudsman_case || '',
                    });
                    // Align with new JSONB columns
                    setPrevPositions(d.previous_positions || []);
                    setTrainings(d.relevant_trainings || []);
                }
            }
        } catch (err) {
            console.error("Failed to fetch detailed profile", err);
        }
    };

    const handleProfileSave = async () => {
        if (!selectedOfficial) return;
        setProfileSaving(true);
        const tlid = selectedOfficial.roles[0].tlid;
        try {
            const payload = { 
                ...profileEdits,
                previous_positions: prevPositions,
                relevant_trainings: trainings
            };
            if (payload.date_of_birth) payload.age = computeAge(payload.date_of_birth);

            const res = await fetch(`/api/third-level/${tlid}/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                // Refresh data to show reflected changes
                fetchOfficials();
                alert('Profile and history ledger updated successfully.');
            } else {
                alert(data.error || 'Save failed.');
            }
        } catch (err) {
            alert('Save failed: ' + err.message);
        } finally {
            setProfileSaving(false);
        }
    };

    const handleAddPosition = () => {
        setPrevPositions(p => [...p, { position_id: `tmp-${Date.now()}`, position_name: '', office: '', start_date: '', end_date: '', is_oic: false, isNew: true }]);
    };

    const handleRemovePosition = (pos) => {
        // Now using local state only - persistence handled by atomic Save Profile
        setPrevPositions(p => p.filter(x => x.position_id !== pos.position_id));
    };

    const handleSavePosition = async (pos) => {
        const tlid = selectedOfficial.roles[0].tlid;
        if (pos.isNew) {
            const res = await fetch(`/api/third-level/${tlid}/prev-positions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify(pos)
            });
            const data = await res.json();
            if (data.success) {
                setPrevPositions(p => p.map(x => x.position_id === pos.position_id ? { ...data.data, isNew: false } : x));
            }
        }
    };

    const handleAddTraining = () => {
        setTrainings(t => [...t, { training_id: `tmp-${Date.now()}`, training_name: '', date_completed: '', isNew: true }]);
    };

    const handleRemoveTraining = (tr) => {
        // Now using local state only - persistence handled by atomic Save Profile
        setTrainings(t => t.filter(x => x.training_id !== tr.training_id));
    };

    const handleAction = async (endpoint, body) => {
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(body) 
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                setShowMoveModal(false);
                setShowReplaceModal(false);
                setShowVacateModal(false);
                setShowProfileModal(false);
                setShowEditModal(false);
                fetchOfficials();
                fetchPreviousOfficials();
            } else {
                alert(data.error);
            }
        } catch (err) {
            alert("Action failed: " + err.message);
        }
    };

    const sidebarStrands = useMemo(() => {
        const unique = ['All', 'PERSONNEL_MASTER_REGISTRY', ...new Set(officials.map(o => o.strand).filter(Boolean))];
        return unique;
    }, [officials]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans">
                <div className="flex flex-col items-center gap-6">
                    <div className="w-16 h-16 border-[6px] border-[#0038A8] border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-300 font-black uppercase tracking-[0.4em] text-[10px]">Division of Labor Orchestra...</p>
                </div>
            </div>
        );
    }

    const NavItems = ({ isMobile = false }) => (
        <div className={`flex flex-col ${isMobile ? 'gap-3' : 'gap-1'}`}>
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4 ml-4 mt-6">Division Control</p>
            <button
                onClick={() => { setSelectedStrand('All'); if(isMobile) setMobileMenuOpen(false); }}
                className={`flex items-center gap-4 px-6 py-4 rounded-3xl text-[11px] font-black uppercase tracking-wider transition-all text-left ${selectedStrand === 'All' ? 'bg-[#0038A8] text-white shadow-xl' : 'text-slate-500 hover:bg-slate-100'}`}
            >
                <FiLayers className={selectedStrand === 'All' ? 'text-white' : 'text-slate-300'} />
                <span className="truncate">Third Level Official List</span>
            </button>
            <button
                onClick={() => { setSelectedStrand('PERSONNEL_MASTER_REGISTRY'); if(isMobile) setMobileMenuOpen(false); }}
                className={`flex items-center gap-4 px-6 py-4 rounded-3xl text-[11px] font-black uppercase tracking-wider transition-all text-left ${selectedStrand === 'PERSONNEL_MASTER_REGISTRY' ? 'bg-[#CE1126] text-white shadow-xl shadow-red-900/20' : 'text-slate-500 hover:bg-slate-100'} mt-1`}
            >
                <FiUsers className={selectedStrand === 'PERSONNEL_MASTER_REGISTRY' ? 'text-white' : 'text-slate-300'} />
                <span className="truncate">Personnel Master Registry</span>
            </button>

            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4 ml-4 mt-10">Strand Filtering</p>
            {sidebarStrands.filter(s => s !== 'All' && s !== 'PERSONNEL_MASTER_REGISTRY').map(strand => (
                <button
                    key={strand}
                    onClick={() => { setSelectedStrand(strand); if(isMobile) setMobileMenuOpen(false); }}
                    className={`
                        flex items-center gap-4 px-6 py-4 rounded-3xl text-[11px] font-black uppercase tracking-wider transition-all text-left
                        ${selectedStrand === strand ? 'bg-[#FCD116] text-[#0038A8] shadow-lg shadow-yellow-500/20' : 'text-slate-500 hover:bg-slate-100'}
                    `}
                >
                    <FiLayers className={selectedStrand === strand ? 'text-[#0038A8]' : 'text-slate-300'} />
                    <span className="truncate">{strand}</span>
                </button>
            ))}
        </div>
    );

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
                {/* Desktop Sidebar */}
                <aside className="hidden lg:flex flex-col w-80 bg-white border-r border-slate-200 sticky top-0 h-screen overflow-y-auto p-8 z-50 hover:shadow-2xl transition-shadow duration-700">
                    <div className="flex items-center gap-4 mb-10 px-2 cursor-pointer group" onClick={() => navigate('/central-office-nexus')}>
                        <div className="w-12 h-12 bg-[#0038A8] rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-105 transition-transform">
                            <FiChevronLeft size={28} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black italic text-[#0038A8] tracking-tighter">Nexus</h2>
                            <p className="text-[10px] font-black text-slate-300 uppercase mt-1 tracking-widest leading-none">Directory</p>
                        </div>
                    </div>
                    <NavItems />
                </aside>

                <main className="flex-1 min-w-0">
                    <header className="lg:hidden sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-6 py-4 flex justify-between items-center">
                        <button onClick={() => navigate('/central-office-nexus')} className="p-2 text-slate-400"><FiChevronLeft size={24} /></button>
                        <h1 className="text-xl font-black text-[#0038A8] italic">Directory</h1>
                        <button onClick={() => setMobileMenuOpen(true)} className="p-3 bg-[#0038A8] text-white rounded-2xl shadow-lg"><FiMenu size={24} /></button>
                    </header>

                    <div className="px-6 lg:px-16 pt-10 lg:pt-16 pb-6">
                        <div className="hidden lg:flex items-center justify-between mb-12">
                            <div>
                                <h1 className="text-5xl font-black text-slate-950 tracking-tighter italic">Official Registry</h1>
                                <p className="text-[12px] font-black text-slate-400 uppercase tracking-[0.4em] mt-3 ml-1 italic">Authorized 3rd Level Official Information</p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 items-center">
                            <div className="flex-1 relative group shadow-2xl rounded-full w-full">
                                <FiSearch className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#0038A8] transition-colors" size={24} />
                                <input 
                                    type="text" placeholder="Search by name, office, or position..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-white border border-slate-200 focus:border-[#0038A8] rounded-full py-6 pl-20 pr-10 text-lg font-bold text-slate-900 outline-none transition-all"
                                />
                            </div>
                            <button 
                                onClick={() => setShowPreviousModal(true)}
                                className="bg-white border-2 border-slate-100 hover:border-blue-100 p-6 rounded-full text-slate-400 hover:text-[#0038A8] font-black text-xs uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-3 active:scale-95 whitespace-nowrap"
                            >
                                <FiClock size={24}/> Previous Officials
                            </button>
                        </div>

                        {/* CATEGORY TABS */}
                        <div className="mt-12 flex gap-4 bg-slate-100 p-2 rounded-[2.5rem] w-full sm:w-fit self-start">
                            {[
                                { id: 'CESO', label: '3rd Level Officials', count: consolidatedOfficials.counts.reso },
                                { id: 'CHIEFS', label: 'Office in Charge / Chiefs', count: consolidatedOfficials.counts.chiefs }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveCategory(tab.id)}
                                    className={`
                                        flex items-center gap-3 px-8 py-4 rounded-[2rem] text-[11px] font-black uppercase tracking-widest transition-all relative
                                        ${activeCategory === tab.id ? 'bg-white text-[#0038A8] shadow-lg' : 'text-slate-400 hover:text-slate-600'}
                                    `}
                                >
                                    {tab.label}
                                    <span className={`px-2 py-0.5 rounded-lg text-[9px] ${activeCategory === tab.id ? 'bg-blue-50 text-[#0038A8]' : 'bg-slate-200 text-slate-400'}`}>
                                        {tab.count}
                                    </span>
                                    {activeCategory === tab.id && (
                                        <motion.div layoutId="tab-underline" className="absolute bottom-[-10px] left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#0038A8]" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="px-6 lg:px-16 py-10 pb-40 space-y-20">
                        <AnimatePresence mode='popLayout'>
                            {activeStrands.map(strand => (
                                <section key={strand} className="relative">
                                    <div className="sticky top-0 lg:top-4 z-20 flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10 p-6 lg:p-8 group relative overflow-hidden rounded-[3rem] border border-slate-100 shadow-sm bg-slate-50/80 backdrop-blur-md">
                                        <div className="flex items-center gap-6">
                                            <div className={`w-16 h-16 rounded-3xl text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform ${strand === "PERSONNEL MASTER REGISTRY" ? "bg-[#CE1126]" : "bg-[#0038A8]"}`}>
                                                {strand === "PERSONNEL MASTER REGISTRY" ? <FiUsers size={32}/> : <FiLayers size={32}/>}
                                            </div>
                                            <div>
                                                <h2 className={`text-3xl lg:text-4xl font-black italic tracking-tighter leading-none ${strand === "PERSONNEL MASTER REGISTRY" ? "text-[#CE1126]" : "text-[#0038A8]"}`}>{strand}</h2>
                                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] mt-2 italic">{strand.startsWith('Region') || ['CAR', 'NCR', 'NIR'].includes(strand) ? 'Regional Registry' : 'Division Components Registry'}</p>
                                            </div>
                                        </div>

                                        {/* Dynamic Leadership Matrix */}
                                        {strand !== "PERSONNEL MASTER REGISTRY" && (
                                            <div className="flex flex-wrap gap-3 lg:gap-6 bg-white/40 p-4 rounded-3xl border border-white/60">
                                                {(() => {
                                                    const isRegion = strand.startsWith('Region') || ['CAR', 'NCR', 'NIR'].includes(strand);
                                                    const targets = isRegion 
                                                        ? ['RD', 'ARD', 'OIC RD', 'OIC ARD', 'OIC-SDS and RD', 'OIC SDS and OIC RD'] 
                                                        : ['Undersecretary', 'Assistant Secretary', 'OIC Undersecretary', 'OIC Assistant Secretary'];
                                                    
                                                    const leaders = groupedByStrand[strand].filter(o => 
                                                        o.roles.some(r => targets.some(t => r.position.toUpperCase().includes(t.toUpperCase())))
                                                    );

                                                    if (leaders.length === 0) return <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest italic">Leadership Baseline Pending</p>;

                                                    return leaders.map(l => (
                                                        <div key={l.tlid} className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow group/ldr cursor-help" title={l.isVacant ? "Position Vacant" : "Incumbent Leader"}>
                                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black ${l.isVacant ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-[#0038A8]'}`}>
                                                                {l.isVacant ? <FiUserX /> : <FiAward />}
                                                            </div>
                                                            <div>
                                                                <p className="text-[8px] font-black text-[#CE1126] uppercase leading-none mb-1">
                                                                    {l.roles.find(r => targets.some(t => r.position.toUpperCase().includes(t.toUpperCase())))?.position || 'Leader'}
                                                                </p>
                                                                <p className="text-[11px] font-black text-slate-900 tracking-tighter leading-none italic">{l.name}</p>
                                                            </div>
                                                        </div>
                                                    ));
                                                })()}
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                                        {groupedByStrand[strand].map((official, idx) => (
                                            <motion.div
                                                key={official.isVacant ? `v-${official.tlid}` : official.name} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.01 }}
                                                className={`bg-white rounded-[4rem] p-10 flex flex-col relative transition-all duration-500 hover:shadow-2xl border ${official.isVacant ? 'border-dashed border-red-200 bg-red-50/10' : 'border-slate-100 hover:border-[#0038A8]/20'} group`}
                                            >
                                                <div className="flex items-start gap-8 mb-8">
                                                    <div className={`w-28 h-28 rounded-[2.5rem] flex items-center justify-center transition-all shadow-inner ${official.isVacant ? 'bg-red-50 text-red-300' : 'bg-slate-50 text-slate-200 group-hover:bg-[#0038A8] group-hover:text-white'}`}>
                                                        {official.isVacant ? <FiUserX size={48} /> : <FiUser size={48} />}
                                                    </div>
                                                    <div className="flex-1 pt-1">
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <h3 className="text-3xl font-black text-slate-950 tracking-tighter italic group-hover:text-[#0038A8] transition-colors leading-none">
                                                                {official.name} {official.status === 'Active' && <span className="text-blue-500 text-sm not-italic opacity-40 font-bold ml-1">(Incumbent)</span>}
                                                            </h3>
                                                            {official.roles.length > 1 && !official.isVacant && (
                                                                <span className="bg-[#FCD116] text-[#0038A8] text-[9px] font-black px-2 py-0.5 rounded uppercase leading-none">Dual Role</span>
                                                            )}
                                                            {official.isVacant && (
                                                                <span className="bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded leading-none animate-pulse">VACANT</span>
                                                            )}
                                                        </div>
                                                        <div className="space-y-6 mt-8">
                                                            {official.roles.map((role, rIdx) => (
                                                                <div key={rIdx} className="flex flex-col relative">
                                                                    <p className={`text-[12px] font-black uppercase tracking-tighter leading-none ${official.isVacant ? 'text-red-400' : 'text-[#CE1126]'}`}>{role.position}</p>
                                                                    <div className="flex items-center gap-3 mt-3 opacity-60">
                                                                        <FiBriefcase size={14} className="text-slate-400" />
                                                                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">{role.office}</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="mt-auto pt-8 border-t border-slate-50 flex gap-4">
                                                    <button onClick={() => fetchFullProfile(official)} className="flex-1 py-5 bg-slate-100 group-hover:bg-[#0038A8] text-slate-400 group-hover:text-white font-black text-xs uppercase tracking-widest rounded-[2rem] transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2">View Profile</button>
                                                    <button 
                                                        onClick={() => {
                                                            setFormData({
                                                                tlid: official.tlid,
                                                                name: official.name,
                                                                position: official.position,
                                                                email: official.email,
                                                                alt_email_1: official.alt_email_1,
                                                                alt_email_2: official.alt_email_2,
                                                                contact_details: official.contact_details,
                                                                alt_contact_details_1: official.alt_contact_details_1,
                                                                alt_contact_details_2: official.alt_contact_details_2,
                                                                assignment_date: official.assignment_date ? new Date(official.assignment_date).toISOString().split('T')[0] : ''
                                                            });
                                                            setShowEditModal(true);
                                                        }} 
                                                        className="p-5 bg-slate-50 text-slate-300 hover:bg-orange-500 hover:text-white rounded-[1.5rem] transition-all"
                                                        title="Quick Edit Information"
                                                    >
                                                        <FiSettings size={18}/>
                                                    </button>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </section>
                            ))}
                        </AnimatePresence>
                        {activeStrands.length === 0 && !loading && (
                            <div className="py-20 flex flex-col items-center opacity-20"><FiInbox size={80} className="mb-6"/><p className="text-3xl font-black italic">No Matching Registry Entries</p></div>
                        )}
                    </div>
                </main>

                {/* Profile Modal — Tabbed Profiling */}
                <AnimatePresence>
                    {showProfileModal && selectedOfficial && (
                        <div className="fixed inset-0 z-[1000] flex items-start sm:items-center justify-center p-3 lg:p-6 pt-6 sm:pt-6">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowProfileModal(false)} className="fixed inset-0 bg-[#001D56]/80 backdrop-blur-xl cursor-pointer" />
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                                className="w-full max-w-6xl bg-white rounded-[3rem] relative overflow-hidden text-left shadow-[0_60px_120px_-30px_rgba(0,0,0,0.5)] flex flex-col border border-white/20"
                                style={{ maxHeight: '92vh' }}
                            >
                                {/* Modal Header */}
                                <div className={`${selectedOfficial.isVacant ? 'bg-slate-900' : 'bg-[#0038A8]'} px-8 py-7 lg:px-12 lg:py-10 text-white flex flex-col md:flex-row items-center gap-7 shrink-0 relative`}>
                                    <div className="w-24 h-24 lg:w-32 lg:h-32 rounded-[2.5rem] bg-white flex items-center justify-center relative shadow-2xl shrink-0">
                                        {selectedOfficial.isVacant ? <FiUserX size={56} className="text-red-200" /> : <FiUser size={56} className="text-[#0038A8]" />}
                                        <div className={`absolute -bottom-2 -right-2 w-9 h-9 rounded-xl flex items-center justify-center shadow-lg ${selectedOfficial.isVacant ? 'bg-red-500 text-white' : 'bg-[#FCD116] text-[#0038A8]'}`}>{selectedOfficial.isVacant ? <FiXCircle size={18} /> : <FiAward size={18} />}</div>
                                    </div>
                                    <div className="flex-1 text-center md:text-left min-w-0">
                                        <div className={`inline-flex px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase mb-3 ${selectedOfficial.status === 'Active' ? 'bg-emerald-500' : 'bg-red-500'} shadow-lg`}>{selectedOfficial.status} POSITION</div>
                                        <h2 className="text-3xl lg:text-5xl font-black italic tracking-tighter leading-none mb-3 truncate">
                                            {selectedOfficial.name}
                                            {selectedOfficial.status === 'Active' && <span className="text-white/40 text-base not-italic font-bold ml-3">(Incumbent)</span>}
                                        </h2>
                                        <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                                            {selectedOfficial.roles.map((r, ri) => (
                                                <div key={ri} className="px-5 py-2 bg-white/10 rounded-2xl border border-white/10">
                                                    <p className="text-[9px] font-black text-blue-200 uppercase mb-0.5">{r.office}</p>
                                                    <p className="text-sm font-bold text-white">{r.position}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <button onClick={() => setShowProfileModal(false)} className="absolute top-6 right-6 p-3 hover:bg-white/10 rounded-full transition-all"><FiX size={28} /></button>
                                </div>

                                {/* Tab Navigation */}
                                <div className="flex overflow-x-auto border-b border-slate-100 bg-white shrink-0 scrollbar-none">
                                    {[
                                        { id: 'overview',    label: 'Overview',      icon: FiActivity },
                                        { id: 'personal',    label: 'Personal Info', icon: FiUser },
                                        { id: 'eligibility', label: 'Eligibility',   icon: FiAward },
                                        { id: 'experience',  label: 'Experience',    icon: FiBriefcase },
                                        { id: 'education',   label: 'Education',     icon: FiBook },
                                        { id: 'documents',   label: 'Documents',     icon: FiFileText },
                                        { id: 'legal',       label: 'Legal',         icon: FiShield },
                                    ].map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setProfileTab(tab.id)}
                                            className={`flex items-center gap-2 px-5 py-4 text-[10px] font-black uppercase tracking-widest whitespace-nowrap border-b-2 transition-all ${profileTab === tab.id ? 'border-[#0038A8] text-[#0038A8] bg-blue-50/50' : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            <tab.icon size={13} />{tab.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Tab Content */}
                                <div className="overflow-y-auto flex-1">

                                    {/* ── OVERVIEW TAB ── */}
                                    {profileTab === 'overview' && (
                                        <div className="p-8 lg:p-12">
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
                                                <div className="space-y-12">
                                                    <section>
                                                        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.5em] mb-8 border-l-8 border-[#CE1126] pl-6 font-mono">Profile Matrix</h4>
                                                        <div className="flex flex-col gap-8 bg-slate-50 p-8 rounded-[3rem] border border-slate-100 shadow-inner">
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                                <div className="space-y-4">
                                                                    <div className="space-y-2">
                                                                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Primary Identity</span>
                                                                        <p className="text-sm font-black text-slate-900 break-words">{selectedOfficial.email || 'N/A ELECTRONIC MAIL'}</p>
                                                                    </div>
                                                                    <div className="space-y-2 pt-4">
                                                                        <span className="text-[9px] font-black text-[#0038A8] uppercase tracking-widest flex items-center gap-2"><FiClock /> Assigned Since</span>
                                                                        <p className="text-sm font-black text-slate-900">{selectedOfficial.assignment_date ? new Date(selectedOfficial.assignment_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'BASELINE JAN 2026'}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Direct Contact</span>
                                                                    <p className="text-sm font-black text-slate-900">{selectedOfficial.contact_details || 'N/A EXTENSION'}</p>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-200/50">
                                                                <div className="space-y-2 overflow-hidden">
                                                                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Support Line</span>
                                                                    <p className="text-sm font-bold text-slate-600 italic break-all">{selectedOfficial.alt_email_1 || 'N/A SUPPORT'}</p>
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Internal VoIP</span>
                                                                    <p className="text-sm font-bold text-slate-600 italic">{selectedOfficial.alt_contact_details_1 || 'N/A VOIP'}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </section>

                                                    {!selectedOfficial.isVacant && (
                                                        <section className="bg-[#0038A8]/5 p-8 rounded-[3rem] border border-[#0038A8]/10 relative overflow-hidden">
                                                            <div className="absolute top-0 right-0 w-32 h-32 bg-[#0038A8]/5 rounded-full -mr-16 -mt-16 blur-2xl" />
                                                            <h4 className="text-[11px] font-black text-[#0038A8] uppercase tracking-[0.5em] mb-8 border-l-8 border-[#FCD116] pl-6 font-mono">Professional Career Path</h4>
                                                            <div className="space-y-6 pl-4">
                                                                {careerPath.length > 0 ? careerPath.map((item, idx) => (
                                                                    <div key={idx} className="relative pl-10 border-l-2 border-slate-200">
                                                                        <div className={`absolute left-0 top-0 -translate-x-1/2 w-4 h-4 rounded-full border-4 bg-white ${idx === careerPath.length - 1 ? 'border-[#0038A8]' : 'border-slate-300'}`} />
                                                                        <div className="flex items-center gap-3 mb-1">
                                                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.strand || 'N/A'} STRAND</p>
                                                                            <span className="text-[7px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 uppercase tracking-tighter">{item.movement_type}</span>
                                                                        </div>
                                                                        <h5 className={`text-base font-black italic tracking-tighter leading-none ${idx === careerPath.length - 1 ? 'text-[#0038A8]' : 'text-slate-500'}`}>{item.position || 'N/A'}</h5>
                                                                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{item.office || 'N/A'}</p>
                                                                        <p className="text-[9px] font-bold text-slate-400 mt-1 italic">Effective: {new Date(item.effective_date || item.created_at).toLocaleDateString()}</p>
                                                                    </div>
                                                                )) : (
                                                                    <div className="py-6 text-sm font-black italic text-slate-300 uppercase tracking-widest opacity-40">Career baseline tracking initiated Jan 2026.</div>
                                                                )}
                                                            </div>
                                                        </section>
                                                    )}

                                                    <div className="pt-8 border-t border-slate-100">
                                                        {!selectedOfficial.isVacant ? (
                                                            <div className="flex flex-col sm:flex-row gap-4">
                                                                <button onClick={() => { setFormData({ tlid: selectedOfficial.roles[0].tlid, assignment_date: new Date().toISOString().split('T')[0], new_strand: selectedOfficial.roles[0].strand, new_office: selectedOfficial.roles[0].office, new_position: selectedOfficial.roles[0].position }); setSelectedReasons([]); setOtherReason(''); setShowMoveModal(true); }} className="flex-1 py-5 bg-slate-900 text-white font-black text-xs uppercase tracking-widest rounded-full hover:shadow-2xl shadow-black/20 transition-all flex items-center justify-center gap-3 active:scale-95"><FiArrowRight size={16} /> Reassign</button>
                                                                <button onClick={() => { setFormData({ tlid: selectedOfficial.roles[0].tlid, assignment_date: new Date().toISOString().split('T')[0], successor_position: selectedOfficial.roles[0].position }); setSelectedReasons([]); setOtherReason(''); setShowReplaceModal(true); }} className="flex-1 py-5 bg-[#0038A8] text-white font-black text-xs uppercase tracking-widest rounded-full hover:shadow-2xl shadow-blue-900/20 transition-all flex items-center justify-center gap-3 active:scale-95"><FiRepeat size={16} /> Succeed</button>
                                                                <button onClick={() => { setFormData({ tlid: selectedOfficial.roles[0].tlid, assignment_date: new Date().toISOString().split('T')[0] }); setSelectedReasons([]); setOtherReason(''); setShowVacateModal(true); }} className="flex-1 py-5 bg-red-600 text-white font-black text-xs uppercase tracking-widest rounded-full hover:shadow-2xl shadow-red-900/20 transition-all flex items-center justify-center gap-3 active:scale-95"><FiLogOut size={16} /> Vacate</button>
                                                            </div>
                                                        ) : (
                                                            <button onClick={() => { setFormData({ tlid: selectedOfficial.roles[0].tlid, assignment_date: new Date().toISOString().split('T')[0], successor_position: selectedOfficial.roles[0].position }); setSelectedReasons([]); setOtherReason(''); setShowReplaceModal(true); }} className="w-full py-7 bg-[#0038A8] text-white font-black text-sm uppercase tracking-widest rounded-[2rem] hover:shadow-2xl shadow-blue-900/40 transition-all flex items-center justify-center gap-4 active:scale-95"><FiRepeat size={22} /> Fill Vacancy</button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="bg-slate-50/50 rounded-[3rem] p-10 border border-slate-100 flex flex-col min-h-[400px]">
                                                    <h4 className="text-[11px] font-black text-[#0038A8] uppercase tracking-[0.5em] mb-10 flex items-center gap-4 italic shrink-0 font-mono"><FiClock className="text-[#CE1126]" /> Succession Legacy Registry</h4>
                                                    <div className="flex-1 overflow-y-visible relative pl-4">
                                                        <div className="absolute left-10 top-0 bottom-0 w-1.5 bg-white rounded-full shadow-inner" />
                                                        <div className="space-y-12 relative z-10">
                                                            {positionHistory.length > 0 ? positionHistory.map((successor, i) => {
                                                                const badgeStyles = { 'INITIAL_ENTRY': 'bg-sky-50 text-sky-600 border-sky-100', 'REASSIGNMENT': 'bg-violet-50 text-violet-600 border-violet-100', 'EXCLUSION_REPLACED': 'bg-amber-50 text-amber-600 border-amber-100', 'REPLACEMENT_IN': 'bg-emerald-50 text-emerald-600 border-emerald-100', 'VACATED': 'bg-rose-50 text-rose-600 border-rose-100' };
                                                                const badgeLabel = (successor.movement_type || successor.change_type || 'UPDATE').replace('_', ' ');
                                                                return (
                                                                    <div key={successor.tlid + i} className="relative pl-20 group">
                                                                        <div className={`absolute left-0 top-1 w-14 h-14 rounded-[1.5rem] bg-white border-4 ${successor.status === 'Active' ? 'border-[#FCD116]' : 'border-slate-100'} flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform`}><FiAward className={successor.status === 'Active' ? 'text-[#0038A8]' : 'text-slate-200'} size={20} /></div>
                                                                        <div className="space-y-2">
                                                                            <div className="flex flex-wrap items-center gap-2">
                                                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">REF: {successor.tlid}</p>
                                                                                <span className={`text-[8px] font-black px-2 py-0.5 rounded-full border uppercase tracking-tighter ${badgeStyles[successor.movement_type || successor.change_type] || 'bg-slate-50 text-slate-400 border-slate-100'}`}>{badgeLabel}</span>
                                                                                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest font-mono">{new Date(successor.effective_date || successor.updated_at || successor.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                                                                            </div>
                                                                            <div>
                                                                                <h5 className={`text-xl font-black italic tracking-tighter leading-none ${successor.status === 'Active' ? 'text-[#0038A8]' : 'text-slate-600'}`}>{successor.name} {successor.status === 'Active' && <span className="text-blue-500 text-xs not-italic font-bold ml-1">(Incumbent)</span>}</h5>
                                                                                <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-widest">{successor.position}</p>
                                                                            </div>
                                                                            {successor.remarks && (
                                                                                <div className="bg-white/60 border border-slate-100 p-4 rounded-[1.5rem] shadow-sm relative overflow-hidden group/note">
                                                                                    <div className="absolute top-0 left-0 w-1 h-full bg-slate-200 group-hover/note:bg-[#0038A8] transition-colors" />
                                                                                    <div className="flex items-start gap-3 pl-3"><FiInfo className="mt-1 shrink-0 text-slate-300 group-hover/note:text-[#0038A8] transition-colors" size={14} /><p className="text-[11px] font-bold text-slate-600 italic leading-relaxed">{successor.remarks}</p></div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }) : (<div className="pl-20 py-6 text-sm font-black italic text-slate-300 uppercase tracking-widest opacity-40">No legacy history found for this position.</div>)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* ── PERSONAL INFO TAB ── */}
                                    {profileTab === 'personal' && (
                                        <div className="p-8 lg:p-12 space-y-10">
                                            {/* Name */}
                                            <div>
                                                <p className="text-[10px] font-black text-[#CE1126] uppercase tracking-[0.4em] mb-6 border-l-4 border-[#CE1126] pl-4">Personal Information</p>
                                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                                                    {[
                                                        { label: 'Last Name', field: 'last_name' },
                                                        { label: 'First Name', field: 'first_name' },
                                                        { label: 'Middle Name', field: 'middle_name' },
                                                        { label: 'Suffix', field: 'suffix', placeholder: 'Jr., III, N/A' },
                                                    ].map(({ label, field, placeholder }) => (
                                                        <div key={field} className="flex flex-col gap-2">
                                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
                                                            <input type="text" value={profileEdits[field] || ''} onChange={e => setProfileEdits(p => ({ ...p, [field]: e.target.value }))} placeholder={placeholder} className="w-full bg-slate-50 border-2 border-transparent focus:border-[#0038A8] rounded-2xl py-3 px-5 text-sm font-bold text-slate-800 outline-none transition-all" />
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mt-5">
                                                    <div className="flex flex-col gap-2">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Gender</label>
                                                        <select value={profileEdits.gender || ''} onChange={e => setProfileEdits(p => ({ ...p, gender: e.target.value }))} className="w-full bg-slate-50 border-2 border-transparent focus:border-[#0038A8] rounded-2xl py-3 px-5 text-sm font-bold text-slate-800 outline-none transition-all">
                                                            <option value="">Select</option>
                                                            <option value="Male">Male</option>
                                                            <option value="Female">Female</option>
                                                        </select>
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Date of Birth</label>
                                                        <input type="date" value={profileEdits.date_of_birth || ''} onChange={e => setProfileEdits(p => ({ ...p, date_of_birth: e.target.value, age: computeAge(e.target.value) }))} className="w-full bg-slate-50 border-2 border-transparent focus:border-[#0038A8] rounded-2xl py-3 px-5 text-sm font-bold text-slate-800 outline-none transition-all" />
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Age (auto-computed)</label>
                                                        <div className="w-full bg-slate-100 rounded-2xl py-3 px-5 text-sm font-black text-[#0038A8]">{profileEdits.age || '—'}</div>
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Civil Status</label>
                                                        <select value={profileEdits.civil_status || ''} onChange={e => setProfileEdits(p => ({ ...p, civil_status: e.target.value }))} className="w-full bg-slate-50 border-2 border-transparent focus:border-[#0038A8] rounded-2xl py-3 px-5 text-sm font-bold text-slate-800 outline-none transition-all">
                                                            <option value="">Select</option>
                                                            {['Single', 'Married', 'Widowed', 'Separated'].map(o => <option key={o} value={o}>{o}</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Designation & Appointment */}
                                            <div>
                                                <p className="text-[10px] font-black text-[#0038A8] uppercase tracking-[0.4em] mb-6 border-l-4 border-[#0038A8] pl-4">Designation & Appointment</p>
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                                    {[
                                                        { label: 'Designation', field: 'position', placeholder: 'e.g. OIC-ASDS' },
                                                        { label: 'Assignment', field: 'office', placeholder: 'e.g. SDO Pasig City' },
                                                        { label: 'Date of Assignment', field: 'assignment_date', type: 'date' },
                                                        { label: 'Position Title (Appointment)', field: 'position_title', placeholder: 'e.g. Chief Education Supervisor' },
                                                        { label: 'Date of Present Position', field: 'appointment_date', type: 'date' },
                                                    ].map(({ label, field, type = 'text', placeholder }) => (
                                                        <div key={field} className="flex flex-col gap-2">
                                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
                                                            <input type={type} value={profileEdits[field] || ''} onChange={e => setProfileEdits(p => ({ ...p, [field]: e.target.value }))} placeholder={placeholder} className="w-full bg-slate-50 border-2 border-transparent focus:border-[#0038A8] rounded-2xl py-3 px-5 text-sm font-bold text-slate-800 outline-none transition-all" />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Permanent Address */}
                                            <div>
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-6 border-l-4 border-slate-300 pl-4">Contact Addendum</p>
                                                <div className="flex flex-col gap-2">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Permanent Address</label>
                                                    <input type="text" value={profileEdits.permanent_address || ''} onChange={e => setProfileEdits(p => ({ ...p, permanent_address: e.target.value }))} placeholder="House No., Street, Barangay, City, Province" className="w-full bg-slate-50 border-2 border-transparent focus:border-[#0038A8] rounded-2xl py-3 px-5 text-sm font-bold text-slate-800 outline-none transition-all" />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* ── ELIGIBILITY TAB ── */}
                                    {profileTab === 'eligibility' && (
                                        <div className="p-8 lg:p-12 space-y-10">
                                            <div>
                                                <p className="text-[10px] font-black text-[#CE1126] uppercase tracking-[0.4em] mb-6 border-l-4 border-[#CE1126] pl-4">EMT Eligibility</p>
                                                <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 space-y-6">
                                                    <div className="flex flex-col gap-3">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Are you an EMT Passer?</label>
                                                        <div className="flex gap-4">
                                                            {[{ val: true, label: 'Yes' }, { val: false, label: 'No' }].map(opt => (
                                                                <button key={String(opt.val)} onClick={() => setProfileEdits(p => ({ ...p, emt_passer: opt.val }))} className={`flex-1 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all border-2 ${profileEdits.emt_passer === opt.val ? (opt.val ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-red-500 text-white border-red-500') : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}>{opt.label}</button>
                                                            ))}
                                                            <button onClick={() => setProfileEdits(p => ({ ...p, emt_passer: null, emt_date: '' }))} className="px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest border-2 border-slate-200 text-slate-300 hover:border-slate-400 transition-all">Clear</button>
                                                        </div>
                                                    </div>
                                                    {profileEdits.emt_passer === true && (
                                                        <div className="flex flex-col gap-2">
                                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Date Passed EMT</label>
                                                            <input type="date" value={profileEdits.emt_date || ''} onChange={e => setProfileEdits(p => ({ ...p, emt_date: e.target.value }))} className="w-full bg-white border-2 border-transparent focus:border-[#0038A8] rounded-2xl py-3 px-5 text-sm font-bold outline-none transition-all" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div>
                                                <p className="text-[10px] font-black text-[#0038A8] uppercase tracking-[0.4em] mb-6 border-l-4 border-[#0038A8] pl-4">CES Eligibility</p>
                                                <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 space-y-6">
                                                    <div className="flex flex-col gap-2">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Stage Completed / CES Rank</label>
                                                        <select value={profileEdits.ces_stage || ''} onChange={e => setProfileEdits(p => ({ ...p, ces_stage: e.target.value }))} className="w-full bg-white border-2 border-transparent focus:border-[#0038A8] rounded-2xl py-3 px-5 text-sm font-bold text-slate-800 outline-none transition-all">
                                                            <option value="">Select stage</option>
                                                            {[
                                                                'Stage 1 (CES Written Examination)',
                                                                'Stage 2 (Assessment Center)',
                                                                'Stage 3 (Performance Validation)',
                                                                'Stage 4 (Board Interview)',
                                                                'CES Eligible',
                                                                'CESO VI', 'CESO V', 'CESO IV', 'CESO III', 'CESO II', 'CESO I'
                                                            ].map(o => <option key={o} value={o}>{o}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Date of Conferment</label>
                                                        <input type="date" value={profileEdits.ces_conferment_date || ''} onChange={e => setProfileEdits(p => ({ ...p, ces_conferment_date: e.target.value }))} className="w-full bg-white border-2 border-transparent focus:border-[#0038A8] rounded-2xl py-3 px-5 text-sm font-bold outline-none transition-all" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* ── EXPERIENCE TAB ── */}
                                    {profileTab === 'experience' && (
                                        <div className="p-8 lg:p-12 space-y-10">
                                            <div>
                                                <p className="text-[10px] font-black text-[#CE1126] uppercase tracking-[0.4em] mb-6 border-l-4 border-[#CE1126] pl-4">Managerial Experience</p>
                                                <div className="flex flex-col gap-2 max-w-xs">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Years in 3rd Level Position (incl. OIC)</label>
                                                    <input type="number" min="0" step="0.5" value={profileEdits.total_years_third_level || ''} onChange={e => setProfileEdits(p => ({ ...p, total_years_third_level: e.target.value }))} placeholder="e.g. 3.5" className="w-full bg-slate-50 border-2 border-transparent focus:border-[#0038A8] rounded-2xl py-3 px-5 text-sm font-bold outline-none transition-all" />
                                                </div>
                                            </div>

                                            <div>
                                                <p className="text-[10px] font-black text-[#0038A8] uppercase tracking-[0.4em] mb-6 border-l-4 border-[#0038A8] pl-4">Previous Positions Held</p>
                                                <div className="space-y-4">
                                                    <div className="hidden lg:grid grid-cols-[1fr_1fr_120px_120px_80px_44px] gap-3 px-4">
                                                        {['Position', 'Office / Division', 'From', 'To', 'OIC?', ''].map(h => (
                                                            <span key={h} className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{h}</span>
                                                        ))}
                                                    </div>
                                                    <div className="space-y-3">
                                                        {prevPositions.map((pos, idx) => (
                                                            <motion.div key={pos.position_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_120px_120px_80px_44px] gap-3 items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                                                <input type="text" value={pos.position_name || ''} onChange={e => setPrevPositions(p => p.map((x, i) => i === idx ? { ...x, position_name: e.target.value } : x))} placeholder="Position" className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#0038A8] transition-all" />
                                                                <input type="text" value={pos.office || ''} onChange={e => setPrevPositions(p => p.map((x, i) => i === idx ? { ...x, office: e.target.value } : x))} placeholder="Office / Division" className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#0038A8] transition-all" />
                                                                <input type="date" value={pos.start_date ? pos.start_date.split('T')[0] : ''} onChange={e => setPrevPositions(p => p.map((x, i) => i === idx ? { ...x, start_date: e.target.value } : x))} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#0038A8] transition-all" />
                                                                <input type="date" value={pos.end_date ? pos.end_date.split('T')[0] : ''} onChange={e => setPrevPositions(p => p.map((x, i) => i === idx ? { ...x, end_date: e.target.value } : x))} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#0038A8] transition-all" />
                                                                <button onClick={() => setPrevPositions(p => p.map((x, i) => i === idx ? { ...x, is_oic: !x.is_oic } : x))} className={`flex items-center justify-center gap-1 text-[10px] font-black uppercase py-2 px-3 rounded-xl transition-all ${pos.is_oic ? 'bg-[#FCD116] text-[#0038A8]' : 'bg-white border border-slate-200 text-slate-400'}`}>{pos.is_oic ? <FiToggleRight size={14}/> : <FiToggleLeft size={14}/>} OIC</button>
                                                                <button onClick={() => handleRemovePosition(pos)} className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-all"><FiTrash2 size={14} /></button>
                                                            </motion.div>
                                                        ))}
                                                    </div>
                                                    <button onClick={handleAddPosition} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-black text-[10px] uppercase tracking-widest hover:border-[#0038A8] hover:text-[#0038A8] transition-all flex items-center justify-center gap-2 mt-4">
                                                        <FiPlus size={14} /> Add Position
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* ── EDUCATION TAB ── */}
                                    {profileTab === 'education' && (
                                        <div className="p-8 lg:p-12 space-y-10">
                                            <div>
                                                <p className="text-[10px] font-black text-[#CE1126] uppercase tracking-[0.4em] mb-6 border-l-4 border-[#CE1126] pl-4">Educational Attainment</p>
                                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                                                    <div className="flex flex-col gap-2">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Highest Educational Attainment</label>
                                                        <select value={profileEdits.highest_education || ''} onChange={e => setProfileEdits(p => ({ ...p, highest_education: e.target.value }))} className="w-full bg-slate-50 border-2 border-transparent focus:border-[#0038A8] rounded-2xl py-3 px-5 text-sm font-bold text-slate-800 outline-none transition-all">
                                                            <option value="">Select</option>
                                                            {['Post-Doctoral Studies', "Doctorate Degree (PhD, EdD, DBA)", "Master's Degree (MAEd, MS, MBA)", "Bachelor's Degree"].map(o => <option key={o} value={o}>{o}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Program / Field of Study</label>
                                                        <input type="text" value={profileEdits.education_program || ''} onChange={e => setProfileEdits(p => ({ ...p, education_program: e.target.value }))} placeholder="e.g. Educational Management" className="w-full bg-slate-50 border-2 border-transparent focus:border-[#0038A8] rounded-2xl py-3 px-5 text-sm font-bold outline-none transition-all" />
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Year Graduated</label>
                                                        <input type="number" min="1950" max="2099" value={profileEdits.education_year_graduated || ''} onChange={e => setProfileEdits(p => ({ ...p, education_year_graduated: e.target.value }))} placeholder="e.g. 2005" className="w-full bg-slate-50 border-2 border-transparent focus:border-[#0038A8] rounded-2xl py-3 px-5 text-sm font-bold outline-none transition-all" />
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <p className="text-[10px] font-black text-[#0038A8] uppercase tracking-[0.4em] mb-6 border-l-4 border-[#0038A8] pl-4">Relevant Trainings</p>
                                                <div className="space-y-3">
                                                    <div className="hidden lg:grid grid-cols-[1fr_160px_44px] gap-3 px-4">
                                                        {['Training Name', 'Date Completed', ''].map(h => <span key={h} className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{h}</span>)}
                                                    </div>
                                                    {trainings.map((tr, idx) => (
                                                        <motion.div key={tr.training_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-[1fr_160px_44px] gap-3 items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                                            <input type="text" value={tr.training_name || ''} onChange={e => setTrainings(t => t.map((x, i) => i === idx ? { ...x, training_name: e.target.value } : x))} placeholder="Training / Seminar name" className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#0038A8] transition-all" />
                                                            <input type="date" value={tr.date_completed ? tr.date_completed.split('T')[0] : ''} onChange={e => setTrainings(t => t.map((x, i) => i === idx ? { ...x, date_completed: e.target.value } : x))} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#0038A8] transition-all" />
                                                            <button onClick={() => handleRemoveTraining(tr)} className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-all"><FiTrash2 size={14} /></button>
                                                        </motion.div>
                                                    ))}
                                                    <button onClick={handleAddTraining} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-black text-[10px] uppercase tracking-widest hover:border-[#0038A8] hover:text-[#0038A8] transition-all flex items-center justify-center gap-2 mt-2">
                                                        <FiPlus size={14} /> Add Training
                                                    </button>
                                                </div>
                                            </div>

                                            <div>
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-6 border-l-4 border-slate-300 pl-4">Performance & Recognition</p>
                                                <div className="space-y-5">
                                                    <div className="flex flex-col gap-2">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Notable Achievement/s (e.g. Gawad CES)</label>
                                                        <textarea value={profileEdits.notable_achievements || ''} onChange={e => setProfileEdits(p => ({ ...p, notable_achievements: e.target.value }))} rows={3} placeholder="List notable awards, recognitions, or achievements..." className="w-full bg-slate-50 border-2 border-transparent focus:border-[#0038A8] rounded-2xl py-3 px-5 text-sm font-bold outline-none transition-all resize-none" />
                                                    </div>
                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                                        <div className="flex flex-col gap-2">
                                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Latest Performance Rating (IPCRF / OPCRF)</label>
                                                            <input type="text" value={profileEdits.performance_rating_ipcrf || ''} onChange={e => setProfileEdits(p => ({ ...p, performance_rating_ipcrf: e.target.value }))} placeholder="e.g. Outstanding (4.5)" className="w-full bg-slate-50 border-2 border-transparent focus:border-[#0038A8] rounded-2xl py-3 px-5 text-sm font-bold outline-none transition-all" />
                                                        </div>
                                                        <div className="flex flex-col gap-2">
                                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Latest Performance Rating (CESPES)</label>
                                                            <input type="text" value={profileEdits.performance_rating_cespes || ''} onChange={e => setProfileEdits(p => ({ ...p, performance_rating_cespes: e.target.value }))} placeholder="e.g. 4.86 (Optional)" className="w-full bg-slate-50 border-2 border-transparent focus:border-[#0038A8] rounded-2xl py-3 px-5 text-sm font-bold outline-none transition-all" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* ── DOCUMENTS TAB ── */}
                                    {profileTab === 'documents' && (
                                        <div className="p-8 lg:p-12 space-y-8">
                                            <div className="flex items-start gap-4 p-6 bg-blue-50 rounded-[2rem] border border-blue-100">
                                                <FiInfo className="text-[#0038A8] mt-1 shrink-0" size={18} />
                                                <p className="text-[11px] font-bold text-blue-700 leading-relaxed">Document uploads are handled separately. Files will be stored in the unified binary store. Current field IDs are shown for reference — upload integration coming next.</p>
                                            </div>
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                {[
                                                    { label: '2x2 ID Picture', field: 'photo_binary_id', note: 'PNG, JPG — official photo', accept: 'image/*' },
                                                    { label: 'Personal Data Sheet (CSC Form 212, rev 2025)', field: 'pds_binary_id', note: 'PDF with Work Experience Sheet', accept: '.pdf' },
                                                    { label: 'Accomplished Profile (Word File)', field: 'profile_word_binary_id', note: 'Optional — tinyurl.com/3rdLevelForms', accept: '.doc,.docx' },
                                                    { label: 'Accomplished Profile (PPT Format)', field: 'profile_ppt_binary_id', note: 'Optional — tinyurl.com/3rdLevelForms', accept: '.ppt,.pptx' },
                                                    { label: 'Service Records', field: 'service_records_binary_id', note: 'PDF — for position verification', accept: '.pdf' },
                                                ].map(({ label, field, note, accept }) => (
                                                    <div key={field} className="flex flex-col gap-3 p-6 bg-slate-50 rounded-[2rem] border border-slate-100 group hover:border-[#0038A8]/20 transition-all">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-[#0038A8] shadow-sm"><FiFileText size={18} /></div>
                                                            <div>
                                                                <p className="text-[11px] font-black text-slate-800 leading-tight">{label}</p>
                                                                <p className="text-[9px] font-bold text-slate-400 italic mt-0.5">{note}</p>
                                                            </div>
                                                        </div>
                                                        {profileEdits[field] ? (
                                                            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2">
                                                                <FiCheckCircle size={14} className="text-emerald-500 shrink-0" />
                                                                <span className="text-[10px] font-black text-emerald-700 truncate">{profileEdits[field]}</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-3 bg-slate-100 border border-dashed border-slate-300 rounded-xl px-4 py-2">
                                                                <FiUpload size={14} className="text-slate-400 shrink-0" />
                                                                <span className="text-[10px] font-bold text-slate-400 italic">No file linked yet</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* ── LEGAL STATUS TAB ── */}
                                    {profileTab === 'legal' && (
                                        <div className="p-8 lg:p-12 space-y-8">
                                            <div className="flex items-start gap-4 p-6 bg-amber-50 rounded-[2rem] border border-amber-200">
                                                <FiAlertTriangle className="text-amber-500 mt-1 shrink-0" size={20} />
                                                <div>
                                                    <p className="text-[11px] font-black text-amber-800 uppercase tracking-widest mb-1">Confidential Section</p>
                                                    <p className="text-[11px] font-bold text-amber-700 leading-relaxed">This section is optional. Information disclosed here is treated with strict confidentiality per civil service guidelines. Officials may opt not to disclose.</p>
                                                </div>
                                            </div>
                                            <div className="space-y-6">
                                                <div className="flex flex-col gap-2">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pending Administrative Case/s</label>
                                                    <textarea value={profileEdits.pending_admin_case || ''} onChange={e => setProfileEdits(p => ({ ...p, pending_admin_case: e.target.value }))} rows={4} placeholder="Optional — may be left blank. If applicable, describe the nature of the case." className="w-full bg-slate-50 border-2 border-transparent focus:border-amber-400 rounded-2xl py-3 px-5 text-sm font-bold outline-none transition-all resize-none" />
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ombudsman / Sandiganbayan / CSC Case/s</label>
                                                    <textarea value={profileEdits.ombudsman_case || ''} onChange={e => setProfileEdits(p => ({ ...p, ombudsman_case: e.target.value }))} rows={4} placeholder="Optional — may be left blank." className="w-full bg-slate-50 border-2 border-transparent focus:border-amber-400 rounded-2xl py-3 px-5 text-sm font-bold outline-none transition-all resize-none" />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Save Bar — shown on all profiling tabs */}
                                {profileTab !== 'overview' && (
                                    <div className="shrink-0 px-8 py-5 bg-white border-t border-slate-100 flex justify-end gap-4">
                                        <button onClick={() => setProfileTab('overview')} className="px-8 py-3 bg-slate-100 text-slate-500 font-black text-[10px] uppercase tracking-widest rounded-full hover:bg-slate-200 transition-all">Cancel</button>
                                        <button onClick={handleProfileSave} disabled={profileSaving} className="px-10 py-3 bg-[#0038A8] text-white font-black text-[10px] uppercase tracking-widest rounded-full shadow-xl hover:bg-blue-900 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-3">
                                            {profileSaving ? 'Saving...' : <><FiSave size={13} /> Save Profile</>}
                                        </button>
                                    </div>
                                )}
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Master Personnel Registry / Previous Officials Modal */}
                <AnimatePresence>
                    {showPreviousModal && (
                        <div className="fixed inset-0 z-[2000] overflow-y-auto">
                            <div className="flex min-h-screen items-start sm:items-center justify-center p-6 text-center pt-10 sm:pt-12">
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowPreviousModal(false)} className="fixed inset-0 bg-[#020617]/90 backdrop-blur-2xl cursor-pointer" />
                                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-5xl bg-white rounded-[4rem] relative overflow-hidden text-left shadow-2xl flex flex-col max-h-[85vh] border border-white/10">
                                    <div className="bg-slate-950 p-12 flex justify-between items-center text-white shrink-0">
                                        <div className="flex items-center gap-8">
                                            <div className="w-16 h-16 bg-[#0038A8] rounded-[2rem] flex items-center justify-center shadow-xl shadow-blue-900/30"><FiClock size={32}/></div>
                                            <div><h2 className="text-4xl font-black italic tracking-tighter leading-none">Previous Officials</h2><p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] mt-3">Personnel Legacy Registry</p></div>
                                        </div>
                                        <button onClick={() => setShowPreviousModal(false)} className="p-4 bg-white/5 rounded-full hover:bg-white/10"><FiX size={32} /></button>
                                    </div>
                                    <div className="p-12 overflow-y-auto scrollbar-none flex-1 space-y-8">
                                        {previousOfficials.length > 0 ? previousOfficials.map(off => (
                                            <div key={off.tlid} className="p-10 rounded-[3rem] border border-slate-100 flex items-center justify-between hover:bg-slate-50 transition-all group">
                                                <div className="flex items-center gap-8">
                                                    <div className="w-20 h-20 bg-slate-50 rounded-[1.75rem] flex items-center justify-center text-slate-200 group-hover:bg-[#0038A8] group-hover:text-white transition-all shadow-inner"><FiUser size={36}/></div>
                                                    <div><h4 className="text-2xl font-black text-slate-900 italic tracking-tighter leading-none">{off.name}</h4><p className="text-[12px] font-black text-[#CE1126] uppercase mt-3 tracking-tighter">{off.position} (Terminated)</p></div>
                                                </div>
                                                <div className="text-right flex flex-col gap-1 items-end">
                                                    <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none">Impact Strand</p>
                                                    <p className="text-base font-black text-slate-600">{off.strand}</p>
                                                    <button onClick={() => {setShowPreviousModal(false); fetchFullProfile({...off, roles: [{tlid: off.tlid, strand: off.strand, office: off.office, position: off.position, sort_index: 9999}]})}} className="mt-2 text-[10px] font-black text-[#0038A8] uppercase tracking-widest hover:underline">Full Career Path</button>
                                                </div>
                                            </div>
                                        )) : (<div className="py-24 flex flex-col items-center opacity-30"><FiClock size={80} className="mb-6"/><p className="text-2xl font-black italic uppercase tracking-widest">History Registry Empty</p></div>)}
                                    </div>
                                </motion.div>
                            </div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Shared Simple Action Modal (Reassign/Succeed/Vacate) */}
                <AnimatePresence>
                    {(showMoveModal || showReplaceModal || showVacateModal) && (
                        <div className="fixed inset-0 z-[10000] overflow-y-auto">
                            <div className="flex min-h-screen items-start sm:items-center justify-center p-6 text-center pt-10 sm:pt-12">
                                <motion.div 
                                    initial={{ opacity: 0 }} 
                                    animate={{ opacity: 1 }} 
                                    exit={{ opacity: 0 }} 
                                    onClick={() => {setShowMoveModal(false); setShowReplaceModal(false); setShowVacateModal(false);}} 
                                    className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl cursor-pointer" 
                                />
                                <motion.div 
                                    initial={{ scale: 0.9, opacity: 0 }} 
                                    animate={{ scale: 1, opacity: 1 }} 
                                    className="bg-white rounded-[4rem] p-8 sm:p-12 w-full max-w-2xl shadow-2xl relative z-10 my-auto"
                                >
                                    <button onClick={() => {setShowMoveModal(false); setShowReplaceModal(false); setShowVacateModal(false);}} className="absolute top-8 right-8 p-3 text-slate-300 hover:text-slate-500"><FiX size={32}/></button>
                                    <div className="flex items-center gap-6 mb-12 text-left">
                                        <div className={`w-16 h-16 rounded-3xl text-white flex items-center justify-center shadow-lg ${showVacateModal ? 'bg-red-600' : 'bg-[#0038A8]'}`}>{showVacateModal ? <FiLogOut size={32}/> : <FiRepeat size={32}/>}</div>
                                        <h3 className="text-3xl sm:text-4xl font-black italic tracking-tighter text-slate-950 leading-none">{showMoveModal ? 'Reassignment' : showReplaceModal ? 'Succession' : 'Position Vacancy'}</h3>
                                    </div>
                                    <div className="space-y-10 mb-12 text-left">
                                        <div className="p-8 bg-slate-50 rounded-[2.5rem] border-2 border-slate-100">
                                            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2">Subject for Audit</p>
                                            <p className="text-2xl font-black text-slate-900 italic tracking-tighter leading-none">{selectedOfficial?.name} (Incumbent)</p>
                                            <div className="flex items-center gap-3 mt-3 opacity-60">
                                                <FiBriefcase size={14} className="text-slate-400" />
                                                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{selectedOfficial?.roles[0].office}</span>
                                            </div>
                                        </div>

                                        {showMoveModal && (
                                            <div className="grid grid-cols-1 gap-6 bg-blue-50/50 p-8 rounded-[2.5rem] border border-blue-100">
                                                <p className="text-[10px] font-black text-[#0038A8] uppercase tracking-widest mb-2 flex items-center gap-2"><FiMapPin /> Reassignment Destination</p>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="flex flex-col gap-2">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-4">Target Strand</label>
                                                        <div className="relative">
                                                            <div className="relative group">
                                                                <input 
                                                                    type="text" 
                                                                    value={formData.new_strand || ''} 
                                                                    onChange={e => setFormData({...formData, new_strand: e.target.value, new_office: ''})} 
                                                                    onFocus={() => setActiveDropdown('strand')}
                                                                    className="w-full bg-white border-2 border-slate-100 focus:border-[#0038A8] rounded-2xl py-4 px-6 font-bold uppercase transition-all" 
                                                                    placeholder="Select or type Strand" 
                                                                />
                                                                <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none group-focus-within:text-[#0038A8]"><FiLayers/></div>
                                                            </div>
                                                            <AnimatePresence>
                                                                {activeDropdown === 'strand' && (
                                                                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[100] max-h-[200px] overflow-y-auto scrollbar-none">
                                                                        {taxonomy.strands.map(s => (
                                                                            <button key={s} onMouseDown={() => {setFormData({...formData, new_strand: s}); setActiveDropdown(null);}} className="w-full text-left p-4 hover:bg-slate-50 font-bold uppercase text-[10px] text-slate-600 border-b border-slate-50 last:border-0">{s}</button>
                                                                        ))}
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-4">Target Office</label>
                                                        <div className="relative">
                                                            <div className="relative group">
                                                                <input 
                                                                    type="text" 
                                                                    value={formData.new_office || ''} 
                                                                    onChange={e => setFormData({...formData, new_office: e.target.value})} 
                                                                    onFocus={() => setActiveDropdown('office')}
                                                                    className="w-full bg-white border-2 border-slate-100 focus:border-[#0038A8] rounded-2xl py-4 px-6 font-bold uppercase transition-all" 
                                                                    placeholder="Select or type Office" 
                                                                />
                                                                <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none group-focus-within:text-[#0038A8]"><FiBriefcase/></div>
                                                            </div>
                                                            <AnimatePresence>
                                                                {activeDropdown === 'office' && (
                                                                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[100] max-h-[200px] overflow-y-auto scrollbar-none">
                                                                        {taxonomy.offices
                                                                            .filter(o => !formData.new_strand || o.strand === formData.new_strand)
                                                                            .map((o, idx) => (
                                                                                <button key={idx} onMouseDown={() => {setFormData({...formData, new_office: o.office}); setActiveDropdown(null);}} className="w-full text-left p-4 hover:bg-slate-50 font-bold uppercase text-[10px] text-slate-600 border-b border-slate-50 last:border-0">{o.office}</button>
                                                                            ))}
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-4">Target New Position</label>
                                                    <div className="relative">
                                                        <div className="relative group">
                                                            <input 
                                                                type="text" 
                                                                value={formData.new_position || ''} 
                                                                onChange={e => setFormData({...formData, new_position: e.target.value})} 
                                                                onFocus={() => setActiveDropdown('position')}
                                                                className="w-full bg-white border-2 border-slate-100 focus:border-[#0038A8] rounded-2xl py-4 px-6 font-bold uppercase transition-all" 
                                                                placeholder="Select or type Position" 
                                                            />
                                                            <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none group-focus-within:text-[#0038A8]"><FiAward/></div>
                                                        </div>
                                                        <AnimatePresence>
                                                            {activeDropdown === 'position' && (
                                                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[100] max-h-[200px] overflow-y-auto scrollbar-none">
                                                                    {taxonomy.positions.map(p => (
                                                                        <button key={p} onMouseDown={() => {setFormData({...formData, new_position: p}); setActiveDropdown(null);}} className="w-full text-left p-4 hover:bg-slate-50 font-bold uppercase text-[10px] text-slate-600 border-b border-slate-50 last:border-0">{p}</button>
                                                                    ))}
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {showReplaceModal && (
                                            <div className="space-y-6">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="flex flex-col gap-2">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-4">Successor Name</label>
                                                        <input type="text" value={formData.successor_name || ''} onChange={e => setFormData({...formData, successor_name: e.target.value})} className="w-full bg-slate-50 border-2 border-transparent focus:border-[#0038A8] rounded-[1.5rem] py-4 px-6 font-bold uppercase outline-none" placeholder="FULL NAME" />
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-4">Successor Email</label>
                                                        <input type="email" value={formData.successor_email || ''} onChange={e => setFormData({...formData, successor_email: e.target.value})} className="w-full bg-slate-50 border-2 border-transparent focus:border-[#0038A8] rounded-[1.5rem] py-4 px-6 font-bold outline-none" placeholder="email@deped.gov.ph" />
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-4">Successor Position</label>
                                                    <div className="relative">
                                                        <div className="relative group">
                                                            <input 
                                                                type="text" 
                                                                value={formData.successor_position || ''} 
                                                                onChange={e => setFormData({...formData, successor_position: e.target.value})} 
                                                                onFocus={() => setActiveDropdown('successor_position')}
                                                                className="w-full bg-slate-50 border-2 border-transparent focus:border-[#0038A8] rounded-[1.5rem] py-4 px-6 font-bold uppercase outline-none" 
                                                                placeholder="Select or type Position" 
                                                            />
                                                            <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none group-focus-within:text-[#0038A8]"><FiAward/></div>
                                                        </div>
                                                        <AnimatePresence>
                                                            {activeDropdown === 'successor_position' && (
                                                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[100] max-h-[200px] overflow-y-auto scrollbar-none">
                                                                    {taxonomy.positions.map(p => (
                                                                        <button key={p} onMouseDown={() => {setFormData({...formData, successor_position: p}); setActiveDropdown(null);}} className="w-full text-left p-4 hover:bg-slate-50 font-bold uppercase text-[10px] text-slate-600 border-b border-slate-50 last:border-0">{p}</button>
                                                                    ))}
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="bg-[#f8fafc] p-10 rounded-[2.5rem] border-2 border-slate-100 flex flex-col gap-6">
                                            <p className="text-[11px] font-black text-[#0038A8] uppercase tracking-[0.2em] flex items-center gap-3"><FiCalendar size={18}/> Assignment / Effective Date</p>
                                            <div className="relative group">
                                                <input 
                                                    type="date" 
                                                    value={formData.assignment_date || ''} 
                                                    onChange={e => setFormData({...formData, assignment_date: e.target.value})} 
                                                    className="w-full bg-white border-2 border-slate-200 focus:border-[#0038A8] rounded-[2rem] py-6 px-10 text-xl font-black text-slate-900 outline-none transition-all shadow-inner focus:shadow-2xl" 
                                                />
                                            </div>
                                            <p className="text-[10px] font-bold text-slate-400 italic px-4 leading-relaxed">This date marks the official transition in the service record and will be used for all forensic movement logs.</p>
                                        </div>
                                        <div className="space-y-6">
                                            <p className="text-[10px] font-black text-slate-400 uppercase ml-4">Forensic Justification (Select all that apply)</p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100">
                                                {[
                                                    { label: 'Promotion', desc: 'Vertical movement to a higher rank/pay grade' },
                                                    { label: 'Lateral Transfer', desc: 'Movement to a same-level position' },
                                                    { label: 'Reorganization', desc: 'Agency structural/RatPlan changes' },
                                                    { label: 'Detail / Assignment', desc: 'Temporary duty at another office' },
                                                    { label: 'Designation (OIC)', desc: 'Temporary assumption of duties' },
                                                    { label: 'Succession', desc: 'Natural filling of a legacy vacancy' },
                                                    { label: 'Retirement', desc: 'Mandatory or optional exit from service' },
                                                    { label: 'Resignation', desc: 'Voluntary separation from the service' },
                                                    { label: 'Staffing Rebalance', desc: 'Workload/competency based adjustment' }
                                                ].map(item => (
                                                    <label key={item.label} className="flex items-start gap-4 p-4 rounded-3xl hover:bg-white hover:shadow-lg transition-all cursor-pointer group border border-transparent hover:border-slate-100">
                                                        <div className="relative flex items-center justify-center mt-1">
                                                            <input 
                                                                type="checkbox" 
                                                                className="peer appearance-none w-6 h-6 rounded-xl border-2 border-slate-200 checked:bg-[#0038A8] checked:border-[#0038A8] transition-all"
                                                                checked={selectedReasons.includes(item.label)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) setSelectedReasons([...selectedReasons, item.label]);
                                                                    else setSelectedReasons(selectedReasons.filter(r => r !== item.label));
                                                                }}
                                                            />
                                                            <FiCheckCircle className="absolute text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" size={14} />
                                                        </div>
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="text-[11px] font-black text-slate-800 uppercase tracking-tighter group-hover:text-[#0038A8] transition-colors">{item.label}</span>
                                                            <span className="text-[9px] font-bold text-slate-400 italic leading-none">{item.desc}</span>
                                                        </div>
                                                    </label>
                                                ))}
                                                <div className="col-span-full border-t border-slate-200 mt-4 pt-6">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase mb-4 block">Other Justification (Specify)</label>
                                                    <textarea 
                                                        className="w-full bg-white border-2 border-slate-100 focus:border-[#0038A8] rounded-[1.5rem] py-4 px-6 text-sm outline-none font-bold transition-all min-h-[80px]"
                                                        placeholder="Enter specific audit remarks here..."
                                                        value={otherReason}
                                                        onChange={(e) => setOtherReason(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {activeDropdown && <div className="fixed inset-0 z-[95]" onClick={() => setActiveDropdown(null)} />}
                                    <div className="flex gap-4 relative z-[100]">
                                        <button onClick={() => {setShowMoveModal(false); setShowReplaceModal(false); setShowVacateModal(false);}} className="flex-1 py-6 text-slate-400 font-black uppercase tracking-widest bg-slate-100 rounded-full hover:bg-slate-200 transition-all">Abort Action</button>
                                        <button 
                                            onClick={() => {
                                                const combinedRemarks = [...selectedReasons, otherReason].filter(Boolean).join('; ');
                                                const endpoint = showMoveModal ? '/api/officials/move' : showReplaceModal ? '/api/officials/replace' : '/api/officials/vacate';
                                                handleAction(endpoint, { ...formData, remarks: combinedRemarks });
                                            }} 
                                            className={`flex-[2] py-6 text-white font-black uppercase tracking-widest rounded-full shadow-2xl transition-all active:scale-95 ${showVacateModal ? 'bg-red-600 hover:bg-red-800' : 'bg-[#0038A8] hover:bg-black'}`}
                                        >Commit to Registry</button>
                                    </div>
                                </motion.div>
                            </div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Mobile Menu */}
                <AnimatePresence>
                    {mobileMenuOpen && (
                        <>
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 bg-[#001D56]/90 backdrop-blur-lg z-[200]" />
                            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="fixed inset-y-0 right-0 w-[80vw] bg-white z-[201] p-10 flex flex-col shadow-2xl">
                                <div className="flex justify-between items-center mb-12">
                                    <h2 className="text-3xl font-black italic text-[#0038A8]">Nexus</h2>
                                    <button onClick={() => setMobileMenuOpen(false)} className="p-4 bg-slate-50 text-slate-400 rounded-2xl"><FiX size={32} /></button>
                                </div>
                                <NavItems isMobile />
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
                
                {/* Information Edit Modal */}
                <AnimatePresence>
                    {showEditModal && (
                        <div className="fixed inset-0 z-[10000] overflow-y-auto">
                            <div className="flex min-h-screen items-start sm:items-center justify-center p-6 text-center pt-10 sm:pt-12">
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowEditModal(false)} className="fixed inset-0 bg-[#001D56]/90 backdrop-blur-xl cursor-pointer" />
                                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[4rem] p-12 w-full max-w-4xl shadow-2xl relative z-10 my-auto text-left">
                                    <button onClick={() => setShowEditModal(false)} className="absolute top-10 right-10 p-3 text-slate-300 hover:text-slate-500"><FiX size={32}/></button>
                                    <div className="flex items-center gap-6 mb-12">
                                        <div className="w-16 h-16 rounded-3xl bg-orange-500 text-white flex items-center justify-center shadow-lg"><FiSettings size={32}/></div>
                                        <div>
                                            <h3 className="text-4xl font-black italic tracking-tighter text-slate-950 leading-none">Modify Information</h3>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{formData.tlid} Registry Record</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                                        <div className="flex flex-col gap-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase ml-4">Full Name</label>
                                            <input type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-50 border-2 border-transparent focus:border-[#0038A8] rounded-3xl py-4 px-6 font-bold uppercase" />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase ml-4">Current Position</label>
                                            <input type="text" value={formData.position || ''} onChange={e => setFormData({...formData, position: e.target.value})} className="w-full bg-slate-50 border-2 border-transparent focus:border-[#0038A8] rounded-3xl py-4 px-6 font-bold uppercase" />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase ml-4">Primary Email</label>
                                            <input type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-slate-50 border-2 border-transparent focus:border-[#0038A8] rounded-3xl py-4 px-6 font-bold" />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase ml-4">Direct Contact</label>
                                            <input type="text" value={formData.contact_details || ''} onChange={e => setFormData({...formData, contact_details: e.target.value})} className="w-full bg-slate-50 border-2 border-transparent focus:border-[#0038A8] rounded-3xl py-4 px-6 font-bold" />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase ml-4">Secondary Email</label>
                                            <input type="email" value={formData.alt_email_1 || ''} onChange={e => setFormData({...formData, alt_email_1: e.target.value})} className="w-full bg-slate-50 border-2 border-transparent focus:border-[#0038A8] rounded-3xl py-4 px-6 font-bold" />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase ml-4">Secondary Contact</label>
                                            <input type="text" value={formData.alt_contact_details_1 || ''} onChange={e => setFormData({...formData, alt_contact_details_1: e.target.value})} className="w-full bg-slate-50 border-2 border-transparent focus:border-[#0038A8] rounded-3xl py-4 px-6 font-bold" />
                                        </div>
                                        <div className="col-span-full flex flex-col gap-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase ml-4">Effective Date of Info Change</label>
                                            <input type="date" value={formData.assignment_date || ''} onChange={e => setFormData({...formData, assignment_date: e.target.value})} className="w-full bg-slate-50 border-2 border-transparent focus:border-[#0038A8] rounded-3xl py-4 px-6 font-bold" />
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <button onClick={() => setShowEditModal(false)} className="flex-1 py-6 text-slate-400 font-black uppercase tracking-widest bg-slate-100 rounded-full hover:bg-slate-200 transition-all">Cancel</button>
                                        <button 
                                            onClick={() => handleAction('/api/officials/update', formData)} 
                                            className="flex-[2] py-6 bg-orange-500 text-white font-black uppercase tracking-widest rounded-full shadow-2xl hover:bg-orange-600 transition-all active:scale-95"
                                        >Save Changes</button>
                                    </div>
                                </motion.div>
                            </div>
                        </div>
                    )}
                </AnimatePresence>
            </div>

        </PageTransition>
    );
};

export default ThirdLevelDirectory;
