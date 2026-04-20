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
    FiGlobe,
    FiSmartphone,
    FiMapPin,
    FiAward,
    FiTrash2,
    FiInbox,
    FiUserX,
    FiBriefcase,
    FiUsers,
    FiLogOut
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
    
    // UI States
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showPreviousModal, setShowPreviousModal] = useState(false);
    const [selectedOfficial, setSelectedOfficial] = useState(null);
    const [history, setHistory] = useState([]);
    const [positionHistory, setPositionHistory] = useState([]);
    const [careerPath, setCareerPath] = useState([]);
    
    // Action Modals
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [showReplaceModal, setShowReplaceModal] = useState(false);
    const [showVacateModal, setShowVacateModal] = useState(false);
    const [formData, setFormData] = useState({});

    useEffect(() => {
        fetchOfficials();
        fetchPreviousOfficials();
    }, []);

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
        return Object.values(groups).sort((a,b) => {
            const minA = Math.min(...a.roles.map(r => r.sort_index));
            const minB = Math.min(...b.roles.map(r => r.sort_index));
            return minA - minB;
        });
    }, [officials]);

    // Grouping by Strand for the Messy-Free UI
    const groupedByStrand = useMemo(() => {
        const term = searchTerm.toLowerCase();

        // 1. If Personnel Master Registry, show all unique names alphabetically
        if (selectedStrand === 'PERSONNEL_MASTER_REGISTRY') {
            // Include ALL (Active + Inactive)
            const allPossible = [
                ...consolidatedOfficials,
                ...previousOfficials.map(p => ({ ...p, roles: [{ tlid: p.tlid, office: p.office, position: p.position, strand: p.strand, sort_index: 9999 }] }))
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
        const filtered = consolidatedOfficials.filter(o => {
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
    }, [consolidatedOfficials, previousOfficials, searchTerm, selectedStrand]);

    const activeStrands = useMemo(() => Object.keys(groupedByStrand).sort((a,b) => {
        if (a === "PERSONNEL MASTER REGISTRY") return -1;
        if (b === "PERSONNEL MASTER REGISTRY") return 1;
        return a.localeCompare(b);
    }), [groupedByStrand]);

    const fetchFullProfile = async (official) => {
        setSelectedOfficial(official);
        setShowProfileModal(true);
        setHistory([]);
        setPositionHistory([]);
        setCareerPath([]);
        const primaryTlid = official.roles[0].tlid;
        
        try {
            const res = await fetch(`/api/officials/history/${primaryTlid}`);
            const data = await res.json();
            if (data.success) setHistory(data.data);

            const posRes = await fetch(`/api/officials/position-history?strand=${encodeURIComponent(official.roles[0].strand)}&office=${encodeURIComponent(official.roles[0].office)}&position=${encodeURIComponent(official.roles[0].position)}`);
            const posData = await posRes.json();
            if (posData.success) setPositionHistory(posData.data);

            if (official.name !== 'VACANT') {
                const careerRes = await fetch(`/api/officials/career-path/${encodeURIComponent(official.name)}`);
                const careerData = await careerRes.json();
                if (careerData.success) setCareerPath(careerData.data);
            }
        } catch (err) {
            console.error("Failed to fetch detailed profile", err);
        }
    };

    const handleAction = async (endpoint, body) => {
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body) 
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                setShowMoveModal(false);
                setShowReplaceModal(false);
                setShowVacateModal(false);
                setShowProfileModal(false);
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
                    </div>

                    <div className="px-6 lg:px-16 py-10 pb-40 space-y-20">
                        <AnimatePresence mode='popLayout'>
                            {activeStrands.map(strand => (
                                <section key={strand} className="relative">
                                    <div className="sticky top-0 lg:top-4 z-20 flex items-center gap-6 mb-10 py-4 lg:py-6 group">
                                        <div className="absolute inset-x-0 h-full bg-slate-50/80 backdrop-blur-md -mx-10 rounded-[3rem] -z-10 border border-slate-100 shadow-sm" />
                                        <div className={`w-16 h-16 rounded-3xl text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform ${strand === "PERSONNEL MASTER REGISTRY" ? "bg-[#CE1126]" : "bg-[#0038A8]"}`}>
                                            {strand === "PERSONNEL MASTER REGISTRY" ? <FiUsers size={32}/> : <FiLayers size={32}/>}
                                        </div>
                                        <div>
                                            <h2 className={`text-3xl lg:text-4xl font-black italic tracking-tighter leading-none ${strand === "PERSONNEL MASTER REGISTRY" ? "text-[#CE1126]" : "text-[#0038A8]"}`}>{strand}</h2>
                                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] mt-2">Division Components Registry</p>
                                        </div>
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

                {/* Profile Modal - FIXED PERSISTENCE */}
                <AnimatePresence>
                    {showProfileModal && selectedOfficial && (
                        <div className="fixed inset-0 z-[1000] overflow-y-auto">
                            <div className="flex min-h-screen items-start sm:items-center justify-center p-4 lg:p-12 text-center pt-10 sm:pt-12">
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowProfileModal(false)} className="fixed inset-0 bg-[#001D56]/80 backdrop-blur-xl cursor-pointer" />
                                <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="w-full max-w-6xl bg-white rounded-[4rem] relative overflow-hidden text-left shadow-[0_60px_120px_-30px_rgba(0,0,0,0.5)] flex flex-col my-auto border border-white/20">
                                    <div className={`${selectedOfficial.isVacant ? 'bg-slate-900' : 'bg-[#0038A8]'} p-10 lg:p-16 text-white flex flex-col md:flex-row items-center gap-10 shrink-0 relative`}>
                                        <div className="w-32 h-32 lg:w-44 lg:h-44 rounded-[4rem] bg-white flex items-center justify-center text-slate-900 relative shadow-2xl shrink-0">
                                            {selectedOfficial.isVacant ? <FiUserX size={80} className="text-red-100"/> : <FiUser size={80} className="text-[#0038A8]"/>}
                                            <div className={`absolute -bottom-2 -right-2 w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${selectedOfficial.isVacant ? 'bg-red-500 text-white' : 'bg-[#FCD116] text-[#0038A8]'}`}>{selectedOfficial.isVacant ? <FiXCircle size={28}/> : <FiAward size={28}/>}</div>
                                        </div>
                                        <div className="flex-1 text-center md:text-left">
                                            <div className={`inline-flex px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase mb-6 ${selectedOfficial.status === 'Active' ? 'bg-emerald-500' : 'bg-red-500'} shadow-lg`}>{selectedOfficial.status} POSITION</div>
                                            <h2 className="text-4xl lg:text-6xl font-black italic tracking-tighter leading-none mb-6">
                                                {selectedOfficial.name} {selectedOfficial.status === 'Active' && <span className="text-white/40 text-xl not-italic font-bold ml-2">(Incumbent)</span>}
                                            </h2>
                                            <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                                                {selectedOfficial.roles.map((r, ri) => (
                                                    <div key={ri} className="px-6 py-3 bg-white/10 rounded-3xl border border-white/10 backdrop-blur-md">
                                                        <p className="text-[10px] font-black text-blue-200 uppercase mb-1">{r.office}</p>
                                                        <p className="text-base font-bold text-white tracking-tight">{r.position}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <button onClick={() => setShowProfileModal(false)} className="absolute top-10 right-10 p-4 hover:bg-white/10 rounded-full transition-all"><FiX className="w-10 h-10" /></button>
                                    </div>

                                    <div className="p-10 lg:p-16 overflow-y-visible">
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
                                            <div className="space-y-16">
                                                <section>
                                                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.5em] mb-10 border-l-8 border-[#CE1126] pl-6 font-mono">Profile Matrix</h4>
                                                    <div className="flex flex-col gap-8 bg-slate-50 p-10 rounded-[4rem] border border-slate-100 shadow-inner">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                                            <div className="space-y-2 overflow-hidden">
                                                                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Primary Identity</span>
                                                                <p className="text-sm font-black text-slate-900 break-words">{selectedOfficial.email || 'N/A ELECTRONIC MAIL'}</p>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Direct Contact</span>
                                                                <p className="text-sm font-black text-slate-900">{selectedOfficial.contact_details || 'N/A EXTENSION'}</p>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-8 border-t border-slate-200/50">
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

                                                <section className="bg-[#0038A8]/5 p-10 rounded-[4rem] border border-[#0038A8]/10 relative overflow-hidden">
                                                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#0038A8]/5 rounded-full -mr-16 -mt-16 blur-2xl" />
                                                    <h4 className="text-[11px] font-black text-[#0038A8] uppercase tracking-[0.5em] mb-10 border-l-8 border-[#FCD116] pl-6 font-mono">Professional Career Path</h4>
                                                    <div className="space-y-8 pl-4">
                                                        {careerPath.length > 0 ? careerPath.map((item, idx) => (
                                                            <div key={idx} className="relative pl-12 border-l-2 border-slate-200">
                                                                <div className={`absolute left-0 top-0 -translate-x-1/2 w-4 h-4 rounded-full border-4 bg-white ${item.status === 'Active' ? 'border-[#0038A8]' : 'border-slate-300'}`} />
                                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.strand} STRAND</p>
                                                                <h5 className={`text-base font-black italic tracking-tighter leading-none ${item.status === 'Active' ? 'text-[#0038A8]' : 'text-slate-500'}`}>{item.position}</h5>
                                                                <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{item.office}</p>
                                                                {item.status === 'Active' && <span className="bg-[#0038A8] text-white text-[7px] font-black px-1.5 py-0.5 rounded ml-2 uppercase">Current</span>}
                                                            </div>
                                                        )) : (
                                                            <div className="py-6 text-sm font-black italic text-slate-300 uppercase tracking-widest opacity-40">Career baseline tracking initiated Jan 2026.</div>
                                                        )}
                                                    </div>
                                                </section>

                                                {!selectedOfficial.isVacant && (
                                                    <div className="pt-10 border-t border-slate-100 flex flex-col sm:flex-row gap-4">
                                                        <button onClick={() => { setFormData({ tlid: selectedOfficial.roles[0].tlid, effective_date: new Date().toISOString().split('T')[0], remarks: '', new_strand: selectedOfficial.roles[0].strand, new_office: selectedOfficial.roles[0].office, new_position: selectedOfficial.roles[0].position }); setShowMoveModal(true); }} className="flex-1 py-6 bg-slate-900 text-white font-black text-xs uppercase tracking-widest rounded-full hover:shadow-2xl shadow-black/20 transition-all flex items-center justify-center gap-3 active:scale-95"><FiArrowRight size={18}/> Reassign</button>
                                                        <button onClick={() => { setFormData({ tlid: selectedOfficial.roles[0].tlid, effective_date: new Date().toISOString().split('T')[0], remarks: '' }); setShowReplaceModal(true); }} className="flex-1 py-6 bg-[#0038A8] text-white font-black text-xs uppercase tracking-widest rounded-full hover:shadow-2xl shadow-blue-900/20 transition-all flex items-center justify-center gap-3 active:scale-95"><FiRepeat size={18}/> Succeed</button>
                                                        <button onClick={() => { setFormData({ tlid: selectedOfficial.roles[0].tlid, effective_date: new Date().toISOString().split('T')[0], remarks: '' }); setShowVacateModal(true); }} className="flex-1 py-6 bg-red-600 text-white font-black text-xs uppercase tracking-widest rounded-full hover:shadow-2xl shadow-red-900/20 transition-all flex items-center justify-center gap-3 active:scale-95"><FiLogOut size={18}/> Vacate</button>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="bg-slate-50/50 rounded-[4rem] p-12 border border-slate-100 flex flex-col min-h-[500px]">
                                                <h4 className="text-[11px] font-black text-[#0038A8] uppercase tracking-[0.5em] mb-12 flex items-center gap-4 italic shrink-0 font-mono"><FiClock className="text-[#CE1126]" /> Succession Legacy Registry</h4>
                                                <div className="flex-1 overflow-y-visible relative pl-4">
                                                    <div className="absolute left-10 top-0 bottom-0 w-1.5 bg-white rounded-full shadow-inner" />
                                                    <div className="space-y-16 relative z-10">
                                                        {positionHistory.length > 0 ? positionHistory.map((successor, i) => (
                                                            <div key={successor.tlid} className="relative pl-24 group">
                                                                <div className={`absolute left-0 top-1 w-16 h-16 rounded-[2rem] bg-white border-4 ${successor.status === 'Active' ? 'border-[#FCD116]' : 'border-slate-100'} flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform`}><FiAward className={successor.status === 'Active' ? 'text-[#0038A8]' : 'text-slate-200'} size={24}/></div>
                                                                <div>
                                                                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2 leading-none">Term Effective: {new Date(successor.effective_date || successor.updated_at).toLocaleDateString()}</p>
                                                                    <h5 className={`text-2xl font-black italic tracking-tighter leading-none ${successor.status === 'Active' ? 'text-[#0038A8]' : 'text-slate-600'}`}>
                                                                        {successor.name} {successor.status === 'Active' && <span className="text-blue-500 text-xs not-italic font-bold ml-1">(Incumbent)</span>}
                                                                    </h5>
                                                                    <p className="text-[11px] font-bold text-slate-400 uppercase mt-2 tracking-widest">{successor.position}</p>
                                                                </div>
                                                            </div>
                                                        )) : (<div className="pl-24 py-6 text-sm font-black italic text-slate-300 uppercase tracking-widest opacity-40">No legacy history found for this position. Initial baseline Jan 2026.</div>)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
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
                                                        <input type="text" value={formData.new_strand || ''} onChange={e => setFormData({...formData, new_strand: e.target.value})} className="w-full bg-white border-2 border-slate-100 focus:border-[#0038A8] rounded-2xl py-4 px-6 font-bold uppercase transition-all" placeholder="e.g. OSEC" />
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-4">Target Office</label>
                                                        <input type="text" value={formData.new_office || ''} onChange={e => setFormData({...formData, new_office: e.target.value})} className="w-full bg-white border-2 border-slate-100 focus:border-[#0038A8] rounded-2xl py-4 px-6 font-bold uppercase transition-all" placeholder="e.g. OFFICE OF THE SEC" />
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-4">Target New Position</label>
                                                    <input type="text" value={formData.new_position || ''} onChange={e => setFormData({...formData, new_position: e.target.value})} className="w-full bg-white border-2 border-slate-100 focus:border-[#0038A8] rounded-2xl py-4 px-6 font-bold uppercase transition-all" placeholder="Enter Full Position Title" />
                                                </div>
                                            </div>
                                        )}

                                        {showReplaceModal && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="flex flex-col gap-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-4">Successor Name</label>
                                                    <input type="text" value={formData.successor_name || ''} onChange={e => setFormData({...formData, successor_name: e.target.value})} className="w-full bg-slate-50 border-2 border-transparent focus:border-[#0038A8] rounded-[1.5rem] py-4 px-6 font-bold uppercase outline-none" />
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-4">Successor Email</label>
                                                    <input type="email" value={formData.successor_email || ''} onChange={e => setFormData({...formData, successor_email: e.target.value})} className="w-full bg-slate-50 border-2 border-transparent focus:border-[#0038A8] rounded-[1.5rem] py-4 px-6 font-bold outline-none" />
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex flex-col gap-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase ml-4">Forensic Remarks & Justification</label>
                                            <textarea className="w-full bg-slate-50 border-2 border-transparent focus:border-[#0038A8] rounded-[2rem] py-6 px-8 text-lg outline-none min-h-[120px] transition-all font-bold placeholder:text-slate-300" placeholder="Required for audit trail..." value={formData.remarks} onChange={e => setFormData({...formData, remarks: e.target.value})} />
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <button onClick={() => {setShowMoveModal(false); setShowReplaceModal(false); setShowVacateModal(false);}} className="flex-1 py-6 text-slate-400 font-black uppercase tracking-widest bg-slate-100 rounded-full hover:bg-slate-200 transition-all">Abort Action</button>
                                        <button 
                                            onClick={() => {
                                                const endpoint = showMoveModal ? '/api/officials/move' : showReplaceModal ? '/api/officials/replace' : '/api/officials/vacate';
                                                handleAction(endpoint, formData);
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
            </div>
        </PageTransition>
    );
};

export default ThirdLevelDirectory;
