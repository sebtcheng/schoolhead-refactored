/* src/modules/ESF7Review.jsx */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    FiArrowLeft, 
    FiCheckCircle, 
    FiXCircle, 
    FiDownload, 
    FiEye,
    FiLoader,
    FiAlertCircle,
    FiSearch,
    FiActivity,
    FiFileText,
    FiShield
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import PageTransition from '../components/PageTransition';
import { useAuth } from '../context/AuthContext';

const ESF7Review = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [allSchools, setAllSchools] = useState([]);
    const [stats, setStats] = useState({ 
        total_registered: 0, 
        pending_sdo: 0, 
        verified: 0, 
        rejected: 0, 
        missing_esf7: 0 
    });
    const [selectedSchool, setSelectedSchool] = useState(null);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('queue'); 
    const [requests, setRequests] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [hasDownloaded, setHasDownloaded] = useState(false);

    useEffect(() => {
        if (user) {
            // Verify access: Only SDO Personnel (specifically SGOD) and Super Users
            const userOffice = (user.office || '').toUpperCase();
            const isAuthorized = user.role === 'Super User' || userOffice === 'SCHOOL GOVERNANCE AND OPERATIONS DIVISION (SGOD)';
            
            if (!isAuthorized) {
                navigate('/monitoring-dashboard');
                return;
            }
            fetchAllData();
        }
    }, [user]);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            const query = `region=${encodeURIComponent(user?.region || '')}&division=${encodeURIComponent(user?.division || '')}`;
            
            const [statsRes, schoolsRes, reqRes] = await Promise.all([
                fetch(`/api/esf7/stats?${query}`),
                fetch(`/api/esf7/all-schools?${query}`),
                fetch('/api/esf7/requests')
            ]);

            const statsData = await statsRes.json();
            const schoolsData = await schoolsRes.json();
            const reqData = await reqRes.json();

            if (statsData.success) setStats(statsData.data);
            if (schoolsData.success) setAllSchools(schoolsData.data);
            if (reqData.success) setRequests(reqData.data);
        } catch (err) {
            setError("Connectivity error: Failed to fetch division data.");
        } finally {
            setLoading(false);
        }
    };

    const handleViewRecords = async (schoolId) => {
        setLoading(true);
        setSelectedSchool(schoolId);
        setHasDownloaded(false);
        try {
            const res = await fetch(`/api/esf7/records/${schoolId}`);
            const data = await res.json();
            if (data.success) setRecords(data.data);
            else throw new Error(data.error);
        } catch (err) {
            setError("Failed to fetch records for this school.");
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async () => {
        if (!selectedSchool || !hasDownloaded) return;
        setActionLoading(true);
        try {
            const res = await fetch('/api/esf7/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ school_id: selectedSchool })
            });
            if (res.ok) {
                setSelectedSchool(null);
                fetchAllData();
            }
        } catch (err) {
            setError("Failed to approve submission.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleReturn = async () => {
        if (!selectedSchool) return;
        if (!window.confirm("Return this ESF7 for correction?")) return;
        
        setActionLoading(true);
        try {
            const res = await fetch('/api/esf7/return', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ school_id: selectedSchool })
            });
            if (res.ok) {
                setSelectedSchool(null);
                fetchAllData();
            }
        } catch (err) {
            setError("Failed to return submission.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleProcessRequest = async (schoolId, decision) => {
        setActionLoading(true);
        try {
            const res = await fetch('/api/esf7/approve-resubmit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    school_id: schoolId, 
                    decision, 
                    processor_name: user?.full_name || user?.username 
                })
            });
            if (res.ok) fetchAllData();
        } catch (err) {
            alert("Approval failed.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleDownloadClean = () => {
        console.log("Starting ESF7 Download for school:", selectedSchool);
        console.log("Records to export:", records.length);
        
        if (!records.length) {
            alert("No records found to download.");
            return;
        }

        try {
            // Ensure the data is flat and clean and capture ALL unique keys for headers
            const allKeysSet = new Set();
            const cleanRecords = records.map(r => {
                const row = { ...r };
                delete row.id; // Hide internal DB id
                delete row.id_serial;
                delete row.school_id;
                delete row.status;
                delete row.updated_at;
                delete row.created_at;
                
                Object.keys(row).forEach(k => allKeysSet.add(k));
                return row;
            });

            const headers = Array.from(allKeysSet);
            const ws = XLSX.utils.json_to_sheet(cleanRecords, { header: headers });
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Personnel_Audit");
            
            XLSX.writeFile(wb, `ESF7_Audit_${selectedSchool}.xlsx`);
            setHasDownloaded(true);
            console.log("Download triggered successfully with all detected columns.");
        } catch (err) {
            console.error("XLSX Export Error:", err);
            alert("Download failed: " + err.message);
        }
    };

    const filteredSchools = allSchools.filter(s => {
        const matchesSearch = s.school_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             s.school_id.toLowerCase().includes(searchTerm.toLowerCase());
        
        if (activeTab === 'queue') return matchesSearch && (s.status === 'PENDING_SDO' || s.status === 'REJECTED');
        if (activeTab === 'verified') return matchesSearch && s.status === 'VERIFIED';
        if (activeTab === 'missing') return matchesSearch && s.status === 'NOT_STARTED';
        return matchesSearch;
    });

    if (loading && !selectedSchool) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
                <FiLoader className="w-8 h-8 text-indigo-600 animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Division Queue</p>
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
                            <h1 className="text-xl font-black text-slate-800 tracking-tight leading-none uppercase italic">ESF7 Division Hub</h1>
                            <p className="text-[10px] font-bold text-indigo-500 mt-1 uppercase tracking-widest leading-none">SGOD Administrative Review</p>
                        </div>
                    </div>
                </header>

                <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
                    {!selectedSchool ? (
                        <>
                            {/* Division Status Overlay */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <StatCard label="Pending" value={stats.pending_sdo} icon={<FiActivity />} color="bg-amber-500" isActive={activeTab === 'queue'} onClick={() => setActiveTab('queue')} />
                                <StatCard label="Verified" value={stats.verified} icon={<FiCheckCircle />} color="bg-emerald-500" isActive={activeTab === 'verified'} onClick={() => setActiveTab('verified')} />
                                <StatCard label="Rejected" value={stats.rejected} icon={<FiXCircle />} color="bg-rose-500" />
                                <StatCard label="Missing" value={stats.missing_esf7} icon={<FiAlertCircle />} color="bg-slate-400" isActive={activeTab === 'missing'} onClick={() => setActiveTab('missing')} />
                            </div>

                            <div className="space-y-6">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-2xl shadow-sm self-start overflow-x-auto max-w-full">
                                        <TabButton active={activeTab === 'queue'} onClick={() => setActiveTab('queue')} label="Queue" />
                                        <TabButton active={activeTab === 'requests'} onClick={() => setActiveTab('requests')} label={`Requests (${requests.length})`} />
                                        <TabButton active={activeTab === 'verified'} onClick={() => setActiveTab('verified')} label="Verified" />
                                        <TabButton active={activeTab === 'missing'} onClick={() => setActiveTab('missing')} label="Missing" />
                                        <TabButton active={activeTab === 'all'} onClick={() => setActiveTab('all')} label="All Schools" />
                                    </div>
                                    <div className="relative">
                                        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input 
                                            type="text" 
                                            placeholder="Search by ID or Name..." 
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-11 pr-6 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold w-full md:w-64"
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-3">
                                    {activeTab === 'requests' ? (
                                        requests.map(req => (
                                            <div key={req.id} className="bg-white p-6 rounded-3xl border border-indigo-100 shadow-sm flex items-center justify-between gap-4">
                                                <div>
                                                    <h4 className="font-black text-slate-800 uppercase italic leading-none">{req.school_name}</h4>
                                                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">School ID: {req.school_id}</p>
                                                    <div className="mt-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                                                        <p className="text-[11px] font-bold text-indigo-700 leading-relaxed italic">"{req.reason || 'No reason provided'}"</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleProcessRequest(req.school_id, 'REJECTED')} className="px-4 py-3 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-rose-100">Reject</button>
                                                    <button onClick={() => handleProcessRequest(req.school_id, 'APPROVED')} className="px-4 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-200">Unlock Module</button>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        filteredSchools.map((school) => (
                                            <SchoolRow 
                                                key={school.school_id} 
                                                school={school} 
                                                onClick={() => school.status !== 'NOT_STARTED' && handleViewRecords(school.school_id)} 
                                            />
                                        ))
                                    )}
                                    {activeTab === 'requests' && requests.length === 0 && (
                                        <div className="text-center py-20 bg-white rounded-[2rem] border border-slate-100">
                                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No pending resubmission tickets</p>
                                        </div>
                                    )}
                                    {activeTab !== 'requests' && filteredSchools.length === 0 && (
                                        <div className="text-center py-20 bg-white rounded-[2rem] border border-slate-100">
                                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No matching records in this category</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="space-y-6">
                            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase italic">
                                        {allSchools.find(s => s.school_id === selectedSchool)?.school_name || "Detail View"}
                                    </h2>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full uppercase">Staff Masterlist</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Rows: {records.length}</span>
                                    </div>
                                </div>
                                <button 
                                    onClick={handleDownloadClean}
                                    className="flex items-center gap-2 px-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-slate-900/10"
                                >
                                    <FiDownload /> Download for Audit
                                </button>
                            </div>

                            <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm">
                                <div className="overflow-x-auto max-h-[500px]">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100">
                                                {records.length > 0 && Object.keys(records[0]).map((key, i) => (
                                                    <th key={i} className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{key}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {records.map((row, i) => (
                                                <tr key={i} className="hover:bg-blue-50/50 transition-colors">
                                                    {Object.values(row).map((cell, ci) => (
                                                        <td key={ci} className="px-6 py-3 text-[11px] font-bold text-slate-600 truncate max-w-[200px]">{cell || '-'}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <button onClick={() => setSelectedSchool(null)} className="flex-1 py-5 bg-white border border-slate-200 text-slate-500 font-black rounded-3xl uppercase text-[10px]">Back</button>
                                <button 
                                    onClick={handleApprove} 
                                    disabled={actionLoading || !hasDownloaded}
                                    className={`flex-[2] py-5 font-black rounded-3xl uppercase text-[10px] flex items-center justify-center gap-3 transition-all ${!hasDownloaded ? 'bg-slate-100 text-slate-400' : 'bg-indigo-600 text-white shadow-lg'}`}
                                >
                                    {actionLoading ? <FiLoader className="animate-spin" /> : <FiCheckCircle />}
                                    {!hasDownloaded ? "Audit Required (Download)" : "Verify & Commit"}
                                </button>
                                <button onClick={handleReturn} disabled={actionLoading} className="flex-1 py-5 bg-rose-50 text-rose-600 border border-rose-100 font-black rounded-3xl uppercase text-[10px]">Return</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </PageTransition>
    );
};

const StatCard = ({ label, value, icon, color, onClick, isActive }) => (
    <div onClick={onClick} className={`p-6 rounded-[2rem] bg-white border transition-all cursor-pointer flex items-center gap-4 ${isActive ? 'border-indigo-500 ring-4 ring-indigo-50 shadow-lg' : 'border-slate-100 hover:border-slate-200 shadow-sm'}`}>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white text-xl ${color}`}>{icon}</div>
        <div>
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</h4>
            <p className="text-2xl font-black text-slate-800">{value}</p>
        </div>
    </div>
);

const TabButton = ({ active, onClick, label }) => (
    <button onClick={onClick} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${active ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}>
        {label}
    </button>
);

const SchoolRow = ({ school, onClick }) => (
    <div 
        onClick={onClick}
        className={`bg-white border border-slate-100 p-5 rounded-3xl flex items-center justify-between group transition-all ${school.status !== 'NOT_STARTED' ? 'cursor-pointer hover:border-indigo-200 hover:shadow-md' : 'opacity-60 grayscale'}`}
    >
        <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${school.status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-500' : school.status === 'PENDING_SDO' ? 'bg-indigo-50 text-indigo-500' : 'bg-slate-50 text-slate-300'}`}>
                {school.status === 'VERIFIED' ? <FiShield size={20} /> : <FiFileText size={20} />}
            </div>
            <div>
                <h3 className="font-black text-slate-800 uppercase tracking-tight leading-none group-hover:text-indigo-600 transition-colors uppercase">{school.school_name}</h3>
                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">ID: {school.school_id}</p>
            </div>
        </div>
        <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${school.status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-600' : school.status === 'PENDING_SDO' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'}`}>
            {school.status.replace('_', ' ')}
        </div>
    </div>
);

export default ESF7Review;
