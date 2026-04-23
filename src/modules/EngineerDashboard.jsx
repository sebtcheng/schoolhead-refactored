import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from 'react-router-dom';
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination, Autoplay } from "swiper/modules";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import "swiper/css";
import "swiper/css/pagination";

// Components
import BottomNav from "./BottomNav";
import PageTransition from "../components/PageTransition";
import CalendarWidget from "../components/CalendarWidget";
import { useAuth } from "../context/AuthContext";
import { cacheProjects, getCachedProjects } from "../db";
import { useServiceWorker } from '../context/ServiceWorkerContext'; // Import Context

// --- CONSTANTS ---
const ProjectStatus = {
  UnderProcurement: "Under Procurement",
  NotYetStarted: "Not Yet Started",
  Ongoing: "Ongoing",
  ForFinalInspection: "For Final Inspection",
  Completed: "Completed",
};

// --- HELPERS ---
const formatAllocation = (value) => {
  const num = Number(value) || 0;
  
  if (num >= 1_000_000_000) {
    return `₱${(num / 1_000_000_000).toFixed(1)}B`;
  }
  if (num >= 1_000_000) {
    return `₱${(num / 1_000_000).toFixed(1)}M`;
  }
  
  return `₱${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// --- SUB-COMPONENTS ---

const StatsOverview = ({ projects }) => {
  const now = new Date();

  // Optimizing calculation to use a single pass for better performance
  const stats = projects.reduce((acc, p) => {
    const year = Number(p.fundingYear);
    if (year < 2022 || year > 2026) return acc;

    acc.total++;

    const isCompletedInDB = p.status === ProjectStatus.Completed || p.accomplishmentPercentage === 100;
    const hasPhotos = (p.images_count || 0) > 0;
    
    if (isCompletedInDB && hasPhotos) {
      acc.completed++;
    } else if (p.targetCompletionDate) {
      const target = new Date(p.targetCompletionDate);
      if (now > target && p.accomplishmentPercentage < 100) {
        acc.delayed++;
      }
    }

    if (hasPhotos) {
      acc.withPhotos++;
    }

    const isActive = (p.accomplishmentPercentage || 0) > 0 || hasPhotos;
    if (isActive) {
      acc.active++;
    }

    acc.totalAllocation += (Number(p.projectAllocation) || 0);
    return acc;
  }, { total: 0, completed: 0, delayed: 0, withPhotos: 0, totalAllocation: 0, active: 0 });

  const photoPercentage = stats.total > 0 ? Math.round((stats.withPhotos / stats.total) * 100) : 0;
  const activityLevel = stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Primary Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#0f172a] dark:bg-[#020617] p-3 rounded-2xl border-b-4 border-orange-500 shadow-xl relative overflow-hidden group">
          <p className="text-[7px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Projects (2022-2026)</p>
          <div className="flex items-baseline gap-1">
            <h2 className="text-2xl font-black text-white leading-none">{stats.total}</h2>
            <span className="text-[8px] font-bold text-orange-500 uppercase tracking-tighter italic">Registry</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border-b-4 border-[#004A99] shadow-md relative overflow-hidden group">
          <p className="text-[8px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">Done</p>
          <div className="flex items-baseline gap-1">
            <h2 className="text-2xl font-black text-[#004A99] dark:text-blue-400 leading-none">{stats.completed}</h2>
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter italic">Finished</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border-b-4 border-emerald-500 shadow-md relative overflow-hidden group">
          <p className="text-[8px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">Activity Level</p>
          <div className="flex items-baseline gap-1">
            <h2 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 leading-none">{activityLevel}%</h2>
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter italic">Active</span>
          </div>
        </div>
      </div>

      {/* Photo Documentation Progress Card */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div>
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-orange-100 dark:bg-orange-950/40 rounded-lg flex items-center justify-center text-orange-600">
                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
              </div>
              <h3 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-tight">Photo Documentation</h3>
            </div>
            <span className="text-sm font-black text-slate-900 dark:text-white">{photoPercentage}%</span>
          </div>
          <div className="relative w-full h-2.5 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 p-0.5">
            <div 
              className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${photoPercentage}%` }}
            ></div>
          </div>
        </div>
      </div>

    </div>
  );
};

const CriticalGaps = ({ projects }) => {
  const filteredProjects = projects.filter(p => {
    const year = Number(p.fundingYear);
    return year >= 2022 && year <= 2026;
  });

  const gaps = {
    noPhotos: filteredProjects.filter(p => (p.images_count || 0) === 0).length,
    zeroProgress: filteredProjects.filter(p => Number(p.accomplishmentPercentage || 0) === 0).length,
    procurement: filteredProjects.filter(p => p.status === 'Under procurement' || p.procurement_status === 'Under procurement').length,
  };

  return (
    <div className="space-y-3">
      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Critical Operational Gaps</h3>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative group overflow-hidden">
          <div className="absolute top-0 right-0 p-1 opacity-10">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
          </div>
          <p className="text-[18px] font-black text-orange-600 dark:text-orange-400">{gaps.noPhotos}</p>
          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-tight">No Photos</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative group overflow-hidden">
          <div className="absolute top-0 right-0 p-1 opacity-10">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M2 12h20"/></svg>
          </div>
          <p className="text-[18px] font-black text-blue-600 dark:text-blue-400">{gaps.zeroProgress}</p>
          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-tight">0% Progress</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative group overflow-hidden">
          <div className="absolute top-0 right-0 p-1 opacity-10">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <p className="text-[18px] font-black text-indigo-600 dark:text-indigo-400">{gaps.procurement}</p>
          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-tight">In-Procurement</p>
        </div>
      </div>
    </div>
  );
};

const FinancialPulse = ({ projects }) => {
  const filteredProjects = projects.filter(p => {
    const year = Number(p.fundingYear);
    return year >= 2022 && year <= 2026;
  });

  const totalABC = filteredProjects.reduce((acc, curr) => acc + (Number(curr.projectAllocation) || 0), 0);
  const totalAwarded = filteredProjects.reduce((acc, curr) => acc + (Number(curr.contractAmount) || 0), 0);
  const savings = totalABC - totalAwarded;

  return (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Financial Trajectory (2022-26)</h3>
        <div className="px-2 py-1 bg-emerald-50 dark:bg-emerald-950/40 rounded-md border border-emerald-100 dark:border-emerald-800">
           <p className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter">Savings: {formatAllocation(savings)}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Allocation (ABC)</p>
          <h4 className="text-xl font-black text-slate-900 dark:text-white mb-1">{formatAllocation(totalABC)}</h4>
          <div className="w-full h-1 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
             <div className="w-full h-full bg-slate-400 opacity-20"></div>
          </div>
        </div>
        <div>
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Awarded</p>
          <h4 className="text-xl font-black text-[#002244] dark:text-blue-400 mb-1">{formatAllocation(totalAwarded)}</h4>
          <div className="w-full h-1 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
             <div 
              className="h-full bg-blue-600 rounded-full"
              style={{ width: totalABC > 0 ? `${(totalAwarded / totalABC) * 100}%` : '0%' }}
             ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatsChart = ({ projects }) => {
  const now = new Date();

  // Single pass implementation for the chart stats
  const stats = projects.reduce((acc, p) => {
    const year = Number(p.fundingYear);
    if (year < 2022 || year > 2026) return acc;

    acc.total++;

    const isCompletedInDB = p.status === ProjectStatus.Completed || p.accomplishmentPercentage === 100;
    const hasPhotos = (p.images_count || 0) > 0;
    
    if (isCompletedInDB && hasPhotos) {
      acc.completed++;
    } else {
      let isDelayed = false;
      if (p.targetCompletionDate) {
        const target = new Date(p.targetCompletionDate);
        if (now > target && p.accomplishmentPercentage < 100) {
          isDelayed = true;
          acc.delayed++;
        }
      }

      if (!isDelayed) {
        acc.ongoing++;
      }
    }

    return acc;
  }, { total: 0, completed: 0, delayed: 0, ongoing: 0 });

  const data = [
    { name: "Completed", value: stats.completed, color: "#10B981" },
    { name: "Ongoing", value: stats.ongoing, color: "#3B82F6" },
    { name: "Delayed", value: stats.delayed, color: "#EF4444" },
    {
      name: "Others",
      value: stats.total - (stats.completed + stats.ongoing + stats.delayed),
      color: "#94A3B8",
    },
  ].filter((d) => d.value > 0);

  return (
    <div className="bg-[#0f172a] p-6 rounded-3xl shadow-2xl border border-slate-800 flex items-center justify-between overflow-hidden relative min-h-[220px]">
      {/* Technical Grid Background */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
      
      <div className="flex flex-col justify-center relative z-10">
        <p className="text-[12px] font-black text-orange-500 uppercase tracking-[0.2em] mb-4">Operational Pulse</p>
        <div className="space-y-3">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full ring-2 ring-offset-2 ring-offset-[#0f172a]" style={{ backgroundColor: d.color, ringColor: d.color }}></div>
              <span className="text-[11px] font-bold text-slate-300">
                {d.name.toUpperCase()}: <span className="text-white ml-2 text-sm">{d.value}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="w-40 h-40 relative z-10">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={30}
              outerRadius={55}
              paddingAngle={6}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', fontSize: '10px', color: '#fff' }}
              itemStyle={{ color: '#fff' }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Pulse</span>
        </div>
      </div>
    </div>
  );
}

// --- MAIN DASHBOARD COMPONENT ---

const EngineerDashboard = () => {
  const { user, token } = useAuth();
  const [userName, setUserName] = useState("Engineer");
  const [userRole, setUserRole] = useState(() => {
    let role = user?.role || localStorage.getItem('userRole') || "Division Engineer";
    if (role === 'deped_engineer' || role === 'DepEd Engineer') return 'Division Engineer';
    if (role === 'hrodi_engineer' || role === 'HRODI Engineer' || role === 'EFD' || role === 'HRODI') return 'EFD Engineer';
    return role;
  });
  const [projects, setProjects] = useState([]);
  const [activities, setActivities] = useState([]);

  const [isLoading, setIsLoading] = useState(true);

  // Force a fresh network fetch on the very first mount after login.
  // Prevents stale cache from a previous session appearing on login.
  const hasForceFetched = useRef(false);

  // Service Worker Update Context
  const { isUpdateAvailable, updateApp } = useServiceWorker();

  const API_BASE = "";
  const navigate = useNavigate();
  useEffect(() => {
    const fetchUserDataAndProjects = async () => {
      const currentUid = user?.uid || localStorage.getItem('uid');
      let currentRole = user?.account_category || user?.role || localStorage.getItem('userRole');
      
      if (currentUid) {
        if (user) {
            setUserName(`${user.first_name || user.firstName || ''} ${user.last_name || user.lastName || ''}`.trim() || 'Engineer');
        }
        
        // Normalize Role
        if (currentRole === 'deped_engineer' || currentRole === 'DepEd Engineer') currentRole = 'Division Engineer';
        if (currentRole === 'hrodi_engineer' || currentRole === 'HRODI Engineer' || currentRole === 'EFD' || currentRole === 'HRODI') currentRole = 'EFD Engineer';
        if (currentRole === 'non_deped_engineer') currentRole = 'Non-DepEd Engineer';
        if (currentRole === 'engineer') currentRole = 'Engineer';

        setUserRole(currentRole);

        try {
          setIsLoading(true);
          let url = `${API_BASE}/api/projects?engineer_id=${currentUid}&limit=all`;
          let currentProjects = [];

          if (currentRole === 'Super User') {
            const impersonatedDivision = sessionStorage.getItem('impersonatedDivision');
            if (impersonatedDivision) {
              url = `${API_BASE}/api/projects?division=${encodeURIComponent(impersonatedDivision)}&limit=all`;
            } else {
              url = `${API_BASE}/api/projects`; // Fetch all only if no division selected
            }
          }

          // ENGINEER: Stale-While-Revalidate Strategy (REFINED FOR SPEED)
          // We show cached data immediately to give the user an instant UI.
          // Then we fetch fresh data from the network in the background.
          try {
            const cachedData = await getCachedProjects();
            if (cachedData && cachedData.length > 0 && !hasForceFetched.current) {
              setProjects(cachedData); // Show cache immediately
              setIsLoading(false); // Stop showing loading overlay if we have cache
            }
          } catch (err) {
            console.warn("Cache read failed", err);
          }

          // Priority 2: Fetch fresh data from network
          try {
            const response = await fetch(url, {
              headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            if (!response.ok) throw new Error("Failed to fetch projects");
            const data = await response.json();
            const dataArr = Array.isArray(data) ? data : (data.data || []);

            currentProjects = dataArr.map((item) => ({
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
              statusDesignPhase: item.procurement_status,
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
              images_count: item.imagesCount || item.images_count || 0,
            }));

            if (userRole !== 'Super User') {
              await cacheProjects(currentProjects);
            }

            setProjects(currentProjects);
            hasForceFetched.current = true; // First network fetch done; cache is now fresh

          } catch (networkError) {
            console.warn("Dashboard network request failed, falling back to cache:", networkError);
            if (currentProjects.length > 0) {
              setProjects(currentProjects);
            }
          }

          try {
            const actResponse = await fetch(`${API_BASE}/api/activities?user_uid=${currentUid}`, {
              headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            if (actResponse.ok) {
              const actData = await actResponse.json();
              setActivities(actData);
            }
          } catch (actErr) {
            console.log("Offline: Cannot fetch recent activities.");
          }

        } catch (err) {
          console.error("Error loading projects/activities:", err);
        } finally {
          setIsLoading(false);
        }
      } else {
        // Fallback for loading state if user is null
        const lsRole = localStorage.getItem('userRole');
        if (!lsRole) setIsLoading(false);
      }
    };
    fetchUserDataAndProjects();
  }, [user, user?.uid, token]);

  return (
    <PageTransition>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans pb-24">
        {/* HYDRATION OVERLAY */}
        {isLoading && projects.length === 0 && (
          <div className="fixed inset-0 z-[100] bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="bg-white/90 dark:bg-slate-800/90 p-8 rounded-[3rem] shadow-2xl border border-white/50 dark:border-slate-700/50 flex flex-col items-center max-w-xs w-full transform -translate-y-12 shadow-blue-900/10">
              <div className="w-24 h-24 relative mb-8">
                <div className="absolute inset-0 border-[6px] border-blue-50 dark:border-blue-900/20 rounded-full"></div>
                <div className="absolute inset-0 border-[6px] border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-4xl">
                  {userRole === 'Architect' ? '📐' : '🏠'}
                </div>
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tighter italic">Initializing</h3>
              <p className="text-[11px] font-black text-blue-600 dark:text-blue-400 text-center uppercase tracking-widest leading-relaxed">
                Hydrating Dashboard...
              </p>
            </div>
          </div>
        )}
        {/* --- TOP HEADER --- */}
        <div className="relative bg-[#002244] pt-14 pb-28 px-6 rounded-b-[3rem] shadow-2xl overflow-hidden">
          {/* Decorative Pattern */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(45deg, #004A99 25%, transparent 25%, transparent 50%, #004A99 50%, #004A99 75%, transparent 75%, transparent)', backgroundSize: '40px 40px' }}></div>
          
          <div className="flex justify-between items-start relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                <p className="text-slate-400 text-[10px] font-black tracking-[0.2em] uppercase">
                  Division Engineering Office
                </p>
              </div>
              <h1 className="text-3xl font-black text-white mt-1 italic tracking-tighter uppercase">
                {userRole === 'LocalGovernmentUnit' ? 'LGU' : userRole === 'Architect' ? 'ARCHI' : 'ENGR'} {userName.split(' ')[0]}
              </h1>
              <p className="text-slate-400 mt-2 text-[11px] font-bold uppercase tracking-widest flex items-center gap-2">
                <span className="w-4 h-[1px] bg-slate-700"></span>
                {userRole === 'Super User' && sessionStorage.getItem('impersonatedDivision')
                  ? `${sessionStorage.getItem('impersonatedDivision')} INFRA`
                  : `Project Control Dashboard`
                }
              </p>
            </div>
            <div className="w-14 h-14 bg-white/5 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/10 text-2xl shadow-inner relative group cursor-pointer hover:bg-orange-500/20 transition-colors duration-500">
               <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border-2 border-[#002244]"></div>
               👷‍♂️
            </div>
          </div>
        </div>

        {/* --- MAIN CONTENT CONTAINER --- */}
        <div className="px-5 -mt-16 relative z-10 space-y-6">
          <StatsOverview projects={projects} />
          
          <CriticalGaps projects={projects} />
          
          <StatsChart projects={projects} />

          {/* --- RECENT ACTIVITIES section --- */}
          {/* <div className="w-full mb-6">
               <h3 className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider mb-3 ml-1">Recent Activities</h3>
               <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                   {isLoading ? (
                       <div className="p-8 text-center text-xs text-slate-400">Loading activities...</div>
                   ) : activities.length > 0 ? (
                       <>
                           <div className="divide-y divide-slate-50 dark:divide-slate-700 max-h-96 overflow-y-auto custom-scrollbar">
                               {activities.map((log, idx) => (
                                   <div key={log.log_id || idx} className="p-4 flex gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                       <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                                           log.action_type === 'CREATE' ? 'bg-green-500' : 
                                           log.action_type === 'DELETE' ? 'bg-red-500' : 'bg-blue-500'
                                       }`} />
                                       <div className="flex-1 min-w-0">
                                           <div className="flex justify-between items-start">
                                               <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border mb-1 inline-block ${
                                                   log.action_type === 'CREATE' ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-100 dark:border-green-800' : 
                                                   log.action_type === 'DELETE' ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800' : 
                                                   'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800'
                                               }`}>
                                                   {log.action_type}
                                               </span>
                                               <span className="text-[10px] text-slate-400">{log.formatted_time}</span>
                                           </div>
                                           <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{log.target_entity}</p>
                                           <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">{log.details}</p>
                                       </div>
                                   </div>
                               ))}
                           </div>
                           <div className="p-3 text-center bg-slate-50/50 dark:bg-slate-700/30 border-t border-slate-50 dark:border-slate-700">
                               <p className="text-[10px] text-slate-400 font-medium">Showing {activities.length} recent activities</p>
                           </div>
                       </>
                   ) : (
                       <div className="p-8 text-center">
                           <p className="text-2xl mb-2">💤</p>
                           <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No recent activity</p>
                           <p className="text-xs text-slate-400">Your actions will appear here.</p>
                       </div>
                   )}
               </div>
          </div> */}
        </div>
        <BottomNav userRole={userRole || "Engineer"} />
      </div>
    </PageTransition>
  );
};

export default EngineerDashboard;
