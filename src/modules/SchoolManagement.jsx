import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BottomNav from './BottomNav';
import PageTransition from '../components/PageTransition';
import { FiMapPin, FiCheck, FiX, FiClock, FiSave, FiList, FiAlertTriangle, FiShield, FiUsers, FiCopy, FiSearch, FiRefreshCcw, FiPlusCircle, FiFilePlus, FiDownload, FiUpload, FiEye } from 'react-icons/fi';
import { TbSchool, TbReportAnalytics } from 'react-icons/tb';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Helper for map recentering - Defined before usage
const MapAutoCenter = ({ position, zoom }) => {
    const map = useMapEvents({});
    useEffect(() => {
        if (position) {
            console.log("Flying to:", position, "Zoom:", zoom);
            map.flyTo(position, zoom || 13);
        }
    }, [position, zoom, map]);
    return null;
};

// Nominatim Search Helper (Fallback)
const searchNominatim = async (query) => {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
        if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0) {
                return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
            }
        }
    } catch (error) {
        console.error("Nominatim search failed:", error);
    }
    return null;
};

const TabButton = ({ active, onClick, icon: Icon, label, color }) => {
    const colorMap = {
        blue: {
            active: 'bg-[#004A99] text-white shadow-[#004A99]/20',
            inactive: 'text-slate-600 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-900/20',
            icon: 'bg-blue-50 dark:bg-blue-900/30 text-[#004A99] dark:text-blue-400'
        },
        indigo: {
            active: 'bg-indigo-600 text-white shadow-indigo-600/20',
            inactive: 'text-slate-600 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20',
            icon: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
        },
        slate: {
            active: 'bg-slate-800 text-white shadow-slate-800/20',
            inactive: 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50',
            icon: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
        },
        amber: {
            active: 'bg-blue-600 text-white shadow-blue-600/20', // Kept blue as active for primary action consistency
            inactive: 'text-slate-600 dark:text-slate-400 hover:bg-amber-50 dark:hover:bg-amber-900/10',
            icon: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
        }
    };

    const theme = colorMap[color] || colorMap.blue;

    return (
        <motion.button
            whileHover={{ y: -4, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className={`relative flex flex-col items-center justify-center p-6 rounded-[2.5rem] transition-all duration-300 border-2 ${
                active 
                ? `${theme.active} border-transparent shadow-2xl scale-105` 
                : `${theme.inactive} bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 shadow-xl shadow-slate-200/50 dark:shadow-none`
            }`}
        >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-500 ${active ? 'bg-white/20 text-white scale-110' : theme.icon}`}>
                <Icon size={24} />
            </div>
            <span className={`text-xs font-black uppercase tracking-tighter text-center leading-tight ${active ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>
                {label}
            </span>
            {active && (
                <motion.div 
                    layoutId="activeTabGlow"
                    className="absolute inset-0 rounded-[2.5rem] bg-current opacity-20 blur-xl -z-10"
                />
            )}
        </motion.button>
    );
};

import ActionModal from '../components/ActionModal';

const SchoolManagement = () => {
    const { user, token } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState(location.state?.activeView || null); // null, 'form', 'converted', 'requests', 'users', or 'updateStatus'

    // Users Management Integration State
    const [userSearchId, setUserSearchId] = useState('');
    const [foundUser, setFoundUser] = useState(null);
    const [showUserModal, setShowUserModal] = useState(false);
    const [isSearchingUser, setIsSearchingUser] = useState(false);
    const [newPasscode, setNewPasscode] = useState('');
    const [isSavingPasscode, setIsSavingPasscode] = useState(false);

    // Form State - matching exact schools table schema
    const [formData, setFormData] = useState({
        school_id: '',
        school_name: '',
        district: '',
        province: '',
        municipality: '',
        leg_district: '',
        barangay: '',
        street_address: '',
        mother_school_id: 'NA',
        curricular_offering: '',
        special_order: '', // PDF URL
        old_school_id: '', // Added for conversion tracking
    });

    // Converted/Transferred Schools State
    const [convertedDivision, setConvertedDivision] = useState('');
    const [divisionOptions, setDivisionOptions] = useState([]);
    const [masterSchoolOptions, setMasterSchoolOptions] = useState([]);
    const [selectedMasterSchool, setSelectedMasterSchool] = useState('');

    const [mapPosition, setMapPosition] = useState([14.5995, 120.9842]); // Default: Manila
    const [mapZoom, setMapZoom] = useState(13);
    const [mapStatus, setMapStatus] = useState(''); // Idle, Searching..., Found
    const [submitting, setSubmitting] = useState(false);
    const [pendingSchools, setPendingSchools] = useState([]);
    const [uploading, setUploading] = useState(false); // Indicates local processing now
    const [searchLoading, setSearchLoading] = useState(false);
    const [isConverting, setIsConverting] = useState(false);
    const [documentPayload, setDocumentPayload] = useState(null); // Stores Base64 string
    const [compressionData, setCompressionData] = useState(null); // { original, compressed, hydra }
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [idExists, setIdExists] = useState(false);
    const [checkingId, setCheckingId] = useState(false);
    const [nameError, setNameError] = useState('');

    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmTimer, setConfirmTimer] = useState(20);
    const [canConfirm, setCanConfirm] = useState(false);

    // Success Modal State
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [lastSubmissionDetails, setLastSubmissionDetails] = useState(null);
    const [updateStatusData, setUpdateStatusData] = useState({
        school_id: '',
        status: 'Open',
        reason: ''
    });
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [searchingStatusSchool, setSearchingStatusSchool] = useState(false);
    const [searchedSchoolDetails, setSearchedSchoolDetails] = useState(null);



    useEffect(() => {
        let interval;
        if (showConfirmModal && confirmTimer > 0) {
            interval = setInterval(() => {
                setConfirmTimer((prev) => prev - 1);
            }, 1000);
        } else if (confirmTimer === 0) {
            setCanConfirm(true);
        }
        return () => clearInterval(interval);
    }, [showConfirmModal, confirmTimer]);

    // Body Scroll Lock when Modal is Open
    useEffect(() => {
        if (showConfirmModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [showConfirmModal]);
    // Validation Check: Mandatory Fields + PDF
    const isFormValid = useMemo(() => {
        const requiredFields = [
            'school_id', 'school_name', 'province', 'municipality', 
            'district', 'barangay', 'street_address', 'curricular_offering'
        ];
        
        const hasAllFields = requiredFields.every(field => formData[field] && formData[field].trim() !== '');
        const hasPdf = !!documentPayload; // Must have the PDF stored in state
        const hasNoErrors = !idExists && !nameError && !checkingId;

        return hasAllFields && hasPdf && hasNoErrors;
    }, [formData, documentPayload, idExists, nameError, checkingId]);

    // Location Options & Coordinates State
    const [locationOptions, setLocationOptions] = useState([]);
    const [locationCoordinates, setLocationCoordinates] = useState([]); // Array of { municipality, barangay, lat, lng }

    const curricularOfferingOptions = [
        'Purely Elementary',
        'Elementary School and Junior High School (K-10)',
        'Junior High and Senior High',
        'All Offering (K to 12)',
        'Purely Junior High School',
        'Purely Senior High School',
        'Elementary School and Senior High School'
    ];

    useEffect(() => {
        if (user) {
            // ROLE PROTECTION: Only School Division Office can access this module
            if (user.role !== 'School Division Office' && user.role !== 'Regional Office') {
                console.warn(`🚫 Access Denied: User role ${user.role} is not authorized for School Management.`);
                navigate('/monitoring-dashboard');
                return;
            }

            setUserData(user);
            // Pre-set map center based on region if possible (simplified)
            if (user.region === 'NCR') {
                setMapPosition([14.5995, 120.9842]);
            } else if (user.region === 'Region III') {
                setMapPosition([15.4818, 120.7121]); // Central Luzon
            }

            // Fetch location options for this user's region/division
            fetchLocationOptions(user.region, user.division);
            fetchLocationCoordinates(user.region, user.division);
            fetchDivisions(user.region); // Fetch divisions for converted school tab
            fetchPendingSchools();
            setLoading(false);
        } else {
            // navigate('/login');
        }
    }, [user, navigate]);

    const fetchDivisions = async (region) => {
        try {
            const res = await fetch(`/api/locations/divisions?region=${encodeURIComponent(region)}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (res.ok) {
                const data = await res.json();
                setDivisionOptions(data);
            }
        } catch (err) {
            console.error('Failed to fetch divisions:', err);
        }
    };

    const fetchMasterSchools = async (division) => {
        if (!division) return;
        try {
            const res = await fetch(`/api/master-list/schools?division=${encodeURIComponent(division)}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (res.ok) {
                const data = await res.json();
                setMasterSchoolOptions(data);
            }
        } catch (err) {
            console.error('Failed to fetch master schools:', err);
        }
    };

    const handleSearchSchool = async () => {
        if (!selectedMasterSchool || selectedMasterSchool.length !== 6) {
            alert("Please enter a valid 6-digit School ID.");
            return;
        }

        setSearchLoading(true);
        try {
            const res = await fetch(`/api/master-list/school/${selectedMasterSchool}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (res.ok) {
                const school = await res.json();

                // Scope Validation: Restrict by Division (SDO) or Region (RO)
                if (user.role === 'School Division Office') {
                    if (school.division !== user.division) {
                        alert(`Access Denied: This school belongs to ${school.division}. You can only manage schools within ${user.division}.`);
                        setSearchLoading(false);
                        return;
                    }
                } else if (user.role === 'Regional Office') {
                    if (school.region !== user.region) {
                        alert(`Access Denied: This school belongs to Region ${school.region}. You can only manage schools within Region ${user.region}.`);
                        setSearchLoading(false);
                        return;
                    }
                }

                // Autofill Form
                setFormData(prev => ({
                    ...prev,
                    school_name: school.school_name || '',
                    district: school.district || '',
                    province: school.province || '',
                    municipality: school.municipality || '',
                    leg_district: school.leg_district || '',
                    barangay: school.barangay || '',
                    street_address: school.address || '',
                    curricular_offering: school.curricular_offering_classification || '',
                    old_school_id: school.school_id, // Store the old ID
                    school_id: '', // CLEAR school_id so user has to type the NEW one
                }));
                setIsConverting(true);
                // Keep activeView as 'converted'
                alert("School details autofilled! Please verify the location on the map and attach the Special Order.");
            } else {
                alert("School not found in Master List.");
            }
        } catch (err) {
            console.error("Search failed:", err);
            alert("An error occurred while searching for the school.");
        } finally {
            setSearchLoading(false);
        }
    };

    const handleMasterSchoolChange = (e) => {
        const schoolId = e.target.value;
        setSelectedMasterSchool(schoolId);

        const school = masterSchoolOptions.find(s => s.school_id === schoolId);
        if (school) {
            // Autofill Form
            setFormData(prev => ({
                ...prev,
                school_name: school.school_name || '',
                district: school.district || '',
                province: school.province || '', // Note: Master list might not have province/municipality columns if they are not in the 'schools' table.
                municipality: school.municipality || '', // If these refer to columns in 'schools' table, ensure they exist.
                leg_district: school.leg_district || '',
                barangay: school.barangay || '',
                street_address: school.address || '', // Check if column is address or street_address
                curricular_offering: school.curricular_offering_classification || '', // Check column name
                old_school_id: school.school_id, // Store old ID
                school_id: '', // CLEAR school_id so user has to type the NEW one
            }));

            // Switch to form view to show autofilled data
            setActiveView('form');

            // Trigger map auto-pan if location data exists
            // Since strict state updates are batched, we might need to manually trigger pan or rely on the effect in handleInputChange
            // But handleInputChange isn't called here.
            // Let's manually trigger the map logic if we have location info.
            // ... (We can trust the user to verify location on map)
            alert("School details autofilled! Please verify the location on the map and attach the Special Order.");
        }
    };

    const fetchLocationOptions = async (region, division) => {
        try {
            const res = await fetch(`/api/sdo/location-options?region=${encodeURIComponent(region)}&division=${encodeURIComponent(division)}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (res.ok) {
                const data = await res.json();
                console.log("🏙️ SDO Location Options Received:", data.length, "rows");
                if (data.length > 0) console.log("🏙️ Sample Option:", data[0]);
                setLocationOptions(data);
            } else {
                console.error("🏙️ SDO Location Options Fetch Failed:", res.status);
            }
        } catch (err) {
            console.error('Failed to fetch location options:', err);
        }
    };

    const fetchLocationCoordinates = async (region, division) => {
        try {
            console.log(`fetching coords for ${region}, ${division}`);
            const res = await fetch(`/api/sdo/location-coordinates?region=${encodeURIComponent(region)}&division=${encodeURIComponent(division)}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (res.ok) {
                const data = await res.json();
                console.log("📍 API Data Received:", data.length, "rows");
                if (data.length > 0) {
                    console.log("📍 Sample Row:", data[0]);
                    console.log("📍 Sample lat type:", typeof data[0].lat, data[0].lat);
                }
                setLocationCoordinates(data);
            }
        } catch (err) {
            console.error('Failed to fetch location coordinates:', err);
        }
    };

    const fetchPendingSchools = async () => {
        if (!user) return;

        try {
            const res = await fetch(`/api/sdo/pending-schools?sdo_uid=${user.uid}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (res.ok) {
                const data = await res.json();
                setPendingSchools(data);
            }
        } catch (err) {
            console.error('Failed to fetch pending schools:', err);
        }
    };

    // Derived Options based on selections
    const provinceOptions = useMemo(() => {
        return [...new Set(locationOptions.map(item => item.province).filter(Boolean))].sort();
    }, [locationOptions]);

    const municipalityOptions = useMemo(() => {
        if (!formData.province) return [];
        return [...new Set(locationOptions
            .filter(item => item.province === formData.province)
            .map(item => item.municipality)
            .filter(Boolean)
        )].sort();
    }, [locationOptions, formData.province]);

    const districtOptions = useMemo(() => {
        // District is dependent on Division (implicitly filtered in locationOptions)
        return [...new Set(locationOptions.map(item => item.district).filter(Boolean))].sort();
    }, [locationOptions]);

    const barangayOptions = useMemo(() => {
        if (!formData.municipality) return [];

        let filtered = locationOptions.filter(item => item.municipality === formData.municipality);

        // If district is selected, further filter
        if (formData.district) {
            const withDistrict = filtered.filter(item => item.district === formData.district);
            if (withDistrict.length > 0) {
                filtered = withDistrict;
            }
        }

        return [...new Set(filtered.map(item => item.barangay).filter(Boolean))].sort();
    }, [locationOptions, formData.municipality, formData.district]);

    const [legDistrictOptions, setLegDistrictOptions] = useState([]);

    useEffect(() => {
        const fetchLegDistricts = async () => {
            if (!formData.province) {
                setLegDistrictOptions([]);
                return;
            }
            try {
                const region = userData?.region || '';
                const province = formData.province;
                const res = await fetch(`/api/locations/legislative-districts?region=${encodeURIComponent(region)}&province=${encodeURIComponent(province)}`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });
                if (res.ok) {
                    const data = await res.json();
                    let options = Array.isArray(data) ? data : [];
                    // Ensure current value is in list even if not in the 1st-8th range (fallback for old data)
                    if (formData.leg_district && !options.some(opt => opt.toUpperCase() === formData.leg_district.toUpperCase())) {
                        options.push(formData.leg_district.toUpperCase());
                    }
                    setLegDistrictOptions(options);
                }
            } catch (err) {
                console.error("Failed to fetch legislative districts:", err);
                // Fallback
                setLegDistrictOptions([
                    '1ST DISTRICT', '2ND DISTRICT', '3RD DISTRICT', '4TH DISTRICT',
                    '5TH DISTRICT', '6TH DISTRICT', '7TH DISTRICT', '8TH DISTRICT'
                ]);
            }
        };
        fetchLegDistricts();
    }, [formData.province, formData.leg_district, userData?.region]);


    const MapClickHandler = () => {
        useMapEvents({
            click(e) {
                setMapPosition([e.latlng.lat, e.latlng.lng]);
            }
        });
        return null;
    };

    const handleResubmitDocument = async (pendingId, schoolId, file) => {
        if (!file) return;

        if (file.type !== 'application/pdf') {
            alert('Please upload a PDF file.');
            return;
        }
        if (file.size > 25 * 1024 * 1024) { 
            alert('File size exceeds 25MB limit.');
            return;
        }

        setUploading(true);
        console.log(`🔄 [SDO] Resubmitting file: ${file.name}`);
        
        try {
            const formDataUpload = new FormData();
            formDataUpload.append('file', file);
            formDataUpload.append('school_id', schoolId);
            formDataUpload.append('type', 'SPECIAL_ORDER');

            const res = await fetch(`/api/sdo/resubmit-document/${pendingId}`, {
                method: 'POST',
                body: formDataUpload
            });

            if (res.ok) {
                alert("✅ Document re-uploaded and optimized successfully!");
                fetchPendingSchools();
            } else {
                const data = await res.json();
                alert("❌ Failed to re-upload: " + data.error);
            }
        } catch (err) {
            console.error("Resubmit error:", err);
            alert("❌ An error occurred while resubmitting.");
        } finally {
            setUploading(false);
        }
    };

    const handleViewOldDoc = (path) => {
        if (!path) return;
        
        // If it's a relative path, prefix it with /api/uploads/
        const finalPath = path.startsWith('http') ? path : `/api/uploads/${path}`;
        window.open(finalPath, '_blank');
    };

    const handleInputChange = (e) => {
        let { name, value } = e.target;

        // Limit school_id to 6 characters and ONLY numbers
        if (name === 'school_id') {
            value = value.replace(/[^0-9]/g, ''); // Reassign to value to update state correctly
            if (value.length > 6) return;
            
            // Real-time duplicate check for schools_IERN
            if (value.length === 6) {
                setCheckingId(true);
                fetch(`/api/sdo/check-id/${value}`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                })
                    .then(res => res.json())
                    .then(data => {
                        setIdExists(data.exists);
                        if (data.exists) {
                            console.warn(`🛑 [SDO] School ID ${value} is already in the Master Record (schools_IERN).`);
                        }
                        setCheckingId(false);
                    })
                    .catch(err => {
                        console.error("ID check failed", err);
                        setCheckingId(false);
                    });
            } else {
                setIdExists(false);
            }
        }

        // Validate School Name Abbreviations
        if (name === 'school_name') {
            const forbidden = ["ES", "NHS", "PS", "CS", "CES", "HS", "IS", "SHS", "ELEM", "MNHS"];
            // Use regex to find whole words only (case insensitive)
            const regex = new RegExp(`\\b(${forbidden.join('|')})\\b`, 'i');
            const match = value.match(regex);
            
            if (match) {
                setNameError(`Abbreviations like "${match[0].toUpperCase()}" are not allowed. Please use the full name (e.g., Elementary School, National High School).`);
            } else {
                setNameError('');
            }
        }

        setFormData(prev => {
            const newData = { ...prev, [name]: value };

            // Cascading resets
            if (name === 'province') {
                newData.municipality = '';
                newData.district = '';
                newData.barangay = '';
                newData.leg_district = '';
            } else if (name === 'municipality') {
                newData.district = '';
                newData.barangay = '';
                newData.leg_district = '';
            }
            return newData;
        });

        // Map Auto-Pan Logic (First School in Area)
        if (['province', 'municipality', 'district', 'leg_district', 'barangay'].includes(name) && value) {
            // Construct filters using the NEW value (state update is async, so use local 'value')
            let updated;
            setFormData(prev => {
                updated = { ...prev, [name]: value };
                if (name === 'province') {
                    updated.municipality = '';
                    updated.barangay = '';
                } else if (name === 'municipality') {
                    updated.barangay = '';
                }
                return updated;
            });

            // Requirement: "When i select a province, municipality, district..." -> trigger pan
            // We need at least a Province to start filtering effectively, but usually Municipality is the key.
            // Let's trigger if ANY of these are set.

            if (userData?.region && userData?.division) {
                setMapStatus('Locating area...');
                console.log('Cleaning up map interface and adding instructions...'); // Confirming cleanup

                const params = new URLSearchParams({
                    region: userData.region,
                    division: userData.division.trim(),
                    province: updated.province || '',
                    municipality: updated.municipality || '',
                    district: updated.district || '',
                    leg_district: updated.leg_district || '',
                    barangay: updated.barangay || ''
                });

                fetch(`/api/sdo/first-school-location?${params}`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                })
                    .then(res => res.json())
                    .then(data => {
                        if (data && data.lat && data.lng) {
                            console.log("📍 Pan to:", data);
                            setMapPosition([parseFloat(data.lat), parseFloat(data.lng)]);
                            setMapZoom(15);
                            setMapStatus('Centered on area');
                        } else {
                            setMapStatus('No schools found in this area');
                        }
                    })
                    .catch(err => {
                        console.error("Failed to map auto-pan", err);
                        setMapStatus('Error locating area');
                    });
            }
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            alert('Please upload a PDF file.');
            e.target.value = '';
            return;
        }

        if (file.size > 25 * 1024 * 1024) { // Increased to 25MB as the backend now handles optimization
            alert('File size exceeds 25MB limit.');
            e.target.value = '';
            return;
        }

        // Store the raw File object for binary upload later
        setDocumentPayload(file);
        setCompressionData(null); // Reset preview

        // Set a dummy value so validation passes
        setFormData(prev => ({ ...prev, special_order: file.name }));
        console.log(`📎 [SDO] Prepared file for binary upload: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    };

    const handleOptimizePreview = async () => {
        if (!documentPayload) {
            alert("Please select a PDF file first.");
            return;
        }

        setIsOptimizing(true);
        try {
            const formDataUpload = new FormData();
            formDataUpload.append('file', documentPayload);

            const res = await fetch('/api/sdo/preview-compression', {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                body: formDataUpload
            });

            if (res.ok) {
                const data = await res.json();
                setCompressionData(data);
                console.log("✅ [SDO] Compression preview received:", data);
            } else {
                console.error("Compression preview failed");
                alert("Could not calculate compression savings. Standard storage will be used.");
            }
        } catch (err) {
            console.error("Preview error:", err);
        } finally {
            setIsOptimizing(false);
        }
    };

    const handleInitialSubmit = async (e) => {
        e.preventDefault();

        // Validate all required fields
        const requiredFields = ['school_id', 'school_name', 'district', 'province', 'municipality', 'barangay', 'curricular_offering', 'special_order'];
        const missing = requiredFields.filter(field => !formData[field]);

        if (missing.length > 0) {
            alert(`Please fill in all required fields: ${missing.join(', ')}`);
            return;
        }

        // Validate School ID is exactly 6 characters
        if (formData.school_id.length !== 6) {
            alert('School ID must be exactly 6 characters');
            return;
        }

        // Validate User Profile (Region/Division must be set)
        if (!userData.region || !userData.division) {
            alert('Your account profile is missing Region/Division information. Please update your profile before submitting a school.');
            return;
        }

        // BLOCK IF ID ALREADY EXISTS
        if (idExists) {
            alert('Cannot submit: This School ID is already registered in the system (schools_IERN). Please verify the ID.');
            return;
        }

        // BLOCK IF NAME HAS ABBREVIATIONS
        if (nameError) {
            alert('Cannot submit: ' + nameError);
            return;
        }

        // Trigger Confirmation Modal
        setConfirmTimer(20);
        setCanConfirm(false);
        setShowConfirmModal(true);
    };

    const handleConfirmSubmit = async () => {
        setSubmitting(true);
        setShowConfirmModal(false); // Close modal

        try {
            const endpoint = isConverting ? '/api/sdo/convert-school' : '/api/sdo/submit-school';

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    ...formData,
                    school_id: formData.school_id.trim(), // Ensure whitespace is removed
                    region: userData.region,
                    division: userData.division,
                    latitude: mapPosition[0],
                    longitude: mapPosition[1],
                    submitted_by: user.uid,
                    submitted_by_name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
                    old_school_id: isConverting ? formData.old_school_id : null
                })
            });

            const data = await res.json();

            if (res.ok) {
                // SEQUENTIAL UPLOAD FOR DOCUMENT (Optimized Binary Pipeline)
                if (documentPayload instanceof File && data.pending_id) {
                    setUploading(true); // Show optimization progress
                    try {
                        const formDataUpload = new FormData();
                        formDataUpload.append('file', documentPayload);
                        formDataUpload.append('pending_id', data.pending_id);
                        formDataUpload.append('school_id', formData.school_id);
                        formDataUpload.append('type', 'SPECIAL_ORDER');

                        const docRes = await fetch('/api/sdo/upload-document', {
                            method: 'POST',
                            headers: token ? { Authorization: `Bearer ${token}` } : {},
                            body: formDataUpload
                        });

                        if (!docRes.ok) {
                            console.error("Document upload failed after school creation");
                            alert("School was submitted, but the Special Order document failed to upload.");
                        } else {
                            console.log("✅ [SDO] Document optimized and secured successfully.");
                        }
                    } catch (docErr) {
                        console.error("Document upload exception:", docErr);
                        // We still show success for the school, but note the doc failure
                    } finally {
                        setUploading(false);
                    }
                }

                // Show Success Modal instead of alert
                setLastSubmissionDetails({
                    school_id: formData.school_id,
                    school_name: formData.school_name,
                    isConverting
                });
                setShowSuccessModal(true);

                // Reset form
                setFormData({
                    school_id: '',
                    school_name: '',
                    district: '',
                    province: '',
                    municipality: '',
                    leg_district: '',
                    barangay: '',
                    street_address: '',
                    mother_school_id: 'NA',
                    curricular_offering: '',
                    special_order: '',
                });
                setDocumentPayload(null); // Clear payload
                setMapPosition([14.5995, 120.9842]);
                setIsConverting(false); // Reset conversion flag
                fetchPendingSchools(); // Refresh list
                setActiveView('requests'); // Switch to requests view
            } else {
                alert('Submission failed: ' + data.error);
            }
        } catch (err) {
            console.error('Submission error:', err);
            alert('Failed to submit school. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };
    

    // --- USER MANAGEMENT INTEGRATION LOGIC ---
    const handleSearchUser = async () => {
        if (!userSearchId || userSearchId.length !== 6) {
            alert("Please enter a valid 6-digit School ID.");
            return;
        }

        setIsSearchingUser(true);
        try {
            const res = await fetch(`/api/sdo/user-details/${userSearchId}?region=${encodeURIComponent(user.region)}&division=${encodeURIComponent(user.division)}`);
            if (res.ok) {
                const data = await res.json();
                setFoundUser(data);
                setShowUserModal(true);
                setNewPasscode(''); // Reset
            } else {
                const errorData = await res.json();
                alert(errorData.error || "User not found or is outside your division jurisdiction.");
            }
        } catch (err) {
            console.error("Search failed:", err);
            alert("An error occurred while searching for the user.");
        } finally {
            setIsSearchingUser(false);
        }
    };

    const handleSetPasscode = async () => {
        if (!newPasscode || newPasscode.length < 4) {
            alert("Passcode must be at least 4 characters.");
            return;
        }

        setIsSavingPasscode(true);
        try {
            const res = await fetch('/api/sdo/set-passcode', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    school_id: userSearchId,
                    passcode: newPasscode,
                    region: user.region,
                    division: user.division
                })
            });

            if (res.ok) {
                alert("Passcode updated successfully!");
                // Refresh local state
                setFoundUser(prev => ({ ...prev, passcode: newPasscode }));
                setNewPasscode('');
            } else {
                const data = await res.json();
                alert("Failed to update passcode: " + data.error);
            }
        } catch (err) {
            console.error("Set passcode error:", err);
            alert("An error occurred while saving the passcode.");
        } finally {
            setIsSavingPasscode(false);
        }
    };

    const copyToClipboard = (text, label) => {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            alert(`${label} copied to clipboard!`);
        }).catch(err => {
            console.error('Failed to copy: ', err);
        });
    };
    

    const handleSearchSchoolForStatus = async () => {
        if (!updateStatusData.school_id || updateStatusData.school_id.length !== 6) {
            alert("Please enter a valid 6-digit School ID.");
            return;
        }

        setSearchingStatusSchool(true);
        try {
            const res = await fetch(`/api/master-list/school/${updateStatusData.school_id}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (res.ok) {
                const school = await res.json();
                
                // Scope Validation: Restrict by Division (SDO) or Region (RO)
                if (user.role === 'School Division Office') {
                    if (school.division !== user.division) {
                        alert(`Access Denied: This school belongs to ${school.division}. You can only manage schools within ${user.division}.`);
                        setSearchingStatusSchool(false);
                        return;
                    }
                } else if (user.role === 'Regional Office') {
                    if (school.region !== user.region) {
                        alert(`Access Denied: This school belongs to Region ${school.region}. You can only manage schools within Region ${user.region}.`);
                        setSearchingStatusSchool(false);
                        return;
                    }
                }

                setSearchedSchoolDetails(school);
                // Pre-set status from searched school if available
                setUpdateStatusData(prev => ({
                    ...prev,
                    status: school.status === 'Archived' ? 'Closed' : 'Open'
                }));
            } else {
                alert("School not found in Master List.");
                setSearchedSchoolDetails(null);
            }
        } catch (err) {
            console.error("Search failed:", err);
            alert("An error occurred while searching for the school.");
        } finally {
            setSearchingStatusSchool(false);
        }
    };

    const handleUpdateStatus = async (e) => {
        e.preventDefault();
        
        if (!searchedSchoolDetails?.school_id) {
            alert("School not found or not selected.");
            return;
        }

        if (updateStatusData.status === 'Closed' && !updateStatusData.reason) {
            alert("Please provide a reason for closure.");
            return;
        }

        setUpdatingStatus(true);
        try {
            const res = await fetch('/api/master-list/update-status', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    ...updateStatusData,
                    school_id: searchedSchoolDetails.school_id,
                    updated_by: user.uid
                })
            });

            if (res.ok) {
                alert(`✅ School ${searchedSchoolDetails.school_id} status updated successfully!`);
                setActiveView(null);
                setUpdateStatusData({ school_id: '', status: 'Open', reason: '' });
                setSearchedSchoolDetails(null);
                fetchPendingSchools();
            } else {
                const data = await res.json();
                alert("❌ Failed to update status: " + (data.error || "Unknown error"));
            }
        } catch (err) {
            console.error("Update failed:", err);
            alert("❌ An error occurred while updating the status.");
        } finally {
            setUpdatingStatus(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-32">
                {/* Header */}
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-br from-[#004A99] to-[#002D5C] p-8 pb-24 rounded-b-[3.5rem] shadow-2xl text-white relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-8 opacity-10 blur-sm">
                        <TbSchool size={240} />
                    </div>
                    <div className="relative z-20 mb-6">
                        <button
                            onClick={() => navigate('/monitoring-dashboard')}
                            className="flex items-center gap-2 text-white/70 hover:text-white transition-all text-xs font-black uppercase tracking-[0.2em] group"
                        >
                            <FiX size={18} className="group-hover:rotate-90 transition-transform duration-300" /> 
                            <span>Back to Dashboard</span>
                        </button>
                    </div>
                    <div className="relative z-10">
                        <motion.h1 
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-5xl font-black tracking-tighter leading-none"
                        >
                            School <br />
                            <span className="text-blue-400 italic">Management</span>
                        </motion.h1>
                        <motion.p 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="text-blue-100/80 text-sm font-bold mt-4 uppercase tracking-[0.3em] flex items-center gap-2"
                        >
                            <span className="w-8 h-px bg-blue-400/50"></span>
                            {userData?.division || 'Division Office'}
                        </motion.p>
                    </div>
                </motion.div>

                <div className="max-w-5xl mx-auto px-6 -mt-16 space-y-8 relative z-30 pb-20">
                    {/* Action Cards Grid - Refactored from simple tabs */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        <TabButton 
                            active={activeView === 'form' && !isConverting}
                            onClick={() => {
                                setActiveView('form');
                                setIsConverting(false);
                                setFormData({
                                    school_id: '',
                                    school_name: '',
                                    district: '',
                                    province: '',
                                    municipality: '',
                                    leg_district: '',
                                    barangay: '',
                                    street_address: '',
                                    mother_school_id: 'NA',
                                    curricular_offering: '',
                                    special_order: '',
                                });
                                setDocumentPayload(null);
                                setMapPosition([14.5995, 120.9842]);
                            }}
                            icon={FiFilePlus}
                            label="Add New School"
                            color="blue"
                        />
                        <TabButton 
                            active={activeView === 'converted'}
                            onClick={() => setActiveView('converted')}
                            icon={TbSchool}
                            label="Register Converted School"
                            color="indigo"
                        />
                        <TabButton 
                            active={activeView === 'requests'}
                            onClick={() => setActiveView('requests')}
                            icon={FiList}
                            label={`My Submissions (${pendingSchools.length})`}
                            color="slate"
                        />
                        <TabButton 
                            active={activeView === 'updateStatus'}
                            onClick={() => setActiveView('updateStatus')}
                            icon={FiRefreshCcw}
                            label="Update School Status"
                            color="amber"
                        />
                        <TabButton 
                            active={false} // Since this navigates away, it won't be active on this page
                            onClick={() => navigate('/user-management')}
                            icon={FiUsers}
                            label="User Account Lookup"
                            color="indigo"
                        />
                    </div>



                    <ActionModal 
                        isOpen={activeView === 'converted' && !isConverting}
                        onClose={() => setActiveView(null)}
                        title="Register Converted School"
                        subtitle="Enter legacy identity to begin"
                        icon={TbSchool}
                    >
                        <div className="space-y-6">
                            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
                                Enter the current 6-digit school ID of the school that you would like to convert.
                            </p>

                            <div className="flex flex-col md:flex-row gap-5 items-end bg-slate-50 dark:bg-slate-900/50 p-5 rounded-[1.5rem] border border-slate-100 dark:border-slate-800">
                                <div className="flex-1 w-full">
                                    <label className="block text-[9px] font-black text-blue-600 dark:text-blue-400 mb-1.5 uppercase tracking-[0.2em] ml-1">Legacy School ID</label>
                                    <input
                                        type="text"
                                        value={selectedMasterSchool}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '');
                                            if (val.length <= 6) setSelectedMasterSchool(val);
                                        }}
                                        placeholder="e.g. 100000"
                                        className="w-full px-5 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 focus:outline-none dark:text-white font-mono text-lg tracking-widest text-blue-600 dark:text-blue-400 shadow-sm"
                                    />
                                </div>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleSearchSchool}
                                    disabled={selectedMasterSchool.length !== 6 || searchLoading}
                                    className="w-full md:w-auto px-10 py-4 bg-[#004A99] hover:bg-blue-700 text-white font-black rounded-2xl shadow-xl shadow-blue-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 uppercase tracking-widest text-sm"
                                >
                                    {searchLoading ? (
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <FiSearch size={20} />
                                            Search Records
                                        </>
                                    )}
                                </motion.button>
                            </div>
                        </div>
                    </ActionModal>

                    <ActionModal
                        isOpen={activeView === 'form' || (activeView === 'converted' && isConverting)}
                        onClose={() => {
                            setActiveView(null);
                            setIsConverting(false);
                            setFormData({
                                school_id: '',
                                school_name: '',
                                district: '',
                                province: '',
                                municipality: '',
                                leg_district: '',
                                barangay: '',
                                street_address: '',
                                mother_school_id: 'NA',
                                curricular_offering: '',
                                special_order: '',
                            });
                            setDocumentPayload(null);
                            setMapPosition([14.5995, 120.9842]);
                        }}
                        title={isConverting ? "Convert School" : "New Registration"}
                        subtitle="Complete mandatory identity form"
                        icon={isConverting ? TbSchool : FiFilePlus}
                    >
                        <form onSubmit={handleInitialSubmit} className="space-y-6">
                            {/* Grid Layout for Inputs */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {isConverting && (
                                    <div className="md:col-span-2 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 flex items-center justify-between animate-in slide-in-from-top-1">
                                        <div>
                                            <p className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1 leading-none">CURRENT IDENTITY</p>
                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase leading-tight">Legacy School ID</p>
                                        </div>
                                        <div className="bg-white dark:bg-slate-800 px-4 py-1.5 rounded-lg shadow-sm border border-blue-200 dark:border-blue-700">
                                            <span className="text-lg font-black text-blue-600 dark:text-blue-400 font-mono tracking-tighter">{formData.old_school_id}</span>
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                        {isConverting ? 'Target (New) School ID' : 'School ID'} * <span className="text-xs text-slate-500">(6 digits)</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="school_id"
                                        value={formData.school_id}
                                        onChange={handleInputChange}
                                        maxLength="6"
                                        pattern="[0-9]{6}"
                                        inputMode="numeric"
                                        placeholder="e.g. 100000"
                                        className={`w-full px-4 py-3 border-2 rounded-xl focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white transition-colors ${
                                            idExists ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/10' : (isConverting ? 'border-blue-300 bg-blue-50/10 dark:bg-blue-900/10' : 'border-slate-200 dark:border-slate-600')
                                        }`}
                                        required
                                    />
                                    {checkingId && <p className="text-[10px] text-blue-500 animate-pulse mt-1 font-bold">Verifying ID...</p>}
                                    {idExists && (
                                        <div className="mt-2 text-rose-600 dark:text-rose-400 text-xs font-black flex items-center gap-1 animate-in slide-in-from-top-1 duration-200">
                                            <FiX size={14} />
                                            SCHOOL ID ALREADY REGISTERED IN MASTER SYSTEM (IERN)
                                        </div>
                                    )}
                                    <p className="text-xs text-slate-500 mt-1">{formData.school_id.length}/6 characters</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">School Name *</label>
                                    <input
                                        type="text"
                                        name="school_name"
                                        value={formData.school_name}
                                        onChange={handleInputChange}
                                        className={`w-full px-4 py-3 border-2 rounded-xl focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white transition-colors ${
                                            nameError ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/10' : 'border-slate-200 dark:border-slate-600'
                                        }`}
                                        required
                                    />
                                    {nameError && (
                                        <div className="mt-2 text-amber-600 dark:text-amber-400 text-[10px] font-black flex items-start gap-1 p-2 bg-amber-50/50 dark:bg-amber-900/20 rounded-lg animate-in slide-in-from-top-1">
                                            <FiClock className="mt-0.5 shrink-0" />
                                            <span>{nameError}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Province Dropdown */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Province *</label>
                                    <select
                                        name="province"
                                        value={formData.province}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                                        required
                                    >
                                        <option value="">Select Province</option>
                                        {provinceOptions.map(p => (
                                            <option key={p} value={p}>{p}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Municipality Dropdown */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Municipality/City *</label>
                                    <select
                                        name="municipality"
                                        value={formData.municipality}
                                        onChange={handleInputChange}
                                        disabled={!formData.province}
                                        className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white disabled:opacity-50"
                                        required
                                    >
                                        <option value="">Select Municipality/City</option>
                                        {municipalityOptions.map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* District Dropdown */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">District *</label>
                                    <select
                                        name="district"
                                        value={formData.district}
                                        onChange={handleInputChange}
                                        disabled={!formData.municipality}
                                        className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white disabled:opacity-50"
                                        required
                                    >
                                        <option value="">Select District</option>
                                        {districtOptions.map(d => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Legislative District Dropdown */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Legislative District</label>
                                    <select
                                        name="leg_district"
                                        value={formData.leg_district}
                                        onChange={handleInputChange}
                                        disabled={!formData.municipality}
                                        className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white disabled:opacity-50"
                                    >
                                        <option value="">Select Leg. District</option>
                                        {legDistrictOptions.map(ld => (
                                            <option key={ld} value={ld}>{ld}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Barangay Dropdown */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Barangay *</label>
                                    <select
                                        name="barangay"
                                        value={formData.barangay}
                                        onChange={handleInputChange}
                                        disabled={!formData.municipality}
                                        className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white disabled:opacity-50"
                                        required
                                    >
                                        <option value="">Select Barangay</option>
                                        {barangayOptions.map(b => (
                                            <option key={b} value={b}>{b}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Street Address</label>
                                    <input
                                        type="text"
                                        name="street_address"
                                        value={formData.street_address}
                                        onChange={handleInputChange}
                                        placeholder="e.g. Brgy. 21, Libtong"
                                        className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Mother School ID</label>
                                    <input
                                        type="text"
                                        name="mother_school_id"
                                        value={formData.mother_school_id}
                                        onChange={handleInputChange}
                                        placeholder="NA or 6-digit ID"
                                        className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Curricular Offering *</label>
                                    <select
                                        name="curricular_offering"
                                        value={formData.curricular_offering}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                                        required
                                    >
                                        <option value="">Select Offering</option>
                                        {curricularOfferingOptions.map(option => (
                                            <option key={option} value={option}>{option}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Special Order Upload */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                    Special Order (PDF) * <span className="text-xs text-slate-500">(Max 25MB - Compressed on Upload)</span>
                                </label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="file"
                                        accept="application/pdf"
                                        onChange={handleFileUpload}
                                        disabled={uploading || submitting}
                                        className="block w-full text-sm text-slate-500
                                            file:mr-4 file:py-2.5 file:px-4
                                            file:rounded-xl file:border-0
                                            file:text-sm file:font-bold
                                            file:bg-blue-50 file:text-blue-700
                                            hover:file:bg-blue-100
                                            dark:file:bg-slate-700 dark:file:text-slate-300
                                        "
                                    />
                                    {uploading && (
                                        <div className="flex items-center gap-2 text-blue-600 animate-pulse">
                                            <div className="animate-spin h-5 w-5 border-2 border-blue-500 rounded-full border-t-transparent"></div>
                                            <span className="text-xs font-bold">Optimizing & Securing Document...</span>
                                        </div>
                                    )}
                                    {formData.special_order && !uploading && (
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-3">
                                                <span className="text-emerald-600 font-bold text-sm flex items-center gap-1"><FiCheck /> {formData.special_order}</span>
                                                <button
                                                    type="button"
                                                    onClick={handleOptimizePreview}
                                                    disabled={isOptimizing}
                                                    className="px-3 py-1 bg-slate-100 hover:bg-blue-600 hover:text-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-black transition-all flex items-center gap-1 uppercase tracking-tighter shadow-sm"
                                                >
                                                    {isOptimizing ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div> : <FiSave size={12} />}
                                                    {compressionData ? 'Re-Check' : 'Check Optimization'}
                                                </button>
                                            </div>
                                            
                                            {compressionData && (
                                                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between animate-in slide-in-from-top-1 duration-300">
                                                    <div className="space-y-0.5">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Storage Status</span>
                                                            {compressionData.hydra_triggered && (
                                                                <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 px-1.5 py-0.5 rounded text-[9px] font-black uppercase">Hydra Active</span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-sm font-black text-slate-700 dark:text-slate-200">
                                                                {(compressionData.compressed_size / 1024 / 1024).toFixed(2)} MB
                                                            </span>
                                                            <span className="text-xs text-slate-400 line-through">
                                                                {(compressionData.original_size / 1024 / 1024).toFixed(2)} MB
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {compressionData.compressed_size < compressionData.original_size && (
                                                        <div className="bg-emerald-500 text-white px-3 py-1 rounded-lg shadow-sm flex flex-col items-center">
                                                            <span className="text-[10px] font-bold uppercase leading-none">Saved</span>
                                                            <span className="text-sm font-black leading-tight">
                                                                {Math.round((1 - compressionData.compressed_size / compressionData.original_size) * 100)}%
                                                            </span>
                                                        </div>
                                                    )}
                                                    {compressionData.compressed_size >= compressionData.original_size && (
                                                        <div className="text-right">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Optimized</span>
                                                            <span className="text-xs font-bold text-slate-500">Already Lean</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Map Section */}
                            <div className="space-y-3">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                                    <FiMapPin className="inline mr-2" />
                                    School Location *
                                </label>

                                <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 p-3 rounded-xl text-sm flex items-start gap-2 border border-blue-100 dark:border-blue-800">
                                    <FiCheck className="mt-0.5 shrink-0" />
                                    <span>
                                        The map has been centered on the general area.
                                        <strong> Please drag the blue pin </strong> to the exact location of the school you are registering.
                                    </span>
                                </div>

                                <div className="rounded-xl overflow-hidden shadow-md ring-4 ring-slate-100 dark:ring-slate-700" style={{ height: '300px' }}>
                                    <MapContainer
                                        center={mapPosition}
                                        zoom={mapZoom}
                                        style={{ height: '100%', width: '100%' }}
                                    >
                                        <MapAutoCenter position={mapPosition} zoom={mapZoom} />
                                        <TileLayer
                                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                        />
                                        <Marker
                                            position={mapPosition}
                                            draggable={true}
                                            eventHandlers={{
                                                dragend: (e) => {
                                                    const marker = e.target;
                                                    const pos = marker.getLatLng();
                                                    setMapPosition([pos.lat, pos.lng]);
                                                }
                                            }}
                                        />
                                        <MapClickHandler />
                                    </MapContainer>
                                </div>

                                <div className="bg-slate-100 dark:bg-slate-700 p-4 rounded-xl flex flex-wrap justify-between items-center gap-4 text-sm font-mono">
                                    <div className="flex sm:flex-row flex-col items-start sm:items-center gap-4">
                                        <label className="font-bold text-slate-600 dark:text-slate-300 flex items-center">
                                            Lat:
                                            <input
                                                type="number"
                                                step="any"
                                                value={mapPosition[0]}
                                                onChange={(e) => {
                                                    const val = parseFloat(e.target.value);
                                                    setMapPosition([isNaN(val) ? 0 : val, mapPosition[1]]);
                                                }}
                                                className="text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 px-2 py-1.5 rounded ml-2 w-32 outline-none border border-slate-200 dark:border-slate-600 focus:border-blue-500 font-mono text-sm"
                                            />
                                        </label>
                                        <label className="font-bold text-slate-600 dark:text-slate-300 flex items-center">
                                            Lng:
                                            <input
                                                type="number"
                                                step="any"
                                                value={mapPosition[1]}
                                                onChange={(e) => {
                                                    const val = parseFloat(e.target.value);
                                                    setMapPosition([mapPosition[0], isNaN(val) ? 0 : val]);
                                                }}
                                                className="text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 px-2 py-1.5 rounded ml-2 w-32 outline-none border border-slate-200 dark:border-slate-600 focus:border-blue-500 font-mono text-sm"
                                            />
                                        </label>
                                    </div>
                                    <div className="text-xs text-slate-400 dark:text-slate-500 italic">
                                        {mapStatus}
                                    </div>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={submitting || !isFormValid}
                                className={`w-full py-4 font-black rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-widest ${
                                    submitting || !isFormValid
                                        ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed opacity-60'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-xl transform hover:-translate-y-1 active:scale-95'
                                }`}
                            >
                                {submitting ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <FiCheck size={20} />
                                        {isFormValid ? 'Submit for Registration' : 'Complete Form to Submit'}
                                    </>
                                )}
                            </button>
                        </form>
                    </ActionModal>

                    <ActionModal
                        isOpen={activeView === 'requests'}
                        onClose={() => setActiveView(null)}
                        title="My Submissions"
                        subtitle="Track your registration requests"
                        icon={FiList}
                    >
                        <div className="space-y-6">
                            {pendingSchools.length === 0 ? (
                                <div className="text-center py-12 text-slate-400">
                                    <FiClock size={48} className="mx-auto mb-4 opacity-50" />
                                    <p className="text-lg font-bold">No submissions found</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {pendingSchools.map((school) => (
                                        <div
                                            key={school.pending_id}
                                            className="border-[1.5px] border-slate-200 dark:border-slate-700/50 rounded-xl p-4 hover:shadow-md transition-all bg-white dark:bg-slate-800/20"
                                        >
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-lg font-black text-slate-800 dark:text-white truncate leading-tight">{school.school_name}</h3>
                                                    <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-0.5 tracking-wider">{school.school_id}</p>
                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                                                        <span className="text-[10px] text-slate-500 flex items-center gap-1 font-bold uppercase tracking-tight">
                                                            <FiMapPin size={10} className="text-slate-400" />
                                                            {school.municipality}
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 flex items-center gap-1 font-bold uppercase tracking-tight">
                                                            <FiList size={10} className="text-slate-400" />
                                                            {school.district}
                                                        </span>
                                                    </div>
                                                    <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase tracking-widest italic opacity-70">
                                                        Submitted: {new Date(school.submitted_at).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                                    {school.status === 'pending' && (
                                                        <span className="px-3 py-1.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm border border-amber-200/50 dark:border-amber-800/30">
                                                            <FiClock size={12} />
                                                            Pending
                                                        </span>
                                                    )}
                                                    {school.status === 'approved' && (
                                                        <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm border border-emerald-200/50 dark:border-emerald-800/30">
                                                            <FiCheck size={12} />
                                                            Approved
                                                        </span>
                                                    )}
                                                    {school.status === 'rejected' && (
                                                        <div className="flex flex-col items-end gap-1">
                                                            <span className="px-3 py-1.5 bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm border border-rose-200/50 dark:border-rose-800/30">
                                                                <FiX size={12} />
                                                                Rejected
                                                            </span>
                                                            {school.rejection_reason && (
                                                                <p className="text-[9px] text-rose-600 dark:text-rose-400 font-bold max-w-[120px] text-right leading-tight">
                                                                    {school.rejection_reason}
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                    {school.status === 'needs_revision' && (
                                                        <div className="flex flex-col items-end">
                                                            <span className="px-4 py-2 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-xl text-sm font-bold flex items-center gap-2">
                                                                <FiClock size={16} />
                                                                Needs Revision
                                                            </span>
                                                            {school.admin_comment && (
                                                                <div className="mt-2 text-right">
                                                                    <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg border border-amber-200 dark:border-amber-800/50 max-w-[200px] leading-tight">
                                                                        {school.admin_comment}
                                                                    </p>
                                                                </div>
                                                            )}
                                                            <div className="mt-2 flex gap-2">
                                                                <label className="cursor-pointer px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm">
                                                                    <FiUpload />
                                                                    {uploading ? '...' : 'Fix PDF'}
                                                                    <input 
                                                                        type="file" 
                                                                        className="hidden" 
                                                                        accept="application/pdf"
                                                                        onChange={(e) => handleResubmitDocument(school.pending_id, school.school_id, e.target.files[0])}
                                                                        disabled={uploading}
                                                                    />
                                                                </label>
                                                                <button 
                                                                    onClick={() => handleViewOldDoc(school.doc_path)}
                                                                    className="px-4 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-colors border border-slate-200 dark:border-slate-600"
                                                                >
                                                                    View
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </ActionModal>

                    {/* NEW: USER SEARCH MODAL (INTEGRATED) */}
                    <ActionModal
                        isOpen={activeView === 'users'}
                        onClose={() => setActiveView(null)}
                        title="User Account Lookup"
                        subtitle="Retrieve security credentials"
                        icon={FiUsers}
                    >
                        <div className="space-y-6">
                            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
                                Enter the School ID to retrieve account details (email, contact number, and passcode).
                            </p>

                            <div className="flex flex-col md:flex-row gap-5 items-end bg-slate-50 dark:bg-slate-900/50 p-5 rounded-[1.5rem] border border-slate-100 dark:border-slate-800">
                                <div className="flex-1 w-full">
                                    <label className="block text-[9px] font-black text-blue-600 dark:text-blue-400 mb-1.5 uppercase tracking-[0.2em] ml-1">School ID</label>
                                    <input
                                        type="text"
                                        value={userSearchId}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '');
                                            if (val.length <= 6) setUserSearchId(val);
                                        }}
                                        placeholder="e.g. 100000"
                                        className="w-full px-5 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 focus:outline-none dark:text-white font-mono text-lg tracking-widest text-blue-600 dark:text-blue-400 shadow-sm"
                                    />
                                </div>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleSearchUser}
                                    disabled={userSearchId.length !== 6 || isSearchingUser}
                                    className="w-full md:w-auto px-10 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 uppercase tracking-widest text-sm"
                                >
                                    {isSearchingUser ? (
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <FiSearch size={20} />
                                            Search User
                                        </>
                                    )}
                                </motion.button>
                            </div>

                            {/* User details display inside modal */}
                            {foundUser && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white dark:bg-slate-800 rounded-3xl p-6 border-2 border-blue-50 dark:border-blue-900/30 space-y-4 shadow-inner"
                                >
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-700">
                                        <h4 className="font-black text-slate-800 dark:text-white uppercase tracking-tighter">Security Profile</h4>
                                        <span className="px-3 py-1 bg-blue-600 text-white text-[10px] font-black rounded-full uppercase tracking-widest shadow-sm">ID: {foundUser.school_id}</span>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4 text-xs">
                                        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl">
                                            <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Region</label>
                                            <p className="font-bold text-slate-700 dark:text-slate-200 truncate">{foundUser.region}</p>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl">
                                            <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Division</label>
                                            <p className="font-bold text-slate-700 dark:text-slate-200 truncate">{foundUser.division}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl group border border-transparent hover:border-blue-100 dark:hover:border-blue-900/30 transition-all">
                                            <div className="overflow-hidden mr-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase block">Email Address</label>
                                                <p className="font-bold text-slate-700 dark:text-slate-200 truncate">{foundUser.email}</p>
                                            </div>
                                            <button 
                                                onClick={() => copyToClipboard(foundUser.email, 'Email')}
                                                className="p-2 bg-white dark:bg-slate-700 shadow-sm border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 transition-all active:scale-95"
                                            >
                                                <FiCopy size={16} className="text-blue-600" />
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                                            <div className="flex-1 mr-2">
                                                <label className="text-[10px] font-black text-blue-400 uppercase block">Active Passcode</label>
                                                {foundUser.passcode ? (
                                                    <p className="font-mono text-xl font-black text-blue-900 dark:text-blue-200 tracking-[0.3em]">{foundUser.passcode}</p>
                                                ) : (
                                                    <div className="mt-2 flex gap-2">
                                                        <input 
                                                            type="text"
                                                            maxLength={6}
                                                            placeholder="Set 6-digit Code"
                                                            value={newPasscode}
                                                            onChange={(e) => {
                                                                const v = e.target.value.replace(/\D/g, '');
                                                                if (v.length <= 6) setNewPasscode(v);
                                                            }}
                                                            className="flex-1 px-4 py-2 text-sm rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 outline-none focus:border-blue-500 font-mono font-black"
                                                        />
                                                        <button 
                                                            onClick={handleSetPasscode}
                                                            disabled={isSavingPasscode || newPasscode.length < 4}
                                                            className="px-6 py-2 bg-blue-600 text-white text-xs font-black rounded-xl hover:bg-blue-700 disabled:opacity-50 shadow-lg shadow-blue-600/20 uppercase tracking-widest"
                                                        >
                                                            {isSavingPasscode ? '...' : 'Save'}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            {foundUser.passcode && (
                                                <button 
                                                    onClick={() => copyToClipboard(foundUser.passcode, 'Passcode')}
                                                    className="p-3 bg-blue-600 shadow-lg text-white rounded-2xl hover:bg-blue-700 transition-all active:scale-95"
                                                >
                                                    <FiCopy size={20} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    </ActionModal>

                    <ActionModal
                        isOpen={activeView === 'updateStatus'}
                        onClose={() => {
                            setActiveView(null);
                            setUpdateStatusData({ school_id: '', status: 'Open', reason: '' });
                            setSearchedSchoolDetails(null);
                        }}
                        title="Update Status"
                        subtitle="Modify existing school records"
                        icon={FiRefreshCcw}
                    >
                        {!searchedSchoolDetails ? (
                            <div className="space-y-8">
                                <p className="text-slate-500 dark:text-slate-400 font-medium">
                                    Enter the 6-digit School ID to modify its status.
                                </p>

                                <div className="flex flex-col md:flex-row gap-6 items-end bg-slate-50 dark:bg-slate-900/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800">
                                    <div className="flex-1 w-full">
                                        <label className="block text-[10px] font-black text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-[0.2em] ml-1">School ID</label>
                                        <input
                                            type="text"
                                            value={updateStatusData.school_id}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/\D/g, '');
                                                if (val.length <= 6) setUpdateStatusData({ ...updateStatusData, school_id: val });
                                            }}
                                            placeholder="e.g. 100000"
                                            className="w-full px-6 py-4 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl focus:border-blue-500 focus:outline-none dark:text-white font-mono text-xl tracking-widest text-blue-600 dark:text-blue-400 shadow-sm"
                                        />
                                    </div>
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={handleSearchSchoolForStatus}
                                        disabled={updateStatusData.school_id.length !== 6 || searchingStatusSchool}
                                        className="w-full md:w-auto px-10 py-4 bg-[#004A99] hover:bg-blue-700 text-white font-black rounded-2xl shadow-xl shadow-blue-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 uppercase tracking-widest text-sm"
                                    >
                                        {searchingStatusSchool ? (
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            <>
                                                <FiSearch size={20} />
                                                Search School
                                            </>
                                        )}
                                    </motion.button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleUpdateStatus} className="space-y-6">
                                {/* School Details Card */}
                                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900/40 dark:to-slate-800/40 p-6 rounded-[2rem] border border-blue-100 dark:border-blue-800/50 shadow-sm">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="px-2.5 py-1 bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest rounded-full">
                                                    School Found
                                                </span>
                                                <span className="text-slate-400 font-mono text-[10px]">{searchedSchoolDetails.school_id}</span>
                                            </div>
                                            <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight leading-tight">
                                                {searchedSchoolDetails.school_name}
                                            </h3>
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={() => setSearchedSchoolDetails(null)}
                                            className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest hover:underline flex items-center gap-1"
                                        >
                                            <FiRefreshCcw size={10} />
                                            Change School
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-200 dark:border-slate-700/50">
                                        <div>
                                            <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Region</label>
                                            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{searchedSchoolDetails.region}</p>
                                        </div>
                                        <div>
                                            <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Division</label>
                                            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{searchedSchoolDetails.division}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Status Toggle Section */}
                                <div className="space-y-3">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 text-center">Update Operational Status</label>
                                    
                                    <div className="flex p-1.5 bg-slate-100 dark:bg-slate-900/50 rounded-[1.8rem] border border-slate-200 dark:border-slate-800">
                                        <button
                                            type="button"
                                            onClick={() => setUpdateStatusData({ ...updateStatusData, status: 'Open' })}
                                            className={`flex-1 py-3.5 rounded-[1.3rem] font-black text-[11px] uppercase tracking-widest transition-all ${
                                                updateStatusData.status === 'Open'
                                                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                            }`}
                                        >
                                            Open / Active
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setUpdateStatusData({ ...updateStatusData, status: 'Closed' })}
                                            className={`flex-1 py-3.5 rounded-[1.3rem] font-black text-[11px] uppercase tracking-widest transition-all ${
                                                updateStatusData.status === 'Closed'
                                                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                            }`}
                                        >
                                            Closed / Archived
                                        </button>
                                    </div>
                                </div>

                                {updateStatusData.status === 'Closed' && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="space-y-2"
                                    >
                                        <label className="block text-[9px] font-black text-rose-500 mb-1 uppercase tracking-[0.2em] ml-1">Reason for Closure *</label>
                                        <textarea
                                            value={updateStatusData.reason}
                                            onChange={(e) => setUpdateStatusData({ ...updateStatusData, reason: e.target.value.substring(0, 100) })}
                                            placeholder="Reason for archive..."
                                            rows="3"
                                            maxLength="100"
                                            className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-700 rounded-[1.5rem] focus:border-rose-500 focus:outline-none dark:text-white transition-all resize-none shadow-inner text-sm"
                                            required
                                        ></textarea>
                                        <p className="text-[8px] text-slate-400 text-right font-bold uppercase tracking-widest">{updateStatusData.reason.length}/100</p>
                                    </motion.div>
                                )}

                                <button
                                    type="submit"
                                    disabled={updatingStatus || (updateStatusData.status === 'Closed' && !updateStatusData.reason)}
                                    className={`w-full py-4 font-black rounded-[1.5rem] shadow-2xl transition-all flex items-center justify-center gap-3 uppercase tracking-[0.15em] text-[12px] ${
                                        updatingStatus || (updateStatusData.status === 'Closed' && !updateStatusData.reason)
                                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                                            : 'bg-[#004A99] hover:bg-blue-700 text-white shadow-blue-900/20 shadow-xl'
                                    }`}
                                >
                                    {updatingStatus ? (
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <FiSave size={16} />
                                            Update Master Record
                                        </>
                                    )}
                                </button>
                            </form>
                        )}
                    </ActionModal>
                </div>


                {/* MODAL: Confirmation */}
                {showConfirmModal && (
                    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
                        <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl transform scale-100 animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700 my-auto">
                            <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto text-amber-500 mb-6 shadow-sm">
                                <FiClock size={32} />
                            </div>

                            <h3 className="text-center text-2xl font-black text-slate-800 dark:text-white mb-2 uppercase tracking-wide">VERIFICATION</h3>

                            <p className="text-center text-slate-600 dark:text-slate-300 font-medium mb-6 leading-relaxed">
                                By submitting this form, you confirm that this school is <br />
                                {isConverting ? (
                                    <span className="text-blue-600 dark:text-blue-400 font-black text-lg uppercase mt-1 block">CONVERTED and NOT NEWLY ESTABLISHED</span>
                                ) : (
                                    <span className="text-rose-600 dark:text-rose-400 font-black text-lg uppercase mt-1 block">NEWLY ESTABLISHED and NOT CONVERTED</span>
                                )}
                            </p>

                            <div className="text-center mb-8">
                                <span className={`text-4xl font-black tabular-nums tracking-tighter ${confirmTimer > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                    {confirmTimer > 0 ? confirmTimer : <FiCheck className="inline" />}
                                </span>
                                {confirmTimer > 0 && <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mt-1">Seconds remaining</span>}
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowConfirmModal(false)}
                                    className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmSubmit}
                                    disabled={!canConfirm}
                                    className={`flex-1 py-3.5 rounded-xl font-bold text-white transition-all shadow-lg ${canConfirm
                                        ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20 transform hover:-translate-y-1'
                                        : 'bg-slate-300 dark:bg-slate-600 cursor-not-allowed opacity-70'
                                        }`}
                                >
                                    Confirm Submit
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* MODAL: Success Confirmation */}
                {showSuccessModal && lastSubmissionDetails && (
                    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
                        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-10 max-w-sm w-full shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] transform scale-100 animate-in zoom-in-[0.8] duration-300 border border-slate-200 dark:border-slate-700 text-center">
                            
                            <div className="relative mb-8">
                                <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto text-emerald-500 relative z-10">
                                    <FiCheck size={48} className="animate-in zoom-in-50 duration-500 delay-150" />
                                </div>
                                <div className="absolute inset-0 bg-emerald-400/20 rounded-full scale-125 animate-ping duration-[3s]"></div>
                            </div>

                            <h3 className="text-3xl font-black text-slate-800 dark:text-white mb-2 tracking-tight">SUCCESS!</h3>
                            <p className="text-slate-500 dark:text-slate-400 font-bold mb-8 text-sm uppercase tracking-widest">School Submitted</p>

                            <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 mb-8 space-y-4">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Assigned ID</p>
                                    <p className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono tracking-tighter">{lastSubmissionDetails.school_id}</p>
                                </div>
                                
                                <div className="h-px bg-slate-200 dark:bg-slate-800 w-12 mx-auto"></div>

                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">School Name</p>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 line-clamp-2 px-2 uppercase">{lastSubmissionDetails.school_name}</p>
                                </div>

                                <div className="flex items-center justify-center gap-2 pt-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                    <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-wider">Registration Active</span>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    setShowSuccessModal(false);
                                    setActiveView('requests');
                                }}
                                className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] transition-all shadow-xl shadow-blue-500/20 transform hover:-translate-y-1 active:scale-95"
                            >
                                View Submissions
                            </button>
                        </div>
                    </div>
                )}
            

            <BottomNav userRole={userData?.role} />


        </div>
    </PageTransition>
    );
};

export default SchoolManagement;
