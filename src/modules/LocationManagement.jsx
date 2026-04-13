import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BottomNav from './BottomNav';
import PageTransition from '../components/PageTransition';
import { FiX, FiPlus, FiEdit2, FiTrash2, FiCheck, FiChevronRight, FiMapPin } from 'react-icons/fi';
import { toProperCase } from '../utils/dataNormalization';

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

    useEffect(() => {
        if (user) {
            if (user.role !== 'School Division Office' && user.role !== 'Regional Office' && user.role !== 'Super User') {
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
            const res = await fetch(`/api/locations/division-info?division=${encodeURIComponent(division)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.region) setSelectedRegion(data.region);
                if (data.province) setSelectedProvince(data.province);
            }
        } catch (err) { console.error("Prefill failed", err); }
    };

    const fetchRegions = async () => {
        try {
            const res = await fetch('/api/locations/regions');
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
            const res = await fetch(`/api/locations/provinces?region=${encodeURIComponent(region)}`);
            if (res.ok) {
                const data = await res.json();
                setProvinces(data);
            }
        } catch (err) { console.error("Fetch provinces failed", err); }
    };

    const fetchDistricts = async (region, division) => {
        if (!region || !division) {
            setDistricts([]);
            return;
        }
        try {
            const res = await fetch(`/api/locations/districts?region=${encodeURIComponent(region)}&division=${encodeURIComponent(division)}`);
            if (res.ok) {
                const data = await res.json();
                setDistricts(data);
            }
        } catch (err) { console.error("Fetch districts failed", err); }
    };

    const fetchMunicipalities = async (region, province, district) => {
        if (!region || !province) {
            setMunicipalities([]);
            return;
        }
        // Try to fetch by district if available, otherwise by province
        let url = `/api/locations/municipalities-by-province?region=${encodeURIComponent(region)}&province=${encodeURIComponent(province)}`;
        if (district) {
            // Note: If backend supports municipalities by district, we could use that.
            // For now, municipalities-by-province is what we have, 
            // but we'll check if /api/locations/municipalities exists and takes district.
            url = `/api/locations/municipalities?region=${encodeURIComponent(region)}&division=${encodeURIComponent(user?.division)}&district=${encodeURIComponent(district)}`;
        }
        
        try {
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setMunicipalities(data);
            }
        } catch (err) { console.error("Fetch municipalities failed", err); }
    };

    const fetchLegislativeDistricts = async (region, province, municipality) => {
        if (!region || !province || !municipality) {
            setLegislativeDistricts([]);
            return;
        }
        try {
            const res = await fetch(`/api/locations/legislative-districts?region=${encodeURIComponent(region)}&province=${encodeURIComponent(province)}&municipality=${encodeURIComponent(municipality)}`);
            if (res.ok) {
                const data = await res.json();
                setLegislativeDistricts(data);
            }
        } catch (err) { console.error("Fetch legislative districts failed", err); }
    };

    const fetchBarangays = async (region, province, municipality) => {
        if (!region || !province || !municipality) {
            setBarangays([]);
            return;
        }
        try {
            const res = await fetch(`/api/locations/barangays?region=${encodeURIComponent(region)}&province=${encodeURIComponent(province)}&municipality=${encodeURIComponent(municipality)}`);
            if (res.ok) {
                const data = await res.json();
                setBarangays(data);
            }
        } catch (err) { console.error("Fetch barangays failed", err); }
    };

    useEffect(() => {
        if (selectedRegion) {
            fetchProvinces(selectedRegion);
            // Don't clear if it was prefilled and matches
        }
    }, [selectedRegion]);

    useEffect(() => {
        if (selectedProvince) {
            if (selectedRegion && user?.division) {
                fetchDistricts(selectedRegion, user.division);
            }
            fetchMunicipalities(selectedRegion, selectedProvince, selectedDistrict);
        }
    }, [selectedProvince]);

    useEffect(() => {
        if (selectedDistrict) {
            fetchMunicipalities(selectedRegion, selectedProvince, selectedDistrict);
        }
    }, [selectedDistrict]);

    useEffect(() => {
        if (selectedMunicipality) {
            fetchLegislativeDistricts(selectedRegion, selectedProvince, selectedMunicipality);
            fetchBarangays(selectedRegion, selectedProvince, selectedMunicipality);
        }
    }, [selectedMunicipality]);

    const handleAdd = async (type) => {
        const value = newInputs[type].toUpperCase();
        if (!value) return;

        // Duplicate Check
        let isDuplicate = false;
        if (type === 'region') isDuplicate = regions.includes(value);
        else if (type === 'province') isDuplicate = provinces.includes(value);
        else if (type === 'district') isDuplicate = districts.includes(value);
        else if (type === 'municipality') isDuplicate = municipalities.includes(value);
        else if (type === 'legislativeDistrict') isDuplicate = legislativeDistricts.includes(value);
        else if (type === 'barangay') isDuplicate = barangays.some(b => b.barangay === value);

        if (isDuplicate) {
            alert(`This ${type.toUpperCase()} already exists in the current list.`);
            return;
        }

        setConfirmData({
            title: `Add New ${type.toUpperCase()}`,
            message: `Are you sure you want to add "${value}"?`,
            onConfirm: () => executeAdd(type, value)
        });
        setShowConfirm(true);
    };

    const executeAdd = async (type, value) => {
        let body = {};

        if (type === 'barangay') {
            endpoint = '/api/locations/ph_barangays';
            body = {
                region: selectedRegion,
                province: selectedProvince,
                municipality: selectedMunicipality,
                barangay: value
            };
        } else {
            endpoint = '/api/locations/all_locations';
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
        let body = {};

        if (type === 'barangay') {
            endpoint = `/api/locations/ph_barangays/${id}`;
            body = {
                region: selectedRegion,
                province: selectedProvince,
                municipality: selectedMunicipality,
                barangay: newValue
            };
        } else {
            alert("Editing for this level is not yet fully implemented in UI.");
            return;
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
                if (type === 'barangay') fetchBarangays(selectedRegion, selectedProvince, selectedMunicipality);
            } else {
                const err = await res.json();
                alert(err.error || "Failed to update.");
            }
        } catch (err) { console.error("Update failed", err); }
    };

    const handleDelete = async (type, id) => {
        if (!window.confirm(`Are you sure you want to delete this ${type.toUpperCase()}? This action cannot be undone.`)) return;

        let endpoint = '';
        if (type === 'barangay') endpoint = `/api/locations/ph_barangays/${id}`;
        else {
            alert("Delete for this level is not yet fully implemented in UI.");
            return;
        }

        try {
            const res = await fetch(endpoint, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
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
                <div className="bg-gradient-to-br from-[#1E293B] to-[#0F172A] p-8 pb-20 rounded-b-[3rem] shadow-2xl text-white relative overflow-hidden">
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

                <div className="max-w-3xl mx-auto px-6 -mt-12 space-y-6 relative z-30">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl p-8 space-y-8">
                        
                        {/* REGION */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest block pl-1">Region</label>
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                {isAdding.region ? (
                                    <input 
                                        type="text" 
                                        autoFocus
                                        value={newInputs.region}
                                        onChange={(e) => setNewInputs(prev => ({ ...prev, region: e.target.value.toUpperCase() }))}
                                        placeholder="Enter new region..."
                                        className="flex-1 min-w-0 px-4 py-2 bg-white dark:bg-slate-900 border-2 border-blue-500 rounded-2xl outline-none dark:text-white shadow-inner font-bold"
                                    />
                                ) : (
                                    <select 
                                        value={selectedRegion}
                                        disabled={!!user?.division} // Disable if prefilled by division
                                        onChange={(e) => setSelectedRegion(e.target.value)}
                                        className={`flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-blue-500 outline-none dark:text-white appearance-none ${user?.division ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    >
                                        <option value="">Select Region</option>
                                        {regions.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                )}
                                {!user?.division && (
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <button 
                                            onClick={() => isAdding.region ? handleAdd('region') : setIsAdding(prev => ({ ...prev, region: true }))}
                                            className={`p-3 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center ${isAdding.region ? 'bg-green-500 text-white' : 'bg-blue-600 text-white'}`}
                                            title={isAdding.region ? "Add" : "Create New"}
                                        >
                                            {isAdding.region ? <FiCheck size={18} /> : <FiPlus size={18} />}
                                        </button>
                                        {isAdding.region && (
                                            <button 
                                                onClick={() => setIsAdding(prev => ({ ...prev, region: false }))}
                                                className="p-3 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 active:scale-95 transition-all flex items-center justify-center"
                                                title="Cancel"
                                            >
                                                <FiX size={18} />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* PROVINCE */}
                        <div className={`space-y-2 transition-opacity ${!selectedRegion && !isAdding.province ? 'opacity-50 pointer-events-none' : ''}`}>
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest block pl-1">Province</label>
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                {isAdding.province ? (
                                    <input 
                                        type="text" 
                                        autoFocus
                                        value={newInputs.province}
                                        onChange={(e) => setNewInputs(prev => ({ ...prev, province: e.target.value.toUpperCase() }))}
                                        placeholder="Enter new province..."
                                        className="flex-1 min-w-0 px-4 py-2 bg-white dark:bg-slate-900 border-2 border-blue-500 rounded-2xl outline-none dark:text-white shadow-inner font-bold"
                                    />
                                ) : (
                                    <select 
                                        value={selectedProvince}
                                        disabled={!!user?.division} // Disable if prefilled by division
                                        onChange={(e) => setSelectedProvince(e.target.value)}
                                        className={`flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-blue-500 outline-none dark:text-white appearance-none ${user?.division ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    >
                                        <option value="">Select Province</option>
                                        {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                )}
                                {!user?.division && (
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <button 
                                            onClick={() => isAdding.province ? handleAdd('province') : setIsAdding(prev => ({ ...prev, province: true }))}
                                            className={`p-3 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center ${isAdding.province ? 'bg-green-500 text-white' : 'bg-blue-600 text-white'}`}
                                            title={isAdding.province ? "Add" : "Create New"}
                                        >
                                            {isAdding.province ? <FiCheck size={18} /> : <FiPlus size={18} />}
                                        </button>
                                        {isAdding.province && (
                                            <button 
                                                onClick={() => setIsAdding(prev => ({ ...prev, province: false }))}
                                                className="p-3 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 active:scale-95 transition-all flex items-center justify-center"
                                                title="Cancel"
                                            >
                                                <FiX size={18} />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* DISTRICT */}
                        <div className={`space-y-2 transition-opacity ${!selectedProvince && !isAdding.district ? 'opacity-50 pointer-events-none' : ''}`}>
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest block pl-1">District</label>
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                {isAdding.district ? (
                                    <input 
                                        type="text" 
                                        autoFocus
                                        value={newInputs.district}
                                        onChange={(e) => setNewInputs(prev => ({ ...prev, district: e.target.value.toUpperCase() }))}
                                        placeholder="Enter new district..."
                                        className="flex-1 min-w-0 px-4 py-2 bg-white dark:bg-slate-900 border-2 border-blue-500 rounded-2xl outline-none dark:text-white shadow-inner font-bold"
                                    />
                                ) : (
                                    <select 
                                        value={selectedDistrict}
                                        onChange={(e) => setSelectedDistrict(e.target.value)}
                                        className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-blue-500 outline-none dark:text-white appearance-none"
                                    >
                                        <option value="">Select District</option>
                                        {districts.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                )}
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <button 
                                        onClick={() => isAdding.district ? handleAdd('district') : setIsAdding(prev => ({ ...prev, district: true }))}
                                        className={`p-3 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center ${isAdding.district ? 'bg-green-500 text-white' : 'bg-blue-600 text-white'}`}
                                        title={isAdding.district ? "Add" : "Create New"}
                                    >
                                        {isAdding.district ? <FiCheck size={18} /> : <FiPlus size={18} />}
                                    </button>
                                    {isAdding.district && (
                                        <button 
                                            onClick={() => setIsAdding(prev => ({ ...prev, district: false }))}
                                            className="p-3 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 active:scale-95 transition-all flex items-center justify-center"
                                            title="Cancel"
                                        >
                                            <FiX size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* MUNICIPALITY */}
                        <div className={`space-y-2 transition-opacity ${!selectedProvince && !isAdding.municipality ? 'opacity-50 pointer-events-none' : ''}`}>
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest block pl-1">Municipality</label>
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                {isAdding.municipality ? (
                                    <input 
                                        type="text" 
                                        autoFocus
                                        value={newInputs.municipality}
                                        onChange={(e) => setNewInputs(prev => ({ ...prev, municipality: e.target.value.toUpperCase() }))}
                                        placeholder="Enter new municipality..."
                                        className="flex-1 min-w-0 px-4 py-2 bg-white dark:bg-slate-900 border-2 border-blue-500 rounded-2xl outline-none dark:text-white shadow-inner font-bold"
                                    />
                                ) : (
                                    <select 
                                        value={selectedMunicipality}
                                        onChange={(e) => setSelectedMunicipality(e.target.value)}
                                        className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-blue-500 outline-none dark:text-white appearance-none"
                                    >
                                        <option value="">Select Municipality</option>
                                        {municipalities.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                )}
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <button 
                                        onClick={() => isAdding.municipality ? handleAdd('municipality') : setIsAdding(prev => ({ ...prev, municipality: true }))}
                                        className={`p-3 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center ${isAdding.municipality ? 'bg-green-500 text-white' : 'bg-blue-600 text-white'}`}
                                        title={isAdding.municipality ? "Add" : "Create New"}
                                    >
                                        {isAdding.municipality ? <FiCheck size={18} /> : <FiPlus size={18} />}
                                    </button>
                                    {isAdding.municipality && (
                                        <button 
                                            onClick={() => setIsAdding(prev => ({ ...prev, municipality: false }))}
                                            className="p-3 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 active:scale-95 transition-all flex items-center justify-center"
                                            title="Cancel"
                                        >
                                            <FiX size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* LEGISLATIVE DISTRICT LIST */}
                        <div className={`space-y-4 transition-opacity ${!selectedMunicipality && !isAdding.legislativeDistrict ? 'opacity-50 pointer-events-none' : ''}`}>
                            <div className="flex justify-between items-center px-1">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Legislative Districts</label>
                                <button 
                                    onClick={() => setIsAdding(prev => ({ ...prev, legislativeDistrict: true }))}
                                    className="text-blue-600 font-bold text-sm flex items-center gap-1 hover:underline"
                                >
                                    <FiPlus /> Add Legislative District
                                </button>
                            </div>

                            {isAdding.legislativeDistrict && (
                                <div className="flex items-center gap-2 sm:gap-3 animate-in slide-in-from-top-2 duration-200 min-w-0 mb-4">
                                    <input 
                                        type="text" 
                                        autoFocus
                                        value={newInputs.legislativeDistrict}
                                        onChange={(e) => setNewInputs(prev => ({ ...prev, legislativeDistrict: e.target.value.toUpperCase() }))}
                                        placeholder="Enter new legislative district..."
                                        className="flex-1 min-w-0 px-4 py-2 bg-white dark:bg-slate-900 border-2 border-blue-500 rounded-2xl outline-none dark:text-white shadow-inner font-bold"
                                    />
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <button 
                                            onClick={() => handleAdd('legislativeDistrict')}
                                            className="p-3 bg-green-500 text-white rounded-xl shadow-md hover:bg-green-600 active:scale-95 transition-all"
                                            title="Add"
                                        >
                                            <FiCheck size={18} />
                                        </button>
                                        <button 
                                            onClick={() => setIsAdding(prev => ({ ...prev, legislativeDistrict: false }))}
                                            className="p-3 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 active:scale-95 transition-all"
                                            title="Cancel"
                                        >
                                            <FiX size={18} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {legislativeDistricts.length > 0 ? (
                                    legislativeDistricts.map(ld => (
                                        <div key={ld} className="group flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-900 transition-all">
                                            <span className="font-bold text-slate-700 dark:text-slate-200">{ld}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-full py-8 text-center text-slate-400 font-medium bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                                        No legislative districts found.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* BARANGAY LIST */}
                        <div className={`space-y-4 transition-opacity ${!selectedMunicipality && !isAdding.barangay ? 'opacity-50 pointer-events-none' : ''}`}>
                            <div className="flex justify-between items-center px-1">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Barangays</label>
                                <button 
                                    onClick={() => setIsAdding(prev => ({ ...prev, barangay: true }))}
                                    className="text-blue-600 font-bold text-sm flex items-center gap-1 hover:underline"
                                >
                                    <FiPlus /> Add Barangay
                                </button>
                            </div>

                            {isAdding.barangay && (
                                <div className="flex items-center gap-2 sm:gap-3 animate-in slide-in-from-top-2 duration-200 min-w-0 mb-4 px-1">
                                    <input 
                                        type="text" 
                                        autoFocus
                                        value={newInputs.barangay}
                                        onChange={(e) => setNewInputs(prev => ({ ...prev, barangay: e.target.value.toUpperCase() }))}
                                        placeholder="Enter new barangay name..."
                                        className="flex-1 min-w-0 px-4 py-2 bg-white dark:bg-slate-900 border-2 border-blue-500 rounded-2xl outline-none dark:text-white shadow-inner font-bold"
                                    />
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <button 
                                            onClick={() => handleAdd('barangay')}
                                            className="p-3 bg-green-500 text-white rounded-xl shadow-md hover:bg-green-600 active:scale-95 transition-all"
                                            title="Add"
                                        >
                                            <FiCheck size={18} />
                                        </button>
                                        <button 
                                            onClick={() => setIsAdding(prev => ({ ...prev, barangay: false }))}
                                            className="p-3 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 active:scale-95 transition-all"
                                            title="Cancel"
                                        >
                                            <FiX size={18} />
                                        </button>
                                    </div>
                                </div>
                            )}

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
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                {showConfirm && confirmData && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
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
                    </div>
                )}
            </div>
            <BottomNav />
        </PageTransition>
    );
};

export default LocationManagement;
