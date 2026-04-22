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

  const isProjectDelayed = (p) => {
    if (p.status === ProjectStatus.Completed) return false;
    if (!p.targetCompletionDate) return false;

    const target = new Date(p.targetCompletionDate);
    return now > target && p.accomplishmentPercentage < 100;
  };

  const stats = {
    total: projects.length,
    completed: projects.filter((p) => p.status === ProjectStatus.Completed).length,
    delayed: projects.filter((p) => isProjectDelayed(p)).length,
    ongoing: projects.filter((p) =>
      p.status === ProjectStatus.Ongoing && !isProjectDelayed(p)
    ).length,
    totalAllocation: projects.reduce(
      (acc, curr) => acc + (Number(curr.projectAllocation) || 0),
      0
    ),
    totalContract: projects.reduce(
      (acc, curr) => acc + (Number(curr.contractAmount) || 0),
      0
    ),
  };

  return (
    <div className="grid grid-cols-4 gap-2">
      <div className="bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-center items-center text-center">
        <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-tight">
          ABC
        </p>
        <p className="text-[11px] font-black text-[#004A99] dark:text-blue-400 mt-0.5 antialiased">
          {formatAllocation(stats.totalAllocation)}
        </p>
      </div>
      <div className="bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-center items-center text-center">
        <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-tight">
          Contract
        </p>
        <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 mt-0.5 antialiased">
          {formatAllocation(stats.totalContract)}
        </p>
      </div>
      <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-center items-center text-center">
        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide">
          Projects
        </p>
        <p className="text-xl font-bold text-slate-800 dark:text-white mt-1">{stats.total}</p>
      </div>
      <div
        className={`p-3 rounded-xl shadow-sm border flex flex-col justify-center items-center text-center ${stats.delayed > 0
          ? "bg-red-50 dark:bg-red-900/30 border-red-100 dark:border-red-800"
          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
          }`}
      >
        <p
          className={`text-[10px] font-bold uppercase tracking-wide ${stats.delayed > 0 ? "text-red-500 dark:text-red-400" : "text-slate-500 dark:text-slate-400"
            }`}
        >
          Delayed
        </p>
        <div className="flex items-center gap-1 mt-1">
          <p
            className={`text-xl font-bold ${stats.delayed > 0 ? "text-red-600 dark:text-red-400" : "text-slate-800 dark:text-white"
              }`}
          >
            {stats.delayed}
          </p>
          {stats.delayed > 0 && (
            <span className="text-[10px] animate-pulse">⚠️</span>
          )}
        </div>
      </div>
    </div>
  );
};

const StatsChart = ({ projects }) => {
  const now = new Date();
  const isProjectDelayed = (p) => {
    if (p.status === ProjectStatus.Completed) return false;
    if (!p.targetCompletionDate) return false;
    const target = new Date(p.targetCompletionDate);
    return now > target && p.accomplishmentPercentage < 100;
  };

  const stats = {
    total: projects.length,
    completed: projects.filter((p) => p.status === ProjectStatus.Completed).length,
    delayed: projects.filter((p) => isProjectDelayed(p)).length,
    ongoing: projects.filter((p) =>
      p.status === ProjectStatus.Ongoing && !isProjectDelayed(p)
    ).length,
  };

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
    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between">
      <div className="flex flex-col justify-center ml-2">
        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">
          Project Status Mix
        </p>
        <div className="text-[10px] text-slate-500 dark:text-slate-300 space-y-1">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: d.color }}
              ></span>
              <span>
                {d.name}: {d.value}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="w-24 h-24 mr-2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={18}
              outerRadius={35}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
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

          // ENGINEER: Stale-While-Revalidate Strategy
          // Priority 1: Show cache immediately if present
          try {
            const cachedData = await getCachedProjects();
            if (cachedData && cachedData.length > 0) {
              setProjects(cachedData);
              currentProjects = cachedData;
              setIsLoading(false);
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
            }));

            if (userRole !== 'Super User') {
              await cacheProjects(currentProjects);
            }

            setProjects(currentProjects);
            hasForceFetched.current = true; // First network fetch done; cache is now fresh

          } catch (networkError) {
            console.warn("Dashboard network request failed:", networkError);
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
        {/* --- TOP HEADER --- */}
        <div className="relative bg-[#004A99] pt-12 pb-24 px-6 rounded-b-[2.5rem] shadow-xl">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-200 text-xs font-bold tracking-wider uppercase">
                DepEd Infrastructure
              </p>
              <h1 className="text-2xl font-bold text-white mt-1">
                {userRole === 'LocalGovernmentUnit' ? 'LGU Partner' : userRole === 'Architect' ? 'Archi.' : 'Engr.'} {userName.split(' ')[0]}
              </h1>
              <p className="text-blue-100 mt-1 text-sm">
                {userRole === 'Super User' && sessionStorage.getItem('impersonatedDivision')
                  ? `${sessionStorage.getItem('impersonatedDivision')} • ${projects.length} projects`
                  : `Dashboard • Overview of ${projects.length} active projects.`
                }
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">

              <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 text-white shadow-inner">
                👷‍♂️
              </div>
            </div>
          </div>
        </div>

        {/* --- MAIN CONTENT CONTAINER --- */}
        <div className="px-5 -mt-16 relative z-10 space-y-6">
          <StatsOverview projects={projects} />

          <div className="w-full">
            <Swiper
              modules={[Pagination, Autoplay]}
              spaceBetween={15}
              slidesPerView={1}
              pagination={{ clickable: true, dynamicBullets: true }}
              autoplay={{ delay: 5000 }}
              className="w-full"
            >
              <SwiperSlide className="pb-8">
                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border-l-4 border-[#FDB913] flex flex-col justify-center min-h-[140px]">
                  <h3 className="text-[#004A99] dark:text-blue-400 font-bold text-sm flex items-center mb-1">
                    <span className="text-xl mr-2">👷</span>
                    Welcome, {userRole === 'LocalGovernmentUnit' ? 'LGU Partner' : userRole === 'Architect' ? 'Archi.' : 'Engr.'} {userName.split(' ')[0]}!
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed ml-7">
                    {userRole === 'Local Government Unit'
                      ? "Your dashboard is ready. Monitor local infrastructure projects and progress."
                      : "Your dashboard is ready. Track ongoing construction and validate school infrastructure data."
                    }
                  </p>
                </div>
              </SwiperSlide>

              <SwiperSlide className="pb-8">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border-l-4 border-emerald-500 flex flex-col h-[140px]">
                  <h3 className="text-emerald-700 dark:text-emerald-400 font-bold text-sm flex items-center mb-2 shrink-0">
                    <span className="text-xl mr-2">🏗️</span>
                    Active Projects ({projects.length})
                  </h3>
                  <div className="overflow-y-auto flex-1 pr-1 space-y-2 custom-scrollbar">
                    {projects.length > 0 ? (
                      projects.map((p) => (
                        <div key={p.id} className="flex justify-between items-center text-xs border-b border-slate-100 dark:border-slate-700 last:border-0 pb-1">
                          <span className="text-slate-700 dark:text-slate-200 font-medium truncate w-[70%]">{p.schoolName}</span>
                          <span className={`font-bold ${p.accomplishmentPercentage === 100 ? "text-emerald-600 dark:text-emerald-400" : "text-blue-600 dark:text-blue-400"}`}>
                            {p.accomplishmentPercentage || 0}%
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-400 text-xs italic ml-7">No active projects found.</p>
                    )}
                  </div>
                </div>
              </SwiperSlide>

              <SwiperSlide className="pb-8">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border-l-4 border-blue-500 flex flex-col h-[140px]">
                  <h3 className="text-blue-700 dark:text-blue-400 font-bold text-sm flex items-center mb-2 shrink-0">
                    <span className="text-xl mr-2">📢</span>
                    Latest Remarks
                  </h3>
                  <div className="overflow-y-auto flex-1 pr-1 space-y-2 custom-scrollbar">
                    {projects.some(p => p.otherRemarks) ? (
                      projects.filter(p => p.otherRemarks).map((p) => (
                        <div key={p.id} className="text-xs border-b border-slate-100 dark:border-slate-700 last:border-0 pb-2">
                          <p className="font-bold text-slate-700 dark:text-slate-200 truncate">{p.schoolName}</p>
                          <p className="text-slate-500 dark:text-slate-400 line-clamp-2">{p.otherRemarks}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-400 text-xs italic ml-7">No remarks available.</p>
                    )}
                  </div>
                </div>
              </SwiperSlide>
            </Swiper>
          </div>

          <StatsChart projects={projects} />

          <CalendarWidget projects={projects} />

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
