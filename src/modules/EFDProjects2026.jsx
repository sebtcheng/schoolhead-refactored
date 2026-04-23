import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    FiUpload, FiFileText, FiChevronDown, FiPlus, FiSearch, FiX, FiCheck, 
    FiDownload, FiTrash2, FiAlertCircle, FiList, FiSettings, FiEye, FiMapPin 
} from 'react-icons/fi';
import { TbFileCheck, TbBuildingCommunity, TbMapPin } from "react-icons/tb";
import { useAuth } from '../context/AuthContext';
import BottomNav from './BottomNav';
import PageTransition from '../components/PageTransition';

// Reusable Searchable Select Component
const SearchableSelect = ({ label, options, selected, onSelect, icon: Icon, placeholder = "Search..." }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');

    const filteredOptions = options.filter(opt => 
        (opt || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="relative flex-1 min-w-[200px]">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
                {label}
            </label>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-4 py-3.5 bg-white border border-slate-100 rounded-2xl text-[13px] font-semibold text-slate-700 hover:border-blue-200 transition-all shadow-sm"
            >
                <div className="flex items-center gap-3 truncate">
                    {Icon && <Icon size={18} className="text-blue-500 shrink-0" />}
                    <span className="truncate">{selected || `Select ${label}`}</span>
                </div>
                <FiChevronDown className={`shrink-0 transition-transform duration-300 text-slate-400 ${isOpen ? 'rotate-180' : ''}`} size={16} />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-[100]" onClick={() => setIsOpen(false)}></div>
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[101] py-3 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="px-3 pb-2 mb-2 border-b border-slate-50">
                            <div className="relative">
                                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder={placeholder}
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border-none rounded-xl text-[12px] focus:ring-2 focus:ring-blue-100 transition-all"
                                />
                            </div>
                        </div>
                        <div className="max-h-[250px] overflow-y-auto custom-scrollbar">
                            {filteredOptions.length > 0 ? (
                                filteredOptions.map(option => (
                                    <div
                                        key={option}
                                        onClick={() => {
                                            onSelect(option);
                                            setIsOpen(false);
                                            setSearch('');
                                        }}
                                        className={`px-4 py-2.5 hover:bg-blue-50 flex items-center justify-between cursor-pointer transition-colors ${selected === option ? 'bg-blue-50/50' : ''}`}
                                    >
                                        <span className={`text-[12px] ${selected === option ? 'text-blue-600 font-bold' : 'text-slate-600 font-medium'}`}>
                                            {option}
                                        </span>
                                        {selected === option && <FiCheck size={14} className="text-blue-500" />}
                                    </div>
                                ))
                            ) : (
                                <div className="px-4 py-6 text-center text-slate-400 text-[11px] italic">
                                    No results found
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

const EFDProjects2026 = () => {
    const { user, token } = useAuth();
    const navigate = useNavigate();
    
    // --- Projects State ---
    const [projects, setProjects] = useState([]);
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [projectSearchQuery, setProjectSearchQuery] = useState('');

    // --- Mother MOA Modal State ---
    const [isMotherModalOpen, setIsMotherModalOpen] = useState(false);
    const [lguType, setLguType] = useState('');
    const [region, setRegion] = useState('');
    const [province, setProvince] = useState(''); 
    const [municipalityCity, setMunicipalityCity] = useState('');
    const [moaFile, setMoaFile] = useState(null);
    const [srFile, setSrFile] = useState(null);
    const [isUploadingMother, setIsUploadingMother] = useState(false);
    const [locations, setLocations] = useState([]);

    // --- Supplemental MOA Modal State ---
    const [isSupplementalModalOpen, setIsSupplementalModalOpen] = useState(false);
    const [selectedMotherMoa, setSelectedMotherMoa] = useState(null);
    const [supplementalFile, setSupplementalFile] = useState(null);
    const [isUploadingSupplemental, setIsUploadingSupplemental] = useState(false);
    const [availableProjects, setAvailableProjects] = useState([]);
    const [selectedIpcs, setSelectedIpcs] = useState([]);
    const [projectModalSearch, setProjectModalSearch] = useState('');
    const [motherMoas, setMotherMoas] = useState([]);

    // --- Fetch Logic ---
    const fetch2026Projects = useCallback(async () => {
        setLoadingProjects(true);
        try {
            const res = await fetch('/api/projects?year=2026&limit=100', {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (res.ok) {
                const data = await res.json();
                setProjects(data.data || []);
            }
        } catch (err) {
            console.error("Error fetching 2026 projects:", err);
        } finally {
            setLoadingProjects(false);
        }
    }, [token]);

    const fetchMotherMoas = useCallback(async () => {
        try {
            const res = await fetch('/api/engineer-mother-moas');
            if (res.ok) {
                const data = await res.json();
                setMotherMoas(data || []);
            }
        } catch (err) {
            console.error("Error fetching Mother MOAs:", err);
        }
    }, []);

    const fetchLocations = useCallback(async () => {
        try {
            const res = await fetch('/api/reference/mother-moa-locations');
            if (res.ok) {
                const data = await res.json();
                setLocations(data || []);
            }
        } catch (err) {
            console.error("Error fetching locations:", err);
        }
    }, []);

    useEffect(() => {
        fetch2026Projects();
        fetchMotherMoas();
        fetchLocations();
    }, [fetch2026Projects, fetchMotherMoas, fetchLocations]);

    // --- Mother MOA Upload ---
    const isNcrPgoError = lguType === 'PGO' && region === 'NCR';
    const regionOptions = useMemo(() => [...new Set(locations.map(l => l.region))].sort(), [locations]);
    const provinceOptions = useMemo(() => {
        if (!region) return [];
        return [...new Set(locations.filter(l => l.region?.trim().toUpperCase() === region.trim().toUpperCase()).map(l => l.province))].filter(Boolean).sort();
    }, [region, locations]);
    const muniCityOptions = useMemo(() => {
        if (!province) return [];
        const filtered = locations.filter(l => l.province === province);
        return [...new Set(filtered.map(l => l.municipality || l.city))].filter(Boolean).sort();
    }, [province, locations]);

    const handleUploadMother = async () => {
        if (!lguType || !region || !province || !moaFile) {
            alert("Please complete the required fields.");
            return;
        }
        setIsUploadingMother(true);
        try {
            const formData = new FormData();
            formData.append('region', region);
            formData.append('province', province);
            formData.append('municipality_city', municipalityCity);
            formData.append('lgu_type', lguType);
            formData.append('lgu_name', lguType === 'PGO' ? province : municipalityCity);
            formData.append('uid', user.uid);
            formData.append('moa_pdf', moaFile);
            if (srFile) formData.append('sangguniang_resolution', srFile);

            const res = await fetch('/api/upload-engineer-mother-moa', {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                alert("Successfully uploaded Mother MOA!");
                setIsMotherModalOpen(false);
                fetchMotherMoas();
                // Reset fields
                setMoaFile(null); setSrFile(null); setLguType(''); setRegion(''); setProvince(''); setMunicipalityCity('');
            } else {
                const err = await res.json();
                throw new Error(err.error || "Upload failed");
            }
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            setIsUploadingMother(false);
        }
    };

    // --- Supplemental MOA Upload ---
    const fetchProjectsForMoa = async (motherMoaId) => {
        try {
            const res = await fetch(`/api/projects-for-moa/${motherMoaId}`);
            if (res.ok) {
                const data = await res.json();
                setAvailableProjects(data || []);
            }
        } catch (err) {
            console.error("Fetch Projects for MOA Error:", err);
        }
    };

    const handleUploadSupplemental = async () => {
        if (!selectedMotherMoa || !supplementalFile) {
            alert("Please select a Mother MOA and a PDF file.");
            return;
        }
        setIsUploadingSupplemental(true);
        try {
            const formData = new FormData();
            formData.append('mother_moa_id', selectedMotherMoa.mother_moa_id);
            formData.append('moa_pdf', supplementalFile);
            formData.append('ipc_ids', JSON.stringify(selectedIpcs));
            formData.append('uid', user.uid);

            const res = await fetch('/api/upload-engineer-supplemental-moa', {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                alert("Successfully uploaded Supplemental MOA!");
                setIsSupplementalModalOpen(false);
                setSupplementalFile(null); setSelectedMotherMoa(null); setSelectedIpcs([]);
            } else {
                const err = await res.json();
                throw new Error(err.error || "Upload failed");
            }
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            setIsUploadingSupplemental(false);
        }
    };

    const filteredProjects = projects.filter(p => 
        (p.projectName || '').toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
        (p.schoolName || '').toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
        (p.id?.toString() || '').includes(projectSearchQuery)
    );

    return (
        <PageTransition>
            <div className="min-h-screen bg-[#F8FAFC] pb-32">
                {/* Header Section */}
                <div className="bg-[#004A99] pt-12 pb-24 px-6 rounded-b-[2.5rem] shadow-2xl relative overflow-hidden">
                    <div className="absolute top-[-10%] right-[-5%] w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
                    <div className="absolute bottom-[-20%] left-[-10%] w-80 h-80 bg-blue-400/20 rounded-full blur-3xl"></div>
                    
                    <div className="relative z-10 max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center gap-5">
                            <button 
                                onClick={() => navigate('/efd-dashboard')}
                                className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl text-white transition-all backdrop-blur-md border border-white/20"
                            >
                                <FiChevronDown className="rotate-90" size={20} />
                            </button>
                            <div>
                                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                                    <FiList size={32} className="text-blue-200" />
                                    2026 Projects
                                </h1>
                                <p className="text-blue-100/80 text-sm font-medium mt-1">
                                    National Monitoring System for Fiscal Year 2026
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <button 
                                onClick={() => setIsMotherModalOpen(true)}
                                className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white text-white hover:text-blue-700 rounded-2xl font-black text-[11px] uppercase tracking-wider transition-all backdrop-blur-md border border-white/20"
                            >
                                <FiUpload size={16} />
                                Upload Mother MOA
                            </button>
                            <button 
                                onClick={() => setIsSupplementalModalOpen(true)}
                                className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white text-white hover:text-emerald-700 rounded-2xl font-black text-[11px] uppercase tracking-wider transition-all backdrop-blur-md border border-white/20"
                            >
                                <FiUpload size={16} />
                                Upload Supplemental MOA
                            </button>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-6 -mt-12 relative z-20">
                    {/* Projects Table Card */}
                    <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">
                        <div className="p-8 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                                    <FiList size={20} />
                                </div>
                                <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Project List</h2>
                            </div>

                            <div className="relative max-w-xs w-full">
                                <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="Search 2026 projects..."
                                    value={projectSearchQuery}
                                    onChange={(e) => setProjectSearchQuery(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50">
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Project ID</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Project Details</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Regional Location</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {loadingProjects ? (
                                        <tr>
                                            <td colSpan="5" className="px-8 py-12 text-center text-slate-400 font-bold animate-pulse">Syncing 2026 Inventory...</td>
                                        </tr>
                                    ) : filteredProjects.length > 0 ? (
                                        filteredProjects.map((p) => (
                                            <tr 
                                                key={p.id} 
                                                className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
                                                onClick={() => navigate(`/project-details/${p.id}`)}
                                            >
                                                <td className="px-8 py-5">
                                                    <span className="text-xs font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">{p.id}</span>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="flex flex-col">
                                                        <h4 className="text-sm font-black text-slate-800 group-hover:text-blue-700 transition-colors uppercase leading-tight">{p.projectName}</h4>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{p.projectCategory || 'General Infrastructure'}</p>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-2">
                                                        <FiMapPin size={12} className="text-blue-500" />
                                                        <span className="text-xs font-bold text-slate-600 uppercase tracking-tight">{p.region} • {p.division}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="flex flex-col items-center">
                                                        <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full border ${
                                                            p.status?.toLowerCase().includes('ongoing') ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                            p.status?.toLowerCase().includes('completed') ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                            'bg-slate-50 text-slate-500 border-slate-100'
                                                        }`}>
                                                            {p.status || 'Pending'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5 text-right">
                                                    <FiEye className="inline-block text-slate-300 group-hover:text-blue-600 transition-colors" />
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="5" className="px-8 py-20 text-center text-slate-400">No 2026 projects found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <BottomNav userRole="EFD Engineer" />

                {/* Mother MOA Modal */}
                {isMotherModalOpen && (
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar">
                            <div className="p-8">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
                                            <FiUpload size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-slate-800 tracking-tight">Upload Mother MOA</h3>
                                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Memorandum of Agreement Archive</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setIsMotherModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400"><FiX size={20} /></button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <SearchableSelect label="LGU Type" options={['PGO', 'CGO', 'MGO']} selected={lguType} onSelect={(val) => { setLguType(val); if (val === 'PGO') setMunicipalityCity(''); }} icon={FiSettings} />
                                    <SearchableSelect label="Region" options={regionOptions} selected={region} onSelect={(val) => { setRegion(val); setProvince(''); setMunicipalityCity(''); }} icon={TbMapPin} />
                                    <SearchableSelect label="Province" options={provinceOptions} selected={province} onSelect={(val) => { setProvince(val); setMunicipalityCity(''); }} icon={TbBuildingCommunity} />
                                    {(lguType === 'CGO' || lguType === 'MGO') && (
                                        <SearchableSelect label="Municipality/City" options={muniCityOptions} selected={municipalityCity} onSelect={setMunicipalityCity} icon={TbBuildingCommunity} />
                                    )}
                                </div>

                                <div className="mt-8 space-y-6">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Mother MOA PDF File</label>
                                        <div className="flex items-center px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl">
                                            <FiUpload className="text-slate-400" size={18} />
                                            <input type="file" accept="application/pdf" onChange={(e) => setMoaFile(e.target.files[0])} className="w-full bg-transparent border-none text-[13px] font-semibold text-slate-700 ml-3" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Sangguniang Resolution (Optional)</label>
                                        <div className="flex items-center px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl">
                                            <FiUpload className="text-slate-400" size={18} />
                                            <input type="file" accept="application/pdf" onChange={(e) => setSrFile(e.target.files[0])} className="w-full bg-transparent border-none text-[13px] font-semibold text-slate-700 ml-3" />
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-10 flex justify-end">
                                    <button
                                        onClick={handleUploadMother}
                                        disabled={isUploadingMother || !moaFile || !region || !province || !lguType || isNcrPgoError}
                                        className={`px-8 py-4 rounded-2xl font-black text-[13px] uppercase tracking-wider shadow-lg transition-all ${isUploadingMother || !moaFile || !region || !province || !lguType || isNcrPgoError ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-[#004A99] text-white hover:bg-blue-700 shadow-blue-900/20'}`}
                                    >
                                        {isUploadingMother ? "Processing..." : "Submit Mother MOA"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Supplemental Modal */}
                {isSupplementalModalOpen && (
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                            <div className="p-8">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm">
                                            <FiPlus size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-slate-800 tracking-tight">Add Supplemental</h3>
                                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Attach to Mother MOA</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setIsSupplementalModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400"><FiX size={20} /></button>
                                </div>

                                <div className="space-y-6">
                                    <SearchableSelect 
                                        label="Select Mother MOA" 
                                        options={motherMoas.map(m => `${m.lgu_name} (${m.lgu_type})`)} 
                                        selected={selectedMotherMoa ? `${selectedMotherMoa.lgu_name} (${selectedMotherMoa.lgu_type})` : ''} 
                                        onSelect={(val) => {
                                            const moa = motherMoas.find(m => `${m.lgu_name} (${m.lgu_type})` === val);
                                            setSelectedMotherMoa(moa);
                                            if (moa) fetchProjectsForMoa(moa.mother_moa_id);
                                        }} 
                                        icon={TbFileCheck} 
                                    />
                                    
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Supplemental PDF File</label>
                                        <div className="flex items-center px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl">
                                            <FiUpload className="text-slate-400" size={18} />
                                            <input type="file" accept="application/pdf" onChange={(e) => setSupplementalFile(e.target.files[0])} className="w-full bg-transparent border-none text-[13px] font-semibold text-slate-700 ml-3" />
                                        </div>
                                    </div>

                                    {/* Project Multipicker */}
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Assign to Projects (IPC)</label>
                                        <div className="bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 space-y-3">
                                            <div className="relative">
                                                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                                <input type="text" placeholder="Search projects..." value={projectModalSearch} onChange={(e) => setProjectModalSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-[12px]" />
                                            </div>
                                            <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-2">
                                                {availableProjects.filter(p => (p.project_name || '').toLowerCase().includes(projectModalSearch.toLowerCase())).map(p => (
                                                    <label key={p.project_id} className="flex items-center gap-3 p-2 bg-white rounded-lg border border-slate-100 cursor-pointer">
                                                        <input type="checkbox" checked={selectedIpcs.includes(p.ipc)} onChange={(e) => e.target.checked ? setSelectedIpcs([...selectedIpcs, p.ipc]) : setSelectedIpcs(selectedIpcs.filter(id => id !== p.ipc))} className="w-4 h-4 rounded text-emerald-600" />
                                                        <span className="text-[11px] font-bold text-slate-700 truncate">{p.project_name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleUploadSupplemental}
                                        disabled={isUploadingSupplemental || !supplementalFile || !selectedMotherMoa}
                                        className={`w-full py-4 rounded-2xl font-black text-[13px] uppercase tracking-wider shadow-lg transition-all ${isUploadingSupplemental || !supplementalFile || !selectedMotherMoa ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-900/20'}`}
                                    >
                                        {isUploadingSupplemental ? "Syncing..." : "Submit Supplemental"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </PageTransition>
    );
};

export default EFDProjects2026;
