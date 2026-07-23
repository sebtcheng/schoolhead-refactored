// src/Register.jsx

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import logo from './assets/InsightEdLogoApp.png';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import BlueprintBackground from './components/BlueprintBackground';
import { FiLock } from 'react-icons/fi';
import { saveUnitDraft, saveSchoolToCache } from './db';
import PageTransition from './components/PageTransition';
import Papa from 'papaparse';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import { api } from "./lib/api";

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// --- CONSTANTS ---
const CSV_PATH = `${import.meta.env.BASE_URL}schools.csv`;

const RecenterMap = ({ lat, lng }) => {
    const map = useMap();

    // Fix for off-center pins: invalidate size when the container element changes size
    useEffect(() => {
        if (!map) return;
        const resizeObserver = new ResizeObserver(() => {
            map.invalidateSize();
        });
        const container = map.getContainer();
        resizeObserver.observe(container);
        return () => resizeObserver.unobserve(container);
    }, [map]);

    useEffect(() => {
        if (lat && lng) {
            const performCenter = () => {
                if (map) {
                    map.invalidateSize();
                    map.setView([lat, lng], 16);
                }
            };

            // Aggressive centering strategy: 
            // Call multiple times to catch the end of any CSS transitions (framer-motion, etc)
            performCenter();
            const t1 = setTimeout(performCenter, 100);
            const t2 = setTimeout(performCenter, 500);
            const t3 = setTimeout(performCenter, 1000);

            return () => {
                clearTimeout(t1);
                clearTimeout(t2);
                clearTimeout(t3);
            };
        }
    }, [lat, lng, map]);
    return null;
};

const Register = ({ isEmbed = false, onBackToLogin }) => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [loading, setLoading] = useState(false);

    // --- BASIC FORM STATE ---
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        role: 'School Head', // Hardcoded for school head portal registration only
        schoolEmail: '', // School Head: actual school email (used as Firebase auth email)
        contactNumber: '', // School Head: 11-digit contact number
        password: '',
        confirmPassword: '',
        passcode: ''
    });

    const [currentStep, setCurrentStep] = useState(1);
    const maxSteps = 5;
    const [validationError, setValidationError] = useState('');
    const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward

    const slideVariants = {
        enter: (dir) => ({
            opacity: 0,
            x: dir > 0 ? 35 : -35,
        }),
        center: {
            opacity: 1,
            x: 0,
        },
        exit: (dir) => ({
            opacity: 0,
            x: dir > 0 ? -35 : 35,
        }),
    };

    // Track original location to allow undo
    const [originalSchoolLocation, setOriginalSchoolLocation] = useState(null);

    // --- REGISTRATION STAGES ---
    const [registrationStage, setRegistrationStage] = useState('form'); // 'form' | 'passcode' | 'confirm'

    // --- SCHOOL HEAD CASCADING OPTIONS STATE ---
    const [regions, setRegions] = useState([]);
    const [divisions, setDivisions] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [municipalities, setMunicipalities] = useState([]);
    const [availableSchools, setAvailableSchools] = useState([]);

    // Cascading Selections (5-Step Hierarchy)
    const [selectedRegion, setSelectedRegion] = useState('');
    const [selectedDivision, setSelectedDivision] = useState('');
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [selectedMunicipality, setSelectedMunicipality] = useState('');
    const [selectedSchool, setSelectedSchool] = useState(null);

    // Map Marker Ref
    const markerRef = useRef(null);

    // --- 1. LOAD INITIAL DATA (Regions only) ---
    useEffect(() => {
        // Load Regions from API
        fetch(api(`/locations/regions`))
            .then(res => res.json())
            .then(data => setRegions(Array.isArray(data) ? data : []))
            .catch(err => console.error("Failed to load regions:", err));
    }, []);

    // --- 2. CASCADING EFFECTS ---

     // Load Divisions when Region changes
    useEffect(() => {
        setDivisions([]);
        // Note: Downstream selections (division, district...) should be cleared by the change handler
        if (selectedRegion) {
            fetch(api(`/locations/divisions?region=${encodeURIComponent(selectedRegion)}`))
                .then(res => res.json())
                .then(data => {
                    const options = Array.isArray(data) ? data : [];
                    if (selectedRegion === 'BLANK REGION' && !options.includes('BLANK DIVISION')) options.unshift('BLANK DIVISION');
                    setDivisions(options);
                })
                .catch(console.error);
        }
    }, [selectedRegion]);

    // Load Districts when Division changes
    useEffect(() => {
        setDistricts([]);
        if (selectedRegion && selectedDivision) {
            fetch(api(`/locations/districts?region=${encodeURIComponent(selectedRegion)}&division=${encodeURIComponent(selectedDivision)}`))
                .then(res => res.json())
                .then(data => {
                    const options = Array.isArray(data) ? data : [];
                    if (selectedDivision === 'BLANK DIVISION' && !options.includes('BLANK DISTRICT')) options.unshift('BLANK DISTRICT');
                    setDistricts(options);
                })
                .catch(console.error);
        }
    }, [selectedRegion, selectedDivision]);

    // Load Municipalities when District changes
    useEffect(() => {
        setMunicipalities([]);
        if (selectedRegion && selectedDivision && selectedDistrict) {
            fetch(api(`/locations/municipalities?region=${encodeURIComponent(selectedRegion)}&division=${encodeURIComponent(selectedDivision)}&district=${encodeURIComponent(selectedDistrict)}`))
                .then(res => res.json())
                .then(data => {
                    const options = Array.isArray(data) ? data : [];
                    if (selectedDistrict === 'BLANK DISTRICT' && !options.includes('BLANK MUNICIPALITY')) options.unshift('BLANK MUNICIPALITY');
                    setMunicipalities(options);
                })
                .catch(console.error);
        }
    }, [selectedRegion, selectedDivision, selectedDistrict]);

    // Load Schools when Municipality changes
    useEffect(() => {
        setAvailableSchools([]);
        if (selectedRegion && selectedDivision && selectedDistrict && selectedMunicipality) {
            fetch(api(`/locations/schools?region=${encodeURIComponent(selectedRegion)}&division=${encodeURIComponent(selectedDivision)}&district=${encodeURIComponent(selectedDistrict)}&municipality=${encodeURIComponent(selectedMunicipality)}`))
                .then(res => res.json())
                .then(data => {
                    const options = Array.isArray(data) ? data : [];
                    if (selectedMunicipality === 'BLANK MUNICIPALITY' && !options.some(s => s.school_id === '000000')) {
                        options.unshift({ 
                            school_id: '000000', 
                            school_name: 'BLANK SCHOOL',
                            region: 'BLANK REGION',
                            division: 'BLANK DIVISION',
                            district: 'BLANK DISTRICT',
                            municipality: 'BLANK MUNICIPALITY',
                            province: 'BLANK PROVINCE',
                            barangay: 'BLANK BARANGAY',
                            latitude: 0,
                            longitude: 0
                        });
                    }
                    setAvailableSchools(options);
                })
                .catch(console.error);
        }
    }, [selectedRegion, selectedDivision, selectedDistrict, selectedMunicipality]);
    
    // --- HANDLERS ---
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        
        // Cascading State Sync (for lookups)
        if (name === 'region') {
            setSelectedRegion(value);
            setSelectedDivision('');
            setSelectedDistrict('');
            setSelectedMunicipality('');
            setSelectedSchool(null);
        }
        if (name === 'division') {
            setSelectedDivision(value);
            setSelectedDistrict('');
            setSelectedMunicipality('');
            setSelectedSchool(null);
        }
        if (name === 'district') {
            setSelectedDistrict(value);
            setSelectedMunicipality('');
            setSelectedSchool(null);
        }
    };


    const handleSchoolSelect = (e) => {
        const schoolId = e.target.value;
        if (!schoolId) {
            setSelectedSchool(null);
            return;
        }

        const school = availableSchools.find(s => s.school_id === schoolId);
        // Store original location for undo
        if (school) {
            setOriginalSchoolLocation({
                latitude: school.latitude,
                longitude: school.longitude
            });
        }
        // Create a copy so we can modify latitude/longitude without affecting the source data
        setSelectedSchool({ ...school });
    };

    const handleUndoLocation = () => {
        if (originalSchoolLocation) {
            setSelectedSchool(prev => ({
                ...prev,
                latitude: originalSchoolLocation.latitude,
                longitude: originalSchoolLocation.longitude
            }));
        }
    };

    const validateStep = (step) => {
        const d = formData;
        if (step === 1) {
            if (!d.firstName || !d.lastName) {
                setValidationError("Need to fill up the required fields first");
                return false;
            }
            return true;
        }

        if (step === 2) {
            if (!d.schoolEmail || !d.contactNumber) {
                setValidationError("Email and Mobile Number are required.");
                return false;
            }
            if (d.contactNumber.length !== 11 || !d.contactNumber.startsWith('09')) {
                setValidationError("Please enter a valid 11-digit mobile number starting with 09.");
                return false;
            }
            if (!d.schoolEmail.toLowerCase().endsWith('@deped.gov.ph')) {
                setValidationError("Please use your official @deped.gov.ph school email.");
                return false;
            }
            return true;
        }

        if (step === 3) {
            if (!selectedSchool) {
                setValidationError("Please select your school.");
                return false;
            }
            return true;
        }

        if (step === 4) {
            if (!selectedSchool) {
                setValidationError("School data missing. Please go back and select your school again.");
                return false;
            }
            return true;
        }

        if (step === 5) {
            if (!formData.password) {
                setValidationError("Please enter a password.");
                return false;
            }
            if (formData.password.length < 6) {
                setValidationError("Password must be at least 6 characters.");
                return false;
            }
            if (formData.password !== formData.confirmPassword) {
                setValidationError("Passwords do not match.");
                return false;
            }
            return true;
        }
        return true;
    };

    const handleNext = () => {
        if (validateStep(currentStep)) {
            setDirection(1);
            setCurrentStep(prev => Math.min(prev + 1, maxSteps));
        }
    };

    const handleBack = () => {
        setDirection(-1);
        setCurrentStep(prev => Math.max(prev - 1, 1));
    };

    // --- 3. DRAGGABLE MARKER LOGIC ---
    const eventHandlers = useMemo(
        () => ({
            dragend() {
                const marker = markerRef.current;
                if (marker != null) {
                    const { lat, lng } = marker.getLatLng();
                    setSelectedSchool(prev => ({
                        ...prev,
                        latitude: lat,
                        longitude: lng
                    }));
                }
            },
        }),
        [],
    );

    // --- 4. REGISTRATION SUBMISSION ---
    const handleRegister = async (e) => {
        e.preventDefault();

        if (!selectedSchool) {
            setValidationError("Please select a school.");
            return;
        }

        const contactEmail = (formData.schoolEmail || '').trim();
        const contactDigits = (formData.contactNumber || '').replace(/\D/g, '');

        if (formData.password !== formData.confirmPassword) {
            setValidationError("Passwords do not match!");
            return;
        }

        const lowerEmail = contactEmail.toLowerCase();
        if (!lowerEmail.endsWith('@deped.gov.ph')) {
            setValidationError("Restricted Access: Please use your official DepEd email address (@deped.gov.ph).");
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
            setValidationError("Please enter a valid school email address.");
            return;
        }

        if (!contactDigits || contactDigits.length !== 11 || !contactDigits.startsWith('09')) {
            setValidationError("Please enter a valid 11-digit mobile number starting with 09.");
            return;
        }

        handleSubmitFinal();
    };
    const handleSubmitFinal = async () => {
        const contactDigits = (formData.contactNumber || '').replace(/\D/g, '');
        const contactEmail = (formData.schoolEmail || '').trim();

        setLoading(true);
        try {
            if (!selectedSchool) throw new Error("Please select a school.");

            // Backend Check
            console.log("Step A: Checking existing school...");
            const checkRes = await fetch(api(`/api/check-existing-school`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ schoolId: selectedSchool.school_id })
            });
            if (!checkRes.ok) {
                const errorText = await checkRes.text();
                throw new Error(`Check School Failed (${checkRes.status}): ${errorText || 'No detail'}`);
            }
            const checkText = await checkRes.text();
            if (!checkText) throw new Error("Empty response from /api/check-existing-school");
            const checkData = JSON.parse(checkText);
            if (checkData.exists) {
                throw new Error(checkData.message || "School already registered.");
            }

            // Unified Native Registration and Persistence
            const finalSchoolData = {
                ...selectedSchool,
                curricularOffering: ""
            };

            const endpoint = 'api/register-beta';
            const regRes = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: contactEmail,
                    password: formData.password,
                    contactNumber: contactDigits,
                    firstName: formData.firstName,
                    lastName: formData.lastName,
                    schoolData: finalSchoolData
                })
            });

            const regText = await regRes.text();
            if (!regRes.ok) {
                let errorMessage = `Registration Failed (${regRes.status})`;
                try {
                    const errData = JSON.parse(regText);
                    errorMessage = errData.error || errData.message || errorMessage;
                } catch (e) {
                    errorMessage = regText || errorMessage;
                }
                throw new Error(errorMessage);
            }
            
            if (!regText) throw new Error("Empty response from " + endpoint);
            const regData = JSON.parse(regText);

            if (regData.success && regData.token) {
                localStorage.setItem('needs_pin_setup', 'true');
                login(regData.user, regData.token);
                
                localStorage.setItem('userRole', formData.role);
                if (selectedSchool?.school_id) {
                    localStorage.setItem('schoolId', selectedSchool.school_id);
                }
                if (regData?.user?.uid) {
                    localStorage.setItem('uid', regData.user.uid);
                }

                // AUTO-SEED UNIT 1 FOR OFFLINE READINESS
                try {
                    const iernFetch = await fetch(api(`/schools_iern/${selectedSchool.school_id}`)).catch(() => null);
                    let iernData = null;
                    if (iernFetch?.ok) {
                        const iernRes = await iernFetch.json();
                        if (iernRes.exists) iernData = iernRes.data;
                    }

                    const src = iernData || selectedSchool;

                    const seedData = {
                        school_id: selectedSchool.school_id,
                        school_name: (src.school_name || src.School_Name || "").trim(),
                        region: (src.region || src.Region || selectedRegion || "").trim(),
                        province: (src.province || src.Province || "").trim(),
                        municipality: (src.municipality || src.Municipality || src.city || src.City || selectedMunicipality || "").trim(),
                        barangay: (src.barangay || src.Barangay || "").trim(),
                        division: (src.division || src.Division || src.Schools_Division_Office || src.SDO || selectedDivision || "").trim(),
                        district: (src.district || src.District || src.Schools_District || selectedDistrict || "").trim(),
                        leg_district: (src.leg_district || src.Leg_District || src.Legislative_District || "").trim(),
                        latitude: selectedSchool.latitude || src.latitude || src.Latitude || "",
                        longitude: selectedSchool.longitude || src.longitude || src.Longitude || "",
                        iern: (src.iern || src.IERN || "").trim()
                    };
                    
                    await saveUnitDraft(1, selectedSchool.school_id, { 
                        step: 0, 
                        formData: seedData,
                        lastUpdated: Date.now(),
                        isAutoSeeded: true 
                    });

                    await saveSchoolToCache({ ...seedData, school_id: selectedSchool.school_id });
                    
                    console.log("UNIT 1 AUTO-SEEDED AND CACHED FOR OFFLINE READINESS");
                } catch (seedErr) {
                    console.warn("Auto-seeding Unit 1 failed:", seedErr);
                }

                navigate('/nodes-dashboard');
                return;
            } else {
                throw new Error(regData.error || "Registration succeeded but no session was established. Please log in.");
            }

        } catch (error) {
            console.error("Registration Error:", error);
            setValidationError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const content = (
        <div className={isEmbed ? "w-full max-h-[75vh] overflow-y-auto custom-scrollbar relative z-10 px-2 text-white" : "bg-white/90 backdrop-blur-xl border border-white/20 shadow-2xl rounded-[2rem] p-6 md:p-8 w-full max-h-[75vh] overflow-y-auto custom-scrollbar relative z-10"}>
            {/* Header */}

                        {/* Header */}
                        {registrationStage === 'form' && (
                            <div className="text-center mb-6">
                                {!isEmbed && <img src={logo} alt="InsightED Ratio" className="h-20 mx-auto mb-4 object-contain drop-shadow-sm" />}
                                <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Create Account</h2>
                                <p className="text-slate-500 font-medium">Step {currentStep} of {maxSteps}</p>
                            </div>
                        )}

                        <form onSubmit={handleRegister} className="space-y-6">

                            {registrationStage === 'form' && (
                                <>
                                    {/* MODERN PROGRESS BAR INDICATOR */}
                                    <div className="mb-8 px-2 animate-in fade-in slide-in-from-top-4 duration-700">
                                        <div className="relative h-2 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                            <div 
                                                className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#0470BF] to-[#2596be] transition-all duration-700 ease-out" 
                                                style={{ width: `${(currentStep / maxSteps) * 100}%` }}
                                            ></div>
                                        </div>
                                        <div className="flex justify-between mt-2 px-1">
                                            <span className="text-[10px] font-black text-[#0470BF] uppercase tracking-widest leading-none">
                                                {currentStep === 1 ? 'Primary Details' : currentStep === 2 ? 'Credentials' : currentStep === 3 ? (formData.role === 'School Head' ? 'School Selection' : 'Area Alignment') : currentStep === 4 ? 'Location/Geotag' : 'Final Security'}
                                            </span>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                                {Math.round((currentStep / maxSteps) * 100)}% Complete
                                            </span>
                                        </div>
                                    </div>
                                    <AnimatePresence mode="wait">
                                        {/* STEP 1: IDENTITY & ROLE */}
                                        {currentStep === 1 && (
                                            <motion.div
                                                key="step-1"
                                                custom={direction}
                                                variants={slideVariants}
                                                initial="enter"
                                                animate="center"
                                                exit="exit"
                                                transition={{ duration: 0.24, ease: "easeInOut" }}
                                                className="space-y-6"
                                            >
                                                <div className="space-y-4">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-1">
                                                            <label className="text-xs font-bold text-slate-500 uppercase ml-1">First Name</label>
                                                            <input name="firstName" value={formData.firstName} placeholder="Enter First Name" onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" required />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Last Name</label>
                                                            <input name="lastName" value={formData.lastName} placeholder="Enter Last Name" onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" required />
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}

                                        {/* STEP 2: CONTACT INFORMATION */}
                                        {currentStep === 2 && (
                                            <motion.div
                                                key="step-2"
                                                custom={direction}
                                                variants={slideVariants}
                                                initial="enter"
                                                animate="center"
                                                exit="exit"
                                                transition={{ duration: 0.24, ease: "easeInOut" }}
                                                className="space-y-6"
                                            >
                                                <div className="p-4 bg-[#0470BF]/5 rounded-2xl border border-[#0470BF]/20 flex items-start gap-4">
                                                    <div className="bg-[#0470BF] text-white w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-md font-bold text-xs">2</div>
                                                    <div>
                                                        <h3 className="font-bold text-white">Communication</h3>
                                                        <p className="text-xs text-slate-300">How we reaching you for recovery and updates.</p>
                                                    </div>
                                                </div>

                                                <div className="space-y-4 px-1">
                                                    <>
                                                        <div className="space-y-1">
                                                            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Official School Email</label>
                                                            <div className="flex items-center w-full">
                                                                <input
                                                                    type="text"
                                                                    value={formData.schoolEmail ? formData.schoolEmail.split('@')[0] : ''}
                                                                    onChange={(e) => {
                                                                        const username = e.target.value.replace(/[^a-zA-Z0-9._-]/g, '');
                                                                        setFormData(prev => ({ ...prev, schoolEmail: username + '@deped.gov.ph' }));
                                                                    }}
                                                                    placeholder="account.username"
                                                                    className="flex-1 min-w-0 bg-white border border-r-0 border-slate-200 text-sm rounded-l-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                                                                    required
                                                                />
                                                                <span className="bg-slate-100 border border-l-0 border-slate-200 text-slate-600 text-xs font-bold px-4 py-3 rounded-r-xl select-none whitespace-nowrap">
                                                                    @deped.gov.ph
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1 text-slate-500 uppercase ml-1">
                                                            <label className="text-xs font-bold">Mobile Number</label>
                                                            <div className="relative">
                                                                <input
                                                                    name="contactNumber"
                                                                    inputMode="numeric"
                                                                    value={formData.contactNumber}
                                                                    onFocus={() => { if (!formData.contactNumber) setFormData(prev => ({ ...prev, contactNumber: '09' })); }}
                                                                    onChange={(e) => {
                                                                        let val = e.target.value.replace(/\D/g, '').slice(0, 11);
                                                                        if (val.length >= 2 && !val.startsWith('09')) val = '09' + val.substring(2);
                                                                        setFormData(prev => ({ ...prev, contactNumber: val }));
                                                                    }}
                                                                    placeholder="09xx xxx xxxx"
                                                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                                                    maxLength={11}
                                                                    required
                                                                />
                                                                <div className="absolute top-3.5 right-4 text-blue-500">
                                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                                                </div>
                                                            </div>
                                                            <p className="text-[10px] text-blue-600 ml-1">11 digits starting with 09.</p>
                                                        </div>
                                                    </>
                                                </div>
                                            </motion.div>
                                        )}
 
                                        {/* STEP 3: ASSIGNMENT & LOCATION */}
                                        {currentStep === 3 && (
                                            <motion.div
                                                key="step-3"
                                                custom={direction}
                                                variants={slideVariants}
                                                initial="enter"
                                                animate="center"
                                                exit="exit"
                                                transition={{ duration: 0.24, ease: "easeInOut" }}
                                                className="space-y-6"
                                            >
                                                <div className="space-y-4">
                                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                                        <h4 className="text-xs font-bold text-blue-800 uppercase mb-3 ml-1">Locate Your School</h4>
                                                        <div className="grid gap-3">
                                                            <select className="w-full p-3 rounded-xl bg-white border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={selectedRegion} onChange={(e) => { setSelectedRegion(e.target.value); setSelectedDivision(''); setSelectedDistrict(''); setSelectedMunicipality(''); setSelectedSchool(null); }}>
                                                                <option value="">Select Region</option>
                                                                {regions.map(r => <option key={r} value={r}>{r}</option>)}
                                                            </select>
                                                            <select className="w-full p-3 rounded-xl bg-white border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" value={selectedDivision} disabled={!selectedRegion} onChange={(e) => { setSelectedDivision(e.target.value); setSelectedDistrict(''); setSelectedMunicipality(''); setSelectedSchool(null); }}>
                                                                <option value="">Select Division</option>
                                                                {divisions.map(d => <option key={d} value={d}>{d}</option>)}
                                                            </select>
                                                            <select className="w-full p-3 rounded-xl bg-white border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" value={selectedDistrict} disabled={!selectedDivision} onChange={(e) => { setSelectedDistrict(e.target.value); setSelectedMunicipality(''); setSelectedSchool(null); }}>
                                                                <option value="">Select District</option>
                                                                {districts.map(d => <option key={d} value={d}>{d}</option>)}
                                                            </select>
                                                            <select className="w-full p-3 rounded-xl bg-white border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" value={selectedMunicipality} disabled={!selectedDistrict} onChange={(e) => { setSelectedMunicipality(e.target.value); setSelectedSchool(null); }}>
                                                                <option value="">Select Municipality</option>
                                                                {municipalities.map(m => <option key={m} value={m}>{m}</option>)}
                                                            </select>
                                                            <select className="w-full p-3 rounded-xl bg-blue-50 border border-blue-200 text-sm font-bold text-blue-900 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" value={selectedSchool?.school_id || ''} disabled={!selectedMunicipality} onChange={handleSchoolSelect}>
                                                                <option value="">Select School</option>
                                                                {availableSchools.map(s => <option key={s.school_id} value={s.school_id}>{s.school_name} - {s.school_id}</option>)}
                                                            </select>
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
 
                                        {/* STEP 4: GEOTAGGING */}
                                        {currentStep === 4 && (
                                            <motion.div
                                                key="step-4"
                                                custom={direction}
                                                variants={slideVariants}
                                                initial="enter"
                                                animate="center"
                                                exit="exit"
                                                transition={{ duration: 0.24, ease: "easeInOut" }}
                                                className="space-y-6"
                                            >
                                                {selectedSchool && (
                                                    <div className="space-y-6">
                                                        {/* User ID Emphasis */}
                                                        <div className="bg-gradient-to-br from-slate-900 to-blue-950 p-6 rounded-[2rem] text-center shadow-2xl relative overflow-hidden group">
                                                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                                                <svg className="w-20 h-20 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                            </div>
                                                            <label className="block text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-3">Your Unique Login Username</label>
                                                            <div className="text-4xl font-mono font-black text-white tracking-[0.2em] mb-4 drop-shadow-md">{selectedSchool.school_id}</div>
                                                            <div className="flex items-center justify-center gap-2 py-2 px-4 bg-white/10 rounded-full border border-white/10 inline-flex mx-auto">
                                                                <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                                                                <span className="text-[11px] font-bold text-blue-100 uppercase tracking-widest">Always use this ID to sign in.</span>
                                                            </div>
                                                        </div>
 
                                                        {/* Geotagging Map */}
                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between px-1">
                                                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Refine School Position</h4>
                                                                <div className="flex items-center gap-2">
                                                                    {originalSchoolLocation && (parseFloat(selectedSchool.latitude) !== parseFloat(originalSchoolLocation.latitude) || parseFloat(selectedSchool.longitude) !== parseFloat(originalSchoolLocation.longitude)) && (
                                                                        <button 
                                                                            type="button"
                                                                            onClick={handleUndoLocation}
                                                                            className="text-[10px] font-black text-white bg-rose-500 px-3 py-1 rounded-lg border border-rose-600 shadow-sm active:scale-95 transition-all flex items-center gap-1"
                                                                        >
                                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                                                                            UNDO
                                                                        </button>
                                                                    )}
                                                                    <span className="text-[10px] font-bold text-[#0470BF] bg-[#0470BF]/5 px-2 py-1 rounded-lg border border-[#0470BF]/20 animate-pulse">DRAG MARKER TO MOVE</span>
                                                                </div>
                                                            </div>
                                                            {selectedSchool.latitude && (
                                                                <div className="space-y-4">
                                                                    <div className="grid grid-cols-2 gap-3">
                                                                        <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl">
                                                                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Latitude</label>
                                                                            <div className="text-sm font-mono font-bold text-slate-700">{parseFloat(selectedSchool.latitude).toFixed(6)}</div>
                                                                        </div>
                                                                        <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl">
                                                                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Longitude</label>
                                                                            <div className="text-sm font-mono font-bold text-slate-700">{parseFloat(selectedSchool.longitude).toFixed(6)}</div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="w-full h-[250px] rounded-[2rem] overflow-hidden border-4 border-white shadow-2xl relative z-0">
                                                                        <MapContainer center={[parseFloat(selectedSchool.latitude), parseFloat(selectedSchool.longitude)]} zoom={16} style={{ height: '100%', width: '100%' }}>
                                                                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                                                            <RecenterMap lat={parseFloat(selectedSchool.latitude)} lng={parseFloat(selectedSchool.longitude)} />
                                                                            <Marker position={[parseFloat(selectedSchool.latitude), parseFloat(selectedSchool.longitude)]} draggable={true} eventHandlers={eventHandlers} ref={markerRef}>
                                                                                <Popup>Drag to refine location</Popup>
                                                                            </Marker>
                                                                        </MapContainer>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}
 
                                        {/* STEP 5: SECURITY */}
                                        {currentStep === 5 && (
                                            <motion.div
                                                key="step-security"
                                                custom={direction}
                                                variants={slideVariants}
                                                initial="enter"
                                                animate="center"
                                                exit="exit"
                                                transition={{ duration: 0.24, ease: "easeInOut" }}
                                                className="space-y-6"
                                            >
                                                <div className="space-y-4">
                                                    <div className="space-y-1">
                                                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Account Password</label>
                                                        <input name="password" type="password" placeholder="Min. 6 characters" onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" required />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Confirm Password</label>
                                                        <input name="confirmPassword" type="password" placeholder="Repeat password" onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" required />
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* NAVIGATION BUTTONS */}
                                    <div className="flex gap-4 pt-4">
                                        {currentStep > 1 && (
                                            <button type="button" onClick={handleBack} className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
                                                Back
                                            </button>
                                        )}
                                        {currentStep < maxSteps ? (
                                            <button type="button" onClick={handleNext} className="flex-[2] px-6 py-4 bg-[#0470BF] hover:bg-[#0580da] text-white font-bold rounded-2xl shadow-lg shadow-blue-200/50 transition-all active:scale-95 flex items-center justify-center gap-2">
                                                Continue
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                                            </button>
                                        ) : (
                                            <button type="submit" disabled={loading} className="flex-[2] px-6 py-4 bg-gradient-to-r from-[#0470BF] to-[#175ea1] hover:from-[#0580da] hover:to-[#1a6cb3] text-white font-bold rounded-2xl shadow-xl shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                                                {loading ? 'Registering...' : 'Register Account'}
                                                {!loading && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>}
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}


                        </form>

                        <div className="mt-8 text-center pt-6 border-t border-slate-100">
                            {isEmbed ? (
                                <Link to="/login" className="text-sm font-semibold text-[#0470BF] hover:text-[#0580da]">Back to Login</Link>
                            ) : (
                                <Link to="/" className="text-sm font-semibold text-[#0470BF] hover:text-[#0580da]">Back to Login</Link>
                            )}
                        </div>
        </div>
    );

    if (isEmbed) {
        return (
            <>
                {content}
                {/* VALIDATION WARNING MODAL */}
                {validationError && (
                    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                        <div className="bg-[#0b203c] rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl text-center relative overflow-hidden border border-blue-900/40">
                            <div className="w-20 h-20 bg-amber-500/10 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-amber-500/20 shadow-inner">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-10 h-10">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                </svg>
                            </div>
                            <h3 className="text-2xl font-black mb-2 tracking-tight" style={{ color: '#ffffff' }}>Required Fields</h3>
                            <p className="text-sm leading-relaxed mb-8 font-medium" style={{ color: '#cbd5e1' }}>
                                {validationError}
                            </p>
                            <button
                                onClick={() => setValidationError('')}
                                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-2xl shadow-xl shadow-blue-900/20 transition transform active:scale-[0.98] uppercase tracking-widest text-[10px]"
                                style={{ color: '#ffffff' }}
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                )}
            </>
        );
    }

    return (
        <PageTransition>
            <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden py-10">
                {/* Blueprint Background */}
                <BlueprintBackground />

                <div className="relative z-10 w-[90%] max-w-xl">
                    {content}
                </div>

                {/* VALIDATION WARNING MODAL */}
                {validationError && (
                    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                        <div className="bg-[#0b203c] rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl text-center relative overflow-hidden border border-blue-900/40">
                            <div className="w-20 h-20 bg-amber-500/10 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-amber-500/20 shadow-inner">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-10 h-10">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                </svg>
                            </div>
                            <h3 className="text-2xl font-black mb-2 tracking-tight" style={{ color: '#ffffff' }}>Required Fields</h3>
                            <p className="text-sm leading-relaxed mb-8 font-medium" style={{ color: '#cbd5e1' }}>
                                {validationError}
                            </p>
                            <button
                                onClick={() => setValidationError('')}
                                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-2xl shadow-xl shadow-blue-900/20 transition transform active:scale-[0.98] uppercase tracking-widest text-[10px]"
                                style={{ color: '#ffffff' }}
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </PageTransition>
    );
};

export default Register;
