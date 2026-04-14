import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FiX, FiCheckCircle, FiChevronRight, FiCheck, FiArrowLeft, FiTrash2, FiPlus, FiUnlock, FiMonitor, FiDroplet, FiSave, FiAlertTriangle, FiAlertCircle, FiWifiOff } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import SuccessModal from "../SuccessModal";
import { saveUnitDraft, getUnitDraft, clearUnitDraft, addModularToOutbox, getModularOutbox } from "../../db";
import { useAuth } from "../../context/AuthContext";
import UnitRemarkAlert from "./UnitRemarkAlert";

// ── Shared styles ─────────────────────────────────────────────────────────────
const chunkyInput = "w-full p-4 mt-2 bg-gray-50 border-2 border-gray-200 rounded-2xl text-lg font-black text-gray-700 focus:outline-none focus:border-indigo-500 focus:bg-indigo-50 transition-colors shadow-sm text-center";
const chunkySelect = "w-full p-4 mt-2 bg-gray-50 border-2 border-gray-200 rounded-2xl text-lg font-black text-gray-700 focus:outline-none focus:border-indigo-500 focus:bg-indigo-50 transition-colors shadow-sm appearance-none flex-1 text-center";
const toggleBtnBase = "flex-1 py-4 px-6 rounded-2xl font-black text-base border-2 transition-all flex items-center justify-center gap-2 shadow-sm";
const toggleBtnActive = "bg-indigo-100 border-indigo-500 text-indigo-700 shadow-indigo-100";
const toggleBtnInactive = "bg-white border-gray-200 text-gray-400 hover:bg-gray-50";

// ── Framer Motion variants ────────────────────────────────────────────────────
const slideVariants = {
    enter: { opacity: 0, x: 60, scale: 0.97 },
    center: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: -60, scale: 0.97 },
};

const expandVariants = {
    hidden: { opacity: 0, height: 0, marginTop: 0 },
    visible: { opacity: 1, height: "auto", marginTop: 8 },
};

const GRADE_LOOP = [
    { label: "Kinder", key: "kinder", emoji: "🌱" },
    { label: "Grade 1", key: "g1", emoji: "1️⃣" },
    { label: "Grade 2", key: "g2", emoji: "2️⃣" },
    { label: "Grade 3", key: "g3", emoji: "3️⃣" },
    { label: "Grade 4", key: "g4", emoji: "4️⃣" },
    { label: "Grade 5", key: "g5", emoji: "5️⃣" },
    { label: "Grade 6", key: "g6", emoji: "🖨️" }, // Use printer icon for g6 as a placeholder for school-res
];

const ICT_CATEGORIES = [
    { key: "laptops", label: "Laptops", emoji: "💻" },
    { key: "tablets", label: "Tablets", emoji: "📱" },
    { key: "desktops", label: "Desktops", emoji: "🖥️" },
    { key: "smart_tvs", label: "Smart TVs", emoji: "📺" },
    { key: "projectors", label: "Projectors", emoji: "📽️" },
    { key: "printers", label: "Printers", emoji: "🖨️" },
];

const ECART_FUNDING_SOURCES = [
    "DepEd (DCP)", "LGU / SEF", "Private Donor / NGO", "Other"
];

const WASH_CATEGORIES = [
    { key: "male_seats", label: "Male Toilet Seats", emoji: "🚹" },
    { key: "male_urinals", label: "Male Urinals", emoji: "🚻" },
    { key: "female_seats", label: "Female Toilet Seats", emoji: "🚺" },
    { key: "common_seats", label: "Common / Kinder Seats", emoji: "🚻" },
    { key: "pwd_seats", label: "PWD Toilet Seats", emoji: "♿" },
    { key: "faucets", label: "Handwashing Faucets", emoji: "🚰" },
];

const WATER_SOURCES = [
    "Piped line from local service provider",
    "Piped line + Natural Water Source",
    "Natural resources (Deep well, Spring, Rainwater)",
    "No water source"
];

const Unit6SchoolResources = ({ targetSchoolId, isReadOnly: propReadOnly }) => {
    const { user } = useAuth();
    const DEBUG_MODE = false; // Set to true for data integrity diagnostics
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [showWelcomeBack, setShowWelcomeBack] = useState(false);
    const [isCertified, setIsCertified] = useState(false);
    const [isReviewMode, setIsReviewMode] = useState(false);
    const [showDraftModal, setShowDraftModal] = useState(false);
    const [iern, setIern] = useState("");
    const [savedData, setSavedData] = useState(null);

    // Core Workflow State
    const [currentPhase, setCurrentPhase] = useState(1); 
    const [showSuccess, setShowSuccess] = useState(false);
    const [showOfflineSuccess, setShowOfflineSuccess] = useState(false);
    // PHASE 1 State
    const [gradesData, setGradesData] = useState([]);
    const [selectedGradeId, setSelectedGradeId] = useState(null);
    const [generalRoomsData, setGeneralRoomsData] = useState({
        has_general_rooms: null,
        general_rooms_count: "",
        armchair_wood_func: "", armchair_wood_broken: "",
        armchair_plastic_func: "", armchair_plastic_broken: "",
        armchair_plastic_steel_func: "", armchair_plastic_steel_broken: "",
        individual_table_chair_func: "", individual_table_chair_broken: "",
        two_seater_wood_func: "", two_seater_wood_broken: "",
        two_seater_wood_steel_func: "", two_seater_wood_steel_broken: "",
        wooden_chair_only_func: "", wooden_chair_only_broken: "",
        plastic_chair_only_func: "", plastic_chair_only_broken: "",
        has_teacher_desk: null,
    });
    
    // Phase 1 Modal State
    const [showGradeModal, setShowGradeModal] = useState(false);
    
    const initialGradeForm = {
        armchair_wood_func: "", armchair_wood_broken: "",
        armchair_plastic_func: "", armchair_plastic_broken: "",
        armchair_plastic_steel_func: "", armchair_plastic_steel_broken: "",
        individual_table_chair_func: "", individual_table_chair_broken: "",
        two_seater_wood_func: "", two_seater_wood_broken: "",
        two_seater_wood_steel_func: "", two_seater_wood_steel_broken: "",
        wooden_chair_only_func: "", wooden_chair_only_broken: "",
        plastic_chair_only_func: "", plastic_chair_only_broken: "",
        // Sharing state
        is_sharing: false,
        shared_with: [], 
        is_kinder_double_shift: false,
    };
    const [currentGradeForm, setCurrentGradeForm] = useState(initialGradeForm);

    // PHASE 2 State
    const [ictData, setIctData] = useState({
        laptops_total: "", laptops_func: "", laptops_teaching: "", laptops_working: "",
        tablets_total: "", tablets_func: "", tablets_teaching: "", tablets_working: "",
        desktops_total: "", desktops_func: "", desktops_teaching: "", desktops_working: "",
        smart_tvs_total: "", smart_tvs_func: "", smart_tvs_cond: "",
        projectors_total: "", projectors_func: "", projectors_cond: "",
        printers_total: "", printers_func: "", printers_cond: "",
    });

    // PHASE 3 State (eCart)
    const [hasEcart, setHasEcart] = useState(null);
    const [eCarts, setECarts] = useState([]);
    const [showEcartModal, setShowEcartModal] = useState(false);
    
    const initialEcartForm = {
        batches_name: "", year_received: "", sources_fund: "",
        ecart_laptops: "", ecart_tablets: "", ecart_tv: "",
        charging_condition: "", remarks: "",
    };
    const [ecartForm, setEcartForm] = useState(initialEcartForm);

    // PHASE 4 State (WASH)
    const [washData, setWashData] = useState({
        male_seats_total: "", male_seats_func: "", male_seats_cond: "",
        male_urinals_total: "", male_urinals_func: "",
        female_seats_total: "", female_seats_func: "", female_seats_cond: "",
        common_seats_total: "", common_seats_func: "", common_seats_cond: "",
        pwd_seats_total: "", pwd_seats_func: "", pwd_seats_cond: "",
        faucets_total: "", faucets_func: "", faucets_cond: "",
        water_source: "",
        confirm_no_piped: false,
        attached_cr_classrooms: "",
        attached_cr_seats: "",
        attached_cr_included_in_main: false,
        confirm_no_piped_text: "",
        confirm_zero_wash_text: "",
    });

    // PHASE 5 State (Utilities & Hardship)
    const [utilitiesData, setUtilitiesData] = useState({
        utility_electricity: "",
        confirm_no_grid: false,
        confirm_no_grid_text: "",
        has_solar_or_gen: false,
        utility_internet_yesno: null,
        utility_internet_type: "",
        confirm_no_wired: false,
        confirm_no_wired_text: "",
        utility_internet_funder: "",
    });
    const [hasMultigradeContext, setHasMultigradeContext] = useState(false);

    // Validation Confirmation State
    const [gradeValidationConfirm, setGradeValidationConfirm] = useState("");

    // ── Data Fetching ───────────────────────────────────────────────────────────
    useEffect(() => {
        const init = async () => {
            const storedId = targetSchoolId || localStorage.getItem("schoolId");
            if (!storedId) {
                setLoading(false);
                return;
            }

            try {
                // 1. GATHER ALL LOCAL SOURCES
                const outbox = await getModularOutbox().catch(() => []);
                const pendingUnit1 = outbox.find(e => e.unitId === 1 && (e.schoolId === storedId || e.payload?.schoolId === storedId || e.payload?.school_id === storedId));
                const pendingUnit2 = outbox.find(e => e.unitId === 2 && (e.schoolId === storedId || e.payload?.schoolId === storedId || e.payload?.school_id === storedId));
                const pendingUnit3 = outbox.find(e => e.unitId === 3 && (e.schoolId === storedId || e.payload?.schoolId === storedId || e.payload?.school_id === storedId));
                const pendingUnit6 = outbox.find(e => e.unitId === 6 && (e.schoolId === storedId || e.payload?.schoolId === storedId || e.payload?.school_id === storedId));
                const draft = await getUnitDraft(6, storedId);

                // 2. RECONSTRUCT SCHOOL BASELINE
                let baseline = { iern: "", total_enrollment: 0, curricular_offering: "" };
                try {
                    const res = await fetch(`/api/ph_schools/${storedId}?t=${Date.now()}`);
                    if (res.ok) {
                        const saved = await res.json();
                        if (saved.exists && saved.data) baseline = { ...baseline, ...saved.data };
                    }
                } catch (e) {
                    console.log("📍 [Unit6] Offline: Using local sources for baseline.");
                }

                // Overlay Unit 1 Sync Center Data
                if (pendingUnit1) baseline.curricular_offering = pendingUnit1.payload?.curricular_offering || baseline.curricular_offering;
                
                // Overlay Unit 2 Sync Center Data
                if (pendingUnit2) {
                    baseline.unit2_simplified_enrollment = pendingUnit2.payload?.unit2_simplified_enrollment;
                    baseline.total_enrollment = pendingUnit2.payload?.total_enrollment || baseline.total_enrollment;
                    
                    // Also multigrade groupings for Unit 6 reconstruction
                    baseline.multigrade_groupings_1 = pendingUnit2.payload?.multigrade_groupings_1;
                    baseline.multigrade_groupings_2 = pendingUnit2.payload?.multigrade_groupings_2;
                    baseline.multigrade_groupings_3 = pendingUnit2.payload?.multigrade_groupings_3;
                    
                    // Specific SPED/ALS counts
                    baseline.sped_learners_count = pendingUnit2.payload?.sped_learners_count;
                    baseline.als_community_centers_count = pendingUnit2.payload?.als_community_centers_count;
                }

                // Overlay Unit 3 Sync Center Data
                if (pendingUnit3) {
                    baseline.unit3_simplified_counts = pendingUnit3.payload?.unit3_simplified_counts;
                }

                if (baseline.iern) setIern(baseline.iern);

                // 5. MASTER PRECEDENCE: SYNC CENTER > DRAFT > DATABASE
                let d = baseline; // working copy
                if (pendingUnit6) d = { ...baseline, ...pendingUnit6.payload };

                // Reconstruct Grades Data
                const expectedGrades = [];
                const co = (d.curricular_offering || "").toLowerCase();
                let hasKinder = false, hasElem = false, hasJHS = false, hasSHS = false;
                if (co === "purely elementary") { hasKinder = true; hasElem = true; }
                else if (co === "elementary school and junior high school (k-10)") { hasKinder = true; hasElem = true; hasJHS = true; }
                else if (co === "junior high and senior high") { hasJHS = true; hasSHS = true; }
                else if (co === "all offering (k to 12)") { hasKinder = true; hasElem = true; hasJHS = true; hasSHS = true; }
                else if (co === "purely junior high school") { hasJHS = true; }
                else if (co === "purely senior high school") { hasSHS = true; }
                else {
                    hasKinder = co.includes("elementary") || co.includes("k to 10") || co.includes("k to 12") || co.includes("kinder");
                    hasElem = co.includes("elementary") || co.includes("k to 10") || co.includes("k to 12") || co.includes("k-10") || co.includes("k-12");
                    hasJHS = co.includes("junior high") || co.includes("jhs") || co.includes("k to 10") || co.includes("k to 12") || co.includes("k-10") || co.includes("k-12");
                    hasSHS = co.includes("senior high") || co.includes("shs") || co.includes("k to 12") || co.includes("k-12");
                }

                let parsedSections = [];
                if (d.unit3_simplified_counts) {
                    try { parsedSections = typeof d.unit3_simplified_counts === 'string' ? JSON.parse(d.unit3_simplified_counts) : (d.unit3_simplified_counts.array || d.unit3_simplified_counts); } catch (e) {}
                }
                let u2Parsed = [];
                if (d.unit2_simplified_enrollment) {
                    try {
                        const raw = typeof d.unit2_simplified_enrollment === 'string' ? JSON.parse(d.unit2_simplified_enrollment) : d.unit2_simplified_enrollment;
                        u2Parsed = Array.isArray(raw) ? raw : (raw.array || []);
                    } catch (e) { console.warn("U2 Parse Error", e); }
                }

                const getEnrollmentForGrade = (gradeId) => {
                    const found = u2Parsed.find(x => x.grade_level === gradeId);
                    if (found) return parseInt(found.total || 0);
                    return parseInt(d[`enroll_${gradeId}`] || 0);
                };
                const getCountForGrade = (gradeId) => {
                    const found = Array.isArray(parsedSections) ? parsedSections.find(sec => sec.grade_level === gradeId) : null;
                    if (found) return parseInt(found.total_sections || 0);
                    return parseInt(d[`sections_${gradeId}`] || 0);
                };

                const ALL_POSSIBLE_GRADES = [
                    { id: "kinder", label: "Kinder" },
                    ...['1','2','3','4','5','6','7','8','9','10','11','12'].map(lvl => ({ id: `g${lvl}`, label: `Grade ${lvl}` }))
                ];

                ALL_POSSIBLE_GRADES.forEach(pg => {
                    let isOffered = false;
                    const nid = pg.id.replace('g', '');
                    if (pg.id === 'kinder') isOffered = hasKinder;
                    else if (['1','2','3','4','5','6'].includes(nid)) isOffered = hasElem;
                    else if (['7','8','9','10'].includes(nid)) isOffered = hasJHS;
                    else if (['11','12'].includes(nid)) isOffered = hasSHS;
                    
                    const u2Grade = u2Parsed.find(x => x.grade_level === pg.id);
                    const isActive = u2Grade ? u2Grade.is_active !== false : true;

                    const enrollment = getEnrollmentForGrade(pg.id);
                    const sections = getCountForGrade(pg.id);
                    
                    if (isActive && (enrollment > 0 || sections > 0 || isOffered)) {
                        expectedGrades.push({ id: pg.id, grade_level: pg.label, enrolled: enrollment, sections: sections, isVerified: false });
                    }
                });

                const multigradeGrades = [];
                for (let i = 1; i <= 3; i++) {
                    const groupName = d[`multigrade_groupings_${i}`];
                    const groupSections = getCountForGrade(`mg_${i}`) || parseInt(d[`multigrade_sections_${i}`] || 0);
                    if (groupName && groupSections > 0) {
                        const label = groupName.toLowerCase();
                        let gradeNums = label.match(/\d+/g) || [];
                        const gradeIds = gradeNums.map(n => `g${n}`);
                        if (label.includes("kinder")) gradeIds.push("kinder");
                        let totalMgEnrollment = 0;
                        gradeIds.forEach(gid => { totalMgEnrollment += getEnrollmentForGrade(gid); });
                        multigradeGrades.push({ id: `mg_${i}`, grade_level: groupName, enrolled: totalMgEnrollment, sections: groupSections, isVerified: false, isMultigrade: true, pairs: gradeIds });
                    }
                }

                let mergedExpectedGrades = expectedGrades.filter(eg => !multigradeGrades.some(mg => mg.pairs.includes(eg.id)));
                mergedExpectedGrades.push(...multigradeGrades);
                
                const spedAlsCount = parseInt(d.sped_learners_count || 0);
                if (spedAlsCount > 0 || d.als_community_centers_count > 0) {
                    mergedExpectedGrades.push({ id: "sped_als", grade_level: "SPED/ALS", enrolled: spedAlsCount, sections: Math.max(1, parseInt(d.als_community_centers_count || 0)), isVerified: false });
                }

                // Self-contained SNED Class
                // [SNED RECONSTRUCTION FIX] - Alignment with Unit 2 Beta
                const snedSections = parseInt(d.sned_organized_class_count || d.sned_class || 0);
                const snedEnrolled = parseInt(d.sned_self_contained_count || d.sned_learners_count || 0);

                if (d.hasSnedSelfContained || snedSections > 0 || snedEnrolled > 0) {
                    mergedExpectedGrades.push({ 
                        id: "sned_self_contained", 
                        grade_level: "Self-contained SNED", 
                        enrolled: snedEnrolled, 
                        sections: Math.max(1, snedSections), 
                        isVerified: false 
                    });
                }

                mergedExpectedGrades.sort((a,b) => {
                    const getSortOrder = (id) => (id === "kinder" ? 0 : id.startsWith("g") ? parseInt(id.replace("g", "")) : id.startsWith("mg_") ? 0.5 : 100);
                    return getSortOrder(a.id) - getSortOrder(b.id);
                });

                // Phase 1 Restoration
                if (d.unit7_furniture) {
                    try {
                        const parsed = typeof d.unit7_furniture === 'string' ? JSON.parse(d.unit7_furniture) : d.unit7_furniture;
                        if (parsed.grades) {
                            parsed.grades.forEach(sg => {
                                const idx = mergedExpectedGrades.findIndex(eg => eg.id === sg.id);
                                if (idx >= 0) {
                                    if (DEBUG_MODE && (mergedExpectedGrades[idx].enrolled !== sg.enrolled || mergedExpectedGrades[idx].sections !== sg.sections)) {
                                        console.log(`[Unit6-Diag] Count mismatch for ${sg.grade_level}: FreshEnrolled=${mergedExpectedGrades[idx].enrolled}, StaleEnrolled=${sg.enrolled}`);
                                    }
                                    // eslint-disable-next-line no-unused-vars
                                    const { enrolled, sections, ...rest } = sg;
                                    mergedExpectedGrades[idx] = { ...mergedExpectedGrades[idx], ...rest, isVerified: true };
                                }
                            });
                        }
                        setGradesData(mergedExpectedGrades);
                        if (parsed.general) setGeneralRoomsData(parsed.general);
                    } catch (e) { setGradesData(mergedExpectedGrades); }
                } else {
                    setGradesData(mergedExpectedGrades);
                }

                // Phase 2,3,4,5 Restoration
                if (d.unit7_ict) { try { setIctData(prev => ({ ...prev, ...(typeof d.unit7_ict === 'string' ? JSON.parse(d.unit7_ict) : d.unit7_ict) })); } catch (e) {} }
                if (d.unit7_has_ecart !== undefined) setHasEcart(d.unit7_has_ecart);
                if (d.unit7_ecarts) { try { setECarts(typeof d.unit7_ecarts === 'string' ? JSON.parse(d.unit7_ecarts) : d.unit7_ecarts); } catch (e) {} }
                if (d.unit7_wash) { try { setWashData(prev => ({ ...prev, ...(typeof d.unit7_wash === 'string' ? JSON.parse(d.unit7_wash) : d.unit7_wash) })); } catch (e) {} }
                if (d.unit7_utilities) { try { setUtilitiesData(prev => ({ ...prev, ...(typeof d.unit7_utilities === 'string' ? JSON.parse(d.unit7_utilities) : d.unit7_utilities) })); } catch (e) {} }
                
                if (pendingUnit6) {
                    setSavedData(d);
                    setIsReviewMode(true);
                } else if (draft && !propReadOnly) {
                    console.log("🔄 [Unit 6] Restoring from Draft:", draft);
                    setCurrentPhase(draft.currentPhase || 1);
                    if (draft.gradesData) setGradesData(draft.gradesData);
                    if (draft.generalRoomsData) setGeneralRoomsData(draft.generalRoomsData);
                    if (draft.ictData) setIctData(prev => ({ ...prev, ...draft.ictData }));
                    if (draft.hasEcart !== undefined) setHasEcart(draft.hasEcart);
                    if (draft.eCarts) setECarts(draft.eCarts);
                    if (draft.washData) setWashData(prev => ({ ...prev, ...draft.washData }));
                    if (draft.utilitiesData) setUtilitiesData(prev => ({ ...prev, ...draft.utilitiesData }));
                    
                    setIsReviewMode(false);
                    setShowWelcomeBack(true);
                    setTimeout(() => setShowWelcomeBack(false), 3000);
                } else if (d.unit6_completed || propReadOnly) {
                    setSavedData(d);
                    setIsReviewMode(true);
                }
            } catch (e) {
                console.warn("Could not fetch data for Unit 6", e);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [targetSchoolId, propReadOnly]);
    const handleGradeFormChange = (e) => {
        const { name, value } = e.target;
        // Strip leading zeros unless it's just "0"
        const cleanValue = value.replace(/^0+(?!$)/, '');
        setCurrentGradeForm(prev => ({ ...prev, [name]: cleanValue }));
    };

    const handleGeneralChange = (e) => {
        const { name, value, type } = e.target;
        // Only strip leading zeros for numeric inputs
        const cleanValue = type === 'number' ? value.replace(/^0+(?!$)/, '') : value;
        setGeneralRoomsData(prev => ({ ...prev, [name]: cleanValue }));
    };

    const handleSaveGradeLevel = () => {
        const sharingPartners = currentGradeForm.is_sharing ? currentGradeForm.shared_with : [];

        setGradesData(prev => prev.map(grade => {
            // 1. Update the Current (Parent) Grade
            if (grade.id === selectedGradeId) {
                return {
                    ...grade,
                    ...currentGradeForm,
                    is_sharing_parent: currentGradeForm.is_sharing && sharingPartners.length > 0,
                    is_shared_child: false, // Parent can't be a child
                    sharing_parent_id: null,
                    is_kinder_double_shift: currentGradeForm.is_kinder_double_shift,
                    isVerified: true
                };
            }
            
            // 2. Update the Sharing Partners (Children)
            if (sharingPartners.includes(grade.id)) {
                return {
                    ...grade,
                    // Reset all counts for children as they share the parent's resources
                    armchair_wood_func: "0", armchair_wood_broken: "0",
                    armchair_plastic_func: "0", armchair_plastic_broken: "0",
                    armchair_plastic_steel_func: "0", armchair_plastic_steel_broken: "0",
                    individual_table_chair_func: "0", individual_table_chair_broken: "0",
                    two_seater_wood_func: "0", two_seater_wood_broken: "0",
                    two_seater_wood_steel_func: "0", two_seater_wood_steel_broken: "0",
                    wooden_chair_only_func: "0", wooden_chair_only_broken: "0",
                    plastic_chair_only_func: "0", plastic_chair_only_broken: "0",
                    is_sharing_parent: false,
                    is_shared_child: true,
                    sharing_parent_id: selectedGradeId,
                    isVerified: true
                };
            }
            
            return grade;
        }));

        setShowGradeModal(false);
        setSelectedGradeId(null);
        setCurrentGradeForm(initialGradeForm);
        setGradeValidationConfirm("");
    };

    const openGradeModal = (grade) => {
        // If this is a child grade, we should probably suggest editing the parent
        if (grade.is_shared_child && grade.sharing_parent_id) {
            const parent = gradesData.find(g => g.id === grade.sharing_parent_id);
            if (parent && !window.confirm(`This grade level shares resources with ${parent.grade_level}. Do you want to edit the shared resources instead?`)) {
                // If they say no, let them edit independently (break the link)
                // We'll handle breaking the link by just opening it and letting them save.
            } else if (parent) {
                // Open parent instead
                openGradeModal(parent);
                return;
            }
        }

        setSelectedGradeId(grade.id);
        setCurrentGradeForm({
            armchair_wood_func: grade.armchair_wood_func || "",
            armchair_wood_broken: grade.armchair_wood_broken || "",
            armchair_plastic_func: grade.armchair_plastic_func || "",
            armchair_plastic_broken: grade.armchair_plastic_broken || "",
            armchair_plastic_steel_func: grade.armchair_plastic_steel_func || "",
            armchair_plastic_steel_broken: grade.armchair_plastic_steel_broken || "",
            individual_table_chair_func: grade.individual_table_chair_func || "",
            individual_table_chair_broken: grade.individual_table_chair_broken || "",
            two_seater_wood_func: grade.two_seater_wood_func || "",
            two_seater_wood_broken: grade.two_seater_wood_broken || "",
            two_seater_wood_steel_func: grade.two_seater_wood_steel_func || "",
            two_seater_wood_steel_broken: grade.two_seater_wood_steel_broken || "",
            wooden_chair_only_func: grade.wooden_chair_only_func || "",
            wooden_chair_only_broken: grade.wooden_chair_only_broken || "",
            plastic_chair_only_func: grade.plastic_chair_only_func || "",
            plastic_chair_only_broken: grade.plastic_chair_only_broken || "",
            is_sharing: grade.is_sharing || (grade.is_sharing_parent && grade.shared_with?.length > 0) || false,
            shared_with: grade.shared_with || [],
            is_kinder_double_shift: grade.is_kinder_double_shift || false,
        });
        setGradeValidationConfirm("");
        setShowGradeModal(true);
    };

    const gradeStats = useMemo(() => {
        const aw  = parseInt(currentGradeForm.armchair_wood_func) || 0;
        const ap  = parseInt(currentGradeForm.armchair_plastic_func) || 0;
        const aps = parseInt(currentGradeForm.armchair_plastic_steel_func) || 0;
        const itc = parseInt(currentGradeForm.individual_table_chair_func) || 0;
        const tsw = parseInt(currentGradeForm.two_seater_wood_func) || 0;
        const tsws = parseInt(currentGradeForm.two_seater_wood_steel_func) || 0;
        const wco = parseInt(currentGradeForm.wooden_chair_only_func) || 0;
        const pco = parseInt(currentGradeForm.plastic_chair_only_func) || 0;
        
        let totalCapacity = aw + ap + aps + itc + (tsw * 2) + (tsws * 2) + wco + pco;

        // Apply Kinder Double Shift Multiplier (UI Only Calculation)
        if (selectedGradeId === 'kinder' && currentGradeForm.is_kinder_double_shift) {
            totalCapacity = totalCapacity * 2;
        }
        
        const activeGrade = gradesData.find(g => g.id === selectedGradeId);
        let totalEnrolled = activeGrade ? parseInt(activeGrade.enrolled || 0) : 0;

        // If sharing, add the enrollment of all partners
        if (currentGradeForm.is_sharing && currentGradeForm.shared_with?.length > 0) {
            currentGradeForm.shared_with.forEach(id => {
                const partner = gradesData.find(p => p.id === id);
                if (partner) totalEnrolled += parseInt(partner.enrolled || 0);
            });
        }
        
        return { capacity: totalCapacity, enrolled: totalEnrolled, diff: totalCapacity - totalEnrolled, isOk: totalCapacity >= totalEnrolled };
    }, [currentGradeForm, gradesData, selectedGradeId]);

    // Validation to proceed
    const isPhase1Valid = useMemo(() => {
        if (gradesData.length === 0) return true; // If no sections mapped at all, auto pass
        if (!gradesData.every(g => g.isVerified)) return false;
        
        if (generalRoomsData.has_general_rooms === true) {
            if (!generalRoomsData.general_rooms_count || generalRoomsData.has_teacher_desk === null) return false;
        }
        return true;
    }, [gradesData, generalRoomsData]);

    const handleMainProceed = () => { setCurrentPhase(2); window.scrollTo({ top: 0, behavior: "smooth" }); };

    // ── Phase 2 Handlers ────────────────────────────────────────────────────────
    const handleIctChange = (e) => {
        const { name, value } = e.target;
        const cleanValue = value.replace(/^0+(?!$)/, '');
        
        setIctData(prev => {
            const newState = { ...prev, [name]: cleanValue };

            // SAFEGUARD: If Total is changed to 0 or cleared, reset sub-fields
            if (name.endsWith("_total") && (cleanValue === "0" || cleanValue === "")) {
                const prefix = name.replace("_total", "");
                // Reset Working/Functional counts
                if (prev.hasOwnProperty(`${prefix}_working`)) newState[`${prefix}_working`] = cleanValue;
                if (prev.hasOwnProperty(`${prefix}_func`)) newState[`${prefix}_func`] = cleanValue;
                // Reset Personnel Usage if applicable
                if (prev.hasOwnProperty(`${prefix}_teaching`)) newState[`${prefix}_teaching`] = cleanValue;
            }

            return newState;
        });
    };

    const ictStats = useMemo(() => {
        let isValid = true; const errors = {}; const broken = {};
        ICT_CATEGORIES.forEach(cat => {
            const isAdvanced = ["laptops", "tablets", "desktops"].includes(cat.key);
            const total = parseInt(ictData[`${cat.key}_total`]) || 0;
            const func = isAdvanced ? (parseInt(ictData[`${cat.key}_working`]) || 0) : (parseInt(ictData[`${cat.key}_func`]) || 0);
            const teaching = isAdvanced ? (parseInt(ictData[`${cat.key}_teaching`]) || 0) : 0;
            const tStr = ictData[`${cat.key}_total`];
            const fStr = isAdvanced ? ictData[`${cat.key}_working`] : ictData[`${cat.key}_func`];
            const teachStr = isAdvanced ? ictData[`${cat.key}_teaching`] : "";

            if (fStr !== "" && func > total) { isValid = false; errors[cat.key] = true; } 
            else if (isAdvanced && teachStr !== "" && teaching > total) { isValid = false; errors[cat.key] = true; }
            else { errors[cat.key] = false; }
            
            broken[cat.key] = total - func;
            
            // STRICT VALIDATION: Do not allow blank (empty string) fields
            // 1. Total must be provided for every category (can be 0)
            if (tStr === "") isValid = false;
            
            // 2. Functional/Working count must be provided if Total > 0
            if (total > 0 && fStr === "") isValid = false;
            
            // 3. Teaching/Non-Teaching count must be provided if Total > 0 (Advanced only)
            if (isAdvanced && total > 0 && teachStr === "") isValid = false;

            // 4. Backward check: if sub-field is provided but total is blank
            if (tStr === "" && fStr !== "") isValid = false;
        });
        return { isValid, errors, broken };
    }, [ictData]);

    const handlePhase2Proceed = () => { setCurrentPhase(3); window.scrollTo({ top: 0, behavior: "smooth" }); };

    // ── Phase 3 Handlers (eCart) ────────────────────────────────────────────────
    const handleEcartFormChange = (e) => {
        const { name, value, type } = e.target;
        const cleanValue = (type === 'number') ? value.replace(/^0+(?!$)/, '') : value;
        setEcartForm(prev => ({ ...prev, [name]: cleanValue }));
    };

    const handleSaveEcart = () => {
        if (!ecartForm.batches_name || !ecartForm.year_received || !ecartForm.sources_fund || !ecartForm.charging_condition) {
            alert("Please complete required package details and the charging condition toggle.");
            return;
        }
        setECarts(prev => [...prev, { ...ecartForm, id: Date.now().toString() }]);
        setShowEcartModal(false);
        setEcartForm(initialEcartForm);
    };

    const deleteEcart = (id) => {
        setECarts(prev => prev.filter(cart => cart.id !== id));
    };

    const isPhase3Valid = useMemo(() => (hasEcart === false) || (hasEcart === true && eCarts.length > 0), [hasEcart, eCarts]);
    const handlePhase3Proceed = () => { setCurrentPhase(4); window.scrollTo({ top: 0, behavior: "smooth" }); };

    // ── Phase 4 Handlers (WASH) ─────────────────────────────────────────────────
    const handleWashChange = (e) => {
        const { name, value, type, checked } = e.target;
        const cleanValue = (type === 'number') ? value.replace(/^0+(?!$)/, '') : value;
        
        setWashData(prev => {
            const newState = { 
                ...prev, 
                [name]: type === 'checkbox' ? checked : cleanValue 
            };

            // SAFEGUARD: If Total is changed to 0 or cleared, reset functional counterpart
            if (name.endsWith("_total") && (cleanValue === "0" || cleanValue === "")) {
                const funcName = name.replace("_total", "_func");
                if (prev.hasOwnProperty(funcName)) {
                    newState[funcName] = cleanValue; // Sync (0 or empty)
                }
            }

            return newState;
        });
    };

    const washStats = useMemo(() => {
        let isValid = true; const errors = {};
        WASH_CATEGORIES.forEach(cat => {
            const total = parseInt(washData[`${cat.key}_total`]) || 0;
            const func = parseInt(washData[`${cat.key}_func`]) || 0;
            const tStr = washData[`${cat.key}_total`];
            const fStr = washData[`${cat.key}_func`];

            // 1. All total fields must be filled (no blanks)
            if (tStr === "") isValid = false;

            // 2. Functional check
            if (fStr !== "" && func > total) { isValid = false; errors[cat.key] = true; } 
            else { errors[cat.key] = false; }

            // 3. Breakdown check (if total > 0, working count is required)
            const needsBreakdown = ["male_seats", "female_seats", "common_seats", "pwd_seats", "faucets", "male_urinals"].includes(cat.key);
            if (needsBreakdown && total > 0 && fStr === "") isValid = false;

            // 4. Backward check
            if (tStr === "" && fStr !== "") isValid = false;
        });

        // 5. Attached CR fields must be filled
        if (washData.attached_cr_classrooms === "") isValid = false;
        if (washData.attached_cr_seats === "") isValid = false;

        if (!washData.water_source) isValid = false;
        
        // Critical Status Validation for Water
        if (washData.water_source === "Natural resources (Deep well, Spring, Rainwater)" || washData.water_source === "No water source") {
            if ((washData.confirm_no_piped_text || "").trim().toLowerCase() !== "confirm") isValid = false;
        }
        
        return { isValid, errors };
    }, [washData]);

    const handlePhase4Proceed = () => { setCurrentPhase(5); window.scrollTo({ top: 0, behavior: "smooth" }); };

    // ── Phase 5 Handlers (Utilities & Hardship) ─────────────────────────────────
    const handleUtilitiesChange = (e) => {
        const { name, value, type, checked } = e.target;
        setUtilitiesData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const isPhase5Valid = useMemo(() => {
        if (!utilitiesData.utility_electricity) return false;
        if (utilitiesData.utility_internet_yesno === null) return false;
        if (utilitiesData.utility_internet_yesno === true && !utilitiesData.utility_internet_funder) return false;
        
        // Critical Status Validation for Electricity
        if (utilitiesData.utility_electricity === "No electricity" || utilitiesData.utility_electricity === "Off-grid supply") {
            if ((utilitiesData.confirm_no_grid_text || "").trim().toLowerCase() !== "confirm") return false;
        }

        // Critical Status Validation for Internet
        if (utilitiesData.utility_internet_yesno === false || (utilitiesData.utility_internet_yesno === true && utilitiesData.utility_internet_type && utilitiesData.utility_internet_type !== "Wired (Fiber/DSL/Cable)")) {
            if ((utilitiesData.confirm_no_wired_text || "").trim().toLowerCase() !== "confirm") return false;
        }

        return true;
    }, [utilitiesData]);

    const handleSaveDraftAndExit = async () => {
        console.log("💾 [Unit 6] handleSaveDraftAndExit triggered");
        const storedId = targetSchoolId || localStorage.getItem("schoolId");
        if (!storedId) {
            console.error("❌ [Unit 6] No schoolId found for saving draft!");
            return;
        }

        try {
            const draftData = {
                currentPhase,
                gradesData,
                generalRoomsData,
                ictData,
                hasEcart,
                eCarts,
                washData,
                utilitiesData
            };
            console.log("📝 [Unit 6] Saving Draft Payload:", draftData);
            await saveUnitDraft(6, storedId, draftData);
            console.log("✅ [Unit 6] Draft saved successfully.");
            navigate("/modular-dashboard");
        } catch (err) {
            console.error("❌ [Unit 6] Failed to save draft:", err);
            alert("Draft saving failed. Please check your connection or storage.");
        }
    };

    const handleFinalSubmit = async () => {
        // STRICT VALIDATION: Check if any grade levels have been audited
        const auditedCount = gradesData.filter(g => g.isVerified).length;
        if (auditedCount === 0 && gradesData.length > 0) {
            alert("Warning: You must audit at least one Grade Level in Phase 1 before marking this unit as accomplished.");
            setCurrentPhase(1);
            return;
        }

        setLoading(true);
        const storedId = localStorage.getItem("schoolId");
        
        try {
            const payload = {
                unit7_furniture: JSON.stringify({ grades: gradesData.filter(g => g.isVerified), general: generalRoomsData }),
                unit7_ict: JSON.stringify(ictData),
                unit7_has_ecart: hasEcart,
                unit7_ecarts: JSON.stringify(eCarts),
                unit7_wash: JSON.stringify(washData),
                unit7_utilities: JSON.stringify(utilitiesData),
                unit6_completed: true,
                u7_ict_smart_tv_cond: ictData.smart_tvs_cond,
                u7_ict_projector_cond: ictData.projectors_cond,
                u7_ict_printer_cond: ictData.printers_cond,
                u7_wash_male_seats_cond: washData.male_seats_cond,
                u7_wash_female_seats_cond: washData.female_seats_cond,
                u7_wash_common_seats_cond: washData.common_seats_cond,
                u7_wash_pwd_seats_cond: washData.pwd_seats_cond,
                u7_wash_faucets_cond: washData.faucets_cond,
                u7_confirm_no_grid: (utilitiesData.confirm_no_grid_text || "").trim().toLowerCase() === "confirm",
                u7_confirm_no_piped: (washData.confirm_no_piped_text || "").trim().toLowerCase() === "confirm",
                u7_confirm_zero_wash: (washData.confirm_zero_wash_text || "").trim().toLowerCase() === "confirm",
                u7_confirm_no_wired: (utilitiesData.confirm_no_wired_text || "").trim().toLowerCase() === "confirm",
                u7_utility_internet_type: utilitiesData.utility_internet_type,
                iern: iern
            };

            if (!navigator.onLine) {
                await addModularToOutbox({
                    unitId: 6,
                    label: "Unit 6: School Resources (Furniture, ICT, WASH)",
                    url: `/api/ph_schools/${storedId}`,
                    method: 'PUT',
                    payload: payload,
                    schoolId: storedId
                });
                await clearUnitDraft(6, storedId);
                
                // Update local quest progress
                const stored = localStorage.getItem('quest_progress');
                let progress = stored ? JSON.parse(stored) : { completedUnits: [], xp: 0 };
                if (!progress.completedUnits.includes(6)) {
                    progress.completedUnits.push(6);
                    progress.xp = (progress.xp || 0) + 500;
                    localStorage.setItem('quest_progress', JSON.stringify(progress));
                }
                
                setShowOfflineSuccess(true);
                return;
            }

            const res = await fetch(`/api/ph_schools/${storedId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                // Perform secondary syncs in parallel
                try {
                    await fetch(`/api/ph_schools/unit9/${storedId}/ecarts`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ecarts: eCarts })
                    });
                } catch (e) { console.warn("Relational eCart sync failed", e); }

                // Update local quest progress
                const stored = localStorage.getItem('quest_progress');
                let progress = stored ? JSON.parse(stored) : { completedUnits: [], xp: 0 };
                if (!progress.completedUnits.includes(6)) {
                    progress.completedUnits.push(6);
                    progress.xp = (progress.xp || 0) + 500;
                    localStorage.setItem('quest_progress', JSON.stringify(progress));
                }

                // Sync progress to dashboard
                try {
                    await fetch('/api/user/progress', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ unitId: 6, schoolId: storedId })
                    });
                } catch (e) { console.warn("Progress sync failed", e); }

                await clearUnitDraft(6, storedId);
                setShowSuccess(true);
            } else {
                throw new Error("Failed to save data on server");
            }
        } catch (e) {
            console.error("UNIT 6 SUBMIT ERROR:", e);
            if (!navigator.onLine || e.message.includes('fetch') || e.message.includes('Network error')) {
                await addModularToOutbox({
                    unitId: 6,
                    label: "Unit 6: School Resources (Furniture, ICT, WASH)",
                    url: `/api/ph_schools/${storedId}`,
                    method: 'PUT',
                    payload: { ...payload, unit6_completed: true },
                    schoolId: storedId
                });
                await clearUnitDraft(6, storedId);
                setShowOfflineSuccess(true);
            } else {
                alert("Error saving resources: " + e.message);
            }
        } finally {
            setLoading(false);
        }
    };

    // ── Header Progress Logic ───────────────────────────────────────────────────
    const progressWidth = useMemo(() => {
        if (currentPhase === 1) return `20%`;
        if (currentPhase === 2) return `40%`;
        if (currentPhase === 3) return `60%`;
        if (currentPhase === 4) return `80%`;
        return `100%`;
    }, [currentPhase]);


    // ── Render ──────────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <p className="text-gray-400 font-bold">Loading classrooms...</p>
            </div>
        );
    }

    if (isReviewMode) {
        const totalUnitsICT = ICT_CATEGORIES.reduce((acc, cat) => acc + (parseInt(ictData[`${cat.key}_total`]) || 0), 0);
        const totalWASH = WASH_CATEGORIES.reduce((acc, cat) => acc + (parseInt(washData[`${cat.key}_total`]) || 0), 0);
        
        return (
            <div className="min-h-screen bg-slate-50/50 font-sans pb-40">
                {/* Exit Header */}
                {!propReadOnly && (
                    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm shadow-[0_2px_12px_rgba(0,0,0,0.04)] px-4 py-3">
                        <div className="max-w-md mx-auto flex items-center gap-3">
                            <button onClick={() => navigate("/modular-dashboard")} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600">
                                <FiArrowLeft className="w-6 h-6" />
                            </button>
                            <div className="flex-1 text-center">
                                <div className="text-[10px] font-black tracking-widest text-indigo-400 uppercase">Unit 6</div>
                                <h1 className="text-sm font-black text-gray-800">School Resources</h1>
                            </div>
                            <div className="w-10" />
                        </div>
                    </header>
                )}

                <div className="max-w-md mx-auto mt-4 px-4 space-y-10">
                    <UnitRemarkAlert unitId="u6" schoolId={targetSchoolId || user?.school_id || localStorage.getItem('schoolId')} />
                    {/* Header */}
                    <div className="text-center mb-10">
                        <motion.div 
                            initial={{ scale: 0 }} 
                            animate={{ scale: 1 }} 
                            className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-[2rem] mx-auto mb-6 flex items-center justify-center shadow-xl shadow-indigo-100"
                        >
                            <span className="text-4xl text-white">🎒</span>
                        </motion.div>
                        <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-[0.2em] mb-3 shadow-sm border border-indigo-100">
                            Unit 6 • Inventory Profile
                        </span>
                        <h1 className="text-3xl font-black text-slate-800 leading-tight tracking-tight">Resources Summary</h1>
                        <p className="text-slate-500 font-medium mt-2 italic">"Physical assets and utility infrastructure report"</p>
                    </div>

                    {/* High Level Metrics */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-900 rounded-[2.5rem] p-6 text-white shadow-xl relative overflow-hidden group">
                             <div className="absolute -right-4 -bottom-4 text-6xl opacity-10 rotate-12 group-hover:rotate-0 transition-transform duration-700">💻</div>
                             <p className="text-indigo-300 text-[8px] font-black uppercase tracking-widest mb-1">ICT Assets</p>
                             <div className="flex items-baseline gap-1">
                                 <span className="text-3xl font-black">{totalUnitsICT}</span>
                                 <span className="text-[10px] font-bold text-indigo-400">UNITS</span>
                             </div>
                        </div>
                        <div className="bg-indigo-600 rounded-[2.5rem] p-6 text-white shadow-xl relative overflow-hidden group">
                             <div className="absolute -right-4 -bottom-4 text-6xl opacity-10 rotate-12 group-hover:rotate-0 transition-transform duration-700">🚰</div>
                             <p className="text-indigo-100 text-[8px] font-black uppercase tracking-widest mb-1">WASH Fixtures</p>
                             <div className="flex items-baseline gap-1">
                                 <span className="text-3xl font-black">{totalWASH}</span>
                                 <span className="text-[10px] font-bold text-indigo-200">TOTAL</span>
                             </div>
                        </div>
                    </div>

                    {/* ── SEATING & FURNITURE ── */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 px-2">
                            <div className="w-1.5 h-6 bg-amber-500 rounded-full" />
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Seating Inventory</h3>
                        </div>
                        
                        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                            <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Shared Classrooms</span>
                                <span className="bg-white px-3 py-1 rounded-full border border-slate-200 text-xs font-black text-slate-700">
                                    {generalRoomsData.general_rooms_count || 0} ROOMS
                                </span>
                            </div>
                            <div className="p-6 space-y-4">
                                {gradesData.filter(g => g.isVerified).map(g => {
                                    const total = (parseInt(g.armchair_wood_func)||0) + (parseInt(g.armchair_plastic_func)||0) + (parseInt(g.armchair_plastic_steel_func)||0) + (parseInt(g.individual_table_chair_func)||0) + ((parseInt(g.two_seater_wood_func)||0)*2) + ((parseInt(g.two_seater_wood_steel_func)||0)*2) + (parseInt(g.wooden_chair_only_func)||0) + (parseInt(g.plastic_chair_only_func)||0);
                                    
                                    // Logic for shortage in review mode
                                    let enrolledCount = parseInt(g.enrolled)||0;
                                    let subtitle = `${g.enrolled} Enrolled · ${total} Functional Seats`;
                                    let isParent = g.is_sharing_parent && g.shared_with?.length > 0;
                                    let isChild = g.is_shared_child;

                                    if (isParent) {
                                        g.shared_with.forEach(id => {
                                            const p = gradesData.find(x => x.id === id);
                                            if (p) enrolledCount += parseInt(p.enrolled || 0);
                                        });
                                        subtitle = `Shared with ${g.shared_with.length} grades · ${total} Total Seats`;
                                    } else if (isChild) {
                                        const parent = gradesData.find(p => p.id === g.sharing_parent_id);
                                        subtitle = `Shares seats with ${parent ? parent.grade_level : 'another grade'}`;
                                    }

                                    const shortage = !isChild && total < enrolledCount;

                                    return (
                                        <div key={g.id} className="flex items-center justify-between group">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black ${isChild ? 'bg-indigo-50 text-indigo-400' : 'bg-slate-50 text-slate-400'}`}>
                                                    {isChild ? "🔗" : g.grade_level.slice(0,3).toUpperCase()}
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-slate-800 text-[13px]">{g.grade_level}</h4>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                                        {subtitle}
                                                    </p>
                                                </div>
                                            </div>
                                            {isChild ? (
                                                <div className="bg-indigo-50 text-indigo-500 p-2 rounded-lg">
                                                    <FiCheckCircle className="w-4 h-4" />
                                                </div>
                                            ) : shortage ? (
                                                <div className="bg-rose-50 text-rose-600 p-2 rounded-lg" title="Shortage">
                                                    <FiAlertTriangle className="w-4 h-4" />
                                                </div>
                                            ) : (
                                                <div className="bg-emerald-50 text-emerald-600 p-2 rounded-lg">
                                                    <FiCheckCircle className="w-4 h-4" />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </section>

                    {/* ── ICT BREAKDOWN ── */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 px-2">
                            <div className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">ICT Distribution</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {ICT_CATEGORIES.map(cat => {
                                const total = parseInt(ictData[`${cat.key}_total`]) || 0;
                                const func = parseInt(ictData[`${cat.key}_func`]) || 0;
                                if (total === 0) return null;
                                return (
                                    <div key={cat.key} className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col items-center group">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-xl mb-3 group-hover:scale-110 transition-transform duration-500">
                                            {cat.emoji}
                                        </div>
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{cat.label}</span>
                                        <div className="mt-1 flex items-baseline gap-1">
                                            <span className="text-lg font-black text-slate-800">{func}</span>
                                            <span className="text-[9px] font-bold text-slate-300">/ {total}</span>
                                        </div>
                                        <div className="w-full bg-slate-50 h-1 rounded-full mt-3 overflow-hidden">
                                            <div className="h-full bg-indigo-500" style={{ width: `${(func/total)*100}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {/* ── MOBILE LABS (eCARTS) ── */}
                    {hasEcart && (
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 px-2">
                                <div className="w-1.5 h-6 bg-rose-500 rounded-full" />
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">eCart Packages</h3>
                            </div>
                            <div className="space-y-3">
                                {eCarts.map((cart, idx) => (
                                    <div key={idx} className="bg-white rounded-[2rem] p-6 border border-rose-100 shadow-sm relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-4 text-4xl opacity-5 group-hover:scale-110 transition-transform">🛒</div>
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h4 className="font-black text-slate-800 text-lg leading-tight uppercase tracking-tight">{cart.batches_name}</h4>
                                                <p className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.15em]">{cart.sources_fund} · {cart.year_received}</p>
                                            </div>
                                            <div className={`px-3 py-1 rounded-full border text-[9px] font-black uppercase ${cart.charging_condition === 'Functional' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-rose-50 border-rose-100 text-rose-600'}`}>
                                                {cart.charging_condition}
                                            </div>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="flex flex-col items-center">
                                                <span className="text-[9px] font-bold text-slate-300 uppercase">Laptops</span>
                                                <span className="font-black text-slate-700">{cart.ecart_laptops || 0}</span>
                                            </div>
                                            <div className="w-px h-8 bg-slate-100" />
                                            <div className="flex flex-col items-center">
                                                <span className="text-[9px] font-bold text-slate-300 uppercase">Tablets</span>
                                                <span className="font-black text-slate-700">{cart.ecart_tablets || 0}</span>
                                            </div>
                                            <div className="w-px h-8 bg-slate-100" />
                                            <div className="flex flex-col items-center">
                                                <span className="text-[9px] font-bold text-slate-300 uppercase">TVs</span>
                                                <span className="font-black text-slate-700">{cart.ecart_tv || 0}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* ── WASH & UTILITIES ── */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 px-2">
                            <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Wash & Utilities</h3>
                        </div>
                        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 space-y-8">
                            <div className="flex flex-col items-center text-center">
                                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-2xl mb-3 shadow-inner">⚡</div>
                                <h4 className="text-lg font-black text-slate-800">{utilitiesData.utility_electricity || "Non-Electrified"}</h4>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Power Source Availability</p>
                                {utilitiesData.has_solar_or_gen && (
                                    <span className="mt-3 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-xl text-[9px] font-black uppercase border border-amber-100">
                                        Active Solar / Gen Set
                                    </span>
                                )}
                            </div>

                            <div className="h-px w-full bg-slate-50" />

                            <div className="flex flex-col items-center text-center">
                                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-2xl mb-3 shadow-inner">🌐</div>
                                <h4 className="text-lg font-black text-slate-800">
                                    {utilitiesData.utility_internet_yesno ? "Fully Connected" : "No Internet"}
                                </h4>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                    {utilitiesData.utility_internet_yesno ? utilitiesData.utility_internet_funder : "Zero Connectivity"}
                                </p>
                            </div>

                            <div className="h-px w-full bg-slate-50" />

                            <div className="grid grid-cols-2 gap-6">
                                <div className="text-center">
                                    <p className="text-2xl font-black text-emerald-600">{washData.attached_cr_classrooms || 0}</p>
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Attached CRs</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-2xl font-black text-indigo-600">{utilitiesData.sha_category || "N/A"}</p>
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">SHA Category</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {!propReadOnly && (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="mt-12"
                        >
                            <button 
                                onClick={() => { setIsReviewMode(false); setCurrentPhase(1); }}
                                className="group relative w-full py-6 rounded-[2rem] bg-white border-4 border-indigo-100 text-indigo-700 font-black text-lg shadow-xl shadow-indigo-100/50 hover:border-indigo-200 hover:bg-indigo-50 transition-all duration-300 overflow-hidden flex items-center justify-center gap-3"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-indigo-500/5 to-indigo-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <FiUnlock className="w-5 h-5 text-indigo-700" />
                                </div>
                                <span>Unlock to Edit Resources</span>
                            </button>
                        </motion.div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-gray-50 to-gray-200 flex flex-col font-sans">
            {/* Header */}
            {!propReadOnly && (
                <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm shadow-[0_2px_12px_rgba(0,0,0,0.04)] px-4 py-3 pb-4">
                    <div className="max-w-md mx-auto flex items-center gap-3">
                        <button onClick={() => {
                            if (currentPhase > 1) {
                                setCurrentPhase(p => p - 1);
                            } else {
                                navigate("/modular-dashboard");
                            }
                        }} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600">
                            <FiArrowLeft className="w-6 h-6" />
                        </button>
                        <div className="mx-4 h-4 bg-gray-200 rounded-full overflow-hidden flex-1">
                            <motion.div
                                className="h-full bg-indigo-500 rounded-full"
                                animate={{ width: progressWidth }}
                                transition={{ duration: 0.4 }}
                            />
                        </div>
                    </div>
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

            <main className="flex-1 overflow-x-hidden pb-32">
                <div className="max-w-md mx-auto w-full px-4 mt-4">
                    <UnitRemarkAlert unitId="u6" schoolId={targetSchoolId || user?.school_id || localStorage.getItem('schoolId')} />
                </div>
                <div className="max-w-md w-full mx-auto relative px-6 mt-8">
                    <AnimatePresence mode="wait">
                        
                        {/* ══════════════════════════════════════════════════════
                            PHASE 1: GRADE LEVEL DASHBOARD & GENERAL ROOMS
                            ══════════════════════════════════════════════════════ */}
                        {currentPhase === 1 && (
                            <motion.div key="p1-dashboard" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 bg-indigo-100 rounded-2xl flex items-center justify-center text-xl">🪑</div>
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-widest text-indigo-400">Phase 1</p>
                                        <h2 className="text-2xl font-black text-gray-800 leading-tight">Grade Level Inventory</h2>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-400 mb-8">Catalog your physical facilities grouped by Grade Level, plus any general shared rooms.</p>

                                <div className="flex items-center justify-between mb-4 mt-2">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Mapped Grade Levels</h3>
                                    <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded-lg">{gradesData.filter(g => g.isVerified).length} / {gradesData.length} Audited</span>
                                </div>

                                {gradesData.length === 0 ? (
                                    <div className="bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-3xl p-6 text-center mb-4">
                                        <p className="text-indigo-400 font-bold mb-1">No learners tracked yet.</p>
                                        <p className="text-xs text-indigo-300">Once you add sections in Units 2/3, they will appear here automatically.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3 mb-4">
                                        {gradesData.map((item) => {
                                            const isChild = item.is_shared_child;
                                            const parent = isChild ? gradesData.find(p => p.id === item.sharing_parent_id) : null;

                                            return (
                                                <motion.div 
                                                    key={item.id} 
                                                    onClick={() => openGradeModal(item)}
                                                    initial={{ opacity: 0, y: 10 }} 
                                                    animate={{ opacity: 1, y: 0 }} 
                                                    className={`bg-white border-2 rounded-2xl p-4 flex items-center justify-between shadow-sm cursor-pointer transition-all active:scale-95 ${item.isVerified ? (isChild ? 'border-indigo-100 opacity-90' : 'border-emerald-200') : 'border-amber-200 hover:border-amber-300'}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${isChild ? 'bg-indigo-50 text-indigo-400' : (item.isVerified ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-500')}`}>
                                                            {isChild ? "🔗" : (item.isVerified ? <FiCheckCircle className="w-6 h-6" /> : "⚠️")}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-gray-800 text-base leading-tight">{item.grade_level}</p>
                                                            <p className="text-xs font-medium text-gray-400 mt-0.5">
                                                                {isChild ? `Shares seats with ${parent ? parent.grade_level : 'another grade'}` : `${item.enrolled} Enrolled · ${item.sections} Sections`}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className={`px-3 py-1 mr-2 rounded-lg text-xs font-black uppercase tracking-wider ${isChild ? 'bg-indigo-100 text-indigo-700' : (item.isVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}`}>
                                                        {isChild ? "Shared" : (item.isVerified ? "Verified" : "Audit")}
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* GENERAL ROOM GATEKEEPER */}
                                <div className="bg-white border-2 border-gray-100 rounded-3xl p-5 shadow-sm mt-8 mb-6">
                                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">General Classrooms</h3>
                                    <p className="text-sm font-bold text-gray-700 mb-4">Are there any General Classrooms in this school? (Shared rooms with no specific advisory, e.g. Labs, Library)</p>
                                    <div className="flex gap-3">
                                        <button onClick={() => setGeneralRoomsData(p => ({...p, has_general_rooms: true}))} className={`${toggleBtnBase} ${generalRoomsData.has_general_rooms === true ? toggleBtnActive : toggleBtnInactive}`}><span>👍</span> Yes</button>
                                        <button onClick={() => setGeneralRoomsData(p => ({...p, has_general_rooms: false}))} className={`${toggleBtnBase} ${generalRoomsData.has_general_rooms === false ? toggleBtnActive : toggleBtnInactive}`}><span>👎</span> No</button>
                                    </div>
                                    
                                    <AnimatePresence>
                                        {generalRoomsData.has_general_rooms === true && (
                                            <motion.div variants={expandVariants} initial="hidden" animate="visible" exit="hidden" className="overflow-hidden pt-4 mt-4 border-t border-gray-100 space-y-5">
                                                <div>
                                                    <p className="text-xs font-bold text-gray-500 mb-1 ml-1">Total General Rooms</p>
                                                    <input type="number" name="general_rooms_count" value={generalRoomsData.general_rooms_count} onChange={handleGeneralChange} min="1" placeholder="0" className={`${chunkyInput} !mt-0 !text-left !px-5`} />
                                                </div>

                                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest border-b border-gray-50 pb-2">Shared Seating Capacity (Total across all {generalRoomsData.general_rooms_count || '...'} rooms)</h3>

                                                <div>
                                                    <p className="text-sm font-bold text-gray-700 mb-2">Armchair — Wood 🪑</p>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div><p className="text-[10px] font-black text-emerald-500 uppercase text-center mb-1">Functional</p><input type="number" name="armchair_wood_func" value={generalRoomsData.armchair_wood_func} onChange={handleGeneralChange} min="0" placeholder="0" className={`${chunkyInput} !bg-emerald-50 text-emerald-700 focus:!border-emerald-400 !mt-0`} /></div>
                                                        <div><p className="text-[10px] font-black text-red-500 uppercase text-center mb-1">Broken</p><input type="number" name="armchair_wood_broken" value={generalRoomsData.armchair_wood_broken} onChange={handleGeneralChange} min="0" placeholder="0" className={`${chunkyInput} !bg-red-50 text-red-700 focus:!border-red-400 !mt-0`} /></div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-700 mb-2">Armchair — Plastic 🪑</p>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div><p className="text-[10px] font-black text-emerald-500 uppercase text-center mb-1">Functional</p><input type="number" name="armchair_plastic_func" value={generalRoomsData.armchair_plastic_func} onChange={handleGeneralChange} min="0" placeholder="0" className={`${chunkyInput} !bg-emerald-50 text-emerald-700 focus:!border-emerald-400 !mt-0`} /></div>
                                                        <div><p className="text-[10px] font-black text-red-500 uppercase text-center mb-1">Broken</p><input type="number" name="armchair_plastic_broken" value={generalRoomsData.armchair_plastic_broken} onChange={handleGeneralChange} min="0" placeholder="0" className={`${chunkyInput} !bg-red-50 text-red-700 focus:!border-red-400 !mt-0`} /></div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-700 mb-2">Individual Table &amp; Chair 🪑</p>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div><p className="text-[10px] font-black text-emerald-500 uppercase text-center mb-1">Functional</p><input type="number" name="individual_table_chair_func" value={generalRoomsData.individual_table_chair_func} onChange={handleGeneralChange} min="0" placeholder="0" className={`${chunkyInput} !bg-emerald-50 text-emerald-700 focus:!border-emerald-400 !mt-0`} /></div>
                                                        <div><p className="text-[10px] font-black text-red-500 uppercase text-center mb-1">Broken</p><input type="number" name="individual_table_chair_broken" value={generalRoomsData.individual_table_chair_broken} onChange={handleGeneralChange} min="0" placeholder="0" className={`${chunkyInput} !bg-red-50 text-red-700 focus:!border-red-400 !mt-0`} /></div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-700 mb-2">Armchair — Plastic / Steel 🪑</p>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div><p className="text-[10px] font-black text-emerald-500 uppercase text-center mb-1">Functional</p><input type="number" name="armchair_plastic_steel_func" value={generalRoomsData.armchair_plastic_steel_func} onChange={handleGeneralChange} min="0" placeholder="0" className={`${chunkyInput} !bg-emerald-50 text-emerald-700 focus:!border-emerald-400 !mt-0`} /></div>
                                                        <div><p className="text-[10px] font-black text-red-500 uppercase text-center mb-1">Broken</p><input type="number" name="armchair_plastic_steel_broken" value={generalRoomsData.armchair_plastic_steel_broken} onChange={handleGeneralChange} min="0" placeholder="0" className={`${chunkyInput} !bg-red-50 text-red-700 focus:!border-red-400 !mt-0`} /></div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-700 mb-2">2-Seater — Wood <span className="text-xs text-indigo-400 font-normal">(×2 capacity)</span></p>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div><p className="text-[10px] font-black text-emerald-500 uppercase text-center mb-1">Functional</p><input type="number" name="two_seater_wood_func" value={generalRoomsData.two_seater_wood_func} onChange={handleGeneralChange} min="0" placeholder="0" className={`${chunkyInput} !bg-emerald-50 text-emerald-700 focus:!border-emerald-400 !mt-0`} /></div>
                                                        <div><p className="text-[10px] font-black text-red-500 uppercase text-center mb-1">Broken</p><input type="number" name="two_seater_wood_broken" value={generalRoomsData.two_seater_wood_broken} onChange={handleGeneralChange} min="0" placeholder="0" className={`${chunkyInput} !bg-red-50 text-red-700 focus:!border-red-400 !mt-0`} /></div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-700 mb-2">2-Seater — Wood / Steel <span className="text-xs text-indigo-400 font-normal">(×2 capacity)</span></p>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div><p className="text-[10px] font-black text-emerald-500 uppercase text-center mb-1">Functional</p><input type="number" name="two_seater_wood_steel_func" value={generalRoomsData.two_seater_wood_steel_func} onChange={handleGeneralChange} min="0" placeholder="0" className={`${chunkyInput} !bg-emerald-50 text-emerald-700 focus:!border-emerald-400 !mt-0`} /></div>
                                                        <div><p className="text-[10px] font-black text-red-500 uppercase text-center mb-1">Broken</p><input type="number" name="two_seater_wood_steel_broken" value={generalRoomsData.two_seater_wood_steel_broken} onChange={handleGeneralChange} min="0" placeholder="0" className={`${chunkyInput} !bg-red-50 text-red-700 focus:!border-red-400 !mt-0`} /></div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-700 mb-2">Wooden Chair Only 🪑</p>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div><p className="text-[10px] font-black text-emerald-500 uppercase text-center mb-1">Functional</p><input type="number" name="wooden_chair_only_func" value={generalRoomsData.wooden_chair_only_func} onChange={handleGeneralChange} min="0" placeholder="0" className={`${chunkyInput} !bg-emerald-50 text-emerald-700 focus:!border-emerald-400 !mt-0`} /></div>
                                                        <div><p className="text-[10px] font-black text-red-500 uppercase text-center mb-1">Broken</p><input type="number" name="wooden_chair_only_broken" value={generalRoomsData.wooden_chair_only_broken} onChange={handleGeneralChange} min="0" placeholder="0" className={`${chunkyInput} !bg-red-50 text-red-700 focus:!border-red-400 !mt-0`} /></div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-700 mb-2">Plastic Chair Only 🪑</p>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div><p className="text-[10px] font-black text-emerald-500 uppercase text-center mb-1">Functional</p><input type="number" name="plastic_chair_only_func" value={generalRoomsData.plastic_chair_only_func} onChange={handleGeneralChange} min="0" placeholder="0" className={`${chunkyInput} !bg-emerald-50 text-emerald-700 focus:!border-emerald-400 !mt-0`} /></div>
                                                        <div><p className="text-[10px] font-black text-red-500 uppercase text-center mb-1">Broken</p><input type="number" name="plastic_chair_only_broken" value={generalRoomsData.plastic_chair_only_broken} onChange={handleGeneralChange} min="0" placeholder="0" className={`${chunkyInput} !bg-red-50 text-red-700 focus:!border-red-400 !mt-0`} /></div>
                                                    </div>
                                                </div>
                                                
                                                <div className="pt-2">
                                                    <p className="text-sm font-bold text-gray-700 mb-4">Do all of these general rooms have functional teacher stations?</p>
                                                    <div className="flex gap-3">
                                                        <button onClick={() => setGeneralRoomsData(p => ({...p, has_teacher_desk: true}))} className={`${toggleBtnBase} ${generalRoomsData.has_teacher_desk === true ? toggleBtnActive : toggleBtnInactive}`}><span>👍</span> Yes, all have</button>
                                                        <button onClick={() => setGeneralRoomsData(p => ({...p, has_teacher_desk: false}))} className={`${toggleBtnBase} ${generalRoomsData.has_teacher_desk === false ? toggleBtnActive : toggleBtnInactive}`}><span>👎</span> No / Some missing</button>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </motion.div>
                        )}


                        {/* ══════════════════════════════════════════════════════
                            PHASE 2: ICT EQUIPMENT
                            ══════════════════════════════════════════════════════ */}
                        {currentPhase === 2 && (
                            <motion.div key="p2" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 bg-indigo-100 rounded-2xl flex items-center justify-center text-xl">🔌</div>
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-widest text-indigo-400">Phase 2</p>
                                        <h2 className="text-2xl font-black text-gray-800 leading-tight">School-Wide ICT</h2>
                                        <p className="text-[11px] font-medium text-indigo-700 leading-relaxed">
                                            <b>Note:</b> This school was previously identified as having <b>Multigrade Classes</b>. This may affect SHA eligibility.
                                        </p>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-400 mb-8">Count your campus-wide technology assets. Include all devices, regardless of location.</p>

                                <div className="space-y-4">
                                    {ICT_CATEGORIES.map(cat => {
                                        const hasError = ictStats.errors[cat.key];
                                        const unserviceable = ictStats.broken[cat.key];
                                        const isAdvanced = ["laptops", "tablets", "desktops"].includes(cat.key);
                                        const total = parseInt(ictData[`${cat.key}_total`]) || 0;

                                        return (
                                            <div key={cat.key} className={`bg-white border-2 rounded-3xl p-5 transition-all shadow-sm ${hasError ? "border-red-300" : "border-gray-100"}`}>
                                                <div className="flex items-center gap-2 mb-3">
                                                    <span className="text-2xl">{cat.emoji}</span>
                                                    <h3 className="text-lg font-black text-gray-800">{cat.label}</h3>
                                                </div>
                                                <div className="grid grid-cols-1 gap-3 mb-4">
                                                    <div>
                                                        <p className="text-[10px] font-black text-gray-400 uppercase text-center mb-1">Total Units</p>
                                                        <input type="number" name={`${cat.key}_total`} value={ictData[`${cat.key}_total`]} onChange={handleIctChange} min="0" placeholder="" className={`${chunkyInput} !mt-0 !bg-gray-50 text-gray-800 focus:!border-gray-400 focus:!bg-white`} />
                                                    </div>
                                                </div>

                                                <AnimatePresence>
                                                    {!isAdvanced && total > 0 && (
                                                        <motion.div variants={expandVariants} initial="hidden" animate="visible" exit="hidden" className="overflow-hidden mb-4">
                                                            <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100">
                                                                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-3">Operational Condition</p>
                                                                <div className="grid grid-cols-2 gap-3">
                                                                    <div>
                                                                        <p className="text-[9px] font-bold text-emerald-700 mb-1 ml-1">Working</p>
                                                                        <input 
                                                                            type="number" 
                                                                            name={`${cat.key}_func`} 
                                                                            value={ictData[`${cat.key}_func`]} 
                                                                            onChange={handleIctChange} 
                                                                            min="0" 
                                                                            placeholder="" 
                                                                            className={`${chunkyInput} !mt-0 !bg-white focus:!border-emerald-400`} 
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-[9px] font-bold text-red-400 mb-1 ml-1">Not Working</p>
                                                                        <div className={`${chunkyInput} !mt-0 !bg-red-50 text-red-400 border-dashed flex items-center justify-center`}>
                                                                            {ictData[`${cat.key}_total`] !== "" && ictData[`${cat.key}_func`] !== "" ? Math.max(0, total - (parseInt(ictData[`${cat.key}_func`]) || 0)) : "-"}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>

                                                <AnimatePresence>
                                                    {isAdvanced && total > 0 && (
                                                        <motion.div variants={expandVariants} initial="hidden" animate="visible" exit="hidden" className="overflow-hidden space-y-4">
                                                            {/* Usage Breakdown */}
                                                            <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100">
                                                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">Personnel Usage Breakdown</p>
                                                                <div className="grid grid-cols-2 gap-3">
                                                                    <div>
                                                                        <p className="text-[9px] font-bold text-indigo-600 mb-1 ml-1">Teaching</p>
                                                                        <input type="number" name={`${cat.key}_teaching`} value={ictData[`${cat.key}_teaching`]} onChange={handleIctChange} min="0" placeholder="" className={`${chunkyInput} !mt-0 !bg-white focus:!border-indigo-400`} />
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-[9px] font-bold text-slate-400 mb-1 ml-1">Non-Teaching</p>
                                                                        <div className={`${chunkyInput} !mt-0 !bg-slate-50 text-slate-400 border-dashed flex items-center justify-center`}>
                                                                            {ictData[`${cat.key}_total`] !== "" && ictData[`${cat.key}_teaching`] !== "" ? Math.max(0, total - (parseInt(ictData[`${cat.key}_teaching`]) || 0)) : "-"}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Condition Breakdown */}
                                                            <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100">
                                                                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-3">Operational Condition</p>
                                                                <div className="grid grid-cols-2 gap-3">
                                                                    <div>
                                                                        <p className="text-[9px] font-bold text-emerald-700 mb-1 ml-1">Working</p>
                                                                        <input type="number" name={`${cat.key}_working`} value={ictData[`${cat.key}_working`]} onChange={handleIctChange} min="0" placeholder="" className={`${chunkyInput} !mt-0 !bg-white focus:!border-indigo-400`} />
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-[9px] font-bold text-red-400 mb-1 ml-1">Not Working</p>
                                                                        <div className={`${chunkyInput} !mt-0 !bg-red-50 text-red-400 border-dashed flex items-center justify-center`}>
                                                                            {ictData[`${cat.key}_total`] !== "" && ictData[`${cat.key}_working`] !== "" ? Math.max(0, total - (parseInt(ictData[`${cat.key}_working`]) || 0)) : "-"}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>

                                                <AnimatePresence>
                                                    {hasError && (
                                                        <motion.div variants={expandVariants} initial="hidden" animate="visible" exit="hidden" className="overflow-hidden mt-3">
                                                            <div className="bg-red-50 text-red-600 text-xs font-bold p-3 rounded-xl border border-red-100 flex items-center gap-2">
                                                                <FiX className="w-4 h-4 flex-shrink-0" />
                                                                Check your input! Quantities cannot exceed total units.
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                    {!hasError && unserviceable > 0 && !isAdvanced && (
                                                        <motion.div variants={expandVariants} initial="hidden" animate="visible" exit="hidden" className="overflow-hidden">
                                                            <div className="bg-amber-50 text-amber-700 text-xs font-bold p-3 rounded-xl border border-amber-200 flex items-center gap-2">
                                                                <span>⚠️</span>
                                                                {unserviceable} unit{unserviceable !== 1 ? "s" : ""} unserviceable/need repair
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}

                        {/* ══════════════════════════════════════════════════════
                            PHASE 3: ECART / MOBILE LAB 
                            ══════════════════════════════════════════════════════ */}
                        {currentPhase === 3 && (
                            <motion.div key="p3-registry" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 bg-indigo-100 rounded-2xl flex items-center justify-center text-xl">🛒</div>
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-widest text-indigo-400">Phase 3</p>
                                        <h2 className="text-2xl font-black text-gray-800 leading-tight">eCart &amp; Mobile Lab</h2>
                                    </div>
                                </div>
                                <div className="bg-white border-2 border-gray-100 rounded-3xl p-5 shadow-sm mt-8 mb-6">
                                    <p className="text-sm font-bold text-gray-700 mb-4">Does your school have any eCarts or Mobile Computer Laboratories?</p>
                                    <div className="flex gap-3">
                                        <button onClick={() => setHasEcart(true)} className={`${toggleBtnBase} ${hasEcart === true ? toggleBtnActive : toggleBtnInactive}`}><span>👍</span> Yes</button>
                                        <button onClick={() => setHasEcart(false)} className={`${toggleBtnBase} ${hasEcart === false ? toggleBtnActive : toggleBtnInactive}`}><span>👎</span> No</button>
                                    </div>
                                </div>
                                <AnimatePresence>
                                    {hasEcart === true && (
                                        <motion.div variants={expandVariants} initial="hidden" animate="visible" exit="hidden" className="overflow-hidden">
                                            <div className="flex items-center justify-between mb-4 mt-2">
                                                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">eCart Packages</h3>
                                                <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded-lg">{eCarts.length} added</span>
                                            </div>
                                            {eCarts.length === 0 ? (
                                                <div className="bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-3xl p-6 text-center mb-4">
                                                    <p className="text-indigo-400 font-bold mb-1">No eCarts added yet.</p>
                                                    <p className="text-xs text-indigo-300">Tap below to register a package.</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-3 mb-4">
                                                    {eCarts.map((item, idx) => (
                                                        <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white border-2 border-gray-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center font-black">#{idx + 1}</div>
                                                                <div>
                                                                    <p className="font-bold text-gray-800 text-base">{item.batches_name}</p>
                                                                    <p className="text-xs font-medium text-gray-400 mt-0.5">{item.year_received} · {item.sources_fund} · {item.charging_condition}</p>
                                                                </div>
                                                            </div>
                                                            <button onClick={() => deleteEcart(item.id)} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors"><FiTrash2 className="w-5 h-5" /></button>
                                                        </motion.div>
                                                    ))}
                                                </div>
                                            )}
                                            <button onClick={() => setShowEcartModal(true)} className="w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 text-indigo-600 bg-white border-2 border-dashed border-indigo-300 hover:bg-indigo-50 transition-colors">
                                                <FiPlus className="w-5 h-5" /> Add New eCart Package
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )}


                        {/* ══════════════════════════════════════════════════════
                            PHASE 4: WASH & SANITATION UI
                            ══════════════════════════════════════════════════════ */}
                        {currentPhase === 4 && (
                            <motion.div key="p4-wash" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 bg-indigo-100 rounded-2xl flex items-center justify-center text-xl">💧</div>
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-widest text-indigo-400">Phase 4</p>
                                        <h2 className="text-2xl font-black text-gray-800 leading-tight">WASH &amp; Sanitation</h2>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-400 mb-8">Count all school water and sanitation facilities. We will isolate classroom-attached CRs below.</p>

                                {/* Water Source Gatekeeper */}
                                    <div className="bg-white border-2 border-gray-100 rounded-3xl p-5 shadow-sm mb-6">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="text-2xl">🚰</span>
                                            <h3 className="text-lg font-black text-gray-800">Primary Water Source</h3>
                                        </div>
                                        <select name="water_source" value={washData.water_source} onChange={handleWashChange} className={`${chunkySelect} w-full`}>
                                            <option value="" disabled>Tap to select...</option>
                                            {WATER_SOURCES.map(src => <option key={src} value={src}>{src}</option>)}
                                        </select>
                                    </div>
    
                                    <AnimatePresence>
                                        {(washData.water_source === "Natural resources (Deep well, Spring, Rainwater)" || washData.water_source === "No water source") && (
                                            <motion.div variants={expandVariants} initial="hidden" animate="visible" exit="hidden" className="overflow-hidden mb-6">
                                                <div className="rounded-3xl p-6 border-2 bg-white border-red-100 shadow-md">
                                                    <div className="flex items-start gap-4 mb-4">
                                                        <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                                                            <FiAlertCircle className="text-red-600 w-6 h-6" />
                                                        </div>
                                                        <div>
                                                            <h4 className="text-red-900 font-black text-lg leading-tight mb-1">Infrastructure Warning</h4>
                                                            <p className="text-sm font-bold text-red-700 opacity-80">Non-Piped Connection Reported</p>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="bg-red-50/50 rounded-2xl p-4 border border-red-100">
                                                        <p className="text-xs font-bold text-red-800 mb-3 leading-relaxed">
                                                            I confirm that this school does not have a piped water connection from a local provider. 
                                                            To proceed, please type <span className="font-black underline italic">confirm</span> below:
                                                        </p>
                                                        <input 
                                                            type="text"
                                                            name="confirm_no_piped_text"
                                                            value={washData.confirm_no_piped_text || ""}
                                                            onChange={handleWashChange}
                                                            placeholder="Type 'confirm' here..."
                                                            className={`${chunkyInput} !mt-0 !bg-white !text-red-900 !border-red-200 placeholder:text-red-200 focus:!border-red-400`}
                                                        />
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                {/* Main Sanitation Audit List */}
                                <div className="space-y-4 mb-6">
                                        {WASH_CATEGORIES.map(cat => {
                                            const hasError = washStats.errors[cat.key];
                                            return (
                                                <div key={cat.key} className={`bg-white border-2 rounded-3xl p-5 transition-all shadow-sm ${hasError ? "border-red-300" : "border-gray-100"}`}>
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <span className="text-2xl">{cat.emoji}</span>
                                                        <h3 className="text-lg font-black text-gray-800">{cat.label}</h3>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-3 mb-4">
                                                        <div>
                                                            <p className="text-[10px] font-black text-gray-400 uppercase text-center mb-1">Total Count</p>
                                                            <input 
                                                                type="number" 
                                                                name={`${cat.key}_total`} 
                                                                value={washData[`${cat.key}_total`]} 
                                                                onChange={handleWashChange} 
                                                                min="0" 
                                                                placeholder="" 
                                                                className={`${chunkyInput} !mt-0 !bg-gray-50 text-gray-800 focus:!border-gray-400 focus:!bg-white`} 
                                                            />
                                                        </div>
                                                    </div>

                                                    <AnimatePresence>
                                                        {["male_seats", "female_seats", "common_seats", "pwd_seats", "faucets", "male_urinals"].includes(cat.key) && (parseInt(washData[`${cat.key}_total`]) || 0) > 0 && (
                                                            <motion.div variants={expandVariants} initial="hidden" animate="visible" exit="hidden" className="overflow-hidden mb-4">
                                                                <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100">
                                                                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-3">Operational Condition</p>
                                                                    <div className="grid grid-cols-2 gap-3">
                                                                        <div>
                                                                            <p className="text-[9px] font-bold text-emerald-700 mb-1 ml-1">Working</p>
                                                                            <input 
                                                                                type="number" 
                                                                                name={`${cat.key}_func`} 
                                                                                value={washData[`${cat.key}_func`]} 
                                                                                onChange={handleWashChange} 
                                                                                min="0" 
                                                                                placeholder="" 
                                                                                className={`${chunkyInput} !mt-0 !bg-white focus:!border-emerald-400`} 
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-[9px] font-bold text-red-400 mb-1 ml-1">Not Working</p>
                                                                            <div className={`${chunkyInput} !mt-0 !bg-red-50 text-red-400 border-dashed flex items-center justify-center`}>
                                                                                {Math.max(0, (parseInt(washData[`${cat.key}_total`]) || 0) - (parseInt(washData[`${cat.key}_func`]) || 0))}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>

                                                    <AnimatePresence>
                                                        {hasError && (
                                                            <motion.div variants={expandVariants} initial="hidden" animate="visible" exit="hidden" className="overflow-hidden">
                                                                <div className="bg-red-50 text-red-600 text-xs font-bold p-3 rounded-xl border border-red-100 flex items-center gap-2">
                                                                    <FiX className="w-4 h-4 flex-shrink-0" />
                                                                    Functional cannot exceed Total items!
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            );
                                        })}
                                    </div>



                                {/* Attached CR Breakdown */}
                                <div className="bg-indigo-50 border-2 border-indigo-100 rounded-3xl p-5 shadow-sm">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-2xl">🏫</span>
                                        <h3 className="text-lg font-black text-indigo-900">Classroom Toilets <span className="text-sm font-bold text-indigo-500">(Attached CRs)</span></h3>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs font-bold text-indigo-800 mb-1 leading-tight">Classrooms with CR</p>
                                            <input type="number" name="attached_cr_classrooms" value={washData.attached_cr_classrooms} onChange={handleWashChange} min="0" placeholder="" className={`${chunkyInput} !mt-0 !bg-white focus:!border-indigo-400`} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-indigo-800 mb-1 leading-tight">Total Attached Seats</p>
                                            <input type="number" name="attached_cr_seats" value={washData.attached_cr_seats} onChange={handleWashChange} min="0" placeholder="" className={`${chunkyInput} !mt-0 !bg-white focus:!border-indigo-400`} />
                                        </div>
                                    </div>

                                    {/* Double Count Checkbox - WASH specific */}
                                    <div 
                                        onClick={() => setWashData(p => ({...p, attached_cr_included_in_main: !p.attached_cr_included_in_main}))}
                                        className={`mt-5 rounded-2xl p-4 border-2 flex items-start gap-3 cursor-pointer transition-colors ${washData.attached_cr_included_in_main ? "bg-amber-50 border-amber-300" : "bg-white border-indigo-200"}`}
                                    >
                                        <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${washData.attached_cr_included_in_main ? "bg-amber-500 border-amber-500" : "bg-gray-100 border-gray-300"}`}>
                                            {washData.attached_cr_included_in_main && <FiCheck className="text-white w-4 h-4" />}
                                        </div>
                                        <div>
                                            <p className={`text-sm font-bold ${washData.attached_cr_included_in_main ? "text-amber-800" : "text-gray-600"}`}>Double-Count Notice</p>
                                            <p className={`text-xs mt-1 ${washData.attached_cr_included_in_main ? "text-amber-700" : "text-gray-400"}`}>Check here if these attached toilet seats were ALREADY included in the Main Sanitation Audit above.</p>
                                        </div>
                                    </div>

                                </div>

                            </motion.div>
                        )}

                        {/* ══════════════════════════════════════════════════════
                            PHASE 5: UTILITIES & HARDSHIP
                            ══════════════════════════════════════════════════════ */}
                        {currentPhase === 5 && (
                            <motion.div key="p5-utilities" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 bg-indigo-100 rounded-2xl flex items-center justify-center text-xl">⚡</div>
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-widest text-indigo-400">Phase 5</p>
                                        <h2 className="text-2xl font-black text-gray-800 leading-tight">Utilities &amp; Hardship</h2>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-400 mb-8">Finalizing power supply, connectivity, and administrative categories.</p>

                                {/* Electricity Section */}
                                <div className="bg-white border-2 border-gray-100 rounded-3xl p-5 shadow-sm mb-4">
                                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Power Supply</h3>
                                    <select name="utility_electricity" value={utilitiesData.utility_electricity} onChange={handleUtilitiesChange} className={`${chunkySelect} w-full !mt-0`}>
                                        <option value="" disabled>Tap to select...</option>
                                        <option value="Grid & Off-grid supply">Grid &amp; Off-grid supply</option>
                                        <option value="Grid supply">Grid supply</option>
                                        <option value="Off-grid supply">Off-grid supply</option>
                                        <option value="No electricity">No electricity</option>
                                    </select>
                                    
                                    <AnimatePresence>
                                        {(utilitiesData.utility_electricity === "Grid & Off-grid supply" || utilitiesData.utility_electricity === "Off-grid supply") && (
                                            <motion.div variants={expandVariants} initial="hidden" animate="visible" exit="hidden" className="overflow-hidden">
                                                <div 
                                                    onClick={() => setUtilitiesData(p => ({...p, has_solar_or_gen: !p.has_solar_or_gen}))}
                                                    className={`mt-4 rounded-2xl p-4 border-2 flex items-center gap-3 cursor-pointer transition-colors ${utilitiesData.has_solar_or_gen ? "bg-amber-50 border-amber-300" : "bg-gray-50 border-gray-200"}`}
                                                >
                                                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${utilitiesData.has_solar_or_gen ? "bg-amber-500 border-amber-500" : "bg-white border-gray-300"}`}>
                                                        {utilitiesData.has_solar_or_gen && <FiCheck className="text-white w-4 h-4" />}
                                                    </div>
                                                    <div>
                                                        <p className={`text-sm font-bold ${utilitiesData.has_solar_or_gen ? "text-amber-800" : "text-gray-600"}`}>Off-grid Source Confirmed</p>
                                                        <p className={`text-xs mt-1 ${utilitiesData.has_solar_or_gen ? "text-amber-700" : "text-gray-400"}`}>Check here if the off-grid power is supplied by Solar Panels or a Generator.</p>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                        {(utilitiesData.utility_electricity === "No electricity" || utilitiesData.utility_electricity === "Off-grid supply") && (
                                            <motion.div variants={expandVariants} initial="hidden" animate="visible" exit="hidden" className="overflow-hidden mt-4">
                                                <div className="rounded-3xl p-6 border-2 bg-white border-red-100 shadow-md">
                                                    <div className="flex items-start gap-4 mb-4">
                                                        <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                                                            <FiAlertCircle className="text-red-600 w-6 h-6" />
                                                        </div>
                                                        <div>
                                                            <h4 className="text-red-900 font-black text-lg leading-tight mb-1">Grid Connectivity Notice</h4>
                                                            <p className="text-sm font-bold text-red-700 opacity-80">No active Grid connection reported</p>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="bg-red-50/50 rounded-2xl p-4 border border-red-100">
                                                        <p className="text-xs font-bold text-red-800 mb-3 leading-relaxed">
                                                            I confirm that this school does not have a functional grid connection. 
                                                            To proceed, please type <span className="font-black underline italic">confirm</span> below:
                                                        </p>
                                                        <input 
                                                            type="text"
                                                            name="confirm_no_grid_text"
                                                            value={utilitiesData.confirm_no_grid_text || ""}
                                                            onChange={handleUtilitiesChange}
                                                            placeholder="Type 'confirm' here..."
                                                            className={`${chunkyInput} !mt-0 !bg-white !text-red-900 !border-red-200 placeholder:text-red-200 focus:!border-red-400`}
                                                        />
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Internet Section */}
                                <div className="bg-white border-2 border-gray-100 rounded-3xl p-5 shadow-sm mb-4">
                                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Internet Access</h3>
                                    <p className="text-sm font-bold text-gray-700 mb-4">Does the school have a functional internet connection?</p>
                                    <div className="flex gap-3">
                                        <button onClick={() => setUtilitiesData(p => ({...p, utility_internet_yesno: true}))} className={`${toggleBtnBase} ${utilitiesData.utility_internet_yesno === true ? toggleBtnActive : toggleBtnInactive}`}><span>👍</span> Yes</button>
                                        <button onClick={() => setUtilitiesData(p => ({...p, utility_internet_yesno: false}))} className={`${toggleBtnBase} ${utilitiesData.utility_internet_yesno === false ? toggleBtnActive : toggleBtnInactive}`}><span>👎</span> No</button>
                                    </div>
                                    
                                    <AnimatePresence>
                                        {utilitiesData.utility_internet_yesno === true && (
                                            <motion.div variants={expandVariants} initial="hidden" animate="visible" exit="hidden" className="overflow-hidden pt-4 border-t border-gray-100 mt-4 space-y-4">
                                                <div>
                                                    <p className="text-xs font-bold text-gray-500 mb-2 ml-1">Internet Connection Type</p>
                                                    <select name="utility_internet_type" value={utilitiesData.utility_internet_type} onChange={handleUtilitiesChange} className={`${chunkySelect} w-full !mt-0`}>
                                                        <option value="" disabled>Tap to select...</option>
                                                        <option value="Wired (Fiber/DSL/Cable)">Wired (Fiber/DSL/Cable)</option>
                                                        <option value="Wireless (4G/5G/Radio)">Wireless (4G/5G/Radio)</option>
                                                        <option value="Satellite">Satellite (Starlink/VSAT)</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-gray-500 mb-2 ml-1">Primary Funding Source</p>
                                                    <select name="utility_internet_funder" value={utilitiesData.utility_internet_funder} onChange={handleUtilitiesChange} className={`${chunkySelect} w-full !mt-0`}>
                                                        <option value="" disabled>Select funder...</option>
                                                        <option value="DepEd Funded (DCP)">DepEd Funded (DCP)</option>
                                                        <option value="School MOOE">School MOOE</option>
                                                        <option value="LGU/Barangay Funded">LGU/Barangay Funded</option>
                                                        <option value="Teachers' Personal Expense">Teachers' Personal Expense</option>
                                                    </select>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <AnimatePresence>
                                        {(utilitiesData.utility_internet_yesno === false || (utilitiesData.utility_internet_yesno === true && utilitiesData.utility_internet_type && utilitiesData.utility_internet_type !== "Wired (Fiber/DSL/Cable)")) && (
                                            <motion.div variants={expandVariants} initial="hidden" animate="visible" exit="hidden" className="overflow-hidden mt-4">
                                                <div className="rounded-3xl p-6 border-2 bg-white border-red-100 shadow-md">
                                                    <div className="flex items-start gap-4 mb-4">
                                                        <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                                                            <FiAlertCircle className="text-red-600 w-6 h-6" />
                                                        </div>
                                                        <div>
                                                            <h4 className="text-red-900 font-black text-lg leading-tight mb-1">Connectivity Status</h4>
                                                            <p className="text-sm font-bold text-red-700 opacity-80">Non-Wired Connection Detected</p>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="bg-red-50/50 rounded-2xl p-4 border border-red-100">
                                                        <p className="text-xs font-bold text-red-800 mb-3 leading-relaxed">
                                                            I confirm that this school does not have a dedicated wired internet connection. 
                                                            To proceed, please type <span className="font-black underline italic">confirm</span> below:
                                                        </p>
                                                        <input 
                                                            type="text"
                                                            name="confirm_no_wired_text"
                                                            value={utilitiesData.confirm_no_wired_text || ""}
                                                            onChange={handleUtilitiesChange}
                                                            placeholder="Type 'confirm' here..."
                                                            className={`${chunkyInput} !mt-0 !bg-white !text-red-900 !border-red-200 placeholder:text-red-200 focus:!border-red-400`}
                                                        />
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <div className="bg-emerald-50 border-2 border-emerald-100 rounded-3xl p-5 shadow-sm mb-4 flex items-center justify-between opacity-80 cursor-not-allowed">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center text-xl">🔒</div>
                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-widest text-emerald-500 mb-0.5">Primary Water Source</p>
                                            <h3 className="text-sm font-black text-emerald-800">{washData.water_source || "Not provided"}</h3>
                                        </div>
                                    </div>
                                    <FiCheckCircle className="w-6 h-6 text-emerald-400" />
                                </div>

                                {/* Certification Checkbox */}
                                <motion.div 
                                    onClick={() => setIsCertified(!isCertified)}
                                    className={`mt-6 p-6 rounded-[2.5rem] border-2 flex items-start gap-4 cursor-pointer transition-all ${
                                        isCertified 
                                            ? 'bg-emerald-50 border-emerald-300' 
                                            : 'bg-white border-slate-200'
                                    }`}
                                >
                                    <div className={`mt-1 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${
                                        isCertified 
                                            ? 'bg-emerald-500 border-emerald-500 text-white' 
                                            : 'border-slate-300 bg-white'
                                    }`}>
                                        {isCertified && <FiCheck className="w-4 h-4" />}
                                    </div>
                                    <div>
                                        <p className={`text-[13px] font-black leading-tight ${isCertified ? 'text-emerald-900' : 'text-slate-500'}`}>
                                            I hereby certify that all data and information provided in this module/unit are true and correct.
                                        </p>
                                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Data Integrity Gate</p>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </main>

            {!propReadOnly && (
                <div className="fixed bottom-0 left-0 w-full p-5 bg-white border-t border-gray-100 flex flex-col items-center z-40 shadow-[0_-2px_12px_rgba(0,0,0,0.02)]">
                    <div className="w-full max-w-md">
                        {/* School-wide Status Confirmation removed as requested */}
                    </div>
                    <div className="w-full max-w-md flex items-center gap-3">
                        <button onClick={() => setShowDraftModal(true)} className="flex-none h-16 px-6 rounded-3xl bg-gray-100 flex items-center justify-center gap-2 text-gray-400 hover:text-gray-900 active:scale-95 transition-all outline-none">
                            <FiSave className="w-6 h-6" />
                            <span className="text-sm font-bold text-gray-500">Save Draft</span>
                        </button>
                        {currentPhase === 1 ? (
                            <button disabled={!isPhase1Valid} onClick={handleMainProceed} className="flex-1 py-4 rounded-2xl text-white font-black text-lg text-center bg-emerald-500 border-b-[5px] border-emerald-700 active:border-b-0 active:translate-y-[5px] transition-all disabled:opacity-50 shadow-lg flex items-center justify-center gap-2">
                                Continue to Phase 2 <FiChevronRight className="w-5 h-5" />
                            </button>
                        ) : currentPhase === 2 ? (
                            <button disabled={!ictStats.isValid} onClick={handlePhase2Proceed} className="flex-1 py-4 rounded-2xl text-white font-black text-lg text-center bg-blue-500 border-b-[5px] border-blue-700 active:border-b-0 active:translate-y-[5px] transition-all disabled:opacity-50 shadow-lg flex items-center justify-center gap-2">
                                Continue to Mobile Labs (eCart) <FiChevronRight className="w-5 h-5" />
                            </button>
                        ) : currentPhase === 3 ? (
                            <button disabled={!isPhase3Valid} onClick={handlePhase3Proceed} className="flex-1 py-4 rounded-2xl text-white font-black text-lg text-center bg-emerald-500 border-b-[5px] border-emerald-700 active:border-b-0 active:translate-y-[5px] transition-all disabled:opacity-50 shadow-lg flex items-center justify-center gap-2">
                                Continue to Phase 4 (WASH) <FiChevronRight className="w-5 h-5" />
                            </button>
                        ) : currentPhase === 4 ? (
                            <button disabled={!washStats.isValid} onClick={handlePhase4Proceed} className="flex-1 py-4 rounded-2xl text-white font-black text-lg text-center bg-indigo-500 border-b-[5px] border-indigo-700 active:border-b-0 active:translate-y-[5px] transition-all disabled:opacity-50 shadow-lg flex items-center justify-center gap-2">
                                Continue to Phase 5 (Utilities) <FiChevronRight className="w-5 h-5" />
                            </button>
                        ) : (
                            <button disabled={!isPhase5Valid || !isCertified || loading} onClick={handleFinalSubmit} className="flex-1 py-4 rounded-2xl text-white font-black text-lg text-center bg-emerald-500 border-b-[5px] border-emerald-700 active:border-b-0 active:translate-y-[5px] transition-all disabled:opacity-50 shadow-lg flex items-center justify-center gap-2">
                                {loading ? "Submitting..." : "Submit School Resources"} <FiCheckCircle className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ── Add eCart Modal ── */}
            <AnimatePresence>
                {showEcartModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-end justify-center sm:items-center sm:p-4">
                        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", bounce: 0.2, duration: 0.5 }} className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col shadow-2xl">
                            <div className="flex items-center justify-between p-5 border-b border-gray-100">
                                <div><h3 className="text-xl font-black text-gray-800">Add eCart Package</h3><p className="text-xs text-gray-400 mt-1">Register mobile lab details.</p></div>
                                <button onClick={() => setShowEcartModal(false)} className="p-2 bg-gray-100 text-gray-500 rounded-full hover:bg-gray-200"><FiX className="w-5 h-5" /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-5 pb-8 space-y-6">
                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-3">Package Details</h4>
                                    <div className="space-y-3">
                                        <div><p className="text-xs font-bold text-gray-500 mb-1 ml-1">Batch / Package Name</p><input type="text" name="batches_name" value={ecartForm.batches_name} onChange={handleEcartFormChange} placeholder="e.g. Batch 44" className={`${chunkyInput} !mt-0 !text-left !px-5`} /></div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <p className="text-xs font-bold text-gray-500 mb-1 ml-1">Year Received</p>
                                                <select name="year_received" value={ecartForm.year_received} onChange={handleEcartFormChange} className={`${chunkySelect} !mt-0 text-base py-4.5`}>
                                                    <option value="" disabled>Select Year...</option>
                                                    {Array.from({ length: new Date().getFullYear() - 2000 + 1 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                                        <option key={year} value={year}>{year}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-gray-500 mb-1 ml-1">Funding Source</p>
                                                <select name="sources_fund" value={ecartForm.sources_fund} onChange={handleEcartFormChange} className={`${chunkySelect} !mt-0 text-base py-4.5`}>
                                                    <option value="" disabled>Select...</option>
                                                    {ECART_FUNDING_SOURCES.map(src => <option key={src} value={src}>{src}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-3">Included Devices</h4>
                                    <div className="grid grid-cols-3 gap-3 mb-2">
                                        <div><p className="text-[10px] font-bold text-gray-400 uppercase text-center mb-1">💻 Laptops</p><input type="number" name="ecart_laptops" value={ecartForm.ecart_laptops} onChange={handleEcartFormChange} min="0" placeholder="" className={`${chunkyInput} !mt-0`} /></div>
                                        <div><p className="text-[10px] font-bold text-gray-400 uppercase text-center mb-1">📱 Tablets</p><input type="number" name="ecart_tablets" value={ecartForm.ecart_tablets} onChange={handleEcartFormChange} min="0" placeholder="" className={`${chunkyInput} !mt-0`} /></div>
                                        <div><p className="text-[10px] font-bold text-gray-400 uppercase text-center mb-1">📺 Smart TVs</p><input type="number" name="ecart_tv" value={ecartForm.ecart_tv} onChange={handleEcartFormChange} min="0" placeholder="" className={`${chunkyInput} !mt-0`} /></div>
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-3">Infrastructure &amp; Extras</h4>
                                    <p className="text-sm font-bold text-gray-700 mb-2">Charging Station / Base</p>
                                    <div className="flex gap-3 mb-4">
                                        <button onClick={() => setEcartForm(p => ({...p, charging_condition: 'Functional'}))} className={`${toggleBtnBase} !text-sm !py-3 ${ecartForm.charging_condition === 'Functional' ? toggleBtnActive : toggleBtnInactive}`}>Functional</button>
                                        <button onClick={() => setEcartForm(p => ({...p, charging_condition: 'Non-Functional'}))} className={`${toggleBtnBase} !text-sm !py-3 ${ecartForm.charging_condition === 'Non-Functional' ? toggleBtnActive : toggleBtnInactive}`}>Missing/Broken</button>
                                    </div>
                                    <p className="text-xs font-bold text-gray-500 mb-1 ml-1">Remarks / Other Equipment <span className="font-normal">(Optional)</span></p>
                                    <textarea name="remarks" value={ecartForm.remarks} onChange={handleEcartFormChange} placeholder="e.g. Routers, Headphones, Adapters..." className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-2xl text-sm font-medium text-gray-700 focus:outline-none focus:border-indigo-500 focus:bg-indigo-50 transition-colors min-h-[100px] resize-none" />
                                </div>
                            </div>
                            <div className="p-5 border-t border-gray-100 flex gap-3">
                                <button onClick={handleSaveEcart} className="flex-1 py-4 rounded-2xl text-white font-black text-lg text-center bg-indigo-500 border-b-[5px] border-indigo-700 active:border-b-0 active:translate-y-[5px] transition-all">Save eCart</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Add Grade Level Modal ── */}
            <AnimatePresence>
                {showGradeModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-end justify-center sm:items-center sm:p-4">
                        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", bounce: 0.2, duration: 0.5 }} className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col shadow-2xl">
                            <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-3xl">
                                <div><h3 className="text-xl font-black text-gray-800">Grade Level Audit</h3><p className="text-xs text-gray-400 mt-1">Aggregate seating for this level.</p></div>
                                <button onClick={() => setShowGradeModal(false)} className="p-2 bg-gray-100 text-gray-500 rounded-full hover:bg-gray-200"><FiX className="w-5 h-5" /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-5 pb-8 space-y-6">
                                {selectedGradeId && (
                                    <div className="bg-indigo-50 border-2 border-indigo-100 p-4 rounded-2xl mb-4 text-center">
                                        <h4 className="text-lg font-black text-indigo-900 leading-tight">
                                            {gradesData.find(g => g.id === selectedGradeId)?.grade_level}
                                        </h4>
                                        <p className="text-sm font-bold text-indigo-600 mt-1">
                                            Target: {gradesData.find(g => g.id === selectedGradeId)?.enrolled} Learners across {gradesData.find(g => g.id === selectedGradeId)?.sections} Sections
                                        </p>
                                    </div>
                                )}

                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-3 pb-2 border-b border-gray-100">Learner Seating (Aggregated Totals)</h4>
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-sm font-bold text-gray-700 mb-2">Armchair — Wood 🪑</p>
                                            <div className="grid grid-cols-2 gap-3 mb-4">
                                                <div><p className="text-[10px] font-black text-emerald-500 uppercase text-center mb-1">Functional</p><input type="number" name="armchair_wood_func" value={currentGradeForm.armchair_wood_func} onChange={handleGradeFormChange} min="0" placeholder="" className={`${chunkyInput} !bg-emerald-50 text-emerald-700 focus:!border-emerald-400 !mt-0`} /></div>
                                                <div><p className="text-[10px] font-black text-red-500 uppercase text-center mb-1">Broken</p><input type="number" name="armchair_wood_broken" value={currentGradeForm.armchair_wood_broken} onChange={handleGradeFormChange} min="0" placeholder="" className={`${chunkyInput} !bg-red-50 text-red-700 focus:!border-red-400 !mt-0`} /></div>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-700 mb-2">Armchair — Plastic 🪑</p>
                                            <div className="grid grid-cols-2 gap-3 mb-4">
                                                <div><p className="text-[10px] font-black text-emerald-500 uppercase text-center mb-1">Functional</p><input type="number" name="armchair_plastic_func" value={currentGradeForm.armchair_plastic_func} onChange={handleGradeFormChange} min="0" placeholder="" className={`${chunkyInput} !bg-emerald-50 text-emerald-700 focus:!border-emerald-400 !mt-0`} /></div>
                                                <div><p className="text-[10px] font-black text-red-500 uppercase text-center mb-1">Broken</p><input type="number" name="armchair_plastic_broken" value={currentGradeForm.armchair_plastic_broken} onChange={handleGradeFormChange} min="0" placeholder="" className={`${chunkyInput} !bg-red-50 text-red-700 focus:!border-red-400 !mt-0`} /></div>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-700 mb-2">Armchair — Plastic / Steel 🪑</p>
                                            <div className="grid grid-cols-2 gap-3 mb-4">
                                                <div><p className="text-[10px] font-black text-emerald-500 uppercase text-center mb-1">Functional</p><input type="number" name="armchair_plastic_steel_func" value={currentGradeForm.armchair_plastic_steel_func} onChange={handleGradeFormChange} min="0" placeholder="" className={`${chunkyInput} !bg-emerald-50 text-emerald-700 focus:!border-emerald-400 !mt-0`} /></div>
                                                <div><p className="text-[10px] font-black text-red-500 uppercase text-center mb-1">Broken</p><input type="number" name="armchair_plastic_steel_broken" value={currentGradeForm.armchair_plastic_steel_broken} onChange={handleGradeFormChange} min="0" placeholder="" className={`${chunkyInput} !bg-red-50 text-red-700 focus:!border-red-400 !mt-0`} /></div>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-700 mb-2">Individual Table &amp; Chair 🪑</p>
                                            <div className="grid grid-cols-2 gap-3 mb-4">
                                                <div><p className="text-[10px] font-black text-emerald-500 uppercase text-center mb-1">Functional</p><input type="number" name="individual_table_chair_func" value={currentGradeForm.individual_table_chair_func} onChange={handleGradeFormChange} min="0" placeholder="" className={`${chunkyInput} !bg-emerald-50 text-emerald-700 focus:!border-emerald-400 !mt-0`} /></div>
                                                <div><p className="text-[10px] font-black text-red-500 uppercase text-center mb-1">Broken</p><input type="number" name="individual_table_chair_broken" value={currentGradeForm.individual_table_chair_broken} onChange={handleGradeFormChange} min="0" placeholder="" className={`${chunkyInput} !bg-red-50 text-red-700 focus:!border-red-400 !mt-0`} /></div>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-700 mb-2">2-Seater — Wood <span className="text-xs text-indigo-400 font-normal">(×2 capacity)</span></p>
                                            <div className="grid grid-cols-2 gap-3 mb-4">
                                                <div><p className="text-[10px] font-black text-emerald-500 uppercase text-center mb-1">Functional</p><input type="number" name="two_seater_wood_func" value={currentGradeForm.two_seater_wood_func} onChange={handleGradeFormChange} min="0" placeholder="" className={`${chunkyInput} !bg-emerald-50 text-emerald-700 focus:!border-emerald-400 !mt-0`} /></div>
                                                <div><p className="text-[10px] font-black text-red-500 uppercase text-center mb-1">Broken</p><input type="number" name="two_seater_wood_broken" value={currentGradeForm.two_seater_wood_broken} onChange={handleGradeFormChange} min="0" placeholder="" className={`${chunkyInput} !bg-red-50 text-red-700 focus:!border-red-400 !mt-0`} /></div>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-700 mb-2">2-Seater — Wood / Steel <span className="text-xs text-indigo-400 font-normal">(×2 capacity)</span></p>
                                            <div className="grid grid-cols-2 gap-3 mb-4">
                                                <div><p className="text-[10px] font-black text-emerald-500 uppercase text-center mb-1">Functional</p><input type="number" name="two_seater_wood_steel_func" value={currentGradeForm.two_seater_wood_steel_func} onChange={handleGradeFormChange} min="0" placeholder="" className={`${chunkyInput} !bg-emerald-50 text-emerald-700 focus:!border-emerald-400 !mt-0`} /></div>
                                                <div><p className="text-[10px] font-black text-red-500 uppercase text-center mb-1">Broken</p><input type="number" name="two_seater_wood_steel_broken" value={currentGradeForm.two_seater_wood_steel_broken} onChange={handleGradeFormChange} min="0" placeholder="" className={`${chunkyInput} !bg-red-50 text-red-700 focus:!border-red-400 !mt-0`} /></div>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-700 mb-2">Wooden Chair Only 🪑</p>
                                            <div className="grid grid-cols-2 gap-3 mb-4">
                                                <div><p className="text-[10px] font-black text-emerald-500 uppercase text-center mb-1">Functional</p><input type="number" name="wooden_chair_only_func" value={currentGradeForm.wooden_chair_only_func} onChange={handleGradeFormChange} min="0" placeholder="" className={`${chunkyInput} !bg-emerald-50 text-emerald-700 focus:!border-emerald-400 !mt-0`} /></div>
                                                <div><p className="text-[10px] font-black text-red-500 uppercase text-center mb-1">Broken</p><input type="number" name="wooden_chair_only_broken" value={currentGradeForm.wooden_chair_only_broken} onChange={handleGradeFormChange} min="0" placeholder="" className={`${chunkyInput} !bg-red-50 text-red-700 focus:!border-red-400 !mt-0`} /></div>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-700 mb-2">Plastic Chair Only 🪑</p>
                                            <div className="grid grid-cols-2 gap-3 mb-4">
                                                <div><p className="text-[10px] font-black text-emerald-500 uppercase text-center mb-1">Functional</p><input type="number" name="plastic_chair_only_func" value={currentGradeForm.plastic_chair_only_func} onChange={handleGradeFormChange} min="0" placeholder="" className={`${chunkyInput} !bg-emerald-50 text-emerald-700 focus:!border-emerald-400 !mt-0`} /></div>
                                                <div><p className="text-[10px] font-black text-red-500 uppercase text-center mb-1">Broken</p><input type="number" name="plastic_chair_only_broken" value={currentGradeForm.plastic_chair_only_broken} onChange={handleGradeFormChange} min="0" placeholder="" className={`${chunkyInput} !bg-red-50 text-red-700 focus:!border-red-400 !mt-0`} /></div>
                                            </div>
                                        </div>
                                        
                                        {/* KINDER DOUBLE SHIFT OPTION */}
                                        {selectedGradeId === 'kinder' && (
                                            <div className="bg-indigo-50 border-2 border-indigo-100 rounded-[2.5rem] p-6 mb-4">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <span className="text-xl">🌓</span>
                                                    <h4 className="text-sm font-black text-indigo-900 uppercase tracking-tight">Shift Management</h4>
                                                </div>
                                                <p className="text-xs font-bold text-indigo-600 mb-4 leading-relaxed">
                                                    Does your Kindergarten have morning and afternoon shifts? (This will double the calculated capacity shown below)
                                                </p>
                                                
                                                <div className="flex gap-3">
                                                    <button 
                                                        onClick={() => setCurrentGradeForm(p => ({...p, is_kinder_double_shift: true}))} 
                                                        className={`${toggleBtnBase} !py-3 ${currentGradeForm.is_kinder_double_shift ? toggleBtnActive : toggleBtnInactive}`}
                                                    >
                                                        Yes, 2 Shifts
                                                    </button>
                                                    <button 
                                                        onClick={() => setCurrentGradeForm(p => ({...p, is_kinder_double_shift: false}))} 
                                                        className={`${toggleBtnBase} !py-3 ${!currentGradeForm.is_kinder_double_shift ? toggleBtnActive : toggleBtnInactive}`}
                                                    >
                                                        No, Single
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* SHARED SEATS OPTION */}
                                        <div className="bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] p-6 mt-8">
                                            <div className="flex items-center gap-2 mb-4">
                                                <span className="text-xl">🔗</span>
                                                <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Shared Capacity Option</h4>
                                            </div>
                                            <p className="text-xs font-bold text-slate-500 mb-4 leading-relaxed">
                                                Are these physical seats shared with other grade levels? (e.g., multigrade setup or shift sharing)
                                            </p>
                                            
                                            <div className="flex gap-3 mb-5">
                                                <button 
                                                    onClick={() => setCurrentGradeForm(p => ({...p, is_sharing: true}))} 
                                                    className={`${toggleBtnBase} !py-3 ${currentGradeForm.is_sharing ? toggleBtnActive : toggleBtnInactive}`}
                                                >
                                                    Yes, shared
                                                </button>
                                                <button 
                                                    onClick={() => setCurrentGradeForm(p => ({...p, is_sharing: false, shared_with: []}))} 
                                                    className={`${toggleBtnBase} !py-3 ${!currentGradeForm.is_sharing ? toggleBtnActive : toggleBtnInactive}`}
                                                >
                                                    Separate
                                                </button>
                                            </div>

                                            <AnimatePresence>
                                                {currentGradeForm.is_sharing && (
                                                    <motion.div variants={expandVariants} initial="hidden" animate="visible" exit="hidden" className="overflow-hidden space-y-3">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Select sharing partners:</p>
                                                        <div className="grid grid-cols-1 gap-2">
                                                            {gradesData
                                                                .filter(g => g.id !== selectedGradeId && !g.is_shared_child)
                                                                .map(grade => (
                                                                    <div 
                                                                        key={grade.id}
                                                                        onClick={() => {
                                                                            const current = currentGradeForm.shared_with || [];
                                                                            if (current.includes(grade.id)) {
                                                                                setCurrentGradeForm(p => ({...p, shared_with: current.filter(id => id !== grade.id)}));
                                                                            } else {
                                                                                setCurrentGradeForm(p => ({...p, shared_with: [...current, grade.id]}));
                                                                            }
                                                                        }}
                                                                        className={`p-3 rounded-2xl border-2 flex items-center justify-between transition-all cursor-pointer ${currentGradeForm.shared_with.includes(grade.id) ? 'bg-white border-indigo-500 shadow-sm' : 'bg-slate-100/50 border-transparent text-slate-400'}`}
                                                                    >
                                                                        <span className="text-xs font-black">{grade.grade_level}</span>
                                                                        {currentGradeForm.shared_with.includes(grade.id) ? <FiCheckCircle className="text-indigo-500" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-200" />}
                                                                    </div>
                                                                ))}
                                                        </div>
                                                        <p className="text-[9px] font-bold text-indigo-400 italic mt-2 px-1">
                                                            * Selected grades will be marked as "Verified" automatically with 0 unique seats.
                                                        </p>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>
                                </div>

                                {/* Magic Math Validation Banner */}
                                <AnimatePresence>
                                    {Object.values(currentGradeForm).some(v => v !== "") && (
                                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`rounded-3xl p-5 border-2 mt-6 ${gradeStats.isOk ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                                            <div className="flex items-center justify-between mb-3 border-b-2 border-white/40 pb-3">
                                                <span className={`text-xs font-black uppercase tracking-widest ${gradeStats.isOk ? "text-emerald-600" : "text-red-500"}`}>Combined Capacity</span>
                                                <span className={`text-2xl font-black ${gradeStats.isOk ? "text-emerald-600" : "text-red-600"}`}>{gradeStats.capacity}</span>
                                            </div>
                                            {gradeStats.isOk ? (
                                                <div className="flex items-start gap-2 text-emerald-700">
                                                    <span className="text-lg">✅</span>
                                                    <p className="text-sm font-bold pt-0.5">Every learner is accommodated! ({gradeStats.diff} extra)</p>
                                                </div>
                                            ) : (
                                                <div className="flex items-start gap-2 text-red-700">
                                                    <span className="text-lg">⚠️</span>
                                                    <p className="text-sm font-bold pt-0.5">Note: A shortage/excess of <span className="text-red-600 text-lg font-black">{Math.abs(gradeStats.diff)}</span> seats has been identified for this grade level.</p>
                                                </div>
                                            )}

                                            {gradeStats.diff !== 0 && (
                                                <div className="mt-4 pt-4 border-t border-black/5">
                                                    <p className="text-[10px] font-black uppercase tracking-tight mb-2 opacity-70">Please type "confirm" to acknowledge this status</p>
                                                    <input 
                                                        type="text" 
                                                        value={gradeValidationConfirm} 
                                                        onChange={(e) => setGradeValidationConfirm(e.target.value)} 
                                                        placeholder="Type here..."
                                                        className={`w-full p-3 border-2 rounded-2xl text-center text-sm font-black outline-none transition-all ${gradeStats.isOk ? "bg-white border-emerald-200 text-emerald-700 focus:border-emerald-500" : "bg-white border-red-200 text-red-700 focus:border-red-500"}`}
                                                    />
                                                </div>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                            <div className="p-5 border-t border-gray-100 flex gap-3 bg-white rounded-b-3xl">
                                <button 
                                    disabled={gradeStats.diff !== 0 && gradeValidationConfirm.trim().toLowerCase() !== "confirm"}
                                    onClick={handleSaveGradeLevel} 
                                    className="flex-1 py-4 rounded-2xl text-white font-black text-lg text-center bg-indigo-500 border-b-[5px] border-indigo-700 active:border-b-0 active:translate-y-[5px] transition-all disabled:opacity-50"
                                >
                                    Save &amp; Verify Grade
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

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
                onClose={() => setShowSuccess(false)} 
                message="Your school resources and utility profile have been synced to the registry. Brilliant!" 
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
                            <h2 className="text-2xl font-black text-gray-900 text-center leading-tight px-4">Local Secure: Unit 6 Saved!</h2>
                            <p className="text-gray-500 text-center font-medium mt-3 px-6">Your classroom furniture audits, ICT inventory, and utility reports have been saved locally. We will automatically sync your resources once you're back online.</p>
                            
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
        </div>
    );
};

export default Unit6SchoolResources;

