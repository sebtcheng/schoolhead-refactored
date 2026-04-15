import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiMapPin, FiActivity, FiShield, FiCloudRain, FiTruck, FiNavigation, FiZap, FiAlertTriangle, FiCheck, FiSave, FiUnlock, FiWifiOff } from 'react-icons/fi';
import { FaBus, FaCarSide, FaWalking, FaWater, FaMountain, FaClinicMedical, FaSignal, FaMapMarkerAlt } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import SchoolLocation from '../../forms/SchoolLocation';
import SuccessModal from '../SuccessModal';
import BottomNav from '../../modules/BottomNav';
import { saveUnitDraft, getUnitDraft, clearUnitDraft, getModularOutbox } from "../../db";
import { useAuth } from "../../context/AuthContext";
import UnitRemarkAlert from "./UnitRemarkAlert";

const Unit8SchoolLocation = ({ targetSchoolId, isReadOnly: propReadOnly }) => {
    const navigate = useNavigate();
    const formRef = React.useRef();
    const [initialDraft, setInitialDraft] = React.useState(null);
    const [showWelcomeBack, setShowWelcomeBack] = React.useState(false);
    const [locationData, setLocationData] = React.useState(null);
    const [iern, setIern] = React.useState("");
    const [showDraftModal, setShowDraftModal] = React.useState(false);
    const [showSuccess, setShowSuccess] = React.useState(false);
    const [isReadOnly, setIsReadOnly] = React.useState(propReadOnly || false);
    const [loading, setLoading] = React.useState(true);
    const [showOfflineSuccess, setShowOfflineSuccess] = React.useState(false);
    const [pendingUnit8, setPendingUnit8] = React.useState(null);

    const { user, authLoading } = useAuth();
    const schoolId = targetSchoolId || user?.school_id || localStorage.getItem('schoolId');

    useEffect(() => {
        if (propReadOnly !== undefined) {
            setIsReadOnly(propReadOnly);
        }
    }, [propReadOnly]);

    const hasCheckedCompletion = React.useRef(false);

    useEffect(() => {
        const init = async () => {
            if (authLoading) return;
            if (!schoolId) {
                setLoading(false);
                return;
            }

            try {
                // 1. SYNC CENTER LOOKAHEAD
                const outbox = await getModularOutbox();
                const pendingU8 = outbox.find(o => o.unitId === 8 && o.schoolId === schoolId);
                if (pendingU8) setPendingUnit8(pendingU8);

                // Initial completion check - only run once on mount
                let isUnitCompleted = false;
                if (!hasCheckedCompletion.current) {
                    const storedProgress = localStorage.getItem('quest_progress');
                    const progress = storedProgress ? JSON.parse(storedProgress) : null;
                    isUnitCompleted = progress?.completedUnits?.includes(8);

                    if (isUnitCompleted && !propReadOnly && !isReadOnly) {
                        setIsReadOnly(true);
                    }
                    hasCheckedCompletion.current = true;
                }

                // If read-only, fetch the actual data for the dashboard
                const effectiveReadOnly = propReadOnly || isReadOnly || isUnitCompleted || (!!pendingU8);
                if (pendingU8) {
                    // MASTER PRECEDENCE: SYNC CENTER
                    setLocationData(pendingU8.payload);
                    if (pendingU8.payload.iern) setIern(pendingU8.payload.iern);
                    if (!propReadOnly) setIsReadOnly(true); // Treat as read-only if it's in outbox
                } else if (effectiveReadOnly) {
                    const res = await fetch(`/api/school-location/${schoolId}`);
                    const result = await res.json();
                    if (result.success && result.data) {
                        setLocationData(result.data);
                        if (result.data.iern) setIern(result.data.iern);
                    }
                }

                // Check for Draft (only if not viewing a completed unit)
                if (!effectiveReadOnly && !pendingU8) {
                    // Also fetch IERN from the main school record to ensure we have it for the form
                    const schoolRes = await fetch(`/api/ph_schools/${schoolId}?t=${Date.now()}`);
                    if (schoolRes.ok) {
                        const schoolData = await schoolRes.json();
                        if (schoolData.exists && schoolData.data && schoolData.data.iern) {
                            setIern(schoolData.data.iern);
                        }
                    }

                    const draft = await getUnitDraft(8, schoolId);
                    if (draft) {
                        setInitialDraft(draft);
                        setShowWelcomeBack(true);
                        setTimeout(() => setShowWelcomeBack(false), 3000);
                    }
                }
            } catch (err) {
                console.error("Initialization error:", err);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [schoolId, propReadOnly, isReadOnly, authLoading]);

    const handleBack = () => {
        navigate('/modular-dashboard');
    };

    const handleSaveDraftAndExit = async () => {
        if (!schoolId || !formRef.current) return;

        const draftData = {
            formData: formRef.current.getFormData(),
            currentStep: formRef.current.getCurrentStep()
        };
        await saveUnitDraft(8, schoolId, draftData);
        navigate('/modular-dashboard');
    };

    const handleSaveSuccess = async () => {
        // Update localStorage so ModularDashboard immediately reflects completion
        const stored = localStorage.getItem('quest_progress');
        let progress = stored ? JSON.parse(stored) : { completedUnits: [], xp: 0 };
        if (!progress.completedUnits.includes(8)) {
            progress.completedUnits.push(8);
            progress.xp = (progress.xp || 0) + 500;
            localStorage.setItem('quest_progress', JSON.stringify(progress));
        }

        // Mandatory Sync to backend on every successful save to update timestamp
        fetch('/api/user/progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ unitId: 8, schoolId })
        }).catch(e => console.error("[Unit 8 Sync Error]:", e));

        if (schoolId) await clearUnitDraft(8, schoolId);
        
        if (!navigator.onLine) {
            setShowOfflineSuccess(true);
        } else {
            setShowSuccess(true);
        }
    };

    const SummaryDashboard = () => {
        if (!locationData) return null;

        const data = locationData;
        
        // Parse JSON fields if they are strings
        const tryParse = (val) => {
            if (!val) return [];
            if (typeof val === 'string') {
                try { return JSON.parse(val); } catch (e) { return []; }
            }
            return val;
        };

        const transportModes = tryParse(data.transportation_modes);
        const waterProximity = tryParse(data.water_proximity);
        const calamities = tryParse(data.natural_calamities);
        const hazards = tryParse(data.hazards_experienced);
        const threats = tryParse(data.anthropogenic_threats);

        const refPoints = [
            { label: "Hospital", mins: data.emergency_response_mins, km: data.proximity_hospital_km, icon: <FaClinicMedical /> },
            { label: "Bgy Hall", mins: data.proximity_brgy_hall_mins, km: data.proximity_brgy_hall_km, icon: <FaMapMarkerAlt /> },
            { label: "Muni Hall", mins: data.proximity_muni_hall_mins, km: data.proximity_muni_hall_km, icon: <FaMapMarkerAlt /> },
            { label: "SDO", mins: data.proximity_sdo_mins, km: data.proximity_sdo_km, icon: <FaMapMarkerAlt /> },
            { label: "Clinic", mins: data.proximity_clinic_mins, km: data.proximity_clinic_km, icon: <FaClinicMedical /> },
            { label: "Terminal", mins: data.proximity_terminal_mins, km: data.proximity_terminal_km, icon: <FaBus /> },
            { label: "Highway", mins: data.proximity_highway_mins, km: data.proximity_highway_km, icon: <FaCarSide /> }
        ];

        const riskColor = data.risk_index > 7 ? 'text-rose-600' : data.risk_index > 4 ? 'text-amber-600' : 'text-emerald-600';
        const riskBg = data.risk_index > 7 ? 'bg-rose-50' : data.risk_index > 4 ? 'bg-amber-50' : 'bg-emerald-50';

        return (
            <div className="space-y-10 pb-40 px-4">
                <UnitRemarkAlert unitId="u8" schoolId={schoolId} />
                {/* SHA Header Section */}
                <div className="text-center">
                    <div className={`w-24 h-24 mx-auto mb-6 rounded-[2.5rem] flex flex-col items-center justify-center shadow-xl ${riskBg}`}>
                        <span className={`text-4xl font-black ${riskColor}`}>{data.risk_index || '0'}</span>
                        <span className={`text-[8px] font-black uppercase tracking-widest ${riskColor} opacity-60`}>Risk Index</span>
                    </div>
                    <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-[0.2em] mb-3 shadow-sm border border-indigo-100">
                        Unit 8 • School Terrain
                    </span>
                    <h1 className="text-3xl font-black text-slate-800 leading-tight tracking-tight px-4">School Terrain</h1>
                    <p className="text-slate-500 font-medium mt-2 italic px-8">"Environmental & structural variables"</p>
                </div>

                {/* Top Metrics Grid */}
                <div className="grid grid-cols-2 gap-4 px-4">
                    <div className="bg-slate-900 rounded-[2.5rem] p-6 text-white shadow-xl relative overflow-hidden group">
                         <div className="absolute -right-4 -bottom-4 text-6xl opacity-10 rotate-12 group-hover:rotate-0 transition-transform duration-700">📶</div>
                         <p className="text-indigo-300 text-[8px] font-black uppercase tracking-widest mb-1">Cellular Status</p>
                         <div className="flex items-baseline gap-1">
                             <span className="text-xl font-black">{data.cellular_coverage || 'Unknown'}</span>
                         </div>
                    </div>
                    <div className="bg-indigo-600 rounded-[2.5rem] p-6 text-white shadow-xl relative overflow-hidden group">
                         <div className="absolute -right-4 -bottom-4 text-6xl opacity-10 rotate-12 group-hover:rotate-0 transition-transform duration-700">🛣️</div>
                         <p className="text-indigo-100 text-[8px] font-black uppercase tracking-widest mb-1">Road Paved (from school to municipal hall)</p>
                         <div className="flex items-baseline gap-1">
                             <span className="text-3xl font-black">{data.road_paved_pct || '0'}%</span>
                         </div>
                    </div>
                </div>

                {/* Transport Access Section */}
                <section className="px-4 space-y-4">
                    <div className="flex items-center gap-2 px-2">
                        <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Transport Access</h3>
                    </div>
                    <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm">
                        <div className="flex flex-wrap gap-2 mb-6">
                            {transportModes.map(mode => (
                                <span key={mode} className="px-3 py-1.5 bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-wider rounded-xl border border-blue-100 flex items-center gap-2">
                                    <FiTruck className="w-3 h-3" /> {mode}
                                </span>
                            ))}
                            {transportModes.length === 0 && <span className="text-slate-400 italic text-xs">No modes recorded</span>}
                        </div>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                    <span>Public Availability</span>
                                    <span>Level {data.public_transpo_availability}/5</span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500" style={{ width: `${(data.public_transpo_availability / 5) * 100}%` }} />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                    <span>Road Passability</span>
                                    <span>{data.road_passable_public_transpo_pct}%</span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500" style={{ width: `${data.road_passable_public_transpo_pct}%` }} />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Geography & Hazards Section */}
                <section className="px-4 space-y-4">
                    <div className="flex items-center gap-2 px-2">
                        <div className="w-1.5 h-6 bg-orange-500 rounded-full" />
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Geography & Hazards</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                        {(data.near_cliff_ravine || data.near_water || data.river_crossing_on_foot) ? (
                            <>
                                {data.near_cliff_ravine && (
                                    <div className="bg-white rounded-[2rem] p-5 border border-orange-100 flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
                                            <FaMountain className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-slate-800 text-sm italic">Near Cliff/Ravine</h4>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{data.road_cliff_pct}% of route exposure</p>
                                        </div>
                                    </div>
                                )}
                                {data.near_water && waterProximity.length > 0 && (
                                    <div className="bg-white rounded-[2rem] p-5 border border-blue-100">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                                <FaWater className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h4 className="font-black text-slate-800 text-sm italic">Proximate to Water</h4>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{waterProximity.length} Bodies recorded</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {waterProximity.map(w => (
                                                <div key={w.type} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{w.type}</p>
                                                    <p className="text-xs font-black text-slate-700">{w.distance_km} KM Away</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {data.river_crossing_on_foot && (
                                    <div className="bg-indigo-50 rounded-[2rem] p-5 border border-indigo-100 flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-white text-indigo-600 flex items-center justify-center shadow-sm">
                                            <FaWalking className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-slate-800 text-sm italic">River Crossing (Foot)</h4>
                                            <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-0.5">{data.river_crossing_count} Crossings required</p>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="bg-emerald-50 rounded-[2rem] p-8 text-center border border-emerald-100">
                                <span className="text-2xl mb-2 block">⛰️</span>
                                <h4 className="text-emerald-800 font-black text-sm italic uppercase tracking-tight">Stable Geography</h4>
                                <p className="text-emerald-600 text-[10px] font-bold mt-1 uppercase tracking-widest">No critical geographic hazards reported</p>
                            </div>
                        )}
                        
                        {hazards.length > 0 && (
                            <div className="bg-white rounded-[2rem] p-6 border border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Hazards Encountered</p>
                                <div className="flex flex-wrap gap-2">
                                    {hazards.map(h => (
                                        <span key={h} className="px-3 py-1 bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-wider rounded-lg">
                                            {h}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* Point of Reference Services */}
                <section className="px-4 space-y-4">
                    <div className="flex items-center gap-2 px-2">
                        <div className="w-1.5 h-6 bg-slate-800 rounded-full" />
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Proximity Matrix</h3>
                    </div>
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">nearest Critical Services</span>
                        </div>
                        <div className="p-2 overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-slate-50">
                                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Service</th>
                                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Time</th>
                                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Distance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {refPoints.map(point => (
                                        <tr key={point.label} className="group hover:bg-indigo-50/30 transition-colors">
                                            <td className="px-4 py-4 flex items-center gap-3">
                                                <div className="text-slate-400 group-hover:text-indigo-500 transition-colors">{point.icon}</div>
                                                <span className="font-black text-slate-800 text-xs">{point.label}</span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className="font-bold text-slate-600 text-[11px]">{point.mins || 0}m</span>
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <span className="font-black text-indigo-600 text-[11px]">{point.km || 0}km</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                {/* Calamities & Threats */}
                <section className="px-4 space-y-4">
                    <div className="flex items-center gap-2 px-2">
                        <div className="w-1.5 h-6 bg-rose-500 rounded-full" />
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Stability & Threats</h3>
                    </div>
                    <div className="space-y-4">
                        {calamities.length > 0 && (
                            <div className="bg-white rounded-[2.5rem] p-6 border border-rose-100 shadow-sm">
                                <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-4">Natural Calamities (Past 6mo)</h4>
                                <div className="space-y-3">
                                    {calamities.map(c => (
                                        <div key={c.type} className="flex justify-between items-center bg-rose-50/50 p-4 rounded-2xl">
                                            <span className="font-black text-slate-800 text-xs uppercase">{c.type}</span>
                                            <span className="bg-white px-3 py-1 rounded-lg text-[10px] font-black text-rose-600 border border-rose-100 shadow-sm">{c.incidences} INCIDENCES</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {threats.length > 0 && (
                            <div className="bg-slate-900 rounded-[2.5rem] p-6 border border-slate-800 shadow-xl">
                                <h4 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-4">Anthropogenic Threats</h4>
                                <div className="space-y-3">
                                    {threats.map(t => (
                                        <div key={t.type} className="flex justify-between items-center bg-white/5 p-4 rounded-2xl">
                                            <span className="font-black text-white text-xs uppercase tracking-tight">{t.type}</span>
                                            <span className="bg-white/10 px-3 py-1 rounded-lg text-[10px] font-black text-indigo-200 border border-white/5">{t.incidences} CASES</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {calamities.length === 0 && threats.length === 0 && (
                            <div className="bg-white rounded-[2rem] p-8 text-center border border-slate-100 shadow-sm opacity-60">
                                <FiShield className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest italic">Community Security Profile: High Stability</p>
                            </div>
                        )}
                    </div>
                </section>


            </div>
        );
    };

    return (
        <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="min-h-screen bg-slate-50/50 font-sans"
        >
            <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-4">
                <div className="max-w-md mx-auto flex items-center justify-between">
                    <button onClick={() => navigate("/modular-dashboard")} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                        <FiArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex-1 text-center">
                        <div className="text-[10px] font-black tracking-widest text-[#004A99] uppercase">Unit 8</div>
                        <h1 className="text-sm font-black text-gray-800 uppercase tracking-tight">School Terrain</h1>
                    </div>
                    {!propReadOnly && (
                        <button onClick={() => setShowDraftModal(true)} className="p-2 -mr-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                            <FiSave className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </header>

            <AnimatePresence>
                {showWelcomeBack && (
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                        className="fixed top-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-5 py-2.5 rounded-full shadow-2xl text-[13px] font-bold flex items-center gap-2 z-[60]">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-ping" />
                        Recovered your draft!
                    </motion.div>
                )}
            </AnimatePresence>

            <main className="max-w-md mx-auto pt-6 px-4">
                <UnitRemarkAlert unitId="u8" schoolId={schoolId} />
                {!loading ? (
                    isReadOnly ? (
                        <SummaryDashboard />
                    ) : (
                        <div className="px-4">
                            <SchoolLocation 
                                ref={formRef}
                                schoolId={schoolId} 
                                iern={iern}
                                onSaveSuccess={handleSaveSuccess}
                                onSaveDraft={handleSaveDraftAndExit}
                                initialValues={initialDraft}
                                isReadOnly={false}
                            />
                        </div>
                    )
                ) : (
                    <div className="flex flex-col items-center justify-center p-20">
                        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
            </main>

            {!propReadOnly && isReadOnly && (
                <div className="fixed bottom-0 left-0 w-full p-6 pb-10 bg-white/80 backdrop-blur-md border-t border-slate-100 flex justify-center z-[60]">
                    <div className="w-full max-w-sm flex gap-3 pointer-events-auto">
                        <button
                            onClick={() => setIsReadOnly(false)}
                            className="flex-1 py-5 rounded-[2rem] bg-indigo-600 text-white font-black text-xl shadow-xl shadow-indigo-100/50 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-3"
                        >
                            <FiUnlock className="w-6 h-6" />
                            <span>Unlock to Audit</span>
                        </button>
                    </div>
                </div>
            )}

            <AnimatePresence>
                {showDraftModal && (
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[100] flex items-end justify-center pointer-events-auto">
                        <motion.div initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="bg-white w-full max-w-md rounded-t-[3rem] p-10 pb-12 shadow-2xl relative text-left">
                            <div className="w-16 h-1.5 bg-gray-200 rounded-full mx-auto mb-8" />
                            <div className="w-20 h-20 bg-blue-500 rounded-full mx-auto flex items-center justify-center text-3xl shadow-2xl shadow-blue-200 mb-6 font-bold text-white">
                                <FiSave />
                            </div>
                            <h2 className="text-2xl font-black text-gray-900 text-center leading-tight">Save Progress?</h2>
                            <p className="text-gray-500 text-center font-medium mt-3 px-4">Would you like to save your progress and go back to the modules overview?</p>

                            <div className="grid grid-cols-2 gap-4 mt-10">
                                <button onClick={() => setShowDraftModal(false)}
                                    className="py-5 rounded-[2rem] bg-gray-100 text-gray-900 font-black text-lg active:scale-95 transition-all outline-none">
                                    Continue
                                </button>
                                <button onClick={handleSaveDraftAndExit}
                                    className="py-5 rounded-[2rem] bg-blue-600 text-white font-black text-lg shadow-xl shadow-blue-100 active:scale-95 transition-all outline-none">
                                    Save & Exit
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            <SuccessModal 
                isOpen={showSuccess} 
                onClose={() => {
                    setShowSuccess(false);
                    navigate("/modular-dashboard");
                }}
                message="School terrain and location audit synced successfully! ✓"
                redirectUrl="/modular-dashboard"
            />

            <AnimatePresence>
                {showOfflineSuccess && (
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[100] flex items-end justify-center">
                        <motion.div initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="bg-white w-full rounded-t-[3rem] p-10 pb-12 shadow-2xl relative max-w-md">
                            <div className="w-16 h-1.5 bg-gray-200 rounded-full mx-auto mb-8" />
                            <div className="w-20 h-20 bg-orange-500 rounded-full mx-auto flex items-center justify-center text-3xl shadow-2xl shadow-orange-200 mb-6 font-bold text-white">
                                <FiWifiOff />
                            </div>
                            <h2 className="text-2xl font-black text-gray-900 text-center leading-tight px-4">Local Secure: Unit 8 Saved!</h2>
                            <p className="text-gray-500 text-center font-medium mt-3 px-6">Your school terrain, proximity matrix, and risk index data have been saved locally. We will automatically sync your location profile once you're back online.</p>
                            
                            <div className="mt-10">
                                <button onClick={() => navigate("/modular-dashboard")}
                                    className="w-full py-5 rounded-[2rem] bg-orange-600 text-white font-black text-lg shadow-xl shadow-orange-100 active:scale-95 transition-all outline-none">
                                    Return to Modules Dashboard
                                </button>
                                <p className="text-[10px] text-orange-500 font-bold uppercase text-center mt-6 tracking-widest leading-loose">✓ Offline Mode • Auto-Sync Enabled ✓</p>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default Unit8SchoolLocation;
