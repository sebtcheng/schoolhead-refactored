import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiX, FiCheckCircle, FiEdit2, FiCheck, FiArrowRight, FiArrowLeft, FiChevronLeft, FiPlus, FiTrash2, FiMapPin, FiSave, FiSearch, FiChevronDown, FiUnlock, FiAlertTriangle, FiClock, FiAlertOctagon, FiCloudLightning, FiTrendingUp, FiWifiOff, FiCopy } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import SuccessModal from "../SuccessModal";
import { saveUnitDraft, getUnitDraft, clearUnitDraft, addModularToOutbox, getModularOutbox } from "../../db";
import { useAuth } from "../../context/AuthContext";
import UnitRemarkAlert from "./UnitRemarkAlert";
import { MapContainer, TileLayer, Marker, Popup, Rectangle, Polygon, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { api } from "../../lib/api";
import { useHistoricalData } from "../../hooks/useHistoricalData";
import { HistoricalDataModal } from "./HistoricalDataModal";

// Fix for default marker icon in react-leaflet using unpkg to bypass rollup bundle errors
const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// --- Grade Level Utilities ---
// Split ONLY on semicolons. Commas are legal inside grade labels (e.g. "Grade 1, 2 & 3").
const parseGradeLevel = (raw) =>
    (raw || "").split(';').map(s => s.trim()).filter(Boolean);

/**
 * normalizeGradeLevel — converts legacy comma-delimited grade strings to semicolon-delimited,
 * using greedy longest-label matching so composite labels ("Grade 1, 2 & 3") survive intact.
 *
 * If the stored value already contains semicolons it is considered modern and only trimmed.
 * If it contains no semicolons (legacy), a greedy pass against knownLabels extracts tokens.
 */
const normalizeGradeLevel = (raw, knownLabels = []) => {
    if (!raw) return '';
    if (raw.includes(';')) {
        // Already semicolon-delimited — just clean whitespace
        return raw.split(';').map(s => s.trim()).filter(Boolean).join(';');
    }
    // Legacy comma path: attempt greedy longest-match against known labels
    const sorted = [...knownLabels].sort((a, b) => b.length - a.length);
    let remaining = raw.trim();
    const found = [];
    while (remaining.length > 0) {
        remaining = remaining.trim().replace(/^,+/, '').trim(); // strip leading commas
        if (!remaining) break;
        const match = sorted.find(lbl => remaining.startsWith(lbl));
        if (match) {
            found.push(match);
            remaining = remaining.slice(match.length).trim().replace(/^,+/, '').trim();
        } else {
            // No label matched — consume up to the next comma as a fallback token
            const idx = remaining.indexOf(',');
            if (idx === -1) { found.push(remaining.trim()); break; }
            const token = remaining.slice(0, idx).trim();
            if (token) found.push(token);
            remaining = remaining.slice(idx + 1);
        }
    }
    return [...new Set(found)].join(';');
};

const DEBUG_UNIT7_GRADES = false;
const logGradeState = (roomId, rawValue) => {
    if (!DEBUG_UNIT7_GRADES) return;
    const parsed = parseGradeLevel(rawValue);
    console.log(`[Unit7-Grade-Debug] Room: ${roomId} | Raw: "${rawValue}" | Parsed:`, parsed);
    if (new Set(parsed).size !== parsed.length) {
        console.warn(`[Unit7-Grade-Debug] DUPLICATES DETECTED in Room ${roomId}!`);
    }
};

// Helper: fly/zoom to school coordinates when they load
const RecenterMap = ({ center }) => {
    const map = useMap();
    useEffect(() => {
        if (center && center[0] && center[1]) {
            map.flyTo(center, 19, { duration: 1.5 });
        }
    }, [center, map]);
    return null;
};

// Helper: Calculate corner points for a rotated rectangle centered at (lat, lng)
const calculateRotatedPolygon = (lat, lng, length, width, rotation) => {
    if (!lat || !lng) return null;
    const toRad = Math.PI / 180;
    const rotRad = rotation * toRad;
    const latMeters = 111320; // Approx meters per degree latitude
    const lngMeters = 111320 * Math.cos(lat * toRad);

    const halfL = length / 2;
    const halfW = width / 2;

    const corners = [
        { x: -halfW, y: halfL },  // Top-left
        { x: halfW, y: halfL },   // Top-right
        { x: halfW, y: -halfL },  // Bottom-right
        { x: -halfW, y: -halfL }  // Bottom-left
    ];

    return corners.map(c => {
        const rotX = c.x * Math.cos(rotRad) - c.y * Math.sin(rotRad);
        const rotY = c.x * Math.sin(rotRad) + c.y * Math.cos(rotRad);
        return [
            lat + (rotY / latMeters),
            lng + (rotX / lngMeters)
        ];
    });
};

// ── Constants ──────────────────────────────────────────────────────────
const DEFAULT_BUILDING_TYPES = [
    "Academic Building",
    "Laboratory Building",
    "Administrative Building",
    "Multi-Purpose Building",
    "Covered Court",
    "Canteen/Feeding Center",
    "Clinic",
    "Library",
    "Comfort Room (CR) Building",
    "Storage Building",
    "Teacher's Cottage",
    "Security/Guard House",
    "Gymnasium"
];

export default function Unit7PhysicalFacilities({ targetSchoolId, isReadOnly: propReadOnly }) {
    const { user } = useAuth();
    const navigate = useNavigate();

    // ── Global State ─────────────────────────────────────────────────────────
    const [schoolId, setSchoolId] = useState("");
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showOfflineSuccess, setShowOfflineSuccess] = useState(false);
    const [showWelcomeBack, setShowWelcomeBack] = useState(false);
    const [isCertified, setIsCertified] = useState(false);
    const [showDraftModal, setShowDraftModal] = useState(false);
    const [schoolData, setSchoolData] = useState(null);
    const [hasNoBuilding, setHasNoBuilding] = useState(false); 
    const [savedData, setSavedData] = useState(null);
    const [currentPage, setCurrentPage] = useState(1); // 1-5 Wizard Stages
    const [buildingTypes, setBuildingTypes] = useState(() => {
        const cached = localStorage.getItem("nsbi_building_types");
        return cached ? JSON.parse(cached) : DEFAULT_BUILDING_TYPES;
    });
    const [isBuildingDropdownOpen, setIsBuildingDropdownOpen] = useState(false);
    const [buildingSearch, setBuildingSearch] = useState("");
    const [expandedBuildings, setExpandedBuildings] = useState({});
    const [expandedRepairBuildings, setExpandedRepairBuildings] = useState({});

    // Teacher selection for advisory
    const [teachers, setTeachers] = useState([]);

    const {
        showHistoryModal,
        setShowHistoryModal,
        historicalData,
        historicalLoading,
        handleOpenHistoryModal,
        handleCopyHistoricalData,
    } = useHistoricalData("unit7", user, targetSchoolId);

    const copyUnit7 = (d) => {
        setHasNoBuilding(d.has_no_building || false);

        if (d.inventory) {
            const allRooms = [];
            const normalizedInventory = (d.inventory || []).map((b, idx) => ({
                ...b,
                id: b.id || `bldg-${idx}`,
                classroom: (b.rooms && b.rooms.length > 0) ? b.rooms.length.toString() : (b.classroom || "0"),
                storey: b.storey || 1
            }));
            setBuildings(normalizedInventory);
            
            normalizedInventory.forEach(b => {
                if (b.rooms && Array.isArray(b.rooms)) {
                    b.rooms.forEach(r => {
                        allRooms.push({
                            id: r.id,
                            building_local_id: b.id,
                            building_name: b.building_name,
                            room_name: r.room_name,
                            grade_level: r.grade_level,
                            advisory_teacher: r.advisory_teacher,
                            room_length: r.room_length,
                            room_width: r.room_width,
                            dimension: r.dimension || r.dimensions || '',
                            status: r.status || r.condition || '',
                            seats: r.seats || '',
                            is_in_use: r.is_in_use !== false
                        });
                    });
                }
            });
            setRoomsData(allRooms);
        }

        if (d.repairs) {
            const repairsArray = Array.isArray(d.repairs) ? d.repairs : [];
            const assessments = repairsArray.map(r => ({
                id: r.id, 
                roomId: r.building_name + '-' + (r.room_name || r.room_no || 'Room'),
                building_name: r.building_name, 
                room_name: r.room_name || r.room_no,
                item: r.item_name || 'Repair', 
                oms: r.oms, 
                status: r.status || r.condition,
                condition: r.status || r.condition,
                damage_ratio: r.damage_ratio, 
                recommend_action: r.recommended_action,
                demo_justification: r.demo_justification, 
                remarks: r.remarks
            }));
            setRepairAssessments(assessments);
            if (assessments.length > 0) setHasRepair(true);
        }

        if (d.spaces) {
            setSpaces(d.spaces);
        }
    };


    // Map & Space State
    const [spaces, setSpaces] = useState([]);
    const [centerMap, setCenterMap] = useState([14.5995, 120.9842]); // Default Manila
    const [isFormVisible, setIsFormVisible] = useState(false);

    // New space form
    const [newSpace, setNewSpace] = useState({
        space_name: "New Building Area",
        center_lat: null,
        center_lng: null,
        length_m: 10,
        width_m: 10,
        rotation_deg: 0
    });

    const totalAreaSqm = (newSpace.length_m || 0) * (newSpace.width_m || 0);

    // ── Phase 2: Building Inventory State ────────────────────────────────────
    const [buildings, setBuildings] = useState([]);
    const [showBuildingModal, setShowBuildingModal] = useState(false);

    const currentYear = new Date().getFullYear();
    const [buildingFormData, setBuildingFormData] = useState({
        building_name: "",
        category: "Academic Building",
        storey: "",
        classroom: "",
        year_completed: currentYear,
        remarks: "",
        status: "Good Condition",
        condemn_age: false,
        condemn_hazard: false,
        condemn_calamity: false,
        condemn_upgrade: false
    });

    const REPAIR_CATEGORIES = [
        'Roofing', 'Purlins', 'Trusses', 'Ceiling (Exterior)', 'Ceiling (Interior)',
        'Wall (Exterior)', 'Partition', 'Door', 'Windows', 'Flooring', 'Beams / Columns'
    ];

    const [hasRepair, setHasRepair] = useState(null);
    const [repairAssessments, setRepairAssessments] = useState([]);
    const [showRepairModal, setShowRepairModal] = useState(false);
    const [validationStatus, setValidationStatus] = useState("");
    const [validationRemarks, setValidationRemarks] = useState("");
    const [activeBuildingId, setActiveBuildingId] = useState(null);
    const [hasJustSaved, setHasJustSaved] = useState(false);
    const [showNoSpaceConfirm, setShowNoSpaceConfirm] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [confirmNoSpace, setConfirmNoSpace] = useState(false);
    const [validationModal, setValidationModal] = useState(null);

    const [repairRoomFormData, setRepairRoomFormData] = useState({
        building_name: "",
        room_name: "",
        room_length: 9,
        room_width: 7
    });

    const [repairItemsState, setRepairItemsState] = useState({});


    // Integrated Rooms State
    const [roomsData, setRoomsData] = useState([]);

    const [editingBuildingId, setEditingBuildingId] = useState(null);
    const [editingRepairRoomId, setEditingRepairRoomId] = useState(null);
    const editingRepairRoom = repairRoomFormData; // Derived for UI consistency
    const [availableGrades, setAvailableGrades] = useState([]);

    const years = Array.from({ length: currentYear - 1900 + 1 }, (_, i) => currentYear - i);

    // Normalize grade_level values in roomsData whenever availableGrades loads.
    // This repairs legacy comma-delimited entries and multigrade labels that were
    // incorrectly split (e.g. "Grade 1, 2 & 3" stored without semicolons).
    useEffect(() => {
        if (availableGrades.length === 0) return;
        const knownLabels = availableGrades.map(g => g.label);
        setRoomsData(prev => {
            let changed = false;
            const next = prev.map(r => {
                const normalized = normalizeGradeLevel(r.grade_level, knownLabels);
                if (normalized === (r.grade_level || '')) return r;
                changed = true;
                return { ...r, grade_level: normalized };
            });
            return changed ? next : prev; // avoid re-render if nothing changed
        });
    }, [availableGrades]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Data Fetching ─────────────────────────────────────────────────────
    const [isReadOnly, setIsReadOnly] = useState(propReadOnly || false);
    const allBuildings = buildings;
    const isAuditIncomplete = !hasNoBuilding && roomsData.some(r => !r.dimension || !r.status);
    const hasCheckedCompletion = React.useRef(false);

    useEffect(() => {
        if (propReadOnly !== undefined) {
            setIsReadOnly(propReadOnly);
        }
    }, [propReadOnly]);

    useEffect(() => {
        const init = async () => {
            const storedId = targetSchoolId || localStorage.getItem("schoolId");
            if (!storedId) return;
            setSchoolId(storedId);

            try {
                // 1. GATHER ALL LOCAL SOURCES
                const outbox = await getModularOutbox().catch(() => []);
                const pendingUnit1 = outbox.find(e => e.unitId === 1 && (e.schoolId === storedId || e.payload?.schoolId === storedId || e.payload?.school_id === storedId));
                const pendingUnit2 = outbox.find(e => e.unitId === 2 && (e.schoolId === storedId || e.payload?.schoolId === storedId || e.payload?.school_id === storedId));
                const pendingUnit3 = outbox.find(e => e.unitId === 3 && (e.schoolId === storedId || e.payload?.schoolId === storedId || e.payload?.school_id === storedId));
                const pendingUnit7 = outbox.find(e => e.unitId === 7 && (e.schoolId === storedId || e.payload?.schoolId === storedId || e.payload?.school_id === storedId));
                const draft = await getUnitDraft(7, storedId);

                // 2. RECONSTRUCT SCHOOL BASELINE
                let baseline = { iern: "", curricular_offering: "", latitude: 14.5995, longitude: 120.9842 };
                try {
                    const res = await fetch(api(`/api/ph_schools/unit7/${storedId}`));
                    if (res.ok) {
                        const profile = await res.json();
                        const activeData = profile.payload ? profile.payload : (profile.data ? profile.data : profile);
                        if (profile.validation_status) {
                            setValidationStatus(profile.validation_status);
                            if (profile.validation_status === 'submitted' || profile.validation_status === 'validated') {
                                setIsReadOnly(true);
                            }
                        }
                        if (profile.validation_remarks) {
                            setValidationRemarks(profile.validation_remarks);
                        }
                        if (profile.is_completed !== undefined) {
                            setIsCertified(profile.is_completed);
                        }
                        if (activeData) baseline = { ...baseline, ...activeData };
                    }
                } catch (e) { console.log("📍 [Unit7] Offline: Using local sources for baseline."); }

                // Overlay Unit 1 Sync Center Data
                if (pendingUnit1) baseline.curricular_offering = pendingUnit1.payload?.curricular_offering || baseline.curricular_offering;

                // Overlay Unit 2 Sync Center Data
                if (pendingUnit2) {
                    baseline.unit2_simplified_enrollment = pendingUnit2.payload?.unit2_simplified_enrollment;
                    baseline.total_enrollment = pendingUnit2.payload?.total_enrollment || baseline.total_enrollment;

                    // Also multigrade groupings
                    baseline.multigrade_groupings_1 = pendingUnit2.payload?.multigrade_groupings_1;
                    baseline.multigrade_groupings_2 = pendingUnit2.payload?.multigrade_groupings_2;
                    baseline.multigrade_groupings_3 = pendingUnit2.payload?.multigrade_groupings_3;

                    baseline.multigrade_enrollment_1 = pendingUnit2.payload?.multigrade_enrollment_1;
                    baseline.multigrade_enrollment_2 = pendingUnit2.payload?.multigrade_enrollment_2;
                    baseline.multigrade_enrollment_3 = pendingUnit2.payload?.multigrade_enrollment_3;
                }

                setSchoolData(baseline);
                setConfirmNoSpace(baseline.u7_confirm_no_space || false);
                if (baseline.latitude && baseline.longitude) {
                    setCenterMap([parseFloat(baseline.latitude), parseFloat(baseline.longitude)]);
                }

                // 3. RECONSTRUCT AVAILABLE GRADES
                const co = (baseline.curricular_offering || "").toLowerCase();
                const hasKinder = co.includes("elementary") || co.includes("k to 10") || co.includes("k to 12") || co.includes("kinder");
                const hasElem = co.includes("elementary") || co.includes("k to 10") || co.includes("k to 12");
                const hasJHS = co.includes("junior high") || co.includes("jhs") || co.includes("k to 10") || co.includes("k to 12");
                const hasSHS = co.includes("senior high") || co.includes("shs") || co.includes("k to 12");

                let u2Parsed = [];
                if (baseline.unit2_simplified_enrollment) {
                    try {
                        const raw = typeof baseline.unit2_simplified_enrollment === 'string' ? JSON.parse(baseline.unit2_simplified_enrollment) : baseline.unit2_simplified_enrollment;
                        u2Parsed = Array.isArray(raw) ? raw : (raw.array || []);
                    } catch (e) { console.warn("U2 Parse Error", e); }
                }

                const detectedGrades = [];
                const ALL_POSSIBLE = [
                    { id: "kinder", label: "Kinder" },
                    ...['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map(lvl => ({ id: `g${lvl}`, label: `Grade ${lvl}` }))
                ];

                ALL_POSSIBLE.forEach(pg => {
                    let isOffered = false;
                    const nid = pg.id.replace('g', '');
                    if (pg.id === 'kinder') isOffered = hasKinder;
                    else if (['1', '2', '3', '4', '5', '6'].includes(nid)) isOffered = hasElem;
                    else if (['7', '8', '9', '10'].includes(nid)) isOffered = hasJHS;
                    else if (['11', '12'].includes(nid)) isOffered = hasSHS;

                    const u2Entry = u2Parsed.find(x => x.grade_level === pg.id);
                    const isActive = u2Entry ? u2Entry.is_active !== false : (isOffered || (!hasKinder && !hasElem && !hasJHS && !hasSHS));
                    if (isActive) {
                        detectedGrades.push({ id: pg.id, label: pg.label, isMultigrade: false });
                    }
                });

                const mgGroups = [];
                for (let i = 1; i <= 3; i++) {
                    const groupName = baseline[`multigrade_groupings_${i}`];
                    if (groupName) mgGroups.push({ id: `mg_${i}`, label: groupName, isMultigrade: true });
                }

                // 3. Filter out monogrades that are part of a MG group
                const mgGradeNumbers = new Set();
                mgGroups.forEach(mg => {
                    const digits = mg.label.match(/\d+/g);
                    if (digits) digits.forEach(d => mgGradeNumbers.add(d));
                });

                const filteredMonogrades = detectedGrades.filter(dg => {
                    const digit = dg.id.replace(/\D/g, '');
                    if (!digit) return true; // Keep Kinder or others without digits unless strictly needed
                    return !mgGradeNumbers.has(digit);
                });

                const snedGrades = [];
                // Use baseline (ph_schools) or Unit 2 counts (if available)
                if (baseline.hasSnedSelfContained || (baseline.unit2_simplified_enrollment && (typeof baseline.unit2_simplified_enrollment === 'string' ? baseline.unit2_simplified_enrollment.includes('sned') : JSON.stringify(baseline.unit2_simplified_enrollment).includes('sned')))) {
                    snedGrades.push({ id: "sned_self_contained", label: "SNED (Self-contained)", isMultigrade: false });
                }

                setAvailableGrades([...filteredMonogrades, ...mgGroups, ...snedGrades]);


                // Initial completion check - only run once on mount
                let isUnitCompleted = false;
                if (!hasCheckedCompletion.current) {
                    const storedProgress = localStorage.getItem('quest_progress');
                    const progress = storedProgress ? JSON.parse(storedProgress) : null;
                    isUnitCompleted = progress?.completedUnits?.includes(7);

                    if (isUnitCompleted && !propReadOnly && !isReadOnly) {
                        setIsReadOnly(true);
                    }
                    hasCheckedCompletion.current = true;
                }

                // 4. RESTORE UNIT 7 DATA
                const effectiveReadOnly = propReadOnly || isReadOnly || isUnitCompleted || (!!pendingUnit7);
                if (pendingUnit7) {
                    setBuildings(pendingUnit7.payload?.inventoryEntries || []);
                    setRoomsData(pendingUnit7.payload?.rooms || []);
                    setRepairAssessments(pendingUnit7.payload?.repairEntries || []);
                    setSpaces(pendingUnit7.payload?.spaces || []);
                    setHasRepair(pendingUnit7.payload?.repairEntries?.length > 0);
                    setSavedData(pendingUnit7.payload);
                    setIsReadOnly(true);
                } else if (effectiveReadOnly) {
                    fetchMasterData(storedId);
                } else if (draft) {
                    setCurrentPage(draft.currentPage || 1);
                    setBuildings(draft.buildings || []);
                    setRoomsData(draft.roomsData || []);
                    setRepairAssessments(draft.repairAssessments || []);
                    setSpaces(draft.spaces || []);
                    setHasRepair(draft.hasRepair);
                    setHasNoBuilding(draft.hasNoBuilding || false);
                    setIsReadOnly(propReadOnly || false);
                    setShowWelcomeBack(true);
                    setTimeout(() => setShowWelcomeBack(false), 3000);
                } else {
                    fetchMasterData(storedId);
                }

                fetchSpaces(storedId);
                fetchBuildingTypes();
                fetchTeachers(storedId);
            } catch (e) {
                console.warn("Could not fetch Unit 7 data", e);
            }
        };
        init();
    }, [targetSchoolId]);

    const fetchMasterData = async (id) => {
        try {
            const res = await fetch(api(`/ph_schools/unit7/${id}/master`));
            if (res.ok) {
                const json = await res.json();
                const activeData = json.payload ? json.payload : (json.data ? json.data : json);
                if (json.validation_status) {
                    setValidationStatus(json.validation_status);
                    if (json.validation_status === 'submitted' || json.validation_status === 'validated') {
                        setIsReadOnly(true);
                    }
                }
                if (json.validation_remarks) {
                    setValidationRemarks(json.validation_remarks);
                }
                if (json.is_completed !== undefined) {
                    setIsCertified(json.is_completed);
                }
                if (activeData) {
                    const inventory = activeData.buildings || activeData.inventory || [];
                    const repairs = activeData.repairRooms || activeData.repairs || [];
                    const has_no_building = activeData.has_no_building;
                    const allRooms = [];
                    const normalizedInventory = (inventory || []).map((b, idx) => ({
                        ...b,
                        id: b.id || `bldg-${idx}`,
                        classroom: (b.rooms && b.rooms.length > 0) ? b.rooms.length.toString() : (b.classroom || "0"),
                        storey: b.storey || 1
                    }));
                    setBuildings(normalizedInventory);
                    setHasNoBuilding(has_no_building || false);
                    
                    normalizedInventory.forEach(b => {
                        if (b.rooms && Array.isArray(b.rooms)) {
                            b.rooms.forEach(r => {
                                allRooms.push({
                                    id: r.id,
                                    building_local_id: b.id, // Correctly link to the generated or existing ID
                                    building_name: b.building_name,
                                    room_name: r.room_name,
                                    grade_level: r.grade_level,
                                    advisory_teacher: r.advisory_teacher,
                                    room_length: r.room_length,
                                    room_width: r.room_width,
                                    dimension: r.dimension || r.dimensions || '',
                                    status: r.status || r.condition || '',
                                    seats: r.seats || '',
                                    is_in_use: r.is_in_use !== false
                                });
                            });
                        }
                    });
                    setRoomsData(allRooms);
                    const repairsArray = Array.isArray(repairs) ? repairs : [];
                    const assessments = repairsArray.map(r => ({
                        id: r.id, 
                        roomId: r.building_name + '-' + (r.room_name || r.room_no || 'Room'),
                        building_name: r.building_name, 
                        room_name: r.room_name || r.room_no,
                        item: r.item_name || 'Repair', 
                        oms: r.oms, 
                        status: r.status || r.condition,
                        condition: r.status || r.condition,
                        damage_ratio: r.damage_ratio, 
                        recommend_action: r.recommended_action,
                        demo_justification: r.demo_justification, 
                        remarks: r.remarks
                    }));
                    setRepairAssessments(assessments);
                    if (assessments.length > 0) setHasRepair(true);
                    setIsReadOnly(isCompleted || propReadOnly);
                }
            }
        } catch (e) { console.warn("Error fetching master data:", e); }
    };



    const fetchBuildingTypes = async () => {
        try {
            const res = await fetch(api(`/reference/building-types`));
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    setBuildingTypes(data);
                    localStorage.setItem("nsbi_building_types", JSON.stringify(data));
                }
            }
        } catch (e) {
            console.warn("Could not fetch building types", e);
        }
    };

    const fetchTeachers = async (id) => {
        try {
            const res = await fetch(api(`/unit8/teachers/${id}`));
            if (res.ok) {
                const json = await res.json();
                if (json.success) {
                    setTeachers(json.teachers);
                }
            }
        } catch (e) {
            console.warn("Could not fetch teachers", e);
        }
    };

    const fetchSpaces = async (id) => {
        try {
            const res = await fetch(api(`/ph_schools/unit7/${id}/spaces`));
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    setSpaces(data.spaces);
                }
            }
        } catch (e) {
            console.warn("Error fetching spaces:", e);
        }
    };

    // ── Map Click Event Handler ───────────────────────────────────────────
    const MapClickHandler = () => {
        useMapEvents({
            click(e) {
                if (isFormVisible) {
                    setNewSpace(prev => ({
                        ...prev,
                        center_lat: e.latlng.lat,
                        center_lng: e.latlng.lng
                    }));
                }
            },
        });
        return null;
    };

    // ── Calculation Utilities ──────────────────────────────────────────────
    const calculateRotatedPolygon = (lat, lng, lengthM, widthM, rotationDeg = 0) => {
        if (!lat || !lng || !lengthM || !widthM) return null;

        const rotationRad = (rotationDeg * Math.PI) / 180;

        // Meters per degree approximations
        const metersPerLat = 111320;
        const metersPerLng = 111320 * Math.cos(lat * Math.PI / 180);

        // Relative corners in meters (Before rotation)
        const corners = [
            { y: lengthM / 2, x: -widthM / 2 }, // Top-Left
            { y: lengthM / 2, x: widthM / 2 },  // Top-Right
            { y: -lengthM / 2, x: widthM / 2 }, // Bottom-Right
            { y: -lengthM / 2, x: -widthM / 2 } // Bottom-Left
        ];

        // Rotate and convert to Lat/Lng
        return corners.map(c => {
            const rotatedY = c.y * Math.cos(rotationRad) - c.x * Math.sin(rotationRad);
            const rotatedX = c.y * Math.sin(rotationRad) + c.x * Math.cos(rotationRad);

            return [
                lat + (rotatedY / metersPerLat),
                lng + (rotatedX / metersPerLng)
            ];
        });
    };

    const calculateBounds = (lat, lng, lengthM, widthM) => {
        if (!lat || !lng || !lengthM || !widthM) return null;

        // 1 degree lat = ~111.32 km
        const latDiff = (lengthM / 2) / 111320;
        // 1 degree lng = ~111.32 km * cos(lat)
        const lngDiff = (widthM / 2) / (111320 * Math.cos(lat * Math.PI / 180));

        return [
            [lat - latDiff, lng - lngDiff], // South-West
            [lat + latDiff, lng + lngDiff]  // North-East
        ];
    };

    // ── Saving / Deleting ──────────────────────────────────────────────────
    const handleSaveSpace = async () => {
        const isDuplicateSpace = spaces.some(
            s => (s.space_name || "").trim().toLowerCase() === (newSpace.space_name || "").trim().toLowerCase()
        );
        if (isDuplicateSpace) {
            alert("A space with this name already exists. Please use a unique name.");
            return;
        }

        if (!newSpace.center_lat || !newSpace.center_lng) {
            alert("Please tap on the map to place the center pin.");
            return;
        }

        try {
            setLoading(true);
            const payload = {
                school_yr: "SY 26-27",
                ...newSpace,
                total_area_sqm: totalAreaSqm,
                iern: schoolData?.iern || null,
            };

            const res = await fetch(api(`/api/ph_schools/unit7/${schoolId}/spaces`), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error("Failed to save space");
            const resJson = await res.json();

            // Update Progress locally if this is the first interaction that completes unit 10
            const stored = localStorage.getItem('quest_progress');
            let progress = stored ? JSON.parse(stored) : { completedUnits: [], xp: 0 };
            if (!progress.completedUnits.includes(7)) {
                progress.completedUnits.push(7);
                progress.xp += 300;
                localStorage.setItem('quest_progress', JSON.stringify(progress));
            }

            await fetchSpaces(schoolId);
            setIsFormVisible(false);
            setNewSpace({
                space_name: "New Building Area",
                center_lat: null, center_lng: null,
                length_m: 10, width_m: 10,
                rotation_deg: 0
            });
        } catch (err) {
            console.error("Submission failed", err);
            alert("Failed to save space.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (spaceId) => {
        if (!window.confirm("Delete this space?")) return;
        try {
            const res = await fetch(api(`/api/ph_schools/unit7/spaces/${spaceId}`), { method: "DELETE" });
            if (res.ok) {
                setSpaces(spaces.filter(s => s.id !== spaceId));
            }
        } catch (e) {
            console.error(e);
        }
    };

    // ── Phase 2 Handlers ──────────────────────────────────────────────────
    const handleSaveBuilding = () => {
        const isDuplicateBuilding = buildings.some(
            b => b.id !== editingBuildingId &&
                (b.building_name || "").trim().toLowerCase() === (buildingFormData.building_name || "").trim().toLowerCase()
        );
        if (isDuplicateBuilding) {
            alert("A building with this name already exists. Please use a unique name.");
            return;
        }

        if (!buildingFormData.building_name) {
            alert("Please enter a building name.");
            return;
        }

        const statusLower = (buildingFormData.status || "").toLowerCase();
        const isBuildingCondemned = statusLower === 'for condemnation' || statusLower === 'condemned';
        const isBuildingRepair = statusLower === 'for major repairs' || statusLower === 'for minor repairs';
        const isBuildingGood = statusLower === 'good condition' || statusLower === 'newly built';

        if (isBuildingCondemned) {
            const hasReason = buildingFormData.condemn_age || buildingFormData.condemn_hazard || buildingFormData.condemn_calamity || buildingFormData.condemn_upgrade;
            if (!hasReason) {
                alert("Please select at least one justification for condemnation.");
                return;
            }
        }

        const bId = editingBuildingId || Date.now().toString();
        
        // Safety: If editing, try to get the current room count if the form field is empty
        let currentRoomCount = parseInt(buildingFormData.classroom);
        if (editingBuildingId && isNaN(currentRoomCount)) {
            currentRoomCount = roomsData.filter(r => r.building_local_id === editingBuildingId).length;
        }
        
        const numClassrooms = currentRoomCount || 1;
        const numStoreys = parseInt(buildingFormData.storey) || 1;

        let finalRooms = [];

        // Smart Room Generation/Preservation
        if (editingBuildingId) {
            // Smart Room Adjustment: Add or remove based on difference
            const existingRooms = roomsData.filter(r => r.building_local_id === bId);
            const currentCount = existingRooms.length;

            if (currentCount === numClassrooms) {
                // Just update building name/details in existing rooms
                finalRooms = existingRooms.map(r => ({
                    ...r,
                    building_name: buildingFormData.building_name,
                    room_name: r.room_name.startsWith(buildings.find(b => b.id === bId).building_name)
                        ? r.room_name.replace(buildings.find(b => b.id === bId).building_name, buildingFormData.building_name)
                        : r.room_name,
                    // SYNC: Ensure room status reflects building status
                    status: isBuildingCondemned ? buildingFormData.status : 
                               (isBuildingRepair && r.status !== 'Repair' ? 'Repair' : 
                               (isBuildingGood && r.status === 'Repair' ? buildingFormData.status : r.status)),
                    grade_level: isBuildingCondemned ? "Non-Instructional" : r.grade_level,
                    seats: isBuildingCondemned ? "0" : r.seats
                }));
            } else if (numClassrooms > currentCount) {
                // Add new rooms
                const roomsToAdd = numClassrooms - currentCount;
                
                const newRooms = [];
                for (let i = 1; i <= roomsToAdd; i++) {
                    const totalSoFar = currentCount + i;
                    const floor = Math.ceil(totalSoFar / (numClassrooms / numStoreys || 1));
                    const roomLetter = String.fromCharCode(65 + ((totalSoFar - 1) % 10)); // Cycle letters
                    
                    newRooms.push({
                        id: `${bId}-room-${totalSoFar}-${Date.now()}`,
                        building_local_id: bId,
                        building_name: buildingFormData.building_name,
                        room_name: `${buildingFormData.building_name} ${floor}-${roomLetter}`,
                        dimension: "",
                        grade_level: isBuildingCondemned ? "Non-Instructional" : "",
                        teacher_id: "",
                        status: isBuildingCondemned ? buildingFormData.status : "",
                        seats: isBuildingCondemned ? "0" : "",
                        is_in_use: true,
                    });
                }
                finalRooms = [...existingRooms, ...newRooms];
            } else {
                // Remove rooms from the end
                finalRooms = existingRooms.slice(0, numClassrooms);
            }
        } else {
            // Generate new rooms (Initial Creation)
            const roomsPerFloor = Math.ceil(numClassrooms / numStoreys);
            let roomCount = 0;

            for (let floor = 1; floor <= numStoreys; floor++) {
                for (let r = 0; r < roomsPerFloor && roomCount < numClassrooms; r++) {
                    roomCount++;
                    const roomLetter = String.fromCharCode(65 + r);
                    const roomName = `${buildingFormData.building_name} ${floor}-${roomLetter}`;

                    // No local re-definition needed
                    
                    finalRooms.push({
                        id: `${bId}-room-${roomCount}`,
                        building_local_id: bId,
                        building_name: buildingFormData.building_name,
                        room_name: roomName,
                        dimension: "",
                        grade_level: isBuildingCondemned ? "Non-Instructional" : "",
                        teacher_id: "",
                        status: isBuildingCondemned ? buildingFormData.status : "",
                        seats: isBuildingCondemned ? "0" : "",
                        is_in_use: true,
                    });
                }
            }
        }

        const newEntry = {
            ...buildingFormData,
            classroom: numClassrooms.toString(),
            storey: numStoreys.toString(),
            id: bId
        };

        if (editingBuildingId) {
            setBuildings(buildings.map(b => b.id === editingBuildingId ? newEntry : b));
            setActiveBuildingId(editingBuildingId);
        } else {
            setBuildings([...buildings, newEntry]);
            setActiveBuildingId(bId);
        }

        setRoomsData(prev => [
            ...prev.filter(r => r.building_local_id !== bId),
            ...finalRooms
        ]);

        // Cleanup: Remove repair assessments for rooms that are no longer in 'Repair' condition
        const finalRoomIds = new Set(finalRooms.map(r => r.id));
        const repairRoomNames = new Set(finalRooms.filter(r => r.status === 'Repair').map(r => r.room_name));
        const bName = buildingFormData.building_name;
        
        setRepairAssessments(prev => prev.filter(a => {
            // Keep assessments for OTHER buildings
            if (a.building_name !== bName) return true;
            // For THIS building, only keep if the room still exists AND is still in repair
            return repairRoomNames.has(a.room_name);
        }));

        setShowBuildingModal(false);
        setEditingBuildingId(null);
        setBuildingFormData({
            building_name: "", category: "Academic Building", storey: "", classroom: "",
            year_completed: currentYear, remarks: "", status: "Good Condition",
            condemn_age: false, condemn_hazard: false, condemn_calamity: false, condemn_upgrade: false
        });
        
        // Advance to Room Setup (now Page 4)
        setCurrentPage(4);
    };

    const handleEditBuilding = (b) => {
        // Source of Truth: Count exactly how many rooms exist in the system for this building
        const actualCount = roomsData.filter(r => r.building_local_id === b.id).length;

        setBuildingFormData({
            building_name: b.building_name,
            category: b.category,
            storey: b.storey || "1",
            classroom: actualCount.toString(), // Always use actual count
            year_completed: b.year_completed,
            remarks: b.remarks || "",
            status: b.status || "Good Condition",
            condemn_age: b.condemn_age || false,
            condemn_hazard: b.condemn_hazard || false,
            condemn_calamity: b.condemn_calamity || false,
            condemn_upgrade: b.condemn_upgrade || false
        });
        setEditingBuildingId(b.id);
        setShowBuildingModal(true);
    };

    const handleDeleteBuilding = (bId) => {
        if (!window.confirm("Delete this building and all its rooms?")) return;
        const bName = buildings.find(b => b.id === bId)?.building_name;
        setBuildings(prev => prev.filter(b => b.id !== bId));
        setRoomsData(prev => prev.filter(r => r.building_local_id !== bId));
        if (bName) {
            setRepairAssessments(prev => prev.filter(a => a.building_name !== bName));
        }
    };

    const handleDeleteRoom = (roomId) => {
        if (!window.confirm("Delete this classroom?")) return;
        const room = roomsData.find(r => r.id === roomId);
        const rName = room?.room_name;
        const bName = buildings.find(b => b.id === room?.building_local_id)?.building_name;
        
        setRoomsData(prev => prev.filter(r => r.id !== roomId));
        if (bName && rName) {
            setRepairAssessments(prev => prev.filter(a => !(a.building_name === bName && a.room_name === rName)));
        }
    };

    const handleToggleRepairItem = (category) => {
        setRepairItemsState(prev => {
            if (prev[category]) {
                const newState = { ...prev };
                delete newState[category];
                return newState;
            } else {
                return {
                    ...prev,
                    [category]: {
                        oms: "",
                        condition: "Good",
                        damage_ratio: 0,
                        recommend_action: "Routine Repair",
                        demo_justification: "",
                        remarks: ""
                    }
                };
            }
        });
    };

    const handleUpdateRepairItem = (category, field, value) => {
        setRepairItemsState(prev => ({
            ...prev,
            [category]: {
                ...prev[category],
                [field]: value
            }
        }));
    };

    const handleSaveRepairRoom = () => {
        if (!repairRoomFormData.building_name || !repairRoomFormData.room_name) {
            alert("Please provide building and room names.");
            return;
        }

        const selectedCategories = Object.keys(repairItemsState);
        if (selectedCategories.length === 0) {
            alert("Please select at least one item to assess.");
            return;
        }

        // Flattening Logic: one object per checked category
        const roomId = repairRoomFormData.building_name + "-" + repairRoomFormData.room_name;

        const newAssessments = selectedCategories.map(category => ({
            id: roomId + "-" + category.replace(/\s/g, ''),
            roomId: roomId,
            building_name: repairRoomFormData.building_name,
            room_name: repairRoomFormData.room_name,
            room_length: repairRoomFormData.room_length,
            room_width: repairRoomFormData.room_width,
            item: category,
            ...repairItemsState[category]
        }));

        // Always replace existing items for this room (building_name + room_name)
        setRepairAssessments(prev => [...prev.filter(a => a.roomId !== roomId), ...newAssessments]);

        setShowRepairModal(false);
        setEditingRepairRoomId(null);
        setRepairRoomFormData({
            building_name: "",
            room_name: "",
            room_length: 9,
            room_width: 7
        });
        setRepairItemsState({});
        setTimeout(() => handlePartialSync(), 100);
    };

    const handleEditRepairRoom = (roomGroup) => {
        setRepairRoomFormData({
            building_name: roomGroup.building_name,
            room_name: roomGroup.room_name,
            room_length: roomGroup.room_length,
            room_width: roomGroup.room_width
        });

        const reconstructedState = {};
        roomGroup.items.forEach(itm => {
            reconstructedState[itm.item] = {
                oms: itm.oms || "",
                condition: itm.condition,
                damage_ratio: itm.damage_ratio || 0,
                recommend_action: itm.recommend_action || "Routine Repair",
                demo_justification: itm.demo_justification || "",
                remarks: itm.remarks || ""
            };
        });
        setRepairItemsState(reconstructedState);
        setEditingRepairRoomId(roomGroup.roomId);
        setShowRepairModal(true);
    };

    const handleDeleteRepairRoom = (roomId) => {
        setRepairAssessments(prev => prev.filter(a => a.roomId !== roomId));
    };

    // Helper to group assessments by room for display
    const groupedRepairs = repairAssessments.reduce((acc, curr) => {
        if (!acc[curr.roomId]) {
            acc[curr.roomId] = {
                roomId: curr.roomId,
                building_name: curr.building_name,
                room_name: curr.room_name,
                room_length: curr.room_length,
                room_width: curr.room_width,
                items: []
            };
        }
        acc[curr.roomId].items.push(curr);
        return acc;
    }, {});
    const groupedRepairsArray = Object.values(groupedRepairs);


    const handlePartialSync = async () => {
        try {
            const inventoryPayload = buildings;
            const repairPayload = repairAssessments.map(a => ({
                building_no: a.building_name,
                room_no: a.room_name,
                item_name: a.item,
                oms: a.oms,
                condition: a.condition,
                damage_ratio: a.damage_ratio,
                recommended_action: a.recommend_action,
                demo_justification: a.demo_justification,
                remarks: a.remarks
            }));
            const build_classrooms_total = roomsData.length;

            await fetch(api(`/api/save-physical-facilities`), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    school_yr: "SY 26-27",
                    schoolId: schoolId,
                    school_id: schoolId,
                    iern: schoolData?.iern,
                    inventoryEntries: inventoryPayload,
                    rooms: roomsData,
                    repairEntries: repairPayload,
                    build_classrooms_total,
                    u7_confirm_no_space: confirmNoSpace,
                    isPartial: true // Flag to backend
                })
            });
        } catch (e) {
            console.warn("Partial sync failed", e);
        }
    };

    const handleMasterSubmit = async () => {
        const repairRooms = roomsData.filter(r => r.status === 'Repair');
        const unassessedRooms = repairRooms.filter(room => {
            const building = buildings.find(b => b.id === room.building_local_id);
            const bName = building ? (building.building_name || building.building_no) : "";
            return !repairAssessments.some(a =>
                (a.building_name === bName || a.building_no === bName) &&
                (a.room_name === room.room_name || a.room_no === room.room_name)
            );
        });

        if (unassessedRooms.length > 0) {
            alert(`Validation Error: Please provide repair details for "${unassessedRooms[0].room_name}" before finalizing.`);
            setCurrentPage(5);
            return;
        }

        const confirmSubmit = window.confirm("Are you sure you want to finalize and save this entire Unit 7 Audit?");
        if (!confirmSubmit) return;

        setLoading(true);
        try {
            const inventoryPayload = buildings;
            const repairPayload = repairAssessments.map(a => ({
                building_no: a.building_name,
                room_no: a.room_name,
                item_name: a.item,
                oms: a.oms,
                condition: a.condition,
                damage_ratio: a.damage_ratio,
                recommended_action: a.recommend_action,
                demo_justification: a.demo_justification,
                remarks: a.remarks
            }));

            const build_classrooms_total = roomsData.length;
            const build_classrooms_new = roomsData.filter(r => buildings.find(b => b.id === r.building_local_id)?.status === "Newly Built").length;
            const build_classrooms_good = roomsData.filter(r => buildings.find(b => b.id === r.building_local_id)?.status === "Good Condition").length;
            const build_classrooms_repair = roomsData.filter(r => r.condition === 'Repair').length;
            const build_classrooms_demolition = roomsData.filter(r => {
                const b = buildings.find(bld => bld.id === r.building_local_id);
                const bStatus = (b?.status || "").toLowerCase();
                return b && (bStatus === "for condemnation" || bStatus === "condemned");
            }).length;

            // Generate Demolition Entries for justifications
            const demolitionEntries = buildings
                .filter(b => {
                    const bStatus = (b.status || "").toLowerCase();
                    return bStatus === "for condemnation" || bStatus === "condemned";
                })
                .map(b => ({
                    building_name: b.building_name,
                    reason_age: b.condemn_age,
                    reason_safety: b.condemn_hazard,
                    reason_calamity: b.condemn_calamity,
                    reason_upgrade: b.condemn_upgrade,
                    // Backward compatibility fields for backend loop
                    age: b.condemn_age,
                    safety: b.condemn_hazard,
                    calamity: b.condemn_calamity,
                    upgrade: b.condemn_upgrade,
                    // Include counts from roomsData for the backend multiplier
                    less_than_7x9: roomsData.filter(r => r.building_local_id === b.id && (r.dimension || '').toLowerCase() === 'less than 7x9').length,
                    "7x9": roomsData.filter(r => r.building_local_id === b.id && (r.dimension || '').toLowerCase() === '7x9').length,
                    above_7x9: roomsData.filter(r => r.building_local_id === b.id && (r.dimension || '').toLowerCase() === 'above 7x9').length
                }));

            const finalRooms = roomsData.map(r => ({
                ...r,
                seats: (r.grade_level || "").includes("Non-Instructional") ? null : r.seats
            }));

            const payload = {
                school_yr: "SY 26-27",
                schoolId, school_id: schoolId, iern: schoolData?.iern,
                inventoryEntries: inventoryPayload, rooms: finalRooms, repairEntries: repairPayload,
                demolitionEntries: demolitionEntries, // Add this line
                build_classrooms_total, build_classrooms_new, build_classrooms_good,
                build_classrooms_repair, build_classrooms_demolition,
                // Reconstruction Metadata
                spaces: spaces,
                has_no_building: hasNoBuilding,
                u7_confirm_no_space: confirmNoSpace
            };

            if (!navigator.onLine) {
                // Update local quest progress
                const stored = localStorage.getItem('quest_progress');
                let progress = stored ? JSON.parse(stored) : { completedUnits: [], xp: 0 };
                if (!progress.completedUnits.includes(7)) {
                    progress.completedUnits.push(7);
                    if (!progress.completedUnits.includes(10)) progress.completedUnits.push(10);
                    progress.xp += 500;
                    localStorage.setItem('quest_progress', JSON.stringify(progress));
                }

                await addModularToOutbox({
                    unitId: 7, label: "Unit 7: Physical Facilities (Inventory & Mapping)",
                    url: api(`/save-physical-facilities`), method: 'POST',
                    payload, schoolId
                });
                await clearUnitDraft(7, schoolId);

                setShowOfflineSuccess(true);
                return;
            }

            const masterRes = await fetch(api(`/api/save-physical-facilities`), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!masterRes.ok) throw new Error("Failed to submit Unit 7 master payload.");

            // XP Logic
            const stored = localStorage.getItem('quest_progress');
            let progress = stored ? JSON.parse(stored) : { completedUnits: [], xp: 0 };
            if (!progress.completedUnits.includes(7)) {
                progress.completedUnits.push(7);
                progress.xp += 500;
                localStorage.setItem('quest_progress', JSON.stringify(progress));
            }

            // Optional background sync for metrics
            fetch(api(`/api/user/progress`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ unitId: 7, schoolId, duration_seconds: 0 })
            }).catch(e => console.error("[Unit 7 Sync Error]:", e));

            setShowSuccess(true);
            await clearUnitDraft(7, schoolId);
            setTimeout(() => navigate("/modular-dashboard"), 3000);
        } catch (err) {
            console.error("UNIT 7 SUBMIT ERROR:", err);
            if (!navigator.onLine || err.message.includes('fetch') || err.message.includes('Network error')) {
                // Prepare exactly the same payload for the outbox
                const repairPayload = repairAssessments.map(a => ({
                    building_no: a.building_name,
                    room_no: a.room_name,
                    item_name: a.item,
                    oms: a.oms,
                    condition: a.condition,
                    damage_ratio: a.damage_ratio,
                    recommended_action: a.recommend_action,
                    demo_justification: a.demo_justification,
                    remarks: a.remarks
                }));

                const finalRooms = roomsData.map(r => ({
                    ...r,
                    seats: (r.grade_level || "").includes("Non-Instructional") ? null : r.seats
                }));

                const outboxPayload = {
                    school_yr: "SY 26-27",
                    schoolId, school_id: schoolId, iern: schoolData?.iern,
                    inventoryEntries: buildings, rooms: finalRooms, repairEntries: repairPayload,
                    build_classrooms_total: roomsData.length,
                    spaces: spaces,
                    has_no_building: hasNoBuilding
                };

                await addModularToOutbox({
                    unitId: 7, label: "Unit 7: Physical Facilities (Inventory & Mapping)",
                    url: api(`/save-physical-facilities`), method: 'POST',
                    payload: outboxPayload, schoolId
                });
                await clearUnitDraft(7, schoolId);
                setShowOfflineSuccess(true);
            } else {
                alert("Failed to save facilities data. " + err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        // Hub-and-spoke: wizard pages (3,4,5,6) return to the Hub (Page 2)
        if (currentPage === 3 || currentPage === 4 || currentPage === 5 || currentPage === 6) {
            setCurrentPage(2);
            return;
        }
        if (currentPage > 1) {
            setCurrentPage(prev => prev - 1);
        } else {
            navigate("/modular-dashboard");
        }
    };

    const handleSaveDraftAndExit = async () => {
        if (!schoolId) return;
        const draftData = {
            currentPage,
            buildings,
            roomsData,
            repairAssessments,
            spaces,
            hasRepair,
            hasNoBuilding
        };
        await saveUnitDraft(7, schoolId, draftData);
        navigate("/modular-dashboard");
    };

    // ── Summary Dashboard Component ─────────────────────────────────────────
    const SummaryDashboard = () => {
        const totalClassrooms = roomsData.length;
        const [showAllRooms, setShowAllRooms] = useState(false);

        return (
            <div className="min-h-screen unit1-page flex flex-col font-sans pb-52">
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
                    .bg-slate-900.rounded-\\[2\\.5rem\\],
                    .bg-white.rounded-\\[2rem\\],
                    .bg-slate-900.rounded-\\[2rem\\] {
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
                <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm shadow-[0_2px_12px_rgba(0,0,0,0.04)] px-6 py-5 border-b border-gray-100/50">
                    <div className="max-w-md md:max-w-7xl mx-auto flex items-center gap-2 w-full">
                        <button 
                            onClick={() => navigate("/modular-dashboard")} 
                            className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                        >
                            <FiArrowLeft className="w-6 h-6" />
                        </button>
                        <div className="flex flex-col ml-2">
                            <span className="text-[10px] font-black tracking-widest text-indigo-500 uppercase leading-none">
                                Reviewing
                            </span>
                            <span className="text-sm font-black text-slate-800 leading-tight">
                                Physical Facilities
                            </span>
                        </div>
                    </div>
                </header>

                <div className="max-w-md md:max-w-7xl mx-auto mt-4 px-4 space-y-10 w-full">
                    <UnitRemarkAlert unitId="u7" schoolId={targetSchoolId || localStorage.getItem('schoolId')} />
                    {/* Header */}
                    <div className="text-center mb-10">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[2.5rem] mx-auto mb-6 flex items-center justify-center shadow-xl shadow-indigo-100"
                        >
                            <span className="text-4xl text-white">🏢</span>
                        </motion.div>
                        <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-[0.2em] mb-3 shadow-sm border border-indigo-100">
                            Unit 7 • Architecture Profile
                        </span>
                        <h1 className="text-3xl font-black text-slate-800 leading-tight tracking-tight">Facilities Summary</h1>
                        <p className="text-slate-500 font-medium mt-2 italic">"Comprehensive audit of campus infrastructure"</p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                        {/* Left Column: Stats & Map */}
                        <div className="space-y-8 lg:col-span-1">
                            {hasNoBuilding && (
                                <div className="bg-amber-50 border-2 border-amber-200 rounded-[2.5rem] p-8 text-center shadow-sm">
                                    <div className="text-4xl mb-4">📢</div>
                                    <h4 className="text-amber-800 font-black text-xl uppercase tracking-tight">Confirmed: No Buildings</h4>
                                    <p className="text-amber-600 text-[11px] font-bold mt-2 uppercase tracking-widest leading-relaxed">
                                        This school has officially reported having no physical building structures on site.
                                    </p>
                                </div>
                            )}

                            {/* High Level Metrics */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-900 rounded-[2.5rem] p-6 text-white shadow-xl relative overflow-hidden group">
                                    <div className="absolute -right-4 -bottom-4 text-6xl opacity-10 rotate-12 group-hover:rotate-0 transition-transform duration-700 pointer-events-none">🏗️</div>
                                    <p className="text-indigo-300 text-[8px] font-black uppercase tracking-widest mb-1">Structures</p>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-3xl font-black">{buildings.length}</span>
                                        <span className="text-[10px] font-bold text-indigo-400">BLDGS</span>
                                    </div>
                                </div>
                                <div className="bg-indigo-600 rounded-[2.5rem] p-6 text-white shadow-xl relative overflow-hidden group">
                                    <div className="absolute -right-4 -bottom-4 text-6xl opacity-10 rotate-12 group-hover:rotate-0 transition-transform duration-700 pointer-events-none">🏫</div>
                                    <p className="text-indigo-100 text-[8px] font-black uppercase tracking-widest mb-1">Total Rooms</p>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-3xl font-black">{totalClassrooms}</span>
                                        <span className="text-[10px] font-bold text-indigo-200">CLASSROOMS</span>
                                    </div>
                                </div>
                            </div>

                            {/* ── PHASE 1: BUILDABLE SPACES ── */}
                            <section className="space-y-4">
                                <div className="flex items-center gap-2 px-2">
                                    <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Buildable Footprint</h3>
                                </div>
                                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden p-2">
                                    <div className="h-[220px] rounded-[2rem] overflow-hidden bg-slate-50 relative">
                                        {centerMap && centerMap[0] !== 0 ? (
                                            <MapContainer 
                                                key={`summary-map-${centerMap[0]}-${centerMap[1]}-${spaces.length}`}
                                                center={centerMap} 
                                                zoom={18} 
                                                scrollWheelZoom={false} 
                                                dragging={false} 
                                                doubleClickZoom={false} 
                                                zoomControl={false} 
                                                className="h-full w-full"
                                            >
                                                <TileLayer 
                                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                                    maxZoom={20}
                                                />
                                                <RecenterMap center={centerMap} />
                                                {spaces.map((s, idx) => {
                                                    const poly = calculateRotatedPolygon(parseFloat(s.center_lat), parseFloat(s.center_lng), parseFloat(s.length_m) || 0, parseFloat(s.width_m) || 0, parseFloat(s.rotation_deg) || 0);
                                                    return poly ? (
                                                        <Polygon key={'ro-' + idx} positions={poly} pathOptions={{ color: '#4f46e5', weight: 3, fillOpacity: 0.2 }} />
                                                    ) : null;
                                                })}
                                            </MapContainer>
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold italic">Map Preview Unavailable</div>
                                        )}
                                    </div>
                                    <div className="p-4 space-y-3">
                                        {spaces.map(s => (
                                            <div key={s.id} className="flex items-center justify-between px-2">
                                                <div>
                                                    <h4 className="font-black text-slate-800 text-[13px]">{s.space_name}</h4>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{s.length_m}m &times; {s.width_m}m</p>
                                                </div>
                                                <span className="text-[11px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                                                    {parseFloat(s.total_area_sqm).toFixed(1)} m&sup2;
                                                </span>
                                            </div>
                                        ))}
                                        {spaces.length === 0 && <p className="text-center text-slate-400 text-[10px] font-bold italic py-2">No spaces recorded.</p>}
                                    </div>
                                </div>
                            </section>
                        </div>

                        {/* Right Column: Building Inventory, Room Audit, Repairs */}
                        <div className="space-y-8 lg:col-span-2">
                            {/* ── PHASE 2: BUILDING INVENTORY ── */}
                            <section className="space-y-4">
                                <div className="flex items-center justify-between px-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-6 bg-amber-500 rounded-full" />
                                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Building Inventory</h3>
                                    </div>
                                    {!isReadOnly && (
                                        <button
                                            onClick={() => {
                                                setIsReadOnly(false);
                                                setCurrentPage(2);
                                                setShowBuildingModal(true);
                                                setEditingBuildingId(null);
                                                setBuildingFormData({
                                                    building_name: "", category: "Academic Building", storey: "", classroom: "",
                                                    year_completed: currentYear, remarks: "", status: "Good Condition",
                                                    condemn_age: false, condemn_hazard: false, condemn_calamity: false, condemn_upgrade: false
                                                });
                                            }}
                                            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors"
                                        >
                                            <FiPlus /> Register New Building
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {buildings.map(b => (
                                        <div key={b.id} className={`bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm relative overflow-hidden group ${((b.status || "").toLowerCase() === 'condemned' || (b.status || "").toLowerCase() === 'for condemnation') ? 'border-rose-100 shadow-rose-50/50' : ''}`}>
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h4 className="font-black text-slate-800 text-lg tracking-tight uppercase">{b.building_name || b.building_no || 'Building N/A'}</h4>
                                                    <p className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.15em]">{b.category}</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    {!isReadOnly && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setIsReadOnly(false);
                                                                setCurrentPage(2);
                                                                handleEditBuilding(b);
                                                            }}
                                                            className="p-3 bg-white text-indigo-500 rounded-xl shadow-sm border border-slate-100 opacity-0 group-hover:opacity-100 transition-all hover:bg-indigo-50 active:scale-95"
                                                            title="Edit Building"
                                                        >
                                                            <FiEdit2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {!isReadOnly && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const confirm = window.confirm(`Delete building "${b.building_name}"? This will also remove its room assignments.`);
                                                                if (confirm) {
                                                                    setBuildings(buildings.filter(x => x.id !== b.id));
                                                                    setRoomsData(roomsData.filter(r => r.building_local_id !== b.id));
                                                                }
                                                            }}
                                                            className="p-3 bg-white text-rose-500 rounded-xl shadow-sm border border-slate-100 opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-50 active:scale-95"
                                                            title="Delete Building"
                                                        >
                                                            <FiTrash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${b.status === 'Newly Built' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                                                        b.status === 'Good Condition' ? 'bg-blue-50 border-blue-100 text-blue-600' :
                                                            'bg-rose-50 border-rose-100 text-rose-600'
                                                        }`}>
                                                        {b.status}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-slate-50 p-3 rounded-2xl">
                                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Verticality</p>
                                                    <p className="text-[13px] font-black text-slate-700">{b.storey} Storey</p>
                                                </div>
                                                <div className="bg-slate-50 p-3 rounded-2xl">
                                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Capacity</p>
                                                    <p className="text-[13px] font-black text-slate-700">{roomsData.filter(r => r.building_local_id === b.id).length} Classroom</p>
                                                </div>
                                            </div>
                                            {b.remarks && (
                                                <p className="mt-4 text-[11px] font-medium text-slate-500 italic px-1">&ldquo;{b.remarks}&rdquo;</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* ── PHASE 3: GRANULAR ROOM AUDIT ── */}
                            <section className="space-y-4">
                                <div className="flex items-center gap-2 px-2">
                                    <div className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Granular Room Audit</h3>
                                </div>
                                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                                    <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Master Room List</span>
                                        <span className="bg-indigo-600 px-3 py-1 rounded-full text-[10px] font-black text-white">
                                            {roomsData.length} AUDITED
                                        </span>
                                    </div>
                                    <div className="p-2 overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="border-b border-slate-50">
                                                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Room Name</th>
                                                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Level</th>
                                                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Condition</th>
                                                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Seats</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {(showAllRooms ? roomsData : roomsData.slice(0, 10)).map(room => (
                                                    <tr key={room.id} className="group hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-4 py-4">
                                                            <p className="font-black text-slate-800 text-xs">{room.room_name}</p>
                                                            <p className="text-[9px] font-bold text-slate-400 tracking-tighter uppercase">{room.dimension || '7x9'}</p>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <span className="font-bold text-slate-600 text-[11px] whitespace-nowrap">{(room.grade_level || "").replace(/;/g, ', ') || '--'}</span>
                                                        </td>
                                                        <td className="px-4 py-4 text-center">
                                                            <div className={`inline-flex items-center justify-center w-6 h-6 rounded-lg ${room.status === 'Good Condition' || room.status === 'Newly Built' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                                                                }`}>
                                                                {room.status === 'Good Condition' || room.status === 'Newly Built' ? <FiCheck className="w-3.5 h-3.5" /> : <FiAlertTriangle className="w-3.5 h-3.5" />}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4 text-center">
                                                            <span className="font-bold text-slate-600 text-[11px] whitespace-nowrap">{room.seats || '--'}</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    {roomsData.length > 10 && (
                                        <button
                                            onClick={() => setShowAllRooms(!showAllRooms)}
                                            className="w-full p-4 text-[10px] font-black text-indigo-500 hover:text-indigo-700 bg-slate-50/30 border-t border-slate-50 transition-colors uppercase tracking-widest"
                                        >
                                            {showAllRooms ? 'Show Less' : `View All ${roomsData.length} Rooms`}
                                        </button>
                                    )}
                                </div>
                            </section>

                            {/* ── PHASE 4: REQUIRED REPAIRS ── */}
                            <section className="space-y-4 pb-12">
                                <div className="flex items-center gap-2 px-2">
                                    <div className="w-1.5 h-6 bg-rose-500 rounded-full" />
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Maintenance Assessment</h3>
                                </div>
                                <div className="space-y-4">
                                    {groupedRepairsArray.map(r => (
                                        <div key={r.roomId} className="bg-white rounded-[2rem] p-6 border border-rose-100 shadow-sm relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 p-4 text-4xl opacity-5 group-hover:scale-110 transition-transform">🛠️</div>
                                            <div className="mb-4">
                                                <h4 className="font-black text-slate-800 text-lg leading-tight uppercase tracking-tight">{r.room_name}</h4>
                                                <p className="text-[9px] font-black text-rose-500 uppercase tracking-[0.15em]">{r.building_name} · DIM: {r.room_length}x{r.room_width}</p>
                                            </div>
                                            <div className="space-y-3">
                                                {r.items.map((itm, iidx) => (
                                                    <div key={iidx} className="bg-slate-50 rounded-2xl p-4 flex justify-between items-center group/item hover:bg-slate-100 transition-colors">
                                                        <div className="flex-1">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="text-[10px] font-black text-slate-700 uppercase">{itm.item}</span>
                                                                <span className="text-[10px] font-black text-rose-600">{itm.damage_ratio}% SCALE</span>
                                                            </div>
                                                            <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                                                                <div className="h-full bg-rose-500 transition-all duration-1000" style={{ width: `${itm.damage_ratio}%` }} />
                                                            </div>
                                                            <p className="text-[9px] font-medium text-slate-400 mt-2 uppercase tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
                                                                {itm.recommend_action} · {itm.oms || 'Standard Material'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    {groupedRepairsArray.length === 0 && (
                                        <div className="bg-emerald-50 border border-emerald-100 rounded-[2rem] p-8 text-center">
                                            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm text-2xl">✨</div>
                                            <h4 className="text-emerald-800 font-black text-lg">Structural Integrity Verified</h4>
                                            <p className="text-emerald-600 text-[11px] font-medium mt-1 uppercase tracking-widest">No major repairs or rehabilitation required</p>
                                        </div>
                                    )}
                                </div>
                            </section>
                        </div>
                    </div>
                </div>

                {!propReadOnly && (
                    <div className="fixed bottom-0 left-0 w-full p-6 pb-10 bg-white/80 backdrop-blur-md border-t border-slate-100 flex justify-center z-[60]">
                        <div className="w-full max-w-sm flex pointer-events-auto px-4">
                            <button
                                onClick={() => {
                                    setIsReadOnly(false);
                                    setCurrentPage(1);
                                }}
                                className="flex-1 py-5 rounded-[2rem] bg-indigo-600 text-white font-black text-xl shadow-xl shadow-indigo-100/50 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-3"
                            >
                                <FiUnlock className="w-6 h-6" />
                                <span>Unlock to Edit Architecture</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // ── Render Header & Main Content ──────────────────────────────────────
    return (
        <div className="min-h-screen unit1-page flex flex-col font-sans overflow-x-hidden pb-52 text-gray-900">
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
                .bg-slate-900.rounded-\\[2\\.5rem\\],
                .bg-white.rounded-\\[2rem\\],
                .bg-slate-900.rounded-\\[2rem\\] {
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

                /* Override style for inputs and select components to give nodes dashboard chunky outline theme */
                input[type="text"], input[type="number"], select, textarea {
                  border-color: #BAE6FD !important;
                  border-width: 2px !important;
                  border-radius: 20px !important;
                  background-color: #FFFFFF !important;
                  font-family: var(--font-body) !important;
                  transition: all 0.2s ease-in-out !important;
                }
                input[type="text"]:focus, input[type="number"]:focus, select:focus, textarea:focus {
                  outline: none !important;
                  border-color: #0284C7 !important;
                  box-shadow: 0 0 0 4px #E0F2FE !important;
                }
                `
            }} />
            {/* Header / Nav */}
            {(!propReadOnly && !isReadOnly) && (
                <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-4">
                    <div className="max-w-md mx-auto flex items-center justify-between">
                        <button onClick={handleBack} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                            <FiArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="flex-1 text-center">
                            <div className="text-[10px] font-black tracking-widest text-[#004A99] uppercase">Unit 7</div>
                            <h1 className="text-sm font-black text-gray-800 uppercase tracking-tight">Physical Facilities</h1>
                        </div>
                        {(!isReadOnly) ? (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleOpenHistoryModal}
                                    title="View / Copy previous SY data"
                                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-indigo-50 text-indigo-500 hover:bg-indigo-100 hover:text-indigo-700 transition-all active:scale-90 border border-indigo-100"
                                >
                                    <FiCopy className="w-4 h-4" />
                                </button>
                                <div className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md uppercase tracking-widest">
                                    Step {currentPage}/6
                                </div>
                            </div>
                        ) : (
                            <div className="w-10"></div>
                        )}

                    </div>
                    {/* Visual Progress Bar (Only in Wizard) */}
                    {!isReadOnly && (
                        <div className="max-w-md mx-auto mt-3 h-1 bg-gray-100 rounded-full overflow-hidden flex gap-1">
                            {[1, 2, 3, 4, 5, 6].map(step => (
                                <div
                                    key={step}
                                    className={`flex-1 h-full transition-all duration-500 ${currentPage >= step ? "bg-indigo-500" : "bg-gray-200"}`}
                                />
                            ))}
                        </div>
                    )}
                </header>
            )}

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

            {isReadOnly ? (
                <SummaryDashboard />
            ) : (
                <main className="flex-1 w-full max-w-3xl mx-auto p-4 lg:p-6 flex flex-col pt-8">
                    <UnitRemarkAlert unitId="u7" schoolId={targetSchoolId || localStorage.getItem('schoolId')} sdoRemark={validationRemarks} />

                    {currentPage === 1 && (
                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                            <h2 className="text-3xl font-black text-gray-800 tracking-tight leading-tight mb-2">
                                Visual Multi-Space Builder 🏗️
                            </h2>
                            <p className="text-gray-500 mb-6 font-medium">Draw and record buildable spaces for the school campus footprint.</p>

                            {/* Form or Add Button */}
                            <AnimatePresence mode="wait">
                                {!isFormVisible ? (
                                    <motion.button
                                        key="addbtn"
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        onClick={() => {
                                            setIsFormVisible(true);
                                            // Scroll to top when opening form so user sees it
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}
                                        className="bg-emerald-500 w-full py-4 rounded-2xl text-white font-black text-lg border-b-[6px] border-emerald-700 active:border-b-0 active:translate-y-[6px] shadow-lg flex justify-center items-center gap-2 mb-8 transition-all hover:bg-emerald-400"
                                    >
                                        <FiPlus className="w-6 h-6" /> Add Buildable Space
                                    </motion.button>
                                ) : (
                                    <motion.div
                                        key="form"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        className="bg-white p-5 rounded-3xl shadow-lg border border-gray-100 mb-8"
                                    >
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="font-black text-xl text-gray-800">New Space Details</h3>
                                            <button onClick={() => setIsFormVisible(false)} className="text-gray-400 hover:text-gray-700"><FiX className="w-6 h-6" /></button>
                                        </div>

                                        <p className="text-sm font-bold text-amber-600 mb-4 bg-amber-50 p-3 rounded-lg flex items-center gap-2">
                                            <FiMapPin className="shrink-0" />
                                            {newSpace.center_lat ? "Pin placed! Adjust size." : "Tap on the map below to select the center location!"}
                                        </p>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-sm font-bold text-gray-500 ml-2">Space Name / ID</label>
                                                <input type="text" value={newSpace.space_name} onChange={(e) => setNewSpace({ ...newSpace, space_name: e.target.value })}
                                                    className={`w-full bg-gray-50 border-2 ${spaces.some(s => (s.space_name || "").trim().toLowerCase() === (newSpace.space_name || "").trim().toLowerCase()) ? 'border-rose-300 focus:border-rose-500' : 'border-gray-200 focus:border-emerald-500'} mt-1 rounded-2xl px-4 py-3 text-lg font-bold text-gray-700 outline-none transition-all`} />
                                                {spaces.some(s => (s.space_name || "").trim().toLowerCase() === (newSpace.space_name || "").trim().toLowerCase()) && (
                                                    <p className="text-rose-500 text-[10px] font-black uppercase mt-1 ml-2 flex items-center gap-1">
                                                        <FiAlertTriangle /> This space name is already in use
                                                    </p>
                                                )}
                                            </div>

                                            <div className="flex gap-4">
                                                <div className="flex-1">
                                                    <label className="text-sm font-bold text-gray-500 ml-2">Length (meters)</label>
                                                    <input type="number" value={newSpace.length_m} onChange={(e) => setNewSpace({ ...newSpace, length_m: parseFloat(e.target.value) || 0 })}
                                                        className="w-full bg-gray-50 border-2 border-gray-200 mt-1 rounded-2xl px-4 py-3 text-lg font-bold text-gray-700 outline-none focus:border-emerald-500 transition-all text-center" />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="text-sm font-bold text-gray-500 ml-2">Width (meters)</label>
                                                    <input type="number" value={newSpace.width_m} onChange={(e) => setNewSpace({ ...newSpace, width_m: parseFloat(e.target.value) || 0 })}
                                                        className="w-full bg-gray-50 border-2 border-gray-200 mt-1 rounded-2xl px-4 py-3 text-lg font-bold text-gray-700 outline-none focus:border-emerald-500 transition-all text-center" />
                                                </div>
                                            </div>

                                            <div className="bg-emerald-50 p-4 rounded-2xl border-2 border-emerald-100 mt-4">
                                                <div className="flex justify-between items-center mb-4">
                                                    <span className="font-bold text-emerald-800">Computed Area:</span>
                                                    <span className="text-3xl font-black text-emerald-600">{totalAreaSqm.toFixed(2)} m&sup2;</span>
                                                </div>

                                                <div className="pt-4 border-t border-emerald-200/50">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <label className="text-xs font-black text-emerald-700 uppercase tracking-widest">Rotation Angle</label>
                                                        <span className="text-xs font-black text-emerald-600">{newSpace.rotation_deg}°</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="360"
                                                        value={newSpace.rotation_deg}
                                                        onChange={(e) => setNewSpace({ ...newSpace, rotation_deg: parseInt(e.target.value) })}
                                                        className="w-full h-2 bg-emerald-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <button onClick={handleSaveSpace} disabled={loading || !newSpace.center_lat || spaces.some(s => (s.space_name || "").trim().toLowerCase() === (newSpace.space_name || "").trim().toLowerCase())}
                                            className="w-full mt-6 py-4 rounded-2xl text-white font-black text-lg bg-indigo-500 border-b-[6px] border-indigo-700 active:border-b-0 active:translate-y-[6px] transition-all disabled:opacity-50 disabled:bg-gray-300 disabled:border-gray-400 shadow-xl shadow-indigo-200/50">
                                            {loading ? "Saving..." : "Save space configuration ✓"}
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Map Display area */}
                            <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-200 mb-6 relative overflow-hidden z-0">
                                <div className="h-[400px] rounded-xl overflow-hidden shadow-inner">
                                    {centerMap && (
                                        <MapContainer center={centerMap} zoom={18} scrollWheelZoom={true} className="h-full w-full">
                                            <TileLayer
                                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                                maxZoom={20}
                                            />
                                            <MapClickHandler />
                                            <RecenterMap center={centerMap} />

                                            {/* Render existing spaces */}
                                            {Array.isArray(spaces) && spaces.map((s, idx) => {
                                                const poly = calculateRotatedPolygon(parseFloat(s.center_lat), parseFloat(s.center_lng), parseFloat(s.length_m), parseFloat(s.width_m), parseFloat(s.rotation_deg) || 0);
                                                if (!poly) return null;
                                                return (
                                                    <React.Fragment key={idx}>
                                                        <Polygon positions={poly} pathOptions={{ color: 'blue', weight: 2, fillOpacity: 0.2 }} />
                                                        <Marker position={[s.center_lat, s.center_lng]}>
                                                            <Popup>{s.space_name} ({s.total_area_sqm} sqm)</Popup>
                                                        </Marker>
                                                    </React.Fragment>
                                                );
                                            })}

                                            {/* Render new drawing space */}
                                            {newSpace.center_lat && newSpace.center_lng && isFormVisible && (() => {
                                                const poly = calculateRotatedPolygon(newSpace.center_lat, newSpace.center_lng, newSpace.length_m || 0, newSpace.width_m || 0, newSpace.rotation_deg || 0);
                                                if (!poly) return null;
                                                return (
                                                    <>
                                                        <Polygon
                                                            positions={poly}
                                                            pathOptions={{ color: 'emerald', weight: 4, fillOpacity: 0.4 }}
                                                        />
                                                        <Marker position={[newSpace.center_lat, newSpace.center_lng]}>
                                                            <Popup>Target Location</Popup>
                                                        </Marker>
                                                    </>
                                                );
                                            })()}
                                        </MapContainer>
                                    )}
                                </div>
                            </div>

                            {/* List of Saved spaces */}
                            {spaces.length > 0 && (
                                <div className="mt-4">
                                    <h3 className="font-black text-xl text-gray-800 mb-4 px-2">Saved Spaces</h3>
                                    <div className="space-y-3">
                                        {spaces.map(s => (
                                            <div key={s.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
                                                <div>
                                                    <h4 className="font-bold text-lg text-gray-800">{s.space_name}</h4>
                                                    <p className="text-sm text-gray-500 font-medium">{s.length_m}m &times; {s.width_m}m &nbsp;&bull;&nbsp; <span className="text-emerald-600 font-bold">{parseFloat(s.total_area_sqm).toFixed(2)} m&sup2;</span></p>
                                                </div>
                                                <button onClick={() => handleDelete(s.id)} className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition-colors">
                                                    <FiTrash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* ────────────────────────────────────────────────────────
                    PHASE 2: REGISTER BUILDING SUMMARY (Inventory Hub)
                    ──────────────────────────────────────────────────────── */}
                    {currentPage === 2 && (
                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                            <div className="flex justify-between items-end mb-8">
                                <div>
                                    <h2 className="text-3xl font-black text-gray-800 tracking-tight leading-tight">
                                        Building Inventory 🏗️
                                    </h2>
                                    <p className="text-gray-500 font-medium mt-1">Review your registered buildings or add a new one.</p>
                                </div>
                                <div className="bg-indigo-50 px-4 py-2 rounded-2xl border-2 border-indigo-100">
                                    <span className="text-xl font-black text-indigo-600 leading-none">{buildings.length}</span>
                                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">Bldgs</span>
                                </div>
                            </div>

                            {buildings.length === 0 && !hasNoBuilding ? (
                                <div className="bg-white p-10 rounded-[3rem] border-2 border-slate-100 shadow-xl shadow-slate-50 text-center py-20">
                                    <div className="w-24 h-24 bg-indigo-50 rounded-[2.5rem] flex items-center justify-center text-4xl mx-auto mb-8 shadow-inner italic font-serif">?</div>
                                    <h3 className="text-2xl font-black text-gray-800">No buildings yet</h3>
                                    <p className="text-gray-400 mt-2 font-medium max-w-[240px] mx-auto text-sm leading-relaxed">Let's start by registering your first school building.</p>
                                    <button 
                                        onClick={() => {
                                            setActiveBuildingId(null);
                                            setEditingBuildingId(null);
                                            setCurrentPage(3);
                                        }}
                                        className="mt-10 px-10 py-4 bg-indigo-600 text-white rounded-[2rem] font-black shadow-xl shadow-indigo-100 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 mx-auto"
                                    >
                                        <FiPlus className="w-6 h-6" /> Add First Building
                                    </button>

                                    <div className="mt-8 pt-6 border-t border-slate-100">
                                        <label className="flex items-center gap-3 cursor-pointer justify-center group">
                                            <input
                                                type="checkbox"
                                                checked={hasNoBuilding}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        const confirm = window.confirm("This will confirm that this school has no physical buildings. Are you sure?");
                                                        if (confirm) {
                                                            setHasNoBuilding(true);
                                                            setBuildings([]);
                                                            setRoomsData([]);
                                                            setRepairAssessments([]);
                                                        }
                                                    } else {
                                                        setHasNoBuilding(false);
                                                    }
                                                }}
                                                className="w-5 h-5 rounded-lg border-2 border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                            />
                                            <span className="text-sm font-bold text-gray-400 group-hover:text-amber-600 transition-colors">This school has NO buildings</span>
                                        </label>
                                    </div>
                                </div>
                            ) : hasNoBuilding ? (
                                <div className="bg-slate-50 p-10 rounded-[3rem] border-2 border-slate-100 text-center">
                                    <div className="text-5xl mb-6 text-slate-300">🗺️</div>
                                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">No Buildings Declared</h3>
                                    <p className="text-slate-500 mt-2 font-medium">You have stated that this school site has no physical buildings yet.</p>
                                    <button onClick={() => setHasNoBuilding(false)} className="mt-8 px-8 py-3 bg-indigo-50 text-indigo-600 rounded-2xl font-black border-2 border-indigo-100 italic transition-all active:scale-95">Wait, I have buildings</button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {buildings.map(b => (
                                        <div key={b.id} className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-100 shadow-sm hover:border-indigo-100 transition-all group">
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                                        <h4 className="font-black text-xl text-gray-800 uppercase tracking-tight break-words">{b.building_name}</h4>
                                                        <span className="text-[9px] font-black px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100 uppercase tracking-tighter">
                                                            {b.category}
                                                        </span>
                                                        {roomsData.filter(r => r.building_local_id === b.id).some(r => !r.dimension || !r.status) && (
                                                            <span className="text-[9px] font-black px-2 py-0.5 bg-rose-50 text-rose-600 rounded-lg border border-rose-100 uppercase tracking-tighter flex items-center gap-1">
                                                                <FiAlertTriangle className="w-2 h-2" /> Incomplete
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-sm font-bold text-gray-400 uppercase tracking-widest">
                                                        <span>{b.storey} {b.storey === "1" ? 'Storey' : 'Storeys'}</span>
                                                        <span className="w-1 h-1 bg-gray-200 rounded-full" />
                                                        <span>{roomsData.filter(r => r.building_local_id === b.id).length} Rooms</span>
                                                    </div>
                                                    <div className="flex gap-2 mt-4">
                                                        {(() => {
                                                            const bRooms = roomsData.filter(r => r.building_local_id === b.id);
                                                            const bStatus = (b.status || "").toLowerCase();
                                                            const isCondemned = bStatus === 'condemned' || bStatus === 'for condemnation';
                                                            const hasRepairs = bRooms.some(r => r.condition === 'Repair');
                                                            
                                                            let displayStatus = b.status || "Good Condition";
                                                            if (!isCondemned && hasRepairs) displayStatus = "Repair";
                                                            if (!isCondemned && !hasRepairs && bStatus === 'repair') displayStatus = "Good Condition";

                                                            return (
                                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                                                    displayStatus === 'Good Condition' || displayStatus === "Newly Built" ? 'bg-emerald-50 text-emerald-600' : 
                                                                    isCondemned ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                                                                }`}>
                                                                    {displayStatus}
                                                                </span>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2 shrink-0">
                                                    <button 
                                                        onClick={() => {
                                                            const actualRooms = roomsData.filter(r => r.building_local_id === b.id);
                                                            setEditingBuildingId(b.id);
                                                            setBuildingFormData({ 
                                                                ...b,
                                                                classroom: actualRooms.length.toString(),
                                                                storey: b.storey || "1"
                                                            });
                                                            setCurrentPage(3);
                                                        }}
                                                        className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-transparent hover:border-indigo-100"
                                                    >
                                                        <FiEdit2 className="w-5 h-5" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteBuilding(b.id)}
                                                        className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-rose-50 hover:text-rose-600 transition-all border border-transparent hover:border-rose-100"
                                                    >
                                                        <FiTrash2 className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Certification Checkbox */}
                                    <div 
                                        onClick={() => setIsCertified(!isCertified)}
                                        className={`p-8 rounded-[2.5rem] mt-8 mb-4 border-4 transition-all duration-300 flex items-start gap-6 cursor-pointer ${isCertified ? 'bg-emerald-50 border-emerald-500 shadow-xl shadow-emerald-100' : 'bg-white border-slate-100 opacity-60'}`}
                                    >
                                        <div className={`w-8 h-8 rounded-xl flex-none flex items-center justify-center transition-all ${isCertified ? 'bg-emerald-500 text-white' : 'border-2 border-slate-200'}`}>
                                            {isCertified && <FiCheck className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <p className={`text-sm font-black text-left leading-relaxed ${isCertified ? 'text-emerald-950' : 'text-slate-500'}`}>
                                                I hereby certify that the learner counts and gender breakdown provided are accurate and based on our school's current official enrollment records.
                                            </p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 italic text-left">Official Certification for SY 2025-2026</p>
                                        </div>
                                    </div>
                                    
                                    <button 
                                        onClick={() => {
                                            setActiveBuildingId(null);
                                            setEditingBuildingId(null);
                                            setBuildingFormData({
                                                building_name: "", category: "Academic Building", storey: "", classroom: "",
                                                year_completed: currentYear, remarks: "", status: "Good Condition",
                                                condemn_age: false, condemn_hazard: false, condemn_calamity: false, condemn_upgrade: false
                                            });
                                            setCurrentPage(3);
                                        }}
                                        className="w-full py-6 rounded-[2.5rem] bg-indigo-50 text-indigo-600 font-black text-xl border-4 border-dashed border-indigo-100 hover:bg-indigo-100 transition-all flex items-center justify-center gap-3 mt-8 shadow-sm"
                                    >
                                        <FiPlus className="w-7 h-7" /> Add Another Building
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* ────────────────────────────────────────────────────────
                    PHASE 3: Building Setup
                    ──────────────────────────────────────────────────────── */}
                    {currentPage === 3 && (
                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                            <div className="flex flex-col gap-1 mb-6">
                                <h2 className="text-3xl font-black text-gray-800 tracking-tight leading-tight mb-2">
                                    {editingBuildingId ? "Edit Building" : "Register Building"} 🏢
                                </h2>
                                <p className="text-gray-500 mb-6 font-medium">Log the physical structures on your campus.</p>
                            </div>

                            <div className="space-y-6 mb-8">
                                <div className="bg-white p-6 rounded-[2.5rem] border-2 border-indigo-100 shadow-sm transition-all focus-within:border-indigo-400">
                                        <div className="space-y-6">
                                            <div>
                                                <label className="text-sm font-bold text-gray-500 ml-2 uppercase tracking-widest">Building Name</label>
                                                <input
                                                    type="text"
                                                    value={buildingFormData.building_name}
                                                    onChange={(e) => setBuildingFormData({ ...buildingFormData, building_name: e.target.value })}
                                                    className={`w-full bg-gray-50 border-2 ${buildings.some(b => b.id !== editingBuildingId && (b.building_name || "").trim().toLowerCase() === (buildingFormData.building_name || "").trim().toLowerCase()) ? 'border-rose-300 focus:border-rose-500' : 'border-gray-200 focus:border-indigo-500'} mt-1 rounded-2xl px-6 py-4 text-xl font-bold text-gray-700 outline-none transition-all placeholder-gray-300`}
                                                    placeholder="e.g. Marcos Type Bldg"
                                                />
                                                {buildings.some(b => b.id !== editingBuildingId && (b.building_name || "").trim().toLowerCase() === (buildingFormData.building_name || "").trim().toLowerCase()) && (
                                                    <p className="text-rose-500 text-[10px] font-black uppercase mt-1 ml-2 flex items-center gap-1">
                                                        <FiAlertTriangle /> This building name is already in use
                                                    </p>
                                                )}
                                            </div>

                                            <div className="relative">
                                                <label className="text-sm font-bold text-gray-500 ml-2 uppercase tracking-widest">Building Category</label>
                                                <div className="relative mt-1">
                                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                        <FiSearch className="text-gray-400 w-5 h-5" />
                                                    </div>
                                                    <input
                                                        type="text"
                                                        placeholder="Search building type..."
                                                        value={isBuildingDropdownOpen ? buildingSearch : buildingFormData.category}
                                                        onFocus={() => {
                                                            setIsBuildingDropdownOpen(true);
                                                            setBuildingSearch("");
                                                        }}
                                                        onChange={(e) => {
                                                            setBuildingSearch(e.target.value);
                                                            setBuildingFormData(prev => ({ ...prev, category: e.target.value }));
                                                        }}
                                                        className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl pl-11 pr-12 py-4 text-lg font-bold text-gray-700 outline-none focus:border-indigo-500 focus:bg-white transition-all placeholder-gray-300 shadow-sm"
                                                    />
                                                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center cursor-pointer text-gray-400" onClick={() => setIsBuildingDropdownOpen(!isBuildingDropdownOpen)}>
                                                        <FiChevronDown className={`w-6 h-6 transition-transform ${isBuildingDropdownOpen ? 'rotate-180' : ''}`} />
                                                    </div>
                                                    <AnimatePresence>
                                                        {isBuildingDropdownOpen && (
                                                            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                                                className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-100 rounded-3xl shadow-2xl max-h-60 overflow-y-auto py-2">
                                                                {(buildingSearch ? buildingTypes.filter(t => t.toLowerCase().includes(buildingSearch.toLowerCase())) : buildingTypes).map(type => (
                                                                    <button key={type} type="button" onClick={() => { setBuildingFormData({ ...buildingFormData, category: type }); setBuildingSearch(type); setIsBuildingDropdownOpen(false); }}
                                                                        className="w-full text-left px-6 py-4 font-bold text-gray-700 hover:bg-indigo-50 transition-all flex items-center justify-between">
                                                                        <span>{type}</span>
                                                                        {buildingFormData.category === type && <FiCheck className="w-5 h-5 text-indigo-500" />}
                                                                    </button>
                                                                ))}
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            </div>

                                            <div className="flex gap-4">
                                                <div className="flex-1">
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Storeys</label>
                                                    <input type="text" inputMode="numeric" value={buildingFormData.storey} placeholder="1" onChange={(e) => setBuildingFormData({ ...buildingFormData, storey: e.target.value.replace(/[^0-9]/g, '') })}
                                                        className="w-full bg-gray-50 border-2 border-gray-200 mt-1 rounded-2xl px-4 py-4 text-xl font-bold text-gray-700 outline-none focus:border-indigo-500 text-center" />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Classrooms</label>
                                                    <input type="text" inputMode="numeric" value={buildingFormData.classroom} placeholder="1" onChange={(e) => setBuildingFormData({ ...buildingFormData, classroom: e.target.value.replace(/[^0-9]/g, '') })}
                                                        className="w-full bg-gray-50 border-2 border-gray-200 mt-1 rounded-2xl px-4 py-4 text-xl font-bold text-gray-700 outline-none focus:border-indigo-500 text-center" />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Building Status</label>
                                                <select value={buildingFormData.status} onChange={(e) => setBuildingFormData({ ...buildingFormData, status: e.target.value })}
                                                    className="w-full bg-gray-50 border-2 border-gray-200 mt-1 rounded-2xl px-6 py-4 text-xl font-bold text-gray-700 outline-none focus:border-indigo-500 appearance-none cursor-pointer">
                                                    <option value="Newly Built">Newly Built</option>
                                                    <option value="Good Condition">Good Condition</option>
                                                    <option value="For Major Repairs">For Major Repairs</option>
                                                    <option value="For Minor Repairs">For Minor Repairs</option>
                                                    <option value="For Condemnation">For Condemnation</option>
                                                    <option value="Condemned">Condemned</option>
                                                </select>
                                            </div>

                                            {((buildingFormData.status || "").toLowerCase() === 'for condemnation' || (buildingFormData.status || "").toLowerCase() === 'condemned') && (
                                                <div className="p-5 bg-rose-50 rounded-2xl border-2 border-rose-100 space-y-4">
                                                    <h4 className="text-sm font-black text-rose-600 uppercase tracking-widest flex items-center gap-2">
                                                        <FiAlertTriangle className="w-4 h-4" /> Justification for Condemnation
                                                    </h4>
                                                    <div className="grid grid-cols-1 gap-3">
                                                        {[
                                                            { id: 'condemn_age', label: 'Age / Dilapidation', icon: <FiClock /> },
                                                            { id: 'condemn_hazard', label: 'Safety Hazard', icon: <FiAlertOctagon /> },
                                                            { id: 'condemn_calamity', label: 'Calamity Damage', icon: <FiCloudLightning /> },
                                                            { id: 'condemn_upgrade', label: 'Site Upgrade / Repurposing', icon: <FiTrendingUp /> }
                                                        ].map(item => (
                                                            <button
                                                                key={item.id}
                                                                onClick={() => setBuildingFormData({ ...buildingFormData, [item.id]: !buildingFormData[item.id] })}
                                                                className={`py-3 px-4 rounded-xl font-bold text-sm border-2 text-left flex items-center justify-between transition-all ${buildingFormData[item.id] ? 'bg-white border-rose-400 text-rose-700 shadow-sm' : 'bg-rose-50/50 border-rose-100 text-rose-300 hover:bg-white hover:border-rose-200'}`}
                                                            >
                                                                <span className="flex items-center gap-2">{item.icon} {item.label}</span>
                                                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${buildingFormData[item.id] ? 'bg-rose-500 border-rose-500 text-white' : 'border-rose-200'}`}>
                                                                    {buildingFormData[item.id] && <FiCheck className="w-3 h-3" />}
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* ────────────────────────────────────────────────────────
                    PHASE 4: Granular Room Setup
                    ──────────────────────────────────────────────────────── */}
                    {currentPage === 4 && (
                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                            <h2 className="text-3xl font-black text-gray-800 tracking-tight leading-tight mb-2">
                                Granular Room Setup 🏫
                            </h2>
                            <p className="text-gray-500 mb-6 font-medium">Set detailed information for each room in <strong>{buildings.find(b => b.id === activeBuildingId)?.building_name || 'this building'}</strong>.</p>

                            <div className="space-y-6">
                                {roomsData.filter(r => r.building_local_id === activeBuildingId).length === 0 && (
                                    <div className="bg-amber-50 p-8 rounded-3xl border-2 border-amber-200 text-center">
                                        <p className="text-amber-800 font-bold">No rooms detected for this building. Please check your building details.</p>
                                        <button onClick={() => setCurrentPage(3)} className="mt-4 px-6 py-2 bg-amber-500 text-white rounded-xl font-bold">Back to Building Details</button>
                                    </div>
                                )}

                                {roomsData.filter(r => r.building_local_id === activeBuildingId).length > 0 && (
                                    <div className="flex justify-between items-center px-2 mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-4 bg-indigo-500 rounded-full" />
                                            <span className="text-sm font-black text-gray-700 uppercase tracking-widest">
                                                Designing {buildings.find(b => b.id === activeBuildingId)?.building_name}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {(() => {
                                    const nameCounts = {};
                                    const activeBuildingRooms = roomsData.filter(r => r.building_local_id === activeBuildingId);
                                    
                                    activeBuildingRooms.forEach(r => {
                                        const key = (r.room_name || "").trim().toLowerCase();
                                        if (key) nameCounts[key] = (nameCounts[key] || 0) + 1;
                                    });
                                    const duplicateNames = new Set(
                                        Object.keys(nameCounts).filter(k => nameCounts[k] > 1)
                                    );

                                    const building = buildings.find(b => b.id === activeBuildingId);
                                    if (!building) return null;
                                    const buildingRooms = activeBuildingRooms;
                                    
                                    return (
                                        <div key={building.id} className="space-y-4 mb-6">
                                            {/* Building Header */}
                                            <div className="w-full flex items-center justify-between p-5 bg-indigo-600 rounded-[2rem] shadow-lg shadow-indigo-100 text-white">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                                                        <FiCheckCircle className="w-6 h-6 text-white" />
                                                    </div>
                                                    <div className="text-left">
                                                        <h3 className="font-black text-lg uppercase tracking-tight leading-none mb-1">{building.building_name}</h3>
                                                        <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest">{buildingRooms.length} Classrooms Configured</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Rooms Container */}
                                            <div className="space-y-4">
                                                                {buildingRooms.map((room) => {
                                                                    const isDuplicate = duplicateNames.has((room.room_name || "").trim().toLowerCase());
                                                                    const bStatus = (building?.status || "").toLowerCase();
                                                                    const isBuildingCondemned = bStatus === "for condemnation" || bStatus === "condemned";

                                                                    return (
                                                                        <motion.div 
                                                                            key={room.id}
                                                                            initial={{ x: -20, opacity: 0 }}
                                                                            animate={{ x: 0, opacity: 1 }}
                                                                            className={`bg-white p-6 rounded-[2.5rem] shadow-sm border-2 ${isDuplicate ? 'border-rose-200 shadow-rose-50' : isBuildingCondemned ? 'border-amber-200 bg-amber-50/20 shadow-amber-50' : room.is_in_use === false ? 'border-slate-100 opacity-60 bg-slate-50/10' : 'border-gray-100'}`}
                                                                        >
                                                                            <div className="flex justify-between items-start mb-4">
                                                                                <div className="flex-1 mr-4">
                                                                                    <input
                                                                                        type="text"
                                                                                        value={room.room_name}
                                                                                        onChange={(e) => setRoomsData(roomsData.map(r => r.id === room.id ? { ...r, room_name: e.target.value } : r))}
                                                                                        className={`font-black text-xl ${isDuplicate ? 'text-rose-600' : 'text-gray-800'} bg-transparent border-b-2 border-dashed ${isDuplicate ? 'border-rose-300' : 'border-gray-200'} focus:border-indigo-500 outline-none w-full`}
                                                                                    />
                                                                                    {isDuplicate && (
                                                                                        <p className="text-rose-500 text-[10px] font-black uppercase mt-1 flex items-center gap-1">
                                                                                            <FiAlertTriangle /> Duplicate Room Name
                                                                                        </p>
                                                                                    )}
                                                                                    {isBuildingCondemned && (
                                                                                        <p className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md uppercase tracking-widest inline-flex items-center gap-1 mt-2 border border-rose-100">
                                                                                            <FiAlertTriangle className="w-3 h-3" /> Building Condemned
                                                                                        </p>
                                                                                    )}
                                                                                </div>
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider ${room.status === 'Repair' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                                                                                        {room.status}
                                                                                    </span>
                                                                                    <button onClick={() => handleDeleteRoom(room.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title="Delete Room">
                                                                                        <FiTrash2 className="w-4 h-4" />
                                                                                    </button>
                                                                                </div>
                                                                            </div>

                                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                                <div>
                                                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Dimensions</label>
                                                                                    <select
                                                                                        value={room.dimension || ""}
                                                                                        onChange={(e) => setRoomsData(roomsData.map(r => r.id === room.id ? { ...r, dimension: e.target.value } : r))}
                                                                                        className={`w-full bg-gray-50 border-2 rounded-xl px-4 py-2 font-bold text-gray-700 outline-none transition-all ${!room.dimension ? 'border-rose-300 focus:border-rose-500' : 'border-gray-100 focus:border-indigo-500'}`}
                                                                                    >
                                                                                        <option value="" disabled>Select Dimensions...</option>
                                                                                        <option value="Less than 7x9">Less than 7x9</option>
                                                                                        <option value="7x9">7x9</option>
                                                                                        <option value="Above 7x9">Above 7x9</option>
                                                                                    </select>
                                                                                </div>

                                                                                {!isBuildingCondemned && (
                                                                                    <div>
                                                                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Status</label>
                                                                                        <select
                                                                                            value={room.status || ""}
                                                                                            onChange={(e) => setRoomsData(roomsData.map(r => r.id === room.id ? { ...r, status: e.target.value } : r))}
                                                                                            className={`w-full bg-gray-50 border-2 rounded-xl px-4 py-2 font-bold text-gray-700 outline-none transition-all ${!room.status ? 'border-rose-300 focus:border-rose-500' : 'border-gray-100 focus:border-indigo-500'}`}
                                                                                        >
                                                                                            <option value="" disabled>Select Status...</option>
                                                                                            <option value="Newly Built">Newly Built</option>
                                                                                            <option value="Good Condition">Good Condition</option>
                                                                                            <option value="Repair">Repair</option>
                                                                                        </select>
                                                                                    </div>
                                                                                )}

                                                                                <div className="md:col-span-2">
                                                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Grade Level(s)</label>
                                                                                    <div className="space-y-3">
                                                                                        <div className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-3 py-2 min-h-[44px] flex flex-wrap gap-1.5 focus-within:border-indigo-500 transition-all cursor-pointer">
                                                                                            {parseGradeLevel(room.grade_level).map(g => (
                                                                                                <span key={g} className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 group-hover:bg-indigo-700 transition-colors">
                                                                                                    {g}
                                                                                                    <FiX
                                                                                                        className="cursor-pointer hover:text-rose-300"
                                                                                                        onClick={(e) => {
                                                                                                            e.stopPropagation();
                                                                                                            const currentGrades = parseGradeLevel(room.grade_level);
                                                                                                            const newGrades = currentGrades.filter(x => x !== g);
                                                                                                            setRoomsData(roomsData.map(r => r.id === room.id ? { ...r, grade_level: newGrades.join(';') } : r));
                                                                                                        }}
                                                                                                    />
                                                                                                </span>
                                                                                            ))}
                                                                                            {!(room.grade_level || "") && <span className="text-gray-400 text-sm font-medium py-0.5">Select Grade Levels</span>}
                                                                                        </div>

                                                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                                                            {availableGrades.length > 0 ? (
                                                                                                availableGrades.map(g => {
                                                                                                    const isSelected = parseGradeLevel(room.grade_level).includes(g.label);
                                                                                                    return (
                                                                                                        <button
                                                                                                            key={g.id}
                                                                                                            type="button"
                                                                                                            onClick={() => {
                                                                                                                const currentGrades = parseGradeLevel(room.grade_level);
                                                                                                                let newGrades;
                                                                                                                if (isSelected) {
                                                                                                                    newGrades = currentGrades.filter(x => x !== g.label);
                                                                                                                } else {
                                                                                                                    // If selecting a standard grade, remove "Non-Instructional"
                                                                                                                    newGrades = [...new Set([...currentGrades.filter(x => x !== "Non-Instructional"), g.label])];
                                                                                                                }
                                                                                                                const joined = newGrades.join(';');
                                                                                                                logGradeState(room.id, joined);
                                                                                                                setRoomsData(roomsData.map(r => r.id === room.id ? { ...r, grade_level: joined, seats: newGrades.includes("Non-Instructional") ? null : r.seats } : r));
                                                                                                            }}
                                                                                                            className={`text-[10px] font-black px-3 py-1.5 rounded-lg border-2 transition-all ${isSelected
                                                                                                                    ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm"
                                                                                                                    : "bg-white border-gray-100 text-gray-500 hover:border-indigo-200"
                                                                                                                }`}
                                                                                                        >
                                                                                                            {g.label}
                                                                                                        </button>
                                                                                                    );
                                                                                                })
                                                                                            ) : (
                                                                                                <p className="text-[10px] font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100 italic">
                                                                                                    ⚠️ No audited grades found in Unit 7
                                                                                                </p>
                                                                                            )}
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    const isSelected = parseGradeLevel(room.grade_level).includes("Non-Instructional");
                                                                                                    const currentGrades = parseGradeLevel(room.grade_level);
                                                                                                    let newGrades;
                                                                                                    if (isSelected) {
                                                                                                        newGrades = currentGrades.filter(x => x !== "Non-Instructional");
                                                                                                    } else {
                                                                                                        // If selecting "Non-Instructional", clear all other grades
                                                                                                        newGrades = ["Non-Instructional"];
                                                                                                    }
                                                                                                    const joined = newGrades.join(';');
                                                                                                    logGradeState(room.id, joined);
                                                                                                    setRoomsData(roomsData.map(r => r.id === room.id ? { ...r, grade_level: joined, seats: newGrades.includes("Non-Instructional") ? null : r.seats } : r));
                                                                                                }}
                                                                                                className={`text-[10px] font-black px-3 py-1.5 rounded-lg border-2 transition-all ${parseGradeLevel(room.grade_level).includes("Non-Instructional")
                                                                                                        ? "bg-slate-100 border-slate-500 text-slate-700 shadow-sm"
                                                                                                        : "bg-white border-gray-100 text-gray-400 hover:border-slate-200"
                                                                                                    }`}
                                                                                            >
                                                                                                Non-Instructional
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>

                                                                                {!isBuildingCondemned && !parseGradeLevel(room.grade_level).includes("Non-Instructional") && (
                                                                                    <div>
                                                                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Total Seats</label>
                                                                                        <input
                                                                                            type="text"
                                                                                            inputMode="numeric"
                                                                                            value={room.seats || ""}
                                                                                            onChange={(e) => {
                                                                                                const val = e.target.value.replace(/[^0-9]/g, '');
                                                                                                setRoomsData(roomsData.map(r => r.id === room.id ? { ...r, seats: val } : r));
                                                                                            }}
                                                                                            placeholder="0"
                                                                                            className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-2 font-bold text-gray-700 outline-none focus:border-indigo-500"
                                                                                        />
                                                                                    </div>
                                                                                )}

                                                                                {/* In Use / Not Used Toggle */}
                                                                                <div className="md:col-span-2 pt-4 border-t-2 border-dashed border-gray-100 flex items-center justify-between mt-2">
                                                                                    <div className="flex items-center gap-3">
                                                                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg shadow-sm ${room.is_in_use !== false ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                                                                                            {room.is_in_use !== false ? '✅' : '🚫'}
                                                                                        </div>
                                                                                        <div>
                                                                                            <p className={`font-black text-[11px] uppercase tracking-wider ${room.is_in_use !== false ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                                                                {room.is_in_use !== false ? 'Currently In Use' : 'Not Currently In Use'}
                                                                                            </p>
                                                                                            <p className="text-[9px] font-bold text-gray-400 mt-0.5">Instructional Space Status</p>
                                                                                        </div>
                                                                                    </div>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => setRoomsData(roomsData.map(r => r.id === room.id ? { ...r, is_in_use: !(r.is_in_use !== false) } : r))}
                                                                                        className={`relative w-12 h-6 rounded-full transition-all duration-500 ease-out outline-none ${room.is_in_use !== false ? 'bg-emerald-500' : 'bg-slate-200'}`}
                                                                                    >
                                                                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-500 ease-out shadow-sm ${room.is_in_use !== false ? 'left-7' : 'left-1'}`} />
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                                        </motion.div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </div>
                                                        </motion.div>
                                                    )}

                    {/* ────────────────────────────────────────────────────────
                    PHASE 5: Repair Assessment
                    ──────────────────────────────────────────────────────── */}
                    {currentPage === 5 && (
                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                            <h2 className="text-3xl font-black text-gray-800 tracking-tight leading-tight mb-2">
                                Repair Assessment 🛠️
                            </h2>
                            <p className="text-gray-500 mb-6 font-medium">Assess rooms marked for repair in <strong>{buildings.find(b => b.id === activeBuildingId)?.building_name || 'this building'}</strong>.</p>

                            <div className="space-y-6">
                                {roomsData.filter(r => r.building_local_id === activeBuildingId && r.status === 'Repair').length === 0 ? (
                                    <div className="bg-emerald-50 p-8 rounded-3xl border-2 border-emerald-100 text-center">
                                        <p className="text-emerald-800 font-bold text-xl">✨ Structural integrity looks great!</p>
                                        <p className="text-emerald-600 mt-2 font-medium">No major repairs needed for {buildings.find(b => b.id === activeBuildingId)?.building_name}.</p>
                                        <button onClick={() => { handlePartialSync(); setCurrentPage(6); }} className="mt-6 px-10 py-4 bg-emerald-600 text-white rounded-3xl font-black shadow-lg shadow-emerald-100">Proceed to Finish</button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="px-2 mb-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-4 bg-amber-500 rounded-full" />
                                                <span className="text-sm font-black text-gray-700 uppercase tracking-widest">
                                                    Assessing Repairs for {buildings.find(b => b.id === activeBuildingId)?.building_name}
                                                </span>
                                            </div>
                                        </div>

                                        {(() => {
                                            const building = buildings.find(b => b.id === activeBuildingId);
                                            if (!building) return null;
                                            const repairRoomsInBuilding = roomsData.filter(r => r.building_local_id === building.id && r.status === 'Repair');
                                            
                                            return (
                                                <div key={building.id} className="space-y-4 mb-6">
                                                    <div className="space-y-4">
                                                        {repairRoomsInBuilding.map((room) => {
                                                            const bName = building?.building_name || building?.building_no || "";
                                                            const isAssessed = repairAssessments.some(a => a.building_name === bName && a.room_name === room.room_name);

                                                            return (
                                                                <motion.div 
                                                                    key={room.id}
                                                                    initial={{ x: -20, opacity: 0 }}
                                                                    animate={{ x: 0, opacity: 1 }}
                                                                    className={`bg-white p-6 rounded-[2.5rem] shadow-sm border-2 ${isAssessed ? 'border-emerald-100 bg-emerald-50/10' : 'border-amber-100 bg-amber-50/5'}`}
                                                                >
                                                                    <div className="flex justify-between items-center text-left">
                                                                        <div className="flex-1">
                                                                            <h4 className="font-black text-xl text-gray-800">{room.room_name}</h4>
                                                                            <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] mt-1 italic">Requires Assessment</p>
                                                                            {isAssessed && <p className="text-[11px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full uppercase flex items-center gap-1 mt-3 w-fit"><FiCheckCircle /> Assessment Done</p>}
                                                                        </div>
                                                                        <button
                                                                            onClick={() => {
                                                                                setRepairRoomFormData({
                                                                                    building_name: bName,
                                                                                    room_name: room.room_name,
                                                                                    room_length: room.room_length || 9,
                                                                                    room_width: room.room_width || 7
                                                                                });

                                                                                const existingItems = repairAssessments.filter(a =>
                                                                                    a.building_name === bName &&
                                                                                    a.room_name === room.room_name
                                                                                );

                                                                                const initialState = {};
                                                                                existingItems.forEach(item => {
                                                                                    initialState[item.item] = {
                                                                                        oms: item.oms || "",
                                                                                        condition: item.condition || "Repair",
                                                                                        damage_ratio: item.damage_ratio || 0,
                                                                                        recommend_action: item.recommend_action || "Routine Repair",
                                                                                        demo_justification: item.demo_justification || "",
                                                                                        remarks: item.remarks || ""
                                                                                    };
                                                                                });
                                                                                setRepairItemsState(initialState);
                                                                                setEditingRepairRoomId(bName + "-" + room.room_name);
                                                                                setShowRepairModal(true);
                                                                            }}
                                                                            className={`w-14 h-14 rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center ${isAssessed ? 'bg-indigo-600 text-white shadow-indigo-100' : 'bg-amber-500 text-white shadow-amber-100'}`}
                                                                        >
                                                                            {isAssessed ? <FiEdit2 className="w-6 h-6" /> : <FiPlus className="w-6 h-6" />}
                                                                        </button>
                                                                    </div>
                                                                </motion.div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* ────────────────────────────────────────────────────────
                    PHASE 6: Interstitial / Loop Question
                    ──────────────────────────────────────────────────────── */}
                    {currentPage === 6 && (
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-32 h-32 bg-emerald-100 rounded-[3rem] flex items-center justify-center text-5xl mb-10 shadow-xl shadow-emerald-50">🎉</div>
                            <h2 className="text-4xl font-black text-gray-800 leading-tight px-4 tracking-tighter">Inventory Updated!</h2>
                            <p className="text-gray-500 mt-4 text-lg font-medium px-10">You've successfully audited <strong>{buildings.find(b => b.id === activeBuildingId)?.building_name}</strong>.</p>
                            
                            <div className="w-full max-w-sm space-y-4 mt-12 px-6">
                                <button
                                    onClick={() => {
                                        setActiveBuildingId(null);
                                        setEditingBuildingId(null);
                                        setBuildingFormData({
                                            building_name: "", category: "Academic Building", storey: "", classroom: "",
                                            year_completed: currentYear, remarks: "", status: "Good Condition",
                                            condemn_age: false, condemn_hazard: false, condemn_calamity: false, condemn_upgrade: false
                                        });
                                        setCurrentPage(3);
                                    }}
                                    className="w-full py-5 rounded-[2.5rem] bg-indigo-600 text-white font-black text-xl shadow-xl shadow-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-3 border-b-8 border-indigo-800"
                                >
                                    <FiPlus className="w-6 h-6" /> Add Another Building
                                </button>
                                
                                <button
                                    onClick={() => setCurrentPage(2)}
                                    className="w-full py-5 rounded-[2.5rem] bg-white text-gray-800 font-black text-xl border-2 border-gray-100 shadow-sm active:scale-95 transition-all flex items-center justify-center gap-3"
                                >
                                    <FiArrowLeft className="w-6 h-6" /> Back to Inventory Hub
                                </button>
                            </div>
                        </motion.div>
                    )}


                </main>
            )}

            {/* Wizard Navigation Buttons */}
            {!isReadOnly && (
                <footer className="fixed bottom-0 left-0 w-full p-6 pb-10 bg-white/90 backdrop-blur-md border-t border-slate-100 flex justify-center z-30 pointer-events-none">
                    <div className="w-full max-w-md flex gap-3 pointer-events-auto">
                        <button onClick={handleBack} className="w-16 h-16 rounded-3xl bg-slate-50 border-2 border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 active:scale-95 transition-all outline-none shrink-0">
                            <FiArrowLeft className="w-6 h-6" />
                        </button>

                        <button onClick={() => setShowDraftModal(true)} className="flex-none h-16 px-6 rounded-3xl bg-blue-50 border-2 border-blue-100 flex items-center justify-center gap-2 text-blue-500 hover:text-blue-700 active:scale-95 transition-all outline-none shrink-0">
                            <FiSave className="w-6 h-6" />
                            <span className="text-sm font-bold text-blue-500">Save Draft</span>
                        </button>

                        {currentPage === 2 ? (
                            <button
                                onClick={handleMasterSubmit}
                                disabled={loading || (buildings.length === 0 && !hasNoBuilding) || isAuditIncomplete || !isCertified}
                                className="flex-1 h-16 rounded-3xl text-white font-black text-lg bg-emerald-600 border-b-[6px] border-emerald-800 active:border-b-0 active:translate-y-[6px] transition-all disabled:opacity-40 shadow-lg shadow-emerald-100 flex justify-center items-center gap-2"
                            >
                                {loading ? "Processing..." : (
                                    <span className="flex items-center justify-center gap-2">
                                        SUBMIT ENTRY <FiCheckCircle className="w-5 h-5" />
                                    </span>
                                )}
                            </button>
                        ) : currentPage === 3 ? (
                            <button
                                onClick={handleSaveBuilding}
                                className="flex-1 h-16 rounded-3xl text-white font-black text-lg bg-indigo-600 border-b-[6px] border-indigo-800 active:border-b-0 active:translate-y-[6px] transition-all disabled:opacity-40 shadow-lg shadow-indigo-100 flex justify-center items-center gap-2"
                            >
                                <span>Save & Setup Rooms</span> <FiArrowRight className="w-5 h-5" />
                            </button>
                        ) : currentPage === 4 ? (
                            <button
                                onClick={() => {
                                    const bRooms = roomsData.filter(r => r.building_local_id === activeBuildingId);
                                    const missingGradeLevel = bRooms.some(r => !r.grade_level);
                                    if (missingGradeLevel) {
                                        alert("Please select a Grade Level for all classrooms in this building.");
                                        return;
                                    }
                                    const missingDimension = bRooms.some(r => !r.dimension);
                                    if (missingDimension) {
                                        alert("Please select Dimensions for all classrooms in this building.");
                                        return;
                                    }
                                    const missingStatus = bRooms.some(r => !r.status);
                                    if (missingStatus) {
                                        alert("Please select a Status for all classrooms in this building.");
                                        return;
                                    }

                                    const nameCounts = {};
                                    bRooms.forEach(r => {
                                        const key = (r.room_name || "").trim().toLowerCase();
                                        if (key) nameCounts[key] = (nameCounts[key] || 0) + 1;
                                    });
                                    const hasDuplicates = Object.values(nameCounts).some(count => count > 1);
                                    if (hasDuplicates) {
                                        alert("Please resolve duplicate room names in this building.");
                                        return;
                                    }
                                    // Validate Total Seats (skip condemned rooms which auto-set to "0")
                                    const activeBuilding = buildings.find(b => b.id === activeBuildingId);
                                    const bldgStatusLower = (activeBuilding?.status || "").toLowerCase();
                                    const isBldgCondemned = bldgStatusLower === "for condemnation" || bldgStatusLower === "condemned";
                                    if (!isBldgCondemned) {
                                        const missingSeats = bRooms.find(r => {
                                            const isNonInstructional = (r.grade_level || "").includes("Non-Instructional");
                                            return !isNonInstructional && (!r.seats || r.seats === "" || r.seats === "0");
                                        });
                                        if (missingSeats) {
                                            setValidationModal({ roomName: missingSeats.room_name });
                                            return;
                                        }
                                    }
                                    const hasRepairRooms = bRooms.some(r => r.status === 'Repair');
                                    if (hasRepairRooms) {
                                        setCurrentPage(5);
                                    } else {
                                        handlePartialSync();
                                        setCurrentPage(6);
                                    }
                                }}
                                className="flex-1 h-16 rounded-3xl text-white font-black text-lg bg-indigo-600 border-b-[6px] border-indigo-800 active:border-b-0 active:translate-y-[6px] transition-all disabled:opacity-40 shadow-lg shadow-indigo-100 flex justify-center items-center gap-2"
                            >
                                <span>Process Room Audit</span> <FiArrowRight className="w-5 h-5" />
                            </button>
                        ) : currentPage === 5 ? (
                            <button
                                onClick={() => {
                                    const bName = buildings.find(b => b.id === activeBuildingId)?.building_name || "";
                                    const repairRooms = roomsData.filter(r => r.building_local_id === activeBuildingId && r.status === 'Repair');
                                    const unassessed = repairRooms.filter(room => !repairAssessments.some(a => a.building_name === bName && a.room_name === room.room_name));
                                    if (unassessed.length > 0) {
                                        alert(`Please complete repair assessment for "${unassessed[0].room_name}" before continuing.`);
                                        return;
                                    }
                                    handlePartialSync();
                                    setCurrentPage(6);
                                }}
                                className="flex-1 h-16 rounded-3xl text-white font-black text-lg bg-indigo-600 border-b-[6px] border-indigo-800 active:border-b-0 active:translate-y-[6px] transition-all disabled:opacity-40 shadow-lg shadow-indigo-100 flex justify-center items-center gap-2"
                            >
                                <span>Complete Building Audit</span> <FiArrowRight className="w-5 h-5" />
                            </button>
                        ) : (currentPage === 1) ? (
                            <button
                                onClick={() => {
                                    if (spaces.length === 0) {
                                        setShowNoSpaceConfirm(true);
                                    } else {
                                        setCurrentPage(currentPage + 1);
                                    }
                                }}
                                className="flex-1 h-16 rounded-3xl text-white font-black text-lg bg-indigo-600 border-b-[6px] border-indigo-800 active:border-b-0 active:translate-y-[6px] transition-all disabled:opacity-40 shadow-lg shadow-indigo-100 flex justify-center items-center gap-2"
                            >
                                <span>Next Step</span> <FiArrowRight className="w-5 h-5" />
                            </button>
                        ) : currentPage !== 6 ? (
                            <button
                                onClick={() => setCurrentPage(currentPage + 1)}
                                className="flex-1 h-16 rounded-3xl text-white font-black text-lg bg-indigo-600 border-b-[6px] border-indigo-800 active:border-b-0 active:translate-y-[6px] transition-all disabled:opacity-40 shadow-lg shadow-indigo-100 flex justify-center items-center gap-2"
                            >
                                <span>Next Step</span> <FiArrowRight className="w-5 h-5" />
                            </button>
                        ) : null}
                    </div>
                </footer>
            )}

            <AnimatePresence>
                {showNoSpaceConfirm && (
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[100] flex items-end justify-center pointer-events-auto">
                        <motion.div 
                            initial={{ y: 300 }} 
                            animate={{ y: 0 }} 
                            exit={{ y: 300 }} 
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="bg-white w-full max-w-md rounded-t-[3rem] p-10 pb-12 shadow-2xl relative text-center"
                        >
                            <div className="w-16 h-1.5 bg-gray-200 rounded-full mx-auto mb-8" />
                            <div className="w-20 h-20 bg-amber-500 rounded-full mx-auto flex items-center justify-center text-3xl shadow-2xl shadow-amber-200 mb-6">
                                <FiAlertTriangle className="text-white w-9 h-9" />
                            </div>
                            <h2 className="text-2xl font-black text-gray-900 leading-tight">No Buildable Space?</h2>
                            <p className="text-gray-500 font-medium mt-3 px-4 leading-relaxed text-sm">
                                You haven't registered any <strong className="text-gray-800">buildable spaces</strong> for this school. To proceed, please type <strong className="text-indigo-600 uppercase">confirm</strong> below.
                            </p>

                            <div className="mt-8 px-2 text-left">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1 mb-2 block">Safety Verification</label>
                                <input 
                                    type="text"
                                    value={confirmText}
                                    onChange={(e) => setConfirmText(e.target.value)}
                                    placeholder="Type confirm here..."
                                    className="w-full py-4 px-6 rounded-2xl bg-gray-50 border-2 border-gray-100 focus:border-indigo-500 focus:bg-white transition-all font-bold text-gray-700 outline-none placeholder:text-gray-300"
                                    autoFocus
                                />
                            </div>
                            
                            <div className="flex flex-col gap-3 mt-8">
                                <button 
                                    onClick={() => {
                                        if (confirmText.toLowerCase() === "confirm") {
                                            setShowNoSpaceConfirm(false);
                                            setConfirmText("");
                                            setConfirmNoSpace(true);
                                            setCurrentPage(2);
                                        }
                                    }}
                                    disabled={confirmText.toLowerCase() !== "confirm"}
                                    className={`w-full py-5 rounded-[2rem] font-black text-lg shadow-xl active:scale-95 transition-all outline-none ${
                                        confirmText.toLowerCase() === "confirm" 
                                        ? "bg-indigo-600 text-white shadow-indigo-200" 
                                        : "bg-gray-100 text-gray-300 cursor-not-allowed shadow-none"
                                    }`}
                                >
                                    Confirm & Proceed
                                </button>
                                <button 
                                    onClick={() => {
                                        setShowNoSpaceConfirm(false);
                                        setConfirmText("");
                                    }}
                                    className="w-full py-5 rounded-[2rem] bg-gray-50 text-gray-400 font-black text-lg active:scale-95 transition-all outline-none"
                                >
                                    Go Back
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Validation Modal: Missing Seats */}
            <AnimatePresence>
                {validationModal && (
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[100] flex items-end justify-center pointer-events-auto">
                        <motion.div 
                            initial={{ y: 300 }} 
                            animate={{ y: 0 }} 
                            exit={{ y: 300 }} 
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="bg-white w-full max-w-md rounded-t-[3rem] p-10 pb-12 shadow-2xl relative text-center"
                        >
                            <div className="w-16 h-1.5 bg-gray-200 rounded-full mx-auto mb-8" />
                            <div className="w-20 h-20 bg-amber-500 rounded-full mx-auto flex items-center justify-center text-3xl shadow-2xl shadow-amber-200 mb-6">
                                <FiAlertTriangle className="text-white w-9 h-9" />
                            </div>
                            <h2 className="text-2xl font-black text-gray-900 leading-tight">Missing Total Seats</h2>
                            <p className="text-gray-500 font-medium mt-3 px-4 leading-relaxed">
                                Please enter the <strong className="text-gray-800">Total Seats</strong> for
                            </p>
                            <div className="bg-amber-50 border-2 border-amber-100 rounded-2xl px-6 py-4 mt-4 mx-4">
                                <p className="text-amber-800 font-black text-xl uppercase tracking-tight">{validationModal.roomName}</p>
                            </div>
                            <button 
                                onClick={() => setValidationModal(null)}
                                className="w-full mt-10 py-5 rounded-[2rem] bg-amber-500 text-white font-black text-lg shadow-xl shadow-amber-100 active:scale-95 transition-all outline-none"
                            >
                                Got it, I'll fill it in
                            </button>
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
                message="Unit 7 Physical Facilities Audit finalized and saved successfully! ✨"
                redirectUrl="/modular-dashboard"
            />

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

            <AnimatePresence>
                {showOfflineSuccess && (
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[100] flex items-end justify-center pointer-events-auto">
                        <motion.div initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="bg-white w-full rounded-t-[3rem] p-10 pb-12 shadow-2xl relative max-w-md">
                            <div className="w-16 h-1.5 bg-gray-200 rounded-full mx-auto mb-8" />
                            <div className="w-20 h-20 bg-orange-500 rounded-full mx-auto flex items-center justify-center text-3xl shadow-2xl shadow-orange-200 mb-6 font-bold text-white">
                                <FiWifiOff />
                            </div>
                            <h2 className="text-2xl font-black text-gray-900 text-center leading-tight px-4">Local Secure: Unit 7 Saved!</h2>
                            <p className="text-gray-500 text-center font-medium mt-3 px-6">Your infrastructure layout, building inventory, and facility assessments have been saved locally. We will automatically sync your school's physical profile once you're back online.</p>

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

            <AnimatePresence>
                {/* Building Details Modal */}
                {showBuildingModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 40 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 40 }}
                            className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[3.5rem] p-8 md:p-12 shadow-2xl relative"
                        >
                            <div className="flex justify-between items-center mb-10 border-b-2 border-slate-50 pb-6">
                                <h3 className="font-black text-3xl text-gray-800">Building Details</h3>
                                <button onClick={() => setShowBuildingModal(false)} className="text-gray-400 hover:text-gray-700 bg-gray-50 p-3 rounded-full transition-colors">
                                    <FiX className="w-8 h-8" />
                                </button>
                            </div>
                            <div className="space-y-6">
                                <div>
                                    <label className="text-sm font-bold text-gray-500 ml-2 uppercase tracking-widest">Building Name</label>
                                    <input
                                        type="text"
                                        value={buildingFormData.building_name}
                                        onChange={(e) => setBuildingFormData({ ...buildingFormData, building_name: e.target.value })}
                                        className={`w-full bg-gray-50 border-2 ${buildings.some(b => b.id !== editingBuildingId && (b.building_name || "").trim().toLowerCase() === (buildingFormData.building_name || "").trim().toLowerCase()) ? 'border-rose-300 focus:border-rose-500' : 'border-gray-200 focus:border-indigo-500'} mt-1 rounded-2xl px-6 py-4 text-xl font-bold text-gray-700 outline-none transition-all placeholder-gray-300`}
                                        placeholder="e.g. Marcos Type Bldg"
                                    />
                                    {buildings.some(b => b.id !== editingBuildingId && (b.building_name || "").trim().toLowerCase() === (buildingFormData.building_name || "").trim().toLowerCase()) && (
                                        <p className="text-rose-500 text-[10px] font-black uppercase mt-1 ml-2 flex items-center gap-1">
                                            <FiAlertTriangle /> This building name is already in use
                                        </p>
                                    )}
                                </div>

                                <div className={`relative ${isBuildingDropdownOpen ? 'z-50' : 'z-0'}`}>
                                    <label className="text-sm font-bold text-gray-500 ml-2 uppercase tracking-widest">Building Category</label>
                                    <div className="relative mt-1">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <FiSearch className="text-gray-400 w-5 h-5" />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Search building type..."
                                            value={isBuildingDropdownOpen ? buildingSearch : buildingFormData.category}
                                            onFocus={() => {
                                                setIsBuildingDropdownOpen(true);
                                                setBuildingSearch("");
                                            }}
                                            onChange={(e) => {
                                                setBuildingSearch(e.target.value);
                                                setBuildingFormData(prev => ({ ...prev, category: e.target.value }));
                                            }}
                                            className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl pl-11 pr-12 py-4 text-lg font-bold text-gray-700 outline-none focus:border-indigo-500 focus:bg-white transition-all placeholder-gray-300 shadow-sm"
                                        />
                                        <div
                                            className="absolute inset-y-0 right-0 pr-4 flex items-center cursor-pointer text-gray-400 hover:text-indigo-500"
                                            onClick={() => setIsBuildingDropdownOpen(!isBuildingDropdownOpen)}
                                        >
                                            <FiChevronDown className={`w-6 h-6 transition-transform duration-300 ${isBuildingDropdownOpen ? 'rotate-180' : ''}`} />
                                        </div>

                                        <AnimatePresence>
                                            {isBuildingDropdownOpen && (
                                                <>
                                                    <motion.div
                                                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                                        className="absolute z-[100] w-full mt-2 bg-white border-2 border-gray-100 rounded-3xl shadow-2xl max-h-72 overflow-y-auto overflow-x-hidden py-2"
                                                    >
                                                        {(buildingSearch ? buildingTypes.filter(t => t.toLowerCase().includes(buildingSearch.toLowerCase())) : buildingTypes).map(type => (
                                                            <button
                                                                key={type}
                                                                type="button"
                                                                onClick={() => {
                                                                    setBuildingFormData({ ...buildingFormData, category: type });
                                                                    setBuildingSearch(type);
                                                                    setIsBuildingDropdownOpen(false);
                                                                }}
                                                                className={`w-full text-left px-6 py-4 font-bold text-gray-700 transition-all border-b border-gray-50 last:border-0 hover:bg-indigo-50 hover:pl-8 flex items-center justify-between ${buildingFormData.category === type ? 'bg-indigo-50 text-indigo-600' : ''}`}
                                                            >
                                                                <span>{type}</span>
                                                                {buildingFormData.category === type && <FiCheck className="w-5 h-5" />}
                                                            </button>
                                                        ))}
                                                    </motion.div>
                                                    <div className="fixed inset-0 z-40" onClick={() => setIsBuildingDropdownOpen(false)}></div>
                                                </>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="text-sm font-bold text-gray-500 ml-2 uppercase tracking-widest text-center">Storeys</label>
                                        <input type="text" inputMode="numeric" value={buildingFormData.storey} placeholder="1"
                                            onChange={(e) => setBuildingFormData({ ...buildingFormData, storey: e.target.value.replace(/[^0-9]/g, '') })}
                                            className="w-full bg-gray-50 border-2 border-gray-200 mt-1 rounded-2xl px-4 py-4 text-xl font-bold text-gray-700 outline-none focus:border-indigo-500 transition-all text-center" />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-sm font-bold text-gray-500 ml-2 uppercase tracking-widest text-center">Classrooms</label>
                                        <input type="text" inputMode="numeric" value={buildingFormData.classroom} placeholder="1"
                                            onChange={(e) => setBuildingFormData({ ...buildingFormData, classroom: e.target.value.replace(/[^0-9]/g, '') })}
                                            className="w-full bg-gray-50 border-2 border-gray-200 mt-1 rounded-2xl px-4 py-4 text-xl font-bold text-gray-700 outline-none focus:border-indigo-500 transition-all text-center" />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-bold text-gray-500 ml-2 uppercase tracking-widest">Year Completed</label>
                                    <select
                                        value={buildingFormData.year_completed}
                                        onChange={(e) => setBuildingFormData({ ...buildingFormData, year_completed: parseInt(e.target.value) })}
                                        className="w-full bg-gray-50 border-2 border-gray-200 mt-1 rounded-2xl px-6 py-4 text-xl font-bold text-gray-700 outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                                    >
                                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-sm font-bold text-gray-500 ml-2 uppercase tracking-widest block mb-1">Building Status</label>
                                    <select
                                        value={buildingFormData.status}
                                        onChange={(e) => setBuildingFormData({ ...buildingFormData, status: e.target.value })}
                                        className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl px-6 py-4 text-xl font-bold text-gray-700 outline-none focus:border-indigo-500 transition-all cursor-pointer"
                                    >
                                        <option value="Newly Built">Newly Built</option>
                                        <option value="Good Condition">Good Condition</option>
                                        <option value="For Major Repairs">For Major Repairs</option>
                                        <option value="For Minor Repairs">For Minor Repairs</option>
                                        <option value="For Condemnation">For Condemnation</option>
                                        <option value="Condemned">Condemned</option>
                                    </select>
                                </div>

                                {((buildingFormData.status || "").toLowerCase() === 'for condemnation' || (buildingFormData.status || "").toLowerCase() === 'condemned') && (
                                    <div className="p-5 bg-rose-50 rounded-2xl border-2 border-rose-100 space-y-4">
                                        <h4 className="text-sm font-black text-rose-600 uppercase tracking-widest flex items-center gap-2">
                                            <FiAlertTriangle className="w-4 h-4" /> Justification for Condemnation
                                        </h4>
                                        <div className="grid grid-cols-1 gap-3">
                                            {[
                                                { id: 'condemn_age', label: 'Age / Dilapidation', icon: <FiClock /> },
                                                { id: 'condemn_hazard', label: 'Safety Hazard', icon: <FiAlertOctagon /> },
                                                { id: 'condemn_calamity', label: 'Calamity Damage', icon: <FiCloudLightning /> },
                                                { id: 'condemn_upgrade', label: 'Site Upgrade / Repurposing', icon: <FiTrendingUp /> }
                                            ].map(item => (
                                                <button
                                                    key={item.id}
                                                    onClick={() => setBuildingFormData({ ...buildingFormData, [item.id]: !buildingFormData[item.id] })}
                                                    className={`py-3 px-4 rounded-xl font-bold text-sm border-2 text-left flex items-center justify-between transition-all ${buildingFormData[item.id] ? 'bg-white border-rose-400 text-rose-700 shadow-sm' : 'bg-rose-50/50 border-rose-100 text-rose-300 hover:bg-white hover:border-rose-200'}`}
                                                >
                                                    <span className="flex items-center gap-2">{item.icon} {item.label}</span>
                                                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${buildingFormData[item.id] ? 'bg-rose-500 border-rose-500 text-white' : 'border-rose-200'}`}>
                                                        {buildingFormData[item.id] && <FiCheck className="w-3 h-3" />}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="text-sm font-bold text-gray-500 ml-2 uppercase tracking-widest">Remarks</label>
                                    <textarea
                                        value={buildingFormData.remarks}
                                        onChange={(e) => setBuildingFormData({ ...buildingFormData, remarks: e.target.value })}
                                        className="w-full bg-gray-50 border-2 border-gray-200 mt-1 rounded-2xl px-6 py-4 text-xl font-bold text-gray-700 outline-none focus:border-indigo-500 transition-all min-h-[120px]"
                                        placeholder="Optional notes or observations..."
                                    ></textarea>
                                </div>

                                <button
                                    onClick={handleSaveBuilding}
                                    disabled={buildings.some(b => b.id !== editingBuildingId && (b.building_name || "").trim().toLowerCase() === (buildingFormData.building_name || "").trim().toLowerCase())}
                                    className="w-full mt-6 py-5 rounded-3xl text-white font-black text-xl bg-indigo-600 border-b-[8px] border-indigo-800 active:border-b-0 active:translate-y-[8px] transition-all shadow-xl shadow-indigo-200"
                                >
                                    Save Building Architecture
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Repair Assessment Modal */}
                {showRepairModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 40 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 40 }}
                            className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[2.5rem] p-6 md:p-8 shadow-2xl relative"
                        >
                            <div className="flex justify-between items-center mb-8 border-b-2 border-slate-50 pb-6">
                                <div>
                                    <h3 className="font-black text-xl text-gray-800 tracking-tight">Assessment: {editingRepairRoom?.building_name} {editingRepairRoom?.room_name}</h3>
                                </div>
                                <button onClick={() => setShowRepairModal(false)} className="text-gray-400 hover:text-gray-700 bg-gray-50 p-1.5 rounded-full transition-colors">
                                    <FiX className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="space-y-4">
                                <h4 className="text-base font-black text-gray-800 tracking-tight ml-1">Checklist of Damaged Items</h4>
                                
                                <div className="space-y-4">
                                    {REPAIR_CATEGORIES.map(category => {
                                        const isSelected = !!repairItemsState[category];
                                        const itemData = repairItemsState[category] || { damage_ratio: 0, recommend_action: "", oms: "", remarks: "" };

                                        return (
                                            <div key={category} className={`bg-white rounded-[1.5rem] border-2 transition-all duration-300 overflow-hidden ${isSelected ? 'border-amber-400 shadow-lg shadow-amber-50 scale-[1.01]' : 'border-slate-100 shadow-sm'}`}>
                                                {/* Card Header (Toggle) */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleRepairItem(category)}
                                                    className="w-full p-4 flex items-center gap-4 text-left"
                                                >
                                                    <div className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-200'}`}>
                                                        {isSelected && <FiCheck className="w-5 h-5 text-white stroke-[4]" />}
                                                    </div>
                                                    <span className={`text-base font-black transition-colors ${isSelected ? 'text-amber-900' : 'text-slate-600'}`}>
                                                        {category}
                                                    </span>
                                                </button>

                                                {/* Card Content (Questions) - Expanded if selected */}
                                                <AnimatePresence>
                                                    {isSelected && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: "auto", opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            className="px-6 pb-6 border-t font-sans border-amber-50"
                                                        >
                                                            <div className="pt-6 space-y-6">
                                                                <div>
                                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 ml-1">What it is made of</label>
                                                                    <input 
                                                                        type="text" 
                                                                        value={itemData.oms} 
                                                                        onChange={(e) => handleUpdateRepairItem(category, 'oms', e.target.value)}
                                                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3.5 text-base font-bold text-gray-700 outline-none focus:border-amber-500 transition-all font-sans" 
                                                                        placeholder="e.g. GI Sheet, Concrete, Wood" 
                                                                    />
                                                                </div>

                                                                <div>
                                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 ml-1">Action</label>
                                                                    <div className="relative">
                                                                        <select 
                                                                            value={itemData.recommend_action} 
                                                                            onChange={(e) => handleUpdateRepairItem(category, 'recommend_action', e.target.value)}
                                                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3.5 text-base font-bold text-gray-700 outline-none focus:border-amber-500 transition-all appearance-none cursor-pointer"
                                                                        >
                                                                            <option value="">-- Select Action --</option>
                                                                            <option value="Repair / Restoration">Repair / Restoration</option>
                                                                            <option value="Replacement">Replacement</option>
                                                                            <option value="Maintenance Only">Maintenance Only</option>
                                                                            <option value="Routine Repair">Routine Repair</option>
                                                                        </select>
                                                                        <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none w-5 h-5" />
                                                                    </div>
                                                                </div>

                                                                {itemData.recommend_action === 'Replacement' && (
                                                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-6 bg-rose-50 p-4 rounded-xl border-2 border-rose-100">
                                                                        <label className="text-[10px] font-black uppercase tracking-wider text-rose-500 mb-2 block ml-1">Demolition Justification</label>
                                                                        <div className="relative">
                                                                            <select value={itemData.demo_justification} onChange={(e) => handleUpdateRepairItem(category, 'demo_justification', e.target.value)}
                                                                                className="w-full bg-white border-2 border-rose-200 rounded-xl px-4 py-3.5 text-base font-bold text-rose-700 outline-none focus:border-rose-500 appearance-none cursor-pointer">
                                                                                <option value="">-- Select Justification --</option>
                                                                                <option value="Heavily damaged / Structural risk">Heavily damaged / Structural risk</option>
                                                                                <option value="Beyond economical repair">Beyond economical repair</option>
                                                                                <option value="Site relocation or right-of-way">Site relocation or right-of-way</option>
                                                                            </select>
                                                                            <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-rose-400 pointer-events-none w-5 h-5" />
                                                                        </div>
                                                                    </motion.div>
                                                                )}

                                                                <div>
                                                                    <div className="flex justify-between items-center mb-2 ml-1">
                                                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Estimated Damage</label>
                                                                    </div>
                                                                    <div className="relative pt-1 pb-6 px-1">
                                                                        <input 
                                                                            type="range" 
                                                                            min="0" max="100" step="10" 
                                                                            value={itemData.damage_ratio} 
                                                                            onChange={(e) => handleUpdateRepairItem(category, 'damage_ratio', parseInt(e.target.value))}
                                                                            className="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-amber-500" 
                                                                        />
                                                                        <span className="absolute bottom-0 right-1 text-lg font-black text-amber-600">{itemData.damage_ratio}%</span>
                                                                    </div>
                                                                </div>

                                                                <div className="pt-4 border-t border-slate-50">
                                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 ml-1">REMARKS</label>
                                                                    <textarea 
                                                                        rows="2"
                                                                        value={itemData.remarks} 
                                                                        onChange={(e) => handleUpdateRepairItem(category, 'remarks', e.target.value)}
                                                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-4 text-base font-medium text-gray-600 outline-none focus:border-amber-400 transition-all resize-none shadow-inner" 
                                                                        placeholder="Specific findings..." 
                                                                    />
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        );
                                    })}
                                </div>

                                <button onClick={handleSaveRepairRoom}
                                    className="w-full mt-6 py-4 rounded-[1.5rem] text-white font-black text-xl bg-[#E69B34] border-b-[6px] border-[#B57A28] active:border-b-0 active:translate-y-[6px] transition-all shadow-xl shadow-amber-200">
                                    Save Room Assessment ✓
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
                unitKey="unit7"
                onCopy={() => handleCopyHistoricalData(copyUnit7)}
            />
        </div>
    );
}

