import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext'; // Import useAuth
import { FiLogOut } from 'react-icons/fi';
import { api } from "../lib/api"; // Import Icon

const SuperUserSelector = () => {
    const navigate = useNavigate();
    const { logout, confirmLogout } = useAuth();

    // --- STATE ---
    const [loading, setLoading] = useState(false);

    // Regional / SDO State
    const [selectedRegion, setSelectedRegion] = useState('');
    const [selectedDivision, setSelectedDivision] = useState('');

    // Engineer State
    const [engRegion, setEngRegion] = useState('');
    const [engDivision, setEngDivision] = useState('');

    // LGU State
    const [lguRegion, setLguRegion] = useState('');
    const [lguProvince, setLguProvince] = useState('');
    const [lguMunicipality, setLguMunicipality] = useState('');

    // --- API-DRIVEN LIST STATE ---
    const [regions, setRegions] = useState([]);
    const [sdoDivisions, setSdoDivisions] = useState([]);
    const [engDivisions, setEngDivisions] = useState([]);
    const [lguProvinces, setLguProvinces] = useState([]);
    const [lguMunicipalities, setLguMunicipalities] = useState([]);

    // --- FETCH REGIONS ON MOUNT (from schools table) ---
    useEffect(() => {
        fetch(api(`/locations/regions`))
            .then(res => res.json())
            .then(data => {
                const options = data || [];
                if (!options.includes('BLANK REGION')) options.unshift('BLANK REGION');
                setRegions(options);
            })
            .catch(err => console.error("Failed to load regions:", err));
    }, []);

    // --- FETCH SDO DIVISIONS when selectedRegion changes ---
    useEffect(() => {
        setSdoDivisions([]);
        setSelectedDivision('');
        if (selectedRegion) {
            fetch(api(`/locations/divisions?region=${encodeURIComponent(selectedRegion)}`))
                .then(res => res.json())
                .then(data => {
                    const options = data || [];
                    if (selectedRegion === 'BLANK REGION' && !options.includes('BLANK DIVISION')) options.unshift('BLANK DIVISION');
                    setSdoDivisions(options);
                })
                .catch(console.error);
        }
    }, [selectedRegion]);

    // --- FETCH ENGINEER DIVISIONS when engRegion changes ---
    useEffect(() => {
        setEngDivisions([]);
        setEngDivision('');
        if (engRegion) {
            fetch(api(`/locations/divisions?region=${encodeURIComponent(engRegion)}`))
                .then(res => res.json())
                .then(data => {
                    const options = data || [];
                    if (engRegion === 'BLANK REGION' && !options.includes('BLANK DIVISION')) options.unshift('BLANK DIVISION');
                    setEngDivisions(options);
                })
                .catch(console.error);
        }
    }, [engRegion]);

    // --- FETCH LGU PROVINCES when lguRegion changes ---
    useEffect(() => {
        setLguProvinces([]);
        setLguProvince('');
        setLguMunicipality('');
        if (lguRegion) {
            fetch(api(`/locations/provinces?region=${encodeURIComponent(lguRegion)}`))
                .then(res => res.json())
                .then(data => {
                    const options = data || [];
                    if (lguRegion === 'BLANK REGION' && !options.includes('BLANK PROVINCE')) options.unshift('BLANK PROVINCE');
                    setLguProvinces(options);
                })
                .catch(console.error);
        }
    }, [lguRegion]);

    // --- FETCH LGU MUNICIPALITIES when lguProvince changes ---
    useEffect(() => {
        setLguMunicipalities([]);
        setLguMunicipality('');
        if (lguRegion && lguProvince) {
            fetch(api(`/locations/municipalities-by-province?region=${encodeURIComponent(lguRegion)}&province=${encodeURIComponent(lguProvince)}`))
                .then(res => res.json())
                .then(data => {
                    const options = data || [];
                    if (lguProvince === 'BLANK PROVINCE' && !options.includes('BLANK MUNICIPALITY')) options.unshift('BLANK MUNICIPALITY');
                    setLguMunicipalities(options);
                })
                .catch(console.error);
        }
    }, [lguRegion, lguProvince]);

    const handleSelection = async (role, specificLocation = null, extraData = {}) => {
        setLoading(true);

        // 1. Set Context
        sessionStorage.setItem('impersonatedRole', role);
        sessionStorage.setItem('isViewingAsSuperUser', 'true');

        // Clear previous impersonation keys to avoid pollution
        sessionStorage.removeItem('impersonatedRegion');
        sessionStorage.removeItem('impersonatedDivision');
        sessionStorage.removeItem('impersonatedLocation');
        sessionStorage.removeItem('impersonatedProvince');
        sessionStorage.removeItem('impersonatedMunicipality');

        // 2. Role Specific Logic
        if (role === 'Regional Office') {
            sessionStorage.setItem('impersonatedLocation', specificLocation); // "Region I"
            sessionStorage.setItem('impersonatedRegion', specificLocation);
        } else if (role === 'School Division Office') {
            sessionStorage.setItem('impersonatedRegion', extraData.region);
            sessionStorage.setItem('impersonatedLocation', specificLocation); // Division
            sessionStorage.setItem('impersonatedDivision', specificLocation);
        } else if (role === 'DepEd Engineer') {
            // For Engineer, we treat them like SDO but with different dashboard
            sessionStorage.setItem('impersonatedRegion', extraData.region);
            sessionStorage.setItem('impersonatedLocation', specificLocation); // Division
            sessionStorage.setItem('impersonatedDivision', specificLocation);
        } else if (role === 'Local Government Unit') {
            sessionStorage.setItem('impersonatedRegion', extraData.region);
            sessionStorage.setItem('impersonatedProvince', extraData.province);
            sessionStorage.setItem('impersonatedMunicipality', specificLocation); // Municipality
            sessionStorage.setItem('impersonatedLocation', specificLocation); // Primary location
        } else if (role === 'School Head') {
            if (extraData.uid) {
                sessionStorage.setItem('impersonatedUid', extraData.uid);
                sessionStorage.setItem('impersonatedLocation', specificLocation);
                sessionStorage.setItem('impersonatedRole', role);
            } else {
                sessionStorage.setItem('isGenericMode', 'true');
            }
        }

        // 3. Navigate
        setTimeout(() => {
            switch (role) {
                case 'Central Office':
                    navigate('/monitoring-dashboard');
                    break;
                case 'Regional Office':
                case 'School Division Office':
                    navigate('/monitoring-dashboard');
                    break;
                case 'School Head':
                    const shPath = extraData.uid ? `/my-activity?uid=${extraData.uid}` : '/my-activity';
                    navigate(shPath);
                    break;
                case 'DepEd Engineer':
                    navigate('/engineer-dashboard');
                    break;
                case 'Local Government Unit':
                    navigate('/lgu-projects'); // Direct to LGU Project List
                    break;
                case 'Masterlist':
                    navigate('/psip');
                    break;
                case 'EFD':
                    navigate('/efd-dashboard');
                    break;
                case 'Finance':
                    navigate('/finance-dashboard');
                    break;
                case 'Implementing Agency':
                    navigate('/agency-dashboard');
                    break;
                default:
                    break;
            }
            setLoading(false);
        }, 500);
    };

    const handleLogout = () => {
        confirmLogout();
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-700 to-slate-200 flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-blue-100 opacity-90"></div>
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-300/20 rounded-full blur-[100px]"></div>

            {/* Logout Button */}
            <button
                onClick={handleLogout}
                className="absolute top-4 right-4 md:top-6 md:right-6 flex items-center gap-2 bg-white/80 backdrop-blur-md text-slate-600 px-3 py-1.5 md:px-4 md:py-2 rounded-xl shadow-sm hover:bg-slate-100 hover:text-red-500 transition-all font-medium z-50 border border-slate-200 text-xs md:text-sm"
            >
                <FiLogOut />
                <span>Log Out</span>
            </button>

            <div className="relative z-10 max-w-6xl w-full">
                <div className="text-center mb-10">
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-800 tracking-tight">Super User Access</h1>
                    <p className="text-slate-500 mt-2 font-medium">Select a role to impersonate or view.</p>
                </div>

                <div className="space-y-12">
                    {/* SECTION: Super User 2.0 Specific */}
                    <section>
                        <div className="flex items-center gap-4 mb-8">
                            <h2 className="text-lg sm:text-xl font-bold text-slate-700 whitespace-nowrap">Super User 2.0 Exclusive</h2>
                            <div className="h-px bg-slate-200 w-full"></div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                            {/* NEW CARD: National HROD Dashboard */}
                            <motion.div whileHover={{ scale: 1.02 }} className="bg-gradient-to-br from-[#10346B] to-[#004A99] shadow-2xl rounded-2xl p-6 flex flex-col items-center text-center text-white border border-white/20">
                                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4 text-white">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v16a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                </div>
                                <h3 className="text-xl font-bold mb-2 uppercase tracking-tight italic">HROD Dashboard</h3>
                                <p className="text-sm text-blue-100/70 mb-6 flex-grow">National Management & Trends</p>
                                <button onClick={() => navigate('/educational-dashboard')} className="w-full py-2 bg-white text-[#10346B] rounded-lg font-black hover:bg-blue-50 transition">
                                    Launch HROD
                                </button>
                            </motion.div>

                            {/* NEW CARD: National Project Summary Dashboard */}
                            <motion.div whileHover={{ scale: 1.02 }} className="bg-gradient-to-br from-indigo-900 to-indigo-700 shadow-2xl rounded-2xl p-6 flex flex-col items-center text-center text-white border border-white/20">
                                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4 text-white">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                </div>
                                <h3 className="text-xl font-bold mb-2 uppercase tracking-tight italic">Infra Project Summary</h3>
                                <p className="text-sm text-blue-100/70 mb-6 flex-grow">National Infrastructure Status</p>
                                <button onClick={() => navigate('/project-summary-dashboard')} className="w-full py-2 bg-emerald-500 text-white rounded-lg font-black hover:bg-emerald-600 transition">
                                    Launch Infra
                                </button>
                            </motion.div>
                        </div>

                    </section>

                    {/* SECTION: General Access */}
                    <section>
                        <div className="flex items-center gap-4 mb-8">
                            <h2 className="text-lg sm:text-xl font-bold text-slate-700 whitespace-nowrap">Operational Access</h2>
                            <div className="h-px bg-slate-200 w-full"></div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                            {/* CARD 1: Central Office */}
                            <motion.div whileHover={{ scale: 1.02 }} className="bg-white/80 backdrop-blur-xl border border-white/50 shadow-xl rounded-2xl p-6 flex flex-col items-center text-center">
                                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 text-blue-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2">Central Office</h3>
                                <p className="text-sm text-slate-500 mb-6 flex-grow">Operational Monitoring Portal</p>
                                <button onClick={() => handleSelection('Central Office')} className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition">
                                    Select
                                </button>
                            </motion.div>


                            {/* CARD 2: Regional Office */}
                            <motion.div whileHover={{ scale: 1.02 }} className="bg-white/80 backdrop-blur-xl border border-white/50 shadow-xl rounded-2xl p-6 flex flex-col items-center text-center">
                                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4 text-indigo-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" /></svg>
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2">Regional Office</h3>
                                <p className="text-sm text-slate-500 mb-4">View Regional Data</p>
                                <select
                                    className="w-full p-2 mb-4 border rounded-lg bg-slate-50 text-sm"
                                    value={selectedRegion}
                                    onChange={(e) => { setSelectedRegion(e.target.value); setSelectedDivision(''); }}
                                >
                                    <option value="">Select Region</option>
                                    {regions.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                                <button
                                    onClick={() => handleSelection('Regional Office', selectedRegion)}
                                    disabled={!selectedRegion}
                                    className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition disabled:opacity-50"
                                >
                                    Go to Region
                                </button>
                            </motion.div>

                            {/* CARD 3: SDO */}
                            <motion.div whileHover={{ scale: 1.02 }} className="bg-white/80 backdrop-blur-xl border border-white/50 shadow-xl rounded-2xl p-6 flex flex-col items-center text-center">
                                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4 text-purple-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2">SDO</h3>
                                <p className="text-sm text-slate-500 mb-4">View Division Data</p>

                                <select
                                    className="w-full p-2 mb-2 border rounded-lg bg-slate-50 text-sm"
                                    value={selectedRegion}
                                    onChange={(e) => { setSelectedRegion(e.target.value); setSelectedDivision(''); }}
                                >
                                    <option value="">Select Region First</option>
                                    {regions.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>

                                <select
                                    className="w-full p-2 mb-4 border rounded-lg bg-slate-50 text-sm"
                                    value={selectedDivision}
                                    onChange={(e) => setSelectedDivision(e.target.value)}
                                    disabled={!selectedRegion || sdoDivisions.length === 0}
                                >
                                    <option value="">Select Division</option>
                                    {sdoDivisions.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>

                                <button
                                    onClick={() => handleSelection('School Division Office', selectedDivision, { region: selectedRegion })}
                                    disabled={!selectedDivision}
                                    className="w-full py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition disabled:opacity-50"
                                >
                                    Go to Division
                                </button>
                            </motion.div>

                            {/* CARD 4: School Head */}
                            <motion.div whileHover={{ scale: 1.02 }} className="bg-white/80 backdrop-blur-xl border border-white/50 shadow-xl rounded-2xl p-6 flex flex-col items-center text-center">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2">School Head</h3>
                                <p className="text-sm text-slate-500 mb-6 flex-grow">View Generic School Dashboard</p>
                                <button onClick={() => handleSelection('School Head', '999990', { uid: 'dummy-sh-999990' })} className="w-full py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition">
                                    Enter View
                                </button>
                            </motion.div>

                            {/* CARD 5: LGU */}
                            <motion.div whileHover={{ scale: 1.02 }} className="bg-white/80 backdrop-blur-xl border border-white/50 shadow-xl rounded-2xl p-6 flex flex-col items-center text-center col-span-1 min-h-[300px]">
                                <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mb-4 text-teal-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2">LGU</h3>
                                <p className="text-sm text-slate-500 mb-4">View Local Projects</p>

                                <div className="w-full space-y-2 mb-4">
                                    <select
                                        className="w-full p-2 border rounded-lg bg-slate-50 text-sm"
                                        value={lguRegion}
                                        onChange={(e) => {
                                            setLguRegion(e.target.value);
                                            setLguProvince('');
                                            setLguMunicipality('');
                                        }}
                                    >
                                        <option value="">Select Region</option>
                                        {regions.map(r => (
                                            <option key={r} value={r}>{r}</option>
                                        ))}
                                    </select>

                                    <select
                                        className="w-full p-2 border rounded-lg bg-slate-50 text-sm"
                                        value={lguProvince}
                                        onChange={(e) => {
                                            setLguProvince(e.target.value);
                                            setLguMunicipality('');
                                        }}
                                        disabled={!lguRegion || lguProvinces.length === 0}
                                    >
                                        <option value="">Select Province</option>
                                        {lguProvinces.map(p => (
                                            <option key={p} value={p}>{p}</option>
                                        ))}
                                    </select>

                                    <select
                                        className="w-full p-2 border rounded-lg bg-slate-50 text-sm"
                                        value={lguMunicipality}
                                        onChange={(e) => setLguMunicipality(e.target.value)}
                                        disabled={!lguProvince || lguMunicipalities.length === 0}
                                    >
                                        <option value="">Select Municipality</option>
                                        {lguMunicipalities.map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="mt-auto w-full">
                                    <button
                                        onClick={() => handleSelection('Local Government Unit', lguMunicipality, { region: lguRegion, province: lguProvince })}
                                        disabled={!lguMunicipality}
                                        className="w-full py-2 bg-teal-600 text-white rounded-lg font-bold hover:bg-teal-700 transition disabled:opacity-50"
                                    >
                                        Enter LGU View
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    </section>

                    {/* SECTION: Infrastructure Monitoring */}
                    <section>
                        <div className="flex items-center gap-4 mb-8">
                            <h2 className="text-lg sm:text-xl font-bold text-slate-700 whitespace-nowrap">Infrastructure Monitoring</h2>
                            <div className="h-px bg-slate-200 w-full"></div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                            {/* CARD: 2026 Infrastructure Priorities */}
                            <motion.div whileHover={{ scale: 1.02 }} className="bg-white/80 backdrop-blur-xl border border-white/50 shadow-xl rounded-2xl p-6 flex flex-col items-center text-center col-span-1 min-h-[300px]">
                                <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mb-4 text-pink-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2">2026 Infrastructure Priorities</h3>
                                <p className="text-sm text-slate-500 mb-4 flex-grow">Partnership Projects Prototype</p>

                                <div className="mt-auto w-full">
                                    <button
                                        onClick={() => handleSelection('Masterlist')}
                                        className="w-full py-2 bg-pink-600 text-white rounded-lg font-bold hover:bg-pink-700 transition"
                                    >
                                        Enter 2026 Infrastructure Priorities View
                                    </button>
                                </div>
                            </motion.div>

                            {/* CARD: HRODI Engineer Dashboard */}
                            <motion.div whileHover={{ scale: 1.02 }} className="bg-white/80 backdrop-blur-xl border border-white/50 shadow-xl rounded-2xl p-6 flex flex-col items-center text-center">
                                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 text-blue-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2">BEFF Monitoring</h3>
                                <p className="text-sm text-slate-500 mb-6 flex-grow">Human Resource and Organizational Development</p>
                                <button onClick={() => handleSelection('EFD')} className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition">
                                    Select BEFF Monitoring Dashboard
                                </button>
                            </motion.div>

                            {/* CARD: Finance Dashboard */}
                            <motion.div whileHover={{ scale: 1.02 }} className="bg-white/80 backdrop-blur-xl border border-white/50 shadow-xl rounded-2xl p-6 flex flex-col items-center text-center col-span-1 min-h-[300px]">
                                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4 text-emerald-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2">Finance</h3>
                                <p className="text-sm text-slate-500 mb-4 flex-grow">Manage Project Financials & Tranches</p>

                                <div className="mt-auto w-full">
                                    <button
                                        onClick={() => handleSelection('Finance')}
                                        className="w-full py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition"
                                    >
                                        Enter Finance Dashboard
                                    </button>
                                </div>
                            </motion.div>

                            {/* CARD: Implementing Agency Dashboard */}
                            <motion.div whileHover={{ scale: 1.02 }} className="bg-white/80 backdrop-blur-xl border border-white/50 shadow-xl rounded-2xl p-6 flex flex-col items-center text-center col-span-1 min-h-[300px]">
                                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 text-blue-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2">Implementing Agency</h3>
                                <p className="text-sm text-slate-500 mb-4 flex-grow">Track MOA project distribution & external partners</p>

                                <div className="mt-auto w-full">
                                    <button
                                        onClick={() => handleSelection('Implementing Agency')}
                                        className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition"
                                    >
                                        Enter Agency Dashboard
                                    </button>
                                </div>
                            </motion.div>

                            {/* CARD: DepEd Engineer */}
                            <motion.div whileHover={{ scale: 1.02 }} className="bg-white/80 backdrop-blur-xl border border-white/50 shadow-xl rounded-2xl p-6 flex flex-col items-center text-center min-h-[300px]">
                                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4 text-orange-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2">DepEd Engineer</h3>
                                <p className="text-sm text-slate-500 mb-4">View Infra Projects</p>

                                <select
                                    className="w-full p-2 mb-2 border rounded-lg bg-slate-50 text-sm"
                                    value={engRegion}
                                    onChange={(e) => { setEngRegion(e.target.value); setEngDivision(''); }}
                                >
                                    <option value="">Select Region</option>
                                    {regions.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>

                                <select
                                    className="w-full p-2 mb-6 border rounded-lg bg-slate-50 text-sm"
                                    value={engDivision}
                                    onChange={(e) => setEngDivision(e.target.value)}
                                    disabled={!engRegion || engDivisions.length === 0}
                                >
                                    <option value="">Select Division</option>
                                    {engDivisions.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>

                                <div className="mt-auto w-full">
                                    <button
                                        onClick={() => handleSelection('DepEd Engineer', engDivision, { region: engRegion })}
                                        disabled={!engDivision}
                                        className="w-full py-2 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 transition disabled:opacity-50"
                                    >
                                        Enter Dashboard
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default SuperUserSelector;
