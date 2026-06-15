import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowRight, FiCheckCircle, FiChevronLeft, FiAlertTriangle, FiUnlock, FiSave, FiArrowLeft, FiCheck, FiWifiOff, FiEdit2 } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import SuccessModal from '../SuccessModal';
import { saveUnitDraft, getUnitDraft, clearUnitDraft, addModularToOutbox, getModularOutbox } from '../../db';
import { useAuth } from "../../context/AuthContext";
import UnitRemarkAlert from "./UnitRemarkAlert";
import { api } from "../../lib/api";

// --- Shared Styles ---
const chunkyInput = "w-full p-4 mt-2 bg-white border-2 border-[#BAE6FD] rounded-3xl text-2xl font-black text-gray-800 focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-[#E0F2FE] transition-all shadow-sm text-center font-body";
const toggleBtnBase = "flex-1 py-4 px-6 rounded-2xl font-black text-lg border-2 transition-all flex items-center justify-center gap-2 shadow-sm";
const toggleBtnActive = "bg-indigo-100 border-indigo-500 text-indigo-700 shadow-indigo-100";
const toggleBtnInactive = "bg-white border-gray-200 text-gray-400 hover:bg-gray-50";

// --- Data Constants ---
const ALL_GRADES = [
    { id: 'kinder', label: 'Kindergarten', type: 'elem' },
    { id: 'g1', label: 'Grade 1', type: 'elem' },
    { id: 'g2', label: 'Grade 2', type: 'elem' },
    { id: 'g3', label: 'Grade 3', type: 'elem' },
    { id: 'g4', label: 'Grade 4', type: 'elem' },
    { id: 'g5', label: 'Grade 5', type: 'elem' },
    { id: 'g6', label: 'Grade 6', type: 'elem' },
    { id: 'g7', label: 'Grade 7', type: 'jhs' },
    { id: 'g8', label: 'Grade 8', type: 'jhs' },
    { id: 'g9', label: 'Grade 9', type: 'jhs' },
    { id: 'g10', label: 'Grade 10', type: 'jhs' },
    { id: 'g11', label: 'Grade 11', type: 'shs' },
    { id: 'g12', label: 'Grade 12', type: 'shs' }
];

const ELEM_GRADES = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'];

const Unit2Learners = ({ targetSchoolId, isReadOnly: propReadOnly }) => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [iern, setIern] = useState("");
    const [showSuccess, setShowSuccess] = useState(false);
    const [isReadOnly, setIsReadOnly] = useState(propReadOnly || false);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [pendingOutboxId, setPendingOutboxId] = useState(null); 
    const [showOfflineSuccess, setShowOfflineSuccess] = useState(false);

    const { user, authLoading } = useAuth();
    const [isReviewMode, setIsReviewMode] = useState(false); 
    const [showWelcomeBack, setShowWelcomeBack] = useState(false);
    const [showDraftModal, setShowDraftModal] = useState(false);
    const [isCertified, setIsCertified] = useState(false);

    // Final read-only determination: prop takes precedence
    const effectiveReadOnly = propReadOnly || isReadOnly;

    // --- Wizard State ---
    const [currentStep, setCurrentStep] = useState(1);
    const [currentGradeIndex, setCurrentGradeIndex] = useState(0); 
    const [availableGrades, setAvailableGrades] = useState([]);
    const [schoolOffering, setSchoolOffering] = useState("");
    const [hasKinder, setHasKinder] = useState(false);
    const [hasElementary, setHasElementary] = useState(false);

    // Step 1: Kinder
    const [kinderEnrollment, setKinderEnrollment] = useState("");

    // Step 2 & 3: Organization (G1-G6 Only)
    const [orgType, setOrgType] = useState(null); // 'nano', 'pure_mg', 'mixed'
    const [mgCombinations, setMgCombinations] = useState([]); // [{ id, grades: [], enrollment }]

    // Step 4: Grade Totals & Availability (Monograde/Standalone)
    const [gradeTotals, setGradeTotals] = useState({});
    const [gradeAvailability, setGradeAvailability] = useState({});
    
    // Step 5: Special Learners (SNED / Non-Graded)
    const [hasSNED, setHasSNED] = useState(null);
    const [snedMainstreamedCount, setSnedMainstreamedCount] = useState("");
    const [snedSelfContainedCount, setSnedSelfContainedCount] = useState("");
    const [snedProgramType, setSnedProgramType] = useState(null); // Keep for legacy/compat
    const [snedOrganizedClassCount, setSnedOrganizedClassCount] = useState("");
    const [snedLanguage, setSnedLanguage] = useState("en"); // "en" | "ph"

    // Step 3: ARAL Program (Conditional)
    const [hasAralMath, setHasAralMath] = useState(null);
    const [hasAralReading, setHasAralReading] = useState(null);
    const [hasAralScience, setHasAralScience] = useState(null);
    
    const [aralMath, setAralMath] = useState({});
    const [aralReading, setAralReading] = useState({});
    const [aralScience, setAralScience] = useState({});

    // Step 4: Gender Breakdown (Per-grade logic)
    const [gradeGenderMap, setGradeGenderMap] = useState({}); // { [gradeId]: { male: "0", female: "0" } }
    const [mgSubStep, setMgSubStep] = useState('manager'); // 'manager' | 'selection' | 'population'
    const [activeCombinationId, setActiveCombinationId] = useState(null);

    // --- Derived State ---
    const lockedGrades = useMemo(() => {
        const locked = new Set();
        mgCombinations.forEach(c => c.grades.forEach(g => locked.add(g)));
        return locked;
    }, [mgCombinations]);

    const activeMonogrades = useMemo(() => {
        if (!schoolOffering) return [];
        // Filters based on available grades. Kinder is Step 1.
        return availableGrades.filter(g => g.id !== 'kinder' && !lockedGrades.has(g.id));
    }, [availableGrades, schoolOffering, lockedGrades]);

    // Derived directly from the offering string — guards kinder display and grand total
    // independently of hasKinder state to handle stale localStorage scenarios.
    const offeringHasKinder = useMemo(() => {
        const t = schoolOffering.toLowerCase();
        return t.includes("elementary") || t.includes("primary") ||
               t.includes("all offering") || t.includes("k to 12") ||
               t.includes("k-12") || t.includes("k to 10") || t.includes("k-10");
    }, [schoolOffering]);

    const grandTotal = useMemo(() => {
        let sum = (hasKinder && offeringHasKinder) ? (parseInt(kinderEnrollment) || 0) : 0;
        // Monograde totals
        activeMonogrades.forEach(g => sum += (parseInt(gradeTotals[g.id]) || 0));
        // Multigrade combinations - count individual grades since we moved to per-grade gender inputs
        mgCombinations.forEach(c => {
            c.grades.forEach(lvl => {
                const m = parseInt(gradeGenderMap[lvl]?.male) || 0;
                const f = parseInt(gradeGenderMap[lvl]?.female) || 0;
                sum += (m + f);
            });
        });
        // SNED
        if (hasSNED) {
            sum += (parseInt(snedSelfContainedCount) || 0);
        }

        return sum;
    }, [kinderEnrollment, gradeTotals, activeMonogrades, mgCombinations, hasSNED, snedProgramType, gradeGenderMap]);

    const genderSum = useMemo(() => {
        // We sum up the final mapping that will actually be saved
        let s = 0;
        
        // Kinder
        if (hasKinder && gradeAvailability.kinder !== false) {
            s += (parseInt(gradeGenderMap['kinder']?.male) || 0) + (parseInt(gradeGenderMap['kinder']?.female) || 0);
        }
        
        // Monogrades
        activeMonogrades.forEach(g => {
            if (gradeAvailability[g.id] !== false) {
                s += (parseInt(gradeGenderMap[g.id]?.male) || 0) + (parseInt(gradeGenderMap[g.id]?.female) || 0);
            }
        });
        
        // Multigrades
        mgCombinations.forEach(c => {
            c.grades.forEach(lvl => {
                s += (parseInt(gradeGenderMap[lvl]?.male) || 0) + (parseInt(gradeGenderMap[lvl]?.female) || 0);
            });
        });
        
        // SNED
        if (hasSNED) {
            s += (parseInt(gradeGenderMap['sned_self_contained']?.male) || 0) + (parseInt(gradeGenderMap['sned_self_contained']?.female) || 0);
        }
        
        return s;
    }, [gradeGenderMap, gradeAvailability, activeMonogrades, mgCombinations, hasSNED, snedProgramType]);

    const gradeCapacities = useMemo(() => {
        const caps = {};
        // Default all to 0
        ELEM_GRADES.forEach(id => caps[id] = 0);

        // 1. Monograde Capacities
        activeMonogrades.forEach(g => {
            caps[g.id] = (parseInt(gradeTotals[g.id]) || 0);
        });
        // 2. Add Multigrade combinations back into capacity for each grade (for ARAL validation)
        mgCombinations.forEach(c => {
            c.grades.forEach(lvl => {
                if (!caps[lvl]) caps[lvl] = 0;
                caps[lvl] += (parseInt(gradeTotals[lvl]) || 0);
            });
        });
        return caps;
    }, [gradeTotals, activeMonogrades, mgCombinations]);

    const isMathPerfect = genderSum === grandTotal && grandTotal > 0;

    // --- Summary Debug Logger (toggle DEBUG_SUMMARY to enable) ---
    const DEBUG_SUMMARY = false;
    useEffect(() => {
        if (!DEBUG_SUMMARY || currentStep !== 7) return;
        console.group('[Unit2 Summary Debug]');
        // Grade-level audit: gradeTotals vs gradeGenderMap sum
        const allGrades = [
            ...(hasKinder && gradeAvailability.kinder !== false ? ['kinder'] : []),
            ...activeMonogrades.map(g => g.id),
            ...mgCombinations.flatMap(c => c.grades),
        ];
        const rows = allGrades.map(id => {
            const m = parseInt(gradeGenderMap[id]?.male) || 0;
            const f = parseInt(gradeGenderMap[id]?.female) || 0;
            const genderTotal = m + f;
            const storedTotal = parseInt(gradeTotals[id]) || 0;
            return { id, male: m, female: f, genderTotal, storedTotal, match: genderTotal === storedTotal };
        });
        console.table(rows);
        // Row total vs grandTotal check
        const rowSum = rows.reduce((s, r) => s + r.genderTotal, 0)
            + (hasSNED ? (parseInt(gradeGenderMap['sned_self_contained']?.male) || 0) + (parseInt(gradeGenderMap['sned_self_contained']?.female) || 0) : 0);
        if (rowSum !== grandTotal) {
            console.warn(`[MISMATCH] Row totals sum (${rowSum}) !== grandTotal (${grandTotal})`);
        } else {
            console.log(`[OK] Row totals sum (${rowSum}) === grandTotal (${grandTotal})`);
        }
        console.groupEnd();
    }, [currentStep, gradeGenderMap, gradeTotals, activeMonogrades, mgCombinations, gradeAvailability, grandTotal, hasSNED]);

    // --- Init / Fetch Data ---
    useEffect(() => {
        const initData = async () => {
            if (authLoading) return;
            const storedId = targetSchoolId || user?.school_id || localStorage.getItem('schoolId');
            if (!storedId) {
                setLoading(false);
                return;
            }

            try {
                // 1. Gather all local sources
                const outbox = await getModularOutbox().catch(() => []);
                const pendingUnit1 = outbox.find(e => e.unitId === 1 && (e.schoolId === storedId || e.payload?.schoolId === storedId || e.payload?.school_id === storedId));
                const pendingUnit2 = outbox.find(e => e.unitId === 2 && (e.schoolId === storedId || e.payload?.schoolId === storedId || e.payload?.school_id === storedId));
                const [draft2, draft1] = await Promise.all([
                    getUnitDraft(2, storedId),
                    getUnitDraft(1, storedId)
                ]);

                // 2. Resolve Offering (Sync Center > Unit 1 Draft > LS)
                let resolvedOffering = pendingUnit1?.payload?.curricular_offering 
                    || draft1?.formData?.curricular_offering 
                    || localStorage.getItem('schoolOffering') 
                    || "";
                
                // 3. Attempt Server Sync for existing data
                try {
                    const res = await fetch(api(`/ph_schools/${storedId}`));
                    if (res.ok) {
                        const sData = await res.json();
                        if (sData.exists && sData.data) {
                            const d = sData.data;
                            if (d.iern) setIern(d.iern);
                            // Fallback offering from DB if nothing local
                            if (!resolvedOffering) resolvedOffering = d.curricular_offering || "";
                            
                            // If Unit 2 is already submitted to the unit2_school_learners table AND we have no local changes, set to read-only
                            if (d.unit2_has_data && (d.unit2_completed || d.unit2) && !draft2 && !pendingUnit2) {
                                setHasSubmitted(true);
                                setIsReadOnly(true);
                                
                                try {
                                    setKinderEnrollment((d.enroll_kinder || 0).toString());
                                    
                                    const gTotals = {};
                                    for (let g = 1; g <= 12; g++) {
                                        gTotals[`g${g}`] = (d[`enroll_g${g}`] || 0).toString();
                                    }
                                    setGradeTotals(gTotals);
                                    const gAvailability = {};
                                    if ((d.enroll_kinder || 0) === 0) {
                                        gAvailability['kinder'] = false;
                                    }
                                    for (let g = 1; g <= 12; g++) {
                                        if ((d[`enroll_g${g}`] || 0) === 0) {
                                            gAvailability[`g${g}`] = false;
                                        }
                                    }
                                    setGradeAvailability(gAvailability);
                                    
                                    const hasSnedVal = (d.main_sned > 0 || d.self_sned > 0 || d.self_sned_org_class > 0);
                                    setHasSNED(hasSnedVal);
                                    setSnedMainstreamedCount((d.main_sned || 0).toString());
                                    setSnedSelfContainedCount((d.self_sned || 0).toString());
                                    
                                    let snedType = null;
                                    if (d.main_sned > 0 && d.self_sned > 0) snedType = 'Both';
                                    else if (d.main_sned > 0) snedType = 'Mainstreamed';
                                    else if (d.self_sned > 0) snedType = 'Self-Contained';
                                    setSnedProgramType(snedType);
                                    setSnedOrganizedClassCount((d.self_sned_org_class || 0).toString());
                                    
                                    setHasAralMath(!!d.has_aral_math);
                                    const aMath = {};
                                    for (let g = 1; g <= 6; g++) {
                                        aMath[`g${g}`] = (d[`aral_math_learners_g${g}`] || 0).toString();
                                    }
                                    setAralMath(aMath);
                                    
                                    setHasAralReading(!!d.has_aral_reading);
                                    const aReading = {};
                                    for (let g = 1; g <= 6; g++) {
                                        aReading[`g${g}`] = (d[`aral_reading_learners_g${g}`] || 0).toString();
                                    }
                                    setAralReading(aReading);
                                    
                                    setHasAralScience(!!d.has_aral_science);
                                    const aScience = {};
                                    for (let g = 1; g <= 6; g++) {
                                        aScience[`g${g}`] = (d[`aral_science_learners_g${g}`] || 0).toString();
                                    }
                                    setAralScience(aScience);
                                    
                                    const gGenderMap = {};
                                    gGenderMap['kinder'] = {
                                        male: (d.kinder_male || 0).toString(),
                                        female: (d.kinder_female || 0).toString()
                                    };
                                    for (let g = 1; g <= 12; g++) {
                                        gGenderMap[`g${g}`] = {
                                            male: (d[`g${g}_male`] || 0).toString(),
                                            female: (d[`g${g}_female`] || 0).toString()
                                        };
                                    }
                                    gGenderMap['sned_self_contained'] = {
                                        male: (d.self_sned_male || 0).toString(),
                                        female: (d.self_sned_female || 0).toString()
                                    };
                                    gGenderMap['sned_mainstreamed'] = {
                                        male: (d.main_sned_male || 0).toString(),
                                        female: (d.main_sned_female || 0).toString()
                                    };
                                    setGradeGenderMap(gGenderMap);
                                    
                                    const mgCombs = [];
                                    const parseMgString = (str) => {
                                        if (!str) return [];
                                        const matches = str.match(/\d+/g);
                                        if (!matches) return [];
                                        return matches.map(num => `g${num}`);
                                    };
                                    
                                    if (d.multigrade_groupings_1) {
                                        mgCombs.push({
                                            id: 'mg-comb-0',
                                            grades: parseMgString(d.multigrade_groupings_1),
                                            enrollment: d.multigrade_enrollment_1 || 0
                                        });
                                    }
                                    if (d.multigrade_groupings_2) {
                                        mgCombs.push({
                                            id: 'mg-comb-1',
                                            grades: parseMgString(d.multigrade_groupings_2),
                                            enrollment: d.multigrade_enrollment_2 || 0
                                        });
                                    }
                                    if (d.multigrade_groupings_3) {
                                        mgCombs.push({
                                            id: 'mg-comb-2',
                                            grades: parseMgString(d.multigrade_groupings_3),
                                            enrollment: d.multigrade_enrollment_3 || 0
                                        });
                                    }
                                    setMgCombinations(mgCombs);
                                    
                                    let orgT = 'nano';
                                    if (mgCombs.length > 0) {
                                        const locked = new Set();
                                        mgCombs.forEach(c => c.grades.forEach(g => locked.add(g)));
                                        if (locked.size >= 6) {
                                            orgT = 'pure_mg';
                                        } else {
                                            orgT = 'mixed';
                                        }
                                    }
                                    setOrgType(orgT);
                                } catch (e) {
                                    console.warn("Unit 2 Database Map error", e);
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.log("📍 [Unit2] Offline: Skipping server record check.");
                }

                // 4. Set the offering (triggers the availableGrades Effect)
                setSchoolOffering(resolvedOffering || "");

                // 5. Apply Pending Changes (Sync Center)
                if (pendingUnit2) {
                    const p = pendingUnit2.payload;
                    const q = p.unit2_simplified_enrollment?.questionnaire || p.unit2_simplified_enrollment;
                    if (q) {
                        setKinderEnrollment(q.kinderEnrollment || "");
                        setGradeTotals(q.gradeTotals || {});
                        setGradeAvailability(q.gradeAvailability || {});
                        setHasSNED(q.hasSNED);
                        setSnedMainstreamedCount(q.snedMainstreamedCount || (q.snedProgramType === 'Mainstreamed' ? q.snedTotalCount : ""));
                        setSnedSelfContainedCount(q.snedSelfContainedCount || (q.snedProgramType === 'Self-Contained' ? q.snedTotalCount : ""));
                        setSnedProgramType(q.snedProgramType || null);
                        setSnedOrganizedClassCount(q.snedOrganizedClassCount || "");
                        setHasAralMath(q.hasAralMath);
                        setAralMath(q.aralMath || {});
                        setHasAralReading(q.hasAralReading);
                        setAralReading(q.aralReading || {});
                        setHasAralScience(q.hasAralScience);
                        setAralScience(q.aralScience || {});
                        setGradeGenderMap(q.gradeGenderMap || p.gradeGenderMap || {});
                        setOrgType(q.orgType);
                        setMgCombinations(q.mgCombinations || []);
                    }
                    setPendingOutboxId(pendingUnit2.id);
                    setIsReviewMode(true);
                    setIsReadOnly(true);
                } 
                // 6. Apply Draft Changes if no pending outbox
                else if (draft2) {
                    setKinderEnrollment(draft2.kinderEnrollment || "");
                    setOrgType(draft2.orgType || null);
                    setMgCombinations(draft2.mgCombinations || []);
                    setGradeTotals(draft2.gradeTotals || {});
                    setGradeAvailability(draft2.gradeAvailability || {});
                    setHasSNED(draft2.hasSNED);
                    setSnedMainstreamedCount(draft2.snedMainstreamedCount || "");
                    setSnedSelfContainedCount(draft2.snedSelfContainedCount || "");
                    setSnedProgramType(draft2.snedProgramType || null);
                    setSnedOrganizedClassCount(draft2.snedOrganizedClassCount || "");
                    setHasAralMath(draft2.hasAralMath);
                    setAralMath(draft2.aralMath || {});
                    setHasAralReading(draft2.hasAralReading);
                    setAralReading(draft2.aralReading || {});
                    setHasAralScience(draft2.hasAralScience);
                    setAralScience(draft2.aralScience || {});
                    setGradeGenderMap(draft2.gradeGenderMap || {});
                    setCurrentStep(draft2.step || 1);
                    setCurrentGradeIndex(draft2.currentGradeIndex || 0);
                    
                    setIsReadOnly(false);
                    setShowWelcomeBack(true);
                    setTimeout(() => setShowWelcomeBack(false), 3000);
                }

            } catch (err) {
                console.error("Critical Unit 2 Initialization Error:", err);
            } finally {
                setLoading(false);
            }
        };
        initData();
    }, [targetSchoolId, user?.school_id, authLoading]);
    
    // OFFLINE GRADE SELECTOR: Recalculate available grades as soon as schoolOffering changes
    useEffect(() => {
        if (!schoolOffering) {
            setAvailableGrades([]);
            return;
        }

        const text = schoolOffering.toLowerCase();
        let filteredIds = [];

        if (text === "purely elementary") {
            filteredIds = ['kinder', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6'];
        } else if (text.includes("k-10") || text.includes("elementary school and junior high school")) {
            filteredIds = ['kinder', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10'];
        } else if (text.includes("junior high and senior high")) {
            filteredIds = ['g7', 'g8', 'g9', 'g10', 'g11', 'g12'];
        } else if (text.includes("all offering") || text.includes("k-12")) {
            filteredIds = ['kinder', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11', 'g12'];
        } else if (text === "purely junior high school") {
            filteredIds = ['g7', 'g8', 'g9', 'g10'];
        } else if (text === "purely senior high school") {
            filteredIds = ['g11', 'g12'];
        } else {
            // Fallback for legacy data or partial matches
            if (text.includes("elementary") || text.includes("primary")) {
                filteredIds.push('kinder', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6');
            }
            if (text.includes("jhs") || text.includes("junior") || text.includes("high school")) {
                filteredIds.push('g7', 'g8', 'g9', 'g10');
            }
            if (text.includes("shs") || text.includes("senior")) {
                filteredIds.push('g11', 'g12');
            }
        }

        const uniqueIds = [...new Set(filteredIds)];
        const uniqueObj = ALL_GRADES.filter(g => uniqueIds.includes(g.id));
        setAvailableGrades(uniqueObj);

        // ── Restriction: Kinder only if offering includes "elementary" or "ES" ──
        // Per user request, also allow "All Offering" and "K-12" synonyms.
        const isKinderString = text.includes("elementary") || 
                               text.includes("es") || 
                               text.includes("primary") || 
                               text.includes("all offering") || 
                               text.includes("k to 12") || 
                               text.includes("k-12") ||
                               text.includes("k to 10") ||
                               text.includes("k-10");

        const hasK = uniqueObj.some(g => g.id === 'kinder') && isKinderString;
        const hasE = uniqueObj.some(g => g.type === 'elem' && g.id !== 'kinder');
        setHasKinder(hasK);
        setHasElementary(hasE);
        
        if (uniqueObj.length > 0 && !loading) {
             const stored = localStorage.getItem(`unit2_draft_${user?.school_id}`);
             if (!stored && currentStep === 1 && !hasK) {
                 if (hasE) setCurrentStep(2);
                 else setCurrentStep(4);
             }
        }
    }, [schoolOffering, loading, user?.school_id]);

    // ── Safety Guard: Redirect out of invalid steps for the current grade profile ────
    // Prevents Step 1 (Kinder) from showing for JHS/SHS-only schools.
    // NOTE: Compute kinder directly from schoolOffering here instead of relying on
    // hasKinder state, which may still be stale (false) when this effect fires in
    // the same React batch as the offering effect that calls setHasKinder(true).
    useEffect(() => {
        if (loading || !schoolOffering) return;
        const text = schoolOffering.toLowerCase();
        const kinderInOffering = text.includes("elementary") || text.includes("primary") ||
                                 text.includes("all offering") || text.includes("k to 12") ||
                                 text.includes("k-12") || text.includes("k to 10") || text.includes("k-10");
        const elemInOffering = text.includes("elementary") || text.includes("primary") ||
                               text.includes("all offering") || text.includes("k-12") ||
                               text.includes("k to 12") || text.includes("k-10") || text.includes("k to 10");
        if (currentStep === 1 && !kinderInOffering) {
            if (elemInOffering) {
                setCurrentStep(2);
            } else {
                setCurrentStep(4);
            }
        }
    }, [currentStep, loading, schoolOffering]);

    // ── Safety Guard: Ensure currentGradeIndex stays in bounds ──────────────────
    useEffect(() => {
        if (!loading && currentStep === 4) {
            if (activeMonogrades.length === 0) {
                setCurrentStep(5);
            } else if (currentGradeIndex >= activeMonogrades.length) {
                setCurrentGradeIndex(activeMonogrades.length - 1);
            }
        }
    }, [activeMonogrades.length, currentStep, loading, currentGradeIndex]);

    // --- Handlers ---
    const sanitizeNumeric = (val, maxLen = 4) => {
        let cleaned = val.replace(/[^0-9]/g, ''); 
        if (cleaned.length > maxLen) cleaned = cleaned.slice(0, maxLen);
        return cleaned;
    };

    const handleGradeChange = (gradeId, val) => {
        const sanitized = sanitizeNumeric(val);
        setGradeTotals(prev => ({ ...prev, [gradeId]: sanitized }));
        if (sanitized === "" || sanitized === "0") {
            setGradeGenderMap(prev => {
                const newMap = { ...prev };
                delete newMap[gradeId];
                return newMap;
            });
        }
    };

    const handleKinderChange = (val) => {
        const sanitized = sanitizeNumeric(val);
        setKinderEnrollment(sanitized);
        if (sanitized === "" || sanitized === "0") {
            setGradeGenderMap(prev => {
                const newMap = { ...prev };
                delete newMap['kinder'];
                return newMap;
            });
        }
    };

    const toggleAvailability = (gradeId) => {
        setGradeAvailability(prev => {
            const current = (prev[gradeId] === undefined) ? true : prev[gradeId];
            const newState = !current;
            if (!newState) {
                // If turning OFF, force total to 0
                if (gradeId === 'kinder') {
                    setKinderEnrollment("0");
                } else {
                    setGradeTotals(t => ({ ...t, [gradeId]: "0" }));
                }
            }
            return { ...prev, [gradeId]: newState };
        });
    };

    const handleAralChange = (subject, gradeId, val) => {
        const sanitized = sanitizeNumeric(val);
        if (subject === 'math') setAralMath(prev => ({ ...prev, [gradeId]: sanitized }));
        if (subject === 'reading') setAralReading(prev => ({ ...prev, [gradeId]: sanitized }));
        if (subject === 'science') setAralScience(prev => ({ ...prev, [gradeId]: sanitized }));
    };

    const handleSnedCountChange = (type, val) => {
        const sanitized = sanitizeNumeric(val);
        if (type === 'mainstreamed') {
            setSnedMainstreamedCount(sanitized);
            if (sanitized === "" || sanitized === "0") {
                setGradeGenderMap(prev => {
                    const newMap = { ...prev };
                    delete newMap['sned_mainstreamed'];
                    return newMap;
                });
            }
        } else {
            setSnedSelfContainedCount(sanitized);
            if (sanitized === "" || sanitized === "0") {
                setGradeGenderMap(prev => {
                    const newMap = { ...prev };
                    delete newMap['sned_self_contained'];
                    return newMap;
                });
            }
        }
    };

    const handleGradeGenderChange = (gradeId, enrollment, malVal) => {
        const total = parseInt(enrollment) || 0;
        const male = Math.min(parseInt(sanitizeNumeric(malVal, 6)) || 0, total);
        const female = Math.max(0, total - male);
        setGradeGenderMap(prev => ({
            ...prev,
            [gradeId]: { 
                male: male.toString(), 
                female: female.toString() 
            }
        }));
    };

    const handleFemaleGenderChange = (gradeId, enrollment, femVal) => {
        const total = parseInt(enrollment) || 0;
        const female = Math.min(parseInt(sanitizeNumeric(femVal, 6)) || 0, total);
        const male = Math.max(0, total - female);
        setGradeGenderMap(prev => ({
            ...prev,
            [gradeId]: { 
                male: male.toString(),
                female: female.toString() 
            }
        }));
    };

    const handleGenderChange = (field, val) => {
        // Legacy support if needed, but we should move to per-grade.
        // For now, let's keep it minimal or ignore.
    };

    const handleNext = () => {
        // Step 1: Kindergarten
        if (currentStep === 1) {
            if (hasElementary) {
                if (orgType === 'pure_mg' || orgType === 'mixed') {
                    setCurrentStep(3); // Jump straight to multigrade editor if already choosing it
                } else {
                    setCurrentStep(2);
                }
            } else {
                setOrgType('nano');
                setCurrentStep(4);
            }
        }
        // Step 2: Org Gatekeeper
        else if (currentStep === 2) {
            if (!orgType) return;
            if (orgType === 'pure_mg') {
                setCurrentStep(3); // Go to Combinations Builder
            } else if (orgType === 'mixed') {
                setCurrentStep(3); // Start with combinations
            } else { // orgType === 'nano'
                setCurrentStep(4); // Go to Monograde Pages
            }
        }
        // Step 3: MG Builder
        else if (currentStep === 3) {
            if (orgType === 'pure_mg') {
                setCurrentStep(5); // Skip Monograde Pages, go to SNED
            } else {
                setCurrentStep(4); // Mixed: Go to Monograde Pages
            }
        }
        // Step 4: Grade-by-Grade (Monograde/Standalone)
        else if (currentStep === 4) {
            if (activeMonogrades.length === 0) {
                setCurrentStep(5);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }
            if (currentGradeIndex < activeMonogrades.length - 1) {
                setCurrentGradeIndex(prev => prev + 1);
            } else {
                setCurrentStep(5); // Finished grades -> SNED
            }
        }
        // Step 6: ARAL (Skip if not elementary)
        else if (currentStep === 5 && !hasElementary) {
            setCurrentStep(7); // Skip ARAL, go to Gender
        } else {
            setCurrentStep(prev => prev + 1);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleBack = () => {
        if (currentStep === 1) {
            navigate("/modular-dashboard");
            return;
        }

        // Back from Org Gatekeeper
        if (currentStep === 2) {
            if (hasKinder) {
                setCurrentStep(1);
            } else {
                navigate("/modular-dashboard");
            }
            return;
        }

        // Back from MG Builder
        else if (currentStep === 3) {
            if (mgSubStep === 'population') {
                setMgSubStep('selection');
                return;
            }
            if (mgSubStep === 'selection') {
                // Remove newly-added combo if it was left empty
                const activeCombo = mgCombinations.find(c => c.id === activeCombinationId);
                if (activeCombo && activeCombo.grades.length === 0) {
                    setMgCombinations(prev => prev.filter(c => c.id !== activeCombinationId));
                }
                setMgSubStep('manager');
                setActiveCombinationId(null);
                return;
            }
            setCurrentStep(2);
            return;
        }

        // Back from Monograde Pages
        else if (currentStep === 4) {
            if (currentGradeIndex > 0) {
                setCurrentGradeIndex(prev => prev - 1);
            } else {
                if (hasElementary) {
                    // If we came from MG Builder (pure_mg is impossible at step 4, but mixed is)
                    setCurrentStep(orgType === 'mixed' ? 3 : 2);
                } else if (hasKinder) {
                    setCurrentStep(1);
                } else {
                    // Truly the first step for JHS/SHS only schools
                    navigate("/modular-dashboard");
                }
            }
            return;
        }

        // Back from SNED
        else if (currentStep === 5) {
            if (activeMonogrades.length > 0) {
                setCurrentGradeIndex(activeMonogrades.length - 1);
                setCurrentStep(4);
            } else if (hasElementary) {
                // Skip Step 4 if monogrades empty
                setCurrentStep(orgType === 'pure_mg' ? 3 : 2);
            } else if (hasKinder) {
                setCurrentStep(1);
            } else {
                navigate("/modular-dashboard");
            }
            return;
        }

        // Back from ARAL
        if (currentStep === 6) {
            setCurrentStep(5);
            return;
        }

        // Back from Gender
        if (currentStep === 7) {
            if (hasElementary) {
                setCurrentStep(6);
            } else {
                setCurrentStep(5);
            }
            return;
        }

        setCurrentStep(prev => prev - 1);
    };

    const handleSaveDraftAndExit = async () => {
        const storedId = localStorage.getItem('schoolId');
        if (!storedId) return;
        
        const draftData = {
            kinderEnrollment,
            orgType,
            mgCombinations,
            gradeTotals,
            gradeAvailability,
            snedMainstreamedCount,
            snedSelfContainedCount,
            snedProgramType,
            snedOrganizedClassCount,
            hasAralMath, aralMath,
            hasAralReading, aralReading,
            hasAralScience, aralScience,
            gradeGenderMap,
            step: currentStep,
            currentGradeIndex
        };
        
        await saveUnitDraft(2, storedId, draftData);
        navigate("/modular-dashboard");
    };

    const handleSave = async () => {
        const storedId = localStorage.getItem('schoolId');
        if (!storedId) return;
        setIsSaving(true);

        try {
            // Construct the exact questionnaire state representation
            const questionnaire = {
                kinderEnrollment,
                orgType,
                mgCombinations,
                gradeTotals,
                gradeAvailability,
                hasSNED,
                snedMainstreamedCount: parseInt(snedMainstreamedCount) || 0,
                snedSelfContainedCount: parseInt(snedSelfContainedCount) || 0,
                snedProgramType,
                snedOrganizedClassCount: parseInt(snedOrganizedClassCount) || 0,
                hasAralMath, aralMath: hasAralMath ? aralMath : {},
                hasAralReading, aralReading: hasAralReading ? aralReading : {},
                hasAralScience, aralScience: hasAralScience ? aralScience : {},
                gradeGenderMap, // New per-grade map
                grandTotal
            };

            // Backwards compatibility & Database Mapping
            const monogrades = activeMonogrades.map(g => {
                const gender = gradeGenderMap[g.id] || { male: 0, female: 0 };
                const monogradeTotal = (parseInt(gender.male) || 0) + (parseInt(gender.female) || 0);
                const totalActive = gradeAvailability[g.id] !== false && monogradeTotal > 0;
                const count = parseInt(gradeTotals[g.id]) || 0;
                return {
                    grade_level: g.id,
                    is_active: totalActive,
                    total: totalActive ? count : 0,
                    male: totalActive ? (parseInt(gender.male) || 0) : 0,
                    female: totalActive ? (parseInt(gender.female) || 0) : 0
                };
            });

            const mgGrades = mgCombinations.flatMap(c => {
                return c.grades.map((id) => {
                    const gender = gradeGenderMap[id] || { male: 0, female: 0 };
                    const mgTotal = (parseInt(gender.male) || 0) + (parseInt(gender.female) || 0);
                    const isLvlActive = gradeAvailability[id] !== false && mgTotal > 0;
                    return {
                        grade_level: id,
                        is_active: isLvlActive,
                        total: isLvlActive ? mgTotal : 0,
                        male: isLvlActive ? (parseInt(gender.male) || 0) : 0,
                        female: isLvlActive ? (parseInt(gender.female) || 0) : 0
                    };
                });
            });

            const kinderTotal = (parseInt(gradeGenderMap['kinder']?.male) || 0) + (parseInt(gradeGenderMap['kinder']?.female) || 0);
            const isKinderActive = gradeAvailability.kinder !== false && kinderTotal > 0;
            const kinderGrade = hasKinder ? [{
                grade_level: 'kinder',
                is_active: isKinderActive,
                total: isKinderActive ? (parseInt(kinderEnrollment) || 0) : 0,
                male: isKinderActive ? (parseInt(gradeGenderMap['kinder']?.male) || 0) : 0,
                female: isKinderActive ? (parseInt(gradeGenderMap['kinder']?.female) || 0) : 0
            }] : [];

            const downstreamGrades = [...kinderGrade, ...monogrades, ...mgGrades];

            const payload = {
                array: downstreamGrades, 
                questionnaire: questionnaire 
            };

            const buildMgString = (gradesArray) => {
                if (!gradesArray || gradesArray.length === 0) return null;
                const labels = gradesArray.map(gId => gId.replace('g', ''));
                if (labels.length === 1) return `Grade ${labels[0]}`;
                if (labels.length === 2) return `Grade ${labels[0]} & ${labels[1]}`;
                const last = labels.pop();
                return `Grade ${labels.join(', ')} & ${last}`;
            };

            const mg_1 = mgCombinations.length > 0 ? buildMgString(mgCombinations[0].grades) : null;
            const mg_2 = mgCombinations.length > 1 ? buildMgString(mgCombinations[1].grades) : null;
            const mg_3 = mgCombinations.length > 2 ? buildMgString(mgCombinations[2].grades) : null;

            const mg_1_enrollment = mgCombinations.length > 0 ? mgCombinations[0].grades.reduce((sum, g) => sum + (parseInt(gradeTotals[g]) || 0), 0) : null;
            const mg_2_enrollment = mgCombinations.length > 1 ? mgCombinations[1].grades.reduce((sum, g) => sum + (parseInt(gradeTotals[g]) || 0), 0) : null;
            const mg_3_enrollment = mgCombinations.length > 2 ? mgCombinations[2].grades.reduce((sum, g) => sum + (parseInt(gradeTotals[g]) || 0), 0) : null;

            const mg_1_male = mgCombinations.length > 0 ? mgCombinations[0].grades.reduce((sum, g) => sum + (parseInt(gradeGenderMap[g]?.male) || 0), 0) : 0;
            const mg_1_female = mgCombinations.length > 0 ? mgCombinations[0].grades.reduce((sum, g) => sum + (parseInt(gradeGenderMap[g]?.female) || 0), 0) : 0;
            const mg_2_male = mgCombinations.length > 1 ? mgCombinations[1].grades.reduce((sum, g) => sum + (parseInt(gradeGenderMap[g]?.male) || 0), 0) : 0;
            const mg_2_female = mgCombinations.length > 1 ? mgCombinations[1].grades.reduce((sum, g) => sum + (parseInt(gradeGenderMap[g]?.female) || 0), 0) : 0;
            const mg_3_male = mgCombinations.length > 2 ? mgCombinations[2].grades.reduce((sum, g) => sum + (parseInt(gradeGenderMap[g]?.male) || 0), 0) : 0;
            const mg_3_female = mgCombinations.length > 2 ? mgCombinations[2].grades.reduce((sum, g) => sum + (parseInt(gradeGenderMap[g]?.female) || 0), 0) : 0;

            if (!navigator.onLine) {
                // OFFLINE SAVE
                await addModularToOutbox({
                    unitId: 2,
                    label: "Unit 2: Learner Profile",
                    url: api(`/ph_schools/unit2/${storedId}`),
                    method: 'PUT',
                    payload: { 
                        iern,
                        unit2_simplified_enrollment: payload,
                    has_sned: hasSNED,
                    sned_mainstreamed_count: parseInt(snedMainstreamedCount) || 0,
                    sned_self_contained_count: parseInt(snedSelfContainedCount) || 0,
                    sned_total_count: parseInt(snedSelfContainedCount) || 0,
                    sned_program_type: snedProgramType,
                    sned_organized_class_count: parseInt(snedOrganizedClassCount) || 0,
                        multigrade_groupings_1: mg_1,
                        multigrade_groupings_2: mg_2,
                        multigrade_groupings_3: mg_3,
                        multigrade_enrollment_1: mg_1_enrollment,
                        multigrade_enrollment_2: mg_2_enrollment,
                        multigrade_enrollment_3: mg_3_enrollment,
                        multigrade_groupings_1_male: mg_1_male,
                        multigrade_groupings_1_female: mg_1_female,
                        multigrade_groupings_2_male: mg_2_male,
                        multigrade_groupings_2_female: mg_2_female,
                        multigrade_groupings_3_male: mg_3_male,
                        multigrade_groupings_3_female: mg_3_female,
                        gradeGenderMap 
                    },
                    schoolId: storedId
                });

                await clearUnitDraft(2, storedId);
                setShowOfflineSuccess(true);
                return;
            }

            const res = await fetch(api(`/api/ph_schools/unit2/${storedId}`), {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    iern,
                    unit2_simplified_enrollment: payload,
                    has_sned: hasSNED,
                    sned_mainstreamed_count: parseInt(snedMainstreamedCount) || 0,
                    sned_self_contained_count: parseInt(snedSelfContainedCount) || 0,
                    sned_total_count: parseInt(snedSelfContainedCount) || 0,
                    sned_program_type: snedProgramType,
                    sned_organized_class_count: parseInt(snedOrganizedClassCount) || 0,
                    multigrade_groupings_1: mg_1,
                    multigrade_groupings_2: mg_2,
                    multigrade_groupings_3: mg_3,
                    multigrade_enrollment_1: mg_1_enrollment,
                    multigrade_enrollment_2: mg_2_enrollment,
                    multigrade_enrollment_3: mg_3_enrollment,
                    multigrade_groupings_1_male: mg_1_male,
                    multigrade_groupings_1_female: mg_1_female,
                    multigrade_groupings_2_male: mg_2_male,
                    multigrade_groupings_2_female: mg_2_female,
                    multigrade_groupings_3_male: mg_3_male,
                    multigrade_groupings_3_female: mg_3_female,
                    gradeGenderMap // Send the full map for column-level extraction
                })
            });

            if (res.ok) {
                fetch(api(`/api/user/progress`), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ unitId: 2, schoolId: storedId })
                }).catch(e => console.warn("Activity sync failed:", e));

                const stored = localStorage.getItem('quest_progress');
                let progress = stored ? JSON.parse(stored) : { completedUnits: [], xp: 0 };
                if (!progress.completedUnits.includes(2)) {
                    progress.completedUnits.push(2);
                    progress.xp = (progress.xp || 0) + 200;
                }
                localStorage.setItem('quest_progress', JSON.stringify(progress));

                setHasSubmitted(true);
                setIsReadOnly(true);
                setShowSuccess(true);
                await clearUnitDraft(2, storedId);
            } else {
                alert("Failed to save enrollment.");
            }
        } catch (e) {
            console.error(e);
            if (!navigator.onLine || e.message.includes('fetch')) {
                // FALLBACK TO OUTBOX
                await addModularToOutbox({
                    unitId: 2,
                    label: "Unit 2: Learner Profile",
                    url: api(`/ph_schools/unit2/${storedId}`),
                    method: 'PUT',
                    payload: { iern, unit2_simplified_enrollment: payload, has_sned: hasSNED, sned_total_count: parseInt(snedSelfContainedCount) || 0, sned_program_type: snedProgramType, sned_organized_class_count: parseInt(snedOrganizedClassCount) || 0, multigrade_groupings_1: mg_1, multigrade_groupings_2: mg_2, multigrade_groupings_3: mg_3, multigrade_enrollment_1: mg_1_enrollment, multigrade_enrollment_2: mg_2_enrollment, multigrade_enrollment_3: mg_3_enrollment, gradeGenderMap },
                    schoolId: storedId
                });
                await clearUnitDraft(2, storedId);
                setShowOfflineSuccess(true);
            } else {
                alert("An error occurred during save.");
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleEditPending = async () => {
        if (!pendingOutboxId) return;
        if (window.confirm("Do you want to move this data back to 'Draft' mode to make changes? It will be removed from the Sync Center for now.")) {
            await deleteModularFromOutbox(pendingOutboxId);
            setPendingOutboxId(null);
            setIsReadOnly(false);
            setIsReviewMode(false);
        }
    };

    // --- Transitions ---
    const pageVariants = {
        initial: { opacity: 0, y: 30, scale: 0.98 },
        in: { opacity: 1, y: 0, scale: 1 },
        out: { opacity: 0, y: -30, scale: 0.98 }
    };
    
    const expandVariants = {
        hidden: { opacity: 0, height: 0, marginTop: 0 },
        visible: { opacity: 1, height: "auto", marginTop: 16 },
    };

    // --- Internal Summary Component ---
    const Unit2Summary = () => {
        const showKinder = hasKinder && offeringHasKinder;

        const maleTotal = Object.entries(gradeGenderMap).reduce((s, [key, g]) => {
            if (key === 'sned_mainstreamed' || key === 'sned_mainstreamed_integrated') return s; // Exclude mainstreamed
            if (key === 'sned' && snedProgramType !== 'Self-Contained') return s; // Legacy
            if (key === 'kinder' && !showKinder) return s;
            return s + (parseInt(g.male) || 0);
        }, 0);

        const femaleTotal = Object.entries(gradeGenderMap).reduce((s, [key, g]) => {
            if (key === 'sned_mainstreamed' || key === 'sned_mainstreamed_integrated') return s; // Exclude mainstreamed
            if (key === 'sned' && snedProgramType !== 'Self-Contained') return s; // Legacy
            if (key === 'kinder' && !showKinder) return s;
            return s + (parseInt(g.female) || 0);
        }, 0);

        return (
            <div className="w-full pb-32 mt-4 space-y-8 px-2">
                {/* Header Section */}
                <div className="text-center mb-10">
                    <motion.div 
                        initial={{ scale: 0 }} 
                        animate={{ scale: 1 }} 
                        className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-[2rem] mx-auto mb-6 flex items-center justify-center shadow-xl shadow-indigo-100"
                    >
                        <span className="text-4xl text-white">📊</span>
                    </motion.div>
                    <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-[0.2em] mb-3 shadow-sm border border-indigo-100">
                        Unit 2 • Learner Profile Summary
                    </span>
                    <h1 className="text-3xl font-black text-slate-800 leading-tight tracking-tight px-4">Enrollment Overview</h1>
                    <p className="text-slate-500 font-medium mt-2">Verified via ESF7 Parity Registry • SY 2025-2026</p>

                    {pendingOutboxId && (
                        <div className="mt-8 flex flex-col items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                            <div className="inline-flex items-center gap-2 px-6 py-3 bg-amber-50 border-2 border-amber-100 rounded-full shadow-sm">
                                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                                <span className="text-[10px] font-black text-amber-700 uppercase tracking-[0.2em]">Pending Sync</span>
                            </div>
                            <button 
                                onClick={handleEditPending}
                                className="px-8 py-4 bg-white border-2 border-slate-200 rounded-[2rem] text-[11px] font-black text-slate-600 uppercase tracking-widest hover:border-blue-300 hover:text-blue-600 active:scale-95 transition-all shadow-sm flex items-center gap-2 group"
                            >
                                <FiEdit2 className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                                Edit Pending
                            </button>
                        </div>
                    )}
                </div>

                {/* Main Content Responsive Layout Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Stats Cards */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Grand Total Hero Card */}
                        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-xl shadow-slate-200/50 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 text-7xl opacity-10 grayscale group-hover:grayscale-0 transition-all duration-700">📊</div>
                            <div className="flex items-center gap-2 mb-6">
                                <div className="w-1.5 h-6 bg-blue-400 rounded-full" />
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Grand Enrollment Stats</h3>
                            </div>
                            
                            <div className="flex items-end gap-3 mb-8">
                                <span className="text-6xl font-black leading-none tracking-tighter">{grandTotal}</span>
                                <span className="text-blue-400 font-black uppercase tracking-widest text-xs mb-2">Total Learners</span>
                            </div>

                            <div className="grid grid-cols-2 gap-6 pt-6 border-t border-white/10">
                                <div>
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">👦 Male</span>
                                    <p className="text-3xl font-black text-blue-400">{maleTotal}</p>
                                </div>
                                <div className="border-l border-white/10 pl-6">
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">👧 Female</span>
                                    <p className="text-3xl font-black text-rose-400">{femaleTotal}</p>
                                </div>
                            </div>
                        </div>

                        {/* SNED Card */}
                        {hasSNED && (
                            <div className="bg-amber-50 rounded-[2.5rem] p-1 border-2 border-amber-100 shadow-sm overflow-hidden">
                                <div className="bg-white rounded-[2.2rem] p-6 space-y-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-[1.5rem] bg-amber-100 flex items-center justify-center text-2xl shadow-inner">🌟</div>
                                        <div>
                                            <h4 className="font-black text-slate-800">Special Education (SNED)</h4>
                                            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Learner Classification</p>
                                        </div>
                                    </div>

                                    {/* Mainstreamed Section */}
                                    {parseInt(snedMainstreamedCount) > 0 && (
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center px-1">
                                                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Mainstreamed</span>
                                                <span className="text-[9px] font-bold text-slate-400 italic">Excluded from Grand Total</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-blue-50/50 rounded-2xl p-4 flex justify-between items-center text-blue-900">
                                                    <span className="text-[9px] font-black uppercase">Male</span>
                                                    <span className="text-lg font-black">{gradeGenderMap['sned_mainstreamed']?.male || 0}</span>
                                                </div>
                                                <div className="bg-rose-50/50 rounded-2xl p-4 flex justify-between items-center text-rose-900">
                                                    <span className="text-[9px] font-black uppercase">Female</span>
                                                    <span className="text-lg font-black">{gradeGenderMap['sned_mainstreamed']?.female || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Self-Contained Section */}
                                    {parseInt(snedSelfContainedCount) > 0 && (
                                        <div className="space-y-3 border-t border-slate-100 pt-4">
                                            <div className="flex justify-between items-center px-1">
                                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Self-Contained</span>
                                                <span className="text-[9px] font-bold text-slate-400 italic">Included in Grand Total</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-blue-50/50 rounded-2xl p-4 flex justify-between items-center text-blue-900">
                                                    <span className="text-[9px] font-black uppercase">Male</span>
                                                    <span className="text-lg font-black">{gradeGenderMap['sned_self_contained']?.male || 0}</span>
                                                </div>
                                                <div className="bg-rose-50/50 rounded-2xl p-4 flex justify-between items-center text-rose-900">
                                                    <span className="text-[9px] font-black uppercase">Female</span>
                                                    <span className="text-lg font-black">{gradeGenderMap['sned_self_contained']?.female || 0}</span>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center px-2 pt-2">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Organized Classes</span>
                                                <span className="font-black text-slate-800">{snedOrganizedClassCount || 0}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ARAL Program Card */}
                        {(hasAralMath || hasAralReading || hasAralScience) && (
                            <div className="bg-emerald-50 rounded-[2.5rem] p-1 border-2 border-emerald-100 shadow-sm overflow-hidden">
                                <div className="bg-white rounded-[2.2rem] p-6 space-y-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-[1.5rem] bg-emerald-100 flex items-center justify-center text-2xl shadow-inner">📖</div>
                                        <div>
                                            <h4 className="font-black text-slate-800">ARAL Remediation</h4>
                                            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Active Programs</p>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2.5 pt-2">
                                        {hasAralMath && (
                                            <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex justify-between items-center">
                                                <div>
                                                    <span className="font-bold text-slate-700 text-sm">🧮 Mathematics</span>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Grades 1-6</p>
                                                </div>
                                                <span className="font-black text-emerald-600 text-sm">
                                                    {Object.values(aralMath).reduce((s, v) => s + (parseInt(v) || 0), 0)} learners
                                                </span>
                                            </div>
                                        )}
                                        {hasAralReading && (
                                            <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex justify-between items-center">
                                                <div>
                                                    <span className="font-bold text-slate-700 text-sm">📚 Reading</span>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Grades 1-6</p>
                                                </div>
                                                <span className="font-black text-emerald-600 text-sm">
                                                    {Object.values(aralReading).reduce((s, v) => s + (parseInt(v) || 0), 0)} learners
                                                </span>
                                            </div>
                                        )}
                                        {hasAralScience && (
                                            <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex justify-between items-center">
                                                <div>
                                                    <span className="font-bold text-slate-700 text-sm">🧪 Science</span>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Grades 1-6</p>
                                                </div>
                                                <span className="font-black text-emerald-600 text-sm">
                                                    {Object.values(aralScience).reduce((s, v) => s + (parseInt(v) || 0), 0)} learners
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Detailed Registry */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex items-center gap-2 mb-2 ml-2">
                            <div className="w-1 h-4 bg-indigo-500 rounded-full" />
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.15em]">Grade-Level Registry</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Kinder Card */}
                            {showKinder && (() => {
                                const kinderTotal = (parseInt(gradeGenderMap['kinder']?.male) || 0) + (parseInt(gradeGenderMap['kinder']?.female) || 0);
                                const isKinderDisabled = gradeAvailability.kinder === false || kinderTotal === 0;
                                return (
                                    <div className={`rounded-[2rem] p-6 border shadow-sm flex items-center justify-between group transition-colors ${isKinderDisabled ? 'bg-slate-50/70 border-slate-200 opacity-60' : 'bg-white border-slate-100 hover:border-indigo-200'}`}>
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-xl shadow-inner group-hover:bg-indigo-100 transition-colors">🎈</div>
                                            <div>
                                                <h4 className="font-black text-slate-700">Kindergarten</h4>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Early Childhood</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-4 text-right">
                                            {isKinderDisabled ? (
                                                <span className="text-[10px] font-black text-slate-400 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full uppercase tracking-wider">DISABLED</span>
                                            ) : (
                                                <>
                                                    <div>
                                                        <p className="text-[10px] font-black text-blue-400 text-center">M</p>
                                                        <p className="font-black text-slate-800 text-center">{gradeGenderMap['kinder']?.male || 0}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black text-rose-400 text-center">F</p>
                                                        <p className="font-black text-slate-800 text-center">{gradeGenderMap['kinder']?.female || 0}</p>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Monograde Cards */}
                            {activeMonogrades.map(g => {
                                const monogradeTotal = (parseInt(gradeGenderMap[g.id]?.male) || 0) + (parseInt(gradeGenderMap[g.id]?.female) || 0);
                                const isGradeDisabled = gradeAvailability[g.id] === false || monogradeTotal === 0;
                                return (
                                    <div key={`sum-${g.id}`} className={`rounded-[2rem] p-6 border shadow-sm flex items-center justify-between group transition-colors ${isGradeDisabled ? 'bg-slate-50/70 border-slate-200 opacity-60' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-xl shadow-inner group-hover:bg-slate-100 transition-colors">📚</div>
                                            <div>
                                                <h4 className="font-black text-slate-700">{g.label}</h4>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Monograde</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-4 text-right">
                                            {isGradeDisabled ? (
                                                <span className="text-[10px] font-black text-slate-400 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full uppercase tracking-wider">DISABLED</span>
                                            ) : (
                                                <>
                                                    <div>
                                                        <p className="text-[10px] font-black text-blue-400 text-center">M</p>
                                                        <p className="font-black text-slate-800 text-center">{gradeGenderMap[g.id]?.male || 0}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black text-rose-400 text-center">F</p>
                                                        <p className="font-black text-slate-800 text-center">{gradeGenderMap[g.id]?.female || 0}</p>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Multigrade Sections */}
                            {mgCombinations.map((c, idx) => {
                                const groupingsMale = c.grades.reduce((sum, g) => sum + (parseInt(gradeGenderMap[g]?.male) || 0), 0);
                                const groupingsFemale = c.grades.reduce((sum, g) => sum + (parseInt(gradeGenderMap[g]?.female) || 0), 0);
                                return (
                                    <div key={`sum-mg-${c.id}`} className="bg-indigo-50/30 rounded-[2.5rem] p-1 border-2 border-indigo-100/50 overflow-hidden md:col-span-2">
                                        <div className="px-6 py-4 flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500">Multigrade Combo {idx+1}</span>
                                            <span className="text-xs font-black text-indigo-900 bg-white px-3 py-1 rounded-full shadow-sm border border-indigo-100">
                                                {c.grades.map(g => g.replace('g','')).join(' & ')}
                                            </span>
                                        </div>
                                        <div className="bg-white rounded-[2rem] p-4 space-y-3">
                                            {c.grades.map(lvl => {
                                                const lvlTotal = (parseInt(gradeGenderMap[lvl]?.male) || 0) + (parseInt(gradeGenderMap[lvl]?.female) || 0);
                                                const isLvlDisabled = gradeAvailability[lvl] === false || lvlTotal === 0;
                                                return (
                                                    <div key={`lvl-${lvl}`} className={`flex justify-between items-center px-4 py-2 border-b border-slate-50 last:border-0 ${isLvlDisabled ? 'opacity-60 bg-slate-50/50' : ''}`}>
                                                        <span className="font-bold text-slate-600 text-sm">{ALL_GRADES.find(x => x.id === lvl)?.label || lvl}</span>
                                                        {isLvlDisabled ? (
                                                            <span className="text-[10px] font-black text-slate-400 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full uppercase tracking-wider">DISABLED</span>
                                                        ) : (
                                                            <div className="flex gap-6">
                                                                <span className="font-black text-blue-600 text-sm">M: {gradeGenderMap[lvl]?.male || 0}</span>
                                                                <span className="font-black text-rose-600 text-sm">F: {gradeGenderMap[lvl]?.female || 0}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            <div className="pt-3 flex justify-between items-center px-4 border-t-2 border-dashed border-slate-100">
                                                <span className="text-[10px] font-black text-indigo-500 uppercase italic">Combo Subtotal</span>
                                                <div className="flex gap-6">
                                                    <span className="font-black text-blue-700">👦 {groupingsMale}</span>
                                                    <span className="font-black text-rose-700">👧 {groupingsFemale}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {!propReadOnly && isReadOnly && (
                    <div className="fixed bottom-0 left-0 w-full p-6 bg-white/80 backdrop-blur-xl border-t border-slate-100 flex justify-center z-[60]">
                        <button onClick={() => setIsReadOnly(false)} className="w-full max-w-sm py-5 rounded-[2rem] bg-indigo-600 text-white font-black text-xl shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-transform">
                            <FiUnlock className="w-6 h-6" /> Unlock to Audit
                        </button>
                    </div>
                )}
            </div>
        );
    };

    if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8"><div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div></div>;

    // --- Centralized Validation Logic ---
    const canContinue = (() => {
        if (currentStep === 1) {
            const isAvailable = gradeAvailability.kinder !== false;
            const hasEnrollment = !isAvailable || (kinderEnrollment && parseInt(kinderEnrollment) > 0);
            const hasGender = !isAvailable || (gradeGenderMap['kinder']?.male !== undefined && gradeGenderMap['kinder']?.male !== "");
            return hasEnrollment && hasGender;
        }
        if (currentStep === 2) return !!orgType;
        if (currentStep === 3) {
            const hasValidCombos = mgCombinations.length > 0 && mgCombinations.every(c => {
                if (c.grades.length === 0) return false;
                
                // Check if every grade in this combo has enrollment and gender data
                return c.grades.every(lvl => {
                    const total = parseInt(gradeTotals[lvl]) || 0;
                    const male = gradeGenderMap[lvl]?.male;
                    const female = gradeGenderMap[lvl]?.female;
                    return total > 0 && male !== undefined && male !== "" && female !== undefined && female !== "";
                });
            });

            if (!hasValidCombos) return false;

            if (orgType === 'pure_mg') {
                const assignedGrades = new Set(mgCombinations.flatMap(c => c.grades));
                const offeredElemGrades = availableGrades
                    .filter(g => g.type === 'elem' && g.id !== 'kinder' && gradeAvailability[g.id] !== false)
                    .map(g => g.id);
                return offeredElemGrades.every(g => assignedGrades.has(g));
            }

            return true;
        }
        if (currentStep === 4) {
            const g = activeMonogrades[currentGradeIndex];
            if (!g) return true;
            const isAvailable = gradeAvailability[g.id] !== false;
            const hasEnrollment = !isAvailable || (gradeTotals[g.id] && parseInt(gradeTotals[g.id]) > 0);
            const hasGender = !isAvailable || (gradeGenderMap[g.id]?.male !== undefined && gradeGenderMap[g.id]?.male !== "");
            return hasEnrollment && hasGender;
        }
        if (currentStep === 5) {
            if (hasSNED === false) return true;
            if (hasSNED === true) {
                const hasMainstreamed = parseInt(snedMainstreamedCount) > 0;
                const hasSelfContained = parseInt(snedSelfContainedCount) > 0;
                
                if (!hasMainstreamed && !hasSelfContained) return false;
                
                if (hasMainstreamed) {
                    const mGender = gradeGenderMap['sned_mainstreamed'];
                    if (!mGender || mGender.male === "" || mGender.female === "") return false;
                }
                if (hasSelfContained) {
                    const sGender = gradeGenderMap['sned_self_contained'];
                    if (!sGender || sGender.male === "" || sGender.female === "") return false;
                    if (!snedOrganizedClassCount) return false;
                }
                return true;
            }
            return false;
        }
        if (currentStep === 6) {
            return (hasAralMath !== null && hasAralReading !== null && hasAralScience !== null) &&
                !(hasAralMath === true && (Object.values(aralMath).reduce((sum, val) => sum + (parseInt(val) || 0), 0) === 0 || ELEM_GRADES.some(lvl => (parseInt(aralMath[lvl]) || 0) > (gradeCapacities[lvl] || 0)))) &&
                !(hasAralReading === true && (Object.values(aralReading).reduce((sum, val) => sum + (parseInt(val) || 0), 0) === 0 || ELEM_GRADES.some(lvl => (parseInt(aralReading[lvl]) || 0) > (gradeCapacities[lvl] || 0)))) &&
                !(hasAralScience === true && (Object.values(aralScience).reduce((sum, val) => sum + (parseInt(val) || 0), 0) === 0 || ELEM_GRADES.some(lvl => (parseInt(aralScience[lvl]) || 0) > (gradeCapacities[lvl] || 0))));
        }
        if (currentStep === 7) return true; // Step 7 is now a summary/confirmation table
        return true;
    })();

    return (
        <div className={`min-h-screen unit1-page relative pb-32`}>
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
            
            {/* Header */}
            <header className="px-6 py-5 flex items-center justify-between border-b border-gray-100/50 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => effectiveReadOnly ? navigate("/modular-dashboard") : handleBack()} 
                        className="p-2 -ml-2 text-gray-400 hover:text-gray-900 transition-colors"
                    >
                        <FiArrowLeft className="w-6 h-6" />
                    </button>
                    <div className="flex flex-col ml-2">
                        <span className="text-[10px] font-black tracking-widest text-indigo-400 uppercase leading-none">
                            {effectiveReadOnly ? "Reviewing" : "Module 2"}
                        </span>
                        <span className="text-sm font-black text-slate-800 leading-tight">
                            Learner Profile
                        </span>
                    </div>
                </div>
                {!effectiveReadOnly && (
                    <div className="flex items-center gap-4">
                        <div className="w-[120px] h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <motion.div 
                                className="h-full bg-blue-600 rounded-full" 
                                initial={{ width: 0 }} 
                                animate={{ width: `${(currentStep / 7) * 100}%` }} 
                                transition={{ duration: 0.8, ease: "circOut" }} 
                            />
                        </div>
                        <span className="text-xs font-black tracking-widest text-gray-300 uppercase">Step {currentStep}/7</span>
                    </div>
                )}
            </header>

            {showWelcomeBack && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] w-full max-w-xs animate-in slide-in-from-top duration-500">
                    <div className="bg-slate-900/90 backdrop-blur-xl text-white px-6 py-4 rounded-3xl shadow-2xl border border-white/20 flex items-center gap-4">
                        <div className="w-10 h-10 bg-indigo-500 rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-indigo-500/30">✨</div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-indigo-300 mb-0.5">Welcome Back</p>
                            <p className="text-sm font-bold text-slate-100 leading-tight">Your draft has been restored!</p>
                        </div>
                    </div>
                </div>
            )}

            <main className={effectiveReadOnly ? "max-w-7xl mx-auto px-4 md:px-8 w-full" : "max-w-xl mx-auto px-4"}>
                <UnitRemarkAlert unitId="u2" schoolId={targetSchoolId || user?.school_id || localStorage.getItem('schoolId')} />
                {effectiveReadOnly ? (
                    <Unit2Summary />
                ) : (
                    <>
                        {!schoolOffering && !loading && (
                            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
                                className="mb-8 p-6 bg-rose-50 border-4 border-rose-100 rounded-[2rem] flex items-center gap-4 shadow-xl shadow-rose-100/50">
                                <div className="w-12 h-12 bg-rose-500 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg">⚠️</div>
                                <div className="flex-1">
                                    <h3 className="font-black text-rose-800 uppercase tracking-widest text-xs mb-1">Attention Required</h3>
                                    <p className="text-rose-700 font-bold leading-tight">Please complete Unit 1 to set your Curricular Offering so the correct grade levels appear here.</p>
                                </div>
                            </motion.div>
                        )}
                        <AnimatePresence mode="wait">
                    
                    {/* STEP 1: Kindergarten (Mandatory Standalone) */}
                    {(currentStep === 1 && hasKinder) && (
                        <motion.div key="kinder" variants={pageVariants} initial="initial" animate="in" exit="out" transition={{ duration: 0.3 }}>
                            <div className="text-center mb-10">
                                <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-black uppercase tracking-[0.2em] mb-4 shadow-sm">
                                    Step 1 • Early Childhood
                                </span>
                                <h1 className="text-4xl font-black text-slate-800 mb-2 leading-tight">
                                    Kindergarten Enrollment
                                </h1>
                                <p className="text-slate-500 font-medium italic">"Every child's journey starts here."</p>
                            </div>

                            {(() => {
                                const isAvailable = gradeAvailability.kinder !== false;
                                return (
                                    <>
                                        <div className={`bg-white p-8 rounded-[2.5rem] border-4 transition-all duration-500 shadow-2xl shadow-slate-200/50 mb-8 ${isAvailable ? 'border-indigo-100/50 scale-100' : 'border-slate-100 grayscale scale-[0.98]'}`}>
                                            {/* Master Switch Panel */}
                                            <div className="w-full flex items-center justify-between p-4 bg-slate-50/50 rounded-3xl border-2 border-slate-100/50 mb-6">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Status</span>
                                                    <span className={`text-xl font-bold ${isAvailable ? 'text-emerald-600' : 'text-slate-500'}`}>
                                                        {isAvailable ? "Active Session" : "Not Offered"}
                                                    </span>
                                                </div>
                                                <button 
                                                    onClick={() => toggleAvailability('kinder')}
                                                    className={`px-8 py-4 rounded-2xl font-black text-sm transition-all shadow-md active:scale-95 ${isAvailable ? 'bg-white text-rose-500 border-2 border-rose-100 hover:bg-rose-50' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                                                >
                                                    {isAvailable ? "Disable Grade" : "Enable Grade"}
                                                </button>
                                            </div>

                                            <label className={`block text-xs font-black uppercase tracking-widest mb-4 ml-2 ${isAvailable ? 'text-slate-400' : 'text-slate-300'}`}>Total Kinder Learners</label>
                                            <input 
                                                type="number" 
                                                value={kinderEnrollment === "0" ? "" : (kinderEnrollment || "")}
                                                disabled={!isAvailable}
                                                onChange={(e) => handleKinderChange(e.target.value)}
                                                placeholder="0"
                                                autoFocus={isAvailable}
                                                className={chunkyInput + " !text-5xl text-center border-indigo-100 hover:border-indigo-400 focus:border-indigo-600 mb-8"}
                                            />

                                            {isAvailable && (
                                                <div className="w-full mt-8 pt-8 border-t-2 border-slate-50 grid grid-cols-2 gap-6">
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 block mb-2 text-center">Male</label>
                                                        <input 
                                                            type="number"
                                                            value={gradeGenderMap['kinder']?.male === "0" ? "" : (gradeGenderMap['kinder']?.male || "")}
                                                            onChange={(e) => handleGradeGenderChange('kinder', kinderEnrollment, e.target.value)}
                                                            placeholder="0"
                                                            className={chunkyInput + " !text-3xl text-center border-blue-100 focus:border-blue-500"}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-400 block mb-2 text-center">Female</label>
                                                        <input 
                                                            type="number"
                                                            value={gradeGenderMap['kinder']?.female === "0" ? "" : (gradeGenderMap['kinder']?.female || "")}
                                                            onChange={(e) => handleFemaleGenderChange('kinder', kinderEnrollment, e.target.value)}
                                                            placeholder="0"
                                                            className={chunkyInput + " !text-3xl text-center border-rose-100 focus:border-rose-500"}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                            <div className={`mt-8 p-4 rounded-2xl border-2 flex gap-3 items-center ${isAvailable ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100 opacity-50'}`}>
                                                <span className="text-2xl">💡</span>
                                                <p className={`text-sm font-medium leading-snug ${isAvailable ? 'text-amber-700' : 'text-slate-400'}`}>
                                                    Kindergarten is handled standalone and is <strong>not included</strong> in multigrade combinations.
                                                </p>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </motion.div>
                    )}

                    {/* STEP 2: Organization Gatekeeper (G1-G6 Only) */}
                    {currentStep === 2 && (
                        <motion.div key="org" variants={pageVariants} initial="initial" animate="in" exit="out" transition={{ duration: 0.3 }}>
                            <div className="text-center mb-10">
                                <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-black uppercase tracking-[0.2em] mb-4 shadow-sm">
                                    Step 2 • Elementary Organization
                                </span>
                                <h1 className="text-4xl font-black text-slate-800 mb-2 leading-tight">
                                    How are your Grade 1 to Grade 6 classes organized?
                                </h1>
                                <p className="text-slate-500 font-medium">Choose the setup that fits your school.</p>
                            </div>

                            <div className="space-y-4 mb-8">
                                {[
                                    { id: 'nano', label: 'Monograde', sub: 'Standard 1-grade-per-page (Pure Monograde)', icon: '🏫' },
                                    { id: 'pure_mg', label: 'Pure Multigrade', sub: 'Only builds combinations (e.g. G1+G2)', icon: '🤝' },
                                    { id: 'mixed', label: 'Mixed Organization', sub: 'Both Monograde grades and Multigrade combinations', icon: '🔄' }
                                ].map(opt => (
                                    <button
                                        key={opt.id}
                                        onClick={() => setOrgType(opt.id)}
                                        className={`w-full p-6 rounded-[2rem] border-4 transition-all flex items-center gap-6 text-left ${orgType === opt.id ? 'border-indigo-500 bg-indigo-50/50 shadow-xl shadow-indigo-100 scale-[1.02]' : 'border-slate-100 bg-white hover:border-indigo-200'}`}
                                    >
                                        <div className="text-4xl">{opt.icon}</div>
                                        <div className="flex-1">
                                            <h3 className="font-black text-xl text-slate-800">{opt.label}</h3>
                                            <p className="text-sm font-medium text-slate-500">{opt.sub}</p>
                                        </div>
                                        <div className={`w-8 h-8 rounded-full border-4 flex items-center justify-center transition-all ${orgType === opt.id ? 'border-indigo-500 bg-indigo-500' : 'border-slate-200'}`}>
                                            {orgType === opt.id && <FiCheckCircle className="text-white w-5 h-5" />}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 3a: Multigrade Combination Manager */}
                    {currentStep === 3 && mgSubStep === 'manager' && (
                        <motion.div key="mg-manager" variants={pageVariants} initial="initial" animate="in" exit="out" transition={{ duration: 0.3 }}>
                            <div className="text-center mb-10">
                                <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-black uppercase tracking-[0.2em] mb-4 shadow-sm">
                                    Step 3 • Combination Manager
                                </span>
                                <h1 className="text-4xl font-black text-slate-800 mb-2 leading-tight">
                                    Multigrade Combinations
                                </h1>
                                <p className="text-slate-500 font-medium">Manage your grade groupings, then fill in each one.</p>
                            </div>

                            <div className="space-y-3 mb-6">
                                {mgCombinations.length === 0 && (
                                    <div className="text-center py-16 bg-slate-50 rounded-[2rem] border-4 border-dashed border-slate-100">
                                        <p className="text-slate-400 font-black italic">No combinations yet. Add one below.</p>
                                    </div>
                                )}
                                {mgCombinations.map(c => {
                                    const comboLabel = c.grades.length > 0
                                        ? c.grades.map(g => ALL_GRADES.find(x => x.id === g)?.label || g).join(' + ')
                                        : 'Empty Combination';
                                    const comboTotal = c.grades.reduce((sum, g) => sum + (parseInt(gradeGenderMap[g]?.male) || 0) + (parseInt(gradeGenderMap[g]?.female) || 0), 0);
                                    const isComplete = c.grades.length > 0 && c.grades.every(lvl => {
                                        const total = parseInt(gradeTotals[lvl]) || 0;
                                        return total > 0 && gradeGenderMap[lvl]?.male !== undefined && gradeGenderMap[lvl]?.male !== "";
                                    });
                                    return (
                                        <div key={c.id} className={`bg-white p-6 rounded-[2rem] border-2 flex items-center justify-between shadow-sm transition-all ${isComplete ? 'border-emerald-100' : 'border-indigo-100'}`}>
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg ${isComplete ? 'bg-emerald-50 text-emerald-500' : 'bg-indigo-50 text-indigo-400'}`}>
                                                    {isComplete ? '✅' : '🔢'}
                                                </div>
                                                <div>
                                                    <h3 className="font-black text-slate-800 leading-tight">{comboLabel}</h3>
                                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                                        {isComplete ? `${comboTotal} learners` : c.grades.length === 0 ? 'No grades selected' : 'Enrollment needed'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => { setActiveCombinationId(c.id); setMgSubStep('selection'); }}
                                                    className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-black text-sm hover:bg-indigo-100 transition-colors"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => setMgCombinations(prev => prev.filter(x => x.id !== c.id))}
                                                    className="p-2 text-slate-300 hover:text-rose-500 transition-colors rounded-xl hover:bg-rose-50"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <button
                                onClick={() => {
                                    const newId = Date.now();
                                    setMgCombinations(prev => [...prev, { id: newId, grades: [], enrollment: 0 }]);
                                    setActiveCombinationId(newId);
                                    setMgSubStep('selection');
                                }}
                                className="w-full py-5 rounded-[2rem] border-4 border-dashed border-indigo-200 text-indigo-600 font-black text-lg hover:bg-indigo-50 hover:border-indigo-300 transition-all flex items-center justify-center gap-2 mb-8"
                            >
                                + Add Combination
                            </button>

                            {orgType === 'pure_mg' && (
                                <div className="p-6 rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-xl">📋</div>
                                        <div>
                                            <h4 className="text-sm font-black text-slate-700 leading-none">Grade Assignment Tracker</h4>
                                            <p className="text-[10px] font-medium text-slate-500 mt-1 uppercase tracking-widest italic">
                                                Ensure all offered elementary grades are combined.
                                                <span className="text-rose-600 block font-black underline decoration-rose-200 decoration-4">Click DISABLE if a grade level is not offered.</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {availableGrades
                                            .filter(g => g.type === 'elem' && g.id !== 'kinder')
                                            .map(g => {
                                                const isAssigned = mgCombinations.some(c => c.grades.includes(g.id));
                                                const isAvailable = gradeAvailability[g.id] !== false;
                                                return (
                                                    <div
                                                        key={`tracker-${g.id}`}
                                                        className={`px-4 py-2 rounded-xl text-[11px] font-black border-2 transition-all flex items-center gap-2
                                                            ${isAssigned ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                                                              !isAvailable ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-60' :
                                                              'bg-white border-rose-100 text-rose-400'}
                                                        `}
                                                    >
                                                        <span>{isAssigned ? '✅' : !isAvailable ? '🚫' : '⏳'}</span>
                                                        <span>{g.label}</span>
                                                        {!isAssigned && (
                                                            <button
                                                                onClick={() => toggleAvailability(g.id)}
                                                                className={`ml-1 px-2 py-1 rounded-lg text-[8px] font-black transition-all ${isAvailable ? 'bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white' : 'bg-indigo-50 text-indigo-500 hover:bg-indigo-500 hover:text-white'}`}
                                                            >
                                                                {isAvailable ? 'DISABLE' : 'RESTORE'}
                                                            </button>
                                                        )}
                                                        {!isAssigned && isAvailable && (
                                                            <span className="ml-1 px-2 py-0.5 bg-rose-50 text-[9px] rounded-lg border border-rose-100 animate-pulse">Required</span>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        }
                                    </div>
                                    {availableGrades.filter(g => g.type === 'elem' && g.id !== 'kinder' && gradeAvailability[g.id] !== false).some(g => !mgCombinations.some(c => c.grades.includes(g.id))) && (
                                        <div className="mt-6 p-4 bg-amber-50 rounded-2xl border-2 border-amber-100 flex items-start gap-3">
                                            <FiAlertTriangle className="text-amber-500 w-5 h-5 mt-0.5 shrink-0" />
                                            <p className="text-xs font-bold text-amber-800 leading-relaxed">
                                                Because you selected <span className="underline decoration-2 text-amber-900">Purely Multi-Grade</span>, you must assign all offered elementary grades to a combination (or mark them as not offered) before you can continue.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* STEP 3b: Grade Level Selection */}
                    {currentStep === 3 && mgSubStep === 'selection' && (() => {
                        const activeCombo = mgCombinations.find(c => c.id === activeCombinationId);
                        if (!activeCombo) return null;
                        return (
                            <motion.div key="mg-selection" variants={pageVariants} initial="initial" animate="in" exit="out" transition={{ duration: 0.3 }}>
                                <div className="text-center mb-10">
                                    <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-black uppercase tracking-[0.2em] mb-4 shadow-sm">
                                        Step 3 • Grade Selection
                                    </span>
                                    <h1 className="text-4xl font-black text-slate-800 mb-2 leading-tight">
                                        Select Grade Levels
                                    </h1>
                                    <p className="text-slate-500 font-medium">Choose which grades belong in this combination.</p>
                                </div>

                                {activeCombo.grades.length >= 4 && (
                                    <div className="mb-6 p-5 bg-amber-50 border-2 border-amber-200 rounded-[2rem] flex items-start gap-4">
                                        <FiAlertTriangle className="text-amber-500 w-6 h-6 mt-0.5 shrink-0" />
                                        <div>
                                            <p className="text-sm font-black text-amber-900 mb-1 uppercase tracking-widest">Are you sure?</p>
                                            <p className="text-sm font-medium text-amber-800 leading-snug">
                                                Including <strong>4 or more grade levels</strong> in a single combination is unusual and may indicate a data entry error. Please verify before continuing.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-3 mb-8">
                                    {ELEM_GRADES.map(lvl => {
                                        const g = ALL_GRADES.find(x => x.id === lvl);
                                        const isSelected = activeCombo.grades.includes(lvl);
                                        const isLockedByOther = mgCombinations.some(other => other.id !== activeCombinationId && other.grades.includes(lvl));
                                        return (
                                            <button
                                                key={lvl}
                                                disabled={isLockedByOther}
                                                onClick={() => {
                                                    setMgCombinations(prev => prev.map(p => {
                                                        if (p.id !== activeCombinationId) return p;
                                                        const newG = isSelected ? p.grades.filter(x => x !== lvl) : [...p.grades, lvl];
                                                        return { ...p, grades: newG };
                                                    }));
                                                }}
                                                className={`p-6 rounded-[2rem] border-4 transition-all flex flex-col items-center justify-center gap-3 text-center active:scale-95 ${
                                                    isSelected
                                                        ? 'border-indigo-500 bg-indigo-50/50 shadow-xl shadow-indigo-100 scale-[1.02]'
                                                        : isLockedByOther
                                                        ? 'border-slate-100 bg-slate-50 cursor-not-allowed opacity-50'
                                                        : 'border-slate-100 bg-white hover:border-indigo-200'
                                                }`}
                                            >
                                                <span className="text-2xl">{isSelected ? '✅' : isLockedByOther ? '🔒' : '⬜'}</span>
                                                <span className="font-black text-lg text-slate-800">{g?.label}</span>
                                                {isLockedByOther && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">In another combo</span>}
                                            </button>
                                        );
                                    })}
                                </div>

                                <button
                                    disabled={activeCombo.grades.length === 0}
                                    onClick={() => setMgSubStep('population')}
                                    className="w-full py-5 rounded-[2rem] bg-indigo-600 text-white font-black text-lg shadow-xl shadow-indigo-100 active:scale-95 transition-all disabled:opacity-50 disabled:bg-slate-400 disabled:shadow-none flex items-center justify-center gap-2"
                                >
                                    Confirm Grade Selection <FiArrowRight className="w-5 h-5" />
                                </button>
                            </motion.div>
                        );
                    })()}

                    {/* STEP 3c: Population Entry */}
                    {currentStep === 3 && mgSubStep === 'population' && (() => {
                        const activeCombo = mgCombinations.find(c => c.id === activeCombinationId);
                        if (!activeCombo) return null;
                        const comboLabel = activeCombo.grades.map(g => ALL_GRADES.find(x => x.id === g)?.label || g).join(' + ');
                        const isSaveable = activeCombo.grades.length > 0 && activeCombo.grades.every(lvl => {
                            const total = parseInt(gradeTotals[lvl]) || 0;
                            const male = gradeGenderMap[lvl]?.male;
                            const female = gradeGenderMap[lvl]?.female;
                            return total > 0 && male !== undefined && male !== "" && female !== undefined && female !== "";
                        });
                        return (
                            <motion.div key="mg-population" variants={pageVariants} initial="initial" animate="in" exit="out" transition={{ duration: 0.3 }}>
                                <div className="text-center mb-10">
                                    <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-black uppercase tracking-[0.2em] mb-4 shadow-sm">
                                        Step 3 • Population Entry
                                    </span>
                                    <h1 className="text-3xl font-black text-slate-800 mb-2 leading-tight">{comboLabel}</h1>
                                    <p className="text-slate-500 font-medium">Enter Total, Male, and Female counts for each grade.</p>
                                </div>

                                <div className="space-y-6 mb-8">
                                    {activeCombo.grades.map(lvl => {
                                        const gName = ALL_GRADES.find(x => x.id === lvl)?.label || lvl;
                                        return (
                                            <div key={`mg-pop-${lvl}`} className="bg-white p-5 rounded-3xl border-2 border-slate-100 shadow-sm">
                                                <div className="flex justify-between items-center mb-4">
                                                    <label className="text-xs font-black uppercase text-indigo-600 tracking-widest">{gName}</label>
                                                    <span className="bg-indigo-50 px-3 py-1 rounded-lg text-[10px] font-black text-indigo-600 uppercase italic">Entry Required</span>
                                                </div>
                                                <div className="mb-6">
                                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 block mb-2 text-center">Total Enrollment</label>
                                                    <input
                                                        type="number"
                                                        placeholder="0"
                                                        value={gradeTotals[lvl] === "0" ? "" : (gradeTotals[lvl] || "")}
                                                        onChange={(e) => handleGradeChange(lvl, e.target.value)}
                                                        className={chunkyInput + " !h-16 !text-3xl border-indigo-100 focus:border-indigo-500 bg-indigo-50/30"}
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 block mb-2 text-center">Male</label>
                                                        <input
                                                            type="number"
                                                            placeholder="0"
                                                            value={gradeGenderMap[lvl]?.male === "0" ? "" : (gradeGenderMap[lvl]?.male || "")}
                                                            onChange={(e) => handleGradeGenderChange(lvl, gradeTotals[lvl], e.target.value)}
                                                            className={chunkyInput + " !h-14 !text-2xl border-blue-50 focus:border-blue-500"}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-400 block mb-2 text-center">Female</label>
                                                        <input
                                                            type="number"
                                                            placeholder="0"
                                                            value={gradeGenderMap[lvl]?.female === "0" ? "" : (gradeGenderMap[lvl]?.female || "")}
                                                            onChange={(e) => handleFemaleGenderChange(lvl, gradeTotals[lvl], e.target.value)}
                                                            className={chunkyInput + " !h-14 !text-2xl border-rose-50 focus:border-rose-500"}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="flex items-center justify-between bg-slate-900 p-6 rounded-[2rem] text-white shadow-xl mb-8">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-1">Total Combination Enrollment</p>
                                        <span className="text-4xl font-black italic tracking-tighter">
                                            {activeCombo.grades.reduce((sum, g) => {
                                                const m = parseInt(gradeGenderMap[g]?.male) || 0;
                                                const f = parseInt(gradeGenderMap[g]?.female) || 0;
                                                return sum + m + f;
                                            }, 0)}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">M / F Split</p>
                                        <p className="text-lg font-black tracking-tight leading-none">
                                            <span className="text-blue-400">{activeCombo.grades.reduce((sum, g) => sum + (parseInt(gradeGenderMap[g]?.male) || 0), 0)}</span>
                                            <span className="text-slate-500 mx-2">/</span>
                                            <span className="text-rose-400">{activeCombo.grades.reduce((sum, g) => sum + (parseInt(gradeGenderMap[g]?.female) || 0), 0)}</span>
                                        </p>
                                    </div>
                                </div>

                                <button
                                    disabled={!isSaveable}
                                    onClick={() => { setMgSubStep('manager'); setActiveCombinationId(null); }}
                                    className="w-full py-5 rounded-[2rem] bg-emerald-600 text-white font-black text-lg shadow-xl shadow-emerald-100 active:scale-95 transition-all disabled:opacity-50 disabled:bg-slate-400 disabled:shadow-none flex items-center justify-center gap-2"
                                >
                                    <FiCheck className="w-5 h-5" /> Save Combination
                                </button>
                            </motion.div>
                        );
                    })()}

                    {/* STEP 4: Grade-by-Grade Enrollment */}
                    {currentStep === 4 && activeMonogrades[currentGradeIndex] && (
                        <motion.div key={`grade-${activeMonogrades[currentGradeIndex].id}`} variants={pageVariants} initial="initial" animate="in" exit="out" transition={{ duration: 0.3 }}>
                            {(() => {
                                const g = activeMonogrades[currentGradeIndex];
                                const isAvailable = gradeAvailability[g.id] !== false;
                                return (
                                    <div className="space-y-6">
                                        <div className="text-center mb-10">
                                            <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-black uppercase tracking-[0.2em] mb-4 shadow-sm">
                                                Step 4 • Standalone Grades
                                            </span>
                                            <h1 className="text-5xl font-black text-slate-800 mb-2 leading-tight">
                                                {g.label}
                                            </h1>
                                            <p className="text-slate-500 font-medium">Define availability and total enrollment for this grade.</p>
                                        </div>

                                        <div className={`bg-white rounded-[2.5rem] p-8 shadow-xl border-4 transition-all duration-500 ${isAvailable ? 'border-indigo-100/50 scale-100' : 'border-slate-100 grayscale scale-[0.98]'}`}>
                                            <div className="flex flex-col items-center gap-6">
                                                
                                                {/* Master Switch Panel */}
                                                <div className="w-full flex items-center justify-between p-4 bg-slate-50/50 rounded-3xl border-2 border-slate-100/50">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Status</span>
                                                        <span className={`text-xl font-bold ${isAvailable ? 'text-emerald-600' : 'text-slate-500'}`}>
                                                            {isAvailable ? "Active Session" : "Not Offered"}
                                                        </span>
                                                    </div>
                                                    <button 
                                                        onClick={() => toggleAvailability(g.id)}
                                                        className={`px-8 py-4 rounded-2xl font-black text-sm transition-all shadow-md active:scale-95 ${isAvailable ? 'bg-white text-rose-500 border-2 border-rose-100 hover:bg-rose-50' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                                                    >
                                                        {isAvailable ? "Disable Grade" : "Enable Grade"}
                                                    </button>
                                                </div>

                                                {/* Input Field Panel */}
                                                <div className="w-full relative py-4">
                                                    <div className="flex flex-col items-center">
                                                        <label className={`text-sm font-black uppercase tracking-[0.2em] mb-4 ${isAvailable ? 'text-indigo-400' : 'text-slate-300'}`}>
                                                            Learner Count
                                                        </label>
                                                        <div className="relative group">
                                                            <input 
                                                                type="number"
                                                                min="0"
                                                                placeholder="0"
                                                                disabled={!isAvailable}
                                                                value={gradeTotals[g.id] === "0" ? "" : (gradeTotals[g.id] || "")}
                                                                onChange={(e) => handleGradeChange(g.id, e.target.value)}
                                                                className={`w-64 h-32 text-7xl font-black text-center rounded-[2rem] transition-all duration-300 ${isAvailable ? 'bg-indigo-50 border-4 border-indigo-200 text-indigo-700 focus:bg-white focus:border-indigo-500 shadow-xl shadow-indigo-100/50' : 'bg-slate-50 border-2 border-slate-100 text-slate-300'}`}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {isAvailable && (
                                                    <div className="w-full mt-8 pt-8 border-t-2 border-slate-50 grid grid-cols-2 gap-6">
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 block mb-2 text-center">Male</label>
                                                            <input 
                                                                type="number"
                                                                value={gradeGenderMap[g.id]?.male === "0" ? "" : (gradeGenderMap[g.id]?.male || "")}
                                                                onChange={(e) => handleGradeGenderChange(g.id, gradeTotals[g.id], e.target.value)}
                                                                placeholder="0"
                                                                className={chunkyInput + " !text-3xl text-center border-blue-100 focus:border-blue-500"}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-400 block mb-2 text-center">Female</label>
                                                            <input 
                                                                type="number"
                                                                value={gradeGenderMap[g.id]?.female === "0" ? "" : (gradeGenderMap[g.id]?.female || "")}
                                                                onChange={(e) => handleFemaleGenderChange(g.id, gradeTotals[g.id], e.target.value)}
                                                                placeholder="0"
                                                                className={chunkyInput + " !text-3xl text-center border-rose-100 focus:border-rose-500"}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="bg-slate-800 rounded-[2rem] p-6 shadow-lg flex justify-between items-center text-white">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cumulative Enrollment</span>
                                                <span className="text-3xl font-black">{grandTotal}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </motion.div>
                    )}

                    {/* STEP 5: Special Learners */}
                    {currentStep === 5 && (
                        <motion.div key="step5" variants={pageVariants} initial="initial" animate="in" exit="out" transition={{ duration: 0.3 }}>
                            <div className="text-center mb-10 relative">
                                <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-100 text-indigo-500 rounded-2xl text-2xl mb-4 shadow-sm border border-indigo-200">🌟</div>
                                <h1 className="text-4xl font-black text-slate-800 mb-3 tracking-tight">Step 5: Special Learners</h1>
                                <p className="text-slate-500 font-medium px-4">Do you have learners enrolled in specific special programs outside of the standard grade levels?</p>
                            </div>

                            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-4 border-indigo-100/50 relative overflow-hidden">
                                {/* Language Toggle */}
                                <div className="absolute top-6 right-8 flex bg-slate-100 p-1 rounded-xl">
                                    <button 
                                        onClick={() => setSnedLanguage("en")}
                                        className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${snedLanguage === "en" ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}
                                    >
                                        EN
                                    </button>
                                    <button 
                                        onClick={() => setSnedLanguage("ph")}
                                        className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${snedLanguage === "ph" ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}
                                    >
                                        PH
                                    </button>
                                </div>

                                <div className="mb-8 pr-16">
                                    <h3 className="text-xl font-black text-slate-800 leading-tight">
                                        {snedLanguage === "en" 
                                            ? "Do you have Special Needs Education Learners?" 
                                            : "Mayroon ba kayong Special Needs Education Learners?"
                                        }
                                    </h3>
                                </div>

                                <div className="flex gap-4 mb-8">
                                    <button 
                                        onClick={() => setHasSNED(true)}
                                        className={`flex-1 flex flex-col items-center gap-2 p-6 rounded-[2rem] border-4 transition-all ${hasSNED === true ? 'bg-indigo-50 border-indigo-500 shadow-lg shadow-indigo-100' : 'bg-white border-slate-100 grayscale opacity-40 hover:opacity-100 hover:grayscale-0'}`}
                                    >
                                        <span className="text-3xl">🙋‍♂️</span>
                                        <span className={`font-black uppercase tracking-widest text-xs ${hasSNED === true ? 'text-indigo-600' : 'text-slate-400'}`}>Yes, we have</span>
                                    </button>
                                    <button 
                                        onClick={() => { 
                                            setHasSNED(false); 
                                            setSnedTotalCount(""); 
                                            setSnedProgramType(null); 
                                            setSnedOrganizedClassCount(""); 
                                        }}
                                        className={`flex-1 flex flex-col items-center gap-2 p-6 rounded-[2rem] border-4 transition-all ${hasSNED === false ? 'bg-indigo-50 border-indigo-500 shadow-lg shadow-indigo-100' : 'bg-white border-slate-100 grayscale opacity-40 hover:opacity-100 hover:grayscale-0'}`}
                                    >
                                        <span className="text-3xl">✕</span>
                                        <span className={`font-black uppercase tracking-widest text-xs ${hasSNED === false ? 'text-indigo-600' : 'text-slate-400'}`}>No, none</span>
                                    </button>
                                </div>

                                <AnimatePresence>
                                    {hasSNED === true && (
                                        <motion.div 
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="space-y-12 pt-8 border-t-2 border-indigo-50"
                                        >
                                            {/* 1. Mainstreamed Section */}
                                            <div className="bg-blue-50/30 rounded-3xl p-6 border-2 border-blue-100/50">
                                                <div className="flex items-center gap-3 mb-6">
                                                    <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center text-xl shadow-sm">🤝</div>
                                                    <div>
                                                        <h4 className="text-lg font-black text-slate-800 leading-none">Mainstreamed SNED</h4>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Learners integrated in regular classes</p>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col items-center mb-8">
                                                    <label className="text-[10px] font-black uppercase text-blue-400 tracking-[0.2em] mb-3">Total Integrated</label>
                                                    <input 
                                                        type="number" 
                                                        placeholder="0" 
                                                        value={snedMainstreamedCount === "0" ? "" : (snedMainstreamedCount || "")} 
                                                        onChange={(e) => handleSnedCountChange('mainstreamed', e.target.value)}
                                                        className={`w-40 h-20 text-4xl font-black text-center rounded-2xl transition-all duration-300 bg-white border-2 border-blue-100 text-blue-700 focus:border-blue-500 shadow-sm`}
                                                    />
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400/70 block mb-2 text-center">Male</label>
                                                        <input 
                                                            type="number"
                                                            value={gradeGenderMap['sned_mainstreamed']?.male === "0" ? "" : (gradeGenderMap['sned_mainstreamed']?.male || "")}
                                                            onChange={(e) => handleGradeGenderChange('sned_mainstreamed', snedMainstreamedCount, e.target.value)}
                                                            placeholder="0"
                                                            className={chunkyInput + " !text-xl !h-12 !p-0 !mt-0 border-blue-50 focus:border-blue-500 bg-white"}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-400/70 block mb-2 text-center">Female</label>
                                                        <input 
                                                            type="number"
                                                            value={gradeGenderMap['sned_mainstreamed']?.female === "0" ? "" : (gradeGenderMap['sned_mainstreamed']?.female || "")}
                                                            onChange={(e) => handleFemaleGenderChange('sned_mainstreamed', snedMainstreamedCount, e.target.value)}
                                                            placeholder="0"
                                                            className={chunkyInput + " !text-xl !h-12 !p-0 !mt-0 border-rose-50 focus:border-rose-500 bg-white"}
                                                        />
                                                    </div>
                                                </div>
                                                <p className="text-[9px] text-slate-400 text-center mt-4 italic font-medium">Note: Mainstreamed learners are already counted in their respective grade levels and will not be added to the grand total.</p>
                                            </div>

                                            {/* 2. Self-Contained Section */}
                                            <div className="bg-indigo-50/30 rounded-3xl p-6 border-2 border-indigo-100/50">
                                                <div className="flex items-center gap-3 mb-6">
                                                    <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center text-xl shadow-sm">🏫</div>
                                                    <div>
                                                        <h4 className="text-lg font-black text-slate-800 leading-none">Self-Contained SNED</h4>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Learners in specialized classes</p>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col items-center mb-8">
                                                    <label className="text-[10px] font-black uppercase text-indigo-400 tracking-[0.2em] mb-3">Total Enrollment</label>
                                                    <input 
                                                        type="number" 
                                                        placeholder="0" 
                                                        value={snedSelfContainedCount === "0" ? "" : (snedSelfContainedCount || "")} 
                                                        onChange={(e) => handleSnedCountChange('self_contained', e.target.value)}
                                                        className={`w-40 h-20 text-4xl font-black text-center rounded-2xl transition-all duration-300 bg-white border-2 border-indigo-100 text-indigo-700 focus:border-indigo-500 shadow-sm`}
                                                    />
                                                </div>

                                                <div className="grid grid-cols-2 gap-4 mb-8">
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400/70 block mb-2 text-center">Male</label>
                                                        <input 
                                                            type="number"
                                                            value={gradeGenderMap['sned_self_contained']?.male === "0" ? "" : (gradeGenderMap['sned_self_contained']?.male || "")}
                                                            onChange={(e) => handleGradeGenderChange('sned_self_contained', snedSelfContainedCount, e.target.value)}
                                                            placeholder="0"
                                                            className={chunkyInput + " !text-xl !h-12 !p-0 !mt-0 border-blue-50 focus:border-blue-500 bg-white"}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-400/70 block mb-2 text-center">Female</label>
                                                        <input 
                                                            type="number"
                                                            value={gradeGenderMap['sned_self_contained']?.female === "0" ? "" : (gradeGenderMap['sned_self_contained']?.female || "")}
                                                            onChange={(e) => handleFemaleGenderChange('sned_self_contained', snedSelfContainedCount, e.target.value)}
                                                            placeholder="0"
                                                            className={chunkyInput + " !text-xl !h-12 !p-0 !mt-0 border-rose-50 focus:border-rose-500 bg-white"}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Organized Class Input */}
                                                {(parseInt(snedSelfContainedCount) > 0) && (
                                                    <motion.div 
                                                        initial={{ opacity: 0, scale: 0.9 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        className="flex flex-col items-center p-6 bg-white rounded-2xl border-2 border-dashed border-indigo-100"
                                                    >
                                                        <label className="text-[10px] font-black uppercase text-indigo-500 tracking-widest mb-3 text-center">
                                                            {snedLanguage === "en" ? "Number of Organized Classes" : "Ilan ang Organized Class?"}
                                                        </label>
                                                        <input 
                                                            type="number" 
                                                            placeholder="0" 
                                                            value={snedOrganizedClassCount} 
                                                            onChange={(e) => setSnedOrganizedClassCount(sanitizeNumeric(e.target.value, 2))} 
                                                            className="w-24 h-12 text-2xl font-black text-center rounded-xl bg-indigo-50 border-2 border-indigo-100 text-indigo-600 outline-none focus:border-indigo-500"
                                                        />
                                                    </motion.div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 6: ARAL Program (Elementary Only) */}
                    {currentStep === 6 && (
                        <motion.div key="step6" variants={pageVariants} initial="initial" animate="in" exit="out" transition={{ duration: 0.3 }}>
                            <div className="text-center mb-8">
                                <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-100 text-indigo-500 rounded-2xl text-2xl mb-4">📚</div>
                                <h1 className="text-3xl font-black text-slate-800 mb-3">Step 6: ARAL Program</h1>
                                <p className="text-slate-500 font-medium">Record learners under the Academic Recovery and Acceleration Program (G1-G6).</p>
                            </div>

                            <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl border-4 border-indigo-100/50 mb-8">
                                <div className="space-y-6">
                                    {/* Math */}
                                    <div className="bg-slate-50 rounded-3xl p-6 border-2 border-slate-100 mb-6">
                                        <h3 className="text-lg font-bold text-slate-700 mb-4">Do you have ARAL Learners in Mathematics?</h3>
                                        <div className="flex gap-3 mb-4">
                                            <button onClick={() => setHasAralMath(true)} className={`${toggleBtnBase} ${hasAralMath === true ? toggleBtnActive : toggleBtnInactive}`}>Yes</button>
                                            <button onClick={() => { setHasAralMath(false); setAralMath({}); }} className={`${toggleBtnBase} ${hasAralMath === false ? toggleBtnActive : toggleBtnInactive}`}>No</button>
                                        </div>
                                        <AnimatePresence>
                                            {hasAralMath && (
                                                <motion.div variants={expandVariants} initial="hidden" animate="visible" exit="hidden" className="grid grid-cols-2 gap-3 mt-4">
                                                    {ELEM_GRADES.map(lvl => {
                                                        const isAvailable = gradeAvailability[lvl] !== false;
                                                        const capacity = gradeCapacities[lvl] || 0;
                                                        const currentVal = parseInt(aralMath[lvl]) || 0;
                                                        const isExceeded = currentVal > capacity;

                                                        return (
                                                            <div key={lvl} className={!isAvailable ? 'opacity-40 grayscale' : ''}>
                                                                <p className="text-[10px] font-bold text-slate-400 uppercase text-center mb-1">Grade {lvl.replace('g','')}</p>
                                                                <input 
                                                                    type="number" 
                                                                    min="0" 
                                                                    max={capacity}
                                                                    placeholder="0" 
                                                                    disabled={!isAvailable}
                                                                    value={aralMath[lvl] || ""} 
                                                                    onChange={(e) => handleAralChange('math', lvl, e.target.value)} 
                                                                    className={`${chunkyInput} !p-3 !text-lg !mt-0 ${isExceeded ? 'border-red-500 bg-red-50 text-red-600' : ''}`} 
                                                                />
                                                                {isAvailable && (
                                                                    <p className={`text-[9px] font-black text-center mt-1 uppercase tracking-tighter ${isExceeded ? 'text-red-500' : 'text-slate-400'}`}>
                                                                        Max: {capacity}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    {/* Reading */}
                                    <div className="bg-slate-50 rounded-3xl p-6 border-2 border-slate-100 mb-6">
                                        <h3 className="text-lg font-bold text-slate-700 mb-4">Do you have ARAL Learners in Reading?</h3>
                                        <div className="flex gap-3 mb-4">
                                            <button onClick={() => setHasAralReading(true)} className={`${toggleBtnBase} ${hasAralReading === true ? toggleBtnActive : toggleBtnInactive}`}>Yes</button>
                                            <button onClick={() => { setHasAralReading(false); setAralReading({}); }} className={`${toggleBtnBase} ${hasAralReading === false ? toggleBtnActive : toggleBtnInactive}`}>No</button>
                                        </div>
                                        <AnimatePresence>
                                            {hasAralReading && (
                                                <motion.div variants={expandVariants} initial="hidden" animate="visible" exit="hidden" className="grid grid-cols-2 gap-3 mt-4">
                                                    {ELEM_GRADES.map(lvl => {
                                                        const isAvailable = gradeAvailability[lvl] !== false;
                                                        const capacity = gradeCapacities[lvl] || 0;
                                                        const currentVal = parseInt(aralReading[lvl]) || 0;
                                                        const isExceeded = currentVal > capacity;

                                                        return (
                                                            <div key={lvl} className={!isAvailable ? 'opacity-40 grayscale' : ''}>
                                                                <p className="text-[10px] font-bold text-slate-400 uppercase text-center mb-1">Grade {lvl.replace('g','')}</p>
                                                                <input 
                                                                    type="number" 
                                                                    min="0" 
                                                                    max={capacity}
                                                                    placeholder="0" 
                                                                    disabled={!isAvailable}
                                                                    value={aralReading[lvl] || ""} 
                                                                    onChange={(e) => handleAralChange('reading', lvl, e.target.value)} 
                                                                    className={`${chunkyInput} !p-3 !text-lg !mt-0 ${isExceeded ? 'border-red-500 bg-red-50 text-red-600' : ''}`} 
                                                                />
                                                                {isAvailable && (
                                                                    <p className={`text-[9px] font-black text-center mt-1 uppercase tracking-tighter ${isExceeded ? 'text-red-500' : 'text-slate-400'}`}>
                                                                        Max: {capacity}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    {/* Science */}
                                    <div className="bg-slate-50 rounded-3xl p-6 border-2 border-slate-100 mb-4">
                                        <h3 className="text-lg font-bold text-slate-700 mb-4">Do you have ARAL Learners in Science?</h3>
                                        <div className="flex gap-3 mb-4">
                                            <button onClick={() => setHasAralScience(true)} className={`${toggleBtnBase} ${hasAralScience === true ? toggleBtnActive : toggleBtnInactive}`}>Yes</button>
                                            <button onClick={() => { setHasAralScience(false); setAralScience({}); }} className={`${toggleBtnBase} ${hasAralScience === false ? toggleBtnActive : toggleBtnInactive}`}>No</button>
                                        </div>
                                        <AnimatePresence>
                                            {hasAralScience && (
                                                <motion.div variants={expandVariants} initial="hidden" animate="visible" exit="hidden" className="grid grid-cols-2 gap-3 mt-4">
                                                    {ELEM_GRADES.map(lvl => {
                                                        const isAvailable = gradeAvailability[lvl] !== false;
                                                        const capacity = gradeCapacities[lvl] || 0;
                                                        const currentVal = parseInt(aralScience[lvl]) || 0;
                                                        const isExceeded = currentVal > capacity;

                                                        return (
                                                            <div key={lvl} className={!isAvailable ? 'opacity-40 grayscale' : ''}>
                                                                <p className="text-[10px] font-bold text-slate-400 uppercase text-center mb-1">Grade {lvl.replace('g','')}</p>
                                                                <input 
                                                                    type="number" 
                                                                    min="0" 
                                                                    max={capacity}
                                                                    placeholder="0" 
                                                                    disabled={!isAvailable}
                                                                    value={aralScience[lvl] || ""} 
                                                                    onChange={(e) => handleAralChange('science', lvl, e.target.value)} 
                                                                    className={`${chunkyInput} !p-3 !text-lg !mt-0 ${isExceeded ? 'border-red-500 bg-red-50 text-red-600' : ''}`} 
                                                                />
                                                                {isAvailable && (
                                                                    <p className={`text-[9px] font-black text-center mt-1 uppercase tracking-tighter ${isExceeded ? 'text-red-500' : 'text-slate-400'}`}>
                                                                        Max: {capacity}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 7: Gender Breakdown Confirmation Table */}
                    {currentStep === 7 && (
                        <motion.div key="step7" variants={pageVariants} initial="initial" animate="in" exit="out" transition={{ duration: 0.3 }}>
                            <div className="text-center mb-10">
                                <span className="inline-block px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black uppercase tracking-[0.2em] mb-4 shadow-sm">
                                    Step 7 • Final Confirmation
                                </span>
                                <h1 className="text-4xl font-black text-slate-800 mb-2 leading-tight">
                                    Learner Data Summary
                                </h1>
                                <p className="text-slate-500 font-medium italic">Please review and confirm your school's gender breakdown before saving.</p>
                            </div>

                            <div className="bg-white rounded-[3rem] shadow-2xl border-4 border-indigo-100/50 overflow-hidden mb-8">
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b-2 border-slate-100">
                                                <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Grade Level / Combo</th>
                                                <th className="px-6 py-5 text-center text-[10px] font-black uppercase tracking-widest text-blue-500">Male 👦</th>
                                                <th className="px-6 py-5 text-center text-[10px] font-black uppercase tracking-widest text-rose-500">Female 👧</th>
                                                <th className="px-6 py-5 text-center text-[10px] font-black uppercase tracking-widest text-indigo-500">Total Σ</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {/* Kindergarten */}
                                            {hasKinder && gradeAvailability.kinder !== false && (
                                                <tr className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-6 py-5">
                                                        <span className="text-sm font-black text-slate-700">Kindergarten</span>
                                                    </td>
                                                    <td className="px-6 py-5 text-center font-bold text-blue-600">{gradeGenderMap['kinder']?.male || 0}</td>
                                                    <td className="px-6 py-5 text-center font-bold text-rose-600">{gradeGenderMap['kinder']?.female || 0}</td>
                                                    <td className="px-6 py-5 text-center font-black text-slate-800 bg-indigo-50/30">{(parseInt(gradeGenderMap['kinder']?.male) || 0) + (parseInt(gradeGenderMap['kinder']?.female) || 0)}</td>
                                                </tr>
                                            )}

                                            {/* Multigrade Combinations */}
                                            {mgCombinations.map(c => {
                                                const mgMale = c.grades.reduce((sum, lvl) => sum + (parseInt(gradeGenderMap[lvl]?.male) || 0), 0);
                                                const mgFemale = c.grades.reduce((sum, lvl) => sum + (parseInt(gradeGenderMap[lvl]?.female) || 0), 0);
                                                return (
                                                    <tr key={`summary-${c.id}`} className="hover:bg-slate-50/50 transition-colors border-l-4 border-l-indigo-500">
                                                        <td className="px-6 py-5">
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-black text-slate-700">Combination {c.grades.map(g => g.replace('g','')).join('-')}</span>
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase">Multigrade</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-5 text-center font-bold text-blue-600">{mgMale}</td>
                                                        <td className="px-6 py-5 text-center font-bold text-rose-600">{mgFemale}</td>
                                                        <td className="px-6 py-5 text-center font-black text-slate-800 bg-indigo-50/30">{mgMale + mgFemale}</td>
                                                    </tr>
                                                );
                                            })}

                                            {/* Standalone Monogrades */}
                                            {activeMonogrades.map(g => (
                                                <tr key={`summary-${g.id}`} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-6 py-5">
                                                        <span className="text-sm font-black text-slate-700">{g.label}</span>
                                                    </td>
                                                    <td className="px-6 py-5 text-center font-bold text-blue-600">{gradeGenderMap[g.id]?.male || 0}</td>
                                                    <td className="px-6 py-5 text-center font-bold text-rose-600">{gradeGenderMap[g.id]?.female || 0}</td>
                                                    <td className="px-6 py-5 text-center font-black text-slate-800 bg-indigo-50/30">{(parseInt(gradeGenderMap[g.id]?.male) || 0) + (parseInt(gradeGenderMap[g.id]?.female) || 0)}</td>
                                                </tr>
                                            ))}

                                            {/* SNED Mainstreamed */}
                                            {hasSNED && parseInt(snedMainstreamedCount) > 0 && (
                                                <tr className="hover:bg-slate-50/50 transition-colors border-l-4 border-l-blue-400">
                                                    <td className="px-6 py-5">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-black text-blue-700">SNED Mainstreamed</span>
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase italic">Excluded from Total Enrollment</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5 text-center font-bold text-blue-600">{gradeGenderMap['sned_mainstreamed']?.male || 0}</td>
                                                    <td className="px-6 py-5 text-center font-bold text-rose-600">{gradeGenderMap['sned_mainstreamed']?.female || 0}</td>
                                                    <td className="px-6 py-5 text-center font-black text-slate-400 bg-slate-50/30 line-through decoration-red-500/50">{snedMainstreamedCount || 0}</td>
                                                </tr>
                                            )}

                                            {/* SNED Self-Contained */}
                                            {hasSNED && parseInt(snedSelfContainedCount) > 0 && (
                                                <tr className="hover:bg-slate-50/50 transition-colors border-l-4 border-l-indigo-500">
                                                    <td className="px-6 py-5">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-black text-indigo-700">SNED Self-Contained</span>
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase italic">Included in Total Enrollment</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5 text-center font-bold text-blue-600">{gradeGenderMap['sned_self_contained']?.male || 0}</td>
                                                    <td className="px-6 py-5 text-center font-bold text-rose-600">{gradeGenderMap['sned_self_contained']?.female || 0}</td>
                                                    <td className="px-6 py-5 text-center font-black text-slate-800 bg-indigo-50/30">{(parseInt(gradeGenderMap['sned_self_contained']?.male) || 0) + (parseInt(gradeGenderMap['sned_self_contained']?.female) || 0)}</td>
                                                </tr>
                                            )}

                                            {/* Grand Total Row */}
                                            <tr className="bg-slate-900 text-white">
                                                <td className="px-6 py-6 text-sm font-black uppercase tracking-widest">Grand Total Learners</td>
                                                <td className="px-6 py-6 text-center text-xl font-black text-blue-300">
                                                    {[
                                                        (hasKinder ? (parseInt(gradeGenderMap['kinder']?.male) || 0) : 0),
                                                        ...mgCombinations.flatMap(c => c.grades.map(lvl => parseInt(gradeGenderMap[lvl]?.male) || 0)),
                                                        ...activeMonogrades.map(g => parseInt(gradeGenderMap[g.id]?.male) || 0),
                                                        (hasSNED) ? (parseInt(gradeGenderMap['sned_self_contained']?.male) || 0) : 0
                                                    ].reduce((a, b) => a + b, 0)}
                                                </td>
                                                <td className="px-6 py-6 text-center text-xl font-black text-rose-300">
                                                    {[
                                                        (hasKinder ? (parseInt(gradeGenderMap['kinder']?.female) || 0) : 0),
                                                        ...mgCombinations.flatMap(c => c.grades.map(lvl => parseInt(gradeGenderMap[lvl]?.female) || 0)),
                                                        ...activeMonogrades.map(g => parseInt(gradeGenderMap[g.id]?.female) || 0),
                                                        (hasSNED) ? (parseInt(gradeGenderMap['sned_self_contained']?.female) || 0) : 0
                                                    ].reduce((a, b) => a + b, 0)}
                                                </td>
                                                <td className="px-6 py-6 text-center text-3xl font-black text-indigo-400">
                                                    {grandTotal}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            
                            {/* Final Certification */}
                            <div 
                                onClick={() => setIsCertified(!isCertified)}
                                className={`p-8 rounded-[2.5rem] mt-8 mb-4 border-4 transition-all duration-300 flex items-start gap-6 cursor-pointer ${isCertified ? 'bg-emerald-50 border-emerald-500 shadow-xl shadow-emerald-100' : 'bg-white border-slate-100 opacity-60'}`}
                            >
                                <div className={`w-8 h-8 rounded-xl flex-none flex items-center justify-center transition-all ${isCertified ? 'bg-emerald-500 text-white' : 'border-2 border-slate-200'}`}>
                                    {isCertified && <FiCheck className="w-5 h-5" />}
                                </div>
                                <div>
                                    <p className="text-sm font-black text-slate-800 leading-snug">
                                        I hereby certify that the learner counts and gender breakdown provided are accurate and based on our school's current official enrollment records.
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 italic">Official Certification for SY 2025-2026</p>
                                </div>
                            </div>

                        </motion.div>
                    )}
                </AnimatePresence>
            </>
        )}
    </main>

            <SuccessModal isOpen={showSuccess} onClose={() => setShowSuccess(false)} message="Smart Enrollment Sync Saved! Your learner counts are locked in." redirectUrl="/modular-dashboard" />

            {/* Sticky Navigation Footer */}
            {!effectiveReadOnly && (
                <div className="fixed bottom-0 left-0 w-full p-6 bg-white/80 backdrop-blur-xl border-t border-gray-100 z-50">
                    <div className="max-w-md mx-auto flex gap-3">
                        {currentStep === 1 ? (
                            <button onClick={() => setShowDraftModal(true)} className="flex-none h-16 px-6 rounded-3xl bg-blue-50 border-2 border-blue-100 flex items-center justify-center gap-2 text-blue-500 hover:text-blue-700 active:scale-95 transition-all outline-none">
                                <FiSave className="w-6 h-6" />
                                <span className="text-sm font-bold text-blue-500">Save Draft</span>
                            </button>
                        ) : (
                            <>
                                <button onClick={handleBack} className="w-16 h-16 rounded-3xl bg-slate-50 border-2 border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 active:scale-95 transition-all outline-none shrink-0">
                                    <FiArrowLeft className="w-6 h-6" />
                                </button>
                                <button onClick={() => setShowDraftModal(true)} className="flex-none h-16 px-6 rounded-3xl bg-blue-50 border-2 border-blue-100 flex items-center justify-center gap-2 text-blue-500 hover:text-blue-700 active:scale-95 transition-all outline-none shrink-0">
                                    <FiSave className="w-6 h-6" />
                                    <span className="text-sm font-bold text-blue-500">Save Draft</span>
                                </button>
                            </>
                        )}
                        {!(currentStep === 3 && mgSubStep !== 'manager') && (
                            <button
                                onClick={currentStep === 7 ? handleSave : handleNext}
                                disabled={!canContinue || (currentStep === 7 && (isSaving || !isCertified))}
                                className={`flex-1 h-16 rounded-3xl text-white font-black text-lg shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-45 border-b-[6px] active:border-b-0 active:translate-y-[6px]
                                    ${currentStep === 7 ? 'bg-emerald-600 border-emerald-800 shadow-emerald-100' : 'bg-indigo-600 border-indigo-800 shadow-indigo-100'}`}
                            >
                                {currentStep === 7 ? (
                                    isSaving ? (
                                        <>
                                            <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Saving Profile...</span>
                                        </>
                                    ) : (
                                        <span className="flex items-center justify-center gap-2">
                                            SUBMIT ENTRY <FiCheckCircle className="w-5 h-5" />
                                        </span>
                                    )
                                ) : (
                                    <span>Next Step &gt;</span>
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
                {showOfflineSuccess && (
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[100] flex items-end justify-center">
                        <motion.div initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="bg-white w-full rounded-t-[3rem] p-10 pb-12 shadow-2xl relative">
                            <div className="w-16 h-1.5 bg-gray-200 rounded-full mx-auto mb-8" />
                            <div className="w-20 h-20 bg-amber-500 rounded-full mx-auto flex items-center justify-center text-3xl shadow-2xl shadow-amber-200 mb-6 font-bold text-white">
                                <FiWifiOff />
                            </div>
                            <h2 className="text-2xl font-black text-gray-900 text-center leading-tight px-4">Local Secure: Unit 2 Saved!</h2>
                            <p className="text-gray-500 text-center font-medium mt-3 px-6">Your Learner Profile has been saved to the <strong>Sync Center</strong>. We will automatically update your school's official registry once your internet is restored.</p>
                            
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
            <SuccessModal 
                isOpen={showSuccess} 
                onClose={() => setShowSuccess(false)} 
                message="School learners profile has been successfully saved to the cloud registry! ✓" 
                redirectUrl="/modular-dashboard" 
            />

            {/* Fixed bottom Unlock button for Read-Only Summary Mode */}
            {(!propReadOnly && isReadOnly) && (
                <div className="fixed bottom-0 left-0 w-full p-6 pb-10 bg-white/80 backdrop-blur-md border-t border-slate-100 flex justify-center z-[60]">
                    <div className="w-full max-w-sm flex gap-3 pointer-events-auto">
                        <button
                            onClick={() => { 
                                setIsReadOnly(false); 
                                setHasSubmitted(false); 
                                // Route to the correct starting step for this school's grade profile
                                if (hasKinder) {
                                    setCurrentStep(1);           // Kinder schools → Step 1
                                } else if (hasElementary) {
                                    setCurrentStep(2);           // Elementary (no Kinder) → Org Gatekeeper
                                } else {
                                    setCurrentStep(4);           // JHS/SHS only → Grade-by-Grade ACG
                                }
                            }}
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

export default Unit2Learners;
