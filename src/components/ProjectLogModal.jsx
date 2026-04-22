import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { createPortal } from 'react-dom';
import { LuX, LuHistory, LuUser, LuCalendar } from "react-icons/lu";
import { FiActivity, FiCheckCircle, FiEdit2, FiMessageSquare } from 'react-icons/fi';

const ProjectLogModal = ({ isOpen, onClose, project }) => {
    const { token } = useAuth();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen) {
            // Lock body scroll
            document.body.style.overflow = 'hidden';
            if (project?.ipc) {
                fetchHistory();
            }
        }
        
        return () => {
            // Restore body scroll
            document.body.style.overflow = 'unset';
            if (!isOpen) {
                setHistory([]);
                setError(null);
            }
        };
    }, [isOpen, project]);

    const fetchHistory = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/project-history/${encodeURIComponent(project.ipc)}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setHistory(data);
        } catch (err) {
            console.error("Error fetching history:", err);
            setError("Could not load project history.");
        } finally {
            setLoading(false);
        }
    };

    const formatPHTimestamp = (dateString) => {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return dateString;
            return date.toLocaleString('en-US', {
                timeZone: 'Asia/Manila',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
            });
        } catch {
            return dateString;
        }
    };

    const generateSentences = (rows) => {
        if (!rows.length) return [];

        // Rows come from API ASC (oldest first).
        const chronologicalRows = [...rows];
        const logs = [];

        // First row = project creation
        const first = chronologicalRows[0];
        logs.push({
            text: `Project was created${first.engineerName ? ` by Engr. ${first.engineerName}` : ''}.`,
            date: first.status_as_of || first.statusAsOfDate || first.created_at,
            user: first.engineerName,
            type: 'create',
        });

        // Compare consecutive rows for changes
        for (let i = 1; i < chronologicalRows.length; i++) {
            const prev = chronologicalRows[i - 1];
            const curr = chronologicalRows[i];
            const date = curr.status_as_of || curr.statusAsOfDate || curr.created_at;
            const currRemark = curr.remarks || curr.otherRemarks || curr.other_remarks;
            const prevRemark = prev.remarks || prev.otherRemarks || prev.other_remarks;
            const remark = (currRemark && currRemark !== prevRemark) ? currRemark : null;

            // Helper to get accomplishment percentage
            const getPct = (row) => {
                const val = row.accomplishmentPercentage ?? row.accomplishment_percentage ?? 0;
                return parseInt(val) || 0;
            };

            const prevPct = getPct(prev);
            const currPct = getPct(curr);
            const prevProc = prev.procurement_status || prev.status_design_phase || prev.procurementStatus || 'Unset';
            const currProc = curr.procurement_status || curr.status_design_phase || curr.procurementStatus || 'Unset';
            const prevStat = prev.status || prev.status_of_construction_phase || 'Unset';
            const currStat = curr.status || curr.status_of_construction_phase || 'Unset';

            const procChanged = currProc.toLowerCase() !== prevProc.toLowerCase();
            const constChanged = currStat !== prevStat;
            const pctChanged = currPct !== prevPct;

            const changes = [];
            if (procChanged) changes.push({ label: 'Procurement', from: prevProc, to: currProc });
            if (constChanged) changes.push({ label: 'Construction', from: prevStat, to: currStat });
            if (pctChanged) changes.push({ label: 'Completion', from: `${prevPct}%`, to: `${currPct}%` });

            if (changes.length > 0) {
                logs.push({
                    user: curr.engineerName,
                    date,
                    type: 'update',
                    changes,
                    remark,
                });
            } else if (remark) {
                // Only-remark entry when nothing structural changed
                logs.push({
                    user: curr.engineerName,
                    date,
                    type: 'remark',
                    text: `Updated remarks: "${remark}"`,
                    remark,
                });
            }
        }

        return logs.reverse(); // Newest first
    };

    if (!isOpen) return null;

    const logs = generateSentences(history);

    const iconForType = (type) => {
        if (type === 'create') return <FiCheckCircle size={10} className="text-white" />;
        if (type === 'remark') return <FiMessageSquare size={10} className="text-white" />;
        return <FiEdit2 size={10} className="text-white" />;
    };

    const colorForType = (type) => {
        if (type === 'create') return 'bg-emerald-500';
        if (type === 'remark') return 'bg-amber-500';
        return 'bg-blue-500';
    };

    const renderRemarkStr = (remarkStr) => {
        if (!remarkStr) return null;
        
        const match = remarkStr.match(/^\[Justification:\s*(.*?)\](.*)$/is);
        if (match) {
            const rawCategories = match[1].trim();
            const comment = match[2].trim();

            // Smart split: split by ", " but not inside parentheses
            const justifications = [];
            let depth = 0;
            let current = '';
            for (let i = 0; i < rawCategories.length; i++) {
                const ch = rawCategories[i];
                if (ch === '(') depth++;
                else if (ch === ')') depth--;
                // Split on ", " only at depth 0
                if (depth === 0 && rawCategories.slice(i, i + 2) === ', ') {
                    if (current.trim()) justifications.push(current.trim());
                    current = '';
                    i++; // skip the space
                    continue;
                }
                current += ch;
            }
            if (current.trim()) justifications.push(current.trim());

            // Clean up each justification (handle "Others (custom reason)")
            const cleanedJustifications = justifications.map(j => {
                const othersMatch = j.match(/^others\s*\((.*?)\)$/i);
                if (othersMatch) return { text: othersMatch[1], isCustom: true };
                if (j.toLowerCase() === 'others') return null; // Others with no text — skip
                return { text: j, isCustom: false };
            }).filter(Boolean);

            return (
                <div className="flex flex-col gap-2">
                    {cleanedJustifications.length > 0 && (
                        <ul className="space-y-1.5 pl-0">
                            {cleanedJustifications.map((item, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                    <span className={`mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full ${item.isCustom ? 'bg-slate-400' : 'bg-amber-500'}`} />
                                    <span className={`text-[10px] leading-relaxed break-words ${item.isCustom ? 'font-medium text-slate-600 italic' : 'font-bold text-amber-800'}`}>
                                        {item.text}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                    {comment && comment !== 'null' && comment !== 'undefined' && comment !== '' && (
                        <div className="flex flex-col gap-1 border-t border-amber-200/40 pt-2 mt-1">
                            <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Additional Notes</span>
                            <p className="text-[10px] font-medium text-slate-600 italic leading-relaxed break-words">
                                "{comment}"
                            </p>
                        </div>
                    )}
                </div>
            );
        }
        
        return <p className="text-[10px] font-bold text-amber-700 italic leading-relaxed break-words">"{remarkStr}"</p>;
    };

    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300 h-screen h-[100dvh]">
            <div 
                className="bg-white w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] max-h-[85dvh] animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-blue-600">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-white backdrop-blur-md">
                            <LuHistory size={20} />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-white uppercase tracking-widest">Project Log</h2>
                            <p className="text-[10px] text-blue-100 font-bold uppercase truncate max-w-[220px] sm:max-w-xs">{project?.projectName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center bg-white/10 text-white rounded-2xl hover:bg-white/20 transition-all border border-white/10"
                    >
                        <LuX size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="w-10 h-10 border-4 border-blue-50 border-t-blue-600 rounded-full animate-spin"></div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Retrieving Logs...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                            <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">{error}</p>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                                <FiActivity size={32} />
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No activity logged yet</p>
                            <p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">IPC: {project?.ipc}</p>
                        </div>
                    ) : (
                        <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                            {logs.map((log, idx) => (
                                <div key={idx} className="relative group">
                                    <div className={`absolute -left-[30px] w-[22px] h-[22px] rounded-full border-4 border-white shadow-md z-10 flex items-center justify-center ${colorForType(log.type)}`}>
                                        {iconForType(log.type)}
                                    </div>
                                    <div className="bg-slate-50/50 p-4 rounded-[1.5rem] border border-slate-100 group-hover:border-blue-100 group-hover:bg-white transition-all">
                                        <div className="flex justify-between items-center mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                                                    <LuUser size={10} />
                                                </div>
                                                <span className="text-[9px] font-black text-slate-600 uppercase tracking-tight">{log.user || 'System'}</span>
                                            </div>
                                            {log.date && (
                                                <div className="flex items-center gap-1.5 text-slate-400">
                                                    <LuCalendar size={10} />
                                                    <span className="text-[9px] font-bold">{formatPHTimestamp(log.date)}</span>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {log.type === 'create' ? (
                                            <p className="text-[11px] font-bold text-slate-700 leading-relaxed">{log.text}</p>
                                        ) : log.type === 'update' ? (
                                            <div className="space-y-3">
                                                {log.changes.map((change, cIdx) => (
                                                    <div key={cIdx} className="flex flex-col gap-1">
                                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{change.label}</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-medium text-slate-400 line-through decoration-slate-200">{change.from}</span>
                                                            <div className="w-3 h-px bg-slate-200" />
                                                            <span className="text-[11px] font-black text-blue-600">{change.to}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                                {log.remark && (
                                                    <div className="mt-3 p-3 bg-amber-50/50 rounded-xl border border-amber-100/50">
                                                        <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest mb-2">Update Reason</p>
                                                        {renderRemarkStr(log.remark)}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="p-3 bg-slate-100/50 rounded-xl">
                                                {renderRemarkStr(log.remark)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-center pb-safe-bottom">
                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">End of Project Activity Log</p>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default ProjectLogModal;
