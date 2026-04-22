import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import PageTransition from '../components/PageTransition';
import Papa from 'papaparse';
import EXIF from 'exif-js';
// Removed Firebase imports - using PostgreSQL + LocalStorage
import { useAuth } from '../context/AuthContext';
// --- IMPORT NEW DB LOGIC ---
import { addEngineerToOutbox, getCachedProjects } from '../db';
// --- CONSTANTS ---
const DOC_TYPES = {
    POW: "Program of Works",
    DUPA: "DUPA",
    CONTRACT: "Signed Contract"
};

// Kept for offline fallback provided logic exists elsewhere, or for images if needed (though images use compressImage)
const convertFullFileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
};
import { compressImage } from '../utils/imageCompression';
import LocationPickerMap from '../components/LocationPickerMap'; // Import Map Component
import { FiLock, FiUnlock } from 'react-icons/fi';

// Helper component for Section Headers
const SectionHeader = ({ title }) => (
    <div className="text-slate-700 font-black text-[10px] uppercase tracking-widest mt-8 mb-4 ml-1">
        <h2>{title}</h2>
    </div>
);

const NewProjects = () => {
    const { user, token } = useAuth();
    const userRole = user?.role || '';
    const accountCategory = user?.account_category || '';
    const navigate = useNavigate();
    const location = useLocation();
    const isDummy = location.state?.isDummy || false;
    const [activeTab, setActiveTab] = useState(0);

    // Lock/unlock for map — covers both raw DB values and normalized display values
    const canEditLocation = ['Division Engineer', 'deped_engineer', 'DepEd Engineer', 'Architect', 'architect'].includes(userRole);
    // Start in editing mode for the creation form (user must set a location)
    const [isLocationEditing, setIsLocationEditing] = useState(true);

    const TABS = [
        { id: 0, label: 'Overview' },
        { id: 1, label: 'Location' },
        { id: 2, label: 'Status' },
        { id: 3, label: 'Finance' },
        { id: 4, label: 'Media' }
    ];

    // --- FETCH ROLE ---
    useEffect(() => {
        if (user && user.role === 'Super User') {
            alert("⚠️ ACCESS DENIED\n\nSuper Users have Read-Only access to Engineer concepts.");
            navigate('/engineer-dashboard');
        }
    }, [user, navigate]);



    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- NEW STATE FOR FAB AND IMAGES ---
    const fileInputRef = useRef(null);
    const [showUploadOptions, setShowUploadOptions] = useState(false);

    // Split State for Internal/External
    const [internalFiles, setInternalFiles] = useState([]);
    const [internalPreviews, setInternalPreviews] = useState([]);

    const [externalFiles, setExternalFiles] = useState([]);
    const [externalPreviews, setExternalPreviews] = useState([]);

    const [activeCategory, setActiveCategory] = useState('Internal'); // To track which button clicked

    // Removed legacy selectedFiles/previews
    const [selectedFiles, setSelectedFiles] = useState([]); // Kept for backward compat checks if needed, but we will use the new ones. 
    // Actually best to remove selectedFiles usage entirely to avoid confusion, but handleSubmit uses it. 
    // I will update handleSubmit. Let's keep these lines commented out or remove them.

    const [documents, setDocuments] = useState({
        POW: null,
        DUPA: null,
        CONTRACT: null,
        RTA: null,
        MOA: null
    });

    // 1.) Category Choices
    const PROJECT_CATEGORIES = [
        "New Construction",
        "Repair and Rehab",
        "Last Mile Schools", 
        "Health facilities",
        "Gabaldon Restoration",
        "Library Hub",
        "SpEd Inclusive Learning Resource Centers (ILRC)",
        "Alternative Learning System - Community Based Learning Centers (ALS-CLC)",
        "Midrise School Building",
        "QRF",
        "Electrification"
    ];

    // --- NEW: IMPORT PROJECT DATA STATES ---
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importSearch, setImportSearch] = useState('');
    const [availableProjects, setAvailableProjects] = useState([]);
    const [isSearchingProjects, setIsSearchingProjects] = useState(false);


    
    // --- PRE-FILL DUMMY DATA ---
    useEffect(() => {
        if (isDummy) {
            setFormData({
                region: 'Region I',
                division: 'Ilocos Norte',
                schoolName: 'Sample School Elementary',
                projectName: 'Construction of 2 Storey 4 Classroom',
                schoolId: '100001',
                status: 'Ongoing',
                accomplishmentPercentage: 45,
                statusAsOfDate: '2023-10-15',
                targetCompletionDate: '2024-03-30',
                actualCompletionDate: '',
                noticeToProceed: '2023-08-01',
                contractorName: 'XYZ Construction Corp.',
                approved_budget_for_contract: '12,500,000',
                contract_amount: '12,000,000',
                batchOfFunds: 'Batch 2',
                fundingYear: '2024',
                otherRemarks: 'On schedule. Foundation complete. This is a sample entry.'
            });
        }
    }, [isDummy]);

    const [formData, setFormData] = useState({
        // Basic Info
        region: '',
        division: '',
        schoolName: '',
        projectName: '',
        schoolId: '',

        // Status & Progress
        status: '',
        statusDesignPhase: '',
        accomplishmentPercentage: 0,
        statusAsOfDate: '',

        // Procurement Milestones
        issuanceOfInvitationToBid: '',
        preBidConference: '',
        openingOfTechnicalProposal: '',
        openingOfFinancialProposal: '',
        requestForQuotation: '',
        negotiation: '',
        openingOfQuotation: '',
        dateNoticeOfAward: '',

        // Timelines
        targetCompletionDate: '',
        actualCompletionDate: '',
        noticeToProceed: '',

        // Contractors & Funds
        contractId: '',
        contractorName: '',
        approved_budget_for_contract: '',
        contract_amount: '',
        fundingYear: new Date().getFullYear().toString(),
        batchOfFunds: '',

        // Remarks
        otherRemarks: '',
        numberOfUnits: 0,

        // Location (New)
        latitude: '',
        longitude: '',

        // --- NEW FIELDS ---
        projectCategory: '',
        scopeOfWork: '',
        constructionStartDate: '',


        // --- NEW LGU FIELDS ---
        moa_date: '',
        tranches_count: '',
        tranche_amount: '',
        fund_source: '',
        province: '',
        city: '',
        municipality: '',
        legislative_district: '',
        scope_of_works: '',
        bid_opening_date: '',
        resolution_award_date: '',
        procurement_stage: '',
        bidding_date: '',
        awarding_date: '',
        construction_start_date: '',
        funds_downloaded: '',
        funds_utilized: '',
        program_type: 'BEFF',

        // --- HRODI FIELDS ---
        implementingAgency: '',
        implementingAgencySpecific: '',
        isImported: false
    });

    // --- NEW: GEOLOCATION LOGIC ---
    const handleGetCurrentLocation = () => {
        if (!navigator.geolocation) {
            alert("❌ Geolocation is not supported by your browser.");
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude.toFixed(6);
                const long = position.coords.longitude.toFixed(6);

                setFormData(prev => ({
                    ...prev,
                    latitude: lat,
                    longitude: long
                }));
            },
            (error) => {
                console.warn("Geolocation warning:", error);

                // Fallback / Detailed Error
                let msg = "Unable to retrieve location.";
                if (error.code === 1) msg = "❌ Location permission denied. Please enable location services.";
                else if (error.code === 2) msg = "❌ Position unavailable. Check your GPS signal.";
                else if (error.code === 3) msg = "❌ Location request timed out.";

                alert(msg);
            },
            options
        );
    };

    const handleLocationSelect = (lat, lng) => {
        setFormData(prev => ({
            ...prev,
            latitude: lat.toFixed(6),
            longitude: lng.toFixed(6)
        }));
    };

    // --- NEW: IMPORT PROJECT DATA LOGIC ---
    const searchProjectsToImport = async (query) => {
        if (!query || query.length < 3) return;
        setIsSearchingProjects(true);
        try {
            // Use existing /api/projects endpoint but we'll filter on frontend or add search param if backend supports it
            const res = await fetch(`/api/projects?search=${encodeURIComponent(query)}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (res.ok) {
                const data = await res.json();
                setAvailableProjects(data || []);
            }
        } catch (err) {
            console.error("Search failed:", err);
        } finally {
            setIsSearchingProjects(false);
        }
    };

    const handleImportProject = (proj) => {
        setFormData(prev => ({
            ...prev,
            projectName: proj.projectName || '',
            schoolId: proj.schoolId || '',
            schoolName: proj.schoolName || '',
            region: proj.region || '',
            division: proj.division || '',
            approved_budget_for_contract: proj.approved_budget_for_contract ? Number(proj.approved_budget_for_contract).toLocaleString('en-US') : (proj.projectAllocation ? Number(proj.projectAllocation).toLocaleString('en-US') : ''),
            contract_amount: proj.contract_amount ? Number(proj.contract_amount).toLocaleString('en-US') : '',
            contractorName: proj.contractorName || '',
            batchOfFunds: proj.batchOfFunds || '',
            projectCategory: proj.projectCategory || '',
            scopeOfWork: proj.scopeOfWork || '',
            latitude: proj.latitude || '',
            longitude: proj.longitude || '',
            isImported: true
        }));
        setIsImportModalOpen(false);
        alert(`✅ Imported data for: ${proj.projectName}`);
    };

    // --- NEW: FILE HANDLING FUNCTIONS ---
    const handleFileChange = (e) => {
        const files = e.target.files;
        if (files) {
            const newFiles = Array.from(files);
            const newPreviews = newFiles.map(file => URL.createObjectURL(file));

            if (activeCategory === 'Internal') {
                setInternalFiles(prev => [...prev, ...newFiles]);
                setInternalPreviews(prev => [...prev, ...newPreviews]);
            } else {
                setExternalFiles(prev => [...prev, ...newFiles]);
                setExternalPreviews(prev => [...prev, ...newPreviews]);
            }

            // --- NEW: METADATA EXTRACTION ---
            newFiles.forEach(file => {
                EXIF.getData(file, function() {
                    const lat = EXIF.getTag(this, "GPSLatitude");
                    const lon = EXIF.getTag(this, "GPSLongitude");
                    const dateTaken = EXIF.getTag(this, "DateTimeOriginal") || EXIF.getTag(this, "DateTime");

                    if (lat && lon) {
                        const latRef = EXIF.getTag(this, "GPSLatitudeRef") || "N";
                        const lonRef = EXIF.getTag(this, "GPSLongitudeRef") || "E";

                        // Helper for rational numbers used in EXIF
                        const toDecimal = (gpsData, ref) => {
                            const d = gpsData[0].numerator ? gpsData[0].numerator / gpsData[0].denominator : gpsData[0];
                            const m = gpsData[1].numerator ? gpsData[1].numerator / gpsData[1].denominator : gpsData[1];
                            const s = gpsData[2].numerator ? gpsData[2].numerator / gpsData[2].denominator : gpsData[2];
                            let coordinate = d + (m / 60) + (s / 3600);
                            if (ref === "S" || ref === "W") coordinate *= -1;
                            return coordinate;
                        };

                        const decimalLat = toDecimal(lat, latRef);
                        const decimalLon = toDecimal(lon, lonRef);

                        setFormData(prev => {
                            // Only auto-fill if currently empty or zero
                            const isExistingCoord = prev.latitude && Number(prev.latitude) !== 0;
                            
                            return {
                                ...prev,
                                latitude: isExistingCoord ? prev.latitude : decimalLat.toFixed(6),
                                longitude: isExistingCoord ? prev.longitude : decimalLon.toFixed(6),
                                // Set Survey Date if empty
                                statusAsOfDate: !prev.statusAsOfDate && dateTaken ? dateTaken.split(' ')[0].replace(/:/g, '-') : prev.statusAsOfDate
                            };
                        });
                        
                        alert(`📍 PHOTO METADATA DETECTED\n\nCoordinates: ${decimalLat.toFixed(6)}, ${decimalLon.toFixed(6)}\nDate Captured: ${dateTaken || "N/A"}\n\nThis data has been added to your form.`);
                    }
                });
            });
        }
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeFile = (index, category) => {
        if (category === 'Internal') {
            setInternalFiles(prev => prev.filter((_, i) => i !== index));
            setInternalPreviews(prev => prev.filter((_, i) => i !== index));
        } else {
            setExternalFiles(prev => prev.filter((_, i) => i !== index));
            setExternalPreviews(prev => prev.filter((_, i) => i !== index));
        }
    };

    const handleDocumentSelect = (e, type) => {
        const file = e.target.files[0];
        if (file) {
            if (file.type !== "application/pdf") {
                alert("⚠️ INVALID FORMAT\n\nPlease upload a valid PDF file.");
                return;
            }
            // Store raw file object for upload
            setDocuments(prev => ({ ...prev, [type]: file }));
        }
    };

    const removeDocument = (type) => {
        setDocuments(prev => ({ ...prev, [type]: null }));
    };

    const triggerFilePicker = (mode, category) => {
        setActiveCategory(category);
        if (fileInputRef.current) {
            if (mode === 'camera') {
                fileInputRef.current.setAttribute('capture', 'environment');
            } else {
                fileInputRef.current.removeAttribute('capture');
            }
            fileInputRef.current.click();
        }
    };

    // --- 2. VALIDATION LOGIC ---
    // ONLINE: Uses database API
    // OFFLINE: Parses public/schools.csv directly (static asset, always available)
    const handleValidateSchoolId = async () => {
        // Basic check
        if (!formData.schoolId) {
            alert("Please enter a School ID.");
            return;
        }

        const schoolId = formData.schoolId.trim();

        // Helper to update form with found data
        const updateForm = (found) => {
            // Robust coordinate mapping (handles various DB/API key naming conventions)
            const detectedLat = found.latitude ?? found.Latitude ?? found.lat ?? found.Lat ?? '';
            const detectedLong = found.longitude ?? found.Longitude ?? found.long ?? found.Long ?? found.lng ?? found.Lng ?? '';

             setFormData(prev => ({
                ...prev,
                schoolName: found.school_name || found.School_Name || found.SchoolName || '',
                region: found.region || found.Region || '',
                division: found.division || found.Division || '',
                // --- AUTO POPULATE COORDINATES ---
                latitude: detectedLat || prev.latitude,
                longitude: detectedLong || prev.longitude
            }));

            let idMsg = `✅ School Found: ${found.school_name || found.SchoolName}`;
            if (detectedLat && detectedLong) {
                idMsg += `\n📍 Coordinates Auto-Detected! (${detectedLat}, ${detectedLong})`;
            }
            alert(idMsg);
        };

        // ========== OFFLINE MODE: Parse CSV directly ==========
        if (!navigator.onLine) {
            console.log("⚠️ Offline Mode: Parsing schools.csv for school ID:", schoolId);
            try {
                // Fetch the CSV from public folder (works offline because it's a cached static asset)
                const response = await fetch('/schools.csv');
                const csvText = await response.text();
                
                Papa.parse(csvText, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        const found = results.data.find(row => 
                            String(row.school_id).trim() === String(schoolId).trim()
                        );
                        if (found) {
                            updateForm(found);
                        } else {
                            alert("❌ School ID not found.\nPlease check the ID and try again.");
                        }
                    },
                    error: (err) => {
                        console.error("CSV Parse Error:", err);
                        alert("❌ Failed to read school data file.");
                    }
                });
            } catch (err) {
                console.error("Offline CSV Fetch Error:", err);
                alert("❌ Could not load school data for offline validation.");
            }
            return;
        }

        // ========== ONLINE MODE: Use database API ==========
        try {
            const res = await fetch(`/api/school-profile/${schoolId}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (res.ok) {
                const found = await res.json();
                updateForm(found);
            } else {
                if (navigator.onLine) {
                     alert(`❌ School ID ${schoolId} not found in database.`);
                }
                setFormData(prev => ({
                    ...prev,
                    schoolName: '',
                    region: '',
                    division: ''
                }));
            }
        } catch (err) {
            console.error("Validation Error:", err);
            // Fallback: Try CSV if API fails
            console.log("🔄 API failed, trying CSV fallback...");
            try {
                const response = await fetch('/schools.csv');
                const csvText = await response.text();
                Papa.parse(csvText, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        const found = results.data.find(row => 
                            String(row.school_id).trim() === String(schoolId).trim()
                        );
                        if (found) {
                            console.log("✅ Found via CSV fallback");
                            updateForm(found);
                        } else {
                            alert("❌ Validation Failed: Unable to connect to server and school not found in local data.");
                        }
                    }
                });
            } catch (csvErr) {
                alert("❌ Validation Failed: Unable to connect to server.");
            }
        }
    };

    // --- 3. HANDLE CHANGE ---
    const handleChange = (e) => {
        let { name, value } = e.target;
        // Numeric constraint for School ID
        if (name === 'schoolId') {
            value = value.replace(/\D/g, '');
            if (value.length > 6) value = value.slice(0, 6);
        }
        // Force Uppercase for Contractor Name, Project Name, Project Category, Scope of Work, Batch of Funds
        if (['contractorName', 'projectName', 'scopeOfWork', 'batchOfFunds'].includes(name)) {
            value = value.toUpperCase();
        }

        // Auto-comma for Approved Budget, Contract Amount, and Funds Utilized
        if (['approved_budget_for_contract', 'contract_amount', 'fundsUtilized'].includes(name)) {
            const raw = value.replace(/,/g, '').replace(/[^0-9.]/g, '');
            if (!raw) {
                value = '';
            } else {
                const parts = raw.split('.');
                parts[0] = Number(parts[0]).toLocaleString('en-US');
                value = parts.join('.');
            }
        }

        setFormData(prev => {
            const newData = { ...prev, [name]: value };

            // Auto-update percentage based on status
            if (name === 'status') {
                // If status is "Not Yet Started" or "Under Procurement", percentage must be 0
                if (['Not Yet Started', 'Under Procurement'].includes(value)) {
                    newData.accomplishmentPercentage = 0;
                }
                // If status is "Completed", percentage must be 100
                else if (['Completed', 'For Final Inspection'].includes(value)) {
                    newData.accomplishmentPercentage = 100;
                }
            }

            // Validate Accomplishment Percentage
            if (name === 'accomplishmentPercentage') {
                // Remove leading zeros (e.g. "02" -> "2")
                if (value.length > 1 && value.startsWith('0')) {
                    value = value.replace(/^0+/, '');
                    newData.accomplishmentPercentage = value;
                }

                let percent = Number(value);

                // Limit 0 to 100
                if (percent < 0) {
                    percent = 0;
                    newData.accomplishmentPercentage = 0;
                } else if (percent > 100) {
                    percent = 100;
                    newData.accomplishmentPercentage = 100;
                }

                // Auto-update status based on percentage
                if (percent === 100 && prev.status !== 'Completed') {
                    newData.status = 'For Final Inspection';
                } else if (percent > 0 && percent < 100 && ['Not Yet Started', 'Under Procurement', 'Completed'].includes(prev.status)) {
                    newData.status = 'Ongoing';
                }
                // REMOVED: Automatic 'Not Yet Started' assignment to allow placeholder
                /*
                else if (percent === 0) {
                    newData.status = 'Not Yet Started';
                }
                */
            }

            return newData;
        });
    };

    // --- 4. SUBMIT LOGIC (3-STEP PROCESS) ---
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (isDummy) {
            alert("PREVIEW MODE: This project entry will NOT be saved.");
            navigate('/dummy-forms', { state: { type: 'engineer' } });
            return;
        }

        // --- VALIDATIONS ---
        if (!formData.projectName || !formData.schoolName) {
            alert("⚠️ MISSING DETAILS\n\nPlease provide at least the Project Name and School Name.");
            return;
        }

        // DOCUMENT VALIDATION REMOVED PER USER REQUEST (Consideration for early stage projects)
        /*
        if (!documents.POW || !documents.DUPA || !documents.CONTRACT) {
            alert("⚠️ INCOMPLETE SUBMISSION\n\nYou must fill up all the forms and upload all required documents (POW, DUPA, Signed Contract) before creating the project.");
            return;
        }
        */

        // CONDITIONAL PHOTO VALIDATION
        if (!['', 'Not Yet Started', 'Under Procurement', 'Under procurement'].includes(formData.status)) {
            if (internalFiles.length === 0 && externalFiles.length === 0) {
                alert("⚠️ PROOF REQUIRED\n\nAccording to COA requirements, you must attach at least one site photo for every project entry.");
                return;
            }
        }

        if (!formData.latitude || !formData.longitude) {
            alert("⚠️ LOCATION REQUIRED\n\nAccording to COA requirements, you must capture the project's coordinates.\nPlease use the 'Get Current Location' button.");
            return;
        }

        const requiredFields = [
            { key: 'region', label: 'Region' },
            { key: 'division', label: 'Division' },
            { key: 'statusAsOfDate', label: 'Status Date' },
            { key: 'targetCompletionDate', label: 'Target Completion Date' },
            { key: 'contractorName', label: 'Contractor Name' },
            { key: 'approved_budget_for_contract', label: 'Approved Budget for Contract (ABC)' },
            { key: 'contract_amount', label: 'Contract Amount' },
            { key: 'fundingYear', label: 'Funding Year' },
            { key: 'batchOfFunds', label: 'Batch of Funds' }
            // { key: 'otherRemarks', label: 'Remarks' } // REMOVED: Now Optional
        ];

        for (const field of requiredFields) {
            const isEarlyStage = ['', 'Not Yet Started', 'Under Procurement', 'Under procurement'].includes(formData.status);
            const isTimelineField = ['targetCompletionDate', 'statusAsOfDate'].includes(field.key);
            
            if (isEarlyStage && isTimelineField) continue; // Skip these for early stages

            if (!formData[field.key]) {
                alert(`⚠️ MISSING FIELD\n\nPlease enter the ${field.label}. All fields are mandatory.`);
                return;
            }
        }

        // CONTRACT AMOUNT VALIDATION
        const abcAmt = Number(formData.approved_budget_for_contract?.toString().replace(/,/g, '') || 0);
        const contractAmt = Number(formData.contract_amount?.toString().replace(/,/g, '') || 0);
        if (contractAmt > abcAmt) {
            alert("⚠️ INVALID AMOUNT\n\nContract Amount must be equal to or less than the Approved Budget for Contract (ABC).");
            return;
        }

        setIsSubmitting(true);

        try {
            // A. Prepare Images (Base64) with Category
            const compressedImages = [];

            // Process Internal
            for (const file of internalFiles) {
                const base64 = await compressImage(file);
                compressedImages.push({ image_data: base64, category: 'Internal' });
            }
            // Process External
            for (const file of externalFiles) {
                const base64 = await compressImage(file);
                compressedImages.push({ image_data: base64, category: 'External' });
            }

            // We will upload them sequentially AFTER project creation
            const projectBody = {
                ...formData,
                statusOfConstructionPhase: formData.status,
                approved_budget_for_contract: Number(formData.approved_budget_for_contract?.toString().replace(/,/g, '') || 0),
                contract_amount: Number(formData.contract_amount?.toString().replace(/,/g, '') || 0),
                uid: user.uid,
                modifiedBy: user.displayName || 'Engineer',
                images: compressedImages,
                update_type: 'Newly Created',
                // documents: processedDocs, // REMOVED: Sending docs separately
                statusAsOfDate: new Date().toISOString(),
                uploader_type: (user?.role === 'EFD' || user?.role === 'EFD Engineer' || user?.role === 'HRODI' || user?.role === 'Division Engineer' || user?.role === 'DepEd Engineer') ? 'DepEd Engineer' :
                               ((user?.role === 'Non-DepEd Engineer' || user?.account_category === 'Non-DepEd Engineer') ? 'Non-DepEd Engineer' : 'DepEd Engineer'),
                implementingAgency: (user?.role === 'Division Engineer' || user?.role === 'Engineer') ? 'DepEd' : (formData.implementingAgency || null),
                implementingAgencySpecific: formData.implementingAgencySpecific || null
            };

            // --- OFFLINE/ONLINE CHECK ---
            // Determine endpoint based on role
            const endpointUrl = (user.role === 'Local Government Unit') ? '/api/lgu/save-project' : '/api/save-project';

            const payload = {
                url: endpointUrl,
                method: 'POST',
                body: projectBody,
                formName: `Project: ${formData.projectName}`
            };

            if (!navigator.onLine) {
                await addEngineerToOutbox(payload);
                alert("📁 No internet. Project (Metadata & Images) saved to Sync Center.\n⚠️ Documents must be uploaded when online.");
                setIsSubmitting(false);
                
                if (user.role === 'EFD' || user.role === 'EFD Engineer' || user.role === 'HRODI') {
                    navigate('/efd-monitoring');
                } else {
                    navigate('/engineer-dashboard');
                }
                return;
            }

            // --- ONLINE SUBMISSION ---
            let endpoint = '/api/save-project';

            // LGU SPECIFIC ENDPOINT
            if (user.role === 'Local Government Unit') {
                endpoint = '/api/lgu/save-project';
            }

            const projectRes = await fetch(endpoint, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify(projectBody),
            });

            if (!projectRes.ok) {
                const contentType = projectRes.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    const errorData = await projectRes.json();
                    throw new Error(errorData.message || 'Failed to save project');
                } else {
                    const errorText = await projectRes.text();
                    throw new Error(`Server Error (${projectRes.status}): ${projectRes.statusText}`);
                }
            }

            const projectData = await projectRes.json();
            
            // --- E. BULK DOCUMENT UPLOAD ---
            const newProjectId = projectData.project.project_id;
            console.log("Project Created! ID:", newProjectId);

            // Filter for non-null documents to send in bulk via multipart/form-data
            const formDataDocs = new FormData();
            formDataDocs.append('projectId', newProjectId);
            formDataDocs.append('uid', user.uid);
            
            let hasDocs = false;
            if (documents.POW) { formDataDocs.append('POW', documents.POW); hasDocs = true; }
            if (documents.DUPA) { formDataDocs.append('DUPA', documents.DUPA); hasDocs = true; }
            if (documents.CONTRACT) { formDataDocs.append('CONTRACT', documents.CONTRACT); hasDocs = true; }

            const isEFDOrHRODI = (user?.role === 'EFD' || user?.role === 'HRODI Engineer' || user?.role === 'HRODI' || user?.account_category === 'DepEd Engineer' || user?.account_category === 'EFD');
            if (documents.RTA && isEFDOrHRODI) { formDataDocs.append('RTA', documents.RTA); hasDocs = true; }
            if (documents.MOA && isEFDOrHRODI) { formDataDocs.append('MOA', documents.MOA); hasDocs = true; }

            if (hasDocs) {
                console.log("Uploading documents in bulk via Multer...");
                try {
                    const bulkEndpoint = (user?.role === 'Local Government Unit') ? '/api/lgu/bulk-upload-project-documents' : '/api/bulk-upload-project-documents';
                    
                    const bulkRes = await fetch(bulkEndpoint, {
                        method: 'POST',
                        body: formDataDocs,
                        headers: token ? { Authorization: `Bearer ${token}` } : {}
                    });

                    if (!bulkRes.ok) throw new Error("Failed to upload compressed documents in bulk");
                    console.log("Bulk Documentation Compressed & Uploaded successfully!");
                } catch (docErr) {
                    console.error("Bulk upload failed:", docErr);
                    alert("⚠️ Project metadata saved, but documents failed to upload. Please try updating them in the Edit modal.");
                }
            }
            const ipc = projectData.ipc;

            alert(`✅ Project ${ipc} created and all documents saved successfully!`);
            
            // Clear local cache to force fresh fetch on dashboard
            try {
                const { clearProjectsCache } = await import('../db');
                await clearProjectsCache();
            } catch (cacheErr) {
                console.warn("Failed to clear projects cache:", cacheErr);
            }

            if (user.role === 'EFD' || user.role === 'HRODI Engineer' || user.role === 'EFD Engineer') {
                navigate('/efd-monitoring');
            } else {
                navigate('/engineer-dashboard');
            }

        } catch (error) {
            console.error("Submission failed:", error);

            // Try saving to outbox if it might be a network glitch
            try {
                // We can't easily reconstruct the exact payload if we failed mid-way, 
                // but typically if fetch failed, we are here.

                alert(`❌ Submission Failed: ${error.message}\n\nPlease check your connection and try again.`);
            } catch (fallbackErr) {
                alert(`❌ Critical Error: ${error.message}`);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 font-sans pb-32">

                <div className="bg-[#004A99] pt-8 pb-8 px-6 rounded-b-[2rem] shadow-xl relative">
                    <div className="flex items-center justify-between text-white mb-4">
                        <div className="flex items-center gap-3">
                            <button onClick={() => isDummy ? navigate('/dummy-forms', { state: { type: 'engineer' } }) : navigate(-1)} className="p-2">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                                </svg>
                            </button>
                            <h1 className="text-xl font-bold">New Project Entry</h1>
                        </div>
                        
                        {/* 
                        {!isDummy && (
                            <button 
                                type="button"
                                onClick={() => setIsImportModalOpen(true)}
                                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-sm font-bold transition-all border border-white/30 backdrop-blur-sm"
                            >
                                <span className="text-lg">📥</span> Import Project
                            </button>
                        )}
                        */}
                    </div>
                </div>

                {isDummy && (
                    <div className="mx-6 -mt-6 mb-6 bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center gap-3 shadow-lg relative z-20">
                        <div className="p-2 bg-amber-100 rounded-lg text-amber-600 text-xl">👁️</div>
                        <div>
                            <h3 className="font-bold text-amber-900 text-sm">Preview Mode</h3>
                            <p className="text-xs text-amber-700">Data entered here will NOT be saved.</p>
                        </div>
                    </div>
                )}

                {isSubmitting && (
                    <div className="fixed inset-0 z-[999] bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                        <h2 className="text-2xl font-bold text-white mb-2">Saving Project...</h2>
                        <p className="text-blue-200 text-sm max-w-[300px]">Securing project details and queueing documents for compression engine. Please don't close this page.</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="px-6 relative z-10 pt-6">
                    {/* --- PROGRESS LINE --- */}
                    <div className="bg-white/95 backdrop-blur-md p-4 rounded-3xl shadow-lg border border-slate-100 mb-8 overflow-hidden relative group transition-all duration-300 hover:shadow-xl">
                        <div className="flex justify-between items-center mb-4 px-2 relative z-10">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 font-sans">Form Stepper</h3>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Progress:</span>
                                <span className="text-xl font-black text-[#004A99] font-mono">{Math.round((activeTab / (TABS.length - 1)) * 100)}%</span>
                            </div>
                        </div>
                        <div className="relative h-1.5 bg-slate-100 rounded-full mb-6 mx-2">
                            <div 
                                className="absolute h-full bg-gradient-to-r from-blue-400 to-[#004A99] transition-all duration-700 ease-out shadow-[0_0_8px_rgba(0,74,153,0.3)] rounded-full"
                                style={{ width: `${(activeTab / (TABS.length - 1)) * 100}%` }}
                            ></div>
                        </div>
                        <div className="flex justify-between items-center gap-1 px-1">
                            {TABS.map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`relative z-10 transition-all duration-500 flex flex-col items-center gap-2 ${activeTab === tab.id ? 'scale-110' : 'opacity-40 hover:opacity-100 grayscale hover:grayscale-0'}`}
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shadow-sm transition-all duration-500 border ${activeTab === tab.id ? 'bg-[#004A99] text-white border-blue-400/30' : 'bg-white text-slate-400 border-slate-100'}`}>
                                        {tab.id + 1}
                                    </div>
                                    <span className={`text-[8px] font-black uppercase tracking-tighter transition-colors ${activeTab === tab.id ? 'text-[#004A99]' : 'text-slate-400'}`}>{tab.label}</span>
                                    {activeTab === tab.id && (
                                        <div className="absolute -bottom-1 w-1 h-1 bg-blue-600 rounded-full animate-pulse"></div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-6 min-h-[400px]">

                        {/* --- TAB 0: OVERVIEW --- */}
                        {activeTab === 0 && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                                <SectionHeader title="Project Identification" />
                        <div className="space-y-4">
                            {/* 0. PROJECT CATEGORY (New - Dropdown) */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project Category</label>
                                <select
                                    name="projectCategory"
                                    value={formData.projectCategory || ''}
                                    onChange={handleChange}
                                    className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`}
                                >
                                    <option value="">Select Category</option>
                                    {PROJECT_CATEGORIES.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            {/* 1. PROJECT NAME */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-xs font-bold text-slate-500 uppercase">Project Name <span className="text-red-500">*</span></label>
                                    <span className="text-[10px] text-slate-400 font-bold">{formData.projectName?.length || 0}/150</span>
                                </div>
                                <input name="projectName" value={formData.projectName} onChange={handleChange} required readOnly={isDummy} maxLength="150" placeholder="e.g. 2 Storey 4 Classroom - School Name" className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} />
                            </div>

                             {/* Program Type Selection */}
                             <div className="space-y-3 mb-6">
                                 <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Program Type</label>
                                 <div className="grid grid-cols-2 gap-3">
                                     <button
                                         type="button"
                                         onClick={() => setFormData(prev => ({ ...prev, program_type: 'BEFF' }))}
                                         className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${formData.program_type === 'BEFF' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'}`}
                                     >
                                         <span className="text-xl mb-1">🏛️</span>
                                         <span className="text-[10px] font-black uppercase tracking-widest">BEFF (Gov)</span>
                                     </button>
                                     <button
                                         type="button"
                                         onClick={() => setFormData(prev => ({ ...prev, program_type: 'Donated' }))}
                                         className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${formData.program_type === 'Donated' ? 'border-[#004A99] bg-blue-50 text-[#004A99]' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'}`}
                                     >
                                         <span className="text-xl mb-1">🎁</span>
                                         <span className="text-[10px] font-black uppercase tracking-widest">Donated</span>
                                     </button>
                                 </div>

                                 {/* Donated Agency Selection */}
                                 {formData.program_type === 'Donated' && (
                                     <div className="mt-3 space-y-3">
                                         <label className="block text-[10px] font-bold text-blue-600 uppercase tracking-widest ml-1">Donor Agency Type</label>
                                         <select 
                                             name="donorType" 
                                             value={formData.donorType || ''} 
                                             onChange={handleChange}
                                             className="w-full p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                                         >
                                             <option value="">Select Donor Type...</option>
                                             <option value="LGU">Local Government Unit (LGU)</option>
                                             <option value="NGO">Non-Governmental Organization (NGO)</option>
                                             <option value="Private Donor">Private Donor / Individual</option>
                                             <option value="Corporate Foundation">Corporate Foundation</option>
                                             <option value="Other">Other</option>
                                         </select>
                                         <input 
                                             name="donorName" 
                                             placeholder="Full Name of Donor/Agency"
                                             value={formData.donorName || ''} 
                                             onChange={handleChange}
                                             className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 shadow-sm"
                                         />
                                     </div>
                                 )}
                             </div>

                            {/* 1.5 SCOPE OF WORK */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-xs font-bold text-slate-500 uppercase">Scope of Work</label>
                                    <span className={`text-[10px] font-bold ${formData.scopeOfWork?.length >= 100 ? 'text-red-500' : 'text-slate-400'}`}>
                                        {formData.scopeOfWork?.length || 0}/100
                                    </span>
                                </div>
                                <textarea 
                                    name="scopeOfWork" 
                                    rows="2" 
                                    value={formData.scopeOfWork || ''} 
                                    onChange={handleChange} 
                                    maxLength="100"
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" 
                                    placeholder="Brief description of the project scope..."
                                />
                            </div>

                            {/* 1.6 NUMBER OF STOREYS (if applicable) */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                    Number of Storeys <span className="text-slate-400 font-normal text-[10px]">(if applicable)</span>
                                </label>
                                <input
                                    type="number"
                                    name="numberOfStoreys"
                                    value={formData.numberOfStoreys || ''}
                                    onChange={(e) => {
                                        if (e.target.value.length > 2) return;
                                        handleChange(e);
                                    }}
                                    min="1"
                                    placeholder="e.g. 2"
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            {/* 1.7 NUMBER OF CLASSROOMS (if applicable) */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                    Number of Classrooms <span className="text-slate-400 font-normal text-[10px]">(if applicable)</span>
                                </label>
                                <input
                                    type="number"
                                    name="numberOfClassrooms"
                                    value={formData.numberOfClassrooms || ''}
                                    onChange={(e) => {
                                        if (e.target.value.length > 3) return;
                                        handleChange(e);
                                    }}
                                    min="0"
                                    placeholder="e.g. 5"
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            {/* 1.75 NO. OF UNITS (New Field) */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                    No. of units <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    name="numberOfUnits"
                                    value={formData.numberOfUnits || ''}
                                    onChange={(e) => {
                                        if (e.target.value.length > 4) return;
                                        handleChange(e);
                                    }}
                                    min="0"
                                    required
                                    placeholder="e.g. 1"
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            {/* 1.8 NUMBER OF SITES */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                    Number of Sites <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    name="numberOfSites"
                                    value={formData.numberOfSites || ''}
                                    onChange={(e) => {
                                        if (e.target.value.length > 2) return;
                                        handleChange(e);
                                    }}
                                    min="1"
                                    required
                                    placeholder="e.g. 1"
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>

                        <SectionHeader title="School Information" />
                        <div className="space-y-4">
                            {/* 2. SCHOOL ID + VALIDATE BUTTON */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1"> School ID (6 Digits) <span className="text-red-500">*</span> </label>
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            name="schoolId"
                                            value={formData.schoolId}
                                            onChange={handleChange}
                                            required
                                            readOnly={isDummy}
                                            maxLength="6"
                                            placeholder="e.g. 100001"
                                            className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 font-mono ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleValidateSchoolId}
                                        disabled={!formData.schoolId || formData.schoolId.length < 6 || isDummy}
                                        className="px-4 py-2 bg-blue-100 text-blue-700 font-bold text-xs uppercase rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Validate
                                    </button>
                                </div>
                                <div className="text-right text-xs text-slate-400 mt-1">
                                    {formData.schoolId.length}/6 digits
                                </div>
                            </div>



                            {/* 3. SCHOOL NAME (READ ONLY) */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">School Name <span className="text-slate-400 font-normal">(Auto-filled)</span></label>
                                <input
                                    name="schoolName"
                                    value={formData.schoolName}
                                    readOnly
                                    placeholder="Click Validate to populate..."
                                    className="w-full p-3 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-sm focus:outline-none"
                                />
                            </div>

                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                 <div>
                                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Region</label>
                                     <input name="region" value={formData.region} readOnly className="w-full p-3 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-sm focus:outline-none" />
                                 </div>
                                 <div>
                                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Division</label>
                                     <input name="division" value={formData.division} readOnly className="w-full p-3 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-sm focus:outline-none" />
                                 </div>
                             </div>

                        </div>

                        {/* --- IMPLEMENTING AGENCY SECTION (EFD / HRODI Engineer) --- */}
                        {(userRole === 'HRODI Engineer' || userRole === 'HRODI' || userRole === 'EFD' || userRole === 'EFD Engineer' || accountCategory === 'HRODI Engineer' || accountCategory === 'EFD' || accountCategory === 'EFD Engineer') && (
                            <>
                                <SectionHeader title="Implementing Agency" />
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                            Implementing Agency <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <select
                                                name="implementingAgency"
                                                value={formData.implementingAgency || ''}
                                                onChange={(e) => {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        implementingAgency: e.target.value,
                                                        implementingAgencySpecific: ''
                                                    }));
                                                }}
                                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 appearance-none"
                                            >
                                                <option value="">Select Implementing Agency</option>
                                                <option value="mgo">MGO (Municipal Government Office)</option>
                                                <option value="pgo">PGO (Provincial Government Office)</option>
                                                <option value="cgo">CGO (City Government Office)</option>
                                                <option value="deped">DepEd (Department of Education)</option>
                                                <option value="dpwh">DPWH (Dept. of Public Works and Highways)</option>
                                                <option value="cso">CSO (Civil Society Organization)</option>
                                            </select>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                    </div>

                                    {/* Sub-question: shown only for mgo, pgo, cgo, cso */}
                                    {['mgo', 'pgo', 'cgo', 'cso'].includes(formData.implementingAgency) && (
                                        <div className="space-y-4 py-4">
                                            <label className="block text-xs font-bold text-blue-700 uppercase mb-1">
                                                Which {formData.implementingAgency?.toUpperCase()}? <span className="text-red-500">*</span>
                                            </label>
                                                    <input
                                                        type="text"
                                                        name="implementingAgencySpecific"
                                                        value={formData.implementingAgencySpecific || ''}
                                                        onChange={handleChange}
                                                        placeholder={`e.g. Bataan ${formData.implementingAgency?.toUpperCase()}`}
                                                        className="w-full p-3 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                                    />
                                            <p className="text-[10px] text-blue-500 mt-1 font-medium">
                                                Specify the exact {formData.implementingAgency?.toUpperCase()} implementing this project.
                                            </p>
                                        </div>
                                    )}
                                 </div>
                             </>
                         )}
                    </div>
                )}



                        {/* --- TAB 1: LOCATION --- */}
                        {activeTab === 1 && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                                <SectionHeader title="Project Location" />
                                <div className="space-y-4">
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-3 mb-4">
                                            <div className="text-blue-600 text-xl">ℹ️</div>
                                            <p className="text-xs text-blue-800 leading-relaxed">
                                                <strong>COA Requirement:</strong> Drag the pin to the exact project site, or stand on-site and click "Get Current Location".
                                            </p>
                                        </div>

                                        <div className="mb-4 rounded-xl overflow-hidden shadow-sm border border-slate-200">
                                            <LocationPickerMap
                                                latitude={formData.latitude}
                                                longitude={formData.longitude}
                                                onLocationSelect={handleLocationSelect}
                                                disabled={isDummy}
                                            />
                                        </div>

                                        <div className="flex gap-3 mb-3">
                                            <div className="flex-1">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Latitude</label>
                                                <input
                                                    name="latitude"
                                                    value={formData.latitude}
                                                    readOnly
                                                    placeholder="0.000000"
                                                    className="w-full p-2 bg-white text-slate-700 font-mono text-xs border border-blue-200 rounded-lg focus:outline-none"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Longitude</label>
                                                <input
                                                    name="longitude"
                                                    value={formData.longitude}
                                                    readOnly
                                                    placeholder="0.000000"
                                                    className="w-full p-2 bg-white text-slate-700 font-mono text-xs border border-blue-200 rounded-lg focus:outline-none"
                                                />
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleGetCurrentLocation}
                                            className="w-full py-2.5 bg-white border border-blue-200 rounded-xl text-[10px] font-black uppercase tracking-wider text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 shadow-sm"
                                        >
                                            <span>📍</span> Get Current Location
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* --- TAB 2: STATUS & TIMELINES --- */}
                        {activeTab === 2 && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-8">
                                <SectionHeader title="Status and Progress" />
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Planning and Design Status</label>
                                        <select name="statusDesignPhase" value={formData.statusDesignPhase || ''} onChange={handleChange} disabled={isDummy} className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`}>
                                            <option value="">Select Phase Status...</option>
                                            <option value="Not Yet Started">Not Yet Started</option>
                                            <option value="Survey / Assessment">Survey / Assessment</option>
                                            <option value="In-Design / Preparation">In-Design / Preparation</option>
                                            <option value="For Approval">For Approval</option>
                                            <option value="Completed">Completed</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status of Construction Phase</label>
                                        <select name="status" value={formData.status} onChange={handleChange} disabled={isDummy} className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`}>
                                            <option value="Not Yet Started">Not Yet Started</option>
                                            <option value="Under Procurement">Under Procurement</option>
                                            <option value="Ongoing">Ongoing</option>
                                            <option value="For Final Inspection">For Final Inspection</option>
                                            <option value="Completed">Completed</option>
                                        </select>
                                    </div>
                                    {!['Not Yet Started', 'Under Procurement'].includes(formData.status) && (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status-As-Of Date</label>
                                                <input type="date" name="statusAsOfDate" value={formData.statusAsOfDate} onChange={handleChange} readOnly={isDummy} max={new Date().toISOString().split('T')[0]} className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} />
                                            </div>
                                            <div>
                                                <div className="flex justify-between items-center mb-1">
                                                    <label className="block text-xs font-bold text-slate-500 uppercase">Accomplishment Percentage (%)</label>
                                                    {!isDummy && (
                                                        <div className="flex gap-1">
                                                            <button type="button" onClick={() => setFormData(prev => ({ ...prev, accomplishmentPercentage: Math.min(100, Number(prev.accomplishmentPercentage || 0) + 5) }))} className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded hover:bg-green-200 transition">+5%</button>
                                                            <button type="button" onClick={() => setFormData(prev => ({ ...prev, accomplishmentPercentage: Math.min(100, Number(prev.accomplishmentPercentage || 0) + 10) }))} className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded hover:bg-green-200 transition">+10%</button>
                                                        </div>
                                                    )}
                                                </div>
                                                <input type="number" name="accomplishmentPercentage" value={formData.accomplishmentPercentage} onChange={handleChange} readOnly={isDummy} className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <SectionHeader title="Procurement Milestones" />
                                <div className="space-y-6 mb-6">
                                    <h4 className="font-bold text-slate-700 text-xs uppercase mb-3">Key Procurement Dates</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Issuance of Invitation to Bid</label>
                                            <input type="date" name="issuanceOfInvitationToBid" value={formData.issuanceOfInvitationToBid || ''} onChange={handleChange} readOnly={isDummy} className={`w-full p-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Pre-Bid Conference</label>
                                            <input type="date" name="preBidConference" value={formData.preBidConference || ''} onChange={handleChange} readOnly={isDummy} className={`w-full p-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Opening of Technical Proposal</label>
                                            <input type="date" name="openingOfTechnicalProposal" value={formData.openingOfTechnicalProposal || ''} onChange={handleChange} readOnly={isDummy} className={`w-full p-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Opening of Financial Proposal</label>
                                            <input type="date" name="openingOfFinancialProposal" value={formData.openingOfFinancialProposal || ''} onChange={handleChange} readOnly={isDummy} className={`w-full p-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Request for Quotation</label>
                                            <input type="date" name="requestForQuotation" value={formData.requestForQuotation || ''} onChange={handleChange} readOnly={isDummy} className={`w-full p-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Negotiation</label>
                                            <input type="date" name="negotiation" value={formData.negotiation || ''} onChange={handleChange} readOnly={isDummy} className={`w-full p-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Opening of Quotation</label>
                                            <input type="date" name="openingOfQuotation" value={formData.openingOfQuotation || ''} onChange={handleChange} readOnly={isDummy} className={`w-full p-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Notice of Award</label>
                                            <input type="date" name="dateNoticeOfAward" value={formData.dateNoticeOfAward || ''} onChange={handleChange} readOnly={isDummy} className={`w-full p-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} />
                                        </div>
                                    </div>
                                </div>

                                {!['Not Yet Started', 'Under Procurement'].includes(formData.status) && (
                                    <>
                                        <SectionHeader title="Timelines" />
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notice to Proceed Date</label>
                                                <input type="date" name="noticeToProceed" value={formData.noticeToProceed} onChange={handleChange} readOnly={isDummy} className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start of Construction</label>
                                                <input type="date" name="constructionStartDate" value={formData.constructionStartDate || ''} onChange={handleChange} readOnly={isDummy} className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Target Completion Date</label>
                                                <input type="date" name="targetCompletionDate" value={formData.targetCompletionDate} onChange={handleChange} readOnly={isDummy} className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} />
                                            </div>
                                            {formData.status === 'Completed' && (
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Actual Completion Date</label>
                                                    <input type="date" name="actualCompletionDate" value={formData.actualCompletionDate} onChange={handleChange} readOnly={isDummy} className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} />
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}


                        {/* --- TAB 3: FINANCE & CONTRACTOR --- */}
                        {activeTab === 3 && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-8">
                                {userRole === 'Local Government Unit' && (
                                    <div className="space-y-6">
                                        <SectionHeader title="LGU Project Details" icon="🏛️" />
                                        <div className="space-y-4">
                                            {/* Location Details */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Province</label>
                                                    <input name="province" value={formData.province} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">City/Municipality</label>
                                                    <input name="municipality" value={formData.municipality} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                                                </div>
                                                <div className="sm:col-span-2">
                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Legislative District</label>
                                                    <input name="legislative_district" value={formData.legislative_district} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                                                </div>
                                            </div>

                                            {/* Funding & MOA */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fund Source</label>
                                                    <input name="fund_source" value={formData.fund_source} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">MOA Date</label>
                                                    <input type="date" name="moa_date" value={formData.moa_date} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                                                </div>
                                            </div>

                                            {/* Tranches */}
                                            <div className="space-y-4">
                                                <h4 className="font-bold text-blue-800 text-xs uppercase mb-3">Fund Tranches</h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">No. of Tranches</label>
                                                        <input type="number" name="tranches_count" value={formData.tranches_count} onChange={handleChange} className="w-full p-2 bg-white border border-blue-200 rounded-lg text-sm" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Amount per Tranche</label>
                                                        <input name="tranche_amount" value={formData.tranche_amount} onChange={handleChange} className="w-full p-2 bg-white border border-blue-200 rounded-lg text-sm" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Funds Downloaded</label>
                                                        <input name="funds_downloaded" value={formData.funds_downloaded} onChange={handleChange} className="w-full p-2 bg-white border border-blue-200 rounded-lg text-sm" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Funds Utilized</label>
                                                        <input name="funds_utilized" value={formData.funds_utilized} onChange={handleChange} className="w-full p-2 bg-white border border-blue-200 rounded-lg text-sm" />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Scope */}
                                            <div>
                                                <div className="flex justify-between items-center mb-1">
                                                    <label className="block text-xs font-bold text-slate-500 uppercase">Scope of Works</label>
                                                    <span className={`text-[10px] font-bold ${formData.scope_of_works?.length >= 200 ? 'text-red-500' : 'text-slate-400'}`}>
                                                        {formData.scope_of_works?.length || 0}/200
                                                    </span>
                                                </div>
                                                <textarea name="scope_of_works" rows="2" value={formData.scope_of_works} onChange={handleChange} maxLength="200" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                                            </div>
                                        </div>

                                        <SectionHeader title="Procurement Details" icon="⚖️" />
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Procurement Stage</label>
                                                <select name="procurement_stage" value={formData.procurement_stage} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                                                    <option value="">Select Stage...</option>
                                                    <option value="Pre-Procurement">Pre-Procurement</option>
                                                    <option value="Advertisement">Advertisement</option>
                                                    <option value="Pre-Bid Conference">Pre-Bid Conference</option>
                                                    <option value="Opening of Bids">Opening of Bids</option>
                                                    <option value="Bid Evaluation">Bid Evaluation</option>
                                                    <option value="Post Qualification">Post Qualification</option>
                                                    <option value="Awarded">Awarded</option>
                                                </select>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contract Amount</label>
                                                    <input name="contract_amount" value={formData.contract_amount} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Construction Start Date</label>
                                                    <input type="date" name="construction_start_date" value={formData.construction_start_date} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <SectionHeader title="Funds and Contractor" />
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Approved Budget for Contract (ABC) (PHP)</label>
                                            <input type="text" name="approved_budget_for_contract" value={formData.approved_budget_for_contract} onChange={handleChange} readOnly={isDummy} placeholder="e.g. 15,000,000" className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contract Amount (PHP)</label>
                                            <input type="text" name="contract_amount" value={formData.contract_amount} onChange={handleChange} readOnly={isDummy} placeholder="e.g. 14,500,000" className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Funds Utilized</label>
                                            <input type="text" name="fundsUtilized" value={formData.fundsUtilized || ''} onChange={handleChange} readOnly={isDummy} placeholder="e.g. 5,000,000" className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Batch of Funds</label>
                                            <input name="batchOfFunds" value={formData.batchOfFunds} onChange={handleChange} readOnly={isDummy} placeholder="e.g. Batch 1" className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Funding Year</label>
                                            <select 
                                                name="fundingYear" 
                                                value={formData.fundingYear || ''} 
                                                onChange={handleChange} 
                                                className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`}
                                            >
                                                <option value="">Select Year</option>
                                                {Array.from({ length: 26 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                                    <option key={year} value={year}>{year}</option>
                                                ))}
                                                <option value="Before 2000">Before 2000</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contract ID / Reference No.</label>
                                            <input name="contractId" value={formData.contractId || ''} onChange={handleChange} readOnly={isDummy} placeholder="Unique numeric or alphanumeric ID" className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} />
                                            <p className="text-[10px] text-slate-400 mt-1 uppercase font-black tracking-tighter">Enter the project record ID or official Contract number</p>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contractor Name</label>
                                        <input name="contractorName" value={formData.contractorName} onChange={handleChange} readOnly={isDummy} placeholder="e.g. ABC Builders" className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} />
                                    </div>
                                </div>

                                <SectionHeader title="Other Remarks" />
                                <textarea name="otherRemarks" rows="3" value={formData.otherRemarks} onChange={handleChange} readOnly={isDummy} placeholder="Any specific issues or notes..." className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} />
                            </div>
                        )}
                        {/* --- TAB 4: MEDIA & DOCUMENTS --- */}
                        {activeTab === 4 && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-8">
                                <SectionHeader title="Site Photos" />
                                <div className="space-y-6">
                                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-3 mb-2">
                                        <div className="text-amber-500 text-lg">⚠️</div>
                                        <p className="text-[10px] text-amber-800 leading-tight">
                                            <strong>Photo Quality:</strong> Ensure photos are clear and show significant progress or site condition. Wide shots are preferred for COA validation.
                                        </p>
                                    </div>

                                    {/* Photos content moved from Tab 2 */}
                                    {/* EXTERNAL PHOTOS */}
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center mb-1">
                                            <h3 className="font-bold text-slate-700 text-xs uppercase">External Photos</h3>
                                            <span className="text-[10px] font-bold text-blue-500">{externalFiles.length} Added</span>
                                        </div>
                                        <div className="text-[10px] text-slate-400 mb-3 italic space-y-1">
                                            <p>• Front, Left, Right, Rear (wide shots)</p>
                                            <p>• Orthographic at height 20-30m (optional)</p>
                                        </div>

                                        {!isDummy && (
                                            <div className="grid grid-cols-2 gap-3 mb-3">
                                                <button type="button" onClick={() => triggerFilePicker('camera', 'External')} className="flex flex-col items-center justify-center gap-1 p-3 bg-white border border-slate-200 border-dashed rounded-lg hover:border-blue-400">
                                                    <span className="text-lg">📸</span> <span className="text-[10px] font-bold text-slate-600">Camera</span>
                                                </button>
                                                <button type="button" onClick={() => triggerFilePicker('gallery', 'External')} className="flex flex-col items-center justify-center gap-1 p-3 bg-white border border-slate-200 border-dashed rounded-lg hover:border-blue-400">
                                                    <span className="text-lg">🖼️</span> <span className="text-[10px] font-bold text-slate-600">Gallery</span>
                                                </button>
                                            </div>
                                        )}
                                        {externalPreviews.length > 0 && (
                                            <div className="grid grid-cols-4 gap-2">
                                                {externalPreviews.map((url, index) => (
                                                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-white shadow-sm ring-1 ring-slate-200">
                                                        <img src={url} alt="external" className="w-full h-full object-cover" />
                                                        <button type="button" onClick={() => removeFile(index, 'External')} className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center">✕</button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* INTERNAL PHOTOS */}
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center mb-1">
                                            <h3 className="font-bold text-slate-700 text-xs uppercase">Internal Photos</h3>
                                            <span className="text-[10px] font-bold text-blue-500">{internalFiles.length} Added</span>
                                        </div>
                                        <div className="text-[10px] text-slate-400 mb-3 italic space-y-1">
                                            <p>• Classrooms (2-3): Wide shot from doorway/corner, Camera at 1.4-1.6m height, Facing longest wall.</p>
                                            <p>• Key indicators: Ceiling, Lighting, Outlets, Painted walls, Floor condition.</p>
                                        </div>

                                        {!isDummy && (
                                            <div className="grid grid-cols-2 gap-3 mb-3">
                                                <button type="button" onClick={() => triggerFilePicker('camera', 'Internal')} className="flex flex-col items-center justify-center gap-1 p-3 bg-white border border-slate-200 border-dashed rounded-lg hover:border-blue-400">
                                                    <span className="text-lg">📸</span> <span className="text-[10px] font-bold text-slate-600">Camera</span>
                                                </button>
                                                <button type="button" onClick={() => triggerFilePicker('gallery', 'Internal')} className="flex flex-col items-center justify-center gap-1 p-3 bg-white border border-slate-200 border-dashed rounded-lg hover:border-blue-400">
                                                    <span className="text-lg">🖼️</span> <span className="text-[10px] font-bold text-slate-600">Gallery</span>
                                                </button>
                                            </div>
                                        )}
                                        {internalPreviews.length > 0 && (
                                            <div className="grid grid-cols-4 gap-2">
                                                {internalPreviews.map((url, index) => (
                                                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-white shadow-sm ring-1 ring-slate-200">
                                                        <img src={url} alt="internal" className="w-full h-full object-cover" />
                                                        <button type="button" onClick={() => removeFile(index, 'Internal')} className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center">✕</button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <SectionHeader title="Project Documents" />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {Object.entries(DOC_TYPES)
                                        .map(([key, label]) => (
                                            <div key={key} className={`py-4 border-b border-slate-100 transition-all`}>
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <p className={`text-xs font-black uppercase tracking-widest ${documents[key] ? 'text-emerald-700' : 'text-slate-500'}`}>
                                                        {label}
                                                    </p>
                                                    {documents[key] ? (
                                                        <p className="text-[10px] text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                            {documents[key].name}
                                                        </p>
                                                    ) : (
                                                        <p className="text-[10px] text-red-400 font-bold mt-0.5">{/* Optional */}</p>
                                                    )}
                                                </div>
                                                <div>
                                                    {documents[key] ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeDocument(key)}
                                                            className="w-8 h-8 rounded-full bg-white text-red-500 shadow-sm border border-red-100 flex items-center justify-center hover:bg-red-50"
                                                        >
                                                            ✕
                                                        </button>
                                                    ) : (
                                                        <label className="cursor-pointer px-4 py-2 bg-white border border-slate-200 shadow-sm rounded-lg text-[10px] font-bold text-slate-600 uppercase tracking-wider hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all active:scale-95">
                                                            Select PDF
                                                            <input
                                                                type="file"
                                                                accept=".pdf"
                                                                className="hidden"
                                                                onChange={(e) => handleDocumentSelect(e, key)}
                                                            />
                                                        </label>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}





                    </div>

                    <div className="pt-4 flex gap-3 sticky bottom-0 bg-white pb-2 border-t border-slate-50">
                        <button type="button" onClick={() => navigate(-1)} className="flex-1 py-3 text-slate-600 font-bold text-sm bg-slate-100 rounded-xl hover:bg-slate-200 transition">
                            {isDummy ? 'Back' : 'Cancel'}
                        </button>
                        {!isDummy && (
                                activeTab < 4 ? (
                                    <button
                                        key="btn-next"
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setActiveTab(prev => Math.min(prev + 1, 4));
                                        }}
                                        className="flex-1 py-3 text-white font-bold text-sm bg-blue-600 rounded-xl shadow-lg shadow-blue-900/20 hover:bg-blue-800 transition"
                                    >
                                        NEXT
                                    </button>
                                ) : (
                                    <button
                                        key="btn-submit"
                                        type="submit"
                                        disabled={true}
                                        className="flex-1 py-3 text-white font-bold text-sm bg-slate-400 rounded-xl cursor-not-allowed transition"
                                    >
                                        DISABLED FOR MAINTENANCE
                                    </button>
                                )
                        )}
                    </div>
                </form>

                {/* --- IMPORT MODAL --- */}
                {isImportModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-slate-900/40">
                        <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 fade-in duration-300">
                            <div className="p-6 bg-blue-600 text-white flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg font-bold">Import Project Data</h3>
                                    <p className="text-xs text-blue-100 opacity-80">Search existing records to auto-fill</p>
                                </div>
                                <button onClick={() => setIsImportModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all text-xl">✕</button>
                            </div>
                            
                            <div className="p-4 border-b border-slate-100 pb-6">
                                <div className="relative">
                                    <input 
                                        type="text"
                                        value={importSearch}
                                        onChange={(e) => {
                                            setImportSearch(e.target.value);
                                            searchProjectsToImport(e.target.value);
                                        }}
                                        placeholder="Search by ID or Name..."
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:border-blue-500 shadow-inner"
                                    />
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">🔍</span>
                                </div>
                                {isSearchingProjects && (
                                    <div className="mt-2 flex items-center gap-2 text-[10px] text-blue-600 font-bold px-2">
                                        <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                        Searching Database...
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
                                {availableProjects.length > 0 ? (
                                    availableProjects.map(proj => (
                                        <button 
                                            key={proj.id}
                                            type="button"
                                            onClick={() => handleImportProject(proj)}
                                            className="w-full text-left p-4 bg-white border border-slate-200 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all group active:scale-[0.98]"
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <h4 className="font-bold text-slate-800 text-sm group-hover:text-blue-600 transition-colors uppercase truncate flex-1 pr-2">{proj.projectName}</h4>
                                                <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-bold shadow-sm">{proj.ipc}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                                <span>🏫 {proj.schoolName}</span>
                                                <span>•</span>
                                                <span>🆔 {proj.schoolId}</span>
                                            </div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
                                        <div className="text-4xl">🔎</div>
                                        <p className="text-xs text-center px-8">{importSearch.length < 3 ? 'Type at least 3 characters to search infrastructure records...' : 'No matching projects found.'}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div className="hidden">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        multiple
                        accept="image/*"
                        className="hidden"
                    />
                </div>

            </div>
        </PageTransition>
    );
};

export default NewProjects;