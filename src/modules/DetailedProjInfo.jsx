import React, { useState, useEffect, useContext, createContext } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import PageTransition from '../components/PageTransition';
import { getCachedProjects, cacheGallery, getCachedGallery, clearProjectsCache } from '../db';
import LocationPickerMap from '../components/LocationPickerMap';
import { TbPhoto } from "react-icons/tb";
import { useAuth } from '../context/AuthContext';
import EditProjectModal from '../components/EditProjectModal';
import ProjectEditModal from '../components/ProjectEditModal';
import { LuHistory, LuUser, LuCalendar, LuX, LuInfo, LuMapPin, LuShoppingBag, LuDollarSign, LuFileText, LuImages, LuEye, LuBox, LuLayoutDashboard, LuCamera, LuCheck, LuClipboardCheck } from "react-icons/lu";
import { FiSettings, FiImage, FiFileText } from 'react-icons/fi';
import { resolveAssetUrl, resolveDocUrl } from '../utils/assetHelper';
import HydraDocViewer from '../components/HydraDocViewer';

// --- SUB-COMPONENT: REMARKS HISTORY ---
const RemarksHistory = ({ history, loading, currentRemarks }) => {
    if (loading) return (
        <div className="bg-slate-50 dark:bg-slate-900/40 p-10 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col justify-center items-center gap-3">
            <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Synchronizing Archive...</p>
        </div>
    );

    const validHistory = history.filter(h => 
        (h.remarks && h.remarks.trim() !== "") || 
        h.update_type === 'Newly Created' || 
        h.update_type === 'Variation Order' ||
        h.update_type === 'Realignment'
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3 ml-1 mb-2">
                <LuHistory className="text-blue-500" size={18} />
                <h3 className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-[0.2em]">Official Update Log</h3>
            </div>
            
            {validHistory.length === 0 ? (
                <div className="bg-slate-50 dark:bg-black/10 p-10 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center">
                    <p className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[0.2em]">Zero historical records detected</p>
                </div>
            ) : (
                <div className="space-y-3 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100 dark:before:bg-slate-800">
                    {validHistory.map((entry, idx) => (
                        <div key={idx} className="bg-white dark:bg-[#0f172a] p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-blue-300 dark:hover:border-blue-900 transition-all ml-4">
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#002244] dark:bg-blue-600 transform -translate-x-full group-hover:translate-x-0 transition-transform"></div>
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-[#002244] dark:text-blue-400 border border-slate-100 dark:border-slate-700 shadow-sm">
                                        <LuUser size={14} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">{entry.engineerName || 'Field Engineer'}</p>
                                        <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest">{entry.update_type || 'Checkpoint'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-100 dark:border-slate-700">
                                    <LuCalendar size={10} className="text-slate-400" />
                                    <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-tighter">
                                        {new Date(entry.statusAsOfDate || entry.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-50 dark:border-slate-800/50 mb-3">
                                <p className="text-[12px] text-slate-700 dark:text-slate-300 font-medium leading-relaxed italic">
                                    {entry.remarks ? `"${entry.remarks}"` : <span className="text-slate-400 dark:text-slate-600 not-italic uppercase text-[10px] font-black tracking-widest">No narrative provided</span>}
                                </p>
                            </div>

                            {entry.delay_reason && (
                                <div className="mt-3 p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/20 border-l-4 border-l-red-500">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xs">⚠️</span>
                                        <span className="text-[9px] font-black text-red-700 dark:text-red-400 uppercase tracking-[0.2em]">Delay Logged</span>
                                    </div>
                                    <p className="text-[11px] font-black text-red-800 dark:text-red-300 mb-3 uppercase tracking-tight leading-tight">{entry.delay_reason}</p>
                                    <div className="flex flex-wrap gap-2">
                                        <div className="bg-white/60 dark:bg-black/20 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/30">
                                            <span className="text-[8px] font-black text-red-400 uppercase block tracking-tighter mb-0.5">Lapsed Time</span>
                                            <span className="text-[11px] font-black text-red-600 dark:text-red-400 uppercase">{(entry.time_lapsed_days || 0)} Days</span>
                                        </div>
                                        <div className="bg-white/60 dark:bg-black/20 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-900/30">
                                            <span className="text-[8px] font-black text-emerald-400 uppercase block tracking-tighter mb-0.5">Accomplishment</span>
                                            <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">{entry.time_lapsed_percentage || 0}%</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="mt-4 flex items-center gap-3 pt-3 border-t border-slate-50 dark:border-slate-800/50">
                                <span className="text-[8px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[0.2em]">Milestone:</span>
                                <span className="text-[10px] font-black text-[#002244] dark:text-blue-400 uppercase tracking-widest">{entry.status || 'Verified'}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- SUB-COMPONENT: VO COMPARISON ---
const VOComparison = ({ current, previous }) => {
    if (!previous) return null;

    const fieldsToCompare = [
        { key: 'projectName', label: 'Project Name' },
        { key: 'projectCategory', label: 'Category' },
        { key: 'scopeOfWork', label: 'Scope of Work' },
        { key: 'approved_budget_for_contract', label: 'Approved Budget for Contract (ABC)', isMoney: true },
        { key: 'contract_amount', label: 'Contract Amount', isMoney: true },
        { key: 'batchOfFunds', label: 'Batch' },
        { key: 'contractorName', label: 'Contractor' },
        { key: 'numberOfClassrooms', label: 'Classrooms' },
        { key: 'numberOfStoreys', label: 'Storeys' },
        { key: 'numberOfSites', label: 'Sites' },
        { key: 'targetCompletionDate', label: 'Target Completion' },
        { key: 'noticeToProceed', label: 'Notice to Proceed' },
        { key: 'constructionStartDate', label: 'Construction Start' },
        { key: 'fundsUtilized', label: 'Funds Utilized', isMoney: true },
        { key: 'latitude', label: 'Latitude' },
        { key: 'longitude', label: 'Longitude' },
        { key: 'vo_number', label: 'VO Number' },
        { key: 'vo_requested_date', label: 'Requested Date' },
        { key: 'vo_requested_by', label: 'Requested By' },
        { key: 'funding_year', label: 'Funding Year' }
    ];

    const changes = fieldsToCompare.filter(field => {
        let val1 = current[field.key];
        let val2 = previous[field.key];
        
        // Normalize for comparison
        if (field.isMoney) {
            val1 = Number(val1 || 0);
            val2 = Number(val2 || 0);
        } else {
            val1 = String(val1 || '').trim();
            val2 = String(val2 || '').trim();
        }
        
        return val1 !== val2;
    });

    if (changes.length === 0) return (
        <div className="bg-emerald-50/30 border border-emerald-100 p-3 rounded-xl">
            <p className="text-[10px] text-emerald-600 font-bold text-center italic">VO Snapshot: Specification values matched previous record.</p>
        </div>
    );

    return (
        <div className="space-y-2 mt-4">
            <h4 className="text-[9px] font-black text-amber-700 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
                Variation Changes (Old vs New)
            </h4>
            <div className="grid grid-cols-1 gap-2">
                {changes.map(field => (
                    <div key={field.key} className="bg-white/80 backdrop-blur-sm p-3 rounded-xl border border-amber-100 shadow-sm overflow-hidden group hover:border-amber-300 transition-all">
                        <p className="text-[9px] font-black text-amber-600 uppercase mb-2 tracking-wider">{field.label}</p>
                        <div className="flex items-center gap-2">
                            {/* Old */}
                            <div className="flex-1 min-w-0">
                                <div className="text-[8px] font-bold text-slate-400 uppercase mb-0.5">Previous</div>
                                <div className="text-xs font-bold text-slate-500 line-through decoration-slate-300 truncate">
                                    {field.isMoney ? `₱${Number(previous[field.key] || 0).toLocaleString()}` : (previous[field.key] || 'N/A')}
                                </div>
                            </div>
                            
                            {/* Arrow */}
                            <div className="flex-none text-amber-400 font-black text-lg group-hover:translate-x-1 transition-transform">→</div>
                            
                            {/* New */}
                            <div className="flex-1 min-w-0">
                                <div className="text-[8px] font-bold text-amber-700 uppercase mb-0.5">Updated</div>
                                <div className="text-xs font-black text-amber-900 truncate">
                                    {field.isMoney ? `₱${Number(current[field.key] || 0).toLocaleString()}` : (current[field.key] || 'N/A')}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- SUB-COMPONENT: VO HISTORY LIST ---
const VOHistoryList = ({ voHistory, loading }) => {
    if (loading) return (
        <div className="bg-slate-50 dark:bg-slate-900/40 p-10 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col justify-center items-center gap-3">
            <div className="w-6 h-6 border-2 border-amber-200 border-t-amber-500 rounded-full animate-spin"></div>
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Retrieving VO Records...</p>
        </div>
    );

    if (!voHistory || voHistory.length === 0) return null;

    return (
        <div className="space-y-4 mb-10">
            <div className="flex items-center justify-between ml-1 mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                        <LuDollarSign size={14} />
                    </div>
                    <h3 className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-[0.2em]">Variation Order Archive</h3>
                </div>
                <span className="text-[8px] font-black bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800 uppercase tracking-widest">Official EFD Snapshot</span>
            </div>
            
            <div className="space-y-4">
                {voHistory.map((vo, idx) => {
                   const netVal = parseFloat(vo.net_vo_amount || 0);
                   const isAdditive = netVal >= 0;
                   return (
                    <div key={idx} className={`bg-white dark:bg-[#0f172a] rounded-3xl border overflow-hidden shadow-sm transition-all hover:shadow-md ${isAdditive ? 'border-emerald-100 dark:border-emerald-900/30' : 'border-red-100 dark:border-red-900/30'}`}>
                        {/* Header Section */}
                        <div className={`p-5 flex flex-wrap items-center justify-between gap-4 ${isAdditive ? 'bg-emerald-50/20 dark:bg-emerald-900/10' : 'bg-red-50/20 dark:bg-red-900/10'}`}>
                           <div className="flex items-center gap-4">
                               <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner border ${isAdditive ? 'bg-white dark:bg-slate-800 text-emerald-600 border-emerald-100 dark:border-emerald-800' : 'bg-white dark:bg-slate-800 text-red-600 border-red-100 dark:border-red-800'}`}>
                                   {isAdditive ? '▲' : '▼'}
                               </div>
                               <div>
                                   <div className="flex items-center gap-2">
                                       <span className="text-[12px] font-black text-[#002244] dark:text-white tracking-tight uppercase">VO Sequence #{vo.vo_sequence_no || vo.vo_number || idx + 1}</span>
                                       <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg uppercase tracking-widest border ${isAdditive ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'}`}>
                                           {vo.vo_type || 'Adjustment'}
                                       </span>
                                   </div>
                                   <div className="flex items-center gap-2 mt-1">
                                       <LuCalendar size={10} className="text-slate-400" />
                                       <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-tighter">Effective {vo.requested_date ? new Date(vo.requested_date).toLocaleDateString() : 'N/A'}</span>
                                   </div>
                               </div>
                           </div>
                           <div className="text-right">
                               <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] block mb-0.5">NET ADJUSTMENT</span>
                               <span className={`text-lg font-black tracking-tight ${isAdditive ? 'text-emerald-600' : 'text-red-600'}`}>
                                   {isAdditive ? '+' : '-'} ₱{Number(Math.abs(netVal)).toLocaleString()}
                               </span>
                           </div>
                        </div>

                        {/* Details Grid */}
                        <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-6 border-t border-slate-50 dark:border-slate-800/50">
                            <div>
                                <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1.5">Revised Amount</span>
                                <span className="text-[12px] font-black text-[#002244] dark:text-slate-200">₱{Number(vo.revised_contract_amount || 0).toLocaleString()}</span>
                            </div>
                            <div>
                                <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1.5">Time Extension</span>
                                <span className="text-[12px] font-black text-blue-600 dark:text-blue-400">{vo.time_extension_days || 0} Days</span>
                            </div>
                            <div>
                                <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1.5">Revised Expiry</span>
                                <span className="text-[12px] font-black text-slate-700 dark:text-slate-300">{vo.revised_expiry_date ? new Date(vo.revised_expiry_date).toLocaleDateString() : 'NO CHANGE'}</span>
                            </div>
                            <div>
                                <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1.5">CAF Ref</span>
                                <span className="text-[12px] font-black text-slate-500 dark:text-slate-500 italic truncate block uppercase">{vo.caf_reference || 'Pending'}</span>
                            </div>
                        </div>

                        {/* Justification Footer */}
                        {(vo.justification || vo.justification_details) && (
                            <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-50 dark:border-slate-800/50">
                                <div className="flex items-start gap-4">
                                    <div className="flex-1">
                                        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                                            <span className="font-black text-[8px] text-slate-400 dark:text-slate-600 uppercase tracking-widest mr-2">TECHNICAL JUSTIFICATION:</span>
                                            {vo.justification_details || vo.justification}
                                        </p>
                                    </div>
                                    {vo.justification_category && (
                                        <span className="shrink-0 text-[8px] font-black bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-1 rounded uppercase tracking-tighter border border-slate-200 dark:border-slate-700">
                                            {vo.justification_category}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                   )
                })}
            </div>
        </div>
    );
};

// --- SUB-COMPONENT: REALIGNMENT COMPARISON ---
const RealignmentComparison = ({ current, previous, remarks }) => {
    if (!previous) return null;

    let sourceSchool = 'School B';
    if (remarks) {
        const match = remarks.match(/from (.*?) \(Full/);
        if (match && match[1]) sourceSchool = match[1];
        else {
            const sourceMatch = remarks.match(/transferred to (.*)\./);
            if (sourceMatch && sourceMatch[1]) sourceSchool = sourceMatch[1];
        }
    }

    const fieldsToCompare = [
        { key: 'projectName', label: 'Project Name' },
        { key: 'projectCategory', label: 'Category' },
        { key: 'scopeOfWork', label: 'Scope of Work' },
        { key: 'approved_budget_for_contract', label: 'ABC Budget', isMoney: true },
        { key: 'contract_amount', label: 'Contract Value', isMoney: true },
        { key: 'numberOfClassrooms', label: 'Classrooms' },
        { key: 'numberOfStoreys', label: 'Storeys' },
        { key: 'numberOfSites', label: 'Sites' },
        { key: 'contractorName', label: 'Contractor Associate' },
        { key: 'batchOfFunds', label: 'Fund Batch' },
        { key: 'targetCompletionDate', label: 'Completion Target' },
        { key: 'noticeToProceed', label: 'NTP Issuance' },
        { key: 'constructionStartDate', label: 'Start Date' }
    ];

    const changes = fieldsToCompare.filter(field => {
        let val1 = current[field.key];
        let val2 = previous[field.key];
        if (field.isMoney) {
            val1 = Number(val1 || 0);
            val2 = Number(val2 || 0);
        } else {
            val1 = String(val1 || '').trim();
            val2 = String(val2 || '').trim();
        }
        return val1 !== val2;
    });

    const isSource = remarks?.includes('transferred to');

    return (
        <div className="space-y-4">
            <h4 className="text-[10px] font-black text-purple-700 dark:text-purple-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.5)]"></div>
                {isSource ? 'Allocation Transfer Out (Migration)' : 'Allocation Transfer In (Aggregation)'}
            </h4>
            <div className="grid grid-cols-1 gap-3">
                {changes.map(field => (
                    <div key={field.key} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-purple-100 dark:border-purple-900/30 shadow-sm overflow-hidden group hover:border-purple-300 transition-all">
                        <div className="flex justify-between items-center mb-3">
                             <p className="text-[8px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest">{field.label}</p>
                             <span className="text-[7px] font-black bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-md uppercase tracking-tighter">Metric Sync</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="text-[7px] font-black text-slate-400 dark:text-slate-600 uppercase mb-1 tracking-tighter">Legacy Value</div>
                                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 line-through decoration-slate-300 dark:decoration-slate-700 truncate">
                                    {field.isMoney ? `₱${Number(previous[field.key] || 0).toLocaleString()}` : (previous[field.key] || 'N/A')}
                                </div>
                            </div>
                            
                            <div className="flex-none text-purple-400 font-black text-lg group-hover:px-2 transition-all">→</div>
                            
                            <div className="flex-1 min-w-0">
                                <div className="text-[7px] font-black text-purple-700 dark:text-purple-500 uppercase mb-1 tracking-tighter">Sync Value</div>
                                <div className="text-sm font-black text-[#002244] dark:text-white truncate">
                                    {field.isMoney ? `₱${Number(current[field.key] || 0).toLocaleString()}` : (current[field.key] || 'N/A')}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {changes.length === 0 && (
                <div className="bg-purple-50/30 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/20 p-4 rounded-2xl">
                    <p className="text-[10px] text-purple-600 dark:text-purple-400 font-black text-center italic uppercase tracking-widest">Specifications inherited without variance</p>
                </div>
            )}
        </div>
    );
};

// --- FIELD FORM CONTEXT (prevents focus loss caused by inline component re-creation on every render) ---
const FieldFormContext = createContext(null);

const SectionHeader = ({ title }) => (
    <h2 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4 border-b border-slate-100 dark:border-slate-800/50 pb-2 mt-8 first:mt-0">
        {title}
    </h2>
);

const Field = ({ label, name, value, type = 'text', options = [], readOnly = false }) => {
    const { isEditMode, formData, handleChange } = useContext(FieldFormContext) || {};
    if (!isEditMode || readOnly) {
        const isMoney = type === 'money';
        let displayValue = isMoney ? `₱${Number(value || 0).toLocaleString()}` : (value || '---');
        
        // Special handling for Status As Of to show time
        if (name === 'statusAsOf' && value) {
            try {
                const date = new Date(value);
                displayValue = `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
            } catch (e) {
                console.warn("Date parse error", e);
            }
        }

        return (
            <div className="mb-4 lg:mb-5 group">
                <p className="text-[8px] uppercase font-black text-slate-400 dark:text-slate-500 mb-1 tracking-widest leading-none">{label}</p>
                <p className={`text-[13px] font-black leading-tight uppercase tracking-tight ${readOnly && isEditMode ? 'text-slate-400/70 italic' : 'text-slate-800 dark:text-slate-200'}`}>
                    {displayValue}
                </p>
                {readOnly && isEditMode && (
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-tighter mt-1">Reference Only</p>
                )}
            </div>
        );
    }

    const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all";

    if (type === 'select') {
        return (
            <div className="mb-4">
                <label className="text-[10px] uppercase font-black text-slate-400 mb-1 block">{label}</label>
                <select name={name} value={formData[name] || ''} onChange={handleChange} className={inputClass}>
                    <option value="">Select {label}</option>
                    {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
            </div>
        );
    }

    return (
        <div className="mb-4">
            <label className="text-[10px] uppercase font-black text-slate-400 mb-1 block">{label}</label>
            <input
                type={type === 'date' ? 'date' : 'text'}
                name={name}
                value={formData[name] || ''}
                onChange={handleChange}
                className={inputClass}
                placeholder={`Enter ${label}`}
            />
        </div>
    );
};

const DetailedProjInfo = () => {
    const { user, token } = useAuth();
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const type = searchParams.get('type'); // 'LGU' or null
    const [project, setProject] = useState(null);
    const [formData, setFormData] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(0);
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedHydraDoc, setSelectedHydraDoc] = useState(null); // { type: 'POW', manifest: {...} }

    // History State
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [voHistory, setVoHistory] = useState([]);
    const [voHistoryLoading, setVoHistoryLoading] = useState(false);

    // New State for Images
    const [projectImages, setProjectImages] = useState([]);
    const [imageLoading, setImageLoading] = useState(true);

    // --- FORM/EDIT STATE ---
    const [internalFiles, setInternalFiles] = useState([]);
    const [internalPreviews, setInternalPreviews] = useState([]);
    const [externalFiles, setExternalFiles] = useState([]);
    const [externalPreviews, setExternalPreviews] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [selectedZoomImage, setSelectedZoomImage] = useState(null);
    const [zoomIndex, setZoomIndex] = useState(0);
    const [deletingImageId, setDeletingImageId] = useState(null);
    const [activeCategory, setActiveCategory] = useState('Internal');
    const [userRole, setUserRole] = useState(null);
    const [accountCategory, setAccountCategory] = useState(null);
    
    const [pendingDocs, setPendingDocs] = useState({ POW: null, DUPA: null, CONTRACT: null });
    // 'idle' | 'uploading' | 'success' | 'error'
    const [docStatus, setDocStatus] = useState({ POW: 'idle', DUPA: 'idle', CONTRACT: 'idle' });

    // Edit Modal State (single modal with 3 tabs)
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [voModalOpen, setVoModalOpen] = useState(false);
    const [realignModalOpen, setRealignModalOpen] = useState(false);

    const TABS = [
        { id: 0, label: 'Overview',  icon: <LuLayoutDashboard size={18} /> },
        { id: 2, label: 'Documents', icon: <LuFileText size={18} /> },
        { id: 3, label: 'Checklist', icon: <LuClipboardCheck size={18} /> }
    ];

    // Sorted images lifted to component level for slider navigation

    // Sorted images lifted to component level for slider navigation
    const sortedProjectImages = React.useMemo(() =>
        [...projectImages].sort((a, b) => new Date(b.uploaded_at || b.created_at || 0) - new Date(a.uploaded_at || a.created_at || 0)),
        [projectImages]
    );

    const openZoom = React.useCallback((img) => {
        const idx = sortedProjectImages.findIndex(i => i === img || (i.id && img?.id && i.id === img.id));
        const safeIdx = idx >= 0 ? idx : 0;
        setZoomIndex(safeIdx);
        const target = sortedProjectImages[safeIdx] || img;
        setSelectedZoomImage({ ...target, src: getImageSrc(target) });
    }, [sortedProjectImages]);

    // Keyboard navigation for zoom slider
    useEffect(() => {
        if (!selectedZoomImage) return;
        const handleKey = (e) => {
            if (e.key === 'ArrowLeft') {
                const newIdx = Math.max(0, zoomIndex - 1);
                setZoomIndex(newIdx);
                const img = sortedProjectImages[newIdx];
                if (img) setSelectedZoomImage({ ...img, src: getImageSrc(img) });
            } else if (e.key === 'ArrowRight') {
                const newIdx = Math.min(sortedProjectImages.length - 1, zoomIndex + 1);
                setZoomIndex(newIdx);
                const img = sortedProjectImages[newIdx];
                if (img) setSelectedZoomImage({ ...img, src: getImageSrc(img) });
            } else if (e.key === 'Escape') {
                setSelectedZoomImage(null);
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [selectedZoomImage, zoomIndex, sortedProjectImages]);


    // Helper to extract image source correctly
    const getImageSrc = (imageItem) => {
        if (!imageItem) return null;
        if (imageItem.image_url) return imageItem.image_url;
        
        // Handle image_data specifically
        let data = imageItem.image_data;
        if (!data) return null;

        // 1. If it's an object, extract the actual string
        if (typeof data === 'object' && data !== null) {
            data = data.image_data || data.base64 || data.url || JSON.stringify(data);
        }

        // 2. If it's a JSON string, parse it
        if (typeof data === 'string' && data.trim().startsWith('{')) {
            try {
                const parsed = JSON.parse(data);
                data = parsed.image_data || parsed.base64 || parsed.url || data;
            } catch (e) {
                console.warn("Failed to parse image JSON", e);
            }
        }

        // 3. Ensure we have a string for the final checks
        if (typeof data !== 'string') return null;

        // 4. Handle standard data URI, URL, or file path
        if (data.startsWith('data:') || data.startsWith('http')) {
            return data;
        }
        if (data.startsWith('/uploads/') || data.startsWith('/api/asset/')) {
            return resolveAssetUrl(data);
        }

        // 5. Otherwise assume it's raw base64 and wrap it
        return `data:image/jpeg;base64,${data}`;
    };

    // Helper to get consistently filtered images for gallery
    const getFilteredImages = (category) => {
        return projectImages.filter(img => {
            const cat = (img.category || 'Internal').toLowerCase();
            const hasData = (img.image_url || (img.image_data && img.image_data !== ''));
            if (!hasData) return false;
            
            if (category.toLowerCase() === 'external') {
                return cat === 'external';
            } else {
                return cat !== 'external' && cat !== 'default';
            }
        }).sort((a, b) => new Date(b.uploaded_at || b.created_at || 0) - new Date(a.uploaded_at || a.created_at || 0));
    };


    // Refs
    const fileInputRef = React.useRef(null);
    const cameraInputRef = React.useRef(null);

    const API_BASE = ""; // Or import from config

    const handleDeleteImage = async (imageId) => {
        if (!window.confirm("Delete this photo? This cannot be undone.")) return;
        setDeletingImageId(imageId);
        try {
            const res = await fetch(`${API_BASE}/api/project-images/${imageId}`, {
                method: 'DELETE',
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (!res.ok) throw new Error("Failed to delete image");
            setProjectImages(prev => prev.filter(img => img.id !== imageId));
            setSelectedZoomImage(null);
        } catch (err) {
            alert("Error deleting photo: " + err.message);
        } finally {
            setDeletingImageId(null);
        }
    };

    useEffect(() => {
        const fetchProjectDetails = async () => {
            if (!id || id === 'undefined' || id === 'null') {
                setIsLoading(false);
                return;
            }

            // Stale-While-Revalidate Strategy
            try {
                // 1. Immediate Cache Load
                console.log("DEBUG: Attempting cache load...");
                try {
                    const cachedProjects = await getCachedProjects();
                    const foundProject = cachedProjects.find(p => String(p.id) === String(id));
                    if (foundProject) {
                        setProject(foundProject);
                    }
                } catch (err) {
                    // Cache fail silent
                }

                // 2. Network Request (Background Sync)
                console.log("DEBUG: Starting network fetch for ID:", id);
                try {
                    const response = await fetch(`/api/projects/${id}?_t=${Date.now()}`, {
                        headers: token ? { Authorization: `Bearer ${token}` } : {}
                    });
                    if (!response.ok) throw new Error("Project not found");
                    const data = await response.json();
                    // Enrich data with explicit status keys so save payload always has them
                    const enrichedData = {
                        ...data,
                        procurementStatus: data.procurementStatus || data.procurement_status || data.status_design_phase || '',
                        statusDesignPhase: data.statusDesignPhase || data.status_design_phase || data.procurement_status || '',
                    };
                    setProject(enrichedData);
                    setFormData(enrichedData); // Sync form data
                } catch (err) {
                    console.warn("DEBUG: Network fetch failed, attempting LGU fallback:", err);
                    if (type === 'LGU') {
                        console.log("DEBUG: Fetching LGU project...");
                        // LGU Fetch
                        const response = await fetch(`/api/lgu/project/${id}`, {
                            headers: token ? { Authorization: `Bearer ${token}` } : {}
                        });
                        console.log("DEBUG: LGU response status:", response.status);
                        if (!response.ok) throw new Error("LGU Project not found");
                        const data = await response.json();
                        console.log("DEBUG: LGU data received");
                        
                        // MAP LGU Data ... (logic remains same)
                        const mappedProject = {
                            id: data.project_id,
                            schoolId: data.school_id,
                            schoolName: data.school_name,
                            projectName: data.project_name,
                            projectCategory: 'LGU Project',
                            ipc: data.ipc,
                            status: data.status,
                            accomplishmentPercentage: data.accomplishment_percentage,
                            otherRemarks: data.other_remarks,
                            noticeToProceed: data.noticeToProceed,
                            constructionStartDate: data.construction_start_date,
                            targetCompletionDate: data.targetCompletionDate,
                            actualCompletionDate: data.actualCompletionDate,
                            statusAsOfDate: data.statusAsOfDate,
                            contractorName: data.contractor_name,
                            scopeOfWork: data.scope_of_works || data.scope_of_work,
                            projectAllocation: data.project_allocation,
                            batchOfFunds: data.batch_of_funds || data.fund_source,
                            fundsUtilized: data.funds_utilized,
                            numberOfClassrooms: null,
                            numberOfStoreys: null,
                            numberOfSites: null,
                            region: data.region,
                            division: data.division,
                            pow_pdf: data.pow_pdf,
                            pow_size: data.pow_size,
                            dupa_pdf: data.dupa_pdf,
                            dupa_size: data.dupa_size,
                            contract_pdf: data.contract_pdf,
                            contract_size: data.contract_size,
                            moa_pdf: data.moa_pdf,
                            moa_size: data.moa_size,
                            rta_pdf: data.rta_pdf,
                            rta_size: data.rta_size,
                            latitude: data.latitude,
                            longitude: data.longitude,
                            lguData: {
                                sourceAgency: data.source_agency,
                                lsbResolutionNo: data.lsb_resolution_no,
                                moaRefNo: data.moa_ref_no,
                                validityPeriod: data.validity_period,
                                contractDuration: data.contract_duration,
                                modeOfProcurement: data.mode_of_procurement,
                                philgepsRefNo: data.philgeps_ref_no,
                                pcabLicenseNo: data.pcab_license_no,
                                dateContractSigning: data.date_contract_signing,
                                bidAmount: data.bid_amount,
                                natureOfDelay: data.nature_of_delay
                            },
                            isDonated: data.is_donated || false,
                            program_type: data.is_donated ? 'Donated' : 'BEFF',
                            images: data.images || []
                        };

                        setProject(mappedProject);
                        setFormData(mappedProject); // Sync form data

                        if (data.images) {
                            setProjectImages(data.images);
                            setImageLoading(false);
                        }
                    } else {
                        console.log("DEBUG: Not LGU mode, evaluating offline fallback");
                        if (!project) {
                            const cachedProjects = await getCachedProjects();
                            const foundProject = cachedProjects.find(p => String(p.id) === String(id));
                            if (!foundProject) {
                                console.log("DEBUG: Final fallback - project not found anywhere");
                                alert("Could not load project details (Offline & Not Cached).");
                                navigate('/engineer-dashboard');
                            }
                        }
                    }
                }
            } catch (finalErr) {
                console.error("DEBUG: Critical Fetch Error:", finalErr);
                if (!project) {
                    alert("Unable to load project details.");
                    navigate(-1);
                }
            } finally {
                console.log("DEBUG: Setting isLoading to false");
                setIsLoading(false);
            }
        };

        if (user) {
            setUserRole(user.role);
            setAccountCategory(user.account_category);
        }
        fetchProjectDetails();
        const fetchImages = async () => {
            if (type === 'LGU') return; // LGU images handled in main fetch

            setImageLoading(true);
            try {
                // Network First
                const res = await fetch(`/api/project-images/${id}?t=${Date.now()}`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });
                const data = await res.json();

                if (Array.isArray(data)) {
                    setProjectImages(data);
                    // Update Gallery Cache
                    await cacheGallery(id, data);
                } else {
                    console.warn("API did not return an array for images:", data);
                    setProjectImages([]);
                }
            } catch (error) {
                console.warn("Online gallery load failed, checking cache:", error);

                // Cache Fallback
                try {
                    const cachedImages = await getCachedGallery(id);
                    if (cachedImages && cachedImages.length > 0) {
                        setProjectImages(cachedImages);
                    }
                } catch (cacheErr) {
                    console.error("Cache retrieval failed", cacheErr);
                }
            } finally {
                setImageLoading(false);
            }
        };

        const fetchHistory = async (ipc) => {
            setHistoryLoading(true);
            try {
                const res = await fetch(`/api/project-history/${ipc}`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });
                if (!res.ok) throw new Error("Failed to fetch history");
                const data = await res.json();
                setHistory(data);
            } catch (err) {
                console.error("History fetch error:", err);
            } finally {
                setHistoryLoading(false);
            }
        };

        fetchProjectDetails();
        fetchImages();
        // Since project details fetch might update IPC, we handle history fetch there or when project is set
    }, [id, navigate]);

    useEffect(() => {
        if (selectedZoomImage !== null) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [selectedZoomImage]);

    useEffect(() => {
        if (!project?.ipc) return;

        const fetchHistory = async () => {
            setHistoryLoading(true);
            try {
                const res = await fetch(`/api/project-history/${project.ipc}`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });
                if (!res.ok) throw new Error("Failed to fetch history");
                const data = await res.json();
                setHistory(data);
            } catch (err) {
                console.error("History fetch error:", err);
            } finally {
                setHistoryLoading(false);
            }
        };

        const fetchVOHistory = async () => {
            setVoHistoryLoading(true);
            try {
                const res = await fetch(`/api/projects/variation-orders/${project.ipc}`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });
                if (res.ok) {
                    const data = await res.json();
                    setVoHistory(data);
                }
            } catch (err) {
                console.error("VO History Fetch Err:", err);
            } finally {
                setVoHistoryLoading(false);
            }
        };

        fetchHistory();
        fetchVOHistory();
    }, [project?.ipc]);

    // --- HANDLERS ---

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

    const handleChange = (e) => {
        let { name, value } = e.target;
        // Numeric constraint for School ID
        if (name === 'schoolId') {
            value = value.replace(/\D/g, '');
            if (value.length > 6) value = value.slice(0, 6);
        }
        // Force Uppercase
        if (['contractorName', 'projectName', 'scopeOfWork', 'batchOfFunds'].includes(name)) {
            value = value.toUpperCase();
        }

        // Auto-comma
        if (['approved_budget_for_contract', 'contract_amount', 'fundsUtilized'].includes(name)) {
            const raw = value.replace(/,/g, '').replace(/[^0-9.]/g, '');
            if (!raw) {
                value = '';
            } else {
                const parts = raw.split('.');
                parts[0] = Number(parts[0]).toLocaleString('en-US');
                value = parts.join('.');
            }
        }

        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveProject = async () => {
        const uid = user ? user.uid : localStorage.getItem('uid');
        if (!uid) return;

        setIsUploading(true);
        try {
            // APPEND LOGIC: We use POST to create a NEW row instead of PUT to update existing
            // The backend handles this as a newest version if unique constraints allow or if we just insert
            
            const payload = { 
                ...formData, 
                uid: uid, 
                engineer_id: uid,
                modifiedBy: user?.first_name || "Engineer",
                update_type: 'Details Update'
            };

            const response = await fetch(`${API_BASE}/api/save-project`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify(payload),
            });
            
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || errData.message || "Failed to append new project version");
            }
            const resData = await response.json();

            // Handle images if any new ones were added
            const allFiles = [
                ...internalFiles.map(f => ({ file: f, category: 'Internal' })),
                ...externalFiles.map(f => ({ file: f, category: 'External' }))
            ];

            if (allFiles.length > 0) {
                for (const item of allFiles) {
                    try {
                        const formData = new FormData();
                        formData.append('image', item.file);
                        formData.append('projectId', resData.project?.project_id || resData.id);
                        formData.append('uploadedBy', uid);
                        formData.append('category', item.category);
                        await fetch(`${API_BASE}/api/upload-image`, { 
                            method: "POST", 
                            body: formData,
                            headers: token ? { Authorization: `Bearer ${token}` } : {}
                        });
                    } catch (err) {
                        console.error("Image upload failed", err);
                    }
                }
            }
            // Step 3: Handle Document Uploads if any
            const docEntries = Object.entries(pendingDocs).filter(([_, file]) => file !== null);
            if (docEntries.length > 0) {
                for (const [type, file] of docEntries) {
                    try {
                        const docFormData = new FormData();
                        docFormData.append('document_pdf', file);
                        docFormData.append('projectId', resData.project?.project_id || resData.id || project.id);
                        docFormData.append('type', type);
                        docFormData.append('ipc', project.ipc || '');
                        docFormData.append('uid', uid);
                        
                        const docRes = await fetch(`${API_BASE}/api/upload-project-document`, {
                            method: 'POST',
                            headers: token ? { Authorization: `Bearer ${token}` } : {},
                            body: docFormData,
                        });
                        if (!docRes.ok) throw new Error(`${type} upload failed on server`);
                    } catch (err) {
                        console.error(`${type} upload failed`, err);
                        alert(`❌ ${type} upload failed: ${err.message}`);
                    }
                }
            }

            alert("✅ SUCCESS\n\nProject details and documents have been saved.");
            await clearProjectsCache(); 
            setIsEditMode(false);
            setInternalFiles([]);
            setExternalFiles([]);
            setPendingDocs({ POW: null, DUPA: null, CONTRACT: null });
            
            const newlySavedId = resData.project?.project_id || resData.id || project.id;
            if (String(newlySavedId) !== String(id)) {
                // Use navigate() instead of window.location.href to support HashRouter
                navigate(`/project-details/${newlySavedId}`, { replace: true });
            } else {
                // Same ID — just re-navigate to refresh the page within HashRouter
                navigate(`/project-details/${newlySavedId}`, { replace: true });
            }

        } catch (err) {
            console.error("Save Error:", err);
            const detailMsg = err.message || "Unknown Error";
            alert("Sync error:\n\n" + detailMsg + (err.stack ? "\n\nCheck console for full stack trace." : ""));
        } finally {
            setIsUploading(false);
        }
    };

    // Atomic document upload — fires immediately on file selection, independent of Save
    const handleAtomicUpload = async (key, file) => {
        if (!project?.ipc) {
            alert('Cannot upload: this project does not have an IPC assigned yet.');
            return;
        }
        if (!file) return;

        const uid = user ? user.uid : localStorage.getItem('uid');

        // Diagnostic log (helps confirm IPC/path before network call)
        console.log(`📎 [DOC UPLOAD] key=${key} ipc=${project.ipc} projectId=${project.id} file=${file.name} online=${navigator.onLine}`);
        if (!navigator.onLine) {
            console.warn('⚠️ [DOC UPLOAD] Device is offline — upload may fail');
        }

        setDocStatus(prev => ({ ...prev, [key]: 'uploading' }));

        try {
            const fd = new FormData();
            fd.append('document_pdf', file);
            fd.append('type', key);
            fd.append('projectId', String(project.id));
            fd.append('ipc', project.ipc);
            fd.append('uid', uid || '');

            const res = await fetch(`${API_BASE}/api/upload-project-document`, {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                body: fd,
            });

            const resText = await res.text();
            let resData;
            try {
                resData = JSON.parse(resText);
            } catch (e) {
                throw new Error(`Server returned invalid response (${res.status})`);
            }

            if (!res.ok) {
                throw new Error(resData.error || `HTTP ${res.status}`);
            }

            // Use the actual path returned by the API (binary storage: /api/asset/{id})
            const actualPath = resData.filePath || resData.data?.filePath || `/uploads/project_docs/${project.ipc}_${key}.pdf`;
            console.log(`✅ [DOC UPLOAD] Stored. Path: ${actualPath}`);

            setProject(prev => ({
                ...prev,
                [`${key.toLowerCase()}_pdf`]: actualPath,
                ...(resData.data?.file_size ? { [`${key.toLowerCase()}_size`]: resData.data.file_size } : {}),
            }));
            setDocStatus(prev => ({ ...prev, [key]: 'success' }));
            // Reset to idle after 3 s so the user can re-upload
            setTimeout(() => setDocStatus(prev => ({ ...prev, [key]: 'idle' })), 3000);
        } catch (err) {
            console.error(`❌ [DOC UPLOAD] ${key} failed:`, err.message);
            setDocStatus(prev => ({ ...prev, [key]: 'error' }));
        }
    };



    if (isLoading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading details...</div>;
    if (!project) return null;

    const renderOverview = () => (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-5">
            {/* --- TOP HUD: PROGRESS & STATUS --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#002244] dark:bg-[#0f172a] p-8 rounded-[2.5rem] shadow-2xl text-white relative overflow-hidden group border border-white/5">
                    <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-blue-500/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
                    <div className="relative z-10 flex flex-col h-full h-min-[140px]">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-200/60 mb-2">Overall Accomplishment</p>
                        <div className="flex items-baseline gap-3 mb-auto">
                            <span className="text-6xl font-black tracking-tighter">{isEditMode ? formData.accomplishmentPercentage : project.accomplishmentPercentage}%</span>
                            <span className="text-sm font-black uppercase tracking-widest text-blue-300/80">Complete</span>
                        </div>
                        
                        {isEditMode ? (
                           <div className="mt-6">
                               <input 
                                  type="range" 
                                  name="accomplishmentPercentage" 
                                  min="0" max="100" 
                                  value={formData.accomplishmentPercentage || 0} 
                                  onChange={handleChange}
                                  className="w-full accent-white h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer mb-2"
                               />
                               <p className="text-[8px] font-black uppercase tracking-widest text-blue-200/40 text-center">Slide to update progress</p>
                           </div>
                        ) : (
                          <div className="mt-6 w-full h-3 bg-white/10 rounded-full overflow-hidden p-0.5 border border-white/10 shadow-inner">
                              <div 
                                  className="h-full bg-gradient-to-r from-blue-400 to-emerald-400 rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                                  style={{ width: `${project.accomplishmentPercentage || 0}%` }}
                              ></div>
                          </div>
                        )}
                    </div>
                </div>

                <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl flex flex-col justify-center relative overflow-hidden group">
                    <div className="absolute top-[-10%] right-[-10%] w-32 h-32 bg-slate-50 dark:bg-slate-800/50 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-700"></div>
                    <div className="relative z-10 space-y-6">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-3 leading-none font-bold">Current Status</p>
                            <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.5)] animate-pulse ${
                                    (project.status || '').toLowerCase().includes('ongoing') ? 'bg-blue-500 shadow-blue-500/50' :
                                    (project.status || '').toLowerCase().includes('completed') ? 'bg-emerald-500 shadow-emerald-500/50' :
                                    'bg-slate-400 shadow-slate-400/50'
                                }`}></div>
                                {isEditMode ? (
                                    <select 
                                        name="status" 
                                        value={formData.status || ''} 
                                        onChange={handleChange}
                                        className="bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-3 py-1.5 text-sm font-black uppercase tracking-tight text-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                                    >
                                        {['Not Yet Started', 'Ongoing', 'For Final Inspection', 'Completed', 'Suspended', 'Terminated'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                ) : (
                                    <span className="text-2xl font-black text-[#002244] dark:text-white uppercase tracking-tight leading-none">
                                        {project.status || 'Ongoing'}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-2 leading-none font-bold">Status As Of</p>
                            {isEditMode ? (
                                <input 
                                    type="date" 
                                    name="statusAsOf" 
                                    value={formData.statusAsOf ? new Date(formData.statusAsOf).toISOString().split('T')[0] : ''} 
                                    onChange={handleChange}
                                    className="bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-3 py-1.5 text-xs font-black uppercase tracking-tight text-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                                />
                            ) : (
                                <span className="text-lg font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight leading-none">
                                    {project.statusAsOfDate || project.statusAsOf ? new Date(project.statusAsOfDate || project.statusAsOf).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '---'}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* --- CATEGORIZED DETAIL BLOCKS --- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Project Identity */}
                <div className="bg-white dark:bg-[#0f172a] p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="flex items-center gap-3 mb-6 pb-2 border-b border-slate-50 dark:border-slate-800/50">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500">
                            <LuFileText size={18} />
                        </div>
                        <h3 className="text-[9px] font-black text-[#002244] dark:text-blue-400 uppercase tracking-[0.2em]">Project Identity</h3>
                    </div>
                    <div className="space-y-4">
                        <Field label="IPC" name="ipc" value={project.ipc} readOnly={true} />
                        <Field label="Project Title" name="projectName" value={project.projectName} />
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="School ID" name="schoolId" value={project.schoolId} readOnly={true} />
                            <Field label="School Name" name="schoolName" value={project.schoolName} readOnly={true} />
                        </div>
                    </div>
                </div>

                {/* 2. Place & Jurisdiction */}
                <div className="bg-white dark:bg-[#0f172a] p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="flex items-center gap-3 mb-6 pb-2 border-b border-slate-50 dark:border-slate-800/50">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-500">
                            <LuMapPin size={18} />
                        </div>
                        <h3 className="text-[9px] font-black text-[#002244] dark:text-emerald-400 uppercase tracking-[0.2em]">Place & Jurisdiction</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                        <Field label="Region" name="region" value={project.region} readOnly={true} />
                        <Field label="Division" name="division" value={project.division} readOnly={true} />
                        <Field label="Province" name="province" value={project.province} readOnly={true} />
                        <Field label="Municipality" name="municipality" value={project.municipality} readOnly={true} />
                    </div>
                </div>

                {/* 3. Funding & Classification */}
                <div className="bg-white dark:bg-[#0f172a] p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="flex items-center gap-3 mb-6 pb-2 border-b border-slate-50 dark:border-slate-800/50">
                        <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-500">
                            <LuInfo size={18} />
                        </div>
                        <h3 className="text-[9px] font-black text-[#002244] dark:text-purple-400 uppercase tracking-[0.2em]">Funding & Classification</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                        <Field label="Project Type" name="projectCategory" value={project.projectCategory} readOnly={true} />
                        <Field label="Funding Year" name="funding_year" value={project.funding_year} readOnly={true} />
                        <Field label="Batch of Funds" name="batchOfFunds" value={project.batchOfFunds} readOnly={true} />
                    </div>
                </div>

                {/* 4. Investment & Implementation */}
                <div className="bg-white dark:bg-[#0f172a] p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="flex items-center gap-3 mb-6 pb-2 border-b border-slate-50 dark:border-slate-800/50">
                        <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-500">
                            <LuDollarSign size={18} />
                        </div>
                        <h3 className="text-[9px] font-black text-[#002244] dark:text-amber-400 uppercase tracking-[0.2em]">Investment & Contract</h3>
                    </div>
                    <div className="space-y-4">
                        <Field label="Contract Amount" name="contract_amount" value={project.contract_amount || project.contractAmount} type="money" readOnly={true} />
                        <Field label="Contractor Name" name="contractorName" value={project.contractorName} readOnly={true} />
                    </div>
                </div>
            </div>

            {/* --- PHYSICAL SCOPE --- */}
            <div className="bg-white dark:bg-[#0f172a] p-8 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                <div className="flex items-center gap-3 mb-8 pb-2 border-b border-slate-50 dark:border-slate-800/50">
                    <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center text-rose-500">
                        <LuBox size={18} />
                    </div>
                    <h3 className="text-[9px] font-black text-[#002244] dark:text-rose-400 uppercase tracking-[0.2em]">Physical Components & Assets</h3>
                </div>
                <div className="grid grid-cols-3 gap-8 text-center">
                    <Field label="Classrooms" name="numberOfClassrooms" value={project.numberOfClassrooms} readOnly={true} />
                    <Field label="Storeys" name="numberOfStoreys" value={project.numberOfStoreys} readOnly={true} />
                    <Field label="Sites" name="numberOfSites" value={project.numberOfSites} readOnly={true} />
                </div>
            </div>
        </div>
    );


    const renderHistory = () => (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            <SectionHeader title="Project Lifecycle History" />
            
            {voHistory.length > 0 && (
                <VOHistoryList voHistory={voHistory} loading={voHistoryLoading} />
            )}
            
            <RemarksHistory 
                history={history} 
                loading={historyLoading} 
                currentRemarks={project.otherRemarks || project.remarks} 
            />
        </div>
    );


    const renderMedia = () => {
        const featured = sortedProjectImages[0];
        const others = sortedProjectImages.slice(1);

        return (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                <SectionHeader title="Progress Documentation" />

                {sortedProjectImages.length === 0 ? (
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-12 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-200 dark:border-slate-800">
                        <LuImages size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-relaxed px-10">No documentation photos yet / Check connectivity</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Featured Recent Photo */}
                        {featured && (
                            <div
                                onClick={() => openZoom(featured)}
                                className="relative aspect-[16/10] rounded-[2rem] overflow-hidden shadow-2xl border-4 border-white dark:border-slate-800 group cursor-pointer active:scale-[0.98] transition-all"
                            >
                                <img
                                    src={getImageSrc(featured)}
                                    alt="Most Recent Update"
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                />
                                <div className="absolute top-6 right-6 bg-emerald-500 text-white px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 border border-white/20">
                                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                                    Most Recent Update
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                                    <p className="text-[9px] font-black text-white/70 uppercase tracking-[0.2em] mb-1">
                                        Captured Date {featured.file_size ? `• ${formatFileSize(featured.file_size)}` : ''}
                                    </p>
                                    <p className="text-xl font-black text-white uppercase tracking-tight">
                                        {new Date(featured.uploaded_at || featured.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Previous Photos Grid */}
                        {others.length > 0 && (
                            <div className="grid grid-cols-3 gap-3 mt-4">
                                {others.map((img, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => openZoom(img)}
                                        className="relative aspect-square rounded-2xl overflow-hidden shadow-lg border-2 border-white dark:border-slate-800 group cursor-pointer active:scale-95 transition-all"
                                    >
                                        <img
                                            src={getImageSrc(img)}
                                            alt={`Update ${idx + 2}`}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <LuEye size={24} className="text-white scale-50 group-hover:scale-100 transition-transform duration-300" />
                                        </div>
                                        <div className="absolute bottom-2 left-2 right-2 bg-[#002244]/80 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10">
                                            <p className="text-[7px] font-black text-white uppercase tracking-widest text-center truncate">
                                                {img.date_captured ? new Date(img.date_captured).toLocaleDateString() : 'Update Log'}
                                            </p>
                                        </div>
                                    </div>
                                ))}

                                <div
                                    onClick={() => navigate(`/project-gallery/${id}`)}
                                    className="aspect-square bg-blue-600 dark:bg-blue-700 rounded-2xl flex flex-col items-center justify-center border-2 border-white dark:border-slate-800 shadow-lg active:scale-95 transition-all cursor-pointer group overflow-hidden relative"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
                                    <TbPhoto size={32} className="text-white mb-2 relative z-10" />
                                    <span className="text-[8px] font-black text-white uppercase tracking-widest text-center px-4 relative z-10">Total {sortedProjectImages.length} Photos</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                
                {isEditMode && (
                    <div onClick={() => cameraInputRef.current?.click()} className="w-full bg-blue-50 dark:bg-blue-900/10 p-6 rounded-2xl flex items-center justify-center gap-3 border-2 border-dashed border-blue-200 dark:border-blue-800/50 hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-all cursor-pointer group active:scale-[0.99]">
                        <LuImages size={20} className="text-blue-500 group-hover:scale-110 transition-transform" />
                        <span className="text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Add Progress Documentation</span>
                    </div>
                )}
            </div>
        );
    };

    const formatFileSize = (bytes) => {
        if (!bytes) return "";
        if (bytes < 1024) return bytes + " B";
        const kb = bytes / 1024;
        if (kb < 1024) return kb.toFixed(1) + " KB";
        const mb = kb / 1024;
        return mb.toFixed(2) + " MB";
    };
    const renderDocuments = () => (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            <SectionHeader title="Essential Documents" />
            <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden divide-y divide-slate-50 dark:divide-slate-800/50">
                {['POW', 'DUPA', 'CONTRACT'].map(key => {
                    const docKey = `${key.toLowerCase()}_pdf`;
                    const hasExisting = !!project[docKey];
                    const status = docStatus[key]; // 'idle' | 'uploading' | 'success' | 'error'

                    // Check if Hydra Manifest exists for this document type
                    const manifestKey = key.toLowerCase();
                    const hydraManifest = project.hydra_manifest?.[manifestKey];

                    return (
                        <div key={key} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 gap-4 group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                            {/* Left: icon + label */}
                            <div className="flex items-center gap-5">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-sm ${
                                    status === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500' :
                                    status === 'error'   ? 'bg-red-50 dark:bg-red-900/20 text-red-400' :
                                    hasExisting         ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-500' :
                                                          'bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600'
                                }`}>
                                    {status === 'uploading'
                                        ? <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
                                        : <LuFileText size={24} />
                                    }
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest leading-none">{key}</p>
                                        {hydraManifest && (
                                            <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-[7px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border border-emerald-200 dark:border-emerald-800">Hydra Optimized</span>
                                        )}
                                    </div>
                                    <p className={`text-[8px] font-black mt-1 uppercase tracking-widest ${
                                        status === 'uploading' ? 'text-blue-400 animate-pulse' :
                                        status === 'success'   ? 'text-emerald-500' :
                                        status === 'error'     ? 'text-red-400' :
                                        hasExisting           ? 'text-slate-400 dark:text-slate-500' :
                                                                'text-slate-300 dark:text-slate-600'
                                    }`}>
                                        {status === 'uploading' ? 'Uploading...' :
                                         status === 'success'   ? '✅ Saved • Binary Encrypted' :
                                         status === 'error'     ? '❌ Upload failed' :
                                         hasExisting           ? `Available • ${project[`${key.toLowerCase()}_size`] ? formatFileSize(project[`${key.toLowerCase()}_size`]) : 'Archive'}` :
                                                                 'Pending Submission'}
                                    </p>
                                </div>
                            </div>

                            {/* Right: actions */}
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                {hasExisting && status !== 'uploading' && (
                                    <>
                                        {hydraManifest && (
                                            <button
                                                onClick={() => setSelectedHydraDoc({ type: key, manifest: hydraManifest })}
                                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 hover:scale-105 transition-all active:scale-95 shadow-lg shadow-emerald-900/20"
                                            >
                                                <LuEye size={14} />
                                                View Fast
                                            </button>
                                        )}
                                        <a
                                            href={resolveAssetUrl(project[docKey], { download: true })}
                                            download={`${project.schoolName}_${key}.pdf`}
                                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 border border-slate-200 dark:border-slate-700 shadow-sm"
                                        >
                                            Download
                                        </a>
                                    </>
                                )}

                                {/* Upload / Replace — available unless Regional Engineer */}
                                {userRole !== 'Regional Engineer' && (
                                    <label className={`flex-1 sm:flex-none cursor-pointer ${status === 'uploading' ? 'pointer-events-none opacity-50' : ''}`}>
                                        <div className={`text-center px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border shadow-lg ${
                                            status === 'error'   ? 'bg-red-50 text-red-600 border-red-200 shadow-red-900/10' :
                                            status === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-emerald-900/10' :
                                            hasExisting         ? 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-blue-300 shadow-sm' :
                                                                 'bg-blue-600 dark:bg-blue-700 text-white border-blue-600 dark:border-blue-800 shadow-blue-900/30 hover:scale-105'
                                        }`}>
                                            {status === 'error' ? 'Retry' : hasExisting ? 'Replace' : 'Upload PDF'}
                                        </div>
                                        <input
                                            type="file"
                                            accept="application/pdf"
                                            className="hidden"
                                            onChange={(e) => {
                                                const file = e.target.files[0];
                                                if (file) handleAtomicUpload(key, file);
                                                e.target.value = ''; // allow re-selecting the same file
                                            }}
                                        />
                                    </label>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const renderChecklist = () => {
        // Canonical triangulation task list — mirrors UpdateProjectWizard exactly
        const CANONICAL_TASKS = [
            { id: 1, task: 'Mobilization & Site Layout',         weight: 5  },
            { id: 2, task: 'Excavation & Foundation Work',       weight: 15 },
            { id: 3, task: 'Structural Framing (Beams/Columns)', weight: 20 },
            { id: 4, task: 'Roofing & Gutter System',            weight: 15 },
            { id: 5, task: 'Masonry & Wall Finishes',            weight: 15 },
            { id: 6, task: 'Electrical & Plumbing Rough-ins',    weight: 10 },
            { id: 7, task: 'Windows, Doors & Glass Works',       weight: 10 },
            { id: 8, task: 'Final Painting & Cleansing',         weight: 10 },
        ];

        // Load saved check state from project.checklist
        let savedState = {};
        try {
            const raw = project.checklist;
            if (raw && typeof raw === 'object' && !Array.isArray(raw)) savedState = raw;
            else if (typeof raw === 'string') savedState = JSON.parse(raw);
        } catch (e) { /* ignore parse errors */ }

        const triangulatedPct = Number(project.triangulated_percentage || 0);
        const accomplishmentPct = Number(project.accomplishmentPercentage || 0);
        const variance = Math.abs(triangulatedPct - accomplishmentPct);
        const numberOfStoreys = Number(project.numberOfStoreys || 1);

        const scoreColor = triangulatedPct >= 80 ? 'text-emerald-600 dark:text-emerald-400' : triangulatedPct >= 50 ? 'text-amber-500' : 'text-red-500';
        const scoreBg   = triangulatedPct >= 80 ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800' : triangulatedPct >= 50 ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800' : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800';

        const checkedCount = CANONICAL_TASKS.filter(t => savedState[t.id] === true || savedState[String(t.id)] === true).length;

        return (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-5">
                <SectionHeader title="Construction Triangulation" />

                {/* Building Info + Score Card */}
                <div className={`rounded-2xl p-6 border-2 shadow-xl ${scoreBg} relative overflow-hidden group`}>
                    <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white/50 dark:bg-black/10 rounded-full blur-2xl group-hover:scale-110 transition-transform"></div>
                    
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <div>
                            <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">
                                {numberOfStoreys}-Storey Building • {CANONICAL_TASKS.length} Phases
                            </p>
                            <div className="flex items-baseline gap-2">
                                <span className={`text-4xl font-black ${scoreColor}`}>{triangulatedPct}%</span>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Triangulated</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">Reported Progress</p>
                            <span className="text-2xl font-black text-slate-700 dark:text-slate-300">{accomplishmentPct}%</span>
                            {variance > 10 && (
                                <p className="text-[9px] font-black text-amber-600 dark:text-amber-500 mt-1 flex items-center justify-end gap-1">
                                    ⚠ {variance}% Variance Detected
                                </p>
                            )}
                        </div>
                    </div>
                    
                    <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-3 overflow-hidden p-0.5 border border-white/20 dark:border-slate-700 shadow-inner mb-3">
                        <div
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${triangulatedPct >= 80 ? 'bg-emerald-500' : triangulatedPct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${triangulatedPct}%` }}
                        />
                    </div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{checkedCount} of {CANONICAL_TASKS.length} Engineering Phases Verified</p>
                </div>

                {/* Phase Checklist */}
                <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden divide-y divide-slate-50 dark:divide-slate-800/50">
                    {CANONICAL_TASKS.map((task) => {
                        const isChecked = savedState[task.id] === true || savedState[String(task.id)] === true;
                        return (
                            <div key={task.id} className={`flex items-center gap-4 px-6 py-5 transition-colors ${isChecked ? 'bg-emerald-50/20 dark:bg-emerald-900/5' : 'hover:bg-slate-50 dark:hover:bg-slate-800/20'}`}>
                                {/* Phase number */}
                                <div className={`w-9 h-9 rounded-xl flex-none flex items-center justify-center text-[11px] font-black ${isChecked ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600'}`}>
                                    {String(task.id).padStart(2, '0')}
                                </div>

                                {/* Check icon */}
                                <div className={`w-6 h-6 rounded-lg flex-none flex items-center justify-center border-2 transition-all ${isChecked ? 'bg-emerald-500 border-emerald-500 rotate-0 scale-100' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rotate-12 scale-90'}`}>
                                    {isChecked && (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    )}
                                </div>

                                {/* Label */}
                                <div className="flex-1 min-w-0">
                                    <p className={`text-[12px] font-black uppercase tracking-tight leading-tight transition-colors ${isChecked ? 'text-slate-800 dark:text-white' : 'text-slate-400 dark:text-slate-600 font-bold'}`}>
                                        {task.task}
                                    </p>
                                </div>

                                {/* Weight badge */}
                                <span className={`flex-none text-[9px] font-black px-2.5 py-1.5 rounded-lg border uppercase tracking-widest ${isChecked ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border-transparent'}`}>
                                    {task.weight}%
                                </span>
                            </div>
                        );
                    })}
                </div>

                {triangulatedPct === 0 && checkedCount === 0 && (
                    <div className="p-10 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20">
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-relaxed">
                            No construction triangulation data / Project initialized
                        </p>
                    </div>
                )}
            </div>
        );
    };

    return (
        <>
        <PageTransition>
            <div className="min-h-screen bg-slate-50 dark:bg-[#080c14] pb-24 transition-colors">
                {/* --- PREMIUM HEADER --- */}
                <div className="bg-[#002244] dark:bg-[#0f172a] px-6 pt-10 pb-20 rounded-b-[3.5rem] shadow-2xl relative overflow-hidden transition-colors">
                    <div className="absolute top-[-10%] right-[-10%] w-80 h-80 bg-blue-600/10 rounded-full blur-3xl animate-pulse"></div>
                    <div className="absolute bottom-[-10%] left-[-10%] w-60 h-60 bg-emerald-600/5 rounded-full blur-3xl"></div>
                    
                    <div className="flex justify-between items-start relative z-10">
                        <button onClick={() => navigate(-1)} className="p-3 -ml-2 bg-white/10 dark:bg-white/5 border border-white/10 rounded-2xl text-white hover:bg-white/20 transition-all active:scale-90">
                            <LuX size={20} />
                        </button>
                        
                        <div className="flex gap-2">
                            <button
                                onClick={() => navigate(`/project-gallery/${id}`)}
                                className="px-5 py-3 bg-white/10 dark:bg-white/5 border border-white/20 rounded-2xl text-[10px] font-black text-white hover:bg-white/20 transition-all active:scale-95 uppercase tracking-widest flex items-center gap-2"
                            >
                                <LuImages size={16} /> Gallery
                            </button>
                        </div>
                    </div>

                    <div className="mt-6 relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
                            <span className="text-[9px] font-black text-white/50 uppercase tracking-[0.2em]">{project.projectCategory}</span>
                        </div>
                        <h1 className="text-2xl font-black text-white leading-tight tracking-tight mb-4">{project.schoolName}</h1>
                        
                        {/* Tab Stepper (Compact Icon Boxes) */}
                        <div className="grid grid-cols-4 gap-2 pb-2">
                            {TABS.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    title={tab.label}
                                    className={`aspect-square flex flex-col items-center justify-center rounded-xl transition-all ${
                                        activeTab === tab.id
                                        ? 'bg-white text-[#004A99] shadow-lg scale-105'
                                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                                    }`}
                                >
                                    {tab.icon}
                                </button>
                            ))}
                            {userRole !== 'Regional Engineer' && (
                                <button
                                    onClick={() => setEditModalOpen(true)}
                                    title="Variation"
                                    className="aspect-square flex flex-col items-center justify-center rounded-xl transition-all bg-amber-400/20 text-amber-200 hover:bg-amber-400/30 border border-amber-400/30"
                                >
                                    <FiSettings size={16} />
                                </button>
                             )}
                        </div>
                    </div>
                </div>

                {/* --- CONTENT AREA --- */}
                <div className="px-5 -mt-10 relative z-20">
                    <FieldFormContext.Provider value={{ isEditMode, formData, handleChange }}>
                    <div className="bg-white p-6 rounded-[2.5rem] shadow-xl shadow-slate-200/50 min-h-[400px]">
                        {activeTab === 0 && renderOverview()}
                        {activeTab === 1 && renderMedia()}
                        {activeTab === 2 && renderDocuments()}
                        {activeTab === 3 && renderChecklist()}
                        {activeTab === 4 && renderHistory()}
                    </div>
                    </FieldFormContext.Provider>
                </div>

                    <div className="fixed bottom-0 left-0 right-0 p-5 z-[50]">
                         <div className="max-w-xs mx-auto bg-white/90 backdrop-blur-md px-6 py-4 rounded-3xl shadow-2xl border border-white flex justify-between items-center">
                             <button 
                                onClick={() => setActiveTab(prev => Math.max(0, prev - 1))}
                                disabled={activeTab === 0}
                                className={`p-2 rounded-xl transition-all ${activeTab === 0 ? 'text-slate-200' : 'text-[#004A99] bg-blue-50'}`}
                             >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                             </button>
                             
                             <div className="flex gap-1.5">
                                 {TABS.map(t => (
                                     <div key={t.id} className={`h-1.5 rounded-full transition-all ${activeTab === t.id ? 'w-6 bg-[#004A99]' : 'w-1.5 bg-slate-200'}`}></div>
                                 ))}
                             </div>

                             <button 
                                onClick={() => setActiveTab(prev => Math.min(TABS.length - 1, prev + 1))}
                                disabled={activeTab === TABS.length - 1}
                                className={`p-2 rounded-xl transition-all ${activeTab === TABS.length - 1 ? 'text-slate-200' : 'text-[#004A99] bg-blue-50'}`}
                             >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                             </button>
                         </div>
                    </div>


                {/* --- ZOOM / SLIDER MODAL (PORTALLED) --- */}
                {selectedZoomImage && createPortal(
                    <div
                        className="fixed inset-0 bg-black/95 z-[9999] animate-in fade-in duration-300"
                        onClick={() => setSelectedZoomImage(null)}
                    >
                        {/* ── Image area (padded so controls don't overlap) ── */}
                        <div
                            className="absolute"
                            style={{ top: 72, bottom: 96, left: 72, right: 72 }}
                        >
                            <div className="w-full h-full flex items-center justify-center">
                                <img
                                    key={zoomIndex}
                                    src={selectedZoomImage.src || getImageSrc(selectedZoomImage)}
                                    alt={`Photo ${zoomIndex + 1}`}
                                    className="max-w-full max-h-full object-contain rounded-xl shadow-2xl animate-in zoom-in-95 duration-300"
                                    style={{ transform: 'translateZ(0)' }}
                                    onClick={e => e.stopPropagation()}
                                    onError={(e) => {
                                        const fallback = getImageSrc(selectedZoomImage);
                                        if (fallback && e.target.src !== fallback) {
                                            e.target.src = fallback;
                                        } else {
                                            e.target.style.display = 'none';
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        {/* ── Top bar: Delete | Counter | Close ── */}
                        <div
                            className="absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-5 z-10"
                            onClick={e => e.stopPropagation()}
                        >
                            <button
                                onClick={() => handleDeleteImage(selectedZoomImage.id)}
                                disabled={deletingImageId === selectedZoomImage.id}
                                className="w-10 h-10 rounded-full bg-red-600/80 hover:bg-red-600 text-white flex items-center justify-center border border-red-400/30 transition-all active:scale-90"
                                title="Delete photo"
                            >
                                {deletingImageId === selectedZoomImage.id
                                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    : <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                                }
                            </button>

                            {sortedProjectImages.length > 1 && (
                                <span className="bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-black text-white uppercase tracking-widest border border-white/10">
                                    {zoomIndex + 1} / {sortedProjectImages.length}
                                </span>
                            )}

                            <button
                                onClick={() => setSelectedZoomImage(null)}
                                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/20 transition-all active:scale-90"
                            >
                                <LuX size={20} />
                            </button>
                        </div>

                        {/* ── LEFT arrow ── */}
                        {sortedProjectImages.length > 1 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const newIdx = Math.max(0, zoomIndex - 1);
                                    setZoomIndex(newIdx);
                                    const img = sortedProjectImages[newIdx];
                                    if (img) setSelectedZoomImage({ ...img, src: getImageSrc(img) });
                                }}
                                disabled={zoomIndex === 0}
                                className="absolute left-3 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center rounded-full border-2 transition-all active:scale-90"
                                style={{
                                    width: 52, height: 52,
                                    background: zoomIndex === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.6)',
                                    borderColor: zoomIndex === 0 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)',
                                    color: zoomIndex === 0 ? 'rgba(255,255,255,0.2)' : 'white',
                                    cursor: zoomIndex === 0 ? 'not-allowed' : 'pointer',
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                            </button>
                        )}

                        {/* ── RIGHT arrow ── */}
                        {sortedProjectImages.length > 1 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const newIdx = Math.min(sortedProjectImages.length - 1, zoomIndex + 1);
                                    setZoomIndex(newIdx);
                                    const img = sortedProjectImages[newIdx];
                                    if (img) setSelectedZoomImage({ ...img, src: getImageSrc(img) });
                                }}
                                disabled={zoomIndex === sortedProjectImages.length - 1}
                                className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center rounded-full border-2 transition-all active:scale-90"
                                style={{
                                    width: 52, height: 52,
                                    background: zoomIndex === sortedProjectImages.length - 1 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.6)',
                                    borderColor: zoomIndex === sortedProjectImages.length - 1 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)',
                                    color: zoomIndex === sortedProjectImages.length - 1 ? 'rgba(255,255,255,0.2)' : 'white',
                                    cursor: zoomIndex === sortedProjectImages.length - 1 ? 'not-allowed' : 'pointer',
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                            </button>
                        )}

                        {/* ── Bottom: dots + metadata ── */}
                        <div
                            className="absolute bottom-0 left-0 right-0 h-24 flex flex-col items-center justify-end pb-5 gap-2 z-10"
                            onClick={e => e.stopPropagation()}
                        >
                            {sortedProjectImages.length > 1 && (
                                <div className="flex gap-1.5 mb-1">
                                    {sortedProjectImages.map((_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => {
                                                setZoomIndex(i);
                                                const img = sortedProjectImages[i];
                                                if (img) setSelectedZoomImage({ ...img, src: getImageSrc(img) });
                                            }}
                                            className={`h-1.5 rounded-full transition-all ${i === zoomIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/30 hover:bg-white/60'}`}
                                        />
                                    ))}
                                </div>
                            )}
                            <div className="flex items-center gap-3 text-center">
                                <span className="bg-blue-600/30 text-blue-300 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-500/20">
                                    {selectedZoomImage.category || 'Documentation'}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                    {new Date(selectedZoomImage.uploaded_at || selectedZoomImage.created_at || Date.now()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                </span>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
            </div>
        </PageTransition>

        {selectedHydraDoc && (
            <HydraDocViewer 
                manifest={selectedHydraDoc.manifest}
                title={`${selectedHydraDoc.type}: ${project.schoolName}`}
                onClose={() => setSelectedHydraDoc(null)}
                onDownload={() => {
                    const docKey = `${selectedHydraDoc.type.toLowerCase()}_pdf`;
                    const url = resolveAssetUrl(project[docKey], { download: true });
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `${project.schoolName}_${selectedHydraDoc.type}.pdf`;
                    link.click();
                }}
            />
        )}


        <ProjectEditModal
            project={project}
            isOpen={editModalOpen}
            onClose={() => setEditModalOpen(false)}
            onSaveDetails={async (payload, siteImages = []) => {
                const isFormData = payload instanceof FormData;
                const projectId = isFormData ? payload.get('id') : payload.id;
                const res = await fetch(`/api/update-project/${projectId}`, {
                    method: 'PUT',
                    headers: isFormData ? {} : { 'Content-Type': 'application/json' },
                    body: isFormData ? payload : JSON.stringify(payload),
                });
                if (!res.ok) {
                    const errBody = await res.json().catch(() => ({}));
                    throw new Error(errBody.message || errBody.error || 'Update failed');
                }
                const resData = await res.json();

                // Orchestrate Site Image Uploads if any
                if (siteImages.length > 0) {
                    // Small delay to ensure snapshot is ready for linking
                    await new Promise(resolve => setTimeout(resolve, 800));

                    for (const item of siteImages) {
                        try {
                            const imgFormData = new FormData();
                            imgFormData.append('image', item.file);
                            imgFormData.append('projectId', resData.project?.project_id || resData.id);
                            imgFormData.append('uploadedBy', user?.uid);
                            imgFormData.append('category', item.category);

                            await fetch(`/api/upload-image`, {
                                method: 'POST',
                                body: imgFormData,
                            });
                        } catch (err) {
                            console.error("Image upload failed:", err);
                        }
                    }
                }

                setEditModalOpen(false);
                window.location.reload();
            }}
            onSaveVO={async (payload) => {
                try {
                    const isFormData = payload instanceof FormData;
                    const projectId = isFormData ? payload.get('id') : payload.id;
                    const res = await fetch(`/api/update-project/${projectId}`, {
                        method: 'PUT',
                        headers: isFormData ? {} : { 'Content-Type': 'application/json' },
                        body: isFormData ? payload : JSON.stringify(payload),
                    });
                    if (!res.ok) throw new Error('Update failed');
                    alert('✅ Variation Order recorded!');
                    setEditModalOpen(false);
                    window.location.reload();
                } catch (err) { alert('Error: ' + err.message); }
            }}
            onSaveRealign={async (payload) => {
                try {
                    const isFormData = payload instanceof FormData;
                    const projectId = isFormData ? payload.get('id') : payload.id;
                    const res = await fetch(`/api/update-project/${projectId}`, {
                        method: 'PUT',
                        headers: isFormData ? {} : { 'Content-Type': 'application/json' },
                        body: isFormData ? payload : JSON.stringify(payload),
                    });
                    if (!res.ok) throw new Error('Update failed');
                    alert('✅ Realignment submitted!');
                    setEditModalOpen(false);
                    window.location.reload();
                } catch (err) { alert('Error: ' + err.message); }
            }}
        />
        </>
    );
};

export default DetailedProjInfo;