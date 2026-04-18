import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { FiSearch, FiPlus, FiFilter, FiCamera, FiImage, FiSettings, FiChevronRight, FiEdit, FiEye, FiX } from "react-icons/fi";
import { LuClipboardList, LuCalendar, LuDollarSign, LuActivity, LuFileText, LuX } from "react-icons/lu";

import BottomNav from "./BottomNav";
import PageTransition from "../components/PageTransition";
import { useAuth } from "../context/AuthContext";
import { addEngineerToOutbox, cacheProjects, getCachedProjects } from "../db";
import { compressImage } from "../utils/imageCompression";
import { uploadFileInChunks } from '../utils/chunkedUploader'; // NEW CHUNK UPLOADER

import LocationPickerMap from '../components/LocationPickerMap';
import UpdateProjectWizard from "../components/UpdateProjectWizard";
import FilterDrawer from "../components/FilterDrawer";
import ProjectLogModal from "../components/ProjectLogModal";

// --- CONSTANTS ---
const ProjectStatus = {
  UnderProcurement: "Under procurement",
  NotYetStarted: "Not Yet Started",
  Ongoing: "Ongoing",
  ForFinalInspection: "For Final Inspection",
  Completed: "Completed",
  Suspended: "Suspended",
  Terminated: "Terminated",
  Reverted: "Reverted",
};

const DOC_TYPES = {
  POW: "Program of Works",
  DUPA: "DUPA",
  CONTRACT: "Signed Contract"
};

// -----------------------
//   HELPER FUNCTION: File input to Chunked Uploader
// -----------------------
const processPdfFileChunked = async (file, onProgress) => {
  if (!file) return null;
  if (!file.type.includes('pdf')) {
    alert("Only PDF files are allowed.");
    return null;
  }
  return await uploadFileInChunks(file, onProgress);
};

// --- HELPERS ---
const getStatusColor = (status) => {
  switch (status) {
    case "Completed":
      return "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20";
    case "Ongoing":
    case "Under procurement":
    case "For Final Inspection":
      return "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20";
    case "Not Yet Started":
    case "Not yet procured":
      return "bg-slate-50 text-slate-400 border-slate-100 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20";
    case "Suspended":
      return "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20";
    case "Terminated":
      return "bg-red-50 text-red-600 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20";
    case "Reverted":
      return "bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20";
    default:
      return "bg-slate-50 text-slate-400 border-slate-100 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20";
  }
};

const formatAllocation = (value) => {
  const num = Number(value) || 0;
  return `₱${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDateTime = (dateString) => {
  if (!dateString) return "TBD";
  const date = new Date(dateString);
  const datePart = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
  const timePart = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${datePart} ${timePart}`;
};

// --- SUB-COMPONENTS ---

const ProjectCards = ({ projects, onEdit, onDelete, onView, onViewLog, onVariation, onRevert, isLoading, searchQuery, readOnly, handleStatusChange, userRole }) => {

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 animate-pulse">
            <div className="h-4 w-3/4 bg-slate-100 dark:bg-slate-700 rounded-lg mb-4"></div>
            <div className="h-6 w-1/2 bg-slate-200 dark:bg-slate-600 rounded-lg mb-6"></div>
            <div className="space-y-3">
              <div className="h-3 w-full bg-slate-50 dark:bg-slate-700/50 rounded-lg"></div>
              <div className="h-3 w-5/6 bg-slate-50 dark:bg-slate-700/50 rounded-lg"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 h-[300px] flex items-center justify-center flex-col p-8 text-center mt-6">
        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4 text-slate-300">
          <LuClipboardList size={32} />
        </div>
        <p className="text-lg font-bold text-slate-700 dark:text-slate-200">
          {searchQuery ? "No matching projects" : "No Projects Yet"}
        </p>
        <p className="text-sm text-slate-400 mt-1 max-w-[200px]">
          {searchQuery ? "Try adjusting your search terms." : "Start by adding your first school infrastructure project."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6 pb-12">
      {projects.map((p, idx) => {
        const isReverted = p?.status === 'Reverted';
        const isUpdateLocked =
          ["Completed", "Terminated", "Reverted"].includes(p?.status) ||
          (p?.approvalStatus === "Pending" && ["Division Engineer", "Architect"].includes(userRole)) ||
          userRole === "Regional Engineer";
        const updateLabel = isUpdateLocked
          ? (p?.approvalStatus === "Pending" && !["Completed", "Terminated"].includes(p?.status) ? "PENDING" : "LOCKED")
          : "UPDATE";
        return (
        <div
          key={p.id}
          onClick={() => onView(p)}
          className={`group bg-white dark:bg-slate-800 rounded-3xl shadow-xl shadow-slate-200/40 dark:shadow-none border transition-all duration-300 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 cursor-pointer relative ${
            isReverted
              ? 'border-purple-200 dark:border-purple-900 opacity-70 hover:opacity-90'
              : 'border-slate-100 dark:border-slate-700 hover:border-[#004A99] dark:hover:border-blue-500'
          }`}
          style={{ animationDelay: `${idx * 100}ms` }}
        >
          {isReverted && (
            <div className="absolute inset-0 bg-purple-50/40 dark:bg-purple-900/10 rounded-3xl pointer-events-none z-10" />
          )}
          {/* Card Header (Location & IPC) */}
          <div className="p-6 pb-0">
            <div className="flex justify-between items-start mb-2">
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#004A99] dark:text-blue-400 opacity-60">
                   {p.region} • {p.division}
                </span>
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-300">
                  {p.province}
                </span>
                <span className="text-[11px] font-bold text-slate-400">
                  {p?.municipality || p?.city || "Municipality Not Set"}
                </span>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                {/* Combined Row for Last Updated By and Percentage */}
                <div className="flex items-center gap-2 mt-1">
                  {/* Accomplishment Percentage Badge */}
                  <div className="relative">
                    <div className="px-3 py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300 rounded-xl border-2 border-emerald-100 dark:border-emerald-800 shadow-sm flex flex-col items-center leading-tight">
                      <div className="flex items-center gap-1.5">
                        {(p?.previousPercentage !== undefined && p?.previousPercentage !== null && Number(p?.previousPercentage) !== Number(p?.accomplishmentPercentage)) || (p?.previousPercentage === null && Number(p?.accomplishmentPercentage) !== 0) ? (
                          <>
                            <span className="text-[10px] font-bold opacity-40 line-through">{p?.previousPercentage ?? 0}%</span>
                            <span className="text-[10px] font-black opacity-30">→</span>
                          </>
                        ) : null}
                        <span className="text-[18px] font-black">{p?.accomplishmentPercentage || 0}%</span>
                      </div>
                      { (p.statusAsOf || p.statusAsOfDate) && (
                        <span className="text-[7px] font-black uppercase tracking-tighter opacity-60 mt-0.5">
                          As of {new Date(p.statusAsOf || p.statusAsOfDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} {new Date(p.statusAsOf || p.statusAsOfDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    {p?.status === "Suspended" && (
                      <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full shadow-lg border border-white animate-pulse">
                        ⏸ SUSPENDED
                      </div>
                    )}
                    {p?.status === "Terminated" && (
                      <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full shadow-lg border border-white animate-pulse">
                        🚫 TERMINATED
                      </div>
                    )}
                    {p?.status === "Reverted" && (
                      <div className="absolute -top-2 -right-2 bg-purple-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full shadow-lg border border-white">
                        ↩ REVERTED
                      </div>
                    )}
                    {p?.approvalStatus === "Pending" && (
                      <div className="absolute -top-2 -left-2 bg-orange-400 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full shadow-lg border border-white animate-pulse">
                        ⏳ PENDING
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {p.ipc && (
              <div className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-[9px] font-black text-[#004A99] dark:text-blue-300 rounded-lg border border-blue-100 dark:border-blue-800 uppercase tracking-tighter w-fit mb-1">
                IPC {p.ipc}
              </div>
            )}
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 leading-tight mb-2 group-hover:text-[#004A99] dark:group-hover:text-blue-400 transition-colors">
              {p.projectName}
            </h3>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-900/50 w-fit px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-300">{p.schoolName}</span>
                {p.schoolId && <span className="text-slate-400">({p.schoolId})</span>}
              </div>
              {p.projectCategory && (
                <div className="flex items-center gap-1.5 text-[9px] font-black text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20 w-fit px-2 py-1 rounded-lg border border-blue-100/50 dark:border-blue-800/50 uppercase tracking-wider">
                  {p.projectCategory}
                </div>
              )}
            </div>

            {/* Micro Progress Bar */}
            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
              <div 
                className="h-full bg-emerald-500 transition-all duration-1000 ease-out"
                style={{ width: `${p.accomplishmentPercentage || 0}%` }}
              ></div>
            </div>

            {/* Vitals Footer (Last Updated) */}
            <div className="flex justify-end">
              {p.engineerName && (
                <div className="flex items-center gap-1 text-[7px] font-black text-slate-400 uppercase tracking-widest opacity-60">
                   Updated by: <span className="text-[#004A99] dark:text-blue-400 ml-1">{p?.engineerName}</span>
                </div>
              )}
            </div>
          </div>



          {/* Actions */}
          <div className="p-6 mt-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(p, 'quick'); }}
                disabled={isUpdateLocked}
                className={`flex-1 py-2.5 text-[10px] font-black rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 ${
                  isUpdateLocked
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-700'
                    : 'bg-[#004A99] text-white hover:bg-blue-800'
                }`}
              >
                <LuActivity size={14} />
                {updateLabel}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onViewLog(p); }}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 text-[10px] font-black rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <LuClipboardList size={14} /> LOGS
              </button>
            </div>
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {/* Revert button — only for Division Engineer / Architect on active projects */}
              {['Division Engineer', 'Architect'].includes(userRole) &&
                !['Completed', 'Terminated', 'Reverted'].includes(p?.status) && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRevert(p); }}
                  className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-black text-purple-500 hover:text-white hover:bg-purple-500 border border-purple-200 dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-600 dark:hover:text-white rounded-2xl transition-all active:scale-95"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
                  REVERT
                </button>
              )}
              {!['Division Engineer', 'Architect', 'DepEd Engineer', 'Engineer', 'Regional Engineer'].includes(userRole) && (
                <button
                   onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}
                   className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                </button>
              )}
            </div>
          </div>
        </div>
        );
      })}
    </div>
  );
};

// --- MAIN PROJECT LIST COMPONENT ---

const EngineerProjects = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [userName, setUserName] = useState(user?.first_name || user?.firstName || "Engineer");
    const [userRole, setUserRole] = useState(() => {
        let role = user?.role || localStorage.getItem('userRole') || "Division Engineer";
        if (role === 'deped_engineer' || role === 'DepEd Engineer') return 'Division Engineer';
        if (role === 'hrodi_engineer' || role === 'HRODI Engineer' || role === 'EFD' || role === 'HRODI') return 'EFD Engineer';
        if (role === 'architect') return 'Architect';
        return role;
    });
  const [accountCategory, setAccountCategory] = useState(null);
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [modalMode, setModalMode] = useState('quick');

  // --- FILTER STATES ---
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  // Ref mirrors isFilterOpen so async fetch callbacks always read the latest value
  const isFilterOpenRef = useRef(false);
  useEffect(() => { isFilterOpenRef.current = isFilterOpen; }, [isFilterOpen]);
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [selectedDivisions, setSelectedDivisions] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedYears, setSelectedYears] = useState([]);
  const [selectedBatchFunds, setSelectedBatchFunds] = useState([]);

  // --- LOG MODAL STATE ---
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [logProject, setLogProject] = useState(null);

  // Categorized State
  const [internalFiles, setInternalFiles] = useState([]);
  const [internalPreviews, setInternalPreviews] = useState([]);
  const [externalFiles, setExternalFiles] = useState([]);
  const [externalPreviews, setExternalPreviews] = useState([]);

  const [activeCategory, setActiveCategory] = useState('Internal');

  // PDF Upload Progress State
  const [uploadProgress, setUploadProgress] = useState({});

  // AI Modal State
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");

  // --- Image Upload State & Refs ---
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // --- Project Log State ---
  const [projectHistory, setProjectHistory] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // --- Checkbox Reason Modal State (Bugs 4 & 5) ---
  const [checkboxModal, setCheckboxModal] = useState({
    open: false, type: null, project: null, newValue: null, options: [], title: ''
  });
  const [selectedReasons, setSelectedReasons] = useState([]);

  // --- Revert Modal State ---
  const [revertModal, setRevertModal] = useState({ open: false, project: null });
  const [revertReason, setRevertReason] = useState('');

  // --- Variation Order Modal State ---
  const [variationModalOpen, setVariationModalOpen] = useState(false);
  const [variationProject, setVariationProject] = useState(null);
  const [variationData, setVariationData] = useState({
    variationName: '',
    variationType: 'Change Order',
    originalAmount: '',
    additive: '',
    deductive: '',
    reusedAmount: ''
  });
  const [recentVariations, setRecentVariations] = useState([]);
  const [isSavingVO, setIsSavingVO] = useState(false);
  const [isLoadingVO, setIsLoadingVO] = useState(false);

  const REASON_OPTIONS = {
    // Procurement Status Reasons
    'Not yet procured': [
      'Lacking Buildability Requirements: Incomplete Detailed Engineering Design (DED) or Program of Works (POW)',
      'Site Ownership Issues: No Deed of Donation, missing Transfer Certificate of Title (TCT), or ongoing land disputes',
      'Permitting Delays: Pending Environmental Compliance Certificate (ECC) or Building Permits from the LGU',
      'Site Readiness: The location requires demolition of old structures or massive earth-filling before a contractor can bid',
      'Budget Realignment: The initial allocation is insufficient for current material costs, requiring a request for additional funds',
    ],
    'Under procurement': [
      'Pre-Procurement Conference: Finalizing the Bidding Documents',
      'Advertisement/Posting: Published on PhilGEPS',
      'Pre-Bid Conference: Clarifications with potential contractors',
      'Submission and Receipt of Bids: The "Opening of Bids" stage',
      'Bid Evaluation: Determining the Lowest Calculated Bid (LCB)',
      'Post-Qualification: Validating the contractor\'s legal and technical capacity',
      'Notice of Award (NOA): The project is officially assigned to a winner',
      'Contract Signing & Notice to Proceed (NTP): Finalizing the legal start date',
    ],
    // Construction Status Reasons
    'Not Yet Started': [
      'Right-of-Way (ROW) Issues: Access to the school site is blocked by private property or informal settlers',
      'Obstruction Removal: Existing utility lines (electric poles, water pipes) need relocation',
      'Adverse Weather: Premature heavy rains or typhoons preventing mobilization',
      'Contractor Mobilization Delay: Failure of the contractor to bring equipment or manpower to the site on time',
      'Unavailability of Materials: Shortage of specific supplies in remote areas (e.g., Oriental Mindoro)',
    ],
    'Suspended': [
      'Variation Order Pending: Changes in design require a budget/contract adjustment',
      'Force Majeure: Natural disasters or unforeseen site conditions (e.g., discovering a sinkhole)',
      'Peace and Order: Security threats in the immediate area',
      'Non-Payment of Claims: Contractor stops work due to delayed progress billing payments',
    ],
    'Terminated': [
      'Default by Contractor: Negative slippage (delay) exceeds 15% of the total project duration',
      'Abandonment: The contractor has pulled out all staff and equipment without notice',
      'Fundamental Design Flaw: The site is found to be geologically unsafe for the proposed structure',
      'Convenience of the Government: Project is canceled due to a change in department priority or policy',
    ],
  };

  const API_BASE = "";

  // Fetch User & Projects
  const fetchProjects = async () => {
    const currentUid = user?.uid || localStorage.getItem('uid');
    let currentRole = user?.account_category || user?.role || localStorage.getItem('userRole');
    
    if (currentUid) {
      // Sync Basic Info from User Object if available
      if (user) {
          setUserName(`${user.first_name || user.firstName || ''} ${user.last_name || user.lastName || ''}`.trim() || 'Engineer');
          setAccountCategory(user.account_category);
      }

      try {
        setIsLoading(true);
        // Normalize role for BottomNav and logic
        if (currentRole === 'deped_engineer' || currentRole === 'DepEd Engineer') currentRole = 'Division Engineer';
        if (currentRole === 'hrodi_engineer' || currentRole === 'HRODI Engineer' || currentRole === 'EFD' || currentRole === 'HRODI') currentRole = 'EFD Engineer';
        if (currentRole === 'non_deped_engineer') currentRole = 'Non-DepEd Engineer';
        if (currentRole === 'engineer') currentRole = 'Engineer';
        if (currentRole === 'architect') currentRole = 'Architect';
        
        setUserRole(currentRole);
        let currentProjects = [];

        // 1. Immediate Cache Load (Fast Render)
        try {
          const cachedData = await getCachedProjects();
          if (cachedData && cachedData.length > 0) {
            if (!isFilterOpenRef.current) setProjects(cachedData);
            currentProjects = cachedData;
            setIsLoading(false);
          }
        } catch (err) {
          console.warn("Cache read failed", err);
        }

        // 2. Network Request
        try {
          let url = `${API_BASE}/api/projects?engineer_id=${currentUid}`;

          if (currentRole === 'Super User') {
            const impersonatedDivision = sessionStorage.getItem('impersonatedDivision');
            if (impersonatedDivision) {
              url = `${API_BASE}/api/projects?division=${encodeURIComponent(impersonatedDivision)}`;
            } else {
              url = `${API_BASE}/api/projects`;
            }
          } else if (currentRole === 'Super Admin') {
              url = `${API_BASE}/api/projects`;
          }

          const response = await fetch(url);
          if (!response.ok) throw new Error("Failed to fetch projects");
          const data = await response.json();
          const dataArr = Array.isArray(data) ? data : (data.data || []);

          currentProjects = dataArr.map(item => ({
            id: item.id,
            projectName: item.projectName,
            schoolName: item.schoolName,
            schoolId: item.schoolId,
            status: item.status,
            engineerName: item.engineerName,
            accomplishmentPercentage: item.accomplishmentPercentage,
            projectAllocation: item.projectAllocation,
            targetCompletionDate: item.targetCompletionDate,
            statusAsOf: item.statusAsOf,
            otherRemarks: item.otherRemarks,
            contractorName: item.contractorName,
            ipc: item.ipc,
            latitude: item.latitude,
            longitude: item.longitude,
            projectCategory: item.projectCategory,
            scopeOfWork: item.scopeOfWork,
            numberOfClassrooms: item.numberOfClassrooms,
            numberOfStoreys: item.numberOfStoreys,
            numberOfSites: item.numberOfSites,
            fundsUtilized: item.fundsUtilized,
            constructionStartDate: item.constructionStartDate,
            noticeToProceed: item.noticeToProceed,
            batchOfFunds: item.batchOfFunds,
            hasPow: item.hasPow,
            hasDupa: item.hasDupa,
            hasContract: item.hasContract,
            hasMoa: item.hasMoa,
            hasRta: item.hasRta,
            hasVariationOrder: item.hasVariationOrder,
            variationOrderPdf: item.variationOrderPdf,
            contractAmount: item.contractAmount,
            statusDesignPhase: item.procurement_status, // Mapping for compatibility
            procurement_status: item.procurement_status,
            fundingYear: item.fundingYear,
            province: item.province,
            region: item.region,
            division: item.division,
            municipality: item.municipality,
            city: item.city,
            previousPercentage: item.previousPercentage,
            isRealigned: item.isRealigned,
            updateType: item.updateType,
            savings: item.savings,
            isDonated: item.isDonated,
            programType: item.programType,
            fundingYearJustification: item.fundingYearJustification,
            sangguniang_resolution_id: item.sangguniang_resolution_id,
            mother_moa_id: item.mother_moa_id,
            supplamental_moa_id: item.supplamental_moa_id,
            checklist: item.checklist,
            triangulated_percentage: item.triangulated_percentage,
            approvalStatus: item.approvalStatus,
          }));

          // Update Cache on success
          await cacheProjects(currentProjects);

          // Update state with fresh data — skip if filter drawer is open to prevent ghosting
          if (!isFilterOpenRef.current) setProjects(currentProjects);

        } catch (networkError) {
          console.warn("Network request failed:", networkError);
        }

      } catch (err) {
        console.error("Error loading projects:", err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [user, user?.uid]);

  // Filtered list
  const filteredProjects = React.useMemo(() => {
    return projects.filter((p) => {
      const searchTerm = searchQuery.toLowerCase();
      const matchesSearch =
        p.schoolName?.toLowerCase().includes(searchTerm) ||
        p.projectName?.toLowerCase().includes(searchTerm) ||
        p.schoolId?.toString().includes(searchTerm) ||
        p.ipc?.toLowerCase().includes(searchTerm);

      const matchesRegion = selectedRegions.length === 0 || selectedRegions.includes(p.region);
      const matchesDivision = selectedDivisions.length === 0 || selectedDivisions.includes(p.division);
      const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(p.projectCategory);
      const matchesYear = selectedYears.length === 0 || selectedYears.includes(p.fundingYear?.toString());
      const matchesBatch = selectedBatchFunds.length === 0 || selectedBatchFunds.includes(p.batch_of_funds || p.batchOfFunds);

      return matchesSearch && matchesRegion && matchesDivision && matchesCategory && matchesYear && matchesBatch;
    }).sort((a, b) => {
      // Primary: funding_year DESC (newest cycle first)
      const yearA = Number(a.fundingYear ?? a.funding_year ?? 0);
      const yearB = Number(b.fundingYear ?? b.funding_year ?? 0);
      if (yearB !== yearA) return yearB - yearA;
      // Secondary: schoolName ASC (alphabetical — stable within the same year)
      const nameA = (a.schoolName ?? '').toLowerCase();
      const nameB = (b.schoolName ?? '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [projects, searchQuery, selectedRegions, selectedDivisions, selectedCategories, selectedYears, selectedBatchFunds]);

  const stats = React.useMemo(() => {
    return {
      total: filteredProjects.length,
      ongoing: filteredProjects.filter(p => p.status === 'Ongoing').length,
      completed: filteredProjects.filter(p => p.status === 'Completed').length,
    };
  }, [filteredProjects]);

  const handleViewProject = (project) => navigate(`/project-details/${project.id}`);

  const handleDeleteProject = async (projectId) => {
    const isConfirmed = window.confirm("⚠️ DELETE PROJECT\n\nAre you sure you want to delete this project? This will permanently remove all associated progress, photos, and documents. This action cannot be undone.");

    if (!isConfirmed) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete project");
      }

      // Update local state
      setProjects(prev => prev.filter(p => p.id !== projectId));
      alert("Project deleted successfully.");

    } catch (err) {
      console.error("Delete Error:", err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleRevertProject = (project) => {
    setRevertReason('Funds reverted to National Treasury due to non-utilization within the fiscal year.');
    setRevertModal({ open: true, project });
  };

  const handleConfirmRevert = async () => {
    const { project } = revertModal;
    setRevertModal({ open: false, project: null });
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/revert-project/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          uid: user?.uid,
          revertReason: revertReason.trim() || 'Funds reverted to National Treasury.',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to revert project');
      }
      setProjects(prev => prev.map(p =>
        p.id === project.id ? { ...p, status: 'Reverted', revertReason: revertReason.trim() } : p
      ));
    } catch (err) {
      console.error('Revert error:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const openCheckboxModal = (project, type, newValue) => {
    const options = REASON_OPTIONS[newValue] || [];
    const titles = {
      'Not yet procured': '🔴 Reason for Not Yet Procured',
      'Under procurement': '📋 Current Procurement Stage',
      'Not Yet Started': '⏸ Reason for Not Yet Started',
      'Suspended': '⏸ Reason for Suspension',
      'Terminated': '🚫 Reason for Termination',
    };
    setSelectedReasons([]);
    setCheckboxModal({ open: true, type, project, newValue, options, title: titles[newValue] || 'Select Reason' });
  };

  const handleCheckboxConfirm = async () => {
    const { type, project, newValue } = checkboxModal;
    const remarks = selectedReasons.join('; ');
    setCheckboxModal(c => ({ ...c, open: false }));
    await applyStatusChange(project, type, newValue, remarks);
  };

  const applyStatusChange = async (project, type, newValue, remarks) => {
    try {
      const payload = { ...project };
      if (type === 'procurement') {
        delete payload.status; // Avoid sending current construction status as a new change
        payload.procurement_status = newValue;
        payload.statusDesignPhase = newValue; // For consistency
        if (newValue === 'Completed') {
          // Do nothing to status; keep previous value or handle at backend
        }
      } else {
        payload.status = newValue;
        // Bug 3: Auto-set percentage for specific statuses
        if (newValue === 'For Final Inspection' || newValue === 'Completed') {
          payload.accomplishmentPercentage = 100;
        }
        // Terminated / Suspended: preserve last percentage — do NOT change it
      }
      payload.otherRemarks = remarks || project.otherRemarks;

      // Optimistic Update
      setProjects(prev => prev.map(p => p.id === project.id ? { 
        ...p, 
        ...payload,
        previousPercentage: p.accomplishmentPercentage 
      } : p));

      const response = await fetch(`${API_BASE}/api/update-project/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          previousPercentage: project.accomplishmentPercentage,
          uid: user?.uid,
          modifiedBy: userName,
          statusAsOf: new Date().toISOString(),
          update_type: 'Status Quick Update'
        }),
      });

      if (!response.ok) throw new Error("Failed to update status");
      
      const resData = await response.json();
      const updatedProject = resData.project;
      
      console.log(`Status (${type}) updated to: ${newValue}`);
      
      // Update local state with the actual data from server
      setProjects(prev => prev.map(p => (p.id === project.id || (p.ipc && p.ipc === project.ipc)) ? {
        ...p,
        ...updatedProject,
        id: updatedProject.project_id, // Important: Use the NEW project_id for the next update
        statusAsOf: updatedProject.statusAsOf || updatedProject.status_as_of,
        previousPercentage: project.accomplishmentPercentage
      } : p));

      // Clear local cache to force fresh fetch on next dashboard visit
      try {
        const { clearProjectsCache } = await import('../db');
        await clearProjectsCache();
      } catch (cacheErr) {
        console.warn("Failed to clear projects cache:", cacheErr);
      }

      alert(`✅ ${type === 'procurement' ? 'Procurement' : 'Construction'} status updated successfully!`);
    } catch (err) {
      console.error("Status Update Error:", err);
      alert("Failed to update project status. Please try again.");
      const original = projects.find(p => p.id === project.id);
      if (original) setProjects(prev => prev.map(p => p.id === project.id ? original : p));
    }
  };

  const handleStatusChange = async (project, type, newValue) => {
    const needsCheckbox = Object.keys(REASON_OPTIONS).includes(newValue);

    if (type === 'procurement') {
      if (newValue === 'Not yet procured' || newValue === 'Under procurement') {
        openCheckboxModal(project, type, newValue);
        return;
      }
      // 'Completed' procurement — save directly
      await applyStatusChange(project, type, newValue, '');
      return;
    }

    // Construction statuses
    if (needsCheckbox) {
      openCheckboxModal(project, type, newValue);
      return;
    }

    // 'Ongoing' — no reason needed, but Completed needs cert confirmation
    if (newValue === 'Completed') {
      const hasCert = window.confirm("Does this project have a Certificate of Completion?");
      const remarks = hasCert ? "With Certificate of Completion" : "Without Certificate of Completion";
      await applyStatusChange(project, type, newValue, remarks);
      return;
    }

    // All other statuses (Ongoing, For Final Inspection) — save directly
    await applyStatusChange(project, type, newValue, '');
  };

  const handleViewLog = async (project) => {
    setLogProject(project);
    setIsLogModalOpen(true);
    setIsHistoryLoading(true);
    setProjectHistory([]); // Clear previous
    try {
      const resp = await fetch(`${API_BASE}/api/project-history/${project.ipc || project.id}`);
      if (resp.ok) {
        const history = await resp.json();
        setProjectHistory(history);
      } else {
        console.warn("Project history fetch failed.");
      }
    } catch (err) {
      console.error("Log Fetch Error:", err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleEditProject = async (project, mode = 'quick') => {
    setSelectedProject(project);
    setModalMode(mode);
    setInternalFiles([]);
    setInternalPreviews([]);
    setExternalFiles([]);
    setExternalPreviews([]); // Clear old previews
    setIsUpdateModalOpen(true);

    // BACKGROUND SYNC: Fetch full project details (including PDFs) while modal is open
    try {
      const response = await fetch(`${API_BASE}/api/projects/${project.id}`);
      if (response.ok) {
        const fullData = await response.json();
        // Merge full data into selected project (preserving local changes if any, though unlikely here)
        setSelectedProject(prev => prev && prev.id === project.id ? { ...prev, ...fullData } : prev);
      }
    } catch (err) {
      console.warn("Background project fetch failed:", err);
    }
  };

  const handleOpenVariationModal = (project) => {
    setVariationProject(project);
    setVariationData({
      variationName: '',
      variationType: 'Change Order',
      originalAmount: project.projectAllocation || '',
      additive: '',
      deductive: '',
      reusedAmount: ''
    });
    setVariationModalOpen(true);
    fetchRecentVariations(project.id);
  };

  const fetchRecentVariations = async (projectId) => {
    setIsLoadingVO(true);
    try {
      const response = await fetch(`${API_BASE}/api/variation-orders/${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setRecentVariations(data);
      }
    } catch (err) {
      console.warn("Failed to fetch variations:", err);
    } finally {
      setIsLoadingVO(false);
    }
  };

  const handleVariationConfirm = async () => {
    if (!variationData.variationName || !variationData.variationType) {
      alert("Please fill in Variation Name and Type.");
      return;
    }

    setIsSavingVO(true);
    try {
      const response = await fetch(`${API_BASE}/api/variation-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: variationProject.id,
          ipc: variationProject.ipc,
          ...variationData,
          uid: user?.uid,
          userName: userName
        }),
      });

      if (!response.ok) throw new Error("Failed to save variation order");

      alert("Variation Order saved successfully!");
      setVariationModalOpen(false);
    } catch (err) {
      console.error("VO Save Error:", err);
      alert("Error saving variation order. Please try again.");
    } finally {
      setIsSavingVO(false);
    }
  };

  const handlePdfUpload = async (projectId, type, file, item) => {
    // Create local progress state mapping
    setUploadProgress(prev => ({ ...prev, [`${projectId}-${type}`]: 0 }));

    try {
      const cloudUrl = await processPdfFileChunked(file, (prog) => {
        setUploadProgress(prev => ({ ...prev, [`${projectId}-${type}`]: prog }));
      });

      if (!cloudUrl) {
        setUploadProgress(prev => { const n = { ...prev }; delete n[`${projectId}-${type}`]; return n; });
        return; // Canceled
      }

      // Merge into save payload
      const updatedDocs = { [type]: cloudUrl };

      const response = await fetch(`${API_BASE}/api/update-project/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedDocs),
      });

      if (!response.ok) throw new Error("PDF upload failed");

      // Update the project in the local state with the new PDF URL
      setProjects(prev => prev.map(p =>
        p.id === projectId ? { ...p, [type]: cloudUrl } : p
      ));

      alert(`${type.toUpperCase()} uploaded successfully!`);

    } catch (err) {
      console.error(err);
      alert("Failed to upload document chunk.");
    } finally {
      setUploadProgress(prev => { const n = { ...prev }; delete n[`${projectId}-${type}`]; return n; });
    }
  };

  const handleSaveProject = async (updatedProject, overrideInternalFiles = null, overrideExternalFiles = null) => {
    const uid = user?.uid;
    if (!uid) return;

    // CHECK: Completed Projects must have Actual Completion Date
    if (updatedProject.status === 'Completed' && !updatedProject.actualCompletionDate) {
      alert("⚠️ DATE REQUIRED\n\nYou cannot mark a project as 'Completed' without specifying the Actual Completion Date.");
      return;
    }

    setIsUploading(true);
    try {
      // Create payload copy
      let uploaderType = 'DepEd Engineer';
      if (userRole === 'EFD' || userRole === 'EFD Engineer' || userRole === 'HRODI' || userRole === 'Division Engineer' || userRole === 'DepEd Engineer') uploaderType = 'DepEd Engineer';
      else if (userRole === 'Non-DepEd Engineer' || (userRole === 'DepEd Engineer' && accountCategory === 'Non-DepEd Engineer')) uploaderType = 'Non-DepEd Engineer';

      const payload = { 
        ...updatedProject, 
        uid: uid, 
        modifiedBy: userName, 
        uploader_type: uploaderType,
        update_type: updatedProject.update_type || (modalMode === 'quick' ? 'Status Update' : 'Details Update')
      };
      const body = payload;

      // Use overrides if provided (from Wizard), otherwise fallback to component state
      const currentInternal = overrideInternalFiles || internalFiles;
      const currentExternal = overrideExternalFiles || externalFiles;

      if (!navigator.onLine) {
        await addEngineerToOutbox({
          url: `${API_BASE}/api/update-project/${updatedProject.id}`,
          method: 'PUT',
          body: body,
          formName: `Update: ${updatedProject.schoolName}`
        });

        // Save images offline
        const allFiles = [
          ...currentInternal.map(f => ({ file: f, category: 'Internal' })),
          ...currentExternal.map(f => ({ file: f, category: 'External' }))
        ];

        if (allFiles.length > 0) {
          for (const item of allFiles) {
            try {
              const base64Image = await compressImage(item.file);
              await addEngineerToOutbox({
                url: `${API_BASE}/api/upload-image`,
                method: 'POST',
                body: { projectId: updatedProject.id, imageData: base64Image, uploadedBy: uid, category: item.category },
                formName: `Photo (${item.category}): ${updatedProject.schoolName}`
              });
            } catch (err) {
              console.error("Compression failed for file:", item.file.name, err);
            }
          }
        }
        alert("⚠️ Offline: Changes cached to Sync Center.");
        setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
        setIsUpdateModalOpen(false);
        return;
      }

      // Online Save Project
      const response = await fetch(`${API_BASE}/api/update-project/${updatedProject.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error("Update failed");
      const resData = await response.json();
      
      // The backend returns the NEW snapshot row in resData.project
      const finalProject = {
        ...updatedProject,
        id: resData.project.project_id,
        status: resData.project.status_of_construction_phase || updatedProject.status,
        procurement_status: resData.project.procurement_status || updatedProject.procurement_status,
        procurementStatus: resData.project.procurement_status || updatedProject.procurementStatus,
        accomplishmentPercentage: Number(resData.project.accomplishment_percentage ?? updatedProject.accomplishmentPercentage),
        otherRemarks: resData.project.other_remarks,
        mother_moa_id: resData.project.mother_moa_id,
        supplamental_moa_id: resData.project.supplamental_moa_id,
        sangguniang_resolution_id: resData.project.sangguniang_resolution_id,
        project_category_id: resData.project.project_category_id,
        projectCategory: resData.project.project_category || updatedProject.projectCategory,
        savings: resData.project.savings,
        statusAsOf: resData.project.status_as_of || resData.project.statusAsOf || updatedProject.statusAsOf,
      };

      // Online Upload Images
      const allFiles = [
        ...currentInternal.map(f => ({ file: f, category: 'Internal' })),
        ...currentExternal.map(f => ({ file: f, category: 'External' }))
      ];

      let failedUploads = 0;

      if (allFiles.length > 0) {
        // Small delay to ensure the new project record is fully visible in DB for image linking
        await new Promise(resolve => setTimeout(resolve, 800));
        
        for (const item of allFiles) {
          try {
            const formData = new FormData();
            formData.append('image', item.file);
            formData.append('projectId', resData.project.project_id);
            formData.append('uploadedBy', uid);
            formData.append('category', item.category);
            const resp = await fetch(`${API_BASE}/api/upload-image`, { method: "POST", body: formData });
            
            if (!resp.ok) {
              failedUploads++;
              console.error(`Upload failed for file: ${item.file.name} with status: ${resp.status}`);
            }
          } catch (err) {
            console.error("Upload failed for file:", item.file.name, err);
            failedUploads++;
          }
        }
      }
      
      const updatedList = projects.map(p => p.id === updatedProject.id ? finalProject : p);
      setProjects(updatedList);
      await cacheProjects(updatedList); // PERSIST TO CACHE

      if (failedUploads > 0) {
        alert(`⚠️ PARTIAL SUCCESS\n\nProject details updated, but ${failedUploads} photo(s) failed to upload. Please check your connection and try re-uploading them.`);
      } else {
        alert("✅ SUCCESS\n\nProject updates and site photos have been synced.");
      }
      
      setInternalFiles([]);
      setExternalFiles([]);
      setIsUpdateModalOpen(false);
    } catch (err) {
      console.error("Save Error:", err);
      alert("❌ ERROR\n\nFailed to save updates entirely. Please check your connection or try again later.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Limit to 100MB
    const validFiles = files.filter(file => file.size <= 100 * 1024 * 1024);
    const newPreviews = validFiles.map(file => URL.createObjectURL(file));

    if (activeCategory === 'Internal') {
      setInternalFiles(prev => [...prev, ...validFiles]);
      setInternalPreviews(prev => [...prev, ...newPreviews]);
    } else {
      setExternalFiles(prev => [...prev, ...validFiles]);
      setExternalPreviews(prev => [...prev, ...newPreviews]);
    }

    e.target.value = null;
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

  return (
    <PageTransition>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans pb-24">
        {/* --- DYNAMIC PREMIUM HEADER --- */}
        <div className="bg-gradient-to-br from-[#004A99] via-[#003366] to-[#001D3D] p-6 pb-28 rounded-b-[3.5rem] shadow-2xl relative overflow-hidden transition-all duration-500">
          {/* Decorative Elements */}
          <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-[-20%] left-[-10%] w-48 h-48 bg-blue-400/10 rounded-full blur-2xl"></div>

          <div className="relative z-10">
            <div className="flex justify-between items-center mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
                  <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.2em] leading-none">
                     Infrastructure
                  </p>
                </div>
                <h1 className="text-3xl font-black text-white tracking-tight">
                  Project Monitoring
                </h1>
              </div>
              {!['Super User', 'EFD Engineer', 'EFD', 'HRODI'].includes(userRole) && (
                <button
                  disabled={true}
                  className="group bg-slate-300 text-slate-500 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl cursor-not-allowed flex items-center gap-2"
                >
                  <FiPlus size={16} />
                  New Project (Disabled)
                </button>
              )}
            </div>

            {/* --- GLASSMORPHISM SEARCH BAR --- */}
            <div className="relative group transition-all duration-300">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <FiSearch className="text-white/40 group-focus-within:text-white transition-colors" />
              </div>
              <input
                type="text"
                placeholder="Query schools, projects or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/10 backdrop-blur-xl border border-white/20 text-white placeholder:text-white/30 text-xs px-12 py-4 rounded-2xl outline-none focus:ring-4 focus:ring-white/10 focus:bg-white/15 transition-all shadow-inner"
              />
              <div className="absolute inset-y-0 right-4 flex items-center">
                <div className="h-6 w-[1px] bg-white/10 mx-2"></div>
                <button onClick={() => setIsFilterOpen(true)} className="p-2 -mr-2">
                  <FiFilter className={`transition-colors ${isFilterOpen || selectedDivisions.length > 0 || selectedCategories.length > 0 || selectedYears.length > 0 ? 'text-white' : 'text-white/40 hover:text-white'}`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* --- PROJECT LISTING --- */}
        <div className="px-5 mt-6 relative z-20">
          <ProjectCards
            projects={filteredProjects}
            onEdit={handleEditProject}
            onDelete={handleDeleteProject}
            onView={handleViewProject}
            onViewLog={handleViewLog}
            onVariation={handleOpenVariationModal}
            onRevert={handleRevertProject}
            isLoading={isLoading}
            searchQuery={searchQuery}
            readOnly={userRole === 'Super User'}
            handleStatusChange={handleStatusChange}
            userRole={userRole}
          />

          <div className="flex items-center justify-center gap-4 mt-4">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-[#004A99] rounded-full"></div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Swipe Details</span>
            </div>
            <div className="w-[1px] h-3 bg-slate-200"></div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Live Updates</span>
            </div>
          </div>
        </div>

        {/* --- HIDDEN INPUTS & MODALS --- */}
        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
        <input type="file" ref={cameraInputRef} onChange={handleFileUpload} accept="image/*" capture="environment" className="hidden" />

        {/* --- PROJECT LOG MODAL --- */}
        <ProjectLogModal 
            isOpen={isLogModalOpen}
            onClose={() => setIsLogModalOpen(false)}
            project={logProject}
        />

        <UpdateProjectWizard
          project={selectedProject}
          isOpen={isUpdateModalOpen}
          onClose={() => setIsUpdateModalOpen(false)}
          isUploading={isUploading}
          onSave={async (updatedProject, wizardInternalFiles, wizardExternalFiles) => {
            // Pass wizard-captured files directly to avoid state race conditions
            await handleSaveProject(updatedProject, wizardInternalFiles, wizardExternalFiles);
          }}
        />

        <FilterDrawer 
          isOpen={isFilterOpen}
          onClose={() => setIsFilterOpen(false)}
          projects={projects}
          onApply={(f) => {
            setSelectedRegions(f.regions);
            setSelectedDivisions(f.divisions);
            setSelectedCategories(f.categories);
            setSelectedYears(f.years);
            setSelectedBatchFunds(f.batches || []);
          }}
          initialRegions={selectedRegions}
          initialDivisions={selectedDivisions}
          initialCategories={selectedCategories}
          initialYears={selectedYears}
          initialBatches={selectedBatchFunds}
          hideRegions={userRole !== 'EFD' && userRole !== 'EFD Engineer' && userRole !== 'HRODI'}
          hideDivisions={true}
          hideProvinces={true}
          hideMunicipalities={true}
        />

        {/* --- CHECKBOX REASON MODAL (Bugs 4 & 5) --- */}
        {checkboxModal.open && createPortal(
           <div className="fixed inset-0 z-[99999] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
             <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-white/20">
                <div className="px-8 pt-6 pb-2">
                  <h3 className="text-xl font-black text-slate-800 dark:text-white mb-1 leading-tight">{checkboxModal.title}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{checkboxModal.project?.projectName}</p>
                </div>
                
                <div className="flex-1 overflow-y-auto px-8 py-2 space-y-3 custom-scrollbar">
                 {checkboxModal.options.map((opt, i) => (
                   <label key={i} className={`flex gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer group ${selectedReasons.includes(opt) ? 'bg-blue-50/50 border-blue-500/50 dark:bg-blue-900/20' : 'bg-slate-50 border-transparent dark:bg-slate-900/50 hover:border-slate-200'}`}>
                     <div className="pt-0.5">
                        <input 
                          type={checkboxModal.newValue === 'Under procurement' ? "radio" : "checkbox"}
                          checked={selectedReasons.includes(opt)}
                          onChange={(e) => {
                            if (checkboxModal.newValue === 'Under procurement') {
                              setSelectedReasons([opt]);
                            } else {
                              if (e.target.checked) setSelectedReasons([...selectedReasons, opt]);
                              else setSelectedReasons(selectedReasons.filter(r => r !== opt));
                            }
                          }}
                          className="w-4 h-4 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                     </div>
                     <span className={`text-[11px] font-bold leading-snug transition-colors ${selectedReasons.includes(opt) ? 'text-blue-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-400'}`}>
                       {opt}
                     </span>
                   </label>
                 ))}
               </div>

               <div className="p-8 pt-4 space-y-3">
                 <button 
                   onClick={handleCheckboxConfirm}
                   disabled={selectedReasons.length === 0}
                   className="w-full py-3.5 bg-blue-600 dark:bg-blue-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700 dark:hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                 >
                   Confirm Selection
                 </button>
                 <button 
                   onClick={() => setCheckboxModal({ ...checkboxModal, open: false })}
                   className="w-full py-3.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                 >
                   Cancel
                 </button>
               </div>
             </div>
           </div>,
           document.body
        )}

        {/* --- REVERT MODAL --- */}
        {revertModal.open && createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-white/20">
              <div className="px-8 pt-8 pb-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-purple-500"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
                </div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white mb-1">Revert Funds</h3>
                <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest mb-3">{revertModal.project?.projectName}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-5">
                  This marks the project as <strong>Reverted</strong> — funds are returned to the National Treasury due to non-utilization. A re-budget or re-allocation will be required to continue. COA may flag this for audit.
                </p>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Reason</label>
                <textarea
                  value={revertReason}
                  onChange={(e) => setRevertReason(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-xs text-slate-700 dark:text-slate-200 resize-none focus:outline-none focus:border-purple-400 transition-colors"
                  placeholder="Enter reason for reverting funds..."
                />
              </div>
              <div className="px-8 pb-8 flex flex-col gap-2 mt-2">
                <button
                  onClick={handleConfirmRevert}
                  className="w-full py-3.5 bg-purple-500 hover:bg-purple-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-purple-500/20 transition-all active:scale-95"
                >
                  Confirm Revert
                </button>
                <button
                  onClick={() => setRevertModal({ open: false, project: null })}
                  className="w-full py-3.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* --- VARIATION ORDER MODAL --- */}
        {variationModalOpen && createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-6 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/20">
              {/* Header */}
              <div className="px-8 pt-8 pb-4 border-b border-slate-100 dark:border-slate-700">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white leading-tight underline decoration-blue-500 decoration-4 underline-offset-4">Variation Order</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-3">
                      {variationProject?.projectName}
                    </p>
                  </div>
                  <button onClick={() => setVariationModalOpen(false)} className="p-3 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-2xl text-slate-400 transition-all active:scale-90">
                    <FiX size={20} />
                  </button>
                </div>
              </div>

              {/* Form Content */}
              <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                {/* Variation Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Variation Name</label>
                  <input 
                    type="text"
                    placeholder="e.g. Change Order No. 1"
                    value={variationData.variationName}
                    onChange={(e) => setVariationData({...variationData, variationName: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-blue-500 p-4 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 transition-all outline-none"
                  />
                </div>

                {/* Variation Type */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Variation Type</label>
                  <select 
                    value={variationData.variationType}
                    onChange={(e) => setVariationData({...variationData, variationType: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-blue-500 p-4 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 transition-all outline-none"
                  >
                    <option value="Change Order">Change Order</option>
                    <option value="Extra Work Order">Extra Work Order</option>
                    <option value="Combined">Combined</option>
                  </select>
                </div>

                {/* Numbers Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Original Amount</label>
                    <div className="relative">
                      <span className="absolute left-4 inset-y-0 flex items-center text-slate-400 font-black text-xs">₱</span>
                      <input 
                        type="number"
                        placeholder="0.00"
                        value={variationData.originalAmount}
                        onChange={(e) => setVariationData({...variationData, originalAmount: e.target.value})}
                        className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-blue-500 p-4 pl-8 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 transition-all outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-emerald-500">Additive (+)</label>
                    <div className="relative">
                      <span className="absolute left-4 inset-y-0 flex items-center text-emerald-400 font-black text-xs">₱</span>
                      <input 
                        type="number"
                        placeholder="0.00"
                        value={variationData.additive}
                        onChange={(e) => setVariationData({...variationData, additive: e.target.value})}
                        className="w-full bg-emerald-50/30 dark:bg-emerald-900/10 border-2 border-transparent focus:border-emerald-500 p-4 pl-8 rounded-2xl text-sm font-bold text-emerald-600 dark:text-emerald-400 transition-all outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-red-500">Deductive (-)</label>
                    <div className="relative">
                      <span className="absolute left-4 inset-y-0 flex items-center text-red-400 font-black text-xs">₱</span>
                      <input 
                        type="number"
                        placeholder="0.00"
                        value={variationData.deductive}
                        onChange={(e) => setVariationData({...variationData, deductive: e.target.value})}
                        className="w-full bg-red-50/30 dark:bg-red-900/10 border-2 border-transparent focus:border-red-500 p-4 pl-8 rounded-2xl text-sm font-bold text-red-600 dark:text-red-400 transition-all outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-blue-500">Reused Amount</label>
                    <div className="relative">
                      <span className="absolute left-4 inset-y-0 flex items-center text-blue-400 font-black text-xs">₱</span>
                      <input 
                        type="number"
                        placeholder="0.00"
                        value={variationData.reusedAmount}
                        onChange={(e) => setVariationData({...variationData, reusedAmount: e.target.value})}
                        className="w-full bg-blue-50/30 dark:bg-blue-900/10 border-2 border-transparent focus:border-blue-500 p-4 pl-8 rounded-2xl text-sm font-bold text-blue-600 dark:text-blue-400 transition-all outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Summary Box */}
                <div className="bg-[#004A99] p-5 rounded-3xl text-white shadow-xl shadow-blue-500/20">
                   <div className="flex justify-between items-center opacity-60 mb-1">
                      <span className="text-[10px] font-black uppercase tracking-widest">Modified Total Amount</span>
                      <LuDollarSign size={16} />
                   </div>
                   <div className="text-2xl font-black">
                      {formatAllocation((parseFloat(variationData.originalAmount) || 0) + (parseFloat(variationData.additive) || 0) - (parseFloat(variationData.deductive) || 0))}
                   </div>
                </div>

                {/* Recent Variations List */}
                <div className="pt-4 space-y-4">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Variations</label>
                    <span className="text-[9px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">{recentVariations.length} total</span>
                  </div>
                  
                  {isLoadingVO ? (
                    <div className="flex justify-center py-4">
                      <div className="w-5 h-5 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
                    </div>
                  ) : recentVariations.length === 0 ? (
                    <div className="text-center py-6 bg-slate-50 dark:bg-slate-900/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No previous variations</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentVariations.map((vo, i) => (
                        <div key={vo.id} className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1 animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${i * 50}ms` }}>
                          <div className="flex justify-between items-start">
                            <span className="text-xs font-black text-slate-700 dark:text-slate-200">{vo.variation_name}</span>
                            <span className="text-[8px] font-black px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg text-slate-500 uppercase">{vo.variation_type}</span>
                          </div>
                          <div className="flex justify-between items-end">
                            <span className="text-[10px] font-bold text-slate-400">{formatDateTime(vo.created_at)}</span>
                            <span className="text-[11px] font-black text-[#004A99] dark:text-blue-400">{formatAllocation(vo.modified_amount)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-8 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30">
                <button 
                  onClick={handleVariationConfirm}
                  disabled={isSavingVO}
                  className="w-full py-4 bg-blue-600 dark:bg-blue-500 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSavingVO ? (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  ) : <LuClipboardList size={14} />}
                  Save Variation Order
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        <BottomNav userRole={userRole} />

      </div>
    </PageTransition >
  );
};

export default EngineerProjects;
