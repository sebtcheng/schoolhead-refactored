import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FiCopy, FiX, FiCheck, FiInfo, FiMapPin, FiUser, FiUsers, 
  FiLayers, FiAlertTriangle, FiBookOpen, FiActivity, FiClock,
  FiZap, FiDroplet, FiHardDrive, FiHome, FiShield, FiWifi, FiPhone, FiMonitor
} from "react-icons/fi";

export const HistoricalDataModal = ({ show, onClose, loading, data, unitKey, onCopy, title = "Previous Year Data" }) => {
  
  // Clean text helper for boolean/binary database fields
  const renderYesNo = (val) => {
    if (val === 1 || val === "yes" || val === true) {
      return <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full text-xs font-bold"><FiCheck className="w-3.5 h-3.5" /> Yes</span>;
    }
    if (val === 0 || val === "no" || val === false) {
      return <span className="inline-flex items-center gap-1 text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full text-xs font-bold"><FiX className="w-3.5 h-3.5" /> No</span>;
    }
    return <span className="inline-flex items-center gap-1 text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full text-xs font-bold"><FiInfo className="w-3.5 h-3.5" /> N/A</span>;
  };

  const getCleanVal = (val, fallback = "—") => {
    if (val === null || val === undefined || val === "") return fallback;
    return val.toString();
  };

  // --- UNIT 1: SCHOOL IDENTITY ---
  const renderUnit1 = (d) => {
    return (
      <div className="space-y-6">
        <div>
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
            <FiHome className="text-indigo-500" /> Basic Registry
          </h4>
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">IERN</p>
              <p className="font-bold text-slate-800 text-sm">{getCleanVal(d.iern)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">School Name</p>
              <p className="font-bold text-slate-800 text-sm">{getCleanVal(d.school_name)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">School Type</p>
              <p className="font-bold text-slate-800 text-sm">{getCleanVal(d.school_type)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Curricular Offering</p>
              <p className="font-bold text-slate-800 text-sm">{getCleanVal(d.curricular_offering)}</p>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
            <FiMapPin className="text-indigo-500" /> Location Profile
          </h4>
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Region / Province</p>
              <p className="font-bold text-slate-800 text-sm">{getCleanVal(d.region)} / {getCleanVal(d.province)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Municipality / Barangay</p>
              <p className="font-bold text-slate-800 text-sm">{getCleanVal(d.municipality)} / {getCleanVal(d.barangay)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Division / District</p>
              <p className="font-bold text-slate-800 text-sm">{getCleanVal(d.division)} / {getCleanVal(d.district)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Coordinates</p>
              <p className="font-bold text-slate-600 text-xs mt-1">Lat: {getCleanVal(d.latitude)}<br />Lng: {getCleanVal(d.longitude)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
              <FiUser className="text-indigo-500" /> Administration
            </h4>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">School Head</p>
                <p className="font-bold text-slate-800 text-sm">{getCleanVal(d.school_head)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Contact Number</p>
                <p className="font-bold text-slate-800 text-sm">{getCleanVal(d.contact_number)}</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
              <FiShield className="text-indigo-500" /> Legal Status
            </h4>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Ownership Type</p>
                <p className="font-bold text-slate-800 text-sm">{getCleanVal(d.ownership)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Document Proof</p>
                <p className="font-bold text-slate-800 text-sm">{getCleanVal(d.ownership_document_type)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- UNIT 2: LEARNERS ---
  const renderUnit2 = (d) => {
    // Generate Grade List
    const grades = [];
    if (d.enroll_kinder !== undefined) grades.push({ label: "Kinder", total: d.enroll_kinder, m: d.kinder_male, f: d.kinder_female });
    for (let g = 1; g <= 12; g++) {
      if (d[`enroll_g${g}`] !== undefined) {
        grades.push({
          label: `Grade ${g}`,
          total: d[`enroll_g${g}`],
          m: d[`g${g}_male`],
          f: d[`g${g}_female`]
        });
      }
    }

    return (
      <div className="space-y-6">
        <div>
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
            <FiUsers className="text-indigo-500" /> Enrollment Records
          </h4>
          <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase">
                  <th className="py-3 px-4">Grade Level</th>
                  <th className="py-3 px-4 text-center">Male</th>
                  <th className="py-3 px-4 text-center">Female</th>
                  <th className="py-3 px-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs">
                {grades.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-4 text-center text-slate-400 font-bold">No Grade-level enrollment data available.</td>
                  </tr>
                ) : (
                  grades.map((gr, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 font-bold text-slate-700">{gr.label}</td>
                      <td className="py-2.5 px-4 text-center text-slate-600">{getCleanVal(gr.m, "0")}</td>
                      <td className="py-2.5 px-4 text-center text-slate-600">{getCleanVal(gr.f, "0")}</td>
                      <td className="py-2.5 px-4 text-right font-black text-indigo-600">{getCleanVal(gr.total, "0")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
              <FiLayers className="text-indigo-500" /> SNED Programs
            </h4>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-500">Mainstreamed</span>
                <span className="font-black text-slate-800 bg-white px-2 py-0.5 rounded-lg border border-slate-100">
                  {parseInt(d.main_sned) > 0 ? `${d.main_sned} (${d.main_sned_male || 0}M / ${d.main_sned_female || 0}F)` : "None"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-500">Self-Contained</span>
                <span className="font-black text-slate-800 bg-white px-2 py-0.5 rounded-lg border border-slate-100">
                  {parseInt(d.self_sned) > 0 ? `${d.self_sned} (${d.self_sned_male || 0}M / ${d.self_sned_female || 0}F)` : "None"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-500">Organized Classes</span>
                <span className="font-black text-slate-800 bg-white px-2 py-0.5 rounded-lg border border-slate-100">{getCleanVal(d.self_sned_org_class, "0")}</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
              <FiBookOpen className="text-indigo-500" /> ARAL Program
            </h4>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-500">Math Program</span>
                {renderYesNo(d.has_aral_math)}
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-500">Reading Program</span>
                {renderYesNo(d.has_aral_reading)}
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-500">Science Program</span>
                {renderYesNo(d.has_aral_science)}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- UNIT 3: CLASS ORGANIZATION ---
  const renderUnit3 = (d) => {
    // Parse grade keys
    const entries = [];
    const parseSummaryStr = (str) => {
      if (!str) return "0 sections";
      const parts = str.split(",").map(p => p.trim());
      const totalSec = parts[0] || "0";
      return `${totalSec} Sections (${parts.slice(1).join(" · ") || "Standard size"})`;
    };

    if (d.grade_kinder_size) entries.push({ level: "Kinder", size: parseSummaryStr(d.grade_kinder_size) });
    for (let g = 1; g <= 12; g++) {
      if (d[`grade_${g}_size`]) {
        entries.push({ level: `Grade ${g}`, size: parseSummaryStr(d[`grade_${g}_size`]) });
      }
    }
    // Multigrades
    for (let m = 1; m <= 12; m++) {
      if (d[`multigrade_size_${m}`]) {
        entries.push({ level: `Multigrade Combination #${m}`, size: parseSummaryStr(d[`multigrade_size_${m}`]) });
      }
    }

    return (
      <div className="space-y-6">
        <div>
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
            <FiLayers className="text-indigo-500" /> Organized Sections Layout
          </h4>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 divide-y divide-slate-200/60 max-h-[50vh] overflow-y-auto">
            {entries.length === 0 ? (
              <p className="text-xs font-bold text-slate-400 py-4 text-center">No organized section records found.</p>
            ) : (
              entries.map((entry, idx) => (
                <div key={idx} className="flex justify-between py-2.5 first:pt-0 last:pb-0 text-xs">
                  <span className="font-bold text-slate-700">{entry.level}</span>
                  <span className="font-black text-indigo-600 text-right">{entry.size}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  // --- UNIT 4: LEARNER PROFILE & MOVEMENTS ---
  const renderUnit4 = (d) => {
    // Filter and show demographic subgroups
    const subGroups = [];
    const groupKeys = [
      { key: "indigenous", label: "Indigenous People (IP)" },
      { key: "muslim", label: "Muslim Learners" },
      { key: "cct", label: "CCT / 4Ps Recipients" },
      { key: "repeaters", label: "Grade Repeaters" }
    ];
    
    groupKeys.forEach(group => {
      let total = 0;
      for (let g = 1; g <= 12; g++) {
        total += parseInt(d[`${group.key}_g${g}`]) || 0;
      }
      if (parseInt(d[`${group.key}_kinder`])) total += parseInt(d[`${group.key}_kinder`]);
      if (total > 0) {
        subGroups.push({ label: group.label, count: total });
      }
    });

    if (parseInt(d.als_total) > 0) {
      subGroups.push({ label: "Alternative Learning System (ALS)", count: d.als_total });
    }

    // Movements
    const movements = [];
    const moveTypes = [
      { id: "transfer_out", label: "Transferred Out" },
      { id: "dropped_out", label: "Dropped Out / EOSY" }
    ];
    moveTypes.forEach(m => {
      let total = 0;
      for (let g = 1; g <= 12; g++) {
        total += parseInt(d[`${m.id}_g${g}`]) || 0;
      }
      if (parseInt(d[`${m.id}_kinder`])) total += parseInt(d[`${m.id}_kinder`]);
      if (total > 0) {
        movements.push({ label: m.label, count: total });
      }
    });

    return (
      <div className="space-y-6">
        <div>
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
            <FiUsers className="text-indigo-500" /> Demographic Subgroups
          </h4>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs grid grid-cols-2 gap-4">
            {subGroups.length === 0 ? (
              <p className="text-xs font-bold text-slate-400 col-span-2 text-center py-2">No special demographic groups registered.</p>
            ) : (
              subGroups.map((g, idx) => (
                <div key={idx} className="bg-white p-3 rounded-xl border border-slate-100 flex justify-between items-center shadow-sm">
                  <span className="font-bold text-slate-600 leading-snug">{g.label}</span>
                  <span className="font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">{g.count}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
              <FiActivity className="text-indigo-500" /> Learner Movements
            </h4>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs space-y-3">
              {movements.length === 0 ? (
                <p className="text-xs font-bold text-slate-400 text-center py-2">No transfer or dropouts registered.</p>
              ) : (
                movements.map((m, idx) => (
                  <div key={idx} className="flex justify-between items-center">
                    <span className="font-bold text-slate-500">{m.label}</span>
                    <span className="font-black text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-lg border border-rose-100">{m.count}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
              <FiActivity className="text-indigo-500" /> Nutritional BMI Status
            </h4>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-500">Severely Wasted</span>
                <span className="font-black text-slate-800">{getCleanVal(d.bmi_severely_wasted, "0")}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-500">Wasted</span>
                <span className="font-black text-slate-800">{getCleanVal(d.bmi_wasted, "0")}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-500">Overweight / Obese</span>
                <span className="font-black text-slate-800">{getCleanVal(d.bmi_overweight_obese, "0")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- UNIT 5: SHIFTING & MODALITIES ---
  const renderUnit5 = (d) => {
    const rows = [];
    const keys = ["kinder", ...Array.from({ length: 12 }, (_, i) => `g${i + 1}`), "mg_1", "mg_2", "mg_3"];
    
    // Check if any individual grade/group has data
    const hasIndividualData = keys.some(k => d[`shift_${k}`] || d[`mode_${k}`]);
    
    if (hasIndividualData) {
      keys.forEach(k => {
        const shift = d[`shift_${k}`];
        const mode = d[`mode_${k}`];
        if (shift || mode) {
          let label = k === "kinder" ? "Kindergarten" : k.startsWith("g") ? `Grade ${k.replace("g", "")}` : k;
          if (k.startsWith("mg_")) {
            const num = k.replace("mg_", "");
            label = d[`multigrade_groupings_${num}`] || `Multigrade Group ${num}`;
          }
          rows.push({ label, shift, mode });
        }
      });
    } else {
      // Fallback to groups or standard
      const gradeGroups = [
        { key: "kinder", label: "Kindergarten" },
        { key: "elem", label: "Elementary (G1-G6)" },
        { key: "jhs", label: "Junior High School (G7-G10)" },
        { key: "shs", label: "Senior High School (G11-G12)" }
      ];
      gradeGroups.forEach(gg => {
        const shift = d[`shift_${gg.key}`] || (d.has_standard_shifting ? "Single Shift" : null);
        const mode = d[`mode_${gg.key}`] || (d.has_standard_shifting ? "In-Person Classes" : null);
        if (shift || mode) {
          rows.push({ label: gg.label, shift, mode });
        }
      });
    }

    // Secondary fallback
    if (rows.length === 0) {
      rows.push({
        label: "General Profile",
        shift: d.shifting_modality || "—",
        mode: "—"
      });
    }

    return (
      <div className="space-y-6">
        <div>
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
            <FiClock className="text-indigo-500" /> Classes Shifting & Modalities
          </h4>
          <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase">
                  <th className="py-3 px-4">Level / Group</th>
                  <th className="py-3 px-4">Shifting Scheme</th>
                  <th className="py-3 px-4 text-right">Delivery Modality</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs">
                {rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-bold text-slate-700">{row.label}</td>
                    <td className="py-3 px-4 text-slate-600">{getCleanVal(row.shift, "—")}</td>
                    <td className="py-3 px-4 text-right font-black text-indigo-600">{getCleanVal(row.mode, "—")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
            <FiBookOpen className="text-indigo-500" /> Alternative Delivery Modes (ADM)
          </h4>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs grid grid-cols-2 gap-4">
            <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
              <span className="font-bold text-slate-500">Modified In-School Off-School (MISOSA)</span>
              {renderYesNo(d.adm_mdl)}
            </div>
            <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
              <span className="font-bold text-slate-500">Open High School Program (OHSP)</span>
              {renderYesNo(d.adm_odl)}
            </div>
            <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
              <span className="font-bold text-slate-500">Instructional Management (IMPACT)</span>
              {renderYesNo(d.adm_tvi)}
            </div>
            <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
              <span className="font-bold text-slate-500">Blended ADM Programs</span>
              {renderYesNo(d.adm_blended)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- UNIT 6: SCHOOL RESOURCES ---
  const renderUnit6 = (d) => {
    // Parse nested resources safely
    let wash = {};
    let utilities = {};
    let ict = {};
    let ecarts = [];
    let furniture = { grades: [], general: {} };

    try {
      if (d.unit7_wash) wash = typeof d.unit7_wash === 'string' ? JSON.parse(d.unit7_wash) : d.unit7_wash;
    } catch(e){}
    try {
      if (d.unit7_utilities) utilities = typeof d.unit7_utilities === 'string' ? JSON.parse(d.unit7_utilities) : d.unit7_utilities;
    } catch(e){}
    try {
      if (d.unit7_ict) ict = typeof d.unit7_ict === 'string' ? JSON.parse(d.unit7_ict) : d.unit7_ict;
    } catch(e){}
    try {
      if (d.unit7_ecarts) ecarts = typeof d.unit7_ecarts === 'string' ? JSON.parse(d.unit7_ecarts) : d.unit7_ecarts;
    } catch(e){}
    try {
      if (d.unit7_furniture) furniture = typeof d.unit7_furniture === 'string' ? JSON.parse(d.unit7_furniture) : d.unit7_furniture;
    } catch(e){}

    const generalFurn = furniture.general || {};
    const gradesFurn = furniture.grades || [];

    // Helper to calculate total items and functional count for summary
    const getFurnitureSummary = (f) => {
      const items = [
        { label: "Wooden Armchairs", func: f.armchair_wood_func, broken: f.armchair_wood_broken },
        { label: "Plastic Armchairs", func: f.armchair_plastic_func, broken: f.armchair_plastic_broken },
        { label: "Plastic/Steel Armchairs", func: f.armchair_plastic_steel_func, broken: f.armchair_plastic_steel_broken },
        { label: "Individual Tables/Chairs", func: f.individual_table_chair_func, broken: f.individual_table_chair_broken },
        { label: "2-Seater Wood Desk", func: f.two_seater_wood_func, broken: f.two_seater_wood_broken },
        { label: "2-Seater Wood/Steel Desk", func: f.two_seater_wood_steel_func, broken: f.two_seater_wood_steel_broken },
        { label: "Wooden Chairs Only", func: f.wooden_chair_only_func, broken: f.wooden_chair_only_broken },
        { label: "Plastic Chairs Only", func: f.plastic_chair_only_func, broken: f.plastic_chair_only_broken }
      ];
      return items.filter(item => (parseInt(item.func) || 0) > 0 || (parseInt(item.broken) || 0) > 0);
    };

    const generalItems = getFurnitureSummary(generalFurn);

    return (
      <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
        {/* FURNITURE INVENTORY */}
        <div>
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
            <FiLayers className="text-indigo-500" /> Classroom Furniture Inventory
          </h4>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs space-y-4">
            {generalFurn.has_general_rooms !== undefined && (
              <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                <span className="font-bold text-slate-500">General/Common Rooms Count</span>
                <span className="font-black text-slate-800">{generalFurn.has_general_rooms ? `${generalFurn.general_rooms_count || 0} Rooms` : "None"}</span>
              </div>
            )}
            
            {generalItems.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Common/General Furniture</p>
                <div className="grid grid-cols-2 gap-2">
                  {generalItems.map((item, idx) => (
                    <div key={idx} className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center">
                      <span className="font-bold text-slate-600 truncate">{item.label}</span>
                      <span className="font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[10px]">
                        Func: {item.func || 0} · Brk: {item.broken || 0}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {gradesFurn.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Grade-Level Specific Furniture</p>
                <div className="border border-slate-100 rounded-xl overflow-hidden bg-white max-h-[200px] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase">
                        <th className="py-2 px-3">Grade Level</th>
                        <th className="py-2 px-3">Furniture Type &amp; Counts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {gradesFurn.map((gf, idx) => {
                        const items = getFurnitureSummary(gf);
                        if (items.length === 0) return null;
                        return (
                          <tr key={idx} className="hover:bg-slate-50/30">
                            <td className="py-2 px-3 font-bold text-slate-700 valign-top align-top">{gf.grade_level || gf.id}</td>
                            <td className="py-2 px-3 text-slate-500 space-y-1">
                              {items.map((item, itemIdx) => (
                                <div key={itemIdx} className="flex justify-between">
                                  <span>{item.label}</span>
                                  <span className="font-bold text-slate-700">Func: {item.func || 0} · Brk: {item.broken || 0}</span>
                                </div>
                              ))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ICT EQUIPMENT */}
        <div>
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
            <FiMonitor className="text-indigo-500" /> ICT &amp; Tech Equipment
          </h4>
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs">
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Laptops</p>
              <p className="font-black text-slate-800 text-sm mt-1">{getCleanVal(ict.laptops_total, "0")} Total</p>
              <p className="text-[10px] text-slate-500">Teaching: {getCleanVal(ict.laptops_teaching, "0")} · Student: {getCleanVal(ict.laptops_students, "0")}</p>
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tablets</p>
              <p className="font-black text-slate-800 text-sm mt-1">{getCleanVal(ict.tablets_total, "0")} Total</p>
              <p className="text-[10px] text-slate-500">Teaching: {getCleanVal(ict.tablets_teaching, "0")} · Student: {getCleanVal(ict.tablets_students, "0")}</p>
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Desktops</p>
              <p className="font-black text-slate-800 text-sm mt-1">{getCleanVal(ict.desktops_total, "0")} Total</p>
              <p className="text-[10px] text-slate-500">Teaching: {getCleanVal(ict.desktops_teaching, "0")} · Student: {getCleanVal(ict.desktops_students, "0")}</p>
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Smart TVs / Projectors</p>
              <p className="font-black text-slate-800 text-sm mt-1">TVs: {getCleanVal(ict.smart_tvs_total, "0")} · Projectors: {getCleanVal(ict.projectors_total, "0")}</p>
              <p className="text-[10px] text-slate-500">Printers: {getCleanVal(ict.printers_total, "0")}</p>
            </div>
          </div>
        </div>

        {/* WASH FACILITIES */}
        <div>
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
            <FiDroplet className="text-indigo-500" /> WASH Facilities
          </h4>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white p-2.5 rounded-xl border border-slate-100 text-center">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Male Seats</span>
                <p className="font-black text-slate-800 mt-1">{getCleanVal(wash.male_seats_total, "0")} ({getCleanVal(wash.male_seats_func, "0")} Func)</p>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-100 text-center">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Female Seats</span>
                <p className="font-black text-slate-800 mt-1">{getCleanVal(wash.female_seats_total, "0")} ({getCleanVal(wash.female_seats_func, "0")} Func)</p>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-100 text-center">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Common Seats</span>
                <p className="font-black text-slate-800 mt-1">{getCleanVal(wash.common_seats_total, "0")} ({getCleanVal(wash.common_seats_func, "0")} Func)</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-slate-600">
              <div className="bg-white p-2.5 rounded-xl border border-slate-100 flex justify-between items-center">
                <span className="font-bold text-slate-500">Male Urinals</span>
                <span className="font-black text-slate-800">{getCleanVal(wash.male_urinals_total, "0")} ({getCleanVal(wash.male_urinals_func, "0")} Func)</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-100 flex justify-between items-center">
                <span className="font-bold text-slate-500">PWD Toilet Seats</span>
                <span className="font-black text-slate-800">{getCleanVal(wash.pwd_seats_total, "0")} ({getCleanVal(wash.pwd_seats_func, "0")} Func)</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-100 flex justify-between items-center">
                <span className="font-bold text-slate-500">Handwash Faucets</span>
                <span className="font-black text-slate-800">{getCleanVal(wash.faucets_total, "0")} ({getCleanVal(wash.faucets_func, "0")} Func)</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-100 flex justify-between items-center">
                <span className="font-bold text-slate-500">Attached CR Seats</span>
                <span className="font-black text-slate-800">{getCleanVal(wash.attached_cr_seats, "0")} across {getCleanVal(wash.attached_cr_classrooms, "0")} Classrooms</span>
              </div>
            </div>
          </div>
        </div>

        {/* UTILITIES & INTERNET */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
              <FiZap className="text-indigo-500" /> Utility Connections
            </h4>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs space-y-3">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Electricity Supply</p>
                <p className="font-bold text-slate-800 text-sm mt-0.5">{getCleanVal(utilities.utility_electricity)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Primary Water Source</p>
                <p className="font-bold text-slate-800 text-sm mt-0.5">{getCleanVal(wash.water_source)}</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
              <FiWifi className="text-indigo-500" /> Internet Connectivity
            </h4>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs space-y-3">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Internet Type</p>
                <p className="font-bold text-slate-800 text-sm mt-0.5">
                  {utilities.utility_internet_yesno ? `${getCleanVal(utilities.utility_internet_type)}` : "No Connection"}
                </p>
              </div>
              {utilities.utility_internet_yesno && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Funder / Provider</p>
                  <p className="font-bold text-slate-800 mt-0.5">{getCleanVal(utilities.utility_internet_funder)}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MOBILE ECARTS */}
        {ecarts && ecarts.length > 0 && (
          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
              <FiHardDrive className="text-indigo-500" /> Mobile eCarts Registered
            </h4>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs space-y-2">
              {ecarts.map((item, idx) => (
                <div key={idx} className="bg-white p-3 rounded-xl border border-slate-100 flex justify-between items-center shadow-sm">
                  <div>
                    <span className="font-black text-slate-700">{item.batches_name || `eCart Package #${idx + 1}`}</span>
                    <p className="text-[10px] text-slate-500 mt-0.5">Laptops: {item.ecart_laptops || 0} · Tablets: {item.ecart_tablets || 0} · TVs: {item.ecart_tv || 0}</p>
                  </div>
                  <span className="font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md text-[10px]">
                    Year {getCleanVal(item.year_received)} · {getCleanVal(item.sources_fund)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // --- UNIT 7: PHYSICAL FACILITIES ---
  const renderUnit7 = (d) => {
    const bldgs = d.inventory || [];
    return (
      <div className="space-y-6">
        <div>
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
            <FiHome className="text-indigo-500" /> Physical Building Inventory
          </h4>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 max-h-[50vh] overflow-y-auto space-y-3">
            {d.has_no_building ? (
              <p className="text-xs font-bold text-slate-400 text-center py-4">This school has verified no physical buildings constructed.</p>
            ) : bldgs.length === 0 ? (
              <p className="text-xs font-bold text-slate-400 text-center py-4">No building data available.</p>
            ) : (
              bldgs.map((b, idx) => (
                <div key={idx} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-black text-slate-800 text-sm">{b.building_name}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${b.status === "Good Condition" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                      {b.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-slate-500">
                    <div>
                      <p className="text-[9px] uppercase font-bold text-slate-400">Storey</p>
                      <p className="font-bold text-slate-700">{b.storey || 1} Levels</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase font-bold text-slate-400">Classrooms</p>
                      <p className="font-bold text-slate-700">{b.classroom || (b.rooms ? b.rooms.length : 0)} Rooms</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase font-bold text-slate-400">Category</p>
                      <p className="font-bold text-slate-700 truncate">{b.category || "Academic"}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  // --- UNIT 8: SCHOOL LOCATION ---
  const renderUnit8 = (d) => {
    return (
      <div className="space-y-6 text-xs">
        <div>
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
            <FiMapPin className="text-indigo-500" /> Geography &amp; Terrain Features
          </h4>
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Mountainous</p>
              {renderYesNo(d.loc_mountainous)}
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Coastal / Island</p>
              {renderYesNo(d.loc_coastal || d.loc_island)}
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Waterlocked</p>
              {renderYesNo(d.loc_waterlocked)}
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Critical Slope Area</p>
              {renderYesNo(d.loc_critical_slope)}
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
            <FiClock className="text-indigo-500" /> Accessibility Proximity Index
          </h4>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Travel Time to District</p>
              <p className="font-bold text-slate-800 text-sm">{getCleanVal(d.accessibility_time_dist)} mins</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Travel Time to Division</p>
              <p className="font-bold text-slate-800 text-sm">{getCleanVal(d.accessibility_time_div)} mins</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- UNIT 9: INFRASTRUCTURE & SAFETY ---
  const renderUnit9 = (d) => {
    return (
      <div className="space-y-6 text-xs">
        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Main Power Source</p>
            <p className="font-bold text-slate-800 text-sm">{getCleanVal(d.u9_main_power_source)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Active Meters Count</p>
            <p className="font-bold text-slate-800 text-sm">{getCleanVal(d.u9_active_meters)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Wiring Age Scheme</p>
            <p className="font-bold text-slate-800 text-sm">{getCleanVal(d.u9_wiring_age)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Last Inspection Year</p>
            <p className="font-bold text-slate-800 text-sm">{getCleanVal(d.u9_last_inspection_year)}</p>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
            <FiShield className="text-indigo-500" /> Infrastructure Checklist Compliance
          </h4>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 grid grid-cols-2 gap-4">
            <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
              <span className="font-bold text-slate-500">Breaker Panels Labeled</span>
              {renderYesNo(d.u9_panel_labeled)}
            </div>
            <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
              <span className="font-bold text-slate-500">Breaker Panels Locked</span>
              {renderYesNo(d.u9_panel_locked)}
            </div>
            <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
              <span className="font-bold text-slate-500">Functional Backup Lights</span>
              {renderYesNo(d.u9_backup_light_exists)}
            </div>
            <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
              <span className="font-bold text-slate-500">CCTV Clear Feed</span>
              {renderYesNo(d.u9_cctv_recording_clear)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- GENERAL / FALLBACK TABLE ---
  const renderFallback = (d) => {
    const keys = Object.keys(d).filter(k => !['id', 'created_at', 'updated_at', 'verified_as_of'].includes(k));
    return (
      <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white max-h-[50vh] overflow-y-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase">
              <th className="py-3 px-4">Field</th>
              <th className="py-3 px-4 text-right">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {keys.map((k, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50">
                <td className="py-2.5 px-4 font-bold text-slate-500 truncate max-w-[180px]">{k}</td>
                <td className="py-2.5 px-4 text-right font-black text-slate-700 truncate max-w-[200px]">
                  {getCleanVal(d[k])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderContent = () => {
    if (!data) return null;
    switch (unitKey) {
      case "unit1": return renderUnit1(data);
      case "unit2": return renderUnit2(data);
      case "unit3": return renderUnit3(data);
      case "unit4": return renderUnit4(data);
      case "unit5": return renderUnit5(data);
      case "unit6": return renderUnit6(data);
      case "unit7": return renderUnit7(data);
      case "unit8": return renderUnit8(data);
      case "unit9": return renderUnit9(data);
      default: return renderFallback(data);
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl bg-white/95 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl border border-white/50 overflow-hidden max-h-[85vh] flex flex-col z-[201]"
          >
            {/* Header */}
            <div className="px-8 pt-8 pb-4 border-b border-slate-100 flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center">
                  <FiCopy className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800">{title}</h2>
                  <p className="text-sm font-medium text-slate-400 font-sans">SY 2025‑2026 Reference Record</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-8 py-6 overflow-y-auto flex-1 text-slate-700">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                  <p className="text-sm font-bold text-slate-400">Fetching data…</p>
                </div>
              ) : !data ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-3xl">📭</div>
                  <p className="text-base font-bold text-slate-600">No previous year data found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {renderContent()}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-8 py-5 border-t border-slate-100 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3.5 rounded-2xl border-2 border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50 transition-all active:scale-95"
              >
                Close
              </button>
              {data && (
                <button
                  onClick={() => onCopy(data)}
                  className="flex-1 py-3.5 rounded-2xl bg-indigo-600 text-white font-black text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <FiCopy className="w-4 h-4" />
                  Copy to Current
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
