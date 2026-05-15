import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BottomNav from './BottomNav';
import PageTransition from '../components/PageTransition';
import { FiX, FiPlus, FiEdit2, FiTrash2, FiCheck, FiChevronRight, FiMapPin } from 'react-icons/fi';
import { toProperCase } from '../utils/dataNormalization';
import { normalizeRole } from '../config/roleGroups';
import { api } from "../lib/api";

const LocationManagement = () => {
    const { user, token } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    // Filter States
    const [regions, setRegions] = useState([]);
    const [selectedRegion, setSelectedRegion] = useState('');
    
    const [provinces, setProvinces] = useState([]);
    const [selectedProvince, setSelectedProvince] = useState('');
    
    const [municipalities, setMunicipalities] = useState([]);
    const [selectedMunicipality, setSelectedMunicipality] = useState('');
    
    const [legislativeDistricts, setLegislativeDistricts] = useState([]);
    const [selectedLegislativeDistrict, setSelectedLegislativeDistrict] = useState('');
    
    const [districts, setDistricts] = useState([]);
    const [selectedDistrict, setSelectedDistrict] = useState('');

    const [barangays, setBarangays] = useState([]);

    // Edit/Add States
    const [isAdding, setIsAdding] = useState({
        region: false,
        province: false,
        municipality: false,
        district: false,
        legislativeDistrict: false,
        barangay: false
    });
    const [newInputs, setNewInputs] = useState({
        region: '',
        province: '',
        municipality: '',
        district: '',
        legislativeDistrict: '',
        barangay: ''
    });

    const [editingItem, setEditingItem] = useState(null); // { type, id, value }
    const [editValue, setEditValue] = useState('');

    const [showConfirm, setShowConfirm] = useState(false);
    const [confirmData, setConfirmData] = useState(null); // { title, message, onConfirm }

    const [showAddModal, setShowAddModal] = useState(false);
    const [addModalType, setAddModalType] = useState('');
    const [addModalValue, setAddModalValue] = useState('');

    useEffect(() => {
        if (showConfirm || showAddModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [showConfirm, showAddModal]);

    useEffect(() => {
        if (user) {
            const normalizedRole = normalizeRole(user.role);
            if (normalizedRole !== 'School Division Office' && normalizedRole !== 'Regional Office' && normalizedRole !== 'Super User') {
                navigate('/monitoring-dashboard');
                return;
            }
            fetchRegions();
            if (user.division) {
                prefillLocation(user.division);
            }
            setLoading(false);
        }
    }, [user, navigate]);

    const prefillLocation = async (division) => {
        try {
            const res = await fetch(api(`/api/locations/division-info?division=${encodeURIComponent(division)}`), {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (res.ok) {
                const data = await res.json();
                if (data.region) setSelectedRegion(data.region);
                if (data.province) setSelectedProvince(data.province);
            }
        } catch (err) { console.error("Prefill failed", err); }
    };

    const fetchRegions = async () => {
        try {
            const res = await fetch(api(`/api/locations/regions`), {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (res.ok) {
                const data = await res.json();
                setRegions(data);
            }
        } catch (err) { console.error("Fetch regions failed", err); }
    };

    const fetchProvinces = async (region) => {
        if (!region) {
            setProvinces([]);
            return;
        }
        try {
            const res = await fetch(api(`/api/locations/provinces?region=${encodeURIComponent(region)}`), {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (res.ok) {
                const data = await res.json();
                setProvinces(data);
            }
        } catch (err) { console.error("Fetch provinces failed", err); }
    };

    const fetchDistricts = async (region, division, legislativeDistrict, municipality) => {
        if (!region || !division) {
            setDistricts([]);
            return;
        }
        try {
            let url = `api/locations/districts?region=${encodeURIComponent(region)}&division=${encodeURIComponent(division)}`;
            if (legislativeDistrict) url += `&legislative_district=${encodeURIComponent(legislativeDistrict)}`;
            if (municipality) url += `&municipality=${encodeURIComponent(municipality)}`;
            
            const res = await fetch(url, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (res.ok) {
                const data = await res.json();
                setDistricts(data);
            }
        } catch (err) { console.error("Fetch districts failed", err); }
    };

    const fetchMunicipalities = async (region, province) => {
        if (!region || !province) {
            setMunicipalities([]);
            return;
        }
        try {
            const res = await fetch(api(`/api/locations/municipalities-by-province?region=${encodeURIComponent(region)}&province=${encodeURIComponent(province)}`), {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (res.ok) {
                const data = await res.json();
                setMunicipalities(data);
            }
        } catch (err) { console.error("Fetch municipalities failed", err); }
    };


    const fetchBarangays = async (region, province, municipality) => {
        if (!region || !province || !municipality) {
            setBarangays([]);
            return;
        }
        try {
            const res = await fetch(api(`/api/locations/barangays?region=${encodeURIComponent(region)}&province=${encodeURIComponent(province)}&municipality=${encodeURIComponent(municipality)}`), {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (res.ok) {
                const data = await res.json();
                setBarangays(data);
            }
        } catch (err) { console.error("Fetch barangays failed", err); }
    };

    useEffect(() => {
        if (selectedRegion) {
            fetchProvinces(selectedRegion);
            // Administrative: Always fetch districts for the user's division
            if (user?.division) {
                fetchDistricts(selectedRegion, user.division);
            }
        }
    }, [selectedRegion, user?.division]);

    useEffect(() => {
        if (selectedRegion && selectedProvince) {
            fetchMunicipalities(selectedRegion, selectedProvince);
            setSelectedMunicipality('');
            setBarangays([]);
        }
    }, [selectedProvince]);

    useEffect(() => {
        if (selectedRegion && selectedProvince && selectedMunicipality) {
            fetchBarangays(selectedRegion, selectedProvince, selectedMunicipality);
        }
    }, [selectedMunicipality]);

    const fetchLegislativeDistricts = async (region, province) => {
        if (!region || !province) {
            setLegislativeDistricts([]);
            return;
        }
        try {
            const res = await fetch(api(`/api/locations/legislative-districts?region=${encodeURIComponent(region)}&province=${encodeURIComponent(province)}`), {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (res.ok) {
                const data = await res.json();
                setLegislativeDistricts(data);
            }
        } catch (err) {
            console.error("Fetch legislative districts failed", err);
            // Fallback to hardcoded if API fails
            setLegislativeDistricts([
                '1ST DISTRICT', '2ND DISTRICT', '3RD DISTRICT', '4TH DISTRICT',
                '5TH DISTRICT', '6TH DISTRICT', '7TH DISTRICT', '8TH DISTRICT'
            ]);
        }
    };

    useEffect(() => {
        if (selectedRegion && selectedProvince) {
            fetchLegislativeDistricts(selectedRegion, selectedProvince);
        } else {
            setLegislativeDistricts([]);
        }
    }, [selectedRegion, selectedProvince]);

    const handleAdd = async (type) => {
        setAddModalType(type);
        setAddModalValue('');
        setShowAddModal(true);
    };

    const executeAdd = async (type, value) => {
        let body = {};
        let endpoint = '';

        if (type === 'barangay') {
            endpoint = 'api/locations/barangays';
            body = {
                region: selectedRegion,
                province: selectedProvince,
                municipality: selectedMunicipality,
                barangay: value
            };
        } else {
            endpoint = 'api/locations/all_locations';
            body = {
                region: type === 'region' ? value : selectedRegion,
                province: type === 'province' ? value : (selectedProvince || 'NOT SPECIFIED'),
                municipality: type === 'municipality' ? value : (selectedMunicipality || 'NOT SPECIFIED'),
                legislative_district: type === 'legislativeDistrict' ? value : (selectedLegislativeDistrict || 'NOT SPECIFIED'),
                division: user.division, // Default to user's division
                district: type === 'district' ? value : (selectedDistrict || 'NOT SPECIFIED')
            };
        }

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                alert(`${type.toUpperCase()} added successfully!`);
                setNewInputs(prev => ({ ...prev, [type]: '' }));
                setIsAdding(prev => ({ ...prev, [type]: false }));
                // Refresh list
                if (type === 'region') fetchRegions();
                else if (type === 'province') fetchProvinces(selectedRegion);
                else if (type === 'municipality') fetchMunicipalities(selectedRegion, selectedProvince, selectedDistrict);
                else if (type === 'district') fetchDistricts(selectedRegion, user.division);
                else if (type === 'legislativeDistrict') fetchLegislativeDistricts(selectedRegion, selectedProvince, selectedMunicipality);
                else if (type === 'barangay') fetchBarangays(selectedRegion, selectedProvince, selectedMunicipality);
            } else {
                const err = await res.json();
                alert(err.error || "Failed to add.");
            }
        } catch (err) {
            console.error("Add failed", err);
            alert("An error occurred.");
        }
    };

    const handleEdit = async (type, id, value) => {
        const newValue = value.toUpperCase();
        if (!newValue) return;

        // Duplicate Check for edit
        let isDuplicate = false;
        if (type === 'barangay') {
            isDuplicate = barangays.some(b => b.barangay === newValue && b.id !== id);
        }

        if (isDuplicate) {
            alert(`This ${type.toUpperCase()} already exists in the current list.`);
            return;
        }

        setConfirmData({
            title: `Update ${type.toUpperCase()}`,
            message: `Are you sure you want to change this to "${newValue}"?`,
            onConfirm: () => executeEdit(type, id, newValue)
        });
        setShowConfirm(true);
    };

    const executeEdit = async (type, id, newValue) => {
        const oldValue = type === 'barangay' ? '' : editingItem.value; // For non-barangay, we rename by value
        let body = {};
        let endpoint = '';

        if (type === 'barangay') {
            endpoint = `api/locations/barangays/${encodeURIComponent(id)}`;
            body = {
                region: selectedRegion,
                province: selectedProvince,
                municipality: selectedMunicipality,
                barangay: newValue
            };
        } else {
            // Rename logic for District, Municipality, Legislative District
            endpoint = 'api/locations/rename';
            body = {
                type,
                oldValue: oldValue,
                newValue: newValue,
                region: selectedRegion,
                division: user.division,
                province: selectedProvince,
                municipality: selectedMunicipality
            };
        }

        try {
            const res = await fetch(endpoint, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                alert(`${type.toUpperCase()} updated successfully!`);
                setEditingItem(null);
                setEditValue('');
                
                // Refresh list
                if (type === 'district') {
                    await fetchDistricts(selectedRegion, user.division);
                    setSelectedDistrict(newValue);
                } else if (type === 'municipality') {
                    await fetchMunicipalities(selectedRegion, selectedProvince, selectedDistrict);
                    setSelectedMunicipality(newValue);
                } else if (type === 'legislativeDistrict') {
                    await fetchLegislativeDistricts(selectedRegion, selectedProvince, selectedMunicipality);
                } else if (type === 'barangay') {
                    fetchBarangays(selectedRegion, selectedProvince, selectedMunicipality);
                }
            } else {
                const err = await res.json();
                alert(err.error || "Failed to update.");
            }
        } catch (err) { console.error("Update failed", err); }
    };

    const handleDelete = async (type, id) => {
        if (normalizeRole(user?.role) === 'School Division Office' && (type === 'barangay' || type === 'municipality')) {
            alert("Your account does not have permission to delete this location level.");
            return;
        }
        if (!window.confirm(`Are you sure you want to delete this ${type.toUpperCase()}? This action cannot be undone.`)) return;

        let endpoint = '';
        if (type === 'barangay') endpoint = `api/locations/barangays/${encodeURIComponent(id)}`;
        else {
            alert("Delete for this level is not yet fully implemented in UI.");
            return;
        }

        try {
            const res = await fetch(endpoint, {
                method: 'DELETE',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    region: selectedRegion,
                    province: selectedProvince,
                    municipality: selectedMunicipality
                })
            });

            if (res.ok) {
                alert(`${type.toUpperCase()} deleted successfully!`);
                if (type === 'barangay') fetchBarangays(selectedRegion, selectedProvince, selectedMunicipality);
            } else {
                const err = await res.json();
                alert(err.error || "Failed to delete.");
            }
        } catch (err) { console.error("Delete failed", err); }
    };

    if (loading) return null;

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-32">
                {/* Header */}
                <div className="bg-gradient-to-br from-[#1E293B] to-[#0F172A] p-6 sm:p-8 pb-20 rounded-b-[3rem] shadow-2xl text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <FiMapPin size={200} />
                    </div>
                    <div className="relative z-20 mb-4">
                        <button
                            onClick={() => navigate('/monitoring-dashboard')}
                            className="flex items-center gap-2 text-white/80 hover:text-white transition-colors text-sm font-bold uppercase tracking-wider"
                        >
                            <FiX size={18} /> Back to Dashboard
                        </button>
                    </div>
                    <div className="relative z-10">
                        <h1 className="text-4xl font-black tracking-tighter">Location Management</h1>
                        <p className="text-blue-200 text-lg font-medium mt-1">
                            Manage regions, provinces, municipalities, districts, and barangays
                        </p>
                    </div>
                </div>

                <div className="max-w-3xl mx-auto px-4 sm:px-6 -mt-12 space-y-6 relative z-30">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl p-5 sm:p-8 space-y-10">
                        
                        {/* ADMINISTRATIVE SECTION */}
                        <div className="space-y-6">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Administrative Hierarchy</h3>
                            
                            {/* REGION */}
                            <div className="space-y-2 pl-4 border-l-4 border-slate-100 dark:border-slate-700">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block pl-1">Region</label>
                                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                        <select 
                                            value={selectedRegion}
                                            disabled={!!user?.division} // Disable if prefilled by division
                                            onChange={(e) => setSelectedRegion(e.target.value)}
                                            className={`flex-1 min-w-0 px-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-blue-500 outline-none dark:text-white appearance-none ${user?.division ? 'opacity-70 cursor-not-allowed' : ''}`}
                                        >
                                            <option value="">Select Region</option>
                                            {regions.map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    {!user?.division && (
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button 
                                                onClick={() => handleAdd('region')}
                                                className="p-3 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center bg-blue-600 text-white"
                                                title="Create New"
                                            >
                                                <FiPlus size={18} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* DISTRICT */}
                            <div className={`space-y-2 pl-4 border-l-4 border-slate-100 dark:border-slate-700 transition-opacity ${!selectedRegion ? 'opacity-50 pointer-events-none' : ''}`}>
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block pl-1">District</label>
                                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                    {editingItem?.type === 'district' ? (
                                        <input 
                                            type="text" 
                                            autoFocus
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value.toUpperCase())}
                                            className="flex-1 min-w-0 px-4 py-2 bg-white dark:bg-slate-900 border-2 border-orange-500 rounded-2xl outline-none dark:text-white shadow-inner font-bold"
                                        />
                                    ) : (
                                        <select 
                                            value={selectedDistrict}
                                            onChange={(e) => setSelectedDistrict(e.target.value)}
                                            className="flex-1 min-w-0 px-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-blue-500 outline-none dark:text-white appearance-none"
                                        >
                                            <option value="">Select District</option>
                                            {districts.map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                    )}
                                    <div className="flex items-center gap-1 shrink-0">
                                        {editingItem?.type === 'district' ? (
                                            <>
                                                <button 
                                                    onClick={() => handleEdit('district', null, editValue)}
                                                    className="p-3 bg-green-500 text-white rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center"
                                                    title="Save"
                                                >
                                                    <FiCheck size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => setEditingItem(null)}
                                                    className="p-3 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-300 transition-all flex items-center justify-center"
                                                    title="Cancel"
                                                >
                                                    <FiX size={18} />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                {selectedDistrict && (
                                                    <button 
                                                        onClick={() => { setEditingItem({ type: 'district', value: selectedDistrict }); setEditValue(selectedDistrict); }}
                                                        className="p-3 bg-amber-500 text-white rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center"
                                                        title="Edit Selected District"
                                                    >
                                                        <FiEdit2 size={18} />
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => handleAdd('district')}
                                                    className="p-3 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center bg-blue-600 text-white"
                                                    title="Create New"
                                                >
                                                    <FiPlus size={18} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        </div>

                        {/* ELECTORAL SECTION */}
                        <div className="space-y-6">
                            <h3 className="text-sm font-black text-indigo-400 uppercase tracking-[0.2em] pl-1">Electoral Hierarchy</h3>

                            {/* LEGISLATIVE DISTRICT */}
                            <div className={`space-y-2 pl-4 border-l-4 border-indigo-100 dark:border-indigo-800 transition-opacity ${!selectedRegion ? 'opacity-50 pointer-events-none' : ''}`}>
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block pl-1">Legislative District</label>
                                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                    <select 
                                        value={selectedLegislativeDistrict}
                                        onChange={(e) => setSelectedLegislativeDistrict(e.target.value)}
                                        className="flex-1 min-w-0 px-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-blue-500 outline-none dark:text-white appearance-none"
                                    >
                                        <option value="">Select Legislative District</option>
                                        {legislativeDistricts.map(ld => <option key={ld} value={ld}>{ld}</option>)}
                                    </select>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button 
                                            onClick={() => handleAdd('legislativeDistrict')}
                                            className="p-3 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center bg-blue-600 text-white"
                                            title="Create New"
                                        >
                                            <FiPlus size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* LGU SECTION */}
                        <div className="space-y-8">
                            <h3 className="text-sm font-black text-blue-400 uppercase tracking-[0.2em] pl-1">Local Government Hierarchy</h3>

                            {/* PROVINCE */}
                            <div className={`space-y-2 pl-4 border-l-4 border-blue-100 dark:border-blue-800 transition-opacity ${!selectedRegion ? 'opacity-50 pointer-events-none' : ''}`}>
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block pl-1">Province</label>
                                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                        <select 
                                            value={selectedProvince}
                                            disabled={!!user?.division} // Disable if prefilled by division
                                            onChange={(e) => setSelectedProvince(e.target.value)}
                                            className={`flex-1 min-w-0 px-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-blue-500 outline-none dark:text-white appearance-none ${user?.division ? 'opacity-70 cursor-not-allowed' : ''}`}
                                        >
                                            <option value="">Select Province</option>
                                            {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    {!user?.division && (
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button 
                                                onClick={() => handleAdd('province')}
                                                className="p-3 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center bg-blue-600 text-white"
                                                title="Create New"
                                            >
                                                <FiPlus size={18} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* MUNICIPALITY */}
                            <div className={`space-y-2 pl-4 border-l-4 border-blue-100 dark:border-blue-800 transition-opacity ${!selectedProvince ? 'opacity-50 pointer-events-none' : ''}`}>
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block pl-1">Municipality</label>
                                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                    {editingItem?.type === 'municipality' ? (
                                        <input 
                                            type="text" 
                                            autoFocus
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value.toUpperCase())}
                                            className="flex-1 min-w-0 px-4 py-2 bg-white dark:bg-slate-900 border-2 border-orange-500 rounded-2xl outline-none dark:text-white shadow-inner font-bold"
                                        />
                                    ) : (
                                        <select 
                                            value={selectedMunicipality}
                                            onChange={(e) => setSelectedMunicipality(e.target.value)}
                                            className="flex-1 min-w-0 px-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-blue-500 outline-none dark:text-white appearance-none"
                                        >
                                            <option value="">Select Municipality</option>
                                            {municipalities.map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                    )}
                                    <div className="flex items-center gap-1 shrink-0">
                                        {editingItem?.type === 'municipality' ? (
                                            <>
                                                <button 
                                                    onClick={() => handleEdit('municipality', null, editValue)}
                                                    className="p-3 bg-green-500 text-white rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center"
                                                    title="Save"
                                                >
                                                    <FiCheck size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => setEditingItem(null)}
                                                    className="p-3 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-300 transition-all flex items-center justify-center"
                                                    title="Cancel"
                                                >
                                                    <FiX size={18} />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                {selectedMunicipality && normalizeRole(user?.role) !== 'School Division Office' && (
                                                    <button 
                                                        onClick={() => { setEditingItem({ type: 'municipality', value: selectedMunicipality }); setEditValue(selectedMunicipality); }}
                                                        className="p-3 bg-amber-500 text-white rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center"
                                                        title="Edit Selected Municipality"
                                                    >
                                                        <FiEdit2 size={18} />
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => handleAdd('municipality')}
                                                    className="p-3 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center bg-blue-600 text-white"
                                                    title="Create New"
                                                >
                                                    <FiPlus size={18} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* BARANGAY LIST */}
                            <div className={`space-y-4 transition-opacity pl-4 border-l-4 border-blue-50 dark:border-blue-900/30 ${!selectedMunicipality && !isAdding.barangay ? 'opacity-50 pointer-events-none' : ''}`}>
                                <div className="flex justify-between items-center px-1">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Barangays</label>
                                    <button 
                                        onClick={() => handleAdd('barangay')}
                                        className="text-blue-600 font-bold text-sm flex items-center gap-1 hover:underline"
                                    >
                                        <FiPlus /> Add Barangay
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 gap-3">
                                    {barangays.length > 0 ? (
                                        barangays.map(b => (
                                            <div key={b.id} className="group flex justify-between items-center p-3 sm:p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-900 transition-all min-h-[72px] overflow-hidden">
                                                {editingItem?.id === b.id ? (
                                                    <div className="flex-1 flex items-center gap-2 sm:gap-3 animate-in fade-in zoom-in-95 duration-200 min-w-0">
                                                        <input 
                                                            type="text"
                                                            autoFocus
                                                            value={editValue}
                                                            onChange={(e) => setEditValue(e.target.value.toUpperCase())}
                                                            className="flex-1 min-w-0 px-3 sm:px-4 py-2 bg-white dark:bg-slate-800 border-2 border-blue-500 rounded-xl outline-none dark:text-white shadow-inner font-bold text-sm sm:text-base"
                                                        />
                                                        <div className="flex items-center gap-1 flex-shrink-0">
                                                            <button 
                                                                onClick={() => handleEdit('barangay', b.id, editValue)} 
                                                                className="p-2 sm:p-3 bg-green-500 text-white rounded-xl shadow-md hover:bg-green-600 active:scale-95 transition-all"
                                                                title="Save"
                                                            >
                                                                <FiCheck size={18} />
                                                            </button>
                                                            <button 
                                                                onClick={() => setEditingItem(null)} 
                                                                className="p-2 sm:p-3 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 active:scale-95 transition-all"
                                                                title="Cancel"
                                                            >
                                                                <FiX size={18} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <span className="font-bold text-slate-700 dark:text-slate-200">{b.barangay}</span>
                                                        {normalizeRole(user?.role) !== 'School Division Office' && (
                                                            <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button 
                                                                    onClick={() => {
                                                                        setEditingItem({ id: b.id, type: 'barangay' });
                                                                        setEditValue(b.barangay);
                                                                    }}
                                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                    title="Edit"
                                                                >
                                                                    <FiEdit2 size={16} />
                                                                    <span className="text-xs font-bold ml-1">EDIT</span>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="col-span-full py-8 text-center text-slate-400 font-medium bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                                            No barangays found.
                                        </div>
                                    )}
                                </div>
                            </div>

                    </div>
                </div>

                {/* CONFIRMATION MODAL */}
                {showConfirm && confirmData && createPortal(
                    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl p-8 max-w-sm w-full animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-700 text-center">
                            <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                                <FiCheck className="text-blue-600 dark:text-blue-400" size={40} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2 leading-tight">
                                {confirmData.title}
                            </h3>
                            <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">
                                {confirmData.message}
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setShowConfirm(false)}
                                    className="px-6 py-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        confirmData.onConfirm();
                                        setShowConfirm(false);
                                    }}
                                    className="px-6 py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none hover:bg-blue-700 active:scale-95 transition-all"
                                >
                                    Confirm
                                </button>
                             </div>
                        </div>
                    </div>,
                    document.body
                )}

                {/* ADD MODAL (FIXED) */}
                {showAddModal && createPortal(
                    <div className="fixed inset-0 z-[1110] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl p-8 max-w-sm w-full animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-700">
                            <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-6 leading-tight text-center">
                                Add New {addModalType === 'legislativeDistrict' ? 'Legislative District' : addModalType.toUpperCase()}
                            </h3>
                            
                            <div className="space-y-4 mb-8">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block pl-1">Name</label>
                                <input 
                                    type="text"
                                    autoFocus
                                    value={addModalValue}
                                    onChange={(e) => setAddModalValue(e.target.value.toUpperCase())}
                                    placeholder={`Enter ${addModalType}...`}
                                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-blue-500 outline-none dark:text-white font-bold text-lg shadow-inner"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="px-6 py-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        if (addModalValue.trim()) {
                                            executeAdd(addModalType, addModalValue.trim().toUpperCase());
                                            setShowAddModal(false);
                                        }
                                    }}
                                    disabled={!addModalValue.trim()}
                                    className={`px-6 py-4 text-white font-bold rounded-2xl shadow-lg transition-all active:scale-95 ${!addModalValue.trim() ? 'bg-slate-300 cursor-not-allowed shadow-none' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200 dark:shadow-none'}`}
                                >
                                    Add
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
            </div>
            <BottomNav />
        </PageTransition>
    );
};

export default LocationManagement;
