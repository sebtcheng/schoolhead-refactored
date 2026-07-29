import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiX, FiCheckCircle, FiCheck, FiEdit2, FiArrowLeft, FiUnlock, FiInfo, FiMaximize2, FiSave, FiWifiOff, FiList, FiAlertTriangle, FiRefreshCw, FiCopy } from "react-icons/fi";
import { saveUnitDraft, getUnitDraft, clearUnitDraft, addModularToOutbox, deleteModularFromOutbox, saveSchoolToCache, getCachedSchool, getModularOutbox, migrateUnitDrafts } from "../../db";
import { useAuth } from "../../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import UnitRemarkAlert from "./UnitRemarkAlert";
import DocumentUpload from "./DocumentUpload";
import SuccessModal from "../SuccessModal";
import LocationPickerMap from "../LocationPickerMap";
import useReadOnly from "../../hooks/useReadOnly";
import { normalizeOffering } from "../../utils/dataNormalization";
import { resolveDocUrl } from "../../utils/assetHelper";
import { api } from "../../lib/api";
import { useHistoricalData } from "../../hooks/useHistoricalData";
import { HistoricalDataModal } from "./HistoricalDataModal";

const TOTAL_STEPS = 7;

const chunkyInput = "w-full p-4 mt-2 bg-white border-2 border-[#BAE6FD] rounded-3xl text-lg font-semibold text-gray-800 focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-[#E0F2FE] transition-all shadow-sm placeholder:text-gray-300 font-body";
const chunkySelect = "w-full p-4 mt-2 bg-white border-2 border-[#BAE6FD] rounded-3xl text-lg font-semibold text-gray-800 focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-[#E0F2FE] transition-all shadow-sm appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20d%3D%22M5%207L10%2012L15%207%22%20stroke%3D%22%23075985%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22/%3E%3C/svg%3E')] bg-[length:24px] bg-[right_1rem_center] bg-no-repeat disabled:opacity-50 disabled:bg-gray-50 font-body";

// ── Skeleton Loaders ─────────────────────────────────────────────────────────
const Pulse = ({ className }) => <div className={`animate-pulse bg-slate-200 rounded-3xl ${className}`} />;

const SkeletonWizard = () => (
    <div className="min-h-screen bg-white flex flex-col font-sans">
        <header className="px-6 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-gray-100" />
            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full w-1/5 bg-gray-200 animate-pulse" />
            </div>
        </header>
        <main className="flex-1 p-6 space-y-8">
            <div className="space-y-3">
                <Pulse className="h-10 w-3/4" />
                <Pulse className="h-6 w-1/2" />
            </div>
            <div className="space-y-4 pt-4">
                <Pulse className="h-20 w-full" />
                <Pulse className="h-20 w-full" />
            </div>
        </main>
        <footer className="p-6">
            <Pulse className="h-16 w-full" />
        </footer>
    </div>
);

// ── Main Component ───────────────────────────────────────────────────────────
const Unit1SchoolIdentity = ({ targetSchoolId, isReadOnly: propReadOnly }) => {
    const formatDateAbbr = (dateStr) => {
        if (!dateStr) return "—";
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
    };

    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showWelcomeBack, setShowWelcomeBack] = useState(false);
    const [showOfflineSuccess, setShowOfflineSuccess] = useState(false);
    const [showIernModal, setShowIernModal] = useState(false);
    const [fetchedIern, setFetchedIern] = useState(null);
    const [isReviewMode, setIsReviewMode] = useState(false);
    const [isModeLoading, setIsModeLoading] = useState(true);
    const [docStatus, setDocStatus] = useState("idle"); // idle, compressing, uploading, secured, error
    const [pendingOutboxId, setPendingOutboxId] = useState(null); // Track if data is in outbox
    const { isReadOnly: hookIsReadOnly, isSuperUser: hookIsSuperUser } = useReadOnly();
    const isReadOnly = propReadOnly ?? hookIsReadOnly;

    const [formData, setFormData] = useState({
        school_id: "",
        school_name: "",
        region: "",
        province: "",
        municipality: "",
        barangay: "",
        division: "",
        district: "",
        leg_district: "",
        curricular_offering: "",
        latitude: "",
        longitude: "",
        iern: "",
        school_head: "",
        contact_number: "",
        ownership: "",
        ownership_multiple: [],
        google_drive_link: "",
        google_drive_file_id: "",
        google_drive_file_name: "",
        google_drive_thumbnail_url: "",
        local_file_path: "",
        local_file_name: "",
        school_type: "",
        mother_school_id: "",
        extension_mother_school_name: "",
        annex_details: [],
        ownership_document_type: "",
        established_month: "",
        established_year: "",
        head_first_name: "",
        head_middle_name: "",
        head_last_name: "",
        head_sex: "",
        head_position_title: "",
        head_date_hired: "",
        head_hired_month: "",
        head_hired_day: "",
        head_hired_year: "",
        ownership_doc_id: null,
        local_file_size: null,
        ownership_na_reason: "",
        ownership_document_multiple: [],
        ownership_document_path: "",
    });

    const [originalSchoolLocation, setOriginalSchoolLocation] = useState(null);

    // ── SY 25-26 View & Copy States ──────────────────────────────────────────
    const {
        showHistoryModal,
        setShowHistoryModal,
        historicalData,
        historicalLoading,
        handleOpenHistoryModal,
        handleCopyHistoricalData,
    } = useHistoricalData("unit1", user, targetSchoolId || user?.school_id || localStorage.getItem("schoolId"));

    const copyUnit1 = (d) => {
        setFormData(prev => ({
            ...prev,
            school_name: d.school_name || prev.school_name,
            region: d.region || prev.region,
            province: d.province || prev.province,
            municipality: d.municipality || prev.municipality,
            barangay: d.barangay || prev.barangay,
            division: d.division || prev.division,
            district: d.district || prev.district,
            leg_district: d.leg_district || prev.leg_district,
            curricular_offering: d.curricular_offering || prev.curricular_offering,
            latitude: d.latitude || prev.latitude,
            longitude: d.longitude || prev.longitude,
            iern: d.iern || prev.iern,
            school_head: d.school_head || prev.school_head,
            contact_number: d.contact_number || prev.contact_number,
            ownership: d.ownership || prev.ownership,
            ownership_multiple: d.ownership_multiple || prev.ownership_multiple,
            google_drive_link: d.google_drive_link || prev.google_drive_link,
            google_drive_file_id: d.google_drive_file_id || prev.google_drive_file_id,
            google_drive_file_name: d.google_drive_file_name || prev.google_drive_file_name,
            google_drive_thumbnail_url: d.google_drive_thumbnail_url || prev.google_drive_thumbnail_url,
            established_month: d.established_month || prev.established_month,
            established_year: d.established_year || prev.established_year,
            school_type: d.school_type || prev.school_type,
            mother_school_id: d.mother_school_id || prev.mother_school_id,
            ownership_na_reason: d.ownership_na_reason || prev.ownership_na_reason,
            annex_details: d.annex_details || prev.annex_details,
            extension_mother_school_name: d.extension_mother_school_name || prev.extension_mother_school_name,
            ownership_document_type: d.ownership_document_type || prev.ownership_document_type,
            ownership_document_multiple: d.ownership_document_multiple || prev.ownership_document_multiple,
            head_first_name: d.head_first_name || prev.head_first_name,
            head_middle_name: d.head_middle_name || prev.head_middle_name,
            head_last_name: d.head_last_name || prev.head_last_name,
            head_sex: d.head_sex || prev.head_sex,
            head_position_title: d.head_position_title || prev.head_position_title,
            head_date_hired: d.head_date_hired || prev.head_date_hired,
            local_file_path: d.local_file_path || prev.local_file_path,
            local_file_name: d.local_file_name || prev.local_file_name,
            local_file_size: d.local_file_size || prev.local_file_size,
            ownership_doc_id: d.ownership_doc_id || prev.ownership_doc_id,
            ownership_document_path: d.ownership_document_path || prev.ownership_document_path,
        }));
    };

    // ── School ID Unlock Safeguard ───────────────────────────────────────────
    const [isSchoolIdLocked, setIsSchoolIdLocked] = useState(true);
    const [showUnlockDialog, setShowUnlockDialog] = useState(false);
    const [unlockInput, setUnlockInput] = useState("");

    const [regionOptions, setRegionOptions] = useState([]);
    const [provinceOptions, setProvinceOptions] = useState([]);
    const [cityOptions, setCityOptions] = useState([]);
    const [barangayOptions, setBarangayOptions] = useState([]);
    const [divisionOptions, setDivisionOptions] = useState([]);
    const [districtOptions, setDistrictOptions] = useState([]);
    const [legDistrictOptions, setLegDistrictOptions] = useState([]);
    const [driveLinkValidating, setDriveLinkValidating] = useState(false);
    const [driveLinkError, setDriveLinkError] = useState("");
    const [fetchingMotherSchool, setFetchingMotherSchool] = useState(false);
    const [motherSchoolNotFound, setMotherSchoolNotFound] = useState(false);
    const [showGDriveGuide, setShowGDriveGuide] = useState(false);
    const [showDraftModal, setShowDraftModal] = useState(false);
    const [showFullscreenPdf, setShowFullscreenPdf] = useState(false);
    const [schoolNameWarning, setSchoolNameWarning] = useState("");
    const [isCertified, setIsCertified] = useState(false);

    // ── IDENTITY SHIFT STATE ────────────────────────────────────────────────
    const [initialSchoolId] = useState(targetSchoolId || user?.school_id || localStorage.getItem("schoolId"));
    const [idValidation, setIdValidation] = useState({ 
        isValidating: false, 
        valid: false, 
        reason: "", 
        occupied: false,
        schoolName: ""
    });
    const [showShiftModal, setShowShiftModal] = useState(false);
    const [isShifting, setIsShifting] = useState(false);

    // ── PARALLEL data-fetch on mount ────────────────────────────────────────
    useEffect(() => {
        if (authLoading) return; // Wait for AuthContext to resolve the actual user session

        const init = async () => {
            const storedId = targetSchoolId || user?.school_id || localStorage.getItem("schoolId");
            console.log("🔄 [Unit1] Starting Initialization for:", storedId);
            
            try {
                let pendingEntry = null;
                try {
                    const outbox = await getModularOutbox();
                    pendingEntry = outbox.find(entry => entry.unitId === 1 && (entry.schoolId === storedId || entry.payload?.school_id === storedId));
                } catch (err) {
                    console.error("Outbox fetch failed:", err);
                }

                if (!storedId) {
                    const draft = await getUnitDraft(1, "anonymous").catch(() => null);
                    if (draft && draft.formData) {
                        setFormData(prev => ({ ...prev, ...draft.formData }));
                        setCurrentStep(Math.min(draft.step, TOTAL_STEPS - 1));
                    }
                    return;
                }

                // Normal load path
                const [savedRes, iernRes, draft] = await Promise.all([
                    fetch(api(`/ph_schools/${storedId}`))
                      .then(async r => {
                        console.log('[ph_schools] load', r.status, r.headers.get('content-type'));
                        if (!r.ok) console.error('[ph_schools] load body:', await r.clone().text());
                        return r;
                      })
                      .catch(err => { console.error('[ph_schools] load network:', err); return null; }),
                    fetch(api(`/schools_iern/${storedId}`))
                      .then(async r => {
                        console.log('[schools_iern] load', r.status, r.headers.get('content-type'));
                        if (!r.ok) console.error('[schools_iern] load body:', await r.clone().text());
                        return r;
                      })
                      .catch(err => { console.error('[schools_iern] load network:', err); return null; }),
                    getUnitDraft(1, storedId).catch(() => null)
                ]);

            let d = null;
            let iernRow = null;

            if (savedRes?.ok) {
                const txt = await savedRes.text();
                if (txt) {
                    try {
                        const parsed = JSON.parse(txt);
                        if (parsed.exists && parsed.data) d = parsed.data;
                    } catch(e) {}
                }
            }
            if (iernRes?.ok) {
                const j = await iernRes.json();
                if (j.exists && j.data) {
                    iernRow = j.data;
                    // Cache for offline use
                    saveSchoolToCache({ ...iernRow, school_id: storedId });
                }
            } else if (!navigator.onLine || !iernRes) {
                // Offline fallback: Pull from local cache
                const cached = await getCachedSchool(storedId);
                if (cached) {
                    console.log("💾 [Unit1] Offline Fallback: Loading IERN from Cache.");
                    iernRow = cached;
                }
            }

            // Start with base data from empty state
            let merged = { ...formData, school_id: String(storedId) };

            const takeValue = (preferred, fallback, original) => {
                if (preferred !== undefined && preferred !== null && String(preferred).trim() !== "" && String(preferred).trim().toLowerCase() !== "null") return String(preferred).trim();
                const fb = (fallback !== undefined && fallback !== null && String(fallback).trim() !== "" && String(fallback).trim().toLowerCase() !== "null") ? String(fallback).trim() : (original || "");
                return fb;
            };

            // 1. Registry Fallback (Lowest Priority)
            if (iernRow) {
                merged.school_name = takeValue(iernRow.School_Name, iernRow.school_name, merged.school_name);
                merged.region = takeValue(iernRow.Region, iernRow.region, merged.region);
                merged.province = takeValue(iernRow.Province, iernRow.province, merged.province);
                merged.municipality = takeValue(iernRow.Municipality, iernRow.municipality, iernRow.City || iernRow.city || merged.municipality);
                merged.barangay = takeValue(iernRow.Barangay, iernRow.barangay, merged.barangay);
                merged.division = takeValue(iernRow.Division, iernRow.division, iernRow.Schools_Division_Office || iernRow.SDO || merged.division);
                merged.district = takeValue(iernRow.District, iernRow.district, iernRow.Schools_District || merged.district);
                merged.leg_district = takeValue(iernRow.Legislative_District, iernRow.Leg_District, iernRow.leg_district || merged.leg_district);
                merged.latitude = merged.latitude || iernRow.Latitude || iernRow.latitude;
                merged.longitude = merged.longitude || iernRow.Longitude || iernRow.longitude;
                merged.iern = iernRow.iern || iernRow.IERN || merged.iern;
            }

            // 2. ph_schools OVERRIDES Registry (Authoritative Master)
            if (d) {
                const overrideFromPhSchools = (key, dKey = key) => {
                    const v = d[dKey];
                    if (v !== undefined && v !== null && String(v).trim() !== "" && String(v).trim().toLowerCase() !== "null") {
                        merged[key] = String(v).trim();
                    }
                };

                ["school_name", "region", "province", "municipality", "barangay", 
                 "division", "district", "leg_district", "curricular_offering", 
                 "school_head", "contact_number", "ownership", "school_type",
                 "mother_school_id", "extension_mother_school_name", "ownership_document_type",
                 "local_file_path", "local_file_name", "head_position_title",
                 "head_first_name", "head_middle_name", "head_last_name", "head_sex",
                 "established_month", "established_year", "ownership_na_reason"].forEach(k => overrideFromPhSchools(k));

                if (d.curricular_offering) merged.curricular_offering = normalizeOffering(d.curricular_offering);

                // Coordinates take priority
                if (d.latitude) merged.latitude = d.latitude;
                if (d.longitude) merged.longitude = d.longitude;
                merged.iern = d.iern || merged.iern;
                merged.ownership_doc_id = d.ownership_doc_id || merged.ownership_doc_id;

                // Complex fields
                if (d.ownership_multiple) {
                    try {
                        merged.ownership_multiple = Array.isArray(d.ownership_multiple) ? d.ownership_multiple : JSON.parse(d.ownership_multiple);
                    } catch { merged.ownership_multiple = []; }
                }
                if (d.ownership_document_multiple) {
                    try {
                        merged.ownership_document_multiple = Array.isArray(d.ownership_document_multiple) ? d.ownership_document_multiple : JSON.parse(d.ownership_document_multiple);
                    } catch { merged.ownership_document_multiple = []; }
                }
                if (d.annex_details) {
                    try {
                        merged.annex_details = Array.isArray(d.annex_details) ? d.annex_details : JSON.parse(d.annex_details);
                    } catch { merged.annex_details = []; }
                }

                if (d.head_date_hired) {
                    const hiredVal = d.head_date_hired.split('T')[0];
                    const hiredParts = hiredVal.split('-');
                    merged.head_date_hired = hiredVal;
                    merged.head_hired_year = hiredParts[0] || "";
                    merged.head_hired_month = hiredParts[1] ? new Date(hiredVal).toLocaleString('default', { month: 'short' }).replace('.', '') : "";
                    merged.head_hired_day = hiredParts[2] ? parseInt(hiredParts[2]).toString() : "";
                }
            }

            // Also handle initial parsing from iernRow if d doesn't exist
            if (!d && iernRow) {
                // iernRow might not have these files, but let's be safe
            }

            // 3. Source of Truth Invariant
            // Registry fields from ph_schools always win. Neither drafts nor outbox payloads
            // are allowed to override them once they exist in the master registry.
            const AUTHORITATIVE_KEYS = [
                "school_name", "region", "province", "municipality", "barangay",
                "division", "district", "leg_district", "curricular_offering",
                "iern", "latitude", "longitude", "school_type"
            ];
            const phSchoolsAuth = {};
            const dbCompleted = (d && (d.unit1 === 1 || d.unit1_completed === true));
            
            if (d) {
                AUTHORITATIVE_KEYS.forEach(k => {
                    const v = d[k];
                    if (v !== undefined && v !== null) {
                        const s = String(v).trim();
                        if (s !== "" && s.toLowerCase() !== "null") phSchoolsAuth[k] = s;
                    }
                });
            }

            // Draft overlay — strip authoritative keys before merging
            if (draft && draft.formData) {
                const draftSafe = { ...draft.formData };
                Object.keys(phSchoolsAuth).forEach(k => delete draftSafe[k]);
                merged = { ...merged, ...draftSafe };
                merged.school_id = String(storedId); // Re-force ID integrity
            }

            // Outbox overlay — same protection
            if (pendingEntry) {
                console.log("📍 [Unit1] Overlaying pending submission from Sync Center.");
                const payloadSafe = { ...pendingEntry.payload };
                Object.keys(phSchoolsAuth).forEach(k => delete payloadSafe[k]);
                merged = { ...merged, ...payloadSafe };
                setPendingOutboxId(pendingEntry.id);
            }

            // Final stamp — ph_schools authoritative fields always win
            Object.assign(merged, phSchoolsAuth);

            // If the draft was carrying a divergent authoritative value, it's now stale — purge it
            if (draft && draft.formData) {
                const divergent = AUTHORITATIVE_KEYS.some(k =>
                    phSchoolsAuth[k] !== undefined &&
                    draft.formData[k] !== undefined &&
                    String(draft.formData[k]).trim() !== phSchoolsAuth[k]
                );
                if (divergent) {
                    console.warn("[Unit1] Stale draft detected — purging.");
                    clearUnitDraft(1, storedId).catch(() => {});
                }
            }

            // ── Auto-Fill Logic for School Head ──────────────────────────────────
            // Populate from user session if fields are currently empty
            const sessionFirstName = user?.first_name || user?.firstName;
            const sessionLastName = user?.last_name || user?.lastName;

            if (!merged.head_first_name && sessionFirstName) {
                console.log("Auto-filling School Head First Name:", sessionFirstName);
                merged.head_first_name = sessionFirstName;
            }
            if (!merged.head_last_name && sessionLastName) {
                console.log("Auto-filling School Head Last Name:", sessionLastName);
                merged.head_last_name = sessionLastName;
            }

            if (merged.annex_details && typeof merged.annex_details === 'string') {
                try {
                    merged.annex_details = JSON.parse(merged.annex_details);
                } catch {
                    merged.annex_details = [];
                }
            }
            if (!Array.isArray(merged.annex_details)) {
                merged.annex_details = [];
            }

            setFormData(merged);

            if (iernRow && !d) {
                setFetchedIern(iernRow.iern || "");
                if (iernRow.iern) setShowIernModal(true);
            }

            // Determine if we should show review mode
            if (dbCompleted || propReadOnly) {
                setIsReviewMode(true);
            } else if (draft) {
                // If not completed, then we can restore the draft
                setCurrentStep(Math.min(draft.step, TOTAL_STEPS - 1));
                setShowWelcomeBack(true);
                setTimeout(() => setShowWelcomeBack(false), 3000);
            }

            // Initially lock if school_id exists
            if (merged.school_id) {
                setIsSchoolIdLocked(true);
            } else {
                setIsSchoolIdLocked(false);
            }

            if (merged.latitude && merged.longitude) {
                setOriginalSchoolLocation({
                    latitude: merged.latitude,
                    longitude: merged.longitude
                });
            }

            if (merged.local_file_path && merged.ownership_doc_id) {
                setDocStatus("secured");
            } else {
                setDocStatus("idle");
            }
            setIsModeLoading(false);
        } catch (err) {
            console.error("[Unit 1 Init Error]:", err);
            setIsModeLoading(false);
        }
    };
    init();
    }, [targetSchoolId, user?.school_id, authLoading]);

    // ── Logic sync ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (!formData.region) { setProvinceOptions([]); return; }
        fetch(api(`/locations/provinces?region=${encodeURIComponent(formData.region)}`))
            .then(r => r.json())
            .then(data => {
                let options = Array.isArray(data) ? data : [];
                // Filter out any existing variations of BLANK PROVINCE
                options = options.filter(opt => opt.toUpperCase() !== 'BLANK PROVINCE');
                if (formData.region === 'BLANK REGION') options.unshift('BLANK PROVINCE');
                
                // Ensure current value is in list and standardized
                if (formData.province && !options.some(opt => opt.toUpperCase() === formData.province.toUpperCase())) {
                    options.push(formData.province.toUpperCase());
                }
                setProvinceOptions(options.filter(Boolean));
            })
            .catch(() => {
                // If offline and we have a value, show it
                if (formData.province) setProvinceOptions([formData.province]);
            });
    }, [formData.region, formData.province]);

    useEffect(() => {
        if (!formData.region || !formData.province) { setCityOptions([]); return; }
        fetch(api(`/locations/municipalities-by-province?region=${encodeURIComponent(formData.region)}&province=${encodeURIComponent(formData.province)}`))
            .then(r => r.json())
            .then(data => {
                let options = Array.isArray(data) ? data : [];
                options = options.filter(opt => opt.toUpperCase() !== 'BLANK MUNICIPALITY');
                if (formData.province === 'BLANK PROVINCE') options.unshift('BLANK MUNICIPALITY');
                
                if (formData.municipality && !options.some(opt => opt.toUpperCase() === formData.municipality.toUpperCase())) {
                    options.push(formData.municipality.toUpperCase());
                }
                setCityOptions(options.filter(Boolean));
            })
            .catch(() => {
                if (formData.municipality) setCityOptions([formData.municipality]);
            });
    }, [formData.region, formData.province, formData.municipality]);

    useEffect(() => {
        if (!formData.region || !formData.province || !formData.municipality) { setBarangayOptions([]); return; }
        fetch(api(`/locations/barangays?region=${encodeURIComponent(formData.region)}&province=${encodeURIComponent(formData.province)}&municipality=${encodeURIComponent(formData.municipality)}`))
            .then(r => r.json())
            .then(data => {
                let options = Array.isArray(data) ? data.map(item => (typeof item === 'object' && item !== null) ? item.barangay : item) : [];
                options = options.filter(opt => opt.toUpperCase() !== 'BLANK BARANGAY');
                if (formData.municipality === 'BLANK MUNICIPALITY') options.unshift('BLANK BARANGAY');
                
                if (formData.barangay && !options.some(opt => opt.toUpperCase() === formData.barangay.toUpperCase())) {
                    options.push(formData.barangay.toUpperCase());
                }
                setBarangayOptions(options.filter(Boolean));
            })
            .catch(() => {
                if (formData.barangay) setBarangayOptions([formData.barangay]);
            });
    }, [formData.region, formData.province, formData.municipality, formData.barangay]);

    useEffect(() => {
        if (!formData.region) { 
            setDivisionOptions([]); 
            setLegDistrictOptions([]); 
            return; 
        }

        // 1. Fetch Divisions dynamically
        fetch(api(`/locations/divisions?region=${encodeURIComponent(formData.region)}`))
            .then(r => r.json())
            .then(divs => {
                let dOptions = Array.isArray(divs) ? divs : [];
                if (formData.region === 'BLANK REGION') {
                    dOptions = dOptions.filter(opt => opt.toUpperCase() !== 'BLANK DIVISION');
                    dOptions.unshift('BLANK DIVISION');
                }
                if (formData.division && !dOptions.some(opt => opt.toUpperCase() === formData.division.toUpperCase())) {
                    dOptions.push(formData.division.toUpperCase());
                }
                setDivisionOptions(dOptions.filter(Boolean));
            })
            .catch(() => setDivisionOptions([]));

        // 2. Fetch Legislative Districts dynamically
        fetch(api(`/locations/legislative-districts?region=${encodeURIComponent(formData.region)}&province=${encodeURIComponent(formData.province)}`))
            .then(r => r.json())
            .then(legs => {
                let lOptions = Array.isArray(legs) ? legs : [];
                
                // 1. Unshift "BLANK" if parent is blank
                if (formData.region === 'BLANK REGION') {
                    lOptions.unshift('BLANK LEGISLATIVE DISTRICT');
                }

                // 2. Ensure current value is in list but filter out "BLANK" if region is not blank
                if (formData.leg_district) {
                    const val = formData.leg_district.toUpperCase();
                    const isBlank = val === 'BLANK LEGISLATIVE DISTRICT';
                    const regionIsBlank = formData.region === 'BLANK REGION';
                    
                    if (!isBlank || regionIsBlank) {
                        if (!lOptions.includes(val)) lOptions.push(val);
                    }
                }
                setLegDistrictOptions(lOptions);
            })
            .catch(() => {
                // Fallback to hardcoded if API fails during transition or offline
                const HARD_CODED_LEGS = [
                    '1ST DISTRICT', '2ND DISTRICT', '3RD DISTRICT', '4TH DISTRICT',
                    '5TH DISTRICT', '6TH DISTRICT', '7TH DISTRICT', '8TH DISTRICT'
                ];
                setLegDistrictOptions(HARD_CODED_LEGS);
            });
    }, [formData.region, formData.province, formData.division, formData.leg_district]);

    useEffect(() => {
        if (!formData.region || !formData.division) { setDistrictOptions([]); return; }
        fetch(api(`/locations/districts?region=${encodeURIComponent(formData.region)}&division=${encodeURIComponent(formData.division)}`))
            .then(r => r.json())
            .then(data => {
                let options = Array.isArray(data) ? data : [];
                options = options.filter(opt => opt.toUpperCase() !== 'BLANK DISTRICT');
                if (formData.division === 'BLANK DIVISION') options.unshift('BLANK DISTRICT');
                
                if (formData.district && !options.some(opt => opt.toUpperCase() === formData.district.toUpperCase())) {
                    options.push(formData.district.toUpperCase());
                }
                setDistrictOptions(options.filter(Boolean));
            })
            .catch(() => {
                if (formData.district) setDistrictOptions([formData.district]);
            });
    }, [formData.region, formData.division, formData.district]);

    useEffect(() => {
        fetch(api(`/locations/regions`))
            .then(r => r.json())
            .then(data => {
                let options = Array.isArray(data) ? data : [];
                options = options.filter(opt => opt.toUpperCase() !== 'BLANK REGION');
                options.unshift('BLANK REGION');
                
                if (formData.region && !options.some(opt => opt.toUpperCase() === formData.region.toUpperCase())) {
                    options.push(formData.region.toUpperCase());
                }
                setRegionOptions(options.filter(Boolean));
            })
            .catch(() => {
                if (formData.region) setRegionOptions([formData.region]);
            });
    }, [formData.region]);

    // ── Date Sync Logic ──────────────────────────────────────────────────────


    useEffect(() => {
        if (formData.head_hired_month && formData.head_hired_day && formData.head_hired_year) {
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const m = (months.indexOf(formData.head_hired_month) + 1).toString().padStart(2, '0');
            const d = formData.head_hired_day.padStart(2, '0');
            const y = formData.head_hired_year;
            const res = `${y}-${m}-${d}`;
            if (res !== formData.head_date_hired) setFormData(prev => ({ ...prev, head_date_hired: res }));
        }
    }, [formData.head_hired_month, formData.head_hired_day, formData.head_hired_year]);

    useEffect(() => {
        if (!formData.school_name) {
            setSchoolNameWarning("");
            return;
        }
        
        const abbrList = ["ES", "NHS", "PS", "CS", "CES", "HS", "IS", "SHS", "ELEM", "MNHS"];
        const regex = new RegExp(`\\b(${abbrList.join('|')})\\b`, 'i');
        const match = formData.school_name.match(regex);
        
        if (match) {
            const detected = match[1].toUpperCase();
            setSchoolNameWarning(`It looks like you are using an abbreviation (e.g., ${detected}). Please spell out the full name (e.g., National High School) for official record accuracy.`);
        } else {
            setSchoolNameWarning("");
        }
    }, [formData.school_name]);

    useEffect(() => {
        if (formData.school_id && String(formData.school_id).length === 6 && /^\d+$/.test(String(formData.school_id))) {
            const pullIern = async () => {
                const sid = String(formData.school_id);
                
                // If it's the SAME as initial, just do the standard IERN pull
                if (sid === initialSchoolId) {
                    setIdValidation({ isValidating: false, valid: true, reason: "", occupied: false, schoolName: "" });
                    try {
                        let iernRow = null;
                        const res = await fetch(api(`/schools_iern/${sid}`))
                            .then(async r => {
                                console.log('[schools_iern] pull', r.status, r.headers.get('content-type'));
                                if (!r.ok) console.error('[schools_iern] pull body:', await r.clone().text());
                                return r;
                            })
                            .catch(err => { console.error('[schools_iern] pull network:', err); return null; });
                        if (res?.ok) {
                            const j = await res.json();
                            if (j.exists && j.data) {
                                iernRow = j.data;
                                saveSchoolToCache({ ...iernRow, school_id: sid });
                            }
                        } else if (!navigator.onLine || !res) {
                            iernRow = await getCachedSchool(sid);
                        }

                        if (iernRow) {
                            setFormData(prev => ({
                                ...prev,
                                school_name: iernRow.School_Name || iernRow.school_name || prev.school_name,
                                region: iernRow.Region || iernRow.region || prev.region,
                                province: iernRow.Province || iernRow.province || prev.province,
                                municipality: iernRow.Municipality || iernRow.municipality || iernRow.City || prev.municipality,
                                division: iernRow.Division || iernRow.division || prev.division,
                                district: iernRow.District || iernRow.district || prev.district,
                                leg_district: iernRow.Legislative_District || iernRow.leg_district || prev.leg_district,
                                iern: iernRow.iern || iernRow.IERN || prev.iern
                            }));
                        }
                    } catch (e) {
                        console.error("IERN pull failed:", e);
                    }
                    return;
                }

                // If it's DIFFERENT, trigger the strict conversion validation
                setIdValidation(prev => ({ ...prev, isValidating: true, valid: false, reason: "" }));
                try {
                    const res = await fetch(api(`/sdo/validate-conversion/${sid}?requester_uid=${user?.uid}`)).catch(() => null);
                    if (res?.ok) {
                        const data = await res.json();
                        if (data.valid) {
                            setIdValidation({
                                isValidating: false,
                                valid: true,
                                reason: "",
                                occupied: false,
                                schoolName: data.school_name
                            });
                            // Autofill registry mapping
                            setFormData(prev => ({
                                ...prev,
                                school_name: data.school_name,
                                iern: data.iern || prev.iern
                            }));
                        } else {
                            setIdValidation({
                                isValidating: false,
                                valid: false,
                                reason: data.reason || "This ID is not eligible for conversion.",
                                occupied: data.occupied || false,
                                schoolName: ""
                            });
                        }
                    } else {
                        throw new Error("Validation service unavailable");
                    }
                } catch (err) {
                    console.error("Conversion validation failed:", err);
                    setIdValidation({ isValidating: false, valid: false, reason: "Unable to verify School ID across the registry.", occupied: false, schoolName: "" });
                }
            };
            pullIern();
        } else {
            setIdValidation({ isValidating: false, valid: false, reason: "", occupied: false, schoolName: "" });
        }
    }, [formData.school_id, initialSchoolId, user?.uid]);

    useEffect(() => {
        if (!isModeLoading && !isReviewMode) {
            const storedId = user?.school_id || localStorage.getItem("schoolId") || "anonymous";
            
            // 100% preservation for secured files - avoid wiping paths during transient docStatus changes
            const safeDraft = {
                ...formData,
                local_file_path: formData.local_file_path || "",
                local_file_name: formData.local_file_name || "",
                ownership_doc_id: formData.ownership_doc_id || null,
                ownership_document_path: formData.ownership_document_path || formData.local_file_path || "",
            };

            saveUnitDraft(1, storedId, { formData: safeDraft, step: currentStep });
        }
    }, [formData, currentStep, isModeLoading, isReviewMode, user, docStatus]);

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === "school_id") {
            // Force numeric string only, limit 6
            if (/^\d{0,6}$/.test(value)) {
                setFormData(prev => ({ ...prev, [name]: value }));
            }
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
            // Broadcast offering change immediately so other units (Unit 2, 3, etc.) react without waiting for a save
            if (name === 'curricular_offering' && value) {
                localStorage.setItem("schoolOffering", value);
            }
        }
    };
    const handleRegionChange = (e) => setFormData(prev => ({ ...prev, region: e.target.value, division: "", district: "", province: "", municipality: "", barangay: "" }));
    const handleDivisionChange = (e) => setFormData(prev => ({ ...prev, division: e.target.value, district: "" }));
    const handleProvinceChange = (e) => setFormData(prev => ({ ...prev, province: e.target.value, municipality: "", barangay: "" }));
    const handleCityChange = (e) => setFormData(prev => ({ ...prev, municipality: e.target.value, barangay: "" }));
    const handleOwnershipChange = (e) => {
        setDriveLinkError("");
        setFormData(prev => ({
            ...prev,
            ownership: e.target.value,
            ownership_multiple: [],
            ownership_document_type: "",
            ownership_document_multiple: [],
            google_drive_link: "",
            google_drive_file_id: "",
            google_drive_file_name: "",
            google_drive_thumbnail_url: "",
            ownership_na_reason: ""
        }));
    };

    const handleMultipleDocumentTypeToggle = (val) => {
        setFormData(prev => {
            const current = prev.ownership_document_multiple || [];
            const updated = current.includes(val)
                ? current.filter(v => v !== val)
                : [...current, val];
            return { ...prev, ownership_document_multiple: updated };
        });
    };

    const handleMultipleOwnershipToggle = (val) => {
        setFormData(prev => {
            const current = prev.ownership_multiple || [];
            const updated = current.includes(val)
                ? current.filter(v => v !== val)
                : [...current, val];
            return { ...prev, ownership_multiple: updated };
        });
    };
    const handleSchoolTypeChange = (e) => setFormData(prev => ({ ...prev, school_type: e.target.value, mother_school_id: "", extension_mother_school_name: "" }));
    
    const handleGoogleDriveLink = (e) => {
        const link = e.target.value;
        setFormData(prev => ({ ...prev, google_drive_link: link }));
        setDriveLinkError("");
    };

    const validateAndFetchGoogleDriveLink = async (link) => {
        if (!link.trim()) {
            setDriveLinkError("Please enter a Google Drive link");
            return;
        }

        setDriveLinkValidating(true);
        setDriveLinkError("");

        try {
            const response = await fetch(api(`/api/validate-google-drive-link`), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ link }),
            });

            const result = await response.json();

            if (!response.ok) {
                setDriveLinkError(result.error || "Failed to validate link. Make sure it's public and shared correctly.");
                setDriveLinkValidating(false);
                return;
            }

            setFormData(prev => ({
                ...prev,
                google_drive_file_id: result.fileId,
                google_drive_file_name: result.fileName,
                google_drive_thumbnail_url: result.thumbnailUrl,
            }));

            setDriveLinkError("");
        } catch (err) {
            console.error("Validation error:", err);
            setDriveLinkError("Error validating link. Please try again.");
        } finally {
            setDriveLinkValidating(false);
        }
    };

    const openGoogleDrivePicker = () => {
        // Load Google Picker API and open file picker
        if (window.gapi && window.gapi.picker) {
            const picker = new window.gapi.picker.PickerBuilder()
                .addView(window.gapi.picker.ViewId.DOCS)
                .addView(window.gapi.picker.ViewId.PDFS)
                .setOAuthToken(localStorage.getItem("google_auth_token"))
                .setCallback((data) => {
                    if (data.action === window.gapi.picker.Action.PICKED) {
                        const file = data.docs[0];
                        const driveLink = `https://drive.google.com/file/d/${file.id}/view`;
                        setFormData(prev => ({ ...prev, google_drive_link: driveLink }));
                        validateAndFetchGoogleDriveLink(driveLink);
                    }
                })
                .build();
            picker.setVisible(true);
        } else {
            alert("Google Picker not loaded. Please paste the link manually instead.");
        }
    };

    const handleUndoLocation = () => {
        if (originalSchoolLocation) {
            setFormData(prev => ({
                ...prev,
                latitude: originalSchoolLocation.latitude,
                longitude: originalSchoolLocation.longitude
            }));
        }
    };

    const handleBack = () => {
        if (currentStep > 0) setCurrentStep(s => s - 1);
        else navigate("/modular-dashboard");
    };

    const handleNext = () => {
        if (currentStep === 1 && schoolNameWarning) {
            alert(schoolNameWarning);
            return;
        }
        if (currentStep < TOTAL_STEPS - 1) setCurrentStep(s => s + 1);
        else handleSubmit();
    };

    const handleSaveDraftAndExit = async () => {
        const storedId = user?.school_id || localStorage.getItem("schoolId") || "anonymous";
        
        const safeDraft = {
            ...formData,
            local_file_path: docStatus === "secured" ? formData.local_file_path : "",
            local_file_name: docStatus === "secured" ? formData.local_file_name : "",
            ownership_doc_id: docStatus === "secured" ? formData.ownership_doc_id : null,
            ownership_document_path: docStatus === "secured" ? formData.ownership_document_path : "",
        };

        await saveUnitDraft(1, storedId, { formData: safeDraft, step: currentStep });
        if (formData.curricular_offering) {
            localStorage.setItem("schoolOffering", formData.curricular_offering);
        }
        navigate("/modular-dashboard");
    };

    const handleIdentityShift = async () => {
        if (!idValidation.valid || isShifting) return;
        
        setIsShifting(true);
        try {
            // 1. Perform Backend Identity Shift
            const res = await fetch(api("/ph_schools/identity-shift"), {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("token")}`
                },
                body: JSON.stringify({
                    old_school_id: initialSchoolId,
                    new_school_id: formData.school_id
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Shift failed");
            }

            const data = await res.json();

            // 2. Perform Local IndexedDB Re-keying
            console.log(`🔄 [Shift] Re-keying local data: ${initialSchoolId} -> ${formData.school_id}`);
            await migrateUnitDrafts(initialSchoolId, formData.school_id);

            // 3. Update Local Storage & Force Session Refresh
            localStorage.setItem("schoolId", formData.school_id);
            if (data.iern) localStorage.setItem("iern", data.iern);
            
            // Show success briefly then refresh
            setShowShiftModal(false);
            alert("Identity Shift Successful! Your account and data have been moved to the new School ID. The app will now reload.");
            window.location.reload();

        } catch (err) {
            console.error("Shift Error:", err);
            alert(`Identity Shift Failed: ${err.message}`);
        } finally {
            setIsShifting(false);
        }
    };

    const handleSubmit = async () => {
        console.log("[Unit1] handleSubmit fired", formData);
        
        const isDocBlocking = docStatus === "compressing" || docStatus === "uploading";
        if (isDocBlocking) {
            alert("Please wait for your ownership document to finish securing/compressing before submitting.");
            return;
        }

        let dataToSend, isCompleted;
        try {
            setLoading(true);
            let finalIern = formData.iern;
            if (!finalIern && formData.school_id) {
                const r = await fetch(api(`/schools_iern/${formData.school_id}`))
                    .then(async r => {
                        console.log('[schools_iern] iern-fallback', r.status, r.headers.get('content-type'));
                        if (!r.ok) console.error('[schools_iern] iern-fallback body:', await r.clone().text());
                        return r;
                    })
                    .catch(err => { console.error('[schools_iern] iern-fallback network:', err); return null; });
                if (r?.ok) { const j = await r.json(); if (j.exists && j.data?.iern) finalIern = j.data.iern; }
            }
            // STRICT VALIDATION WARNING (Frontend)
            const requiredFields = [
                { key: 'barangay', label: 'Barangay' },
                { key: 'leg_district', label: 'Legislative District' },
                { key: 'ownership', label: 'Ownership Selection' },
                { key: 'school_type', label: 'School Classification' },
                { key: 'curricular_offering', label: 'Curricular Offering' },
                { key: 'latitude', label: 'Map Pin (Latitude)' },
                { key: 'longitude', label: 'Map Pin (Longitude)' },
                { key: 'school_name', label: 'School Name' },
                { key: 'established_month', label: 'Month Established' },
                { key: 'established_year', label: 'Year Established' }
            ];

            const missing = requiredFields.filter(f => !formData[f.key]).map(f => f.label);
            
            // Document Guard: Ensure compression is finished
            const docRequired = formData.ownership !== "na" && formData.ownership !== "na_reason";
            // Leniency: If we have the doc ID and a path (even if it's the original one), it's "ready"
            const docReady = 
                !!formData.ownership_document_path || 
                (!!formData.local_file_path && !!formData.ownership_doc_id) ||
                docStatus === "secured";
            
            if (docRequired && !docReady) {
                alert("Please wait for your ownership document to finish securing/compressing before submitting.");
                setLoading(false);
                return;
            }

            if (missing.length > 0) {
                const proceed = window.confirm(
                    `Warning: The following fields are missing: ${missing.join(", ")}.\n\n` +
                    "While you can save your progress, this unit will NOT be marked as 'Accomplished' on your dashboard until these fields are provided. Do you want to proceed?"
                );
                if (!proceed) {
                    setLoading(false);
                    return;
                }
            }

            // Prepare JSON payload (no more files - using Google Drive links)
            dataToSend = {
                school_yr: "SY 26-27",
                school_id: formData.school_id,
                school_name: formData.school_name,
                region: formData.region,
                province: formData.province,
                municipality: formData.municipality,
                barangay: formData.barangay,
                division: formData.division,
                district: formData.district,
                leg_district: formData.leg_district,
                curricular_offering: formData.curricular_offering,
                latitude: formData.latitude,
                longitude: formData.longitude,
                iern: finalIern || null,
                school_head: formData.school_head,
                contact_number: formData.contact_number,
                ownership: formData.ownership,
                ownership_multiple: formData.ownership_multiple || [],
                google_drive_link: formData.google_drive_link,
                google_drive_file_id: formData.google_drive_file_id,
                google_drive_file_name: formData.google_drive_file_name,
                google_drive_thumbnail_url: formData.google_drive_thumbnail_url,
                established_month: formData.established_month,
                established_year: formData.established_year,
                school_type: formData.school_type,
                mother_school_id: formData.mother_school_id,
                ownership_na_reason: formData.ownership_na_reason,
                annex_details: formData.annex_details,
                extension_mother_school_name: formData.extension_mother_school_name,
                ownership_document_type: formData.ownership_document_type,
                ownership_document_multiple: formData.ownership_document_multiple || [],
                head_first_name: formData.head_first_name,
                head_middle_name: formData.head_middle_name,
                head_last_name: formData.head_last_name,
                head_sex: formData.head_sex,
                head_position_title: formData.head_position_title,
                head_date_hired: formData.head_date_hired,
                local_file_path: formData.local_file_path,
                local_file_name: formData.local_file_name,
                local_file_size: formData.local_file_size,
                ownership_doc_id: formData.ownership_doc_id,
                ownership_document_path: formData.ownership_document_path,
            };
            
            isCompleted = missing.length === 0;
            
            if (!navigator.onLine) {
                // OFFLINE SAVE TO OUTBOX
                await addModularToOutbox({
                    unitId: 1,
                    label: "Unit 1: School Identity",
                    url: api("/ph_schools/unit1"),
                    payload: dataToSend,
                    isCompleted: isCompleted,
                    schoolId: formData.school_id
                });

                await clearUnitDraft(1, formData.school_id);
                localStorage.setItem("schoolId", formData.school_id);
                localStorage.setItem("schoolOffering", formData.curricular_offering); // Broadcast to other units
                
                setShowOfflineSuccess(true);
                return;
            }

            const res = await fetch(api("/ph_schools/unit1"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dataToSend),
            });
            
            if (!res.ok) {
                const errText = await res.text().catch(() => "");
                console.error(`API Error: ${res.status}`, errText);
                throw new Error(`HTTP ${res.status}: ${errText || "Unknown error"}`);
            }

            const ct = res.headers.get("content-type") || "";
            if (!ct.includes("application/json")) {
                throw new Error("Non-JSON response — likely wrong endpoint or SPA fallback");
            }
            const body = await res.json();
            await clearUnitDraft(1, formData.school_id);
            const stored = localStorage.getItem("quest_progress");
            let progress = stored ? JSON.parse(stored) : { completedUnits: [], xp: 0 };
            
            
            if (isCompleted && !progress.completedUnits.includes(1)) { 
                progress.completedUnits.push(1); 
                progress.xp += 150; 
                localStorage.setItem("quest_progress", JSON.stringify(progress)); 
            } else if (!isCompleted) {
                // If they cleared it, remove it from progress
                progress.completedUnits = progress.completedUnits.filter(u => u !== 1);
                localStorage.setItem("quest_progress", JSON.stringify(progress));
            }

            localStorage.setItem("schoolId", formData.school_id);
            localStorage.setItem("schoolOffering", formData.curricular_offering);
            
            // Sync progress to cloud for Activity Dashboard
            fetch(api('/user/progress'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    unitId: 1, 
                    schoolId: formData.school_id,
                    completed: isCompleted // Note: Backend handles this too, but good to be explicit
                })
            }).catch(e => console.warn("Activity sync failed:", e));

            setShowSuccess(true);
        } catch (err) {
            console.error("Submit error details:", err);
            
            if (!navigator.onLine || err.message.includes('Failed to fetch')) {
                // Second check if we lost connection mid-flight
                await addModularToOutbox({
                    unitId: 1,
                    label: "Unit 1: School Identity",
                    url: api(`/ph_schools/unit1`),
                    payload: dataToSend,
                    isCompleted: isCompleted,
                    schoolId: formData.school_id
                });
                await clearUnitDraft(1, formData.school_id);
                setShowOfflineSuccess(true);
            } else {
                const errorMsg = err.message || "Unknown error";
                alert(`Failed to sync: ${errorMsg}\n\nProgress saved locally.`);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleEditPending = async () => {
        if (!pendingOutboxId) return;
        if (window.confirm("Do you want to move this data back to 'Draft' mode to make changes? It will be removed from the Sync Center for now.")) {
            await deleteModularFromOutbox(pendingOutboxId);
            setPendingOutboxId(null);
            setIsReviewMode(false);
            // The formData is already in local state, so it will persist as a draft automatically
        }
    };

    const progressPercentage = ((currentStep + 1) / TOTAL_STEPS) * 100;

    const stepInfo = [
        { q: "What's the school's ID?", sub: "Enter the 6-digit DepEd School ID to identify your school." },
        { q: "Confirm the school name", sub: "Is this the official name of the institution?" },
        { q: "Where is the school located?", sub: "Select the specific region, division, and district details." },
        { q: "What does the school offer?", sub: "Choose the curricular levels provided by the school." },
        { q: "School Head Information", sub: "Please provide the details of the school's primary administrator." },
        { q: "Pin the school 📍", sub: "Confirm the coordinates to update the school's map registry." },
        { q: "School Ownership & Classification", sub: "Provide ownership details and school classification." },
    ];

    const isStep0Valid = formData.school_id.length === 6 && /^\d+$/.test(formData.school_id);
    const isStep1Valid = formData.school_name.trim().length > 3 && !schoolNameWarning;
    const isStep2Valid = formData.region && formData.province && formData.municipality && formData.barangay && formData.division && formData.district && formData.leg_district;
    const isStep3Valid = formData.curricular_offering !== "";
    const isStep4Valid = formData.head_first_name !== "" && formData.head_last_name !== "" && formData.head_position_title !== "" && formData.head_date_hired !== "";
    const isStep5Valid = formData.latitude !== "" && formData.longitude !== "";
    const isStep6Valid = formData.ownership && 
        /* formData.ownership_document_type && */
        /* formData.local_file_path && */
        formData.school_type &&
        formData.established_month &&
        formData.established_year &&
        docStatus !== "compressing" &&
        docStatus !== "uploading" && (
        (formData.school_type === "with_annex" && 
            formData.annex_details.length > 0 && 
            formData.annex_details.every(annex => 
                annex.id.length === 6 && 
                /^\d+$/.test(annex.id) && 
                annex.name.trim().length > 0
            )
        ) ||
        (formData.school_type === "without_annex") ||
        (formData.school_type === "extension" && 
            formData.mother_school_id.length === 6 && 
            /^\d+$/.test(formData.mother_school_id) && 
            formData.extension_mother_school_name.trim().length > 0 && 
            !motherSchoolNotFound
        ) ||
        (formData.school_type === "extension" && motherSchoolNotFound && formData.extension_mother_school_name.trim().length > 5)
    );
    const isCurrentStepValid = () => {
        if (currentStep === 0) return isStep0Valid;
        if (currentStep === 1) return isStep1Valid;
        if (currentStep === 2) return isStep2Valid;
        if (currentStep === 3) return isStep3Valid;
        if (currentStep === 4) return isStep4Valid;
        if (currentStep === 5) return isStep5Valid;
        if (currentStep === 6) return isStep6Valid;
        return false;
    };

    if (isModeLoading) return <SkeletonWizard />;

    return (
        <div className="min-h-screen unit1-page flex flex-col font-sans text-gray-900 overflow-hidden">
            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap');
                
                :root {
                  --navy: #08315F;
                  --blue: #075985;
                  --blue-600: #0284C7;
                  --blue-400: #7DD3FC;
                  --blue-100: #E0F2FE;
                  --blue-50: #F0F9FF;
                  --gold: #FBBF24;
                  --amber: #D97706;
                  --red: #B91C1C;
                  --bg: #F0F9FF;
                  --card: #FFFFFF;
                  --text: #0F172A;
                  --muted: #64748B;
                  --line: #BAE6FD;
                  --font-heading: "Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                  --font-body: "DM Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                  --radius: 22px;
                }

                .unit1-page {
                  font-family: var(--font-body);
                  background-color: var(--blue-50);
                  background-image:
                    radial-gradient(43.5% 49.5% at 10% 12%, rgba(7, 89, 133, 0.15) 0 34%, transparent 78%),
                    radial-gradient(46.5% 54% at 92% 10%, rgba(251, 191, 36, 0.22) 0 36%, transparent 80%);
                }

                .bg-white.rounded-\\[2\\.5rem\\], 
                .bg-slate-50.rounded-\\[2\\.5rem\\],
                .bg-slate-900.rounded-\\[2\\.5rem\\] {
                  border: 2.5px solid color-mix(in srgb, var(--blue) 64%, var(--navy) 36%) !important;
                  border-radius: var(--radius) !important;
                }

                .nodes-card {
                  background: var(--card);
                  border: 2.5px solid color-mix(in srgb, var(--blue) 64%, var(--navy) 36%) !important;
                  border-radius: var(--radius) !important;
                  box-shadow: 0 10px 25px -5px rgba(8, 49, 95, 0.05);
                }
                
                .font-heading {
                  font-family: var(--font-heading) !important;
                }
                .font-body {
                  font-family: var(--font-body) !important;
                }
                
                h2, h3, h1 {
                  font-family: var(--font-heading);
                }
                `
            }} />
            
            <header className="px-6 py-5 flex items-center justify-between border-b border-gray-100/50 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => isReviewMode ? navigate("/modular-dashboard") : handleBack()} 
                        className="p-2 -ml-2 text-gray-400 hover:text-indigo-600 transition-colors"
                    >
                        <FiArrowLeft className="w-6 h-6" />
                    </button>
                    <div className="flex flex-col ml-2">
                        <span className="text-[10px] font-black tracking-widest text-indigo-400 uppercase leading-none">
                            {isReviewMode ? "Reviewing" : "Module 1"}
                        </span>
                        <span className="text-sm font-black text-slate-800 leading-tight">
                            School Identity
                        </span>
                    </div>
                </div>
                {!isReadOnly && (
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleOpenHistoryModal}
                            title="View / Copy previous SY data"
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-indigo-50 text-indigo-500 hover:bg-indigo-100 hover:text-indigo-700 transition-all active:scale-90 border border-indigo-100"
                        >
                            <FiCopy className="w-4 h-4" />
                        </button>
                        <div className="w-[120px] h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <motion.div 
                                className="h-full bg-blue-600 rounded-full" 
                                initial={{ width: 0 }} 
                                animate={{ width: `${progressPercentage}%` }} 
                                transition={{ duration: 0.8, ease: "circOut" }} 
                            />
                        </div>
                        <span className="text-xs font-black tracking-widest text-gray-300 uppercase">
                            Step {currentStep + 1}/{TOTAL_STEPS}
                        </span>
                    </div>
                )}
            </header>

            {/* Welcome Back Toast */}
            <AnimatePresence>
                {showWelcomeBack && (
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                        className="fixed top-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-5 py-2.5 rounded-full shadow-2xl text-[13px] font-bold flex items-center gap-2 z-[60]">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-ping" />
                        Recovered your draft!
                    </motion.div>
                )}
            </AnimatePresence>

            <main className="flex-1 relative overflow-y-auto px-6 pt-4 pb-32">
                <UnitRemarkAlert unitId="u1" schoolId={targetSchoolId || user?.school_id || localStorage.getItem("schoolId")} />
                <AnimatePresence mode="wait">
                    {isReviewMode ? (
                        <div key="review" className="max-w-md mx-auto pb-32 mt-4 space-y-8">
                            {/* Header */}
                            <div className="text-center mb-10">
                                <motion.div 
                                    initial={{ scale: 0 }} 
                                    animate={{ scale: 1 }} 
                                    className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-[2rem] mx-auto mb-6 flex items-center justify-center shadow-xl shadow-indigo-100"
                                >
                                    <span className="text-4xl text-white">🏫</span>
                                </motion.div>
                                <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-[0.2em] mb-3 shadow-sm border border-indigo-100">
                                    Unit 1 • School Identity Profile
                                </span>
                                <h1 className="text-3xl font-black text-slate-800 leading-tight tracking-tight px-4">{formData.school_name || "Official School Name"}</h1>
                                <p className="text-slate-500 font-medium mt-2">ID: <span className="font-black text-slate-800 tracking-wider">{formData.school_id}</span> • IERN: <span className="font-black text-slate-800 tracking-wider">{formData.iern || "PENDING"}</span></p>

                                {pendingOutboxId && (
                                    <div className="mt-8 flex flex-col items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                                        <div className="inline-flex items-center gap-2 px-6 py-3 bg-amber-50 border-2 border-amber-100 rounded-full shadow-sm">
                                            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                                            <span className="text-[10px] font-black text-amber-700 uppercase tracking-[0.2em]">Pending Sync • Local Storage Ready</span>
                                        </div>
                                        <button 
                                            onClick={handleEditPending}
                                            className="px-8 py-4 bg-white border-2 border-slate-200 rounded-[2rem] text-[11px] font-black text-slate-600 uppercase tracking-widest hover:border-blue-300 hover:text-blue-600 active:scale-95 transition-all shadow-sm flex items-center gap-2 group"
                                        >
                                            <FiEdit2 className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                                            Pull Back to Edit
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Core Stats Bar */}
                            <div className="bg-slate-50 rounded-[2.5rem] p-6 grid grid-cols-2 gap-6 border border-slate-100">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Classification</span>
                                    <p className="font-black text-slate-700 text-sm italic">
                                        {formData.school_type === "with_annex" ? "School with Annex" : 
                                         formData.school_type === "extension" ? "Annex" : "Without Annex"}
                                    </p>
                                </div>
                                <div className="space-y-1 border-l border-slate-200 pl-6">
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Offering</span>
                                    <p className="font-black text-indigo-600 text-sm truncate">{formData.curricular_offering || "Unset"}</p>
                                </div>
                            </div>

                            {/* Geographical Registry */}
                            <section className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-8 text-6xl opacity-10 grayscale group-hover:grayscale-0 transition-all duration-700">📍</div>
                                <div className="flex items-center gap-2 mb-6">
                                    <div className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Geographical Registry</h3>
                                </div>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 gap-4">
                                        <div>
                                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Region</span>
                                            <p className="font-bold text-slate-700">{formData.region?.toUpperCase() || "—"}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Province</span>
                                            <p className="font-bold text-slate-700">{formData.province?.toUpperCase() || "—"}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4">
                                        <div>
                                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Municipality</span>
                                            <p className="font-bold text-slate-700">{formData.municipality?.toUpperCase() || "—"}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Barangay</span>
                                            <p className="font-bold text-slate-700">{formData.barangay?.toUpperCase() || "—"}</p>
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-slate-50 grid grid-cols-1 gap-4">
                                        <div>
                                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Division</span>
                                            <p className="font-bold text-slate-700">{formData.division?.toUpperCase() || "—"}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">District</span>
                                            <p className="font-bold text-slate-700">{formData.district?.toUpperCase() || "—"}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Legislative District</span>
                                            <p className="font-bold text-slate-700">{formData.leg_district?.toUpperCase() || "—"}</p>
                                        </div>
                                    </div>
                                </div>
                            </section>
                                
                                <section>
                                    <div className="flex items-center gap-2 mb-4 ml-2 mt-8">
                                        <div className="w-1 h-4 bg-indigo-500 rounded-full" />
                                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.15em]">Foundation Info</h3>
                                    </div>
                                    <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm space-y-4">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Year Established</span>
                                                <p className="text-xl font-black text-slate-800">
                                                    {formData.established_month} {formData.established_year}
                                                </p>
                                            </div>
                                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center shadow-inner text-xl">
                                                🎊
                                            </div>
                                        </div>
                                        
                                        {/* Annex Registry (For Mother Schools) */}
                                        {formData.school_type === "with_annex" && formData.annex_details?.length > 0 && (
                                            <div className="mt-8 space-y-4">
                                                <div className="flex items-center gap-2 ml-2">
                                                    <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
                                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Annex Registry ({formData.annex_details.length})</h3>
                                                </div>
                                                <div className="grid grid-cols-1 gap-3">
                                                    {formData.annex_details.map((annex, i) => (
                                                        <div key={i} className="flex items-center gap-4 p-4 bg-blue-50/50 rounded-[2rem] border border-blue-100 shadow-sm group hover:bg-blue-50 transition-all">
                                                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm">🏫</div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest leading-none mb-1">Annex ID: {annex.id}</p>
                                                                <h4 className="font-black text-slate-800 text-sm truncate">{annex.name}</h4>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Mother School Info (For Annexes) */}
                                        {formData.school_type === "extension" && (
                                            <div className="mt-8 space-y-4">
                                                <div className="flex items-center gap-2 ml-2">
                                                    <div className="w-1.5 h-6 bg-purple-500 rounded-full" />
                                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Mother School Link</h3>
                                                </div>
                                                <div className="p-5 bg-purple-50 rounded-[2.5rem] border border-purple-100 flex items-start gap-5 shadow-sm">
                                                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm">🏢</div>
                                                    <div className="flex-1 min-w-0 pt-0.5">
                                                        <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-1">Registered Mother ID: {formData.mother_school_id}</p>
                                                        <h4 className="text-lg font-black text-purple-900 leading-tight">{formData.extension_mother_school_name}</h4>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </section>

                            {/* Administration */}
                            <section className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-xl shadow-slate-200">
                                <div className="flex items-center gap-2 mb-8">
                                    <div className="w-1.5 h-6 bg-blue-400 rounded-full" />
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">School Administration</h3>
                                </div>
                                <div className="flex items-start gap-5 mb-8">
                                    <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-3xl">👤</div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest mb-1">School Head</p>
                                        <h4 className="text-xl font-black">{[formData.head_first_name, formData.head_middle_name, formData.head_last_name].filter(Boolean).join(' ')}</h4>
                                        <p className="text-slate-400 text-sm font-bold mt-1 uppercase tracking-wider">{formData.head_position_title || "Designation Unset"}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-6 pt-6 border-t border-white/10">
                                    <div>
                                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-2">Sex</span>
                                        <p className="font-black text-sm">{formData.head_sex || "—"}</p>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-2">Date of Assignment</span>
                                        <p className="font-black text-sm">{formatDateAbbr(formData.head_date_hired)}</p>
                                    </div>
                                </div>
                            </section>

                            {/* Coordinates Overlay */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-emerald-50 rounded-3xl p-5 border border-emerald-100">
                                    <span className="text-[10px] font-black uppercase text-emerald-600 tracking-widest block mb-1">Latitude</span>
                                    <p className="font-black text-emerald-900 text-lg tracking-tight">{formData.latitude || "0.000000"}</p>
                                </div>
                                <div className="bg-emerald-50 rounded-3xl p-5 border border-emerald-100">
                                    <span className="text-[10px] font-black uppercase text-emerald-600 tracking-widest block mb-1">Longitude</span>
                                    <p className="font-black text-emerald-900 text-lg tracking-tight">{formData.longitude || "0.000000"}</p>
                                </div>
                            </div>

                            {/* Ownership & Compliance */}
                            <section className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-2 mb-6">
                                    <div className="w-1.5 h-6 bg-purple-500 rounded-full" />
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Legal & Ownership</h3>
                                </div>
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Ownership</span>
                                            {formData.ownership === 'multiple' && formData.ownership_multiple?.length ? (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {formData.ownership_multiple.map(o => (
                                                        <span key={o} className="text-xs font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full capitalize">{o.replace(/_/g, ' ')}</span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="font-black text-slate-800 text-lg capitalize">{formData.ownership?.replace(/_/g, ' ') || "—"}</p>
                                            )}
                                        </div>
                                        <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-2xl">⚖️</div>
                                    </div>
                                    {formData.ownership === 'na' && formData.ownership_na_reason && (
                                        <div className="p-4 bg-rose-50 border-2 border-rose-100 rounded-2xl relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 p-2 text-2xl opacity-10 grayscale group-hover:grayscale-0 transition-all duration-700">📝</div>
                                            <span className="text-[10px] font-black uppercase text-rose-500 tracking-widest block mb-2">Reason for N/A</span>
                                            <p className="font-bold text-slate-700 text-sm leading-relaxed">{formData.ownership_na_reason}</p>
                                        </div>
                                    )}
                                    {formData.ownership !== 'na' && (
                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Document Type</span>
                                        {formData.ownership === 'multiple' && formData.ownership_document_multiple?.length ? (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {formData.ownership_document_multiple.map(d => (
                                                    <span key={d} className="text-xs font-black bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{d}</span>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="font-bold text-slate-700 text-sm">{formData.ownership_document_type || "No document provided"}</p>
                                        )}
                                    </div>
                                    )}
                                    {(formData.local_file_path || formData.ownership_document_path) && (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Digital Archive</span>
                                                <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase">Verified</span>
                                            </div>
                                            <div className="flex items-center gap-4 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                                                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-xl shadow-inner">📄</div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-slate-700 text-sm truncate">
                                                        {formData.local_file_name || (formData.local_file_path || formData.ownership_document_path || "").split('/').pop()}
                                                    </p>
                                                    <div className="flex flex-col gap-1">
                                                        {formData.local_file_path && (
                                                            <a 
                                                                href={resolveDocUrl(formData.local_file_path, { download: true })} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer" 
                                                                download={`Original_Ownership_${formData.school_id || 'Unit1'}.pdf`}
                                                                className="text-indigo-600 text-[10px] font-black uppercase tracking-tighter mt-0.5 hover:underline"
                                                            >
                                                                View Original &rarr;
                                                            </a>
                                                        )}
                                                        {formData.ownership_document_path && (
                                                            <a 
                                                                href={resolveDocUrl(formData.ownership_document_path, { download: true })} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer" 
                                                                download={`Compressed_Ownership_${formData.school_id || 'Unit1'}.pdf`}
                                                                className="text-emerald-600 text-[10px] font-black uppercase tracking-tighter mt-0.5 hover:underline"
                                                            >
                                                                View Compressed PDF (Official) &rarr;
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>

                                 {/* Fixed bottom button will handle this */}

                        </div>
                    ) : (
                        <motion.div key={currentStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.4, ease: "circOut" }}
                            className="max-w-md mx-auto h-full flex flex-col">
                            
                            <div className="space-y-2 mb-8">
                                <h1 className="text-3xl font-black text-gray-900 leading-tight">{stepInfo[currentStep].q}</h1>
                                <p className="text-gray-500 font-medium leading-relaxed">{stepInfo[currentStep].sub}</p>
                            </div>

                            <div className="space-y-6">
                                {currentStep === 0 && (
                                    <div className="space-y-4">
                                        <div>
                                            <div className="flex items-center justify-between pl-4 mb-2">
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">6-Digit School ID</label>
                                                {isSchoolIdLocked ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">Autolocked</span>
                                                        <button 
                                                            onClick={() => setShowUnlockDialog(true)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-wider shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                                                        >
                                                            <FiUnlock className="w-3 h-3" />
                                                            Unlock
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 flex items-center gap-1.5 shadow-sm">
                                                        <FiCheck className="w-3.5 h-3.5" /> Editing Enabled
                                                    </span>
                                                )}
                                            </div>
                                            <div className="relative">
                                                <input 
                                                    type="tel" 
                                                    name="school_id" 
                                                    value={formData.school_id} 
                                                    onChange={handleChange} 
                                                    maxLength={6} 
                                                    placeholder="e.g. 101010" 
                                                    className={`${chunkyInput} ${isSchoolIdLocked ? '!bg-slate-50 !text-slate-500 font-black cursor-not-allowed border-dashed' : 'bg-white'}`} 
                                                    readOnly={isSchoolIdLocked}
                                                    onClick={() => isSchoolIdLocked && setShowUnlockDialog(true)}
                                                    autoFocus={!isSchoolIdLocked} 
                                                />
                                                {isStep0Valid && <FiCheckCircle className="absolute right-5 top-1/2 -translate-y-1/2 text-emerald-500 w-6 h-6" />}
                                            </div>
                                        </div>

                                        {/* Unlock Confirmation Section */}
                                        <AnimatePresence>
                                            {showUnlockDialog && (
                                                <motion.div 
                                                    initial={{ opacity: 0, y: 10, scale: 0.95 }} 
                                                    animate={{ opacity: 1, y: 0, scale: 1 }} 
                                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="p-6 bg-slate-900 rounded-[2.5rem] border-4 border-indigo-500/20 text-white space-y-5 shadow-2xl">
                                                        <div className="flex items-start gap-4">
                                                            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center text-2xl shadow-xl shadow-indigo-500/20 flex-shrink-0">🔐</div>
                                                            <div className="space-y-1">
                                                                <h4 className="font-black text-xs uppercase tracking-[0.2em] text-indigo-400">Security Requirement</h4>
                                                                <p className="text-[12px] text-slate-300 font-bold leading-relaxed">Type <span className="text-white bg-white/20 px-1.5 py-0.5 rounded-md font-black">Confirm</span> exactly to unlock this protected field.</p>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <input 
                                                                type="text" 
                                                                value={unlockInput}
                                                                onChange={(e) => setUnlockInput(e.target.value)}
                                                                placeholder="Type here..."
                                                                className="w-full p-4 bg-white/10 border-2 border-white/5 rounded-3xl text-white font-black text-center text-lg focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-600"
                                                                autoFocus
                                                            />
                                                        </div>
                                                        <div className="flex gap-3">
                                                            <button 
                                                                onClick={() => { setShowUnlockDialog(false); setUnlockInput(""); }}
                                                                className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all"
                                                            >
                                                                Cancel
                                                            </button>
                                                            <button 
                                                                disabled={unlockInput.toLowerCase() !== "confirm"}
                                                                onClick={() => {
                                                                    setIsSchoolIdLocked(false);
                                                                    setShowUnlockDialog(false);
                                                                    setUnlockInput("");
                                                                }}
                                                                className="flex-1 py-4 bg-indigo-500 disabled:opacity-20 text-slate-900 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-indigo-500/20"
                                                            >
                                                                Unlock ID
                                                            </button>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        {formData.iern && (
                                            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="p-5 bg-emerald-50 border-2 border-emerald-100 rounded-3xl flex items-center gap-4">
                                                <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold">✓</div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-0.5">IERN Verified</p>
                                                    <p className="text-lg font-black text-emerald-900 tracking-wider">{formData.iern}</p>
                                                </div>
                                            </motion.div>
                                        )}

                                        {/* Conversion Validation Feedback */}
                                        <AnimatePresence>
                                            {idValidation.isValidating && (
                                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-3xl">
                                                    <FiRefreshCw className="animate-spin text-indigo-600 w-5 h-5" />
                                                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Validating Registry...</p>
                                                </motion.div>
                                            )}
                                            {!idValidation.isValidating && formData.school_id !== initialSchoolId && idValidation.reason && (
                                                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className={`p-5 rounded-3xl border-2 flex gap-4 ${idValidation.occupied ? 'bg-orange-50 border-orange-100 text-orange-800' : 'bg-rose-50 border-rose-100 text-rose-800'}`}>
                                                    <FiAlertTriangle className="w-6 h-6 flex-shrink-0" />
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-widest mb-1">{idValidation.occupied ? 'Occupancy Warning' : 'Validation Error'}</p>
                                                        <p className="text-xs font-bold leading-relaxed">{idValidation.reason}</p>
                                                    </div>
                                                </motion.div>
                                            )}
                                            {!idValidation.isValidating && formData.school_id !== initialSchoolId && idValidation.valid && (
                                                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-6 bg-indigo-900 text-white rounded-[2rem] shadow-xl shadow-indigo-200/50">
                                                    <div className="flex items-start gap-4 mb-5">
                                                        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl">🏢</div>
                                                        <div>
                                                            <p className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] mb-1">New Target School</p>
                                                            <h4 className="text-lg font-black leading-tight">{idValidation.schoolName || formData.school_name}</h4>
                                                        </div>
                                                    </div>
                                                    <button 
                                                        onClick={() => setShowShiftModal(true)}
                                                        className="w-full py-4 bg-white text-indigo-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                                                    >
                                                        <FiRefreshCw className="w-4 h-4" />
                                                        Confirm Identity Shift
                                                    </button>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}

                                {currentStep === 1 && (
                                    <div>
                                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-4">Full School Name</label>
                                        <input type="text" name="school_name" value={formData.school_name} onChange={handleChange} placeholder="Official Name" className={chunkyInput} autoFocus />
                                        <AnimatePresence>
                                            {schoolNameWarning && (
                                                <motion.div 
                                                    initial={{ opacity: 0, scale: 0.95 }} 
                                                    animate={{ opacity: 1, scale: 1 }} 
                                                    exit={{ opacity: 0, scale: 0.95 }} 
                                                    className="mt-4 p-4 bg-amber-50 border-2 border-amber-100 rounded-3xl flex gap-3 items-center"
                                                >
                                                    <FiInfo className="w-6 h-6 text-amber-500 flex-shrink-0" />
                                                    <p className="text-[13px] font-bold text-amber-800 leading-relaxed">{schoolNameWarning}</p>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}

                                {currentStep === 2 && (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 gap-4">
                                            {/* Chain 1: Administrative */}
                                            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-3xl space-y-4 border border-slate-100 dark:border-slate-800">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Administrative Hierarchy</p>
                                                <div>
                                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-4">Region</label>
                                                    <select name="region" value={formData.region} onChange={handleRegionChange} className={chunkySelect}>
                                                        <option value="">Choose Region</option>
                                                        {regionOptions.map(r => <option key={r} value={r}>{r}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-4">Division</label>
                                                    <select name="division" value={formData.division} onChange={handleDivisionChange} className={chunkySelect} disabled={!formData.region}>
                                                        <option value="" disabled hidden style={{color: '#999'}}>Select Division</option>
                                                        {divisionOptions.map(d => <option key={d}>{d}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-4">District</label>
                                                    <select name="district" value={formData.district} onChange={handleChange} className={chunkySelect} disabled={!formData.division}>
                                                        <option value="" disabled hidden style={{color: '#999'}}>Select District</option>
                                                        {districtOptions.map(d => <option key={d}>{d}</option>)}
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Chain 2: Local Government */}
                                            <div className="p-4 bg-blue-50/30 dark:bg-blue-900/10 rounded-3xl space-y-4 border border-blue-100/50 dark:border-blue-800/20">
                                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest px-2">LGU Hierarchy</p>
                                                <div>
                                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-4">Province</label>
                                                    <select name="province" value={formData.province} onChange={handleProvinceChange} className={chunkySelect} disabled={!formData.region}>
                                                        <option value="" disabled hidden style={{color: '#999'}}>Select Province</option>
                                                        {provinceOptions.map(p => <option key={p}>{p}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-4">Municipality</label>
                                                    <select name="municipality" value={formData.municipality} onChange={handleCityChange} className={chunkySelect} disabled={!formData.province}>
                                                        <option value="" disabled hidden style={{color: '#999'}}>Select Municipality</option>
                                                        {cityOptions.map(c => <option key={c}>{c}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-4">Barangay</label>
                                                    <select name="barangay" value={formData.barangay} onChange={handleChange} className={chunkySelect} disabled={!formData.municipality}>
                                                        <option value="" disabled hidden style={{color: '#999'}}>Select Barangay</option>
                                                        {barangayOptions.map(b => <option key={b}>{b}</option>)}
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Others */}
                                            <div className="p-4 bg-indigo-50/30 dark:bg-indigo-900/10 rounded-3xl space-y-4 border border-indigo-100/50 dark:border-indigo-800/20">
                                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest px-2">Electoral / Legislative</p>
                                                <div>
                                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-4">Legislative District</label>
                                                    <select name="leg_district" value={formData.leg_district} onChange={handleChange} className={chunkySelect} disabled={!formData.region}>
                                                        <option value="" disabled hidden style={{color: '#999'}}>Select Leg. District</option>
                                                        {legDistrictOptions.map(l => <option key={l}>{l}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {currentStep === 3 && (
                                    <div className="space-y-6">
                                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-4">Audit Category</label>
                                        <select name="curricular_offering" value={formData.curricular_offering} onChange={handleChange} className={chunkySelect}>
                                            <option value="" disabled hidden style={{color: '#999'}}>Select Category...</option>
                                            <option value="Purely Elementary">Purely Elementary</option>
                                            <option value="Elementary School and Junior High School (K-10)">ES and JHS (K to 10)</option>
                                            <option value="Junior High and Senior High">JHS with SHS</option>
                                            <option value="All Offering (K to 12)">All Offering (K to 12)</option>
                                            <option value="Purely Junior High School">Purely Junior High School</option>
                                            <option value="Purely Senior High School">Purely Senior High School</option>
                                        </select>
                                        <div className="p-5 bg-amber-50 border-2 border-amber-100 rounded-3xl flex gap-3">
                                            <span className="text-xl">⚠️</span>
                                            <p className="text-[13px] font-bold text-amber-800 leading-tight">This choice determines which grade levels are audited later. Choose carefully.</p>
                                        </div>
                                    </div>
                                )}

                                {currentStep === 4 && (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 gap-4">
                                            <div>
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-4">First Name</label>
                                                <input
                                                    type="text"
                                                    name="head_first_name"
                                                    value={formData.head_first_name}
                                                    onChange={handleChange}
                                                    placeholder="First Name"
                                                    className={chunkyInput}
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-4">Middle Name</label>
                                                    <input
                                                        type="text"
                                                        name="head_middle_name"
                                                        value={formData.head_middle_name}
                                                        onChange={handleChange}
                                                        placeholder="Middle (Optional)"
                                                        className={chunkyInput}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-4">Last Name</label>
                                                    <input
                                                        type="text"
                                                        name="head_last_name"
                                                        value={formData.head_last_name}
                                                        onChange={handleChange}
                                                        placeholder="Last Name"
                                                        className={chunkyInput}
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-4">Sex</label>
                                                <select
                                                    name="head_sex"
                                                    value={formData.head_sex}
                                                    onChange={handleChange}
                                                    className={chunkySelect}
                                                >
                                                    <option value="">Select Sex</option>
                                                    <option value="Male">Male</option>
                                                    <option value="Female">Female</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-4">Position Title</label>
                                                <select
                                                    name="head_position_title"
                                                    value={formData.head_position_title}
                                                    onChange={handleChange}
                                                    className={chunkySelect}
                                                >
                                                    <option value="">Select Position</option>
                                                    <option value="Teacher I">Teacher I</option>
                                                    <option value="Teacher II">Teacher II</option>
                                                    <option value="Teacher III">Teacher III</option>
                                                    <option value="Teacher IV">Teacher IV</option>
                                                    <option value="Teacher V">Teacher V</option>
                                                    <option value="Teacher VI">Teacher VI</option>
                                                    <option value="Teacher VII">Teacher VII</option>
                                                    <option value="Master Teacher I">Master Teacher I</option>
                                                    <option value="Master Teacher II">Master Teacher II</option>
                                                    <option value="Master Teacher III">Master Teacher III</option>
                                                    <option value="Master Teacher IV">Master Teacher IV</option>
                                                    <option value="Master Teacher V">Master Teacher V</option>
                                                    <option value="Master Teacher VI">Master Teacher VI</option>
                                                    <option value="Head Teacher I">Head Teacher I</option>
                                                    <option value="Head Teacher II">Head Teacher II</option>
                                                    <option value="Head Teacher III">Head Teacher III</option>
                                                    <option value="Head Teacher IV">Head Teacher IV</option>
                                                    <option value="Head Teacher V">Head Teacher V</option>
                                                    <option value="Head Teacher VI">Head Teacher VI</option>
                                                    <option value="School Principal I">School Principal I</option>
                                                    <option value="School Principal II">School Principal II</option>
                                                    <option value="School Principal III">School Principal III</option>
                                                    <option value="School Principal IV">School Principal IV</option>
                                                    <option value="Assistant School Principal I">Assistant School Principal I</option>
                                                    <option value="Assistant School Principal II">Assistant School Principal II</option>
                                                    <option value="SDO Personnel (OIC)">SDO Personnel (OIC)</option>
                                                </select>
                                            </div>
                                            <div className="space-y-4">


                                                {/* Date Assigned Selection */}
                                                <div className="space-y-2">
                                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-4 block">Date of Assignment</label>
                                                    <div className="grid grid-cols-3 gap-3">
                                                        <select name="head_hired_year" value={formData.head_hired_year} onChange={handleChange} className={chunkySelect + " !text-sm text-left px-4"}>
                                                            <option value="" disabled hidden>Year</option>
                                                            {Array.from({ length: 70 }, (_, i) => (new Date().getFullYear() - i).toString()).map(y => (
                                                                <option key={y} value={y}>{y}</option>
                                                            ))}
                                                        </select>
                                                        <select name="head_hired_month" value={formData.head_hired_month} onChange={handleChange} className={chunkySelect + " !text-sm text-left px-4"}>
                                                            <option value="" disabled hidden>Month</option>
                                                            {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m, idx) => {
                                                                const currentYear = new Date().getFullYear();
                                                                const currentMonth = new Date().getMonth(); // 0-indexed
                                                                const isFuture = formData.head_hired_year === currentYear.toString() && idx > currentMonth;
                                                                return <option key={m} value={m} disabled={isFuture}>{m}</option>;
                                                            })}
                                                        </select>
                                                        <select name="head_hired_day" value={formData.head_hired_day} onChange={handleChange} className={chunkySelect + " !text-sm text-left px-4"}>
                                                            <option value="" disabled hidden>Day</option>
                                                            {(() => {
                                                                const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                                                                const mIdx = monthNames.indexOf(formData.head_hired_month);
                                                                const year = parseInt(formData.head_hired_year);
                                                                
                                                                let maxDays = 31;
                                                                if (mIdx !== -1 && !isNaN(year)) {
                                                                    maxDays = new Date(year, mIdx + 1, 0).getDate();
                                                                }
                                                                
                                                                const currentYear = new Date().getFullYear();
                                                                const currentMonth = new Date().getMonth();
                                                                const currentDay = new Date().getDate();

                                                                return Array.from({ length: maxDays }, (_, i) => (i + 1).toString()).map(d => {
                                                                    const dayNum = parseInt(d);
                                                                    const isFutureDay = formData.head_hired_year === currentYear.toString() && 
                                                                                        mIdx === currentMonth && 
                                                                                        dayNum > currentDay;
                                                                    return <option key={d} value={d} disabled={isFutureDay}>{d}</option>;
                                                                });
                                                            })()}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {currentStep === 5 && (
                                    <div className="space-y-4 pb-20">
                                        <div className="flex items-center justify-between px-1">
                                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Refine School Position</h4>
                                            <div className="flex items-center gap-2">
                                                {originalSchoolLocation && (parseFloat(formData.latitude) !== parseFloat(originalSchoolLocation.latitude) || parseFloat(formData.longitude) !== parseFloat(originalSchoolLocation.longitude)) && (
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
                                        
                                        <div className="h-48 rounded-[2rem] overflow-hidden border-2 border-gray-100 shadow-inner relative mt-0">
                                            <LocationPickerMap
                                                latitude={formData.latitude}
                                                longitude={formData.longitude}
                                                onLocationSelect={(lat, lng) => setFormData(prev => ({ ...prev, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }))}
                                                readOnly={false}
                                                className="h-full"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <input type="text" value={formData.latitude} disabled placeholder="Lat" className={chunkyInput + " text-sm text-center !bg-gray-50"} />
                                            <input type="text" value={formData.longitude} disabled placeholder="Long" className={chunkyInput + " text-sm text-center !bg-gray-50"} />
                                        </div>
                                    </div>
                                )}

                                        {currentStep === 6 && (
                                    <div className="space-y-6 pb-20">
                                        {/* Year Established */}
                                        <div className="space-y-3">
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-4 block">Year Established</label>
                                            <div className="grid grid-cols-2 gap-4">
                                                <select
                                                    name="established_year"
                                                    value={formData.established_year}
                                                    onChange={handleChange}
                                                    className={chunkySelect}
                                                >
                                                    <option value="" disabled hidden style={{color: '#999'}}>Year...</option>
                                                    {Array.from({ length: new Date().getFullYear() - 1900 + 1 }, (_, i) => new Date().getFullYear() - i).map(y => (
                                                        <option key={y} value={y}>{y}</option>
                                                    ))}
                                                </select>
                                                <select 
                                                    name="established_month" 
                                                    value={formData.established_month} 
                                                    onChange={handleChange} 
                                                    className={chunkySelect}
                                                >
                                                    <option value="" disabled hidden style={{color: '#999'}}>Month...</option>
                                                    {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, idx) => {
                                                        const currentYear = new Date().getFullYear();
                                                        const currentMonth = new Date().getMonth();
                                                        const isFuture = formData.established_year === currentYear.toString() && idx > currentMonth;
                                                        return <option key={m} value={m} disabled={isFuture}>{m}</option>;
                                                    })}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Ownership Question */}
                                        <div>
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-4 block mb-2">Ownership</label>
                                            <select name="ownership" value={formData.ownership} onChange={handleOwnershipChange} className={chunkySelect}>
                                                <option value="" disabled hidden style={{color: '#999'}}>Select Ownership...</option>
                                                <option value="deped">DepEd-owned</option>
                                                <option value="lgu_owned">LGU-owned</option>
                                                <option value="privately_owned">Privately-owned</option>
                                                <option value="nga_owned">NGA-owned</option>
                                                <option value="multiple">Multiple ownership</option>
                                                <option value="na">N/A</option>
                                            </select>
                                        </div>

                                        {/* N/A Reason Field */}
                                        {formData.ownership === 'na' && (
                                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                                                className="space-y-2">
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-4 block">Please provide reason for N/A selection</label>
                                                <div className="relative group">
                                                    <textarea
                                                        name="ownership_na_reason"
                                                        value={formData.ownership_na_reason}
                                                        onChange={handleChange}
                                                        maxLength={100}
                                                        placeholder="Maximum 100 characters..."
                                                        className="w-full min-h-[100px] bg-slate-50 border-2 border-slate-100 rounded-3xl p-5 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300 resize-none"
                                                    />
                                                    <div className="absolute bottom-4 right-5 flex items-center gap-1.5 px-3 py-1.5 bg-white shadow-sm border border-slate-100 rounded-full">
                                                        <div className={`w-1.5 h-1.5 rounded-full ${formData.ownership_na_reason?.length >= 90 ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                                                        <span className={`text-[10px] font-black tracking-tighter ${formData.ownership_na_reason?.length >= 90 ? 'text-rose-600' : 'text-slate-400'}`}>
                                                            {formData.ownership_na_reason?.length || 0}/100
                                                        </span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}

                                        {/* Multiple Ownership — checkbox picker */}
                                        {formData.ownership === 'multiple' && (
                                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                                                className="space-y-2">
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-4 block">Select categories below</label>
                                                <div className="p-4 bg-white border-2 border-gray-100 rounded-3xl shadow-sm space-y-2">
                                                    {[
                                                        { value: 'deped', label: 'DepEd-owned' },
                                                        { value: 'lgu_owned', label: 'LGU-owned' },
                                                        { value: 'privately_owned', label: 'Privately-owned' },
                                                        { value: 'nga_owned', label: 'NGA-owned' },
                                                    ].map(({ value, label }) => {
                                                        const selected = (formData.ownership_multiple || []).includes(value);
                                                        return (
                                                            <button
                                                                key={value}
                                                                type="button"
                                                                onClick={() => handleMultipleOwnershipToggle(value)}
                                                                className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all active:scale-[0.98] ${selected ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-500'}`}
                                                            >
                                                                <span className="text-sm font-bold">{label}</span>
                                                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                                                                    {selected && <FiCheck className="w-4 h-4 text-white" strokeWidth={4} />}
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </motion.div>
                                        )}

                                        {/* Ownership Document Upload */}
                                        {formData.ownership && formData.ownership !== 'na' && (
                                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                                                className="space-y-3">
                                                {formData.ownership === 'multiple' ? (
                                                    <div className="space-y-4">
                                                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-4 block">Select ownership documents</label>
                                                        <div className="p-4 bg-white border-2 border-gray-100 rounded-3xl shadow-sm space-y-2">
                                                            {[
                                                                "Transfer Certificate of Title",
                                                                "Native Title",
                                                                "Special Patents",
                                                                "Presidential Proclamations",
                                                                "Deed of Sale",
                                                                "Deed of Donation",
                                                                "Deed of Donation (DepEd Registered)",
                                                                "Deed of Donation (Unregistered)",
                                                                "Usufruct Agreement",
                                                                "Memorandum of Agreement",
                                                                "Lease Agreement",
                                                                "Expropriation",
                                                                "Tax Declaration Only",
                                                                "Extrajudicial Settlement"
                                                            ].map((doc) => {
                                                                const selected = (formData.ownership_document_multiple || []).includes(doc);
                                                                return (
                                                                    <button
                                                                        key={doc}
                                                                        type="button"
                                                                        onClick={() => handleMultipleDocumentTypeToggle(doc)}
                                                                        className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all active:scale-[0.98] ${selected ? 'bg-purple-50 text-purple-700' : 'bg-gray-50 text-gray-500'}`}
                                                                    >
                                                                        <span className="text-sm font-bold text-left">{doc}</span>
                                                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selected ? 'border-purple-500 bg-purple-500' : 'border-gray-300'}`}>
                                                                            {selected && <FiCheck className="w-4 h-4 text-white" strokeWidth={4} />}
                                                                        </div>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-4 block">Document Type</label>
                                                        <select
                                                            name="ownership_document_type"
                                                            value={formData.ownership_document_type}
                                                            onChange={handleChange}
                                                            className={chunkySelect}
                                                        >
                                                            <option value="" disabled hidden style={{color: '#999'}}>Select Document Type...</option>
                                                            <option value="Transfer Certificate of Title">Transfer Certificate of Title</option>
                                                            <option value="Native Title">Native Title</option>
                                                            <option value="Special Patents">Special Patents</option>
                                                            <option value="Presidential Proclamations">Presidential Proclamations</option>
                                                            <option value="Deed of Sale">Deed of Sale</option>
                                                            <option value="Deed of Donation">Deed of Donation</option>
                                                            <option value="Deed of Donation (DepEd Registered)">Deed of Donation (DepEd Registered)</option>
                                                            <option value="Deed of Donation (Unregistered)">Deed of Donation (Unregistered)</option>
                                                            <option value="Usufruct Agreement">Usufruct Agreement</option>
                                                            <option value="Memorandum of Agreement">Memorandum of Agreement</option>
                                                            <option value="Lease Agreement">Lease Agreement</option>
                                                            <option value="Expropriation">Expropriation</option>
                                                            <option value="Tax Declaration Only">Tax Declaration Only</option>
                                                            <option value="Extrajudicial Settlement">Extrajudicial Settlement</option>
                                                        </select>
                                                    </>
                                                )}

                                                {/* Local Document Upload */}
                                                <div className="pt-2">
                                                    <DocumentUpload
                                                        iern={formData.iern || formData.school_id}
                                                        docType={formData.ownership === 'multiple' ? 'Multiple Ownership Documents' : formData.ownership_document_type}
                                                        initialFile={formData.local_file_path}
                                                        initialDocId={formData.ownership_doc_id}
                                                        initialFileSize={formData.local_file_size}
                                                        onUploadStart={() => setDocStatus("uploading")}
                                                        onCompressStart={() => setDocStatus("compressing")}
                                                        onComplete={(meta) => {
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                local_file_path: meta.local_file_path,
                                                                ownership_doc_id: meta.ownership_doc_id,
                                                                local_file_name: meta.local_file_name,
                                                                local_file_size: meta.local_file_size,
                                                                ownership_document_path: meta.ownership_document_path || meta.local_file_path
                                                            }));
                                                            setDocStatus("secured");
                                                        }}
                                                        onError={() => setDocStatus("error")}
                                                        onUploadSuccess={(path, id, name, size, compressedPath) => {
                                                            // We still update path immediately for local preview if needed, 
                                                            // but docStatus stays 'compressing' until onComplete
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                local_file_path: path,
                                                                ownership_doc_id: id,
                                                                local_file_name: name,
                                                                local_file_size: size,
                                                                ownership_document_path: compressedPath || path
                                                            }));
                                                        }}
                                                    />

                                                    {/* PDF tip */}
                                                    <div className="mt-3 flex items-start gap-2 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl">
                                                        <span className="text-slate-400 text-base leading-none mt-0.5">💡</span>
                                                        <p className="text-[11px] font-semibold text-slate-500 leading-snug">
                                                            <span className="font-black">Tip:</span> For faster upload, ensure your PDF is clear and ideally under 5MB. Scanned documents are automatically optimized for national registry standards.
                                                        </p>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}

                                        {/* School Type Question */}
                                        {formData.ownership && (
                                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                                                className="space-y-3">
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-4 block">School Type</label>
                                                <select name="school_type" value={formData.school_type} onChange={handleSchoolTypeChange} className={chunkySelect}>
                                                    <option value="" disabled hidden style={{color: '#999'}}>Select School Type...</option>
                                                    <option value="with_annex">School with Annex</option>
                                                    <option value="without_annex">School without Annex</option>
                                                    <option value="extension">Annex</option>
                                                </select>
                                            </motion.div>
                                        )}

                                        {/* School Type: With Annex - How many? */}
                                        {formData.school_type === "with_annex" && (
                                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                                                className="space-y-3">
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-4 block">How many annexes?</label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="20"
                                                        value={formData.annex_details.length || ""}
                                                        onChange={(e) => {
                                                            const count = parseInt(e.target.value) || 0;
                                                            setFormData(prev => {
                                                                const newDetails = [...prev.annex_details];
                                                                if (count > newDetails.length) {
                                                                    for (let i = newDetails.length; i < count; i++) {
                                                                        newDetails.push({ id: "", name: "", isManual: false });
                                                                    }
                                                                } else {
                                                                    newDetails.splice(count);
                                                                }
                                                                return { ...prev, annex_details: newDetails };
                                                            });
                                                        }}
                                                        placeholder="Number of annexes"
                                                        className={chunkyInput}
                                                    />
                                                    <FiList className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
                                                </div>
                                            </motion.div>
                                        )}

                                        {/* Dynamic Annex ID Inputs */}
                                        {formData.school_type === "with_annex" && formData.annex_details.map((annex, idx) => (
                                            <motion.div key={idx} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}
                                                className="space-y-3 border-l-4 border-blue-100 pl-4 py-2">
                                                <label className="text-[11px] font-black text-blue-500 uppercase tracking-widest block">Annex #{idx + 1} School ID</label>
                                                <div className="relative">
                                                    <input
                                                        type="tel"
                                                        value={annex.id}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setFormData(prev => {
                                                                const newDetails = [...prev.annex_details];
                                                                newDetails[idx] = { ...newDetails[idx], id: val, isManual: false };
                                                                return { ...prev, annex_details: newDetails };
                                                            });
                                                            
                                                            if (val.length === 6 && /^\d+$/.test(val)) {
                                                                fetch(api(`/schools_iern/${val}`))
                                                                    .then(r => r.ok ? r.json() : null)
                                                                    .then(data => {
                                                                        if (data?.exists && data.data?.School_Name) {
                                                                            setFormData(prev => {
                                                                                const updated = [...prev.annex_details];
                                                                                updated[idx] = { ...updated[idx], name: data.data.School_Name, isManual: false };
                                                                                return { ...prev, annex_details: updated };
                                                                            });
                                                                        } else {
                                                                            setFormData(prev => {
                                                                                const updated = [...prev.annex_details];
                                                                                updated[idx] = { ...updated[idx], name: "", isManual: true };
                                                                                return { ...prev, annex_details: updated };
                                                                            });
                                                                        }
                                                                    })
                                                                    .catch(() => {
                                                                        setFormData(prev => {
                                                                            const updated = [...prev.annex_details];
                                                                            updated[idx] = { ...updated[idx], name: "", isManual: true };
                                                                            return { ...prev, annex_details: updated };
                                                                        });
                                                                    });
                                                            } else {
                                                                setFormData(prev => {
                                                                    const updated = [...prev.annex_details];
                                                                    updated[idx] = { ...updated[idx], name: "" };
                                                                    return { ...prev, annex_details: updated };
                                                                });
                                                            }
                                                        }}
                                                        maxLength="6"
                                                        placeholder="6-digit ID"
                                                        className={chunkyInput}
                                                    />
                                                    {annex.id.length === 6 && /^\d+$/.test(annex.id) && annex.name && !annex.isManual && <FiCheckCircle className="absolute right-5 top-1/2 -translate-y-1/2 text-emerald-500 w-6 h-6" />}
                                                    {annex.id.length === 6 && /^\d+$/.test(annex.id) && annex.isManual && <FiAlertCircle className="absolute right-5 top-1/2 -translate-y-1/2 text-amber-500 w-6 h-6" />}
                                                </div>

                                                {/* Manual Name Entry if Not Found */}
                                                {(annex.isManual || (annex.id.length === 6 && !annex.name)) && (
                                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-2">
                                                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-tight italic">ID not found. Enter school name manually:</p>
                                                        <input
                                                            type="text"
                                                            value={annex.name}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                setFormData(prev => {
                                                                    const updated = [...prev.annex_details];
                                                                    updated[idx] = { ...updated[idx], name: val };
                                                                    return { ...prev, annex_details: updated };
                                                                });
                                                            }}
                                                            placeholder="Official Annex School Name"
                                                            className={chunkyInput}
                                                        />
                                                    </motion.div>
                                                )}

                                                {annex.name && !annex.isManual && (
                                                    <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="px-5 py-2 bg-blue-50 border border-blue-100 rounded-2xl">
                                                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest break-all line-clamp-1">{annex.name}</p>
                                                    </motion.div>
                                                )}
                                            </motion.div>
                                        ))}

                                        {/* Original Mother School ID Logic - ONLY FOR EXTENSION */}
                                        {formData.school_type === "extension" && (
                                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                                                className="space-y-3">
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-4">
                                                    {formData.school_type === "with_annex" && "What is your annex school id?"}
                                                    {formData.school_type === "extension" && "What is your mother school ID?"}
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="tel"
                                                        name="mother_school_id"
                                                        value={formData.mother_school_id}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setFormData(prev => ({ ...prev, mother_school_id: val }));
                                                            setMotherSchoolNotFound(false);
                                                            // Auto-fetch school name when 6 digits entered
                                                            if (val.length === 6 && /^\d+$/.test(val)) {
                                                                setFetchingMotherSchool(true);
                                                                fetch(api(`/schools_iern/${val}`))
                                                                    .then(r => r.ok ? r.json() : null)
                                                                    .then(data => {
                                                                        if (data?.exists && data.data?.School_Name) {
                                                                            setFormData(prev => ({ ...prev, extension_mother_school_name: data.data.School_Name }));
                                                                            setMotherSchoolNotFound(false);
                                                                        } else {
                                                                            setMotherSchoolNotFound(true);
                                                                            setFormData(prev => ({ ...prev, extension_mother_school_name: "" }));
                                                                        }
                                                                        setFetchingMotherSchool(false);
                                                                    })
                                                                    .catch(() => {
                                                                        setMotherSchoolNotFound(true);
                                                                        setFormData(prev => ({ ...prev, extension_mother_school_name: "" }));
                                                                        setFetchingMotherSchool(false);
                                                                    });
                                                            } else {
                                                                setFormData(prev => ({ ...prev, extension_mother_school_name: "" }));
                                                            }
                                                        }}
                                                        maxLength="6"
                                                        placeholder="6-digit ID"
                                                        className={chunkyInput}
                                                        autoFocus
                                                    />
                                                    {formData.mother_school_id.length === 6 && /^\d+$/.test(formData.mother_school_id) && !fetchingMotherSchool && !motherSchoolNotFound && <FiCheckCircle className="absolute right-5 top-1/2 -translate-y-1/2 text-emerald-500 w-6 h-6" />}
                                                    {formData.mother_school_id.length === 6 && /^\d+$/.test(formData.mother_school_id) && !fetchingMotherSchool && motherSchoolNotFound && <FiX className="absolute right-5 top-1/2 -translate-y-1/2 text-red-500 w-6 h-6" />}
                                                    {fetchingMotherSchool && <div className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />}
                                                </div>

                                                {motherSchoolNotFound && (
                                                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                                                        className="p-4 bg-amber-50 border-2 border-amber-100 rounded-[2rem] space-y-4">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-xl">⚠️</span>
                                                            <p className="text-sm font-bold text-amber-800 leading-tight">School ID not found in database. Please enter the full school name manually:</p>
                                                        </div>
                                                        <div>
                                                            <input 
                                                                type="text" 
                                                                value={formData.extension_mother_school_name} 
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    setFormData(prev => ({ ...prev, extension_mother_school_name: val }));
                                                                }}
                                                                placeholder="Enter Official School Name"
                                                                className={chunkyInput + " !bg-white"}
                                                            />
                                                            {(() => {
                                                                const abbrList = ["ES", "NHS", "PS", "CS", "CES", "HS", "IS", "SHS", "ELEM", "MNHS"];
                                                                const regex = new RegExp(`\\b(${abbrList.join('|')})\\b`, 'i');
                                                                const match = formData.extension_mother_school_name.match(regex);
                                                                if (match) {
                                                                    return <p className="text-[10px] text-red-500 font-bold mt-2 px-4 italic leading-tight uppercase tracking-wider">🚫 No Abbreviations. Please spell out "{match[1].toUpperCase()}" (e.g., Elementary School).</p>;
                                                                }
                                                                return null;
                                                            })()}
                                                        </div>
                                                    </motion.div>
                                                )}

                                                {formData.extension_mother_school_name && !motherSchoolNotFound && (
                                                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                                                        className="p-4 bg-blue-50 border-2 border-blue-100 rounded-2xl">
                                                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Autofilled School Name</p>
                                                        <p className="text-lg font-black text-blue-900">{formData.extension_mother_school_name}</p>
                                                    </motion.div>
                                                )}
                                            </motion.div>
                                        )}


                                        {/* Certification Checkbox */}
                                        <div 
                                            onClick={() => setIsCertified(!isCertified)}
                                            className={`p-8 rounded-[2.5rem] mt-8 mb-4 border-4 transition-all duration-300 flex items-start gap-6 cursor-pointer ${isCertified ? 'bg-emerald-50 border-emerald-500 shadow-xl shadow-emerald-100' : 'bg-white border-slate-100 opacity-60'}`}
                                        >
                                            <div className={`w-8 h-8 rounded-xl flex-none flex items-center justify-center transition-all ${isCertified ? 'bg-emerald-500 text-white' : 'border-2 border-slate-200'}`}>
                                                {isCertified && <FiCheck className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <p className={`text-sm font-black leading-relaxed ${isCertified ? 'text-emerald-950' : 'text-slate-500'}`}>
                                                    I hereby certify that the learner counts and gender breakdown provided are accurate and based on our school's current official enrollment records.
                                                </p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 italic">Official Certification for SY 2025-2026</p>
                                            </div>
                                        </div>


                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* Sticky Navigation Footer */}
            {(!isReadOnly && !isReviewMode) && (
                <div className="fixed bottom-0 left-0 w-full p-6 bg-white/80 backdrop-blur-xl border-t border-gray-100 z-50">
                    <div className="max-w-md mx-auto flex gap-3">
                        {currentStep === 0 ? (
                            <button onClick={() => setShowDraftModal(true)} className="flex-none h-16 px-6 rounded-3xl bg-blue-50 border-2 border-blue-100 flex items-center justify-center gap-2 text-blue-500 hover:text-blue-700 active:scale-95 transition-all outline-none">
                                <FiSave className="w-6 h-6" />
                                <span className="text-sm font-bold">Save Draft</span>
                            </button>
                        ) : (
                            <>
                                <button onClick={handleBack} className="w-16 h-16 rounded-3xl bg-slate-50 border-2 border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 active:scale-95 transition-all outline-none shrink-0">
                                    <FiArrowLeft className="w-6 h-6" />
                                </button>
                                <button onClick={() => setShowDraftModal(true)} className="flex-none h-16 px-6 rounded-3xl bg-blue-50 border-2 border-blue-100 flex items-center justify-center gap-2 text-blue-500 hover:text-blue-700 active:scale-95 transition-all outline-none shrink-0">
                                    <FiSave className="w-6 h-6" />
                                    <span className="text-sm font-bold">Save Draft</span>
                                </button>
                            </>
                        )}
                        <button 
                            onClick={handleNext} 
                            disabled={loading || (!hookIsSuperUser && !isCurrentStepValid()) || (currentStep === TOTAL_STEPS - 1 && !isCertified)}
                            className={`flex-1 h-16 rounded-3xl text-white font-black text-lg active:scale-95 transition-all disabled:opacity-40 border-b-[6px] active:border-b-0 active:translate-y-[6px] shadow-lg flex justify-center items-center gap-2
                                ${(currentStep === TOTAL_STEPS - 1 && !isReadOnly) ? "bg-emerald-600 border-emerald-800 shadow-emerald-100" : "bg-indigo-600 border-indigo-800 shadow-indigo-100"}`}
                        >
                            {loading ? (
                                <div className="flex items-center justify-center gap-2">
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Syncing...</span>
                                </div>
                            ) : (currentStep === TOTAL_STEPS - 1 && !isReadOnly) ? (
                                <span className="flex items-center justify-center gap-2">
                                    SUBMIT ENTRY <FiCheckCircle className="w-5 h-5" />
                                </span>
                            ) : (
                                <span>Next Step &gt;</span>
                            )}
                        </button>
                    </div>
                </div>
            )}

            <SuccessModal isOpen={showSuccess} onClose={() => setShowSuccess(false)} message="School identity profile has been successfully saved to our cloud registry! ✓" redirectUrl="/modular-dashboard" />

            <AnimatePresence>
                {showOfflineSuccess && (
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[100] flex items-end justify-center">
                        <motion.div initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="bg-white w-full rounded-t-[3rem] p-10 pb-12 shadow-2xl relative">
                            <div className="w-16 h-1.5 bg-gray-200 rounded-full mx-auto mb-8" />
                            <div className="w-20 h-20 bg-amber-500 rounded-full mx-auto flex items-center justify-center text-3xl shadow-2xl shadow-amber-200 mb-6 font-bold text-white">
                                <FiWifiOff />
                            </div>
                            <h2 className="text-2xl font-black text-gray-900 text-center leading-tight px-4">Offline Access: Unit 1 Secured Locally!</h2>
                            <p className="text-gray-500 text-center font-medium mt-3 px-6">Unit 1 has been saved to your phone's <strong>Sync Center</strong>. Once you are back online, your official profile will be automatically restored to the cloud.</p>
                            
                            <div className="mt-10">
                                <button onClick={() => navigate("/modular-dashboard")}
                                    className="w-full py-5 rounded-[2rem] bg-amber-600 text-white font-black text-lg shadow-xl shadow-amber-100 active:scale-95 transition-all">
                                    Return to Modules Dashboard
                                </button>
                                <p className="text-[10px] text-amber-500 font-bold uppercase text-center mt-6 tracking-widest leading-loose">✓ Offline Mode • Auto-Sync Enabled ✓</p>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showDraftModal && (
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[100] flex items-end justify-center">
                        <motion.div initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="bg-white w-full rounded-t-[3rem] p-10 pb-12 shadow-2xl relative">
                            <div className="w-16 h-1.5 bg-gray-200 rounded-full mx-auto mb-8" />
                            <div className="w-20 h-20 bg-blue-500 rounded-full mx-auto flex items-center justify-center text-3xl shadow-2xl shadow-blue-200 mb-6 font-bold text-white">
                                <FiSave />
                            </div>
                            <h2 className="text-2xl font-black text-gray-900 text-center leading-tight">Save Progress?</h2>
                            <p className="text-gray-500 text-center font-medium mt-3 px-4">Would you like to save your progress and go back to the modules overview?</p>
                            
                            <div className="grid grid-cols-2 gap-4 mt-10">
                                <button onClick={() => setShowDraftModal(false)}
                                    className="py-5 rounded-[2rem] bg-gray-100 text-gray-900 font-black text-lg active:scale-95 transition-all">
                                    Continue
                                </button>
                                <button onClick={handleSaveDraftAndExit}
                                    className="py-5 rounded-[2rem] bg-blue-600 text-white font-black text-lg shadow-xl shadow-blue-100 active:scale-95 transition-all">
                                    Save & Exit
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showIernModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[100] flex items-end justify-center">
                        <motion.div initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="bg-white w-full rounded-t-[3rem] p-10 pb-12 shadow-2xl relative">
                            <div className="w-16 h-1.5 bg-gray-200 rounded-full mx-auto mb-8" />
                            <div className="w-20 h-20 bg-emerald-500 rounded-full mx-auto flex items-center justify-center text-3xl shadow-2xl shadow-emerald-200 mb-6">🏷️</div>
                            <h2 className="text-3xl font-black text-gray-900 text-center leading-tight">IERN Matched!</h2>
                            <p className="text-gray-500 text-center font-medium mt-3 px-4">We found your official Educational Registry Number.</p>
                            <div className="bg-gray-50 border-2 border-gray-100 rounded-[2rem] p-6 mt-8 text-center">
                                <span className="text-4xl font-black text-emerald-600 tracking-[0.2em]">{fetchedIern}</span>
                            </div>
                            <button onClick={() => setShowIernModal(false)}
                                className="w-full mt-10 py-5 rounded-[2rem] bg-gray-900 text-white font-black text-xl shadow-2xl active:scale-95 transition-all">
                                Confirm &amp; Proceed
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Google Drive Sharing Guide Modal */}
            <AnimatePresence>
                {showGDriveGuide && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden">
                            
                            {/* Header */}
                            <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-6 flex items-center justify-between">
                                <h3 className="text-xl font-black text-white">How to Share with "Anyone"</h3>
                                <button onClick={() => setShowGDriveGuide(false)} className="p-2 hover:bg-blue-700 rounded-full transition-colors">
                                    <FiX className="w-6 h-6 text-white" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-6 space-y-6">
                                {/* Guide Image */}
                                <div className="bg-gray-50 rounded-xl overflow-hidden border-2 border-gray-200">
                                    <img 
                                        src="https://lh3.googleusercontent.com/d/1-_gdU-google-drive-share-guide" 
                                        alt="Google Drive sharing steps"
                                        className="w-full h-auto object-contain bg-white"
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                        }}
                                    />
                                    {/* Fallback if image fails to load */}
                                    <div className="p-8 text-center space-y-4">
                                        <p className="text-sm font-bold text-gray-700">Step-by-step guide:</p>
                                        <ol className="text-left space-y-3 text-sm text-gray-600">
                                            <li className="flex gap-3">
                                                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xs">1</span>
                                                <span>Open your file in Google Drive</span>
                                            </li>
                                            <li className="flex gap-3">
                                                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xs">2</span>
                                                <span>Click the <strong>Share</strong> button (top right)</span>
                                            </li>
                                            <li className="flex gap-3">
                                                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xs">3</span>
                                                <span>Change from "Restricted" to <strong>"Anyone"</strong></span>
                                            </li>
                                            <li className="flex gap-3">
                                                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xs">4</span>
                                                <span>Make sure the access level is set to <strong>"Viewer"</strong></span>
                                            </li>
                                            <li className="flex gap-3">
                                                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xs">5</span>
                                                <span>Copy the share link and paste it here</span>
                                            </li>
                                        </ol>
                                    </div>
                                </div>

                                {/* Warning Box */}
                                <div className="p-4 bg-amber-50 border-l-4 border-amber-400 rounded">
                                    <p className="text-sm font-bold text-amber-900">⚠️ Important:</p>
                                    <p className="text-xs text-amber-800 mt-1">Make sure to select <strong>"Anyone with the link"</strong> not "Restricted" or "Specific people"</p>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="bg-gray-50 p-4 border-t border-gray-200">
                                <button 
                                    onClick={() => setShowGDriveGuide(false)}
                                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors"
                                >
                                    Got it! 👍
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {/* Fullscreen PDF Modal */}
                {showFullscreenPdf && formData.google_drive_file_id && (
                    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="w-full h-full max-w-5xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                        >
                            {/* Header */}
                            <div className="bg-emerald-600 p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">📄</span>
                                    <div>
                                        <h3 className="text-white font-bold">{formData.google_drive_file_name}</h3>
                                        <p className="text-emerald-100 text-xs">Fullscreen View</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowFullscreenPdf(false)}
                                    className="text-white hover:bg-emerald-700 p-2 rounded-lg transition-colors"
                                    title="Close"
                                >
                                    <FiX className="w-6 h-6" />
                                </button>
                            </div>

                            {/* PDF Viewer */}
                            <div className="flex-1 overflow-hidden">
                                <iframe
                                    src={`https://drive.google.com/file/d/${formData.google_drive_file_id}/preview`}
                                    loading="lazy"
                                    className="w-full h-full border-0"
                                    allowFullScreen
                                    referrerPolicy="no-referrer"
                                    title="Full document preview"
                                />
                            </div>

                            {/* Footer */}
                            <div className="bg-gray-50 border-t border-gray-200 p-4 flex items-center justify-between gap-3">
                                <a
                                    href={formData.google_drive_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors"
                                >
                                    Open in Google Drive
                                </a>
                                <button
                                    type="button"
                                    onClick={() => setShowFullscreenPdf(false)}
                                    className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 text-sm font-bold rounded-lg transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            <HistoricalDataModal
                show={showHistoryModal}
                onClose={() => setShowHistoryModal(false)}
                loading={historicalLoading}
                data={historicalData}
                unitKey="unit1"
                onCopy={() => handleCopyHistoricalData(copyUnit1)}
            />

            {/* Identity Shift Confirmation Modal */}
            <AnimatePresence>
                {showShiftModal && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 sm:p-0">
                        <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            exit={{ opacity: 0 }}
                            onClick={() => !isShifting && setShowShiftModal(false)}
                            className="absolute inset-0 bg-slate-900/90 backdrop-blur-md"
                        />
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-white rounded-[3rem] w-full max-w-lg overflow-hidden shadow-2xl relative"
                        >
                            <div className="p-10 text-center">
                                <div className="w-24 h-24 bg-rose-50 text-rose-600 rounded-[2.5rem] flex items-center justify-center text-5xl mx-auto mb-8 animate-bounce">⚠️</div>
                                <h3 className="text-3xl font-black text-slate-950 mb-4 leading-tight">Proceed with identity shift?</h3>
                                <p className="text-slate-500 font-bold leading-relaxed mb-8 px-6">
                                    This action will move your account and all existing data to School ID <span className="text-indigo-600">{formData.school_id}</span>. 
                                    The previous ID <span className="text-slate-400 line-through">{initialSchoolId}</span> will be permanently archived. 
                                </p>

                                <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-6 mb-10 text-left">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                                        <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Permanent Changes</p>
                                    </div>
                                    <ul className="space-y-3 text-sm font-bold text-slate-700">
                                        <li className="flex items-center gap-3">
                                            <FiCheck className="text-emerald-500 flex-shrink-0" />
                                            Update user registration to {formData.school_id}
                                        </li>
                                        <li className="flex items-center gap-3">
                                            <FiCheck className="text-emerald-500 flex-shrink-0" />
                                            Re-key all local drafts and outbox entries
                                        </li>
                                        <li className="flex items-center gap-3">
                                            <FiCheck className="text-emerald-500 flex-shrink-0" />
                                            Archive legacy school ID in master registry
                                        </li>
                                    </ul>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <button 
                                        disabled={isShifting}
                                        onClick={handleIdentityShift}
                                        className="w-full py-6 bg-slate-950 text-white rounded-[2rem] font-black text-lg shadow-xl shadow-slate-900/20 flex items-center justify-center gap-3 hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {isShifting ? (
                                            <>
                                                <FiRefreshCw className="animate-spin w-6 h-6" />
                                                Processing Shift...
                                            </>
                                        ) : (
                                            <>Shift School Identity Now</>
                                        )}
                                    </button>
                                    <button 
                                        disabled={isShifting}
                                        onClick={() => setShowShiftModal(false)}
                                        className="w-full py-4 text-slate-400 font-black text-sm uppercase tracking-widest hover:text-slate-600 transition-colors"
                                    >
                                        Cancel and Go Back
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Fixed bottom Unlock button for Review Mode */}
            {!propReadOnly && isReviewMode && (
                <div className="fixed bottom-0 left-0 w-full p-6 pb-10 bg-white/80 backdrop-blur-md border-t border-slate-100 flex justify-center z-[60]">
                    <div className="w-full max-w-sm flex gap-3 pointer-events-auto">
                        <button
                            onClick={() => { setIsReviewMode(false); setCurrentStep(0); }}
                            className="flex-1 py-5 rounded-[2rem] bg-indigo-600 text-white font-black text-xl shadow-xl shadow-indigo-100/50 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-3"
                        >
                            <FiUnlock className="w-6 h-6" />
                            <span>Unlock to Edit Profile</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Unit1SchoolIdentity;
