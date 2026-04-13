import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
    FiX, FiCheckCircle, FiChevronRight, FiChevronLeft, FiCheck, FiArrowLeft, 
    FiSave, FiAlertTriangle, FiZap, FiShield, FiCamera, FiBox, FiPhone, FiInfo, FiTrash2, FiPlus
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import SuccessModal from "../SuccessModal";
import { saveUnitDraft, getUnitDraft, clearUnitDraft, addModularToOutbox, getModularOutbox } from "../../db";
import { useAuth } from "../../context/AuthContext";
import UnitRemarkAlert from "./UnitRemarkAlert";

// --- Shared Styles ---
const chunkyInput = "w-full p-4 mt-2 bg-gray-50 border-2 border-gray-200 rounded-2xl text-lg font-black text-gray-700 focus:outline-none focus:border-indigo-500 focus:bg-indigo-50 transition-colors shadow-sm text-center";
const chunkySelect = "w-full p-4 mt-2 bg-gray-50 border-2 border-gray-200 rounded-2xl text-lg font-black text-gray-700 focus:outline-none focus:border-indigo-500 focus:bg-indigo-50 transition-colors shadow-sm appearance-none flex-1 text-center";
const toggleBtnBase = "flex-1 py-4 px-6 rounded-2xl font-black text-base border-2 transition-all flex items-center justify-center gap-2 shadow-sm";
const toggleBtnActive = "bg-indigo-100 border-indigo-500 text-indigo-700 shadow-indigo-100";
const toggleBtnInactive = "bg-white border-gray-200 text-gray-400 hover:bg-gray-50";

const slideVariants = {
    enter: { opacity: 0, x: 60, scale: 0.97 },
    center: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: -60, scale: 0.97 },
};

// --- Sub-Components (Moved outside to prevent scroll jumping) ---

const PageIndicator = ({ currentPage }) => (
    <div className="flex justify-center gap-2 mb-8 uppercase tracking-widest text-[9px] font-black">
        {[1, 2, 3, 4].map(p => (
            <div key={p} className={`h-1.5 rounded-full transition-all duration-300 ${p === currentPage ? 'w-8 bg-indigo-600' : 'w-2 bg-slate-200'}`} />
        ))}
    </div>
);

const YesNoToggle = ({ value, onChange, label, disabled }) => (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
        <p className="text-sm font-black text-slate-700 leading-tight">{label}</p>
        <div className="flex gap-3">
            <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(true)}
                className={`${toggleBtnBase} ${value === true ? 'bg-emerald-100 border-emerald-500 text-emerald-700 shadow-emerald-100' : toggleBtnInactive}`}
            >
                <FiCheck /> Yes
            </button>
            <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(false)}
                className={`${toggleBtnBase} ${value === false ? 'bg-rose-100 border-rose-500 text-rose-700 shadow-rose-100' : toggleBtnInactive}`}
            >
                <FiX /> No
            </button>
        </div>
    </div>
);

const SummaryView = ({ 
    generalData, 
    fixedWiringData, 
    applianceCctvData, 
    inventoryData, 
    setIsReviewMode, 
    setIsReadOnly, 
    setCurrentPage, 
    navigate 
}) => (
    <div className="space-y-8">
        {/* 1. Electrical Capacity & Main Power */}
        <section className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-6 bg-yellow-400 rounded-full" />
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Power Grid & Panel</h3>
            </div>
            <div className="grid grid-cols-1 gap-4">
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Main Power Source</p>
                    <p className="text-lg font-black text-indigo-900">{generalData.main_power_source || "None Reported"}</p>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Meters</p>
                    <p className="text-2xl font-black text-slate-800">{generalData.active_meters || 0}</p>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Wiring Age</p>
                    <p className="text-lg font-black text-slate-800">{generalData.wiring_age || "N/A"}</p>
                </div>
            </div>
            
            <div className="bg-slate-900 p-6 rounded-[2.5rem] text-white shadow-xl">
                <h4 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-4">Panel Safety Checks</h4>
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300">Clear Access</span>
                        {generalData.panel_clear ? <FiCheckCircle className="text-emerald-400" /> : <FiX className="text-rose-400" />}
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300">Labeled Switches</span>
                        {generalData.panel_labeled ? <FiCheckCircle className="text-emerald-400" /> : <FiX className="text-rose-400" />}
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300">Locked Panel</span>
                        {generalData.panel_locked ? <FiCheckCircle className="text-emerald-400" /> : <FiX className="text-rose-400" />}
                    </div>
                </div>
            </div>
        </section>

        {/* 2. Safety & Hazards */}
        <section className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-6 bg-rose-500 rounded-full" />
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Safety & Hazard Review</h3>
            </div>
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm grid grid-cols-2 gap-y-6 gap-x-4 text-center">
                <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tight">Hallway Lights</p>
                    <p className={`text-xs font-black p-2 rounded-xl ${fixedWiringData.lights_working ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{fixedWiringData.lights_working ? 'Working' : 'Not Working'}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tight">Bare Wires</p>
                    <p className={`text-xs font-black p-2 rounded-xl ${!fixedWiringData.bare_wires_visible ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{!fixedWiringData.bare_wires_visible ? 'None' : 'Detected'}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tight">Outlet Covers</p>
                    <p className={`text-xs font-black p-2 rounded-xl ${fixedWiringData.outlet_covers_unbroken ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{fixedWiringData.outlet_covers_unbroken ? 'Unbroken' : 'Damaged'}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tight">CCTV System</p>
                    <p className={`text-xs font-black p-2 rounded-xl ${applianceCctvData.cctv_recording_clear ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{applianceCctvData.cctv_recording_clear ? 'Active' : 'Offline'}</p>
                </div>
            </div>
        </section>

        {/* 3. Disaster Readiness & Security Inventory */}
        <section className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Security & Disaster Status</h3>
            </div>
            
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tight">Fire Exit Sign</p>
                    <p className={`text-xs font-black p-2 rounded-xl ${inventoryData.fire_exit_exists ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{inventoryData.fire_exit_exists ? 'Installed' : 'Missing'}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tight">Emergency Lights</p>
                    <p className={`text-xs font-black p-2 rounded-xl ${inventoryData.backup_light_exists ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{inventoryData.backup_light_exists ? 'Functional' : 'Missing'}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
                {[
                    { id: 'cctv_cameras', label: 'CCTV Cameras', icon: <FiCamera /> },
                    { id: 'fire_extinguishers', label: 'Fire Extinguisher Tanks', icon: <FiShield /> },
                    { id: 'first_aid_kits', label: 'First Aid Kits', icon: <FiPlus /> },
                    { id: 'portable_megaphones', label: 'Bullhorns', icon: <FiPhone /> },
                    { id: 'battery_radios', label: 'Portable Radios', icon: <FiZap /> },
                    { id: 'large_flashlights', label: 'Flashlights', icon: <FiZap /> }
                ].map(item => (
                    <div key={item.id} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-500">
                                {item.icon}
                            </div>
                            <span className="font-black text-slate-700 text-sm">{item.label}</span>
                        </div>
                        <div className="flex gap-2">
                            <div className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-center font-black text-xs">
                                {inventoryData.items?.[item.id]?.working || 0} OK
                            </div>
                            <div className="px-3 py-1 bg-rose-50 text-rose-700 rounded-lg text-center font-black text-xs">
                                {inventoryData.items?.[item.id]?.broken || 0} FAIL
                            </div>
                        </div>
                    </div>
                ))}
                <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-500">
                            <FiPlus />
                        </div>
                        <span className="font-black text-slate-700 text-sm">Emergency Whistles</span>
                    </div>
                    <div className="px-4 py-2 bg-slate-900 text-white rounded-xl font-black text-xs shadow-lg">
                        {inventoryData.items?.emergency_whistles?.total || 0} PCS 
                    </div>
                </div>
            </div>
        </section>

        {/* 4. Electrical Maintenance Spares */}
        <section className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-6 bg-amber-500 rounded-full" />
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Maintenance Inventory</h3>
            </div>
            <div className="grid grid-cols-1 gap-3">
                {[
                    { id: 'light_bulbs', label: 'Bulbs / LED Tubes' },
                    { id: 'outlet_covers', label: 'Spare Plate Covers' },
                    { id: 'circuit_breakers', label: 'Spare Breakers' },
                    { id: 'extension_cords', label: 'Extension Cords' }
                ].map(item => (
                    <div key={item.id} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                        <span className="font-black text-slate-700 text-xs ml-2">{item.label}</span>
                        <div className="flex gap-2">
                            <div className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-center font-black text-[10px]">
                                {inventoryData.items?.[item.id]?.working || 0} USED
                            </div>
                            <div className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-center font-black text-[10px]">
                                {inventoryData.items?.[item.id]?.spares || 0} SPARE
                            </div>
                        </div>
                    </div>
                ))}
                <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <span className="font-black text-slate-700 text-xs ml-2">Electrical Tape</span>
                    <div className="px-4 py-2 bg-amber-100 text-amber-700 rounded-xl font-black text-xs">
                        {inventoryData.items?.electrical_tape?.total || 0} ROLLS
                    </div>
                </div>
            </div>
        </section>

        {/* 5. Capacity & Protection */}
        <section className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Capacity & Protection</h3>
            </div>
            <div className="space-y-3">
                <div className={`p-4 rounded-2xl flex items-center gap-3 border ${inventoryData.ecart_load_ready ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                    {inventoryData.ecart_load_ready ? <FiCheckCircle /> : <FiX />}
                    <p className="text-[10px] font-bold uppercase leading-tight">Can support full e-Classroom load (20+ units)</p>
                </div>
                <div className={`p-4 rounded-2xl flex items-center gap-3 border ${inventoryData.has_surge_protection ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'}`}>
                    {inventoryData.has_surge_protection ? <FiCheckCircle /> : <FiAlertTriangle />}
                    <p className="text-[10px] font-bold uppercase leading-tight">ICT Equipment protected by Surge/AVR</p>
                </div>
            </div>
        </section>

        {/* 6. Auditor Notes */}
        <section className="space-y-4 pb-12">
            <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-6 bg-slate-400 rounded-full" />
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Auditor Remarks</h3>
            </div>
            <div className="bg-white border-2 border-slate-100 p-6 rounded-[2rem] min-h-[100px] shadow-sm">
                <p className="text-sm font-medium text-slate-600 leading-relaxed capitalize-first italic">
                    {inventoryData.remarks || "No additional remarks provided for this audit."}
                </p>
            </div>
        </section>

        {/* Unlock Button for Review Mode */}
        {setIsReviewMode && (
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-12"
            >
                <button 
                    type="button"
                    onClick={() => { setIsReviewMode(false); setIsReadOnly(false); setCurrentPage(1); }}
                    className="group relative w-full py-6 rounded-[2rem] bg-white border-4 border-indigo-100 text-indigo-700 font-black text-lg shadow-xl shadow-indigo-100/50 hover:border-indigo-200 hover:bg-indigo-50 transition-all duration-300 overflow-hidden flex items-center justify-center gap-3"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-indigo-500/5 to-indigo-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <FiZap className="w-5 h-5 text-indigo-700" />
                    </div>
                    <span>Unlock to Edit Infrastructure Data</span>
                </button>
                <p className="text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-4 px-8">
                    The current record is finalized and synced with the cloud registry.
                </p>
            </motion.div>
        )}

        <button 
            type="button"
            onClick={() => navigate("/modular-dashboard")}
            className="w-full py-6 rounded-[2rem] bg-indigo-600 text-white font-black text-lg shadow-xl shadow-indigo-100 active:scale-95 transition-all mt-8"
        >
            Return to Dashboard
        </button>
    </div>
);

export default function Unit9Infrastructure({ targetSchoolId, isReadOnly: propReadOnly }) {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showOfflineSuccess, setShowOfflineSuccess] = useState(false);
    const [showWelcomeBack, setShowWelcomeBack] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [isCertified, setIsCertified] = useState(false);
    const [schoolId, setSchoolId] = useState("");
    const [iern, setIern] = useState("");
    const [isReadOnly, setIsReadOnly] = useState(propReadOnly);
    const [isReviewMode, setIsReviewMode] = useState(propReadOnly);
    const [hasData, setHasData] = useState(false);

    // --- Form State ---

    // Page 1: General & Power Box
    const [generalData, setGeneralData] = useState({
        main_power_source: "", // Autofilled
        active_meters: "",
        wiring_age: "",
        last_inspection_year: "",
        panel_clear: null,
        panel_labeled: null,
        panel_locked: null
    });

    // Page 2: Lighting & Fixed Wiring
    const [fixedWiringData, setFixedWiringData] = useState({
        lights_working: null,
        outlet_covers_unbroken: null,
        child_safety_covered: null,
        water_splash_safe: null,
        bare_wires_visible: null,
        enough_outlets: null
    });

    // Page 3: Cords, Appliances & CCTV
    const [applianceCctvData, setApplianceCctvData] = useState({
        ext_cord_temp_only: null,
        no_trip_hazards: null,
        appliance_cords_good: null,
        plugs_feel_cool: null,
        cctv_recording_clear: null,
        dvr_room_cool_locked: null,
        cctv_wires_protected: null
    });

    // Page 4: Emergency, Inventory & Capacity
    const [inventoryData, setInventoryData] = useState({
        fire_exit_exists: null,
        backup_light_exists: null,
        items: {
            cctv_cameras: { total: "", working: "", broken: "", spares: "" },
            fire_extinguishers: { total: "", working: "", broken: "", spares: "" },
            first_aid_kits: { total: "", working: "", broken: "", spares: "" },
            portable_megaphones: { total: "", working: "", broken: "", spares: "" },
            battery_radios: { total: "", working: "", broken: "", spares: "" },
            large_flashlights: { total: "", working: "", broken: "", spares: "" },
            emergency_whistles: { total: "" },
            light_bulbs: { total: "", working: "", broken: "", spares: "" },
            outlet_covers: { total: "", working: "", broken: "", spares: "" },
            electrical_tape: { total: "" },
            circuit_breakers: { total: "", working: "", broken: "", spares: "" },
            extension_cords: { total: "", working: "", broken: "", spares: "" }
        },
        ecart_load_ready: null,
        has_surge_protection: null,
        remarks: "",
        photo_url: ""
    });

    // --- Initialization ---
    useEffect(() => {
        const init = async () => {
            const storedId = targetSchoolId || localStorage.getItem("schoolId");
            if (!storedId) {
                setLoading(false);
                return;
            }
            setSchoolId(storedId);

            try {
                const outbox = await getModularOutbox().catch(() => []);
                const pendingUnit9 = outbox.find(e => e.unitId === 9 && (e.schoolId === storedId || e.payload?.schoolId === storedId));
                const draft = await getUnitDraft(9, storedId);

                // Fetch Unit 6 for Autofill
                const resU6 = await fetch(`/api/ph_schools/${storedId}`);
                let u6PowerSource = "";
                if (resU6.ok) {
                    const profile = await resU6.json();
                    if (profile.exists && profile.data) {
                        setIern(profile.data.iern || "");
                        const u6Utilities = profile.data.unit7_utilities ? (typeof profile.data.unit7_utilities === 'string' ? JSON.parse(profile.data.unit7_utilities) : profile.data.unit7_utilities) : null;
                        
                        if (u6Utilities?.utility_electricity) {
                            u6PowerSource = u6Utilities.utility_electricity;
                        } else if (profile.data.utility_electricity) {
                            u6PowerSource = profile.data.utility_electricity;
                        }

                        if (u6PowerSource) {
                            setGeneralData(prev => ({ ...prev, main_power_source: u6PowerSource }));
                        }
                    }
                }

                if (pendingUnit9) {
                    restoreFromPayload(pendingUnit9.payload, u6PowerSource);
                    setIsReviewMode(true);
                    setIsReadOnly(true);
                    setHasData(true);
                } else if (draft) {
                    setCurrentPage(draft.currentPage || 1);
                    setGeneralData(prev => ({ ...prev, ...draft.generalData, main_power_source: u6PowerSource || draft.generalData.main_power_source }));
                    setFixedWiringData(prev => ({ ...prev, ...draft.fixedWiringData }));
                    setApplianceCctvData(prev => ({ ...prev, ...draft.applianceCctvData }));
                    setInventoryData(prev => ({
                        ...prev,
                        ...draft.inventoryData,
                        items: {
                            ...prev.items,
                            ...(draft.inventoryData?.items || {})
                        }
                    }));
                    setHasData(true);
                    setShowWelcomeBack(true);
                    setTimeout(() => setShowWelcomeBack(false), 3000);
                } else {
                    const resMaster = await fetch(`/api/ph_schools/unit9/${storedId}`);
                    if (resMaster.ok) {
                        const masterData = await resMaster.json();
                        if (masterData.success && masterData.data) {
                            restoreFromPayload(masterData.data, u6PowerSource);
                            const completed = !!masterData.data.unit9_completed;
                            setIsReviewMode(completed || propReadOnly);
                            setIsReadOnly(completed || propReadOnly);
                            setHasData(true);
                        } else if (propReadOnly) {
                            // If auditor and no master data, stay in review mode (read-only)
                            setIsReviewMode(true);
                            setIsReadOnly(true);
                        }
                    } else if (propReadOnly) {
                        // Fallback for API failure in read-only mode
                        setIsReviewMode(true);
                        setIsReadOnly(true);
                    }
                }
            } catch (e) {
                console.warn("Unit 9 Init Error:", e);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [targetSchoolId, propReadOnly]);

    const restoreFromPayload = (p, autofillPower) => {
        if (!p) return;
        const parsedGeneral = p.u9_general ? JSON.parse(p.u9_general) : generalData;
        
        // Preserve autofill if it exists and the payload's value is empty/placeholder
        if (autofillPower && (!parsedGeneral.main_power_source || parsedGeneral.main_power_source === "None Reported")) {
            parsedGeneral.main_power_source = autofillPower;
        }

        setGeneralData(prev => ({ ...prev, ...parsedGeneral }));
        setFixedWiringData(prev => ({ ...prev, ...(p.u9_wiring ? JSON.parse(p.u9_wiring) : {}) }));
        setApplianceCctvData(prev => ({ ...prev, ...(p.u9_cords_cctv ? JSON.parse(p.u9_cords_cctv) : {}) }));
        
        // Handle Individual Columns Restoration for Inventory
        const dbInventory = {
            fire_exit_exists: p.u9_fire_exit_exists ?? null,
            backup_light_exists: p.u9_backup_light_exists ?? null,
            ecart_load_ready: p.u9_ecart_load_ready ?? null,
            has_surge_protection: p.u9_has_surge_protection ?? null,
            remarks: p.u9_remarks || "",
            items: {
                cctv_cameras: { total: (parseInt(p.u9_cctv_working) + parseInt(p.u9_cctv_broken)).toString(), working: (p.u9_cctv_working ?? "").toString(), broken: (p.u9_cctv_broken ?? "").toString(), spares: (p.u9_cctv_spares ?? "").toString() },
                fire_extinguishers: { total: (parseInt(p.u9_fire_ext_working) + parseInt(p.u9_fire_ext_broken)).toString(), working: (p.u9_fire_ext_working ?? "").toString(), broken: (p.u9_fire_ext_broken ?? "").toString(), spares: (p.u9_fire_ext_spares ?? "").toString() },
                first_aid_kits: { total: (parseInt(p.u9_first_aid_working) + parseInt(p.u9_first_aid_broken)).toString(), working: (p.u9_first_aid_working ?? "").toString(), broken: (p.u9_first_aid_broken ?? "").toString(), spares: (p.u9_first_aid_spares ?? "").toString() },
                portable_megaphones: { total: (parseInt(p.u9_bullhorns_working) + parseInt(p.u9_bullhorns_broken)).toString(), working: (p.u9_bullhorns_working ?? "").toString(), broken: (p.u9_bullhorns_broken ?? "").toString(), spares: (p.u9_bullhorns_spares ?? "").toString() },
                battery_radios: { total: (parseInt(p.u9_radios_working) + parseInt(p.u9_radios_broken)).toString(), working: (p.u9_radios_working ?? "").toString(), broken: (p.u9_radios_broken ?? "").toString(), spares: (p.u9_radios_spares ?? "").toString() },
                large_flashlights: { total: (parseInt(p.u9_flashlight_working) + parseInt(p.u9_flashlight_broken)).toString(), working: (p.u9_flashlight_working ?? "").toString(), broken: (p.u9_flashlight_broken ?? "").toString(), spares: (p.u9_flashlight_spares ?? "").toString() },
                emergency_whistles: { total: (p.u9_whistles_quantity ?? "").toString() },
                light_bulbs: { total: (parseInt(p.u9_bulbs_working) + parseInt(p.u9_bulbs_broken)).toString(), working: (p.u9_bulbs_working ?? "").toString(), broken: (p.u9_bulbs_broken ?? "").toString(), spares: (p.u9_bulbs_spares ?? "").toString() },
                outlet_covers: { total: (parseInt(p.u9_covers_working) + parseInt(p.u9_covers_broken)).toString(), working: (p.u9_covers_working ?? "").toString(), broken: (p.u9_covers_broken ?? "").toString(), spares: (p.u9_covers_spares ?? "").toString() },
                circuit_breakers: { total: (parseInt(p.u9_breakers_working) + parseInt(p.u9_breakers_broken)).toString(), working: (p.u9_breakers_working ?? "").toString(), broken: (p.u9_breakers_broken ?? "").toString(), spares: (p.u9_breakers_spares ?? "").toString() },
                extension_cords: { total: (parseInt(p.u9_ext_cords_working) + parseInt(p.u9_ext_cords_broken)).toString(), working: (p.u9_ext_cords_working ?? "").toString(), broken: (p.u9_ext_cords_broken ?? "").toString(), spares: (p.u9_ext_cords_spares ?? "").toString() },
                electrical_tape: { total: (p.u9_tape_quantity ?? "").toString() }
            }
        };

        const parsedInventory = p.u9_final ? JSON.parse(p.u9_final) : {};
        setInventoryData(prev => ({
            ...prev,
            ...dbInventory,
            items: {
                ...prev.items,
                ...dbInventory.items,
                ...(parsedInventory.items || {}) // Fallback to JSON if individual columns were empty
            }
        }));
    };

    // --- Handlers ---
    const updateGeneral = (field, val) => {
        if (field === 'active_meters' && val.length > 3) return;
        if (field === 'last_inspection_year' && val.length > 4) return;
        
        let formattedVal = val;
        if (val.length > 1 && val.startsWith('0')) {
            formattedVal = parseInt(val, 10).toString();
        }
        
        setGeneralData(prev => ({ ...prev, [field]: formattedVal }));
    };
    const updateWiring = (field, val) => setFixedWiringData(prev => ({ ...prev, [field]: val }));
    const updateAppliance = (field, val) => setApplianceCctvData(prev => ({ ...prev, [field]: val }));
    const updateInventory = (field, val) => {
        if (field === 'remarks' && val.length > 100) return;
        setInventoryData(prev => ({ ...prev, [field]: val }));
    };
    const updateInventoryItem = (item, field, val) => {
        // Prevent negative numbers
        if (parseInt(val) < 0) return;

        // Strip leading zeros for better UX (e.g., "01" -> "1")
        let formattedVal = val;
        if (val.length > 1 && val.startsWith('0')) {
            formattedVal = parseInt(val, 10).toString();
        }

        setInventoryData(prev => {
            const currentItem = { ...prev.items[item], [field]: formattedVal };
            
            // Magic Math: Auto-calculate Total or Spares based on input
            if (field === 'working' || field === 'broken' || field === 'spares') {
                const w = parseInt(currentItem.working) || 0;
                const b = parseInt(currentItem.broken) || 0;
                const s = parseInt(currentItem.spares) || 0;
                currentItem.total = (w + b + s).toString();
            } else if (field === 'total') {
                const t = parseInt(currentItem.total) || 0;
                const w = parseInt(currentItem.working) || 0;
                const b = parseInt(currentItem.broken) || 0;
                currentItem.spares = Math.max(0, t - w - b).toString();
            }

            return {
                ...prev,
                items: {
                    ...prev.items,
                    [item]: currentItem
                }
            };
        });
    };

    const handleSaveDraft = async () => {
        const draft = { currentPage, generalData, fixedWiringData, applianceCctvData, inventoryData };
        await saveUnitDraft(9, schoolId, draft);
        navigate("/modular-dashboard");
    };

    const handleFinalSubmit = async () => {
        if (!isCertified) {
            alert("Please certify that the data is correct.");
            return;
        }

        setLoading(true);
        const payload = {
            iern,
            u9_general: JSON.stringify(generalData),
            u9_wiring: JSON.stringify(fixedWiringData),
            u9_cords_cctv: JSON.stringify(applianceCctvData),
            u9_final: JSON.stringify(inventoryData),
            unit9_completed: true,

            // Individual Columns for Direct SQL Reporting
            u9_fire_exit_exists: inventoryData.fire_exit_exists,
            u9_backup_light_exists: inventoryData.backup_light_exists,
            u9_ecart_load_ready: inventoryData.ecart_load_ready,
            u9_has_surge_protection: inventoryData.has_surge_protection,
            u9_remarks: inventoryData.remarks,

            // Section 1: Security
            u9_cctv_working: parseInt(inventoryData.items.cctv_cameras.working) || 0,
            u9_cctv_broken: parseInt(inventoryData.items.cctv_cameras.broken) || 0,
            u9_cctv_spares: parseInt(inventoryData.items.cctv_cameras.spares) || 0,

            u9_fire_ext_working: parseInt(inventoryData.items.fire_extinguishers.working) || 0,
            u9_fire_ext_broken: parseInt(inventoryData.items.fire_extinguishers.broken) || 0,
            u9_fire_ext_spares: parseInt(inventoryData.items.fire_extinguishers.spares) || 0,

            u9_first_aid_working: parseInt(inventoryData.items.first_aid_kits.working) || 0,
            u9_first_aid_broken: parseInt(inventoryData.items.first_aid_kits.broken) || 0,
            u9_first_aid_spares: parseInt(inventoryData.items.first_aid_kits.spares) || 0,

            u9_bullhorns_working: parseInt(inventoryData.items.portable_megaphones.working) || 0,
            u9_bullhorns_broken: parseInt(inventoryData.items.portable_megaphones.broken) || 0,
            u9_bullhorns_spares: parseInt(inventoryData.items.portable_megaphones.spares) || 0,

            u9_radios_working: parseInt(inventoryData.items.battery_radios.working) || 0,
            u9_radios_broken: parseInt(inventoryData.items.battery_radios.broken) || 0,
            u9_radios_spares: parseInt(inventoryData.items.battery_radios.spares) || 0,

            u9_flashlight_working: parseInt(inventoryData.items.large_flashlights.working) || 0,
            u9_flashlight_broken: parseInt(inventoryData.items.large_flashlights.broken) || 0,
            u9_flashlight_spares: parseInt(inventoryData.items.large_flashlights.spares) || 0,

            u9_whistles_quantity: parseInt(inventoryData.items.emergency_whistles.total) || 0,

            // Section 2: Electrical
            u9_bulbs_working: parseInt(inventoryData.items.light_bulbs.working) || 0,
            u9_bulbs_broken: parseInt(inventoryData.items.light_bulbs.broken) || 0,
            u9_bulbs_spares: parseInt(inventoryData.items.light_bulbs.spares) || 0,

            u9_covers_working: parseInt(inventoryData.items.outlet_covers.working) || 0,
            u9_covers_broken: parseInt(inventoryData.items.outlet_covers.broken) || 0,
            u9_covers_spares: parseInt(inventoryData.items.outlet_covers.spares) || 0,

            u9_breakers_working: parseInt(inventoryData.items.circuit_breakers.working) || 0,
            u9_breakers_broken: parseInt(inventoryData.items.circuit_breakers.broken) || 0,
            u9_breakers_spares: parseInt(inventoryData.items.circuit_breakers.spares) || 0,

            u9_ext_cords_working: parseInt(inventoryData.items.extension_cords.working) || 0,
            u9_ext_cords_broken: parseInt(inventoryData.items.extension_cords.broken) || 0,
            u9_ext_cords_spares: parseInt(inventoryData.items.extension_cords.spares) || 0,

            u9_tape_quantity: parseInt(inventoryData.items.electrical_tape.total) || 0
        };

        try {
            if (!navigator.onLine) {
                await addModularToOutbox({
                    unitId: 9,
                    label: "Unit 9: Infrastructure & Safety Audit",
                    url: `/api/ph_schools/unit9/${schoolId}`,
                    method: 'PUT',
                    payload,
                    schoolId
                });
                await clearUnitDraft(9, schoolId);
                updateQuestProgress();
                setShowOfflineSuccess(true);
                return;
            }

            const res = await fetch(`/api/ph_schools/unit9/${schoolId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                await clearUnitDraft(9, schoolId);
                updateQuestProgress();
                setShowSuccess(true);
            } else {
                throw new Error("Server error");
            }
        } catch (e) {
            console.error(e);
            alert("Submission failed. Saving to outbox.");
        } finally {
            setLoading(false);
        }
    };

    const updateQuestProgress = () => {
        const stored = localStorage.getItem('quest_progress');
        let progress = stored ? JSON.parse(stored) : { completedUnits: [], xp: 0, timestamps: {} };
        
        if (!progress.completedUnits.includes(9)) {
            progress.completedUnits.push(9);
            progress.xp += 550;
        }
        
        if (!progress.timestamps) progress.timestamps = {};
        progress.timestamps.unit9 = new Date().toISOString();
        
        localStorage.setItem('quest_progress', JSON.stringify(progress));
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="font-black text-indigo-600 animate-pulse uppercase tracking-widest text-xs">Loading Audit...</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 pb-32">
            <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                <button 
                    type="button"
                    onClick={handleSaveDraft} 
                    className="p-2 -ml-2 rounded-full hover:bg-slate-50 text-slate-400"
                >
                    <FiArrowLeft size={24} />
                </button>
                <div className="text-center">
                    <p className={`text-[10px] font-black tracking-[0.2em] uppercase ${isReviewMode ? 'text-amber-500' : 'text-indigo-500'}`}>
                        {isReviewMode ? 'Audit Locked' : 'Unit 9'}
                    </p>
                    <h1 className="text-sm font-black text-slate-800">Infrastructure & Safety</h1>
                </div>
                <div className="w-6" />
            </header>

            <main className="max-w-md mx-auto p-6">
                <AnimatePresence mode="wait">
                    {showWelcomeBack && (
                        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-6 p-4 bg-indigo-600 rounded-2xl text-white text-center shadow-lg">
                            <p className="text-xs font-black uppercase tracking-widest">Resumed from Draft</p>
                        </motion.div>
                    )}
                </AnimatePresence>

                <UnitRemarkAlert unitId="u9" schoolId={schoolId} />

                {propReadOnly && !hasData ? (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="py-12 px-6 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100 shadow-sm"
                    >
                        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                            <FiAlertTriangle className="text-amber-500" size={40} />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">No Data Yet</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-3 leading-relaxed max-w-[200px] mx-auto">
                            The school head has not yet submitted the infrastructure audit for this unit.
                        </p>
                    </motion.div>
                ) : isReviewMode ? (
                    <SummaryView 
                        generalData={generalData}
                        fixedWiringData={fixedWiringData}
                        applianceCctvData={applianceCctvData}
                        inventoryData={inventoryData}
                        setIsReviewMode={setIsReviewMode}
                        setIsReadOnly={setIsReadOnly}
                        setCurrentPage={setCurrentPage}
                        navigate={navigate}
                    />
                ) : (
                    <>
                        <PageIndicator currentPage={currentPage} />

                        <AnimatePresence mode="wait">
                            {showWelcomeBack && (
                                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-6 p-4 bg-indigo-600 rounded-2xl text-white text-center shadow-lg">
                                    <p className="text-xs font-black uppercase tracking-widest">Resumed from Draft</p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <PageIndicator />

                        <AnimatePresence mode="wait">
                            {currentPage === 1 && (
                                <motion.div key="p1" variants={slideVariants} initial="enter" animate="center" exit="exit" className="space-y-6">
                                    <div className="bg-indigo-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16"></div>
                                        <div className="relative z-10">
                                            <FiZap size={40} className="text-yellow-400 mb-4" />
                                            <h2 className="text-2xl font-black italic tracking-tighter uppercase">Power & Connection</h2>
                                            <p className="text-indigo-200/60 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Audit Phase 1</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <section>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Main Power Source (Autofilled)</label>
                                            <input type="text" readOnly value={generalData.main_power_source || "Checking Unit 6..."} className={`${chunkyInput} bg-indigo-50/50 border-indigo-100 text-indigo-900 border-dashed cursor-not-allowed`} />
                                        </section>

                                        <div className="grid grid-cols-2 gap-4">
                                            <section>
                                                <div className="flex items-center gap-2 ml-4">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Meters</label>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setShowInfoModal(true)}
                                                        className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 hover:bg-indigo-100 hover:text-indigo-600 transition-colors"
                                                    >
                                                        <FiInfo size={10} />
                                                    </button>
                                                </div>
                                                <input type="number" readOnly={isReadOnly} value={generalData.active_meters} onChange={(e) => updateGeneral('active_meters', e.target.value)} className={chunkyInput} placeholder="Count" />
                                            </section>
                                            <section>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Wiring Age</label>
                                                <select disabled={isReadOnly} value={generalData.wiring_age} onChange={(e) => updateGeneral('wiring_age', e.target.value)} className={chunkySelect + " h-[60px]"}>
                                                    <option value="">Select</option>
                                                    <option value="< 5 yrs">Less than 5 yrs</option>
                                                    <option value="5-10 yrs">5-10 years</option>
                                                    <option value="10-20 yrs">10-20 years</option>
                                                    <option value="> 20 yrs">20+ years</option>
                                                </select>
                                            </section>
                                        </div>

                                        <section>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Last Full Electrical Inspection</label>
                                            <select 
                                                disabled={isReadOnly} 
                                                value={generalData.last_inspection_year} 
                                                onChange={(e) => updateGeneral('last_inspection_year', e.target.value)} 
                                                className={chunkySelect + " h-[60px]"}
                                            >
                                                <option value="">Select Year</option>
                                                {[2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010].map(yr => (
                                                    <option key={yr} value={yr.toString()}>{yr}</option>
                                                ))}
                                                <option value="2000-2009">2000 - 2009</option>
                                                <option value="Before 2000">Before 2000</option>
                                                <option value="Never Reported">Never Reported</option>
                                            </select>
                                        </section>

                                        <div className="pt-4 space-y-4">
                                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Panel & Power Box Safety</h3>
                                            <YesNoToggle label="Is the area around the main power box kept clear of boxes and junk?" value={generalData.panel_clear} onChange={(v) => updateGeneral('panel_clear', v)} disabled={isReadOnly} />
                                            <YesNoToggle label="Are the switches in the power box labeled so you know which room they control?" value={generalData.panel_labeled} onChange={(v) => updateGeneral('panel_labeled', v)} disabled={isReadOnly} />
                                            <YesNoToggle label="Is the power box kept closed and locked to keep students away?" value={generalData.panel_locked} onChange={(v) => updateGeneral('panel_locked', v)} disabled={isReadOnly} />
                                        </div>
                                    </div>

                                    <button 
                                        type="button"
                                        onClick={() => setCurrentPage(2)} 
                                        className="w-full py-6 rounded-[2rem] bg-slate-900 text-white font-black text-lg flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"
                                    >
                                        <span>Next Audit Phase</span>
                                        <FiChevronRight />
                                    </button>
                                </motion.div>
                            )}

                            {currentPage === 2 && (
                                <motion.div key="p2" variants={slideVariants} initial="enter" animate="center" exit="exit" className="space-y-6">
                                    <div className="bg-amber-500 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16"></div>
                                        <div className="relative z-10">
                                            <FiBox size={40} className="text-white mb-4" />
                                            <h2 className="text-2xl font-black italic tracking-tighter uppercase">Fixed Wiring & Lights</h2>
                                            <p className="text-amber-100 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Audit Phase 2</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <YesNoToggle label="Are all the lights in the hallways and classrooms working?" value={fixedWiringData.lights_working} onChange={(v) => updateWiring('lights_working', v)} disabled={isReadOnly} />
                                        <YesNoToggle label="Are all plastic covers on outlets and light switches unbroken?" value={fixedWiringData.outlet_covers_unbroken} onChange={(v) => updateWiring('outlet_covers_unbroken', v)} disabled={isReadOnly} />
                                        <YesNoToggle label="In rooms with young children, are outlets covered or blocked?" value={fixedWiringData.child_safety_covered} onChange={(v) => updateWiring('child_safety_covered', v)} disabled={isReadOnly} />
                                        <YesNoToggle label="Near sinks or water taps, are outlets placed safely away from splashes?" value={fixedWiringData.water_splash_safe} onChange={(v) => updateWiring('water_splash_safe', v)} disabled={isReadOnly} />
                                        <YesNoToggle label="Can you see any bare wires sticking out of walls or ceilings?" value={fixedWiringData.bare_wires_visible} onChange={(v) => updateWiring('bare_wires_visible', v)} disabled={isReadOnly} />
                                        <YesNoToggle label="Are there enough outlets so that you don't have to use many 'double adapters' in one spot?" value={fixedWiringData.enough_outlets} onChange={(v) => updateWiring('enough_outlets', v)} disabled={isReadOnly} />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <button 
                                            type="button"
                                            onClick={() => setCurrentPage(1)} 
                                            className="py-6 rounded-[2rem] bg-white border-2 border-slate-100 text-slate-400 font-black text-lg flex items-center justify-center gap-3 active:scale-95 transition-all"
                                        >
                                            <FiChevronLeft /> Back
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => setCurrentPage(3)} 
                                            className="py-6 rounded-[2rem] bg-slate-900 text-white font-black text-lg flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"
                                        >
                                            Next Phase <FiChevronRight />
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {currentPage === 3 && (
                                <motion.div key="p3" variants={slideVariants} initial="enter" animate="center" exit="exit" className="space-y-6">
                                    <div className="bg-rose-600 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16"></div>
                                        <div className="relative z-10">
                                            <FiCamera size={40} className="text-white mb-4" />
                                            <h2 className="text-2xl font-black italic tracking-tighter uppercase">Cords, CCTV & Devices</h2>
                                            <p className="text-rose-100 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Audit Phase 3</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Cords & Appliances Audit</h3>
                                        <YesNoToggle label="Are long extension cords used only for a short time (not as permanent wiring)?" value={applianceCctvData.ext_cord_temp_only} onChange={(v) => updateAppliance('ext_cord_temp_only', v)} disabled={isReadOnly} />
                                        <YesNoToggle label="Are electrical cords kept away from walkways where people might trip?" value={applianceCctvData.no_trip_hazards} onChange={(v) => updateAppliance('no_trip_hazards', v)} disabled={isReadOnly} />
                                        <YesNoToggle label="Are the cords on fans, computers, or heaters free of tape or frayed edges?" value={applianceCctvData.appliance_cords_good} onChange={(v) => updateAppliance('appliance_cords_good', v)} disabled={isReadOnly} />
                                        <YesNoToggle label="When you touch a plug or an appliance, does it feel cool (not hot to the touch)?" value={applianceCctvData.plugs_feel_cool} onChange={(v) => updateAppliance('plugs_feel_cool', v)} disabled={isReadOnly} />
                                        
                                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-2 pt-4">CCTV & Security Systems</h3>
                                        <YesNoToggle label="Are all CCTV cameras currently recording and showing a clear picture?" value={applianceCctvData.cctv_recording_clear} onChange={(v) => updateAppliance('cctv_recording_clear', v)} disabled={isReadOnly} />
                                        <YesNoToggle label="Is the recording machine (DVR/NVR) kept in a cool, locked room?" value={applianceCctvData.dvr_room_cool_locked} onChange={(v) => updateAppliance('dvr_room_cool_locked', v)} disabled={isReadOnly} />
                                        <YesNoToggle label="Are CCTV wires hidden or protected so they cannot be easily cut?" value={applianceCctvData.cctv_wires_protected} onChange={(v) => updateAppliance('cctv_wires_protected', v)} disabled={isReadOnly} />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <button 
                                            type="button"
                                            onClick={() => setCurrentPage(2)} 
                                            className="py-6 rounded-[2rem] bg-white border-2 border-slate-100 text-slate-400 font-black text-lg flex items-center justify-center gap-3 active:scale-95 transition-all"
                                        >
                                            <FiChevronLeft /> Back
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => setCurrentPage(4)} 
                                            className="py-6 rounded-[2rem] bg-slate-900 text-white font-black text-lg flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"
                                        >
                                            Next Phase <FiChevronRight />
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {currentPage === 4 && (
                                <motion.div key="p4" variants={slideVariants} initial="enter" animate="center" exit="exit" className="space-y-6">
                                    <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -mr-16 -mt-16"></div>
                                        <div className="relative z-10">
                                            <FiShield size={40} className="text-emerald-400 mb-4" />
                                            <h2 className="text-2xl font-black italic tracking-tighter uppercase">Disaster Readiness</h2>
                                            <p className="text-indigo-200/60 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Audit Phase 4 (Final)</p>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="space-y-4">
                                            <YesNoToggle label="Does the school have a fire exit?" value={inventoryData.fire_exit_exists} onChange={(v) => updateInventory('fire_exit_exists', v)} disabled={isReadOnly} />
                                            <YesNoToggle label="Do all classrooms have working flashlights or backup lights in case the power goes out?" value={inventoryData.backup_light_exists} onChange={(v) => updateInventory('backup_light_exists', v)} disabled={isReadOnly} />
                                        </div>

                                        {/* Section 1: Security & Disaster Preparedness */}
                                        <section className="space-y-4 overflow-x-auto">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Security & Disaster Preparedness</h3>
                                                </div>
                                            </div>
                                            
                                            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl mb-4">
                                                <p className="text-[10px] font-bold text-emerald-700 leading-tight uppercase italic flex items-center gap-2">
                                                    <FiInfo size={14} className="flex-shrink-0" />
                                                    Audit Note: Count all items across the campus, including those located both inside and outside of rooms.
                                                </p>
                                            </div>

                                            <table className="w-full text-left border-separate border-spacing-y-2">
                                                <thead>
                                                    <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">
                                                        <th className="px-2">Item Category</th>
                                                        <th className="px-2">Total</th>
                                                        <th className="px-2">Work</th>
                                                        <th className="px-2">Fail</th>
                                                        <th className="px-2">Spare</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="text-xs">
                                                    {[
                                                        { id: 'cctv_cameras', label: 'CCTV Cameras' },
                                                        { id: 'fire_extinguishers', label: 'Fire Extinguisher' },
                                                        { id: 'first_aid_kits', label: 'First Aid Kit' },
                                                        { id: 'portable_megaphones', label: 'Bullhorns' },
                                                        { id: 'battery_radios', label: 'Radios' },
                                                        { id: 'large_flashlights', label: 'Flashlight' }
                                                    ].map(item => (
                                                        <tr key={item.id} className="bg-white rounded-2xl shadow-sm border border-slate-50">
                                                            <td className="p-3 font-black text-slate-600 rounded-l-2xl border-l border-y border-slate-100">{item.label}</td>
                                                            <td className="p-1"><input type="number" readOnly={isReadOnly} value={inventoryData.items[item.id].total} onChange={(e) => updateInventoryItem(item.id, 'total', e.target.value)} className="w-full p-2 bg-slate-50 rounded-lg text-center font-bold" /></td>
                                                            <td className="p-1"><input type="number" readOnly={isReadOnly} value={inventoryData.items[item.id].working} onChange={(e) => updateInventoryItem(item.id, 'working', e.target.value)} className="w-full p-2 bg-emerald-50 text-emerald-700 rounded-lg text-center font-bold" /></td>
                                                            <td className="p-1"><input type="number" readOnly={isReadOnly} value={inventoryData.items[item.id].broken} onChange={(e) => updateInventoryItem(item.id, 'broken', e.target.value)} className="w-full p-2 bg-rose-50 text-rose-700 rounded-lg text-center font-bold" /></td>
                                                            <td className="p-1 rounded-r-2xl border-r border-y border-slate-100"><input type="number" readOnly={isReadOnly} value={inventoryData.items[item.id].spares} onChange={(e) => updateInventoryItem(item.id, 'spares', e.target.value)} className="w-full p-2 bg-slate-100 text-slate-700 rounded-lg text-center font-bold" /></td>
                                                        </tr>
                                                    ))}
                                                    <tr className="bg-white rounded-2xl shadow-sm border border-slate-50">
                                                        <td className="p-1 font-black text-slate-600 rounded-l-2xl border-l border-y border-slate-100 px-3">Emergency Whistles</td>
                                                        <td className="p-1" colSpan={4}><input type="number" readOnly={isReadOnly} value={inventoryData.items.emergency_whistles.total} onChange={(e) => updateInventoryItem('emergency_whistles', 'total', e.target.value)} className="w-full p-2 bg-slate-50 rounded-lg text-center font-bold h-10" /></td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </section>

                                        {/* Section 2: Electrical Maintenance & Spares */}
                                        <section className="space-y-4 overflow-x-auto pt-6">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-1.5 h-6 bg-amber-500 rounded-full" />
                                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Electrical Maintenance & Spares</h3>
                                            </div>

                                            <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl mb-4">
                                                <p className="text-[10px] font-bold text-amber-700 leading-tight uppercase italic flex items-center gap-2">
                                                    <FiInfo size={14} className="flex-shrink-0" />
                                                    Audit Note: Count all items across the campus, including those located both inside and outside of rooms.
                                                </p>
                                            </div>

                                            <table className="w-full text-left border-separate border-spacing-y-2">
                                                <thead>
                                                    <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">
                                                        <th className="px-2">Item Category</th>
                                                        <th className="px-2">Total</th>
                                                        <th className="px-2">Work</th>
                                                        <th className="px-2">Fail</th>
                                                        <th className="px-2">Spare</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="text-xs">
                                                    {[
                                                        { id: 'light_bulbs', label: 'Bulbs/LEDs' },
                                                        { id: 'outlet_covers', label: 'Outlet Covers' },
                                                        { id: 'circuit_breakers', label: 'Breakers/Fuses' },
                                                        { id: 'extension_cords', label: 'Extension Cords' }
                                                    ].map(item => (
                                                        <tr key={item.id} className="bg-white rounded-2xl shadow-sm border border-slate-50">
                                                            <td className="p-3 font-black text-slate-600 rounded-l-2xl border-l border-y border-slate-100">{item.label}</td>
                                                            <td className="p-1"><input type="number" readOnly={isReadOnly} value={inventoryData.items[item.id].total} onChange={(e) => updateInventoryItem(item.id, 'total', e.target.value)} className="w-full p-2 bg-slate-50 rounded-lg text-center font-bold" /></td>
                                                            <td className="p-1"><input type="number" readOnly={isReadOnly} value={inventoryData.items[item.id].working} onChange={(e) => updateInventoryItem(item.id, 'working', e.target.value)} className="w-full p-2 bg-emerald-50 text-emerald-700 rounded-lg text-center font-bold" /></td>
                                                            <td className="p-1"><input type="number" readOnly={isReadOnly} value={inventoryData.items[item.id].broken} onChange={(e) => updateInventoryItem(item.id, 'broken', e.target.value)} className="w-full p-2 bg-rose-50 text-rose-700 rounded-lg text-center font-bold" /></td>
                                                            <td className="p-1 rounded-r-2xl border-r border-y border-slate-100"><input type="number" readOnly={isReadOnly} value={inventoryData.items[item.id].spares} onChange={(e) => updateInventoryItem(item.id, 'spares', e.target.value)} className="w-full p-2 bg-slate-100 text-slate-700 rounded-lg text-center font-bold" /></td>
                                                        </tr>
                                                    ))}
                                                    <tr className="bg-white rounded-2xl shadow-sm border border-slate-50">
                                                        <td className="p-1 font-black text-slate-600 rounded-l-2xl border-l border-y border-slate-100 px-3">Rolls of Electrical Tape</td>
                                                        <td className="p-1" colSpan={4}><input type="number" readOnly={isReadOnly} value={inventoryData.items.electrical_tape.total} onChange={(e) => updateInventoryItem('electrical_tape', 'total', e.target.value)} className="w-full p-2 bg-slate-50 rounded-lg text-center font-bold h-10" /></td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </section>

                                        <div className="pt-8 space-y-6">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-6 bg-slate-900 rounded-full" />
                                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Capacity & Final Review</h3>
                                            </div>
                                            <YesNoToggle label="Can the current wiring support a full e-Classroom/Computer Lab (20+ units) without tripping the breaker?" value={inventoryData.ecart_load_ready} onChange={(v) => updateInventory('ecart_load_ready', v)} disabled={isReadOnly} />
                                            <YesNoToggle label="Are vulnerable ICT equipment (computers, servers) protected by surge protectors or AVRs?" value={inventoryData.has_surge_protection} onChange={(v) => updateInventory('has_surge_protection', v)} disabled={isReadOnly} />
                                            
                                            <section>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Audit Remarks</label>
                                                <textarea readOnly={isReadOnly} value={inventoryData.remarks} onChange={(e) => updateInventory('remarks', e.target.value)} placeholder="Note any specific hazards or urgent needs..." className="w-full p-6 mt-2 bg-white border-2 border-slate-200 rounded-[2rem] text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-300 min-h-[120px]" />
                                            </section>

                                            <div onClick={() => !isReadOnly && setIsCertified(!isCertified)} className={`p-6 rounded-[2rem] border-2 transition-all flex items-center gap-4 cursor-pointer ${isCertified ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-100 text-slate-400'}`}>
                                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isCertified ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'}`}>
                                                    {isCertified && <FiCheck size={14} />}
                                                </div>
                                                <p className="text-xs font-bold leading-tight uppercase tracking-tight">
I hereby certify that all data and information provided in this module/unit are true and correct.</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <button 
                                            type="button"
                                            onClick={() => setCurrentPage(3)} 
                                            className="py-6 rounded-[2rem] bg-white border-2 border-slate-100 text-slate-400 font-black text-lg flex items-center justify-center gap-3 active:scale-95 transition-all"
                                        >
                                            <FiChevronLeft /> Back
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={handleFinalSubmit} 
                                            disabled={isReadOnly || !isCertified} 
                                            className="py-6 rounded-[2rem] bg-slate-900 text-white font-black text-lg flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all disabled:opacity-50"
                                        >
                                            <FiSave /> Submit Audit
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </>
                )}
            </main>

            <AnimatePresence>
                {showSuccess && (
                    <SuccessModal 
                        isOpen={showSuccess} 
                        onClose={() => navigate("/modular-dashboard")} 
                        message="Infrastructure & Safety Audit Submitted Successfully! You've earned 550 XP!"
                        redirectUrl="/modular-dashboard"
                    />
                )}
                {showOfflineSuccess && (
                    <SuccessModal 
                        isOpen={showOfflineSuccess} 
                        onClose={() => navigate("/modular-dashboard")} 
                        message="You're Offline! Audit saved locally and will sync when you're back online."
                        type="offline"
                        redirectUrl="/modular-dashboard"
                    />
                )}

                {showInfoModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-2 bg-indigo-500" />
                            <div className="flex flex-col items-center text-center">
                                <div className="w-16 h-16 rounded-3xl bg-indigo-100 flex items-center justify-center text-indigo-600 mb-6">
                                    <FiInfo size={32} />
                                </div>
                                <h3 className="text-xl font-black italic tracking-tighter uppercase mb-2">Active Meters</h3>
                                <p className="text-sm font-medium text-slate-500 leading-relaxed mb-8">
                                    Identify the total number of active electricity meters currently installed at the school campus. This includes the main building, admin, classroom wings, and any laboratory facilities with separate connections.
                                </p>
                                <button 
                                    onClick={() => setShowInfoModal(false)}
                                    className="w-full py-4 rounded-2xl bg-slate-900 text-white font-black text-sm uppercase tracking-widest active:scale-95 transition-all shadow-lg"
                                >
                                    Got it!
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
