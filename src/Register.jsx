// src/Register.jsx

import React, { useState, useEffect, useRef, useMemo } from 'react';
import logo from './assets/InsightEd1.png';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { FiLock } from 'react-icons/fi';
import { saveUnitDraft, saveSchoolToCache } from './db';
import PageTransition from './components/PageTransition';
import Papa from 'papaparse';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// --- CONSTANTS ---111111
const CSV_PATH = `${import.meta.env.BASE_URL}schools.csv`;
const OFFICES_CSV_PATH = `${import.meta.env.BASE_URL}Personnel Positions by Functional Division at RO and SDO Levels - Sheet1.csv`;

// --- AUTHORIZATION CODES (Secure & Alphanumeric) ---
const AUTHORIZATION_CODES = {
    'Central Office': '8XK2-M9P4',
    'Regional Office': 'H7V3-L5N1',
    'School Division Office': 'Q9D2-R4J6',
    'Division Engineer': 'E5T8-B2W3',
    'Regional Engineer': 'E5T8-B2W3',
    'Non-DepEd Engineer': 'E5T8-B2W3',
    'Architect': 'E5T8-B2W3',
    'Local Government Unit': 'L2G7-X4Z9',
    'Central Office Finance': '8XK2-M9P4', // Same as Central Office
    'Super User': 'SUP3R-US3R', // Added for testing
    // 'Admin' is usually hidden or database-only, but adding for completeness if enabled in dropdown
    'Admin': 'A3M6-Y1K8',
    'EFD Engineer': 'EFD8-C1D9',
    'Implementing Agency': 'AG5N-K9L2'
};


const getDashboardPath = (role, accountCategory) => {
    // 1. SPECIFIC ROLE OVERRIDES (Highest Priority)
    const roleMap = {
        'School Head': '/nodes-dashboard',
        'Regional Office': '/monitoring-dashboard',
        'School Division Office': '/monitoring-dashboard',
        'Central Office': '/monitoring-dashboard',
        'Admin': '/admin-dashboard',
        'Human Resource': '/hr-dashboard',
        'Super User': '/super-user-selector',
        'Super Admin': '/educational-dashboard',
        'Local Government Unit': '/lgu-dashboard',
        'Central Office Finance': '/finance-dashboard',
        'Finance': '/finance-dashboard',
        'Implementing Agency': '/agency-dashboard',
        'EFD': '/efd-dashboard',
        'EFD Engineer': '/efd-dashboard',
        'HRODI': '/efd-dashboard',
        'PGO': '/agency-dashboard',
        'CGO': '/agency-dashboard',
        'MGO': '/agency-dashboard',
        'DPWH': '/agency-dashboard',
        'CSO': '/agency-dashboard',
    };

    if (roleMap[role]) return roleMap[role];

    // 2. ENGINEER SPECIAL REDIRECTS
    if (role === 'Regional Engineer') return '/regional-engineer-dashboard';

    if (role === 'DepEd Engineer' || role === 'Non-DepEd Engineer' || role === 'Engineer' || role === 'Division Engineer' || role === 'Architect') {
        return (accountCategory === 'Non-DepEd Engineer' || role === 'Non-DepEd Engineer')
            ? '/non-deped-dashboard'
            : '/engineer-dashboard';
    }

    return '/'; // Final fallback
};




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

const Register = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [loading, setLoading] = useState(false);

    const location = useLocation();
    const pathId = location.state?.pathId;

    // --- BASIC FORM STATE ---
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '', // Generic roles auth email
        schoolEmail: '', // School Head: actual school email (used as Firebase auth email)
        contactNumber: '', // School Head: 11-digit contact number
        password: '',
        confirmPassword: '',
        role: 'School Head', // Default
        // Legacy/Other Role Fields
        bureau: '',
        office: '',
        position: '',
        region: '',
        division: '',
        province: '',
        city: '',
        barangay: '',
        authCode: '',
        altEmail: '',
        accountCategory: '', // Added this line
        agencyType: '',
        specificAgency: '',
        passcode: ''
    });

    const [currentStep, setCurrentStep] = useState(1);
    const maxSteps = formData.role === 'School Head' ? 5 : (formData.role === 'EFD Engineer' ? 3 : 4);

    // Track original location to allow undo
    const [originalSchoolLocation, setOriginalSchoolLocation] = useState(null);

    // --- AUTH TAB STATE (Internal vs External) ---
    const [activeTab, setActiveTab] = useState(pathId === 'path_agencies' ? 'external' : 'internal');

    // --- REGISTRATION STAGES ---
    const [registrationStage, setRegistrationStage] = useState('form'); // 'form' | 'passcode' | 'confirm'


    // --- OTP STATE --- (REMOVED)




    // --- LOCATION DROPDOWN STATE (Generic Roles) ---
    const [provinceOptions, setProvinceOptions] = useState([]);
    const [cityOptions, setCityOptions] = useState([]);
    const [barangayOptions, setBarangayOptions] = useState([]);

    // --- SCHOOL HEAD CASCADING OPTIONS STATE ---
    const [regions, setRegions] = useState([]);
    const [divisions, setDivisions] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [municipalities, setMunicipalities] = useState([]);
    const [availableSchools, setAvailableSchools] = useState([]);

    // --- OFFICE DATA STATE ---
    const [officeData, setOfficeData] = useState([]);
    const [isOfficeCsvLoaded, setIsOfficeCsvLoaded] = useState(false);

    // Cascading Selections (5-Step Hierarchy)
    const [selectedRegion, setSelectedRegion] = useState('');
    const [selectedDivision, setSelectedDivision] = useState('');
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [selectedMunicipality, setSelectedMunicipality] = useState('');
    const [selectedSchool, setSelectedSchool] = useState(null);

    // Map Marker Ref
    const markerRef = useRef(null);

    // --- REGISTRATION SUCCESS STATE ---
    const [showNcrModal, setShowNcrModal] = useState(false);



    // --- 1. LOAD INITIAL DATA (Regions + Office CSV) ---
    useEffect(() => {
        // Handle Path Restrictions from Launch Pad
        if (pathId) {
            console.log("[Register] Enforcing path-based restrictions:", pathId);
            if (pathId === 'path_school_head') {
                setFormData(prev => ({ ...prev, role: 'School Head' }));
                setActiveTab('internal');
            } else if (pathId === 'path_ro_sd') {
                setFormData(prev => ({ ...prev, role: 'Regional Office' }));
                setActiveTab('internal');
            } else if (pathId === 'path_engineers') {
                setFormData(prev => ({ ...prev, role: 'Division Engineer' }));
                setActiveTab('internal');
            } else if (pathId === 'path_agencies') {
                setFormData(prev => ({ ...prev, role: 'Implementing Agency' }));
                setActiveTab('external');
            } else if (pathId === 'path_efd') {
                setFormData(prev => ({ ...prev, role: 'EFD Engineer' }));
                setActiveTab('internal');
            } else if (pathId === 'path_central_office') {
                setFormData(prev => ({ ...prev, role: 'Central Office' }));
                setActiveTab('internal');
            }
        }

        // Load Regions from API

        fetch('/api/locations/regions')
            .then(res => res.json())
            .then(data => setRegions(data || []))
            .catch(err => console.error("Failed to load regions:", err));

        // Load Functional Divisions from API
        fetch('/api/reference/functional-divisions')
            .then(res => res.json())
            .then(data => {
                if (data && data.length > 0) {
                    // Map back to the keys used in CSV filtering to minimize code changes
                    const mappedData = data.map(item => ({
                        'Governance Level': item.governance_level,
                        'Functional Division': item.functional_division
                    }));
                    setOfficeData(mappedData);
                    setIsOfficeCsvLoaded(true);
                }
            })
            .catch(err => console.error("Failed to load functional divisions:", err));
    }, []);

    // --- 2. CASCADING EFFECTS ---

    // Load Divisions when Region changes
    useEffect(() => {
        setDivisions([]);
        // Note: Downstream selections (division, district...) should be cleared by the change handler
        if (selectedRegion) {
            fetch(`/api/locations/divisions?region=${encodeURIComponent(selectedRegion)}`)
                .then(res => res.json())
                .then(data => {
                    const options = data || [];
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
            fetch(`/api/locations/districts?region=${encodeURIComponent(selectedRegion)}&division=${encodeURIComponent(selectedDivision)}`)
                .then(res => res.json())
                .then(data => {
                    const options = data || [];
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
            fetch(`/api/locations/municipalities?region=${encodeURIComponent(selectedRegion)}&division=${encodeURIComponent(selectedDivision)}&district=${encodeURIComponent(selectedDistrict)}`)
                .then(res => res.json())
                .then(data => {
                    const options = data || [];
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
            fetch(`/api/locations/schools?region=${encodeURIComponent(selectedRegion)}&division=${encodeURIComponent(selectedDivision)}&district=${encodeURIComponent(selectedDistrict)}&municipality=${encodeURIComponent(selectedMunicipality)}`)
                .then(res => res.json())
                .then(data => {
                    const options = data || [];
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
    
    useEffect(() => {
            const { role, agencyType, province, city, region } = formData;
            const isExternalAgency = role === 'Implementing Agency' || ['PGO', 'CGO', 'MGO', 'DPWH', 'CSO'].includes(role);
            
            if (isExternalAgency) {
            
            // 1. NCR Validation for PGO
            if (agencyType === 'PGO' && region === 'NCR') {
                setShowNcrModal(true);
                setFormData(prev => ({ 
                    ...prev, 
                    region: '', 
                    province: '', 
                    city: '', 
                    specificAgency: '' 
                }));
                setSelectedRegion('');
                return;
            }

            // 2. Auto-fill Specific Agency Name
            let autoName = '';
            if (agencyType === 'PGO' && province) {
                autoName = `PGO - ${province}`;
            } else if (agencyType === 'CGO' && city) {
                if (city.toUpperCase() === 'PATEROS') {
                    // Pateros special case: Switch to MGO
                    setFormData(prev => ({ ...prev, agencyType: 'MGO', specificAgency: 'MGO - Pateros' }));
                    return;
                }
                autoName = `CGO - ${city}`;
            } else if (agencyType === 'MGO' && city) {
                autoName = `MGO - ${city}`;
            }

            // Only update if it's one of the auto-fill types and if it actually changed to prevent loops
            if (['PGO', 'CGO', 'MGO'].includes(agencyType)) {
               if (formData.specificAgency !== autoName) {
                    setFormData(prev => ({ ...prev, specificAgency: autoName }));
               }
            }
        }
    }, [formData.role, formData.agencyType, formData.region, formData.province, formData.city]);




    // --- OFFICE DROPDOWN LOGIC ---
    const regionalOffices = useMemo(() => {
        if (!isOfficeCsvLoaded) return [];
        const divisionsMap = {};
        officeData
            .filter(row => row['Governance Level'] && row['Governance Level'].includes('Regional Office'))
            .forEach(row => {
                const val = row['Functional Division'];
                if (val) {
                    const u = val.toUpperCase().trim();
                    if (!divisionsMap[u]) divisionsMap[u] = val.trim();
                }
            });
        return Object.values(divisionsMap).sort();
    }, [officeData, isOfficeCsvLoaded]);

    const divisionOffices = useMemo(() => {
        if (!isOfficeCsvLoaded) return [];
        const divisionsMap = {};
        officeData
            .filter(row => row['Governance Level'] && row['Governance Level'].includes('Schools Division Office'))
            .forEach(row => {
                const val = row['Functional Division'];
                if (val) {
                    const u = val.toUpperCase().trim();
                    if (!divisionsMap[u]) divisionsMap[u] = val.trim();
                }
            });
        return Object.values(divisionsMap).sort();
    }, [officeData, isOfficeCsvLoaded]);

    const centralOfficeBureaus = useMemo(() => {
        if (!isOfficeCsvLoaded) return [];
        const divisionsMap = {};
        officeData
            .filter(row => row['Governance Level'] && row['Governance Level'].includes('Central Office'))
            .forEach(row => {
                const val = row['Functional Division'];
                if (val) {
                    const u = val.toUpperCase().trim();
                    if (!divisionsMap[u]) divisionsMap[u] = val.trim();
                }
            });
        return Object.values(divisionsMap).sort();
    }, [officeData, isOfficeCsvLoaded]);

    // --- HANDLERS ---
    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleRoleChange = (e) => {
        const newRole = e.target.value;
        setFormData(prev => ({
            ...prev,
            role: newRole,
            // Reset location fields on role change
            region: '', division: '', province: '', city: '', barangay: '', office: '', position: '',
            // Reset role-specific fields
            schoolEmail: '', contactNumber: '', altEmail: '', accountCategory: ''
        }));
        // Reset school selection if moving away
        setSelectedSchool(null);
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

    // --- OTP HANDLERS ---


    // --- LOCATION HANDLERS (Generic Roles) ---
    const handleRegionChange = (e) => {
        const region = e.target.value;
        setFormData({
            ...formData,
            region,
            province: '', city: '', barangay: '', division: ''
        });

        // Trigger Cascading Load (Database)
        setSelectedRegion(region);

        // Cascading API load for Province/City/Barangay
        if (region) {
            fetch(`/api/locations/provinces?region=${encodeURIComponent(region)}`)
                .then(r => r.json())
                .then(data => {
                    const options = data || [];
                    if (region === 'BLANK REGION' && !options.includes('BLANK PROVINCE')) options.unshift('BLANK PROVINCE');
                    setProvinceOptions(options);
                })
                .catch(() => setProvinceOptions([]));
        } else {
            setProvinceOptions([]);
        }
        setCityOptions([]);
        setBarangayOptions([]);
    };

    const handleProvinceChange = (e) => {
        const province = e.target.value;
        setFormData({
            ...formData,
            province,
            city: '', barangay: ''
        });

        if (province && formData.region) {
            fetch(`/api/locations/municipalities-by-province?region=${encodeURIComponent(formData.region)}&province=${encodeURIComponent(province)}`)
                .then(r => r.json())
                .then(data => {
                    const options = data || [];
                    if (province === 'BLANK PROVINCE' && !options.includes('BLANK MUNICIPALITY')) options.unshift('BLANK MUNICIPALITY');
                    setCityOptions(options);
                })
                .catch(() => setCityOptions([]));
        } else {
            setCityOptions([]);
        }
        setBarangayOptions([]);
    };

    const handleCityChange = (e) => {
        const city = e.target.value;
        setFormData({
            ...formData,
            city,
            barangay: ''
        });

        if (city && formData.province && formData.region) {
            fetch(`/api/locations/barangays?region=${encodeURIComponent(formData.region)}&province=${encodeURIComponent(formData.province)}&municipality=${encodeURIComponent(city)}`)
                .then(r => r.json())
                .then(data => {
                    const options = (data || []).map(item => (typeof item === 'object' && item !== null) ? item.barangay : item);
                    if (city === 'BLANK MUNICIPALITY' && !options.includes('BLANK BARANGAY')) options.unshift('BLANK BARANGAY');
                    setBarangayOptions(options);
                })
                .catch(() => setBarangayOptions([]));
        } else {
            setBarangayOptions([]);
        }
    };

    // --- STEP NAVIGATION & VALIDATION ---
    const validateStep = (step) => {
        const d = formData;
        if (step === 1) {
            // Identity & Role
            if (!d.firstName || !d.lastName || !d.role) {
                alert("Please complete all fields in this step.");
                return false;
            }
            return true;
        }

        if (step === 2) {
            // Contact Info
            const email = (d.role === 'School Head') ? d.schoolEmail : d.email;
            if (!email || !d.contactNumber) {
                alert("Email and Mobile Number are required.");
                return false;
            }
            if (d.contactNumber.length !== 11 || !d.contactNumber.startsWith('09')) {
                alert("Please enter a valid 11-digit mobile number starting with 09.");
                return false;
            }
            if (d.role === 'School Head') {
                if (!email.toLowerCase().endsWith('@deped.gov.ph')) {
                    alert("Please use your official @deped.gov.ph school email.");
                    return false;
                }
            } else if (d.role === 'Implementing Agency' || d.role === 'Local Government Unit') {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    alert("Please enter a valid email address with a domain (e.g. user@gmail.com).");
                    return false;
                }
            } else {
                // All other roles (RO, SDO, Engineers, CO)
                if (!email.toLowerCase().endsWith('@deped.gov.ph')) {
                    alert("Only @deped.gov.ph email addresses are allowed for this role.");
                    return false;
                }
            }
            return true;
        }

        if (step === 3) {
            // Assignment / Location
            if (d.role === 'School Head') {
                if (!selectedSchool) {
                    alert("Please select your school.");
                    return false;
                }
            } else if (d.role === 'Implementing Agency' || d.role === 'Local Government Unit') {
                if (!d.region || !d.province) {
                    alert("Please complete your assignment location details.");
                    return false;
                }
                if (d.role === 'Implementing Agency' && (d.agencyType === 'CGO' || d.agencyType === 'MGO') && !d.city) {
                    alert("Please select your Municipality/City.");
                    return false;
                }
            } else {
                // RO / SDO / Engineers / CO
                const isCO = d.role === 'Central Office' || d.role === 'Central Office Finance' || d.role === 'Super User';
                const isSDO = d.role === 'School Division Office';
                const isEng = d.role.includes('Engineer') || d.role === 'Architect';

                if (isCO) {
                    if (!d.office) {
                        alert("Please select your Bureau/Service.");
                        return false;
                    }
                } else if (isSDO) {
                    if (!d.region || !d.division || !d.office || !d.position) {
                        alert("Please complete your assignment details (Region, Division, Office, and Position).");
                        return false;
                    }
                } else if (isEng) {
                    const isRegional = d.role === 'Regional Engineer';
                    if (!d.region || (!isRegional && !d.division) || !d.position) {
                        alert(`Please complete your assignment details (Region${!isRegional ? ', Division,' : ''} and Position).`);
                        return false;
                    }
                } else {
                    // RO Personnel
                    if (!d.region || !d.office || !d.position) {
                        alert("Please complete your assignment details (Region, Office, and Position).");
                        return false;
                    }
                }
            }
            return true;
        }

        if (step === 4 && d.role === 'School Head') {
            // Geotagging validation
            if (!selectedSchool) {
                alert("School data missing. Please go back and select your school again.");
                return false;
            }
            return true;
        }

        const securityStep = d.role === 'School Head' ? 5 : (d.role === 'EFD Engineer' ? 3 : 4);
        if (step === securityStep) {
            // Security
            if (!formData.password) {
                alert("Please enter a password.");
                return false;
            }
            if (formData.password.length < 6) {
                alert("Password must be at least 6 characters.");
                return false;
            }
            if (formData.password !== formData.confirmPassword) {
                alert("Passwords do not match.");
                return false;
            }
            return true;
        }
        return true;
    };

    const handleNext = () => {
        if (validateStep(currentStep)) {
            setCurrentStep(prev => Math.min(prev + 1, maxSteps));
        }
    };

    const handleBack = () => {
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

        // School Heads are identified by school_id only, others by email
        const identifier = (formData.role === 'School Head')
            ? selectedSchool.school_id
            : (formData.email || '').trim();

        const contactEmail = (formData.role === 'School Head')
            ? (formData.schoolEmail || '').trim()
            : identifier;

        const contactDigits = (formData.contactNumber || '').replace(/\D/g, '');

        // Basic Validations
        if (formData.password !== formData.confirmPassword) {
            alert("Passwords do not match!");
            return;
        }

        // --- AUTHORIZATION CODE CHECK (For Non-School Heads and Non-Super Users) ---
        if (formData.role !== 'School Head' && formData.role !== 'Implementing Agency' && formData.role !== 'Local Government Unit') {
            if (!formData.email.endsWith('@deped.gov.ph')) {
                alert("Only @deped.gov.ph email addresses are allowed for this role.");
                return;
            }
        }
        if (formData.role !== 'School Head') {
            const requiredCode = AUTHORIZATION_CODES[formData.role];
            if (requiredCode && formData.authCode !== requiredCode) {
                alert(`Invalid Authorization Code for ${formData.role}. Please send an email to support.stride@deped.gov.ph to obtain the secure code.`);
                return;
            }
        }

        if (formData.role === 'School Head') {
            if (!selectedSchool) {
                alert("Please select a school.");
                return;
            }

            // --- STRICT DEPED EMAIL VALIDATION ---
            const lowerEmail = contactEmail.toLowerCase();
            if (formData.role === 'School Head' && !lowerEmail.endsWith('@deped.gov.ph')) {
                alert("Restricted Access: Please use your official DepEd email address (@deped.gov.ph).");
                return;
            }

            // Basic email format check (redundant but safe)
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
                alert("Please enter a valid school email address.");
                return;
            }

            if (!contactDigits || contactDigits.length !== 11 || !contactDigits.startsWith('09')) {
                alert("Please enter a valid 11-digit mobile number starting with 09.");
                return;
            }
        }



        // STRICT EMAIL VALIDATION (Global Check)
        // This block is replaced by the more specific one above for non-School Head/Implementing Agency/LGU roles.
        // if (formData.role !== 'School Head' && formData.role !== 'Local Government Unit' && formData.role !== 'Implementing Agency' && !contactEmail.toLowerCase().endsWith('@deped.gov.ph')) {
        //     alert("Registration is restricted to official DepEd accounts (@deped.gov.ph).");
        //     return;
        // }

        // Engineer (Division/EFD) Specific Validations
        if (formData.role === 'Division Engineer' || formData.role === 'Regional Engineer' || formData.role === 'Architect' || formData.role === 'Non-DepEd Engineer' || formData.role === 'EFD Engineer') {
            if (formData.contactNumber.length !== 11) {
                alert("Please enter a valid 11-digit mobile number.");
                return;
            }
        }

        // Local Government Unit & Implementing Agency Specific Validations
        // --- CONTACT NUMBER VALIDATION (Global for Generic Roles) ---
        if (formData.role !== 'School Head') {
            if (formData.contactNumber.length !== 11) {
                alert("Please enter a valid 11-digit mobile number.");
                return;
            }
        }

        if (formData.role === 'Local Government Unit' || formData.role === 'Implementing Agency') {
            const isExternal = formData.role === 'Implementing Agency';
            const needsCity = !isExternal || !['PGO', 'DPWH', 'CSO'].includes(formData.agencyType);
            
            if (!formData.region || !formData.province || (needsCity && !formData.city)) {
                alert(`Please complete the Assignment details (Region, Province${needsCity ? ', Municipality' : ''}).`);
                return;
            }

            const emailToValidate = formData.email || '';
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailToValidate)) {
                alert("Please enter a valid email address with a domain (e.g. user@gmail.com).");
                return;
            }
        }

        // if (!isOtpVerified) {
        //     alert("Please verify your email via OTP before registering.");
        //     return;
        // }

        // Bypass Passcode Stage and go straight to Final Submission
        handleSubmitFinal();
    };


    const handleSubmitFinal = async () => {
        const contactDigits = (formData.contactNumber || '').replace(/\D/g, '');
        const identifier = (formData.role === 'School Head')
            ? selectedSchool.school_id
            : (formData.email || '').trim();

        const contactEmail = (formData.role === 'School Head')
            ? (formData.schoolEmail || '').trim()
            : identifier;

        setLoading(true);
        try {
            let regData = null;

            // STEP A: Pre-Checks for School Head (Already logically passed form validation, but backend check is safe)
            if (formData.role === 'School Head') {
                if (!selectedSchool) throw new Error("Please select a school.");

                // Backend Check
                console.log("Step A: Checking existing school...");
                const checkRes = await fetch('/api/check-existing-school', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ schoolId: selectedSchool.school_id })
                });
                console.log("Step A: Check response received", checkRes.status);
                if (!checkRes.ok) {
                    const errorText = await checkRes.text();
                    throw new Error(`Check School Failed (${checkRes.status}): ${errorText || 'No detail'}`);
                }
                const checkText = await checkRes.text();
                console.log("Step A: Check response text:", checkText);
                if (!checkText) throw new Error("Empty response from /api/check-existing-school");
                const checkData = JSON.parse(checkText);
                if (checkData.exists) {
                    throw new Error(checkData.message || "School already registered.");
                }
            }

            // STEP B & C: Unified Native Registration and Persistence
            if (formData.role === 'School Head') {
                // CALL NEW ONE-SHOT ENDPOINT
                console.log("SENDING REGISTRATION DATA:", {
                    ...selectedSchool
                });

                // selectedSchool now contains the updated latitude/longitude from the map drag
                const finalSchoolData = {
                    ...selectedSchool,
                    curricularOffering: ""
                };

                console.log("SENDING FINAL REGISTRATION DATA:", finalSchoolData);

                const endpoint = '/api/register-beta'; // Use the iern-check endpoint for school heads now
                const regRes = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: contactEmail, // Critical: Include DepEd email
                        password: formData.password,
                        contactNumber: contactDigits,
                        firstName: formData.firstName,
                        lastName: formData.lastName,
                        schoolData: finalSchoolData
                    })
                });

                const regText = await regRes.text();
                console.log("Step B: Registration response text:", regText);
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
                regData = JSON.parse(regText);

                if (regData.success && regData.token) {
                    localStorage.setItem('needs_pin_setup', 'true');
                    login(regData.user, regData.token);
                    
                    // Direct navigation for School Heads (bypass success modal)
                    localStorage.setItem('userRole', formData.role);
                    if (selectedSchool?.school_id) {
                        localStorage.setItem('schoolId', selectedSchool.school_id);
                    }
                    if (regData?.user?.uid) {
                        localStorage.setItem('uid', regData.user.uid);
                    }

                    // AUTO-SEED UNIT 1 FOR OFFLINE READINESS
                    try {
                        // 1. Fetch FULL metadata from schools_IERN to get all location details (Barangay, Province, etc.)
                        const iernFetch = await fetch(`/api/schools_iern/${selectedSchool.school_id}`).catch(() => null);
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
                            // selectedSchool has user-updated coordinates from map drag; registry is fallback only
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

                        // 3. ALSO CACHE EXPLICITLY FOR UNIT 1's SCHOOLS_CACHE (Backup)
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

            } else {
                // GENERIC REGISTRATION (Engineer, etc.)
                console.log("Syncing to Native Backend...");
                const regRes = await fetch('/api/register-user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: identifier, // Fixed variable bug
                        password: formData.password,
                        role: formData.role === 'Implementing Agency' ? (formData.agencyType || formData.role) : formData.role,
                        firstName: formData.firstName,
                        lastName: formData.lastName,
                        region: formData.region,
                        division: formData.role === 'Implementing Agency' ? `${formData.agencyType} ${formData.specificAgency}`.trim() : formData.division,
                        province: formData.province,
                        city: formData.city,
                        barangay: formData.barangay,
                        office: formData.office,
                        position: formData.position,
                        contactNumber: formData.contactNumber,
                        accountCategory: formData.role === 'Regional Engineer' ? 'DepEd Engineer' : formData.accountCategory
                    })
                });

                const regText = await regRes.text();
                console.log(`[Register] Native response (${regRes.status}):`, regText);

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

                if (!regText) throw new Error("Empty response from /api/register-user");
                regData = JSON.parse(regText);
                if (!regData.success) {
                    throw new Error(regData.error || "Server Registration Failed.");
                }

                console.log("✅ Registration Successful! Setting session...");
                localStorage.setItem('isNewUser', 'true'); // Flag for Nexus Welcome
                if (regData.token) {
                    login(regData.user, regData.token);
                } else {
                    throw new Error("No session token received.");
                }

                // Direct navigation for ALL generic roles (bypass success modal)
                localStorage.setItem('needs_pin_setup', 'true');
                const finalRole = formData.role === 'Implementing Agency' ? (formData.agencyType || formData.role) : formData.role;
                localStorage.setItem('userRole', finalRole);
                if (regData?.user?.uid) {
                    localStorage.setItem('uid', regData.user.uid);
                }
                localStorage.setItem('userEmail', identifier);

                const finalCategory = formData.role === 'Regional Engineer' ? 'DepEd Engineer' : (formData.accountCategory || ( (formData.role === 'EFD Engineer') ? 'EFD Engineer' : '' ));
                navigate(getDashboardPath(finalRole, finalCategory));
                return;
            }

            // Standard success fallback logic (legacy)
            if (regData) {
                localStorage.setItem('needs_pin_setup', 'true');
                const finalRole = formData.role;
                const destPath = getDashboardPath(finalRole, formData.accountCategory || '');
                navigate(destPath);
            }

        } catch (error) {
            console.error("Registration Error:", error);
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <PageTransition>
            <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-blue-900 via-blue-700 to-slate-200 animate-gradient-xy py-10">
                {/* Background Blobs */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-blue-100 animate-gradient-xy"></div>
                <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-300/20 rounded-full blur-[100px] animate-blob"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-[100px] animate-blob animation-delay-2000"></div>

                <div className="relative z-10 w-[90%] max-w-xl">
                    <div className="bg-white/70 backdrop-blur-xl border border-white/50 shadow-2xl rounded-3xl p-6 md:p-8 transform transition-all duration-500 max-h-[85vh] overflow-y-auto custom-scrollbar">

                        {/* Header */}
                        {registrationStage === 'form' && (
                            <div className="text-center mb-6">
                                <img src={logo} alt="InsightED Ratio" className="h-20 mx-auto mb-4 object-contain drop-shadow-sm" />
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
                                                className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-700 ease-out" 
                                                style={{ width: `${(currentStep / maxSteps) * 100}%` }}
                                            ></div>
                                        </div>
                                        <div className="flex justify-between mt-2 px-1">
                                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none">
                                                {currentStep === 1 ? 'Primary Details' : currentStep === 2 ? 'Credentials' : currentStep === 3 ? (formData.role === 'School Head' ? 'School Selection' : 'Area Alignment') : currentStep === 4 ? 'Location/Geotag' : 'Final Security'}
                                            </span>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                                {Math.round((currentStep / maxSteps) * 100)}% Complete
                                            </span>
                                        </div>
                                    </div>

                                    {/* STEP 1: IDENTITY & ROLE */}
                                    {currentStep === 1 && (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
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

                                                <div className="space-y-1">
                                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Your Role</label>
                                                    <div className="relative">
                                                        <select
                                                            name="role"
                                                            value={formData.role}
                                                            onChange={handleRoleChange}
                                                            disabled={pathId === 'path_school_head' || pathId === 'path_central_office'}
                                                            className={`w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none cursor-pointer ${(pathId === 'path_school_head' || pathId === 'path_central_office') ? 'opacity-70 bg-slate-50' : ''}`}
                                                        >
                                                            {activeTab === 'internal' ? (
                                                                <>
                                                                    {(!pathId || pathId === 'path_ro_sd' || pathId === 'path_central_office') && (
                                                                        <>
                                                                            <option value="Central Office">CO Personnel</option>
                                                                            {pathId !== 'path_central_office' && (
                                                                                <>
                                                                                    <option value="Regional Office">RO Personnel</option>
                                                                                    <option value="School Division Office">SDO Personnel</option>
                                                                                </>
                                                                            )}
                                                                            {/* <option value="Super User">Super User 2.0</option> */}
                                                                        </>
                                                                    )}
                                                                    {(!pathId || pathId === 'path_school_head') && <option value="School Head">School Head</option>}
                                                                    {(!pathId || pathId === 'path_engineers') && <option value="Division Engineer">Division Engineer</option>}
                                                                    {(!pathId || pathId === 'path_engineers') && <option value="Regional Engineer">Regional Engineer</option>}
                                                                    {(!pathId || pathId === 'path_engineers') && <option value="Architect">Architect</option>}
                                                                    {(!pathId || pathId === 'path_efd') && <option value="EFD Engineer">EFD Engineer</option>}
                                                                    {!pathId && (
                                                                        <>
                                                                            <option value="Local Government Unit">Local Government Unit</option>
                                                                            <option value="Central Office Finance">Central Office Finance</option>
                                                                        </>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <option value="Implementing Agency">Implementing Agency</option>
                                                                    <option value="Local Government Unit">LGU Representative</option>
                                                                    <option value="Central Office Finance">CO Finance</option>
                                                                </>
                                                            )}
                                                        </select>
                                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                                                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                        {/* STEP 2: CONTACT INFORMATION */}
                                    {currentStep === 2 && (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                            <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex items-start gap-4">
                                                <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-md font-bold text-xs">2</div>
                                                <div>
                                                    <h3 className="font-bold text-blue-900">Communication</h3>
                                                    <p className="text-xs text-blue-700">How we reaching you for recovery and updates.</p>
                                                </div>
                                            </div>

                                            <div className="space-y-4 px-1">
                                                {formData.role === 'School Head' ? (
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
                                                ) : (
                                                    <>
                                                        <div className="space-y-1">
                                                            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Email Address</label>
                                                             {['Central Office', 'Regional Office', 'School Division Office', 'Division Engineer', 'Regional Engineer', 'Architect', 'EFD Engineer', 'Super User'].includes(formData.role) ? (
                                                                <div className="flex items-center w-full">
                                                                    <input
                                                                        type="text"
                                                                        value={formData.email ? formData.email.split('@')[0] : ''}
                                                                        onChange={(e) => {
                                                                            const username = e.target.value.replace(/[^a-zA-Z0-9._-]/g, '');
                                                                            setFormData(prev => ({ ...prev, email: username + '@deped.gov.ph' }));
                                                                        }}
                                                                        placeholder="account.username"
                                                                        className="flex-1 min-w-0 bg-white border border-r-0 border-slate-200 text-sm rounded-l-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                                                                        required
                                                                    />
                                                                    <span className="bg-slate-100 border border-l-0 border-slate-200 text-slate-600 text-xs font-bold px-4 py-3 rounded-r-xl select-none whitespace-nowrap">
                                                                        @deped.gov.ph
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <input name="email" type="email" placeholder="Enter email address" onChange={handleChange} value={formData.email} className="w-full bg-white border border-slate-200 text-sm rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500" required />
                                                            )}
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Mobile Number</label>
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
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* STEP 3: ASSIGNMENT & LOCATION */}
                                    {currentStep === 3 && formData.role !== 'EFD Engineer' && (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                            {formData.role === 'School Head' ? (
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
                                            ) : (
                                                <div className="space-y-4">
                                                    {/* Generic Dynamic Sections based on role */}
                                                    {formData.role === 'Implementing Agency' && (
                                                        <div className="space-y-4 p-4 bg-purple-50/50 rounded-2xl border border-purple-100">
                                                            <select name="agencyType" value={formData.agencyType || ''} onChange={handleChange} className="w-full bg-white border border-purple-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-purple-500" required>
                                                                <option value="">Select Agency Type</option>
                                                                <option value="PGO">PGO (Provincial Government)</option><option value="CGO">CGO (City Government)</option>
                                                                <option value="MGO">MGO (Municipal Government)</option><option value="DPWH">DPWH</option><option value="CSO">CSO</option>
                                                            </select>
                                                            <input name="position" value={formData.position} placeholder="Position/Designation" onChange={handleChange} className="w-full bg-white border border-purple-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-purple-500" required />
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <select name="region" onChange={handleRegionChange} value={formData.region} className="w-full bg-white border border-purple-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-purple-500" required>
                                                                    <option value="">Select Region</option>
                                                                    {regions.map(r => <option key={r} value={r}>{r}</option>)}
                                                                </select>
                                                                <select name="province" onChange={handleProvinceChange} value={formData.province} className="w-full bg-white border border-purple-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50" disabled={!formData.region} required>
                                                                    <option value="">Select Province</option>
                                                                    {provinceOptions.map(p => <option key={p} value={p}>{p}</option>)}
                                                                </select>
                                                            </div>
                                                            {(formData.agencyType === 'CGO' || formData.agencyType === 'MGO') && (
                                                                <select name="city" value={formData.city} onChange={handleCityChange} className="w-full bg-white border border-purple-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50" disabled={!formData.province} required>
                                                                    <option value="">Select Municipality/City</option>
                                                                    {cityOptions.map(m => <option key={m} value={m}>{m}</option>)}
                                                                </select>
                                                            )}
                                                        </div>
                                                    )}

                                                     {['Central Office', 'Regional Office', 'School Division Office', 'Super User'].includes(formData.role) && (
                                                        <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                                             {!['Central Office', 'Central Office Finance', 'Super User'].includes(formData.role) && (
                                                                <select name="region" onChange={handleRegionChange} value={formData.region} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" required>
                                                                    <option value="">Select Region</option>
                                                                    {regions.map(r => <option key={r} value={r}>{r}</option>)}
                                                                </select>
                                                            )}
                                                            
                                                            {formData.role === 'School Division Office' && (
                                                                <select name="division" onChange={handleChange} value={formData.division} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" disabled={!formData.region} required>
                                                                    <option value="">Select Division</option>
                                                                    {divisions.map(d => <option key={d} value={d}>{d}</option>)}
                                                                </select>
                                                            )}

                                                            <select name="office" value={formData.office} onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" required>
                                                                <option value="">Select Office/Bureau</option>
                                                                {(formData.role === 'Central Office' || formData.role === 'Central Office Finance' || formData.role === 'Super User') && centralOfficeBureaus.map(o => <option key={o} value={o}>{o}</option>)}
                                                                {formData.role === 'Regional Office' && regionalOffices.map(o => <option key={o} value={o}>{o}</option>)}
                                                                {formData.role === 'School Division Office' && divisionOffices.map(o => <option key={o} value={o}>{o}</option>)}
                                                            </select>

                                                            <input name="position" value={formData.position} placeholder="Position" onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" required />
                                                        </div>
                                                    )}

                                                    {(formData.role.includes('Engineer') || formData.role === 'Architect') && (
                                                         <div className="space-y-4 p-4 bg-teal-50/50 rounded-2xl border border-teal-100">
                                                            <select name="region" onChange={handleRegionChange} value={formData.region} className="w-full bg-white border border-teal-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-500" required>
                                                                <option value="">Select Region</option>
                                                                {regions.map(r => <option key={r} value={r}>{r}</option>)}
                                                            </select>
                                                            {formData.role !== 'Regional Engineer' && (
                                                                <select name="division" onChange={handleChange} value={formData.division} className="w-full bg-white border border-teal-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-500" required>
                                                                    <option value="">Select Division</option>
                                                                    {divisions.map(d => <option key={d} value={d}>{d}</option>)}
                                                                </select>
                                                            )}
                                                            <select name="position" value={formData.position} onChange={handleChange} className="w-full bg-white border border-teal-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-500" required>
                                                                <option value="">Select Position</option>
                                                                <option value="Engineer II">Engineer II</option>
                                                                <option value="Engineer III">Engineer III</option>
                                                                <option value="Engineer IV">Engineer IV</option>
                                                                <option value="Engineer V">Engineer V</option>
                                                                <option value="Architect">Architect</option>
                                                                <option value="Technical Assistant I (COS)">Technical Assistant I (COS)</option>
                                                                <option value="Technical Assistant II (COS)">Technical Assistant II (COS)</option>
                                                                <option value="Technical Assistant III (COS)">Technical Assistant III (COS)</option>
                                                                <option value="Technical Assistant IV (COS)">Technical Assistant IV (COS)</option>
                                                                <option value="Technical Assistant V (COS)">Technical Assistant V (COS)</option>
                                                            </select>
                                                         </div>
                                                    )}

                                                    {formData.role === 'Local Government Unit' && (
                                                         <div className="space-y-4 p-4 bg-orange-50/50 rounded-2xl border border-orange-100">
                                                            <select name="region" onChange={handleRegionChange} value={formData.region} className="w-full bg-white border border-orange-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-500" required>
                                                                <option value="">Select Region</option>
                                                                {regions.map(r => <option key={r} value={r}>{r}</option>)}
                                                            </select>
                                                            <select name="province" onChange={handleProvinceChange} value={formData.province} className="w-full bg-white border border-orange-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50" disabled={!formData.region} required>
                                                                <option value="">Select Province</option>
                                                                {provinceOptions.map(p => <option key={p} value={p}>{p}</option>)}
                                                            </select>
                                                            <input name="position" value={formData.position} placeholder="Position/Designation" onChange={handleChange} className="w-full bg-white border border-orange-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-500" required />
                                                         </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* STEP 4: GEOTAGGING (Only for School Head) */}
                                    {currentStep === 4 && formData.role === 'School Head' && (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
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
                                                                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100 animate-pulse">DRAG MARKER TO MOVE</span>
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
                                        </div>
                                    )}

                                    {/* STEP 4/5: SECURITY */}
                                    {currentStep === maxSteps && (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                            {formData.role !== 'School Head' && (
                                                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200">
                                                    <label className="block text-xs font-bold text-amber-800 uppercase tracking-widest mb-2">Authorization Code</label>
                                                    <input name="authCode" type="text" value={formData.authCode} onChange={handleChange} placeholder="Secure registration code" className="w-full bg-white border border-amber-300 rounded-xl px-4 py-3 text-sm font-mono tracking-widest focus:ring-2 focus:ring-amber-500" required />
                                                    <p className="text-[10px] text-amber-600 mt-2">Required for non-School Head roles.</p>
                                                </div>
                                            )}

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
                                        </div>
                                    )}

                                    {/* NAVIGATION BUTTONS */}
                                    <div className="flex gap-4 pt-4">
                                        {currentStep > 1 && (
                                            <button type="button" onClick={handleBack} className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
                                                Back
                                            </button>
                                        )}
                                        {currentStep < maxSteps ? (
                                            <button type="button" onClick={handleNext} className="flex-[2] px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-2">
                                                Continue
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                                            </button>
                                        ) : (
                                            <button type="submit" disabled={loading} className="flex-[2] px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-2xl shadow-xl shadow-blue-500/30 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                                                {loading ? 'Registering...' : 'Register Account'}
                                                {!loading && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>}
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}


                        </form>

                        <div className="mt-8 text-center pt-6 border-t border-slate-100">
                            <Link to="/" className="text-sm font-semibold text-blue-600 hover:text-blue-800">Back to Login</Link>
                        </div>
                    </div>
                </div>

                {/* NCR WARNING MODAL */}
                {showNcrModal && (
                    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                        <div className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl text-center relative overflow-hidden border border-white/20">
                            <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-10 h-10">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                </svg>
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">Invalid Selection</h3>
                            <p className="text-slate-500 text-sm leading-relaxed mb-8 font-medium">
                                NCR does not have provinces. Please select a different agency type like <span className="text-slate-800 font-bold underline decoration-blue-500 decoration-2">CGO</span> or <span className="text-slate-800 font-bold underline decoration-blue-500 decoration-2">MGO</span> instead of PGO.
                            </p>
                            <button
                                onClick={() => setShowNcrModal(false)}
                                className="w-full py-4 bg-[#004A99] text-white font-bold rounded-2xl shadow-xl shadow-blue-900/20 hover:bg-blue-800 transition transform active:scale-[0.98]"
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
