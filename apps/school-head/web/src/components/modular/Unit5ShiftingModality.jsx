import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FiX, FiArrowLeft, FiCheckCircle, FiEdit2, FiCheck, FiClock, FiAlertTriangle, FiMonitor, FiRadio, FiBook, FiLayers, FiUnlock, FiSave, FiWifiOff, FiCopy } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import SuccessModal from "../SuccessModal";
import { saveUnitDraft, getUnitDraft, clearUnitDraft, addModularToOutbox, getModularOutbox } from "../../db";
import { useAuth } from "../../context/AuthContext";
import UnitRemarkAlert from "./UnitRemarkAlert";
import { api } from "../../lib/api";
import { useHistoricalData } from "../../hooks/useHistoricalData";
import { HistoricalDataModal } from "./HistoricalDataModal";


// ── Constants ────────────────────────────────────────────────────────────────
const TOTAL_CHAPTERS = 4; // 1: Gatekeeper, 2: Grade Loop, 3: ADM, 4: Review

// Grade label map for display
const GRADE_LABEL_MAP = {
    kinder: 'Kinder', g1: 'Grade 1', g2: 'Grade 2', g3: 'Grade 3',
    g4: 'Grade 4', g5: 'Grade 5', g6: 'Grade 6', g7: 'Grade 7',
    g8: 'Grade 8', g9: 'Grade 9', g10: 'Grade 10', g11: 'Grade 11', g12: 'Grade 12'
};

const SHIFT_OPTIONS = [
    { id: "Single Shift", label: "Single Shift" },
    { id: "Double Shift", label: "Double Shift" },
    { id: "Triple Shift", label: "Triple Shift" }
];

const MODE_OPTIONS = [
    { id: "In-Person Classes", label: "In-Person" },
    { id: "Blended (3 days in-person, 2 days distance)", label: "Blended (3F2F-2OC)" },
    { id: "Blended (4 days in-person, 1 day distance)", label: "Blended (4F2F-1OC)" },
    { id: "Full Distance Learning", label: "Full Distance" }
];

const ADM_CARDS = [
    { id: "adm_mdl", label: "Modular (MDL)", icon: <FiBook className="w-6 h-6" />, color: "border-blue-500 bg-blue-50 text-blue-700", inactive: "border-gray-200 bg-white shadow-sm" },
    { id: "adm_odl", label: "Online (ODL)", icon: <FiMonitor className="w-6 h-6" />, color: "border-violet-500 bg-violet-50 text-violet-700", inactive: "border-gray-200 bg-white shadow-sm" },
    { id: "adm_tvi", label: "TV/Radio (TVI)", icon: <FiRadio className="w-6 h-6" />, color: "border-emerald-500 bg-emerald-50 text-emerald-700", inactive: "border-gray-200 bg-white shadow-sm" },
    { id: "adm_blended", label: "Blended", icon: <FiLayers className="w-6 h-6" />, color: "border-orange-500 bg-orange-50 text-orange-700", inactive: "border-gray-200 bg-white shadow-sm" },
];

// ── Shared styles ─────────────────────────────────────────────────────────────
const pillBase = "flex-1 py-3 px-2 rounded-2xl font-black text-sm border-[3px] transition-all flex items-center justify-center text-center shadow-sm whitespace-pre-wrap select-none";
const pillActive = "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-main transform scale-105 z-10";
const pillInactive = "border-gray-200 bg-white text-gray-500 hover:border-indigo-300 hover:bg-gray-50 text-xs text-gray-400";

// ── Framer Motion variants ────────────────────────────────────────────────────
const slideVariants = {
    enter: { opacity: 0, x: 60, scale: 0.97 },
    center: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: -60, scale: 0.97 },
};
const expandVariants = {
    hidden: { opacity: 0, height: 0, marginTop: 0 },
    visible: { opacity: 1, height: "auto", marginTop: 16 },
};

// ══════════════════════════════════════════════════════════════════════════════
const Unit5ShiftingModality = ({ targetSchoolId, isReadOnly: propReadOnly }) => {
    const { user } = useAuth();
    const navigate = useNavigate();

    // ── Core state ──────────────────────────────────────────────────────────
    const [currentChapter, setCurrentChapter] = useState(1);
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [schoolId, setSchoolId] = useState("");
    const [iern, setIern] = useState("");
    const [showWelcomeBack, setShowWelcomeBack] = useState(false);
    const [isCertified, setIsCertified] = useState(false);
    const [isReviewMode, setIsReviewMode] = useState(false);
    const [curricularOffering, setCurricularOffering] = useState("");
    const [showDraftModal, setShowDraftModal] = useState(false);
    const [showOfflineSuccess, setShowOfflineSuccess] = useState(false);
    const [pendingOutboxId, setPendingOutboxId] = useState(null);

    // ── Dynamic grades based on curricular offering ──────────────────────

    // ── Chapter 1: Standard Setup ───────────────────────────────────────────
    const [hasStandardShifting, setHasStandardShifting] = useState(null);

    // ── Chapter 2: Grade Loop ───────────────────────────────────────────────
    const [gradeIdx, setGradeIdx] = useState(0);
    const [mapData, setMapData] = useState({}); // { shift_kinder: "...", mode_kinder: "..." }

    // ── Chapter 3: ADMs ─────────────────────────────────────────────────────
    const [hasAdms, setHasAdms] = useState(null);
    const [admData, setAdmData] = useState({ adm_mdl: false, adm_odl: false, adm_tvi: false, adm_blended: false });

    // ── Chapter 4: Review / Submit ──────────────────────────────────────────
    const [isVerified, setIsVerified] = useState(false);

    // ── Saved data (Review Mode) ────────────────────────────────────────────
    const [savedData, setSavedData] = useState(null);
    const effectiveReadOnly = propReadOnly || isReviewMode;

    // ── Navigation ──────────────────────────────────────────────────────────
    // Added specific local state properly decoupled from the memoized Curriculum list
    const [filteredGrades, setFilteredGrades] = useState([]);

    const {
        showHistoryModal,
        setShowHistoryModal,
        historicalData,
        historicalLoading,
        handleOpenHistoryModal,
        handleCopyHistoricalData,
    } = useHistoricalData("unit5", user, targetSchoolId);

    const copyUnit5 = (d) => {
        setHasStandardShifting(d.has_standard_shifting);
        const prefillMap = {};
        filteredGrades.forEach(g => {
            prefillMap[`shift_${g.key}`] = d[`shift_${g.key}`] || "";
            prefillMap[`mode_${g.key}`] = d[`mode_${g.key}`] || "";
        });
        setMapData(prefillMap);
        setHasAdms(!!d.has_adms);
        setAdmData({
            adm_mdl: !!d.adm_mdl, 
            adm_odl: !!d.adm_odl, 
            adm_tvi: !!d.adm_tvi, 
            adm_blended: !!d.adm_blended
        });
    };


    // ── Data fetch on mount ─────────────────────────────────────────────────
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
                const pendingUnit5 = outbox.find(e => e.unitId === 5 && (e.schoolId === storedId || e.payload?.schoolId === storedId || e.payload?.school_id === storedId));
                const draft = await getUnitDraft(5, storedId);

                // 2. RECONSTRUCT SCHOOL BASELINE
                let baseline = { iern: "", total_enrollment: 0, curricular_offering: "" };
                try {
                    const res = await fetch(api(`/ph_schools/${storedId}?t=${Date.now()}`));
                    if (res.ok) {
                        const saved = await res.json();
                        if (saved.exists && saved.data) baseline = { ...baseline, ...saved.data };
                    }
                } catch (e) {
                    console.log("📍 [Unit5] Offline: Using local sources for baseline.");
                }

                // Overlay Unit 1 Sync Center Data
                if (pendingUnit1) baseline.curricular_offering = pendingUnit1.payload?.curricular_offering || baseline.curricular_offering;
                
                // Overlay Unit 2 Sync Center Data
                if (pendingUnit2) {
                    baseline.unit2_simplified_enrollment = pendingUnit2.payload?.unit2_simplified_enrollment || baseline.unit2_simplified_enrollment;
                    baseline.total_enrollment = pendingUnit2.payload?.total_enrollment || baseline.total_enrollment;
                    
                    // Only overlay multigrade groupings if they exist in the payload
                    if (pendingUnit2.payload?.multigrade_groupings_1) baseline.multigrade_groupings_1 = pendingUnit2.payload.multigrade_groupings_1;
                    if (pendingUnit2.payload?.multigrade_groupings_2) baseline.multigrade_groupings_2 = pendingUnit2.payload.multigrade_groupings_2;
                    if (pendingUnit2.payload?.multigrade_groupings_3) baseline.multigrade_groupings_3 = pendingUnit2.payload.multigrade_groupings_3;
                }

                // Overlay Unit 3 Sync Center Data
                if (pendingUnit3) {
                    baseline.unit3_simplified_counts = pendingUnit3.payload?.unit3_simplified_counts;
                }

                if (baseline.iern) setIern(baseline.iern);
                setSavedData(baseline);

                const co = (baseline.curricular_offering || "").toLowerCase();
                setCurricularOffering(co);
                
                const expectedGrades = [];
                let hasKinder = false; let hasElem = false; let hasJHS = false; let hasSHS = false;
                if (co === "purely elementary" || co === "purely es" || co === "elementary") { 
                    hasKinder = true; hasElem = true; 
                } else if (co === "elementary school and junior high school (k-10)" || co === "es and jhs (k to 10)") { 
                    hasKinder = true; hasElem = true; hasJHS = true; 
                } else if (co === "junior high and senior high" || co === "jhs with shs") { 
                    hasJHS = true; hasSHS = true; 
                } else if (co === "all offering (k to 12)" || co === "all offering (k-12)") { 
                    hasKinder = true; hasElem = true; hasJHS = true; hasSHS = true; 
                } else if (co === "purely junior high school" || co === "purely jhs") { 
                    hasJHS = true; 
                } else if (co === "purely senior high school" || co === "purely shs") { 
                    hasSHS = true; 
                } else {
                    hasKinder = co.includes("elementary") || co.includes("es") || co.includes("k to 10") || co.includes("k to 12") || co.includes("k-10") || co.includes("k-12") || co.includes("kinder");
                    hasElem = co.includes("elementary") || co.includes("es") || co.includes("k to 10") || co.includes("k to 12") || co.includes("k-10") || co.includes("k-12");
                    hasJHS = co.includes("junior") || co.includes("jhs") || co.includes("k to 10") || co.includes("k to 12") || co.includes("k-10") || co.includes("k-12");
                    hasSHS = co.includes("senior") || co.includes("shs") || co.includes("k to 12") || co.includes("k-12");
                }

                // [FIX] Robust grade detection from Unit 2/3 payload
                let parsedSections = {};
                const gradeKeysList = ['kinder', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11', 'g12'];
                gradeKeysList.forEach(gk => {
                    let summaryStr = null;
                    if (gk === "kinder") {
                        summaryStr = baseline.grade_kinder_size;
                    } else {
                        summaryStr = baseline[`grade_${gk.replace('g', '')}_size`];
                    }
                    if (summaryStr) {
                        let total = 0;
                        const parts = summaryStr.split(',').map(p => p.trim());
                        parts.forEach(part => {
                            const match = part.match(/^(\d+)\s*\((.+)\)$/);
                            if (match) {
                                total += parseInt(match[1]) || 0;
                            }
                        });
                        parsedSections[gk] = total;
                    }
                });
                for (let nIdx = 1; nIdx <= 3; nIdx++) {
                    const summaryStr = baseline[`multigrade_size_${nIdx}`];
                    if (summaryStr) {
                        let total = 0;
                        const parts = summaryStr.split(',').map(p => p.trim());
                        parts.forEach(part => {
                            const match = part.match(/^(\d+)\s*\((.+)\)$/);
                            if (match) {
                                total += parseInt(match[1]) || 0;
                            }
                        });
                        parsedSections[`mg_${nIdx}`] = total;
                    }
                }

                let u2Parsed = [];
                if (baseline.unit2_simplified_enrollment) {
                    try {
                        const raw = typeof baseline.unit2_simplified_enrollment === 'string' ? JSON.parse(baseline.unit2_simplified_enrollment) : baseline.unit2_simplified_enrollment;
                        u2Parsed = Array.isArray(raw) ? raw : (raw.array || []);
                    } catch (e) { console.warn("U2 Parse Error", e); }
                }

                const getEnrollmentForGrade = (gradeId) => {
                    const colName = gradeId === 'kinder' ? 'enroll_kinder' : `enroll_${gradeId}`;
                    return parseInt(baseline[colName] || 0);
                };

                const getCountForGrade = (gradeId) => {
                    return parsedSections[gradeId] || 0;
                };

                const ALL_POSSIBLE_GRADES = [
                    { id: "kinder", label: "Kinder" },
                    ...['1','2','3','4','5','6','7','8','9','10','11','12'].map(lvl => ({ id: `g${lvl}`, label: `Grade ${lvl}` }))
                ];

                const hasUnit2Data = (parseInt(baseline.total_enrollment) || 0) > 0;

                ALL_POSSIBLE_GRADES.forEach(pg => {
                    let isOffered = false;
                    const nid = pg.id.replace('g', '');
                    if (pg.id === 'kinder') isOffered = hasKinder;
                    else if (['1','2','3','4','5','6'].includes(nid)) isOffered = hasElem;
                    else if (['7','8','9','10'].includes(nid)) isOffered = hasJHS;
                    else if (['11','12'].includes(nid)) isOffered = hasSHS;
                    
                    const enrollment = getEnrollmentForGrade(pg.id);
                    const sections = getCountForGrade(pg.id);

                    // Skip the grade if it was explicitly disabled in Unit 2 (enrollment is 0 in database table)
                    if (hasUnit2Data && enrollment === 0) {
                        return;
                    }

                    if (enrollment > 0 || sections > 0 || isOffered) {
                        expectedGrades.push({ id: pg.id, label: pg.label });
                    }
                });

                const multigradeGrades = [];
                for (let nIdx = 1; nIdx <= 3; nIdx++) {
                    const groupName = baseline[`multigrade_groupings_${nIdx}`];
                    if (groupName) {
                        const labelStr = groupName.toLowerCase();
                        let gradeNums = labelStr.match(/\d+/g) || [];
                        const gradeIds = gradeNums.map(n => `g${n}`);
                        if (labelStr.includes("kinder")) gradeIds.push("kinder");
                        multigradeGrades.push({ id: `mg_${nIdx}`, label: groupName, pairs: gradeIds });
                    }
                }

                const finalExpectedGrades = expectedGrades.filter(eg => !multigradeGrades.some(mg => mg.pairs.includes(eg.id)));
                finalExpectedGrades.push(...multigradeGrades);

                finalExpectedGrades.sort((a,b) => {
                    const getSortOrder = (id) => (id === "kinder" ? 0 : id.startsWith("g") ? parseInt(id.replace("g", "")) : 99);
                    return getSortOrder(a.id) - getSortOrder(b.id);
                });

                const finalGrades = finalExpectedGrades.map(g => ({ key: g.id, label: g.label }));
                if (finalGrades.length === 0) {
                    setFilteredGrades(ALL_POSSIBLE_GRADES.map(g => ({ key: g.id, label: g.label })));
                } else {
                    setFilteredGrades(finalGrades);
                }

                // 5. MASTER PRECEDENCE: SYNC CENTER > DRAFT > DATABASE
                if (pendingUnit5) {
                    const p = pendingUnit5.payload;
                    setHasStandardShifting(p.has_standard_shifting);
                    setMapData(p.mapData || {});
                    setAdmData(p.admData || { adm_mdl: false, adm_odl: false, adm_tvi: false, adm_blended: false });
                    setHasAdms(p.has_adms);
                    setPendingOutboxId(pendingUnit5.id);
                    setSavedData({ ...baseline, ...p });
                    setIsReviewMode(true);
                } else if (draft && !propReadOnly) {
                    setCurrentChapter(draft.currentChapter || 1);
                    setHasStandardShifting(draft.hasStandardShifting);
                    setGradeIdx(draft.gradeIdx || 0);
                    setMapData(draft.mapData || {});
                    setHasAdms(draft.hasAdms);
                    setAdmData(draft.admData || { adm_mdl: false, adm_odl: false, adm_tvi: false, adm_blended: false });
                    setIsReviewMode(false);
                    setShowWelcomeBack(true);
                    setTimeout(() => setShowWelcomeBack(false), 3000);
                } else if (baseline.unit5_completed || propReadOnly) {
                    setSavedData(baseline);
                    setHasStandardShifting(baseline.has_standard_shifting);
                    const prefillMap = {};
                    finalGrades.forEach(g => {
                        prefillMap[`shift_${g.key}`] = baseline[`shift_${g.key}`] || "";
                        prefillMap[`mode_${g.key}`] = baseline[`mode_${g.key}`] || "";
                    });
                    setMapData(prefillMap);
                    setHasAdms(!!baseline.has_adms);
                    setAdmData({
                        adm_mdl: !!baseline.adm_mdl, adm_odl: !!baseline.adm_odl, adm_tvi: !!baseline.adm_tvi, adm_blended: !!baseline.adm_blended
                    });
                    setIsReviewMode(true);
                }
            } catch (e) {
                console.warn("Could not fetch Unit 5 data", e);
            }
        };
        init();
    }, [propReadOnly, targetSchoolId]);

    // ── Validation ──────────────────────────────────────────────────────────
    const isStep1Valid = hasStandardShifting !== null;
    
    const isGradeInputValid = () => {
        if (!filteredGrades.length) return true;
        const currentFieldShift = mapData[`shift_${filteredGrades[gradeIdx]?.key}`];
        const currentFieldMode = mapData[`mode_${filteredGrades[gradeIdx]?.key}`];
        return !!currentFieldShift && !!currentFieldMode;
    };

    const isStep3Valid = hasAdms === false || (hasAdms === true && Object.values(admData).some(v => v));

    // ── Progress ────────────────────────────────────────────────────────────
    const progressPercentage = (() => {
        if (currentChapter === 1) return 15;
        if (currentChapter === 2) return 15 + ((gradeIdx + 1) / (filteredGrades.length || 1)) * 45; // up to 60
        if (currentChapter === 3) return 85;
        if (currentChapter === 4) return 100;
        return 0;
    })();

    // ── Navigation ──────────────────────────────────────────────────────────
    const handleNext = () => {
        if (currentChapter === 1) {
            if (hasStandardShifting) {
                // Auto-fill all grades
                const autoFill = {};
                filteredGrades.forEach(g => {
                    autoFill[`shift_${g.key}`] = "Single Shift";
                    autoFill[`mode_${g.key}`] = "In-Person Classes";
                });
                setMapData(autoFill);
                setCurrentChapter(3); // Skip chapter 2
            } else {
                setCurrentChapter(2);
                setGradeIdx(0);
            }
        } else if (currentChapter === 2) {
            if (gradeIdx < filteredGrades.length - 1) {
                setGradeIdx(prev => prev + 1);
            } else {
                setCurrentChapter(3);
            }
        } else if (currentChapter === 3) {
            setCurrentChapter(4);
        }
    };

    const handleBack = () => {
        if (currentChapter === 2) {
            if (gradeIdx > 0) {
                setGradeIdx(prev => prev - 1);
            } else {
                setCurrentChapter(1);
            }
        } else if (currentChapter === 3) {
            if (hasStandardShifting) {
                setCurrentChapter(1);
            } else {
                setCurrentChapter(2);
                setGradeIdx(filteredGrades.length - 1);
            }
        } else if (currentChapter === 4) {
            setCurrentChapter(3);
        } else {
            navigate("/modular-dashboard");
        }
    };

    const handleSaveDraftAndExit = async () => {
        if (!schoolId) return;
        const draftData = {
            currentChapter,
            hasStandardShifting,
            gradeIdx,
            mapData,
            hasAdms,
            admData
        };
        await saveUnitDraft(5, schoolId, draftData);
        navigate("/modular-dashboard");
    };

    // ── Submission ──────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!schoolId) return;
        try {
            setLoading(true);

            // Clean ADM data if user said NO
            const finalAdm = hasAdms ? admData : { adm_mdl: false, adm_odl: false, adm_tvi: false, adm_blended: false };

            const payload = {
                school_yr: "SY 26-27",
                iern,
                has_standard_shifting: hasStandardShifting,
                ...mapData,
                ...finalAdm,
                // Metadata for Reconstruction
                mapData,
                admData: finalAdm,
                has_adms: hasAdms
            };
            
            if (!navigator.onLine) {
                // OFFLINE SAVE
                await addModularToOutbox({
                    unitId: 5,
                    label: "Unit 5: Shifting & Modality",
                    url: api(`/ph_schools/unit5/${schoolId}`),
                    method: 'PUT',
                    payload: payload,
                    schoolId: schoolId
                });
                await clearUnitDraft(5, schoolId);

                // Update local quest progress
                const stored = localStorage.getItem("quest_progress");
                let progress = stored ? JSON.parse(stored) : { completedUnits: [], xp: 0 };
                if (!progress.completedUnits.includes(5)) {
                    progress.completedUnits.push(5);
                    progress.xp += 300;
                    localStorage.setItem("quest_progress", JSON.stringify(progress));
                }

                setShowOfflineSuccess(true);
                return;
            }

            const res = await fetch(api(`/api/ph_schools/unit5/${schoolId}`), {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `Server Error ${res.status}`);
            }

            // Update local quest progress
            const stored = localStorage.getItem("quest_progress");
            let progress = stored ? JSON.parse(stored) : { completedUnits: [], xp: 0 };
            if (!progress.completedUnits.includes(5)) {
                progress.completedUnits.push(5);
                progress.xp += 300;
                localStorage.setItem("quest_progress", JSON.stringify(progress));
            }

            // Sync progress to dashboard
            try {
                await fetch(api(`/api/user/progress`), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ unitId: 5, schoolId })
                });
            } catch (e) { console.warn("Progress sync failed", e); }

            // Ensure app syncs to start the dashboard animation correctly
            window.dispatchEvent(new Event("storage"));
            await clearUnitDraft(5, schoolId);
            setShowSuccess(true);
        } catch (err) {
            console.error("UNIT 5 SUBMIT ERROR:", err);
            if (!navigator.onLine || err.message.includes('fetch') || err.message.includes('Network error')) {
                await addModularToOutbox({
                    unitId: 5,
                    label: "Unit 5: Shifting & Modality",
                    url: api(`/ph_schools/unit5/${schoolId}`),
                    method: 'PUT',
                    payload: { school_yr: "SY 26-27", iern, has_standard_shifting: hasStandardShifting, ...mapData, ...finalAdm, mapData, admData: finalAdm, has_adms: hasAdms },
                    schoolId: schoolId
                });
                await clearUnitDraft(5, schoolId);
                setShowOfflineSuccess(true);
            } else {
                alert("Failed to save data. " + err.message);
            }
        } finally {
            setLoading(false);
        }
    };


    if (isReviewMode) {
        return (
            <div className="min-h-screen unit1-page font-sans">
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
                    .bg-slate-900.rounded-\\[2\\.5rem\\],
                    .bg-white.rounded-3xl,
                    .bg-white.border-2.border-gray-100.rounded-3xl {
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
                        <button onClick={() => navigate("/modular-dashboard")} className="p-2 -ml-2 text-gray-400 hover:text-gray-900 transition-colors">
                            <FiArrowLeft className="w-6 h-6" />
                        </button>
                        <div className="flex flex-col ml-2">
                            <span className="text-[10px] font-black tracking-widest text-indigo-400 uppercase leading-none">
                                Reviewing
                            </span>
                            <span className="text-sm font-black text-slate-800 leading-tight">
                                Shifting & Modality
                            </span>
                        </div>
                    </div>
                </header>

                <div className="max-w-7xl mx-auto pb-32 mt-4 px-4 md:px-8 space-y-8 w-full">
                    <UnitRemarkAlert unitId="u5" schoolId={targetSchoolId || user?.school_id || localStorage.getItem('schoolId')} />
                    {/* Header */}
                    <div className="text-center mb-10">
                        <motion.div 
                            initial={{ scale: 0 }} 
                            animate={{ scale: 1 }} 
                            className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-[2rem] mx-auto mb-6 flex items-center justify-center shadow-xl shadow-indigo-100"
                        >
                            <FiClock className="w-10 h-10 text-white" />
                        </motion.div>
                        <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-[0.2em] mb-3 shadow-sm border border-indigo-100">
                            Unit 5 • Operations Profile
                        </span>
                        <h1 className="text-3xl font-black text-slate-800 leading-tight tracking-tight">Schedule & Modality</h1>
                        <p className="text-slate-500 font-medium mt-2 italic">"Instructional delivery and shifting model report"</p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left Column: Primary Config & ADM */}
                        <div className="lg:col-span-1 space-y-6">
                            {/* Primary Configuration Card */}
                            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-indigo-100 relative overflow-hidden group border border-white/10">
                                <div className="absolute top-0 right-0 p-8 text-8xl opacity-10 rotate-12 group-hover:rotate-0 transition-transform duration-700 pointer-events-none">🗓️</div>
                                <div className="relative z-10">
                                    <p className="text-indigo-300 text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-center">Core Operational Model</p>
                                    <div className="flex items-center justify-around py-4 border-y border-white/10 mt-4">
                                        <div className="text-center">
                                            <p className="text-2xl font-black leading-none">{hasStandardShifting ? "Standard" : "Custom"}</p>
                                            <p className="text-[9px] font-bold text-indigo-400 uppercase mt-2 tracking-widest">Base Setup</p>
                                        </div>
                                        <div className="w-px h-12 bg-white/10" />
                                        <div className="text-center">
                                            <p className="text-2xl font-black leading-none">{hasAdms ? "Active" : "None"}</p>
                                            <p className="text-[9px] font-bold text-indigo-400 uppercase mt-2 tracking-widest">Emergency ADMs</p>
                                        </div>
                                    </div>
                                    
                                    {hasStandardShifting && (
                                        <div className="mt-6 flex items-center justify-center gap-3 bg-white/5 py-3 rounded-2xl border border-white/10">
                                            <FiCheckCircle className="text-emerald-400" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-100">100% Homogeneous Single-Shift</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ADM Section */}
                            <section className="space-y-4">
                                <div className="flex items-center gap-2 px-2">
                                    <div className="w-1.5 h-6 bg-rose-500 rounded-full" />
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Emergency ADM Status</h3>
                                </div>

                                {!hasAdms ? (
                                    <div className="bg-white rounded-[2rem] p-6 border border-slate-50 shadow-sm flex items-center gap-4">
                                        <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-500 text-2xl">🛡️</div>
                                        <div>
                                            <h4 className="font-black text-slate-800 text-sm">No Active ADMs</h4>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">Emergency Modes Disabled</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-[2rem] p-6 border border-rose-100 shadow-sm space-y-4">
                                        <div className="flex items-center gap-4 mb-2">
                                            <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center text-rose-500 text-2xl animate-pulse">🚨</div>
                                            <div>
                                                <h4 className="font-black text-slate-800 text-sm">Active Intervention</h4>
                                                <p className="text-[9px] font-bold text-rose-400 uppercase">Alternative Modes in Use</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {Object.entries(admData).map(([k, v]) => {
                                                if (!v) return null;
                                                const match = ADM_CARDS.find(c => c.id === k);
                                                return (
                                                    <div key={k} className="bg-rose-50 text-rose-700 font-bold text-[10px] px-4 py-2 rounded-xl flex items-center gap-2 border border-rose-100">
                                                        {match?.icon && <span className="scale-75">{match.icon}</span>}
                                                        {match?.label}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </section>
                        </div>

                        {/* Right Column: Grade Modality Mapping */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Schedule Mapping Details */}
                            <section className="space-y-4">
                                <div className="flex items-center gap-2 px-2">
                                    <div className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Grade-Level Mapping</h3>
                                </div>

                                {hasStandardShifting ? (
                                    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 text-center shadow-sm">
                                        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">🏛️</div>
                                        <h4 className="text-xl font-black text-slate-800 mb-1">Standard Uniformity</h4>
                                        <p className="text-xs font-medium text-slate-500 leading-relaxed px-4">
                                            All grade levels follow the <span className="text-indigo-600 font-bold">Single Shift</span> model with <span className="text-emerald-600 font-bold">In-Person Classes</span> as the primary delivery mode.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid gap-4">
                                        {filteredGrades.map(g => (
                                            <div key={g.key} className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-sm flex flex-col group hover:border-indigo-200 transition-colors">
                                                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-50">
                                                    <span className="font-black text-slate-800 text-lg">{g.label}</span>
                                                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-[10px] font-black text-slate-400">{g.key.toUpperCase().slice(0,3)}</div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex flex-col items-center gap-1">
                                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Shifting</span>
                                                        <span className="font-black text-slate-700 text-[10px] uppercase text-center">{mapData[`shift_${g.key}`] || "Not Defined"}</span>
                                                    </div>
                                                    <div className="bg-indigo-50 p-3 rounded-2xl border border-indigo-100 flex flex-col items-center gap-1">
                                                        <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Modality</span>
                                                        <span className="font-black text-indigo-600 text-[10px] uppercase text-center">{mapData[`mode_${g.key}`] || "Not Defined"}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </div>
                    </div>
                </div>
                {/* Fixed bottom Unlock button for Review Mode */}
                {!propReadOnly && (
                    <div className="fixed bottom-0 left-0 w-full p-6 pb-10 bg-white/80 backdrop-blur-md border-t border-slate-100 flex justify-center z-[60]">
                        <div className="w-full max-w-sm flex gap-3 pointer-events-auto">
                            <button
                                onClick={() => { setIsReviewMode(false); setCurrentChapter(1); setIsVerified(false); }}
                                className="flex-1 py-5 rounded-[2rem] bg-indigo-600 text-white font-black text-xl shadow-xl shadow-indigo-100/50 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-3"
                            >
                                <FiUnlock className="w-6 h-6" />
                                <span>Unlock to Edit Modality</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ══════════════════════════════════════════════
    // WIZARD MODE
    // ══════════════════════════════════════════════
    return (
        <div className="min-h-screen unit1-page flex flex-col font-sans relative overflow-x-hidden">
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
                .bg-slate-900.rounded-\\[2\\.5rem\\],
                .bg-white.rounded-3xl,
                .bg-white.border-2.border-gray-100.rounded-3xl {
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
            {!propReadOnly && (
                <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm shadow-[0_2px_12px_rgba(0,0,0,0.04)] px-4 py-3">
                    <div className="max-w-md mx-auto flex items-center justify-between gap-3">
                        <button onClick={handleBack} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                            <FiArrowLeft className="w-6 h-6 text-gray-400 hover:text-gray-600" />
                        </button>
                        <div className="mx-4 h-4 bg-gray-200 rounded-full overflow-hidden flex-1">
                            <motion.div className="h-full bg-indigo-500 rounded-full" animate={{ width: `${progressPercentage}%` }} transition={{ duration: 0.4 }} />
                        </div>
                        <button
                            onClick={handleOpenHistoryModal}
                            title="View / Copy previous SY data"
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-indigo-50 text-indigo-500 hover:bg-indigo-100 hover:text-indigo-700 transition-all active:scale-90 border border-indigo-100 shrink-0"
                        >
                            <FiCopy className="w-4 h-4" />
                        </button>
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

            <main className="flex-1 overflow-visible pb-32">
                <div className="max-w-md w-full mx-auto mt-6 px-4">
                    <UnitRemarkAlert unitId="u5" schoolId={targetSchoolId || user?.school_id || localStorage.getItem('schoolId')} />
                    <AnimatePresence mode="wait">

                        {/* ────────────────────────────────────────────────────────
                            CHAPTER 1: The Standard Setup Gatekeeper
                            ──────────────────────────────────────────────────────── */}
                        {currentChapter === 1 && (
                            <motion.div key="ch1-u5" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                                <div className="text-center mb-6 mt-4">
                                    <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                                        <FiClock className="w-8 h-8 text-indigo-600" />
                                    </div>
                                    <h2 className="text-2xl font-black text-gray-800">Let's check your daily schedule!</h2>
                                </div>

                                <div className="bg-white border-2 border-gray-100 rounded-3xl p-5 shadow-sm text-center">
                                    <p className="text-base font-bold text-gray-600 mb-6 px-2">Does your entire school follow a standard <span className="text-indigo-600">Single Shift</span> schedule with <span className="text-emerald-600">100% In-Person</span> classes?</p>

                                    <div className="space-y-4">
                                        <button onClick={() => setHasStandardShifting(true)} 
                                            className={`w-full py-5 px-6 rounded-2xl font-black text-lg border-2 transition-all flex flex-col items-center gap-2 ${hasStandardShifting === true ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-md" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                                            <span className="text-3xl">✅</span>
                                            Yes, standard setup
                                        </button>
                                        
                                        <button onClick={() => setHasStandardShifting(false)} 
                                            className={`w-full py-5 px-6 rounded-2xl font-black text-lg border-2 transition-all flex flex-col items-center gap-2 ${hasStandardShifting === false ? "bg-orange-50 border-orange-500 text-orange-700 shadow-md" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                                            <span className="text-3xl">⚙️</span>
                                            No, we have mixed schedules
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}


                        {/* ────────────────────────────────────────────────────────
                            CHAPTER 2: Grade-by-Grade Mapper
                            ──────────────────────────────────────────────────────── */}
                        {currentChapter === 2 && (() => {
                            if (!filteredGrades.length || gradeIdx >= filteredGrades.length) return null;
                            const { key, label } = filteredGrades[gradeIdx];
                            const currentShift = mapData[`shift_${key}`];
                            const currentMode = mapData[`mode_${key}`];

                            return (
                                <motion.div key={`ch2-${key}`} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                                    
                                    {/* Pagination Mini-Nav */}
                                    <div className="flex justify-center gap-1.5 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                                        {filteredGrades.map((_, i) => (
                                            <div key={i} className={`h-1.5 rounded-full flex-shrink-0 transition-all ${i === gradeIdx ? `w-6 bg-indigo-500` : i < gradeIdx ? `w-3 bg-indigo-300` : `w-2 bg-gray-200`}`} />
                                        ))}
                                    </div>

                                    <div className="flex items-center gap-3 mb-4 px-2">
                                        <div className="w-12 h-12 bg-white border-2 border-gray-200 rounded-2xl flex items-center justify-center text-xl font-black text-gray-700 shadow-sm">{label.split(" ")[1] || "K"}</div>
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">Mapping Schedule</p>
                                            <h2 className="text-2xl font-black text-gray-800 leading-tight">{label}</h2>
                                        </div>
                                    </div>

                                    <div className="bg-white border-2 border-gray-100 rounded-3xl p-5 shadow-sm mt-5 space-y-6">
                                        {/* Shifting */}
                                        <div>
                                            <p className="text-sm font-bold text-gray-600 mb-3 uppercase tracking-wider">Shifting Model</p>
                                            <div className="flex gap-2">
                                                {SHIFT_OPTIONS.map(opt => {
                                                    const isActive = currentShift === opt.id;
                                                    return (
                                                        <button key={opt.id} onClick={() => setMapData(p => ({ ...p, [`shift_${key}`]: opt.id }))}
                                                            className={`${pillBase} ${isActive ? pillActive : pillInactive}`}>
                                                            {opt.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div className="border-t border-dashed border-gray-200"></div>

                                        {/* Modality */}
                                        <div>
                                            <p className="text-sm font-bold text-gray-600 mb-3 uppercase tracking-wider">Delivery Modality</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {MODE_OPTIONS.map(opt => {
                                                    const isActive = currentMode === opt.id;
                                                    return (
                                                        <button key={opt.id} onClick={() => setMapData(p => ({ ...p, [`mode_${key}`]: opt.id }))}
                                                            className={`${pillBase} ${isActive ? pillActive.replace("indigo", "emerald") : pillInactive} px-1`}>
                                                            {opt.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })()}


                        {/* ────────────────────────────────────────────────────────
                            CHAPTER 3: Emergency ADMs
                            ──────────────────────────────────────────────────────── */}
                        {currentChapter === 3 && (
                            <motion.div key="ch3-u5" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                                <div className="text-center mt-4 mb-6">
                                    <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                                        <FiAlertTriangle className="w-8 h-8 text-red-600" />
                                    </div>
                                    <h2 className="text-2xl font-black text-gray-800 mb-2">Emergency ADMs</h2>
                                    <p className="text-sm text-gray-500 mb-6 px-4">Are you currently utilizing any Emergency Alternative Delivery Modes due to congestion or natural disasters?</p>
                                </div>

                                <div className="flex gap-4 px-2 mb-6">
                                    <button onClick={() => setHasAdms(true)}
                                        className={`flex-1 py-4 rounded-2xl font-black text-lg border-2 transition-all flex items-center justify-center gap-2 ${hasAdms === true ? "bg-red-50 border-red-500 text-red-700 shadow-md" : "bg-white border-gray-200 text-gray-400"}`}>
                                        Yes
                                    </button>
                                    <button onClick={() => { setHasAdms(false); setAdmData({ adm_mdl: false, adm_odl: false, adm_tvi: false, adm_blended: false }); }}
                                        className={`flex-1 py-4 rounded-2xl font-black text-lg border-2 transition-all flex items-center justify-center gap-2 ${hasAdms === false ? "bg-gray-100 border-gray-400 text-gray-600 shadow-md" : "bg-white border-gray-200 text-gray-400"}`}>
                                        No
                                    </button>
                                </div>

                                <AnimatePresence>
                                    {hasAdms && (
                                        <motion.div variants={expandVariants} initial="hidden" animate="visible" exit="hidden" className="overflow-hidden px-2 space-y-3">
                                            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 ml-1 mb-2">Tap all that apply:</p>
                                            {ADM_CARDS.map(card => {
                                                const isActive = admData[card.id];
                                                return (
                                                    <motion.div key={card.id} whileTap={{ scale: 0.98 }}
                                                        onClick={() => setAdmData(p => ({ ...p, [card.id]: !p[card.id] }))}
                                                        className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-4 cursor-pointer ${isActive ? card.color : card.inactive}`}
                                                    >
                                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isActive ? "bg-white/60" : "bg-gray-50 text-gray-400"}`}>
                                                            {card.icon}
                                                        </div>
                                                        <span className={`font-black flex-1 text-lg ${isActive ? "" : "text-gray-700"}`}>{card.label}</span>
                                                        <div className={`w-6 h-6 border-2 rounded-full flex items-center justify-center ${isActive ? "border-current bg-white" : "border-gray-300"}`}>
                                                            {isActive && <div className="w-3 h-3 rounded-full bg-current" />}
                                                        </div>
                                                    </motion.div>
                                                )
                                            })}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )}


                        {/* ────────────────────────────────────────────────────────
                            CHAPTER 4: Final Submission
                            ──────────────────────────────────────────────────────── */}
                        {currentChapter === 4 && (
                            <motion.div key="ch4-u5" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                                <div className="text-center mt-6">
                                    <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
                                        <FiCheckCircle className="w-8 h-8 text-white" />
                                    </div>
                                    <h2 className="text-2xl font-black text-gray-800 mb-1">Final Review</h2>
                                    <p className="text-sm text-gray-500 mb-6 px-4">Ready to lock in your shifting and modality setups?</p>
                                </div>

                                <div className="bg-white border flex flex-col gap-4 border-gray-100 rounded-3xl p-5 shadow-sm mb-6">
                                    <div className="flex items-center justify-between border-b-2 border-dashed border-gray-100 pb-3">
                                        <div className="flex items-center gap-3 text-gray-600">
                                            <span className="text-xl">🏫</span>
                                            <span className="font-bold text-sm">Base Setup</span>
                                        </div>
                                        <span className="font-black text-sm text-indigo-600">
                                            {hasStandardShifting ? "100% Standard" : "Mixed/Custom"}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 text-gray-600">
                                            <span className="text-xl">🚨</span>
                                            <span className="font-bold text-sm">Emergency ADMs</span>
                                        </div>
                                        <span className={`font-black text-sm ${hasAdms ? "text-amber-600" : "text-emerald-600"}`}>
                                            {hasAdms ? "Active" : "None"}
                                        </span>
                                    </div>
                                </div>

                                <div 
                                    onClick={() => setIsCertified(!isCertified)}
                                    className={`w-full p-8 rounded-[2.5rem] mt-8 mb-4 border-4 transition-all duration-300 flex items-start gap-6 cursor-pointer ${isCertified ? 'bg-emerald-50 border-emerald-500 shadow-xl shadow-emerald-100' : 'bg-white border-slate-100 opacity-60'}`}
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


                    </AnimatePresence>
                </div>
            </main>

            {/* ── Sticky Footer ── */}
            {!propReadOnly && (
                <div className="fixed bottom-0 left-0 w-full p-6 bg-white/90 backdrop-blur-md border-t border-gray-100 flex justify-center z-40 shadow-[0_-8px_30px_rgb(0,0,0,0.04)]">
                    <div className="w-full max-w-md flex gap-3">
                        {currentChapter === 1 ? (
                            <button onClick={() => setShowDraftModal(true)} className="flex-none h-16 px-6 rounded-3xl bg-blue-50 border-2 border-blue-100 flex items-center justify-center gap-2 text-blue-500 hover:text-blue-700 active:scale-95 transition-all outline-none">
                                <FiSave className="w-6 h-6" />
                                <span className="text-sm font-bold text-blue-500">Save Draft</span>
                            </button>
                        ) : (
                            <>
                                <button onClick={handleBack}
                                    className="w-16 h-16 rounded-3xl bg-slate-50 border-2 border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 active:scale-95 transition-all outline-none shrink-0">
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
                        {currentChapter < 4 ? (
                            <button
                                onClick={handleNext}
                                disabled={
                                    (currentChapter === 1 && !isStep1Valid) ||
                                    (currentChapter === 2 && !isGradeInputValid()) ||
                                    (currentChapter === 3 && !isStep3Valid)
                                }
                                className="flex-1 h-16 rounded-3xl text-white font-black text-lg bg-indigo-600 border-b-[6px] border-indigo-800 active:border-b-0 active:translate-y-[6px] transition-all disabled:opacity-40 shadow-lg shadow-indigo-100 flex justify-center items-center gap-2"
                            >
                                <span>Next Step &gt;</span>
                            </button>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={!isCertified || loading}
                                className="flex-1 h-16 rounded-3xl text-white font-black text-lg bg-emerald-600 border-b-[6px] border-emerald-800 active:border-b-0 active:translate-y-[6px] transition-all disabled:opacity-40 shadow-lg shadow-emerald-100 flex justify-center items-center gap-2"
                            >
                                {loading ? "Saving..." : (
                                    <span className="flex items-center justify-center gap-2">
                                        SUBMIT ENTRY <FiCheckCircle className="w-5 h-5" />
                                    </span>
                                )}
                            </button>
                        )}
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
            <SuccessModal 
                isOpen={showSuccess} 
                onClose={() => setShowSuccess(false)} 
                message="You've successfully mapped out your Shifting and Modalities. Units synced!" 
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
                            <h2 className="text-2xl font-black text-gray-900 text-center leading-tight px-4">Local Secure: Unit 5 Saved!</h2>
                            <p className="text-gray-500 text-center font-medium mt-3 px-6">Your shifting models and delivery modalities have been saved locally. We will automatically sync your operational data once you're back online.</p>
                            
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
            <HistoricalDataModal
                show={showHistoryModal}
                onClose={() => setShowHistoryModal(false)}
                loading={historicalLoading}
                data={historicalData}
                unitKey="unit5"
                onCopy={() => handleCopyHistoricalData(copyUnit5)}
            />
        </div>
    );
};


export default Unit5ShiftingModality;
