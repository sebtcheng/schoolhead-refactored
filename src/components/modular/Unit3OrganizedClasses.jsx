import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FiX, FiCheckCircle, FiCheck, FiChevronRight, FiChevronLeft, FiLayers, FiUsers, FiUnlock, FiSave, FiArrowLeft, FiAlertTriangle, FiWifiOff } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import SuccessModal from "../SuccessModal";
import { saveUnitDraft, getUnitDraft, clearUnitDraft, addModularToOutbox, getModularOutbox } from "../../db";
import { useAuth } from "../../context/AuthContext";
import UnitRemarkAlert from "./UnitRemarkAlert";
import { api } from "../../lib/api";

// ── Shared styles ─────────────────────────────────────────────────────────────
const chunkyInput = "w-full p-4 mt-2 bg-white border-2 border-[#BAE6FD] rounded-3xl text-xl font-black text-slate-800 text-center focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-[#E0F2FE] hover:border-slate-300 transition-all shadow-sm disabled:opacity-50 disabled:bg-slate-100 font-body";
const subInput = "w-full p-3 mt-1 bg-white border-2 border-[#BAE6FD] rounded-xl text-lg font-bold text-slate-800 text-center focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-[#E0F2FE] hover:border-slate-300 transition-all shadow-sm disabled:opacity-50 disabled:bg-slate-100 font-body";

const ALL_GRADES = [
    { label: "Kindergarten", id: "kinder" },
    { label: "Grade 1", id: "g1" },
    { label: "Grade 2", id: "g2" },
    { label: "Grade 3", id: "g3" },
    { label: "Grade 4", id: "g4" },
    { label: "Grade 5", id: "g5" },
    { label: "Grade 6", id: "g6" },
    { label: "Grade 7", id: "g7" },
    { label: "Grade 8", id: "g8" },
    { label: "Grade 9", id: "g9" },
    { label: "Grade 10", id: "g10" },
    { label: "Grade 11", id: "g11" },
    { label: "Grade 12", id: "g12" },
];

const getClassSizeOptions = (className) => {
    const name = (className || "").toLowerCase().trim();
    
    if (name.includes("&") || name.includes("joined") || name.includes("multigrade")) {
        return ["< 25 learners", "25 learners", "> 25 learners"];
    }
    if (name.includes("kinder")) {
        return ["< 25 learners", "25-30 learners", "> 30 learners"];
    }
    if (name === "grade 1" || name === "grade 2" || name === "grade 3") {
        return ["< 30 learners", "30-35 learners", "> 35 learners"];
    }
    if (name === "grade 11" || name === "grade 12") {
        return ["< 45 learners", "45 learners", "> 45 learners"];
    }
    // Default for Grades 4-10
    return ["< 40 learners", "40-45 learners", "> 45 learners"];
};

const getCapacityBounds = (gradeName, col_below, col_within, col_above) => {
    const name = (gradeName || "").toLowerCase().trim();
    let minPerSec, maxPerSec, inMin, inMax, overMin;

    if (name.includes("&") || name.includes("joined") || name.includes("multigrade")) {
        // ["< 25", "25", "> 25"]
        minPerSec = 1; maxPerSec = 24;
        inMin = 25; inMax = 25;
        overMin = 26;
    } else if (name.includes("kinder")) {
        // ["< 25", "25-30", "> 30"]
        minPerSec = 1; maxPerSec = 24;
        inMin = 25; inMax = 30;
        overMin = 31;
    } else if (name === "grade 1" || name === "grade 2" || name === "grade 3") {
        // ["< 30", "30-35", "> 35"]
        minPerSec = 1; maxPerSec = 29;
        inMin = 30; inMax = 35;
        overMin = 36;
    } else if (name === "grade 11" || name === "grade 12") {
        // ["< 45", "45", "> 45"]
        minPerSec = 1; maxPerSec = 44;
        inMin = 45; inMax = 45;
        overMin = 46;
    } else {
        // Default for Grades 4-10: ["< 40", "40-45", "> 45"]
        minPerSec = 1; maxPerSec = 39;
        inMin = 40; inMax = 45;
        overMin = 46;
    }

    const minTotal = (col_below * minPerSec) + (col_within * inMin) + (col_above * overMin);
    const maxTotal = (col_below * maxPerSec) + (col_within * inMax) + (col_above * 999); // No hard max for 'above'

    return { minTotal, maxTotal };
};

const parseSummaryString = (str, gradeLabel) => {
    const data = { total_sections: 0, col_below: 0, col_within: 0, col_above: 0 };
    if (!str) return data;
    
    const options = getClassSizeOptions(gradeLabel);
    
    const parts = str.split(',').map(p => p.trim());
    parts.forEach(part => {
        const match = part.match(/^(\d+)\s*\((.+)\)$/);
        if (match) {
            const count = parseInt(match[1]) || 0;
            const label = match[2].trim();
            
            if (label === options[0]) {
                data.col_below = count;
            } else if (label === options[1]) {
                data.col_within = count;
            } else if (label === options[2]) {
                data.col_above = count;
            }
            data.total_sections += count;
        }
    });
    return data;
};


const Unit3OrganizedClasses = ({ targetSchoolId, isReadOnly: propReadOnly }) => {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [schoolId, setSchoolId] = useState("");
    const [iern, setIern] = useState("");
    const [showWelcomeBack, setShowWelcomeBack] = useState(false);
    const [showDraftModal, setShowDraftModal] = useState(false);
    const [showOfflineSuccess, setShowOfflineSuccess] = useState(false);
    const [pendingOutboxId, setPendingOutboxId] = useState(null);
    const [isReviewMode, setIsReviewMode] = useState(false);

    const [isFetching, setIsFetching] = useState(true);
    const [fetchError, setFetchError] = useState(null);

    // Dynamic Grades State
    const [availableGrades, setAvailableGrades] = useState([]);
    const [hasElementary, setHasElementary] = useState(false);

    // Wizard State
    // Steps mapping:
    // 0: Multigrade (skipped if hasElementary === false)
    // 1 to N: Grades in availableGrades
    const [currentStep, setCurrentStep] = useState(0);
    const [mgSubStep, setMgSubStep] = useState('overview'); // 'overview' | 'distribution' — for multigrade grade steps

    const { user, authLoading } = useAuth();
    // Form State
    const [sectionData, setSectionData] = useState({});

    // Summary & Enrollment State
    const [isReadOnly, setIsReadOnly] = useState(propReadOnly || false);
    
    useEffect(() => {
        if (propReadOnly !== undefined) {
            setIsReadOnly(propReadOnly);
        }
    }, [propReadOnly]);
    const [totalEnrollment, setTotalEnrollment] = useState(0);
    const [isCertified, setIsCertified] = useState(false);

    const effectiveReadOnly = propReadOnly || isReadOnly;

    const parseClassStructure = (d) => {
        let activeClasses = [];
        let parsedData = {};
        let isActuallySaved = false;
        
        // --- 0. Parse Unit 2 Data for Strict Filtering ---
        let u2ActiveGrades = {}; // Map of gradeId -> { is_active, total }
        
        // First, check for flat enroll_ fields directly in the data object (from database query)
        const gradeKeys = ['kinder', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11', 'g12'];
        gradeKeys.forEach(gk => {
            const enrollVal = d[`enroll_${gk}`];
            if (enrollVal !== undefined && enrollVal !== null) {
                const total = parseInt(enrollVal) || 0;
                u2ActiveGrades[gk] = {
                    is_active: total > 0,
                    total: total
                };
            }
        });

        // Overlay/prefer structured unit2_simplified_enrollment if present
        if (d.unit2_simplified_enrollment) {
            try {
                const u2Raw = typeof d.unit2_simplified_enrollment === 'string'
                    ? JSON.parse(d.unit2_simplified_enrollment)
                    : d.unit2_simplified_enrollment;
                
                const u2Arr = Array.isArray(u2Raw) ? u2Raw : (u2Raw.array || []);
                u2Arr.forEach(item => {
                    u2ActiveGrades[item.grade_level] = {
                        is_active: item.is_active !== false,
                        total: parseInt(item.total) || 0
                    };
                });
            } catch (e) { console.warn("U2 Parse Error in Unit 3", e); }
        }

        // 1. Check Multigrade Slots (Primary Source for groupings)
        for (let i = 1; i <= 3; i++) {
            const groupName = d[`multigrade_groupings_${i}`];
            const groupSize = d[`multigrade_size_${i}`];
            const groupSections = d[`multigrade_sections_${i}`] || 0; 

            if (groupName) {
                const id = `mg_${i}`;
                const u2Total = parseInt(d[`multigrade_enrollment_${i}`]) || 0;
                activeClasses.push({ label: groupName, id, u2_total: u2Total });
                parsedData[id] = { 
                    selectedSize: groupSize || null, 
                    total_sections: groupSections || 0,
                    col_below: 0,
                    col_within: 0,
                    col_above: 0
                };
                if (groupSize) isActuallySaved = true;
            }
        }
        
        // 2. Check Single Grades
        const singleGradeMappings = [
            { key: 'grade_kinder_size', label: 'Kindergarten', id: 'kinder', u2Key: 'kinder' },
            { key: 'grade_1_size', label: 'Grade 1', id: 'g1', u2Key: 'g1' },
            { key: 'grade_2_size', label: 'Grade 2', id: 'g2', u2Key: 'g2' },
            { key: 'grade_3_size', label: 'Grade 3', id: 'g3', u2Key: 'g3' },
            { key: 'grade_4_size', label: 'Grade 4', id: 'g4', u2Key: 'g4' },
            { key: 'grade_5_size', label: 'Grade 5', id: 'g5', u2Key: 'g5' },
            { key: 'grade_6_size', label: 'Grade 6', id: 'g6', u2Key: 'g6' },
            { key: 'grade_7_size', label: 'Grade 7', id: 'g7', u2Key: 'g7' },
            { key: 'grade_8_size', label: 'Grade 8', id: 'g8', u2Key: 'g8' },
            { key: 'grade_9_size', label: 'Grade 9', id: 'g9', u2Key: 'g9' },
            { key: 'grade_10_size', label: 'Grade 10', id: 'g10', u2Key: 'g10' },
            { key: 'grade_11_size', label: 'Grade 11', id: 'g11', u2Key: 'g11' },
            { key: 'grade_12_size', label: 'Grade 12', id: 'g12', u2Key: 'g12' }
        ];

        // Track multigrade labels to hide joined single grades
        const mgLabels = activeClasses.map(ac => ac.label.toLowerCase());

        // Determine which single grades are actually active in the school
        // Prioritize local storage or draft offering if Unit 1 was recently changed
        const storedOffering = localStorage.getItem("schoolOffering");
        let co = (storedOffering || d.curricular_offering || "").toLowerCase();

        let offeringGrades = [];
        if (co === "purely elementary") {
            offeringGrades = ['kinder', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6'];
        } else if (co === "elementary school and junior high school (k-10)" || co.includes("k-10") || co.includes("k to 10")) {
            offeringGrades = ['kinder', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10'];
        } else if (co === "junior high and senior high") {
            offeringGrades = ['g7', 'g8', 'g9', 'g10', 'g11', 'g12'];
        } else if (co === "all offering (k to 12)" || co.includes("k-12") || co.includes("k to 12") || co.includes("integrated")) {
            offeringGrades = ['kinder', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11', 'g12'];
        } else if (co === "purely junior high school") {
            offeringGrades = ['g7', 'g8', 'g9', 'g10'];
        } else if (co === "purely senior high school") {
            offeringGrades = ['g11', 'g12'];
        } else {
            // Fallback for legacy data
            if (co.includes("integrated") || co.includes("k-12") || co.includes("k to 12") || co.includes("k-10") || co.includes("k to 10")) {
                // Keep pattern for super-legacy but prioritized by explicit checks above
                offeringGrades = singleGradeMappings.map(m => m.id);
            } else {
                if (co.includes("kinder")) offeringGrades.push("kinder");
                if (co.includes("elementary") || co.includes("primary")) {
                    offeringGrades.push("kinder", "g1", "g2", "g3", "g4", "g5", "g6");
                }
                if (co.includes("junior high") || co.includes("jhs")) {
                    offeringGrades.push("g7", "g8", "g9", "g10");
                }
                if (co.includes("senior high") || co.includes("shs")) {
                    offeringGrades.push("g11", "g12");
                }
            }
        }
        offeringGrades = [...new Set(offeringGrades)];

        singleGradeMappings.forEach(mapping => {
            const size = d[mapping.key];
            
            // --- STRICT FILTERING LOGIC ---
            // A grade is allowed iff:
            // 1. It is in the general Curricular Offering
            // 2. AND (If Unit 2 is saved) it is marked ACTIVE and has TOTAL > 0
            
            const isOffered = offeringGrades.includes(mapping.id);
            const u2Data = u2ActiveGrades[mapping.id];
            
            // If u2Data exists, it must be active and have count > 0.
            // If u2Data doesn't exist but Unit 2 IS saved, we assume it's NOT active.
            // If Unit 2 is not saved yet, we fall back to general offering.
            const isActuallyActive = u2Data 
                ? (u2Data.is_active && u2Data.total > 0)
                : (d.unit2_simplified_enrollment ? false : isOffered);

            if (!isActuallyActive) return;

            // Check if this single grade is part of ANY multigrade label
            const isJoined = mgLabels.some(label => {
                const gradeNum = mapping.label.replace(/\D/g, "");
                if (gradeNum) {
                    const numRegex = new RegExp(`\\b${gradeNum}\\b`);
                    return numRegex.test(label) || label.includes(mapping.label.toLowerCase());
                }
                return label.includes(mapping.label.toLowerCase());
            });

            if (!isJoined) {
                activeClasses.push({ label: mapping.label, id: mapping.id, u2_total: u2Data?.total || 0 });
                parsedData[mapping.id] = { 
                    selectedSize: size || null, 
                    total_sections: 0,
                    col_below: 0,
                    col_within: 0,
                    col_above: 0
                };
                if (size) isActuallySaved = true;
            }
        });

        return { activeClasses, parsedData, isActuallySaved };
    };

    useEffect(() => {
        const init = async () => {
            if (authLoading) return;
            setIsFetching(true);
            setFetchError(null);
            
            const storedId = targetSchoolId || user?.school_id || localStorage.getItem("schoolId");
            if (!storedId) {
                setFetchError("School ID not found. Please re-login.");
                setIsFetching(false);
                return;
            }
            setSchoolId(storedId);

            try {
                // 1. Gather all local sources
                const outbox = await getModularOutbox().catch(() => []);
                const pendingUnit1 = outbox.find(e => e.unitId === 1 && (e.schoolId === storedId || e.payload?.schoolId === storedId || e.payload?.school_id === storedId));
                const pendingUnit2 = outbox.find(e => e.unitId === 2 && (e.schoolId === storedId || e.payload?.schoolId === storedId || e.payload?.school_id === storedId));
                const pendingUnit3 = outbox.find(e => e.unitId === 3 && (e.schoolId === storedId || e.payload?.schoolId === storedId || e.payload?.school_id === storedId));
                const draft = await getUnitDraft(3, storedId);

                // 2. Reconstruct school baseline
                let baseline = { iern: "", total_enrollment: 0, curricular_offering: "" };
                try {
                    const res = await fetch(api(`/ph_schools/${storedId}`));
                    if (res.ok) {
                        const saved = await res.json();
                        if (saved.exists && saved.data) baseline = { ...baseline, ...saved.data };
                    }
                } catch (e) {
                    console.log("📍 [Unit3] Offline: Using local sources for baseline.");
                }

                // Overlay Sync Center Data
                if (pendingUnit1) baseline.curricular_offering = pendingUnit1.payload?.curricular_offering || baseline.curricular_offering;
                if (pendingUnit2) {
                    const p = pendingUnit2.payload;
                    const q = p.unit2_simplified_enrollment?.questionnaire || p.unit2_simplified_enrollment;
                    if (q) {
                        let sum = parseInt(q.kinderEnrollment) || 0;
                        if (q.gradeTotals) Object.values(q.gradeTotals).forEach(v => sum += (parseInt(v) || 0));
                        baseline.total_enrollment = sum;
                        baseline.unit2_simplified_enrollment = p.unit2_simplified_enrollment;
                    }
                    baseline.multigrade_groupings_1 = p.multigrade_groupings_1;
                    baseline.multigrade_groupings_2 = p.multigrade_groupings_2;
                    baseline.multigrade_groupings_3 = p.multigrade_groupings_3;
                    baseline.multigrade_enrollment_1 = p.multigrade_enrollment_1;
                    baseline.multigrade_enrollment_2 = p.multigrade_enrollment_2;
                    baseline.multigrade_enrollment_3 = p.multigrade_enrollment_3;
                }

                if (pendingUnit3) {
                    // Also flag as completed to trigger Read Only if needed
                    baseline.unit3_completed = true; 
                }

                if (baseline.iern) setIern(baseline.iern);
                setTotalEnrollment(baseline.total_enrollment || 0);

                // 3. Resolve Form Structure
                const { activeClasses, parsedData, isActuallySaved } = parseClassStructure(baseline);
                setAvailableGrades(activeClasses);

                let sectionCounts = {};
                activeClasses.forEach(ac => {
                    let summaryStr = null;
                    if (ac.id === "kinder") {
                        summaryStr = baseline.grade_kinder_size;
                    } else if (ac.id.startsWith("g")) {
                        const num = ac.id.replace('g', '');
                        summaryStr = baseline[`grade_${num}_size`];
                    } else if (ac.id.startsWith("mg_")) {
                        const idx = ac.id.split("_")[1];
                        summaryStr = baseline[`multigrade_size_${idx}`];
                    }
                    
                    const parsed = parseSummaryString(summaryStr, ac.label);
                    sectionCounts[ac.id] = {
                        total_sections: parsed.total_sections,
                        col_below: parsed.col_below,
                        col_within: parsed.col_within,
                        col_above: parsed.col_above,
                        selectedSize: parsed.total_sections > 0 ? summaryStr : null
                    };
                });

                let mergedData = {};
                activeClasses.forEach(ac => {
                    mergedData[ac.id] = {
                        selectedSize: parsedData[ac.id]?.selectedSize || sectionCounts[ac.id]?.selectedSize || null,
                        total_sections: sectionCounts[ac.id]?.total_sections || 0,
                        col_below: sectionCounts[ac.id]?.col_below || 0,
                        col_within: sectionCounts[ac.id]?.col_within || 0,
                        col_above: sectionCounts[ac.id]?.col_above || 0
                    };
                });

                // 4. APPLY SYNC CENTER (UNIT 3)
                if (pendingUnit3) {
                    setSectionData(pendingUnit3.payload?.sectionData || mergedData);
                    setPendingOutboxId(pendingUnit3.id);
                    setIsReviewMode(true);
                    setIsReadOnly(true);
                } 
                // 5. APPLY DRAFT
                else if (draft) {
                    setSectionData(draft.sectionData || mergedData);
                    setCurrentStep(draft.step !== undefined ? draft.step : 1);
                    setIsReadOnly(false);
                    setShowWelcomeBack(true);
                    setTimeout(() => setShowWelcomeBack(false), 3000);
                } else {
                    setSectionData(mergedData);
                    setCurrentStep(1);
                    if (isActuallySaved || baseline.unit3_completed || propReadOnly) {
                        setIsReadOnly(true);
                    }
                }

            } catch (e) {
                console.warn("Could not fetch/init Unit 3 data", e);
                setFetchError("An error occurred while loading class data. Please try again.");
            } finally {
                setIsFetching(false);
            }
        };
        init();
    }, [targetSchoolId, user?.school_id, authLoading]);

    const handleChange = (gradeId, field, value) => {
        let val = value;
        if (field === 'total_sections' || field.startsWith('col_')) {
            // Trim to 2 digits maximum
            if (val.length > 2) val = val.slice(0, 2);
            val = parseInt(val) || 0;
        }
        setSectionData(prev => ({ 
            ...prev, 
            [gradeId]: {
                ...prev[gradeId],
                [field]: val
            }
        }));
    };

    // Wizard Navigation Logic
    const totalSteps = availableGrades.length;
    const canGoBack = currentStep > 1;
    const isEditingGrade = currentStep > 0 && currentStep <= totalSteps;
    const currentGrade = isEditingGrade ? availableGrades[currentStep - 1] : null;

    // Wizard Validation Logic for Current Step Only
    const isCurrentStepValid = useMemo(() => {
        if (isEditingGrade && currentGrade) {
            if (currentGrade.id.startsWith('mg_') && mgSubStep === 'overview') return true;
            
            const data = sectionData[currentGrade.id] || { total_sections: 0, col_below: 0, col_within: 0, col_above: 0 };
            const total = parseInt(data.total_sections) || 0;
            if (total === 0) return false; // MUST ENTER TOTAL SECTION
            
            const sum = (parseInt(data.col_below) || 0) + (parseInt(data.col_within) || 0) + (parseInt(data.col_above) || 0);
            if (sum !== total) return false;

            // Math Cross-Validation with Unit 2 Enrollment
            const u2Total = currentGrade.u2_total || 0;
            const { minTotal, maxTotal } = getCapacityBounds(currentGrade.label, data.col_below || 0, data.col_within || 0, data.col_above || 0);
            
            return u2Total >= minTotal && u2Total <= maxTotal;
        }
        return true;
    }, [currentStep, isEditingGrade, currentGrade, sectionData]);

    const handleBack = () => {
        if (currentGrade?.id.startsWith('mg_') && mgSubStep === 'distribution') {
            setMgSubStep('overview');
            return;
        }
        if (canGoBack) setCurrentStep(prev => prev - 1);
    };

    const handleNext = () => {
        if (currentGrade?.id.startsWith('mg_') && mgSubStep === 'overview') {
            setMgSubStep('distribution');
            return;
        }
        if (isCurrentStepValid) {
            setMgSubStep('overview'); // reset for next potential MG step
            setCurrentStep(prev => prev + 1);
        }
    };

    const handleSaveDraftAndExit = async () => {
        if (!schoolId) return;
        await saveUnitDraft(3, schoolId, { sectionData, step: currentStep });
        navigate("/modular-dashboard");
    };

    const handleFinalSubmit = async () => {
        if (!schoolId || !isCurrentStepValid) return;
        setLoading(true);

        try {
            const payload = {
                iern,
                has_multigrade: availableGrades.some(g => g.id.startsWith("mg_")),
                multigrade_sections_count: 0,
                multigrade_groups: null,
                sectionData: sectionData, // IMPORTANT: needed for offline summary reconstruction
                totalSteps: availableGrades.length
            };

            // Extract the strings cleanly for API routing
            availableGrades.forEach(g => {
                const data = sectionData[g.id] || { total_sections: 0, col_below: 0, col_within: 0, col_above: 0 };
                const pills = getClassSizeOptions(g.label);
                
                // Construct a summary string for the flat text column
                let summaryParts = [];
                if (data.col_below > 0) summaryParts.push(`${data.col_below} (${pills[0]})`);
                if (data.col_within > 0) summaryParts.push(`${data.col_within} (${pills[1]})`);
                if (data.col_above > 0) summaryParts.push(`${data.col_above} (${pills[2]})`);
                
                const sSize = summaryParts.length > 0 ? summaryParts.join(", ") : null;

                if (g.id === "kinder") payload.grade_kinder_size = sSize;
                else if (g.id.startsWith("g")) payload[`grade_${g.id.replace('g', '')}_size`] = sSize;
                else if (g.id.startsWith("mg_")) {
                    const idx = g.id.split("_")[1];
                    payload[`multigrade_groupings_${idx}`] = g.label;
                    payload[`multigrade_size_${idx}`] = sSize;
                }
            });

            if (!navigator.onLine) {
                // OFFLINE SAVE
                await addModularToOutbox({
                    unitId: 3,
                    label: "Unit 3: Section Organization",
                    url: api(`/ph_schools/unit3/${schoolId}`),
                    method: 'PUT',
                    payload: payload,
                    schoolId: schoolId
                });
                await clearUnitDraft(3, schoolId);
                
                // Update local visual progress
                const stored = localStorage.getItem('quest_progress');
                let progress = stored ? JSON.parse(stored) : { completedUnits: [], xp: 0 };
                if (!progress.completedUnits.includes(3)) {
                    progress.completedUnits.push(3);
                    progress.xp = (progress.xp || 0) + 200;
                }
                localStorage.setItem('quest_progress', JSON.stringify(progress));

                setShowOfflineSuccess(true);
                return;
            }

            const res = await fetch(api(`/api/ph_schools/unit3/${schoolId}`), {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error("Failed to save class organization");

            // Sync progress to cloud (fire-and-forget)
            try {
                await fetch(api(`/api/user/progress`), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ unitId: 3, schoolId })
                });
            } catch (e) { console.warn("Progress sync failed", e); }

            // Update localStorage so ModularDashboard immediately reflects completion
            const stored = localStorage.getItem('quest_progress');
            let progress = stored ? JSON.parse(stored) : { completedUnits: [], xp: 0 };
            if (!progress.completedUnits.includes(3)) {
                progress.completedUnits.push(3);
                progress.xp = (progress.xp || 0) + 200;
            }
            localStorage.setItem('quest_progress', JSON.stringify(progress));

            await clearUnitDraft(3, schoolId);
            setShowSuccess(true);
        } catch (err) {
            console.error("Unit 3 Submit error:", err);
            if (!navigator.onLine || err.message.includes('fetch')) {
                await addModularToOutbox({
                    unitId: 3,
                    label: "Unit 3: Section Organization",
                    url: api(`/ph_schools/unit3/${schoolId}`),
                    method: 'PUT',
                    payload: payload,
                    schoolId: schoolId
                });
                await clearUnitDraft(3, schoolId);
                setShowOfflineSuccess(true);
            } else {
                alert(err.message);
            }
        }
        setLoading(false);
    };

    // Calculate overall wizard progress percentage
    const progressPercent = useMemo(() => {
        // Steps: Grades + Confirmation
        const total = totalSteps + 1; 
        const current = currentStep; 
        if (total === 0) return 0;
        return (current / total) * 100;
    }, [currentStep, totalSteps]);

    const Unit3ClassesSummary = () => {
        // Calculate Total Classes across active grades
        const totalClasses = (availableGrades || []).reduce((sum, g) => {
            const data = sectionData[g.id] || {};
            return sum + (data.total_sections || 0);
        }, 0);

        const averageClassSize = totalClasses > 0 ? Math.round(totalEnrollment / totalClasses) : 0;

        // Calculate global distribution percentages
        const distribution = (availableGrades || []).reduce((acc, g) => {
            const data = sectionData[g.id] || {};
            acc.below += (data.col_below || 0);
            acc.within += (data.col_within || 0);
            acc.above += (data.col_above || 0);
            return acc;
        }, { below: 0, within: 0, above: 0 });

        const getPercent = (val) => totalClasses > 0 ? Math.round((val / totalClasses) * 100) : 0;

        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full pb-32 mt-4 space-y-8 px-2">
                {/* Header */}
                <div className="text-center mb-10">
                    <motion.div 
                        initial={{ scale: 0 }} 
                        animate={{ scale: 1 }} 
                        className="w-20 h-20 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-[2rem] mx-auto mb-6 flex items-center justify-center shadow-xl shadow-teal-100"
                    >
                        <FiLayers className="w-10 h-10 text-white" />
                    </motion.div>
                    <span className="inline-block px-4 py-1.5 rounded-full bg-teal-50 text-teal-700 text-[10px] font-black uppercase tracking-[0.2em] mb-3 shadow-sm border border-teal-100">
                        Unit 3 • Section Organization
                    </span>
                    <h1 className="text-3xl font-black text-slate-800 leading-tight tracking-tight px-4 text-center">Classroom Registry</h1>
                    <p className="text-slate-500 font-medium mt-2 italic px-4 text-center">"Section distribution and class-size optimization report"</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Overall Capacity Card */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-teal-100 relative overflow-hidden group border border-white/5">
                            <div className="absolute top-0 right-0 p-8 text-8xl opacity-10 rotate-12 group-hover:rotate-0 transition-transform duration-700">📋</div>
                            <div className="relative z-10">
                                <p className="text-teal-300 text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-center">Overall Class Capacity</p>
                                <div className="flex items-center justify-around py-4 border-y border-white/10 mt-4">
                                    <div className="text-center">
                                        <p className="text-4xl font-black leading-none">{totalClasses}</p>
                                        <p className="text-[9px] font-bold text-teal-400 uppercase mt-2 tracking-widest">Total Sections</p>
                                    </div>
                                    <div className="w-px h-12 bg-white/10" />
                                    <div className="text-center">
                                        <p className="text-4xl font-black leading-none">{averageClassSize}</p>
                                        <p className="text-[9px] font-bold text-teal-400 uppercase mt-2 tracking-widest">Avg Size</p>
                                    </div>
                                </div>

                                {/* Distribution Visualizer */}
                                <div className="mt-8 space-y-3">
                                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-teal-200">
                                        <span>Size Distribution</span>
                                        <span>In Standard: {getPercent(distribution.within)}%</span>
                                    </div>
                                    <div className="h-3 w-full bg-white/10 rounded-full overflow-hidden flex">
                                        <div style={{ width: `${getPercent(distribution.below)}%` }} className="h-full bg-blue-400" title="Below Standard" />
                                        <div style={{ width: `${getPercent(distribution.within)}%` }} className="h-full bg-emerald-400" title="Within Standard" />
                                        <div style={{ width: `${getPercent(distribution.above)}%` }} className="h-full bg-rose-400" title="Above Standard" />
                                    </div>
                                    <div className="flex justify-between gap-2">
                                        <span className="flex items-center gap-1 text-[8px] font-black uppercase text-blue-300">
                                            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" /> Below
                                        </span>
                                        <span className="flex items-center gap-1 text-[8px] font-black uppercase text-emerald-300">
                                            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" /> In-Standard
                                        </span>
                                        <span className="flex items-center gap-1 text-[8px] font-black uppercase text-rose-300">
                                            <div className="w-1.5 h-1.5 bg-rose-400 rounded-full" /> Over
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Detailed Breakdown */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex items-center justify-between px-2">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-6 bg-teal-500 rounded-full" />
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Grade-by-Grade Detail</h3>
                            </div>
                        </div>

                        <div className="grid gap-4">
                            {(availableGrades || []).map(g => {
                                const data = sectionData[g.id] || {};
                                if (!data.is_active && data.is_active !== undefined) return null;
                                const pills = getClassSizeOptions(g.label);
                                const isMG = g.id.startsWith("mg_");
                                
                                return (
                                    <div key={g.id} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden group hover:border-teal-200 transition-colors">
                                        <div className="flex items-start justify-between relative z-10">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className="text-xl font-black text-slate-800 tracking-tight">{g.label}</h4>
                                                    {isMG && <span className="px-2 py-0.5 rounded-lg bg-rose-50 text-rose-600 text-[8px] font-black uppercase border border-rose-100 tracking-tighter">Multigrade</span>}
                                                </div>
                                                
                                                <div className="mt-4 space-y-3">
                                                    {/* Threshold Guide */}
                                                    <div className="flex items-center gap-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                                        <span>Standard Thresholds:</span>
                                                        <span className="text-teal-600 font-bold">{pills[1]}</span>
                                                    </div>

                                                    <div className="flex flex-wrap gap-2">
                                                        {data.col_below > 0 && (
                                                            <div className="flex flex-col gap-1">
                                                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-100">
                                                                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                                                                    <span className="text-[10px] font-black text-blue-700">{data.col_below} Sec</span>
                                                                    <span className="text-[8px] font-bold text-blue-400 uppercase tracking-tighter">({pills[0]})</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {data.col_within > 0 && (
                                                            <div className="flex flex-col gap-1">
                                                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-100">
                                                                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                                                    <span className="text-[10px] font-black text-emerald-700">{data.col_within} Sec</span>
                                                                    <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-tighter">({pills[1]})</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {data.col_above > 0 && (
                                                            <div className="flex flex-col gap-1">
                                                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-100">
                                                                    <span className="w-2 h-2 rounded-full bg-rose-400" />
                                                                    <span className="text-[10px] font-black text-rose-700">{data.col_above} Sec</span>
                                                                    <span className="text-[8px] font-bold text-rose-400 uppercase tracking-tighter">({pills[2]})</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right ml-4">
                                                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Total Sections</p>
                                                <div className="bg-slate-900 text-white px-5 py-2 rounded-2xl font-black text-2xl shadow-lg group-hover:bg-teal-600 transition-colors">
                                                    {data.total_sections || 0}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </motion.div>
        );
    };

    return (
        <div className="min-h-screen unit1-page pb-32">
            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@500;700;900&family=Comic+Neue:wght@400;700&display=swap');
                
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
                  --font-heading: Quicksand, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                  --font-body: 'Comic Neue', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
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

                .bg-white.rounded-3xl {
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
            <UnitRemarkAlert unitId="u3" schoolId={targetSchoolId || user?.school_id || localStorage.getItem('schoolId')} />
            <AnimatePresence>
                {showSuccess && <SuccessModal isOpen={showSuccess} onClose={() => setShowSuccess(false)} message="Section Counts updated." redirectUrl="/modular-dashboard" />}
            </AnimatePresence>

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

            {/* Header */}
            <header className="px-6 py-5 flex items-center justify-between border-b border-gray-100/50 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => effectiveReadOnly ? navigate("/modular-dashboard") : handleBack()} 
                        className="p-2 -ml-2 text-gray-400 hover:text-indigo-600 transition-colors"
                    >
                        <FiArrowLeft className="w-6 h-6" />
                    </button>
                    <div className="flex flex-col ml-2">
                        <span className="text-[10px] font-black tracking-widest text-indigo-400 uppercase leading-none">
                            {effectiveReadOnly ? "Reviewing" : "Module 3"}
                        </span>
                        <span className="text-sm font-black text-slate-800 leading-tight">
                            Section Registry
                        </span>
                    </div>
                </div>
                {!effectiveReadOnly && (
                    <div className="flex items-center gap-4">
                        <div className="w-[120px] h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <motion.div 
                                className="h-full bg-blue-600 rounded-full" 
                                initial={{ width: 0 }} 
                                animate={{ width: `${progressPercent}%` }} 
                                transition={{ duration: 0.8, ease: "circOut" }} 
                            />
                        </div>
                        <span className="text-xs font-black tracking-widest text-gray-300 uppercase">
                            Step {currentStep > totalSteps ? 'Final' : currentStep > 0 ? `${currentStep}/${totalSteps}` : 'Intro'}
                        </span>
                    </div>
                )}
            </header>

            <main className={effectiveReadOnly ? "max-w-7xl mx-auto px-4 md:px-8 w-full mt-4" : "max-w-md mx-auto p-5 pb-10 mt-4"}>
                
                {isFetching ? (
                    <div className="flex flex-col items-center justify-center h-64">
                         <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                         <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Loading Classes...</p>
                    </div>
                ) : fetchError ? (
                     <div className="bg-red-50 border-2 border-red-100 p-6 rounded-3xl text-center shadow-sm">
                          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                              <FiX className="w-8 h-8 text-red-500" />
                          </div>
                         <h3 className="text-xl font-black text-red-700 mb-2">Unavailable</h3>
                         <p className="text-red-600/80 font-medium mb-6">{fetchError}</p>
                         <button 
                             onClick={() => window.location.reload()} 
                             className="px-6 py-3 bg-white border-2 border-red-200 text-red-600 font-bold rounded-xl shadow-sm hover:bg-red-50 transition-all"
                         >
                             Try Again
                         </button>
                     </div>
                ) : effectiveReadOnly ? (
                    <Unit3ClassesSummary />
                ) : (
                    <>
                {/* Page 0 (Multigrade) Removed */}


                {/* ── Page 1 to N: Single Grade ── */}
                {isEditingGrade && currentGrade && (
                     <motion.div
                        key={`step-${currentStep}-${mgSubStep}`}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        {/* MG Overview sub-screen */}
                        {currentGrade.id.startsWith('mg_') && mgSubStep === 'overview' ? (
                            <div className="space-y-8">
                                <div className="text-center mb-10">
                                    <span className="inline-block px-4 py-1.5 rounded-full bg-rose-100 text-rose-600 text-xs font-black uppercase tracking-[0.2em] mb-4 shadow-sm">
                                        Multigrade Combination • {currentStep}/{totalSteps}
                                    </span>
                                    <h1 className="text-4xl font-black text-slate-800 mb-2 leading-tight">
                                        {currentGrade.label}
                                    </h1>
                                    <p className="text-slate-500 font-medium text-lg">
                                        Review this multigrade combination before entering section data.
                                    </p>
                                </div>
                                <div className="bg-indigo-50/40 rounded-[2.5rem] p-8 border-2 border-indigo-100 shadow-sm">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center text-xl">🤝</div>
                                        <div>
                                            <h3 className="font-black text-slate-800">Combination Overview</h3>
                                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Defined in Unit 2</p>
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-[2rem] p-6 border border-indigo-100">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Grade Levels in This Combination</p>
                                        <p className="text-2xl font-black text-indigo-700 leading-tight">{currentGrade.label}</p>
                                    </div>
                                    {currentGrade.u2_total > 0 && (
                                        <div className="mt-4 bg-white rounded-[2rem] p-6 border border-indigo-100 flex justify-between items-center">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Unit 2 Enrollment</p>
                                            <span className="text-3xl font-black text-indigo-700">{currentGrade.u2_total}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="p-5 bg-amber-50 border-2 border-amber-100 rounded-[2rem] flex items-start gap-3">
                                    <FiAlertTriangle className="text-amber-500 w-5 h-5 mt-0.5 shrink-0" />
                                    <p className="text-sm font-medium text-amber-800 leading-snug">
                                        The grade grouping above was configured in <strong>Unit 2</strong>. To change the combination, you must return to Unit 2 and edit it there.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <>
                             <div className="text-center mb-10">
                                            <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-black uppercase tracking-[0.2em] mb-4 shadow-sm">
                                                Section Setup • {currentStep}/{totalSteps}
                                            </span>
                                            <h1 className="text-5xl font-black text-slate-800 mb-2 leading-tight">
                                                {currentGrade.label}
                                            </h1>
                                            <p className="text-slate-500 font-medium text-lg">
                                                Count sections and distribute them by class size.
                                            </p>
                                        </div>

                        {(()=>{
                            const g = currentGrade;
                            const data = sectionData[g.id] || { total_sections: 0, selectedSize: null };
                            const isActive = true;
                            const total = data.total_sections || 0;
                            const isMathValid = total === 0 || !!data.selectedSize;
                            const pills = getClassSizeOptions(g.label);

                            return (
                            <div className={`bg-white rounded-[2.5rem] p-8 shadow-xl border-4 transition-all duration-500 ${total > 0 ? 'border-indigo-100/50 scale-100' : 'border-slate-100 grayscale scale-[0.98]'}`}>
                                <div className="space-y-10">
                                    
                                    {/* Total Sections Input */}
                                    <div className="flex flex-col items-center">
                                        <label className="text-sm font-black uppercase tracking-[0.2em] text-indigo-400 mb-4">Total Sections</label>
                                        <input 
                                            type="number"
                                            min="0"
                                            value={total === 0 ? "" : total}
                                            onChange={(e) => handleChange(g.id, 'total_sections', e.target.value)}
                                            placeholder="0"
                                            className="w-48 h-32 text-7xl font-black text-center bg-indigo-50 border-4 border-indigo-200 text-indigo-700 rounded-[2rem] focus:bg-white focus:border-indigo-500 shadow-xl shadow-indigo-100/50 outline-none transition-all"
                                        />
                                    </div>

                                    {/* Evaluation Input Grid */}
                                    <AnimatePresence>
                                        {total > 0 && (
                                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="space-y-6">
                                                <div className="pt-6 border-t border-slate-100 mt-6">
                                                    <p className={`text-center font-bold mb-6 ${!isCurrentStepValid ? 'text-indigo-500' : 'text-emerald-500'}`}>
                                                        {isCurrentStepValid ? "✨ Sections Distributed!" : total > 0 ? `Distribute the ${total} ${total === 1 ? 'section' : 'sections'} by size:` : "Please enter total sections"}
                                                    </p>
                                                    
                                                    <div className="grid grid-cols-3 gap-4">
                                                        {[
                                                            { label: pills[0], field: 'col_below', color: 'blue' },
                                                            { label: pills[1], field: 'col_within', color: 'indigo' },
                                                            { label: pills[2], field: 'col_above', color: 'purple' }
                                                        ].map(col => (
                                                            <div key={col.field} className="flex flex-col items-center">
                                                                <label className={`text-[10px] font-black uppercase tracking-widest text-${col.color}-400 mb-2`}>{col.label}</label>
                                                                <input 
                                                                    type="number"
                                                                    min="0"
                                                                    max={total}
                                                                    value={data[col.field] === 0 ? "" : data[col.field]}
                                                                    onChange={(e) => handleChange(g.id, col.field, e.target.value)}
                                                                    placeholder="0"
                                                                    className={`w-full p-4 bg-slate-50 border-2 rounded-2xl text-2xl font-black text-slate-700 text-center focus:outline-none transition-all ${!isCurrentStepValid && total > 0 ? `border-${col.color}-200 focus:border-${col.color}-500 focus:bg-${col.color}-50` : 'border-slate-100 focus:border-indigo-500 focus:bg-indigo-50'}`}
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Conflict Alert */}
                                                    {total > 0 && (
                                                        <AnimatePresence>
                                                            {(() => {
                                                                const sum = (parseInt(data.col_below) || 0) + (parseInt(data.col_within) || 0) + (parseInt(data.col_above) || 0);
                                                                const u2Total = currentGrade.u2_total || 0;
                                                                const { minTotal, maxTotal } = getCapacityBounds(currentGrade.label, data.col_below || 0, data.col_within || 0, data.col_above || 0);
                                                                
                                                                if (sum === total) {
                                                                    if (u2Total < minTotal) {
                                                                        return (
                                                                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-6 p-4 bg-rose-50 border-2 border-rose-100 rounded-2xl flex items-center gap-3">
                                                                                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                                                                                    <FiAlertTriangle className="w-5 h-5 text-rose-600" />
                                                                                </div>
                                                                                <p className="text-xs font-bold text-rose-700 leading-snug">
                                                                                    <span className="block uppercase tracking-widest text-[10px] mb-1">Capacity Conflict</span>
                                                                                    Your distribution requires at least <span className="underline decoration-2">{minTotal}</span> learners, but you only reported <span className="underline decoration-2">{u2Total}</span> in Unit 2.
                                                                                </p>
                                                                            </motion.div>
                                                                        );
                                                                    }
                                                                    if (u2Total > maxTotal) {
                                                                        return (
                                                                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-6 p-4 bg-rose-50 border-2 border-rose-100 rounded-2xl flex items-center gap-3">
                                                                                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                                                                                    <FiAlertTriangle className="w-5 h-5 text-rose-600" />
                                                                                </div>
                                                                                <p className="text-xs font-bold text-rose-700 leading-snug">
                                                                                    <span className="block uppercase tracking-widest text-[10px] mb-1">Capacity Overload</span>
                                                                                    These rooms can only hold <span className="underline decoration-2">{maxTotal}</span> learners. You reported <span className="underline decoration-2">{u2Total}</span> in Unit 2. Add more sections or adjust the size.
                                                                                </p>
                                                                            </motion.div>
                                                                        );
                                                                    }
                                                                }
                                                                return null;
                                                            })()}
                                                        </AnimatePresence>
                                                    )}
                                                    {/* Error Message if Sum Mismatch */}
                                                    {total > 0 && !isCurrentStepValid && (
                                                        <p className="text-center text-red-500 font-bold text-xs mt-6 animate-pulse">
                                                            ⚠️ Total distributed must equal {total} sections
                                                        </p>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                            );
                         })()}
                         </>
                     )}
                     </motion.div>
                )}

                {/* ── Page N+1: Final Confirmation (Receipt) ── */}
                {currentStep > totalSteps && (
                     <motion.div
                        key="step-confirm"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="text-center mb-8">
                            <span className="inline-block px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-600 text-xs font-black uppercase tracking-[0.2em] mb-4 shadow-sm">
                                Review & Verify
                            </span>
                            <h2 className="text-3xl font-black text-slate-800 leading-tight">Class Registry Result</h2>
                            <p className="text-slate-500 font-medium mt-2">Is this data correct as of {new Date().toLocaleDateString()}?</p>
                        </div>

                        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-4 border-slate-100 mb-8 overflow-hidden relative">
                             <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                                <FiCheckCircle className="w-32 h-32" />
                            </div>

                            <div className="space-y-6 relative z-10">
                                {/* Multigrade Receipt Portion Removed */}

                                <div className="space-y-3">
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Grade Level Distribution</p>
                                    {availableGrades.map(g => {
                                        const data = sectionData[g.id] || { total_sections: 0 };
                                        if (data.total_sections === 0) return null;
                                        return (
                                            <div key={g.id} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                                                <span className="font-bold text-slate-700">{g.label}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs font-black text-slate-400 tracking-widest">{data.selectedSize}</span>
                                                    <span className="font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">{data.total_sections} Sections</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="pt-4 mt-6 border-t-4 border-slate-100 flex justify-between items-center">
                                    <span className="text-lg font-black text-slate-800 uppercase tracking-tight">Total Sections</span>
                                    <span className="text-4xl font-black text-indigo-600">
                                        {availableGrades.reduce((sum, g) => sum + (sectionData[g.id]?.total_sections || 0), 0)}
                                    </span>
                                </div>
                            </div>
                        </div>

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
                    </motion.div>
                )}
                </>
                )}
            </main>

            {/* Stepper Navigation */}
            {!effectiveReadOnly && (
                <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-100 flex justify-center z-40 shadow-[0_-10px_30px_rgba(0,0,0,0.03)] px-5 py-6 pb-safe">
                    <div className="w-full max-w-md flex items-center justify-between gap-4">
                        
                        {/* Back / Edit Button */}
                        {currentStep > totalSteps ? (
                            <button 
                                onClick={() => setCurrentStep(1)} 
                                disabled={loading}
                                className="w-16 h-16 rounded-3xl bg-slate-50 border-2 border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 active:scale-95 transition-all outline-none shrink-0"
                            >
                                <FiArrowLeft className="w-6 h-6" />
                            </button>
                        ) : currentStep === 0 ? (
                            <button onClick={() => setShowDraftModal(true)} className="flex-none h-16 px-6 rounded-3xl bg-blue-50 border-2 border-blue-100 flex items-center justify-center gap-2 text-blue-500 hover:text-blue-700 active:scale-95 transition-all outline-none">
                                <FiSave className="w-6 h-6" />
                                <span className="text-sm font-bold text-blue-500">Save Draft</span>
                            </button>
                        ) : (
                            <>
                                <button onClick={handleBack} disabled={loading}
                                    className="w-16 h-16 rounded-3xl bg-slate-50 border-2 border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 active:scale-95 transition-all outline-none shrink-0"
                                >
                                    <FiArrowLeft className="w-6 h-6" />
                                </button>
                                <button onClick={() => setShowDraftModal(true)}
                                    className="flex-none h-16 px-6 rounded-3xl bg-blue-50 border-2 border-blue-100 flex items-center justify-center gap-2 text-blue-500 hover:text-blue-700 active:scale-95 transition-all outline-none shrink-0"
                                >
                                    <FiSave className="w-6 h-6" />
                                    <span className="text-sm font-bold text-blue-500">Save Draft</span>
                                </button>
                            </>
                        )}
                    
                    {/* Next / Submit Button */}
                        <button 
                            disabled={loading || (currentStep <= totalSteps && !isCurrentStepValid) || (currentStep > totalSteps && !isCertified)} 
                            onClick={currentStep > totalSteps ? handleFinalSubmit : handleNext} 
                            className={`flex-1 h-16 rounded-3xl text-white font-black text-lg text-center transition-all disabled:opacity-40 shadow-lg flex items-center justify-center gap-2 border-b-[6px] active:border-b-0 active:translate-y-[6px]
                                ${currentStep > totalSteps ? 'bg-emerald-600 border-emerald-800 shadow-emerald-100' : 'bg-indigo-600 border-indigo-800 shadow-indigo-100'}`}
                        >
                            {currentStep > totalSteps ? (
                                loading ? "Saving..." : (
                                    <span className="flex items-center justify-center gap-2">
                                        SUBMIT ENTRY <FiCheckCircle className="w-5 h-5" />
                                    </span>
                                )
                            ) : (
                                <span>Next Step &gt;</span>
                            )}
                        </button>
                    </div>
                </div>
            )}

            <AnimatePresence>
                {showDraftModal && (
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[100] flex items-end justify-center">
                        <motion.div initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="bg-white w-full max-w-md rounded-t-[3rem] p-10 pb-12 shadow-2xl relative">
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
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[100] flex items-end justify-center">
                        <motion.div initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="bg-white w-full rounded-t-[3rem] p-10 pb-12 shadow-2xl relative">
                            <div className="w-16 h-1.5 bg-gray-200 rounded-full mx-auto mb-8" />
                            <div className="w-20 h-20 bg-amber-500 rounded-full mx-auto flex items-center justify-center text-3xl shadow-2xl shadow-amber-200 mb-6 font-bold text-white">
                                <FiWifiOff />
                            </div>
                            <h2 className="text-2xl font-black text-gray-900 text-center leading-tight px-4">Local Secure: Unit 3 Saved!</h2>
                            <p className="text-gray-500 text-center font-medium mt-3 px-6">Your Section Registry has been saved locally. We will automatically update your school's official records once your internet is restored.</p>
                            
                            <div className="mt-10">
                                <button onClick={() => navigate("/modular-dashboard")}
                                    className="w-full py-5 rounded-[2rem] bg-amber-600 text-white font-black text-lg shadow-xl shadow-amber-100 active:scale-95 transition-all outline-none">
                                    Return to Modules Dashboard
                                </button>
                                <p className="text-[10px] text-amber-500 font-bold uppercase text-center mt-6 tracking-widest leading-loose">✓ Offline Mode • Auto-Sync Enabled ✓</p>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Fixed bottom Unlock button for Read-Only Summary Mode */}
            {(!propReadOnly && isReadOnly) && (
                <div className="fixed bottom-0 left-0 w-full p-6 pb-10 bg-white/80 backdrop-blur-md border-t border-slate-100 flex justify-center z-[60]">
                    <div className="w-full max-w-sm flex gap-3 pointer-events-auto">
                        <button
                            onClick={() => setIsReadOnly(false)}
                            className="flex-1 py-5 rounded-[2rem] bg-teal-600 text-white font-black text-xl shadow-xl shadow-teal-100/50 hover:bg-teal-700 active:scale-95 transition-all flex items-center justify-center gap-3"
                        >
                            <FiUnlock className="w-6 h-6" />
                            <span>Unlock to Audit Registry</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Unit3OrganizedClasses;
