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
import { useServiceWorker } from '../context/ServiceWorkerContext';

// --- CONSTANTS ---
const ProjectStatus = {
  UnderProcurement: "Under Procurement",
  NotYetStarted: "Not Yet Started",
  Ongoing: "Ongoing",
  ForFinalInspection: "For Final Inspection",
  Completed: "Completed",
};

const ApprovalBadge = ({ status }) => {
    if (status === 'Pending') return (
        <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200 animate-pulse">
            <FiClock size={9} /> FOR VALIDATION
        </span>
    );
    if (status === 'Approved') return (
        <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
            <FiCheckCircle size={9} /> CO Approved
        </span>
    );
    return null;
};

// --- HELPERS ---
const formatAllocation = (value) => {
  const num = Number(value) || 0;
  if (num >= 1_000_000_000) return `₱${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `₱${(num / 1_000_000).toFixed(1)}M`;
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
    totalAllocation: projects.reduce((acc, curr) => acc + (Number(curr.projectAllocation) || 0), 0),
    totalContract: projects.reduce((acc, curr) => acc + (Number(curr.contractAmount) || 0), 0),
  };

  return (
    <div className="grid grid-cols-4 gap-2">
      <div className="bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-center items-center text-center">
        <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-tight">ABC</p>
        <p className="text-[11px] font-black text-[#004A99] dark:text-blue-400 mt-0.5">{formatAllocation(stats.totalAllocation)}</p>
      </div>
      <div className="bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-center items-center text-center">
        <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-tight">Contract</p>
        <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{formatAllocation(stats.totalContract)}</p>
      </div>
      <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-center items-center text-center">
        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide">Projects</p>
        <p className="text-xl font-bold text-slate-800 dark:text-white mt-1">{stats.total}</p>
      </div>
      <div className={`p-3 rounded-xl shadow-sm border flex flex-col justify-center items-center text-center ${stats.delayed > 0 ? "bg-red-50 dark:bg-red-900/30 border-red-100 dark:border-red-800" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"}`}>
        <p className={`text-[10px] font-bold uppercase tracking-wide ${stats.delayed > 0 ? "text-red-500 dark:text-red-400" : "text-slate-500 dark:text-slate-400"}`}>Delayed</p>
        <div className="flex items-center gap-1 mt-1">
          <p className={`text-xl font-bold ${stats.delayed > 0 ? "text-red-600 dark:text-red-400" : "text-slate-800 dark:text-white"}`}>{stats.delayed}</p>
          {stats.delayed > 0 && <span className="text-[10px] animate-pulse">⚠️</span>}
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
    ongoing: projects.filter((p) => p.status === ProjectStatus.Ongoing && !isProjectDelayed(p)).length,
  };

  const data = [
    { name: "Completed", value: stats.completed, color: "#10B981" },
    { name: "Ongoing", value: stats.ongoing, color: "#3B82F6" },
    { name: "Delayed", value: stats.delayed, color: "#EF4444" },
    { name: "Others", value: stats.total - (stats.completed + stats.ongoing + stats.delayed), color: "#94A3B8" },
  ].filter((d) => d.value > 0);

  return (
    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between">
      <div className="flex flex-col justify-center ml-2">
        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">Project Status Mix (Region)</p>
        <div className="text-[10px] text-slate-500 dark:text-slate-300 space-y-1">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }}></span>
              <span>{d.name}: {d.value}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="w-24 h-24 mr-2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={18} outerRadius={35} paddingAngle={5} dataKey="value">
              {data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const RegionalEngineerDashboard = () => {
  const { user, token } = useAuth();
  const [userName, setUserName] = useState("Regional Engineer");
  const [userRole, setUserRole] = useState("Regional Engineer");
  const [projects, setProjects] = useState([]);
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const hasForceFetched = useRef(false);
  const { isUpdateAvailable, updateApp } = useServiceWorker();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      const currentUid = user?.uid || localStorage.getItem('uid');
      if (!currentUid) return;

      setUserName(`${user?.first_name || user?.firstName || ''} ${user?.last_name || user?.lastName || ''}`.trim() || 'Regional Engineer');
      setUserRole('Regional Engineer');

      try {
        setIsLoading(true);
        // Backend handles regional filtering automatically based on JWT claims for Regional Engineer role
        const url = `/api/projects?engineer_id=${currentUid}&limit=all`;

        // 1. Cache First
        try {
          const cached = await getCachedProjects();
          if (cached && cached.length > 0) {
            setProjects(cached);
            setIsLoading(false);
          }
        } catch (err) { console.warn("Cache read failed", err); }

        // 2. Network Fetch
        try {
          const response = await fetch(url, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
          });
          if (response.ok) {
            const data = await response.json();
            const dataArr = Array.isArray(data) ? data : (data.data || []);
            setProjects(dataArr);
            await cacheProjects(dataArr);
          }
        } catch (err) { console.warn("Fetch failed:", err); }

        // 3. Activities
        try {
          const actResponse = await fetch(`/api/activities?user_uid=${currentUid}`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
          });
          if (actResponse.ok) setActivities(await actResponse.json());
        } catch (err) { console.log("Activities fetch failed"); }

      } catch (err) { console.error("Dashboard Load Error:", err);
      } finally { setIsLoading(false); }
    };
    fetchData();
  }, [user, token]);

  return (
    <PageTransition>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans pb-24">
        <div className="relative bg-[#004A99] pt-12 pb-24 px-6 rounded-b-[2.5rem] shadow-xl text-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-200 text-xs font-bold tracking-wider uppercase">Regional Oversight</p>
              <h1 className="text-2xl font-bold mt-1">Reg. Engr. {userName.split(' ')[0]}</h1>
              <p className="text-blue-100 mt-1 text-sm">
                Region {user?.region || ''} • Monitoring {projects.length} projects across all divisions.
              </p>
            </div>
            <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 shadow-inner text-xl">
              📍
            </div>
          </div>
        </div>

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
                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border-l-4 border-blue-500 flex flex-col justify-center min-h-[140px]">
                  <h3 className="text-[#004A99] dark:text-blue-400 font-bold text-sm flex items-center mb-1">
                    <span className="text-xl mr-2">📋</span>
                    Regional Oversight Portal
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed ml-7">
                    You have read-only access to monitor infrastructure progress across all divisions in your region.
                  </p>
                </div>
              </SwiperSlide>

              <SwiperSlide className="pb-8">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border-l-4 border-emerald-500 flex flex-col h-[140px]">
                  <h3 className="text-emerald-700 dark:text-emerald-400 font-bold text-sm flex items-center mb-2 shrink-0">
                    <span className="text-xl mr-2">🏗️</span>
                    Regional Active Projects ({projects.length})
                  </h3>
                  <div className="overflow-y-auto flex-1 pr-1 space-y-2 custom-scrollbar">
                    {projects.map((p) => (
                      <div key={p.id} className="flex justify-between items-center text-xs border-b border-slate-100 dark:border-slate-700 last:border-0 pb-1">
                        <span className="text-slate-700 dark:text-slate-200 font-medium truncate w-[60%]">{p.schoolName}</span>
                        <span className="text-[10px] text-slate-400 truncate w-[20%]">{p.division}</span>
                        <span className={`font-bold ${p.accomplishmentPercentage === 100 ? "text-emerald-600" : "text-blue-600"}`}>
                          {p.accomplishmentPercentage || 0}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </SwiperSlide>
            </Swiper>
          </div>

          <StatsChart projects={projects} />
          <CalendarWidget projects={projects} />
        </div>
        <BottomNav userRole="Regional Engineer" />
      </div>
    </PageTransition>
  );
};

export default RegionalEngineerDashboard;
