import React, { useState, useEffect } from 'react';
import BottomNav from './BottomNav';
import PageTransition from '../components/PageTransition';
import { useAuth } from '../context/AuthContext';
import { FiSearch, FiChevronLeft, FiChevronRight, FiRefreshCw, FiGrid, FiList, FiActivity, FiBriefcase, FiUser, FiTrash2, FiSlash, FiCheckCircle, FiStar, FiMessageSquare, FiKey, FiCopy, FiX, FiMapPin, FiCheck, FiLock } from "react-icons/fi";
import { TbSchool } from "react-icons/tb";
import { api } from "../lib/api";


// --- REUSABLE STAT COMPONENT ---
const StatCard = ({ label, value, icon, color }) => (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
        <div>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{label}</p>
            <p className="text-xl font-extrabold text-gray-800 mt-0.5">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${color}`}>
            {icon}
        </div>
    </div>
);

const AdminDashboard = () => {
    const { user, token } = useAuth();
    const [userName, setUserName] = useState('Admin');
    const [activeTab, setActiveTab] = useState('overview'); // overview, schools, school-management, projects, audit

    // Data States
    const [schools, setSchools] = useState([]);
    const [pendingSchools, setPendingSchools] = useState([]); // New state for pending schools
    const [reviewedSchools, setReviewedSchools] = useState([]); // History of approvals/rejections
    const [schoolManagementView, setSchoolManagementView] = useState('pending'); // 'pending' | 'history'
    const [projects, setProjects] = useState([]);
    const [users, setUsers] = useState([]);
    const [usersPage, setUsersPage] = useState(1);
    const [usersTotal, setUsersTotal] = useState(0);
    const [usersTotalPages, setUsersTotalPages] = useState(1);
    const [usersLimit] = useState(20);
    const [resetModalData, setResetModalData] = useState(null); // { email, password } | null
    const [auditLogs, setAuditLogs] = useState([]);
    const [feedbackList, setFeedbackList] = useState([]); // New state for feedback

    // Statistics States
    const [userStats, setUserStats] = useState({ total: 0, breakdown: [] });
    const [roleFilter, setRoleFilter] = useState('');
    const [geoRegionFilter, setGeoRegionFilter] = useState('');
    const [geoDivisionFilter, setGeoDivisionFilter] = useState('');
    const [availableRegions, setAvailableRegions] = useState([]);
    const [availableDivisions, setAvailableDivisions] = useState([]); // All divisions from API
    const [filteredDivisions, setFilteredDivisions] = useState([]); // Divisions for current region
    const [availableRoles, setAvailableRoles] = useState([]);


    // Loading States
    const [loading, setLoading] = useState(false);

    // Filter State
    const [searchTerm, setSearchTerm] = useState('');

    // Deadline State
    const [deadlineDate, setDeadlineDate] = useState('');

    const [updatingDeadline, setUpdatingDeadline] = useState(false);

    // Nexus Module Locks
    const [nexusLocks, setNexusLocks] = useState({ 'school-info': false, 'esf7': false, 'nspp': false });
    const [updatingLocks, setUpdatingLocks] = useState(false);

    // Fraud Detection State
    const [isRunningFraud, setIsRunningFraud] = useState(false);
    const [fraudOutput, setFraudOutput] = useState(null);

    // --- FETCH DATA ---
    const fetchPendingSchools = async () => {
        try {
            const res = await fetch(api(`/api/admin/pending-schools`), {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (res.ok) {
                const data = await res.json();
                setPendingSchools(data);
            }
        } catch (err) {
            console.error("Failed to fetch pending schools:", err);
        }
    };

    const fetchReviewedSchools = async () => {
        try {
            // Fetch all reviewed schools (or just by this admin if preferred, currently fetching all)
            // If we want only by this admin: ?reviewed_by=${user.uid}
            // Let's fetch all for transparency, or use logic based on requirement.
            // Requirement said "history of ... requests that have been approved or denied".
            // Implementation plan said "Filter ... performed by the current admin (optional)". 
            // Let's show ALL for now as Admins usually want to see overall activity.
            const res = await fetch(api(`/api/admin/reviewed-schools`), {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (res.ok) {
                const data = await res.json();
                setReviewedSchools(data);
            }
        } catch (err) {
            console.error("Failed to fetch reviewed schools:", err);
        }
    };

    const fetchUserStats = async () => {
        try {
            const res = await fetch(api(`/api/admin/user-stats?region=${geoRegionFilter}&division=${geoDivisionFilter}&role=${roleFilter}`), {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (res.ok) {
                const data = await res.json();
                setUserStats(data);
            }
        } catch (err) {
            console.error("Failed to fetch user stats:", err);
        }
    };

    const fetchFilterOptions = async () => {
        try {
            const res = await fetch(api(`/api/admin/filter-options`), {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (res.ok) {
                const data = await res.json();
                setAvailableRegions(data.regions);
                setAvailableDivisions(data.divisions);
                setAvailableRoles(data.roles);
            }
        } catch (err) {
            console.error("Failed to fetch filter options:", err);
        }
    };

    const fetchAllData = async () => {
        setLoading(true);
        try {
            if (user) {
                setUserName(user.first_name || user.firstName || 'Admin');
            }
 
            const [schoolsRes, projectsRes, auditRes, deadlineRes, feedbackRes, nexusLocksRes] = await Promise.all([
                fetch(api(`/api/schools`), { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(r => r.json()),
                fetch(api(`/api/projects`), { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(r => r.json()),
                fetch(api(`/api/activities`), { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(r => r.json()),
                fetch(api(`/api/settings/enrolment_deadline`), { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(r => r.json()),
                fetch(api(`/api/admin/feedback`), { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(r => r.json()),
                fetch(api(`/api/settings/nexus_module_locks`), { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(r => r.json())
            ]);


            // Handle Schools
            if (Array.isArray(schoolsRes)) setSchools(schoolsRes);
            // Pending and Reviewed schools are fetched separately now

            // Handle Projects
            if (Array.isArray(projectsRes)) setProjects(projectsRes);

            // Handle Audits
            if (Array.isArray(auditRes)) setAuditLogs(auditRes);

            // Handle Deadline
            if (deadlineRes && deadlineRes.value) {
                setDeadlineDate(deadlineRes.value);
            }

            // Handle Feedback
            if (Array.isArray(feedbackRes)) {
                setFeedbackList(feedbackRes);
            }

            // Handle Nexus Locks
            if (nexusLocksRes && nexusLocksRes.value) {
                try {
                    setNexusLocks(JSON.parse(nexusLocksRes.value));
                } catch (e) {
                    console.error("Failed to parse nexus locks:", e);
                }
            }


        } catch (error) {
            console.error("Dashboard Sync Error:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    // --- FETCH USERS (Paginated) ---
    const fetchUsers = async () => {
        try {
            // Only search users if we are on the accounts tab to save bandwidth
            if (activeTab !== 'accounts') return;

            const res = await fetch(api(`/api/admin/users?page=${usersPage}&limit=${usersLimit}&search=${searchTerm}&role=${roleFilter}&region=${geoRegionFilter}&division=${geoDivisionFilter}`), {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            const data = await res.json();

            if (data.data) {
                setUsers(data.data);
                setUsersTotal(data.total);
                setUsersTotalPages(data.totalPages);
            }
        } catch (error) {
            console.error("Failed to fetch users:", error);
        }
    };

    // Debounce Search & Fetch for Users
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (activeTab === 'accounts') {
                fetchUsers();
            }
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, usersPage, activeTab, roleFilter, geoRegionFilter, geoDivisionFilter]);

    // Update stats when filters change
    useEffect(() => {
        if (activeTab === 'accounts') {
            fetchUserStats();
        }
    }, [roleFilter, geoRegionFilter, geoDivisionFilter]);

    // Filter divisions based on region
    useEffect(() => {
        if (geoRegionFilter) {
            const filtered = availableDivisions.filter(d => d.region === geoRegionFilter);
            setFilteredDivisions(filtered.map(d => d.name));
        } else {
            setFilteredDivisions(availableDivisions.map(d => d.name));
        }
    }, [geoRegionFilter, availableDivisions]);

    // Fetch pending/reviewed schools when school management tab is active
    useEffect(() => {
        if (activeTab === 'school-management') {
            fetchPendingSchools();
            fetchReviewedSchools();
        }
        if (activeTab === 'accounts') {
            fetchUserStats();
            fetchFilterOptions();
        }
    }, [activeTab]);


    // --- DERIVED STATS ---
    const totalSchools = schools.length;
    const submittedSchools = schools.filter(s => s.status === 'Submitted').length;

    // Projects Stats
    const totalProjects = projects.length;
    const completedProjects = projects.filter(p => p.status === 'Completed').length;
    const delayedProjects = projects.filter(p => {
        if (p.status === 'Completed') return false;
        if (!p.targetCompletionDate) return false;
        const target = new Date(p.targetCompletionDate);
        return new Date() > target;
    }).length;

    // Feedback Stats Helper
    const calculateAverageRating = (field) => {
        if (feedbackList.length === 0) return 0;
        const sum = feedbackList.reduce((acc, curr) => acc + (curr.ratings?.[field] || 0), 0);
        return (sum / feedbackList.length).toFixed(1);
    };

    // --- HANDLERS ---
    const handleUpdateDeadline = async () => {
        setUpdatingDeadline(true);
        try {
            const adminUid = user ? user.uid : 'unknown';
            const res = await fetch(api(`/api/settings/save`), {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    key: 'enrolment_deadline',
                    value: deadlineDate,
                    userUid: user ? user.uid : 'admin_override' // fallback if not auth'd properly (should be)
                })
            });

            if (res.ok) {
                alert("✅ Deadline updated successfully!");
                fetchAllData(); // refresh logs
            } else {
                alert("❌ Failed to update deadline.");
            }
        } catch (error) {
            console.error(error);
            alert("❌ Error updating deadline.");
        } finally {
            setUpdatingDeadline(false);
        }
    };

    const handleToggleNexusLock = async (moduleId) => {
        const newLocks = { ...nexusLocks, [moduleId]: !nexusLocks[moduleId] };
        setNexusLocks(newLocks); // Optimistic UI
        setUpdatingLocks(true);
        try {
            const adminUid = user ? user.uid : 'admin';
            const res = await fetch(api(`/api/settings/save`), {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    key: 'nexus_module_locks',
                    value: JSON.stringify(newLocks),
                    userUid: adminUid
                })
            });

            if (!res.ok) {
                alert("❌ Failed to update module lock.");
                // Revert
                setNexusLocks(nexusLocks);
            }
        } catch (error) {
            console.error(error);
            alert("❌ Error updating module lock.");
            setNexusLocks(nexusLocks);
        } finally {
            setUpdatingLocks(false);
        }
    };

    const handleDisableUser = async (uid, currentStatus) => {
        if (!window.confirm(`Are you sure you want to ${currentStatus ? 'ENABLE' : 'DISABLE'} this user?`)) return;

        try {
            const adminUid = user ? user.uid : 'unknown';
            const res = await fetch(api(`/api/admin/users/${uid}/status`), {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ disabled: !currentStatus, adminUid })
            });
            if (res.ok) {
                alert(`✅ User ${currentStatus ? 'enabled' : 'disabled'} successfully!`);
                fetchUsers(); // Refresh user list
            } else {
                alert("❌ Action failed.");
            }
        } catch (err) {
            alert("❌ Error updating user status.");
        }
    };

    const handleDeleteUser = async (uid) => {
        if (!window.confirm("Are you sure you want to PERMANENTLY DELETE this user? This action cannot be undone.")) return;

        try {
            const adminUid = user ? user.uid : 'unknown';
            const res = await fetch(api(`/api/admin/users/${uid}?adminUid=${adminUid}`), {
                method: 'DELETE',
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (res.ok) {
                alert("✅ User deleted successfully!");
                fetchUsers(); // Refresh user list
            } else {
                alert("❌ Delete failed.");
            }
        } catch (err) {
            alert("❌ Error deleting user.");
        }
    };

    const handleApproveSchool = async (pendingId) => {
        if (!window.confirm("Are you sure you want to APPROVE this school?")) return;
        try {
            const adminUid = user ? user.uid : 'unknown';
            const res = await fetch(api(`/api/admin/approve-school/${pendingId}`), {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    reviewed_by: user.uid,
                    reviewed_by_name: userName
                })
            });

            if (res.ok) {
                alert("✅ School Approved!");
            } else {
                const data = await res.json();
                alert("❌ Approval Failed: " + data.error);
            }
            // Re-fetch both lists to be safe
            fetchPendingSchools();
            fetchReviewedSchools();
        } catch (err) {
            console.error(err);
            alert("❌ Error approving school.");
        }
    };

    const handleRejectSchool = async (pendingId) => {
        const reason = prompt("Please enter a reason for rejection:");
        if (reason === null) return; // Cancelled

        try {
            const adminUid = user ? user.uid : 'unknown';
            const res = await fetch(api(`/api/admin/reject-school/${pendingId}`), {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    reviewed_by: user.uid,
                    reviewed_by_name: userName,
                    rejection_reason: reason
                })
            });

            if (res.ok) {
                alert("🚫 School Rejected.");
            } else {
                const data = await res.json();
                alert("❌ Rejection Failed: " + data.error);
            }
            fetchPendingSchools();
            fetchReviewedSchools();
        } catch (err) {
            console.error(err);
            alert("❌ Error rejecting school.");
        }
    };

    const handleResubmitRequest = async (pendingId) => {
        const comment = prompt("Please enter a reason for requesting re-submission (e.g., 'PDF is blurry'):");
        if (!comment) return; // Cancelled or empty

        try {
            const adminUid = user ? user.uid : 'unknown';
            const res = await fetch(api(`/api/admin/resubmit-request/${pendingId}`), {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    reviewed_by: user.uid,
                    reviewed_by_name: userName,
                    admin_comment: comment
                })
            });

            if (res.ok) {
                alert("📝 Resubmit Request Sent.");
            } else {
                const data = await res.json();
                alert("❌ Failed to send request: " + data.error);
            }
            fetchPendingSchools();
        } catch (err) {
            console.error(err);
            alert("❌ Error requesting resubmission.");
        }
    };

    const handleResetPassword = async (uid, email) => {
        if (!window.confirm(`Are you sure you want to RESET the password for ${email}?`)) return;

        // 1. Generate Temp Password (8 chars, alphanumeric + special)
        const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHIJKLMNPQRSTUVWXYZ23456789!@#";
        let tempPassword = "";
        for (let i = 0; i < 8; i++) tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));

        // 2. Call API
        try {
            const adminUid = user ? user.uid : 'unknown';
            const res = await fetch(api(`/api/admin/reset-password`), {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ uid, newPassword: tempPassword, adminUid })
            });

            if (res.ok) {
                // 3. Show Success & Password via Modal
                setResetModalData({ email, password: tempPassword });
            } else {
                let errText = await res.text();
                let errMsg = "Unknown error";
                try {
                    const errObj = JSON.parse(errText);
                    errMsg = errObj.error || errObj.message || errText;
                } catch {
                    errMsg = errText ? errText.substring(0, 100) : "Empty response from server";
                }
                alert("❌ Failed to reset password: " + errMsg);
            }
        } catch (e) {
            console.error(e);
            alert("❌ Network Error: " + e.message);
        }
    };

    const handleRunFraudDetection = async () => {
        if (!window.confirm("Run Advanced Fraud Detection global scan? This will validate input data across all schools and recalculate health scores.")) return;

        setIsRunningFraud(true);
        setFraudOutput(null);
        try {
            const adminUid = user ? user.uid : 'unknown';
            const res = await fetch(api(`/api/admin/run-fraud-detection`), {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ adminUid: user ? user.uid : 'unknown' })
            });

            if (res.ok) {
                const data = await res.json();
                setFraudOutput(data.output);
                alert("✅ Global Fraud Detection Completed Successfully!");
                fetchAllData(); // Refresh counts/logs
            } else {
                const err = await res.json();
                alert("❌ Execution Failed: " + (err.details || err.error));
            }
        } catch (error) {
            console.error(error);
            alert("❌ Network Error: " + error.message);
        } finally {
            setIsRunningFraud(false);
        }
    };

    // --- RENDERERS ---

    const renderOverview = () => (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Quick Stats Grid */}
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">System Health</h3>
            <div className="grid grid-cols-2 gap-3">
                <StatCard
                    label="Schools Data"
                    value={`${submittedSchools}/${totalSchools}`}
                    icon="🏫"
                    color="bg-blue-50 text-blue-600"
                />
                <StatCard
                    label="Projects"
                    value={totalProjects}
                    icon="🏗️"
                    color="bg-orange-50 text-orange-600"
                />
                <StatCard
                    label="Completion"
                    value={`${totalProjects > 0 ? Math.round((completedProjects / totalProjects) * 100) : 0}%`}
                    icon="✅"
                    color="bg-green-50 text-green-600"
                />
                <StatCard
                    label="Recent Logs"
                    value={auditLogs.length}
                    icon="📋"
                    color="bg-purple-50 text-purple-600"
                />
            </div>

            {/* DEADLINE MANAGER CARD */}
            <div className="mt-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div>
                    <h3 className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Submission Deadline</h3>
                    <p className="text-xs text-gray-500 mb-2">Set the global due date for Enrolment</p>
                    <input
                        type="date"
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-500 transition-colors"
                        value={deadlineDate || ''}
                        onChange={(e) => setDeadlineDate(e.target.value)}
                    />
                </div>
                <button
                    onClick={handleUpdateDeadline}
                    disabled={updatingDeadline}
                    className="bg-[#004A99] text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-50"
                >
                    {updatingDeadline ? 'Updating...' : 'Update Deadline'}
                </button>

            </div>

            {/* FRAUD DETECTION MODE CARD */}
            <div className={`mt-4 p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between transition-colors bg-white hover:border-blue-100`}>
                <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${isRunningFraud ? 'bg-blue-100 text-blue-600 animate-pulse' : 'bg-blue-50 text-blue-500'}`}>
                        <FiActivity size={20} />
                    </div>
                    <div>
                        <h3 className={`text-xs font-bold uppercase tracking-wider text-blue-600`}>Advanced Fraud Detection</h3>
                        <p className={`text-xs mb-1 text-gray-500`}>
                            {isRunningFraud ? 'Processing global scanning...' : 'Run validation mode to check health score problems.'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleRunFraudDetection}
                    disabled={isRunningFraud}
                    className={`text-xs font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-50 bg-[#004A99] text-white hover:bg-blue-800`}
                >
                    {isRunningFraud ? 'Running...' : 'Run Scan'}
                </button>
            </div>

            {/* NEXUS MODULE CONTROL CARD */}
            <div className="mt-4 bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-full">
                        <FiGrid size={20} />
                    </div>
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">Nodes Module Controls</h3>
                        <p className="text-[10px] text-gray-500">Enable or disable front-page cards for users.</p>
                    </div>
                </div>
                
                <div className="space-y-3">
                    {[
                        { id: 'school-info', label: 'School Profile', icon: '🏛️' },
                        { id: 'esf7', label: 'eSF7 Hub', icon: '🛡️' },
                        { id: 'nspp', label: 'NSPP Path', icon: '⚡' }
                    ].map((mod) => (
                        <div key={mod.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="flex items-center gap-3">
                                <span className="text-lg">{mod.icon}</span>
                                <span className="text-sm font-bold text-gray-700">{mod.label}</span>
                            </div>
                            <button
                                onClick={() => handleToggleNexusLock(mod.id)}
                                disabled={updatingLocks}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${
                                    nexusLocks[mod.id]
                                        ? 'bg-red-50 text-red-600 border border-red-100'
                                        : 'bg-green-50 text-green-600 border border-green-100'
                                }`}
                            >
                                {nexusLocks[mod.id] ? (
                                    <>
                                        <FiLock size={12} />
                                        LOCKED
                                    </>
                                ) : (
                                    <>
                                        <FiCheck size={12} />
                                        ACTIVE
                                    </>
                                )}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {fraudOutput && (
                <div className="mt-2 p-3 bg-slate-900 rounded-lg border border-slate-700 font-mono text-[9px] text-green-400 max-h-40 overflow-y-auto overflow-x-hidden">
                    <div className="flex justify-between items-center mb-1 text-slate-500 border-b border-slate-800 pb-1">
                        <span>Terminal Output</span>
                        <button onClick={() => setFraudOutput(null)} className="hover:text-white">Clear</button>
                    </div>
                    {fraudOutput.split('\n').map((line, i) => (
                        <p key={i} className="whitespace-pre-wrap">{line}</p>
                    ))}
                </div>
            )}

            {/* Recent Activity Mini-Feed */}
            <div className='flex justify-between items-end mt-6 mb-2'>
                <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">Recent Activity</h3>
                <button onClick={() => setActiveTab('audit')} className="text-xs text-[#004A99] font-bold">View All</button>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {auditLogs.slice(0, 5).map((log, idx) => (
                    <div key={log.log_id || idx} className="p-3 border-b border-gray-50 last:border-0 flex gap-3 hover:bg-slate-50 transition-colors">
                        <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${log.action_type === 'CREATE' ? 'bg-green-500' :
                            log.action_type === 'DELETE' ? 'bg-red-500' : 'bg-blue-500'
                            }`} />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-gray-800 truncate">{log.details}</p>
                            <div className="flex justify-between mt-0.5">
                                <p className="text-[10px] text-gray-500">{log.user_name} • {log.role}</p>
                                <p className="text-[10px] text-gray-400">{log.formatted_time}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div >
    );

    const renderSchoolsList = () => (
        <div className="space-y-3 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 mb-4 bg-white p-2 rounded-xl border border-gray-100 shadow-sm">
                <FiSearch className="text-gray-400 ml-2" />
                <input
                    type="text"
                    placeholder="Search schools..."
                    className="flex-1 text-sm outline-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {schools.filter(s => (s.name || "").toLowerCase().includes((searchTerm || "").toLowerCase())).map((school) => (
                <div key={school.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                    <div>
                        <h4 className="font-bold text-gray-800 text-sm">{school.name}</h4>
                        <p className="text-[10px] text-gray-500">{school.district || 'District N/A'}</p>
                    </div>
                    {school.status === 'Submitted' ? (
                        <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-full">Submitted</span>
                    ) : (
                        <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-1 rounded-full">Pending</span>
                    )}
                </div>
            ))}
        </div>
    );

    const renderProjectsList = () => (
        <div className="space-y-3 animate-in fade-in duration-300">
            {/* Stats Check */}
            <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-green-50 p-2 rounded-lg text-center border border-green-100">
                    <p className="text-[10px] text-green-600 font-bold uppercase">Completed</p>
                    <p className="text-lg font-bold text-green-700">{completedProjects}</p>
                </div>
                <div className="bg-red-50 p-2 rounded-lg text-center border border-red-100">
                    <p className="text-[10px] text-red-600 font-bold uppercase">Delayed</p>
                    <p className="text-lg font-bold text-red-700">{delayedProjects}</p>
                </div>
                <div className="bg-blue-50 p-2 rounded-lg text-center border border-blue-100">
                    <p className="text-[10px] text-blue-600 font-bold uppercase">Total</p>
                    <p className="text-lg font-bold text-blue-700">{totalProjects}</p>
                </div>
            </div>

            {projects.map((project) => (
                <div key={project.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-gray-800 text-sm line-clamp-1">{project.schoolName}</h4>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${project.status === 'Completed' ? 'bg-green-50 text-green-600 border-green-100' :
                            'bg-blue-50 text-blue-600 border-blue-100'
                            }`}>
                            {project.status}
                        </span>
                    </div>
                    <p className="text-xs text-gray-600 mb-1">{project.projectName}</p>
                    {project.accomplishmentPercentage !== undefined && (
                        <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                            <div className="bg-[#004A99] h-1.5 rounded-full" style={{ width: `${project.accomplishmentPercentage}%` }}></div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );

    const renderAuditTable = () => {
        // Reusing the table logic from previous step, but simplified for this view
        const filtered = auditLogs.filter(log =>
            (log.details || "").toLowerCase().includes((searchTerm || "").toLowerCase()) ||
            (log.user_name || "").toLowerCase().includes((searchTerm || "").toLowerCase())
        );

        return (
            <div className="animate-in fade-in duration-300">
                <div className="flex items-center gap-2 mb-4 bg-white p-2 rounded-xl border border-gray-100 shadow-sm">
                    <FiSearch className="text-gray-400 ml-2" />
                    <input
                        type="text"
                        placeholder="Search audit logs..."
                        className="flex-1 text-sm outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50 overflow-hidden">
                    {filtered.map((log) => (
                        <div key={log.log_id} className="p-4 flex gap-3 hover:bg-slate-50 transition-colors">
                            <div className={`mt-1 font-mono text-[10px] px-1.5 py-0.5 rounded h-fit ${log.action_type === 'LOGIN' ? 'bg-green-100 text-green-700' :
                                log.action_type === 'DELETE' ? 'bg-red-100 text-red-700' :
                                    'bg-slate-100 text-slate-600'
                                }`}>
                                {log.action_type}
                            </div>
                            <div className="flex-1">
                                <p className="text-xs font-bold text-gray-800">{log.target_entity}</p>
                                <p className="text-[11px] text-gray-500 leading-relaxed">{log.details}</p>
                                <p className="text-[9px] text-gray-400 mt-1">{log.user_name} • {log.formatted_time}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderSchoolManagement = () => (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-black text-slate-800">School Management</h2>

                {/* View Switcher */}
                <div className="bg-slate-100 p-1 rounded-xl flex">
                    <button
                        onClick={() => setSchoolManagementView('pending')}
                        className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${schoolManagementView === 'pending'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Pending ({pendingSchools.length})
                    </button>
                    <button
                        onClick={() => setSchoolManagementView('history')}
                        className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${schoolManagementView === 'history'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        History
                    </button>
                </div>
            </div>

            {schoolManagementView === 'pending' ? (
                // PENDING VIEW
                pendingSchools.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                        <TbSchool className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                        <h3 className="text-xl font-bold text-slate-600">No pending submissions</h3>
                        <p className="text-slate-400">New school requests will appear here.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {pendingSchools.map((school) => (
                            <div key={school.pending_id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all">
                                {/* Existing School Card Content ... */}
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="bg-blue-100 text-blue-800 text-xs font-black px-2 py-1 rounded uppercase tracking-wider">
                                                {school.school_id}
                                            </span>
                                            <h3 className="text-xl font-bold text-slate-800">{school.school_name}</h3>
                                        </div>
                                        <p className="text-sm text-slate-500 mb-4 flex items-center gap-2">
                                            <FiMapPin /> {school.municipality}, {school.province}
                                        </p>
                                        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                                            <span className="bg-slate-100 px-2 py-1 rounded">District: {school.district}</span>
                                            <span className="bg-slate-100 px-2 py-1 rounded">Type: {school.curricular_offering}</span>
                                            <span className="bg-slate-100 px-2 py-1 rounded">By: {school.submitted_by_name}</span>
                                        </div>
                                        {school.special_order ? (
                                            <div className="mt-4">
                                                <span className="text-sm text-gray-500 block mb-1 font-bold">Special Order:</span>
                                                <a
                                                    href={`api/sdo/document/${school.pending_id}/SPECIAL_ORDER?isPending=true`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-md text-sm font-semibold transition-colors border border-red-200"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                                    View PDF
                                                </a>
                                            </div>
                                        ) : (
                                            <div className="mt-4">
                                                <span className="text-sm text-gray-500 block mb-1 font-bold">Special Order:</span>
                                                <span className="text-xs text-slate-400 italic">No document uploaded</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleRejectSchool(school.pending_id)}
                                            className="p-3 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors"
                                            title="Reject"
                                        >
                                            <FiX size={20} />
                                        </button>
                                        <button
                                            onClick={() => handleResubmitRequest(school.pending_id)}
                                            className="p-3 rounded-xl text-amber-500 hover:bg-amber-50 transition-colors"
                                            title="Request Resubmit"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                                        </button>
                                        <button
                                            onClick={() => handleApproveSchool(school.pending_id)}
                                            className="p-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-200 transition-all"
                                            title="Approve"
                                        >
                                            <FiCheck size={20} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            ) : (
                // HISTORY VIEW
                <div className="space-y-4">
                    {reviewedSchools.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <p>No history found.</p>
                        </div>
                    ) : (
                        reviewedSchools.map((school) => (
                            <div key={school.pending_id} className="bg-white rounded-xl p-4 border border-slate-100 flex justify-between items-center opacity-75 hover:opacity-100 transition-opacity">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-bold text-slate-700">{school.school_name}</h4>
                                        <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded ${school.status === 'approved'
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-rose-100 text-rose-700'
                                            }`}>
                                            {school.status}
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1 flex gap-4">
                                        <span>ID: {school.school_id}</span>
                                        <span>Reviewed by: {school.reviewed_by_name}</span>
                                        <span>{new Date(school.reviewed_at).toLocaleDateString()}</span>
                                    </div>
                                    {school.special_order ? (
                                        <div className="mt-3">
                                            <span className="text-xs text-gray-500 block mb-1 font-bold tracking-wide uppercase">Special Order:</span>
                                            <a
                                                href={`api/sdo/document/${school.school_id}/SPECIAL_ORDER`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-md text-[11px] font-semibold transition-colors border border-red-200"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                                View PDF
                                            </a>
                                        </div>
                                    ) : (
                                        <div className="mt-3">
                                            <span className="text-xs text-gray-500 block mb-1 font-bold tracking-wide uppercase">Special Order:</span>
                                            <span className="text-[11px] text-slate-400 italic">No document uploaded</span>
                                        </div>
                                    )}
                                    {school.status === 'rejected' && school.rejection_reason && (
                                        <p className="text-xs text-rose-500 mt-1 italic">
                                            Reason: {school.rejection_reason}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );

    const renderAccountManagement = () => {
        // No local filtering anymore
        const filteredUsers = users;


        return (
            <div className="animate-in fade-in duration-300">
                {/* GEOGRAPHIC & ROLE FILTERS */}
                <div className="flex flex-col md:flex-row gap-4 mb-6 bg-slate-50 p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1.5 block ml-1">User Role</label>
                        <select
                            value={roleFilter}
                            onChange={(e) => {
                                setRoleFilter(e.target.value);
                                if (e.target.value) setSearchTerm('');
                            }}
                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors font-semibold"
                        >
                            <option value="">All Roles</option>
                            {availableRoles.map(role => (
                                <option key={role} value={role}>{role}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1.5 block ml-1">Regional Office</label>
                        <select
                            value={geoRegionFilter}
                            onChange={(e) => {
                                setGeoRegionFilter(e.target.value);
                                setGeoDivisionFilter(''); // Reset division when region changes
                            }}
                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors"
                        >
                            <option value="">All Regions</option>
                            {availableRegions.map(reg => (
                                <option key={reg} value={reg}>{reg}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1.5 block ml-1">School Division Office</label>
                        <select
                            value={geoDivisionFilter}
                            onChange={(e) => setGeoDivisionFilter(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors"
                        >
                            <option value="">All Divisions</option>
                            {filteredDivisions.map(div => (
                                <option key={div} value={div}>{div}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={() => {
                                setGeoRegionFilter('');
                                setGeoDivisionFilter('');
                                setRoleFilter('');
                                setSearchTerm('');
                            }}
                            className="bg-white text-gray-400 text-xs font-bold px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 hover:text-gray-600 transition-all mb-[1px]"
                        >
                            Reset All
                        </button>
                    </div>
                </div>

                {/* STATISTICS MINI-DASHBOARD */}
                <div className="mb-6">
                    <div className="flex justify-between items-end mb-3">
                        <h3 className="text-gray-400 text-[10px] font-bold uppercase tracking-wider ml-1">Registration Breakdown</h3>
                        {/* Summary of filters */}
                        <div className="flex gap-2">
                            {roleFilter && (
                                <span className="text-[9px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full font-bold uppercase">{roleFilter}</span>
                            )}
                            {geoRegionFilter && (
                                <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold uppercase">{geoRegionFilter}</span>
                            )}
                            {geoDivisionFilter && (
                                <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-bold uppercase">{geoDivisionFilter}</span>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                        {/* Total Card */}
                        <div
                            onClick={() => setRoleFilter('')}
                            className={`min-w-[140px] p-3 rounded-xl border transition-all cursor-pointer ${roleFilter === '' ? 'bg-[#004A99] border-blue-600 shadow-md' : 'bg-white border-gray-100 hover:border-blue-200'}`}
                        >
                            <p className={`text-[9px] font-bold uppercase tracking-wider ${roleFilter === '' ? 'text-blue-100' : 'text-gray-400'}`}>
                                {roleFilter ? `Total ${roleFilter}s` : 'Total Registrations'}
                            </p>
                            <p className={`text-xl font-black mt-0.5 ${roleFilter === '' ? 'text-white' : 'text-gray-800'}`}>{userStats.total}</p>
                        </div>

                        {/* Role Breakdown Cards */}
                        {userStats.breakdown.map((item, idx) => (
                            <div
                                key={idx}
                                onClick={() => { setRoleFilter(item.role); setSearchTerm(''); }}
                                className={`min-w-[120px] p-3 rounded-xl border transition-all cursor-pointer ${roleFilter === item.role ? 'bg-blue-600 border-blue-700 shadow-md' : 'bg-white border-gray-100 hover:border-blue-200'}`}
                            >
                                <p className={`text-[9px] font-bold uppercase tracking-wider truncate ${roleFilter === item.role ? 'text-blue-100' : 'text-gray-400'}`}>{item.role}</p>
                                <p className={`text-xl font-black mt-0.5 ${roleFilter === item.role ? 'text-white' : 'text-gray-800'}`}>{item.count}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2 mb-4 bg-white p-2 rounded-xl border border-gray-100 shadow-sm">
                    <FiSearch className="text-gray-400 ml-2" />
                    <input
                        type="text"
                        placeholder="Search users..."
                        className="flex-1 text-sm outline-none"
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setRoleFilter(''); // Clear role filter when searching broad
                            setUsersPage(1);
                        }}
                    />
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">

                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 text-[10px] uppercase font-bold text-gray-400">
                            <tr>
                                <th className="p-3">User</th>
                                <th className="p-3">Role</th>
                                <th className="p-3 hidden md:table-cell">Jurisdiction</th>
                                <th className="p-3 text-center">Status</th>
                                <th className="p-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredUsers.map(user => (
                                <tr key={user.uid} className="hover:bg-blue-50/50 transition-colors group">
                                    <td className="p-3">
                                        <p className="font-bold text-gray-800 text-sm">{user.first_name} {user.last_name}</p>
                                        <p className="text-[10px] text-gray-500">{user.email}</p>
                                    </td>
                                    <td className="p-3">
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${user.role === 'Admin' ? 'bg-purple-100 text-purple-600 border-purple-200' :
                                            user.role === 'Central Office' ? 'bg-blue-100 text-blue-600 border-blue-200' :
                                                'bg-slate-100 text-slate-600 border-slate-200'
                                            }`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="p-3 hidden md:table-cell">
                                        <p className="text-[10px] text-gray-600">
                                            {user.region && `Reg: ${user.region}`}
                                            {user.division && ` • Div: ${user.division}`}
                                        </p>
                                    </td>
                                    <td className="p-3 text-center">
                                        {user.disabled ? (
                                            <span className="inline-flex items-center gap-1 bg-red-100 text-red-600 text-[9px] font-black px-1.5 py-0.5 rounded">
                                                <FiSlash size={8} /> DISABLED
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-600 text-[9px] font-black px-1.5 py-0.5 rounded">
                                                <FiCheckCircle size={8} /> ACTIVE
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-3 text-right">
                                        <div className="flex justify-end gap-1">
                                            <button
                                                onClick={() => handleResetPassword(user.uid, user.email)}
                                                className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                                title="Reset Password"
                                            >
                                                <FiKey size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDisableUser(user.uid, user.disabled)}
                                                className={`p-1.5 rounded-lg transition-colors ${user.disabled ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}
                                                title={user.disabled ? "Enable User" : "Disable User"}
                                            >
                                                {user.disabled ? <FiCheckCircle size={14} /> : <FiSlash size={14} />}
                                            </button>
                                            <button
                                                onClick={() => handleDeleteUser(user.uid)}
                                                className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                                title="Delete User"
                                            >
                                                <FiTrash2 size={14} />
                                            </button>
                                        </div>
                                    </td>

                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredUsers.length === 0 && (
                        <div className="p-8 text-center text-gray-400 text-xs italic">
                            No users found.
                        </div>
                    )}
                </div>

                {/* PAGINATION CONTROLS */}
                <div className="flex items-center justify-between mt-4 px-2">
                    <p className="text-xs text-gray-500">
                        Showing {users.length} of {usersTotal} users
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                            disabled={usersPage === 1}
                            className="px-3 py-1.5 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Previous
                        </button>
                        <span className="px-3 py-1.5 text-xs font-bold text-gray-800 bg-gray-100 rounded-lg">
                            Page {usersPage} of {usersTotalPages || 1}
                        </span>
                        <button
                            onClick={() => setUsersPage(p => Math.min(usersTotalPages, p + 1))}
                            disabled={usersPage === usersTotalPages}
                            className="px-3 py-1.5 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderFeedbackView = () => (
        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <StatCard
                    label="Ease of Use"
                    value={calculateAverageRating('easeOfUse')}
                    icon={<FiStar />}
                    color="text-amber-500 bg-amber-50"
                />
                <StatCard
                    label="Aesthetics"
                    value={calculateAverageRating('aesthetics')}
                    icon={<FiStar />}
                    color="text-pink-500 bg-pink-50"
                />
                <StatCard
                    label="Functionality"
                    value={calculateAverageRating('functionality')}
                    icon={<FiStar />}
                    color="text-blue-500 bg-blue-50"
                />
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-700 m-0 flex items-center gap-2">
                        <FiMessageSquare /> User Feedback
                    </h3>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-bold">
                        {feedbackList.length} Reviews
                    </span>
                </div>

                <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                    {feedbackList.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm">No feedback received yet.</div>
                    ) : (
                        feedbackList.map((item) => (
                            <div key={item.id} className="p-4 hover:bg-slate-50 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="font-bold text-sm text-gray-800 m-0">{item.userName}</p>
                                        <p className="text-xs text-gray-500 m-0">{item.role} • {item.timestamp?.toDate ? new Date(item.timestamp.toDate()).toLocaleDateString() : 'Just now'}</p>
                                    </div>
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4, 5].map(star => (
                                            <FiStar
                                                key={star}
                                                size={12}
                                                className={star <= Math.round((item.ratings?.easeOfUse + item.ratings?.aesthetics + item.ratings?.functionality) / 3) ? "fill-amber-400 text-amber-400" : "text-gray-200"}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div className="text-xs text-gray-500 mb-2 flex gap-4">
                                    <span>Ease: <b>{item.ratings?.easeOfUse}</b></span>
                                    <span>Look: <b>{item.ratings?.aesthetics}</b></span>
                                    <span>Func: <b>{item.ratings?.functionality}</b></span>
                                </div>
                                {item.comment && (
                                    <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-700 italic border border-gray-100">
                                        "{item.comment}"
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );

    const renderResetModal = () => {
        if (!resetModalData) return null;

        const copyToClipboard = () => {
            navigator.clipboard.writeText(resetModalData.password);
            alert("Password copied to clipboard!");
        };

        return (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-200 relative">
                    <button
                        onClick={() => setResetModalData(null)}
                        className="absolute top-3 right-3 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors z-10"
                    >
                        <FiX size={20} />
                    </button>

                    <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-8 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                        <div className="mx-auto w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 text-white shadow-lg ring-4 ring-white/10">
                            <FiCheckCircle size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-1">Password Reset!</h3>
                        <p className="text-green-50 text-xs font-medium opacity-90">
                            New credentials generated for<br />
                            <span className="font-bold underline decoration-green-300/50 underline-offset-2">{resetModalData.email}</span>
                        </p>
                    </div>

                    <div className="p-6">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6 group relative">
                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1 text-center">Temporary Password</p>
                            <div className="flex items-center justify-center gap-2">
                                <code className="font-mono text-2xl font-bold text-slate-700 tracking-widest">
                                    {resetModalData.password}
                                </code>
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center bg-slate-50/50 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={copyToClipboard}
                                    className="px-4 py-2 bg-white text-slate-700 font-bold text-xs rounded-lg shadow-sm border border-slate-200 flex items-center gap-2 transform hover:scale-105 transition-all"
                                >
                                    <FiCopy /> Copy Password
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={copyToClipboard}
                                className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-black transition-all shadow-lg shadow-slate-200 flex items-center justify-center gap-2"
                            >
                                <FiCopy size={16} /> Copy & Close
                            </button>
                            <button
                                onClick={() => setResetModalData(null)}
                                className="w-full py-3 bg-white text-slate-500 rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors border border-slate-100"
                            >
                                Close Window
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 font-sans pb-24 relative">
                {renderResetModal()}

                {/* --- HEADER --- */}
                <div className="bg-[#004A99] px-6 pt-12 pb-24 rounded-b-[3rem] shadow-xl relative overflow-hidden transition-all duration-500 ease-in-out">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                    <div className="relative z-10">
                        <p className="text-blue-200 text-[10px] font-black tracking-[0.2em] uppercase mb-1">Administrator • Nodes</p>
                        <h1 className="text-2xl font-bold text-white leading-tight mb-2">My Dashboard</h1>
                        <div className="flex items-center gap-3 text-blue-100/80 text-xs">
                            <div className="flex items-center gap-1"><span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span> System Online</div>
                            <button onClick={fetchAllData} className="flex items-center gap-1 hover:text-white"><FiRefreshCw size={10} /> Sync</button>
                        </div>
                    </div>
                </div>

                {/* --- MAIN CARD --- */}
                <div className="px-4 -mt-16 relative z-20">
                    <div className="bg-white/50 backdrop-blur-md rounded-2xl shadow-xl border border-white/50 overflow-hidden min-h-[60vh] flex flex-col">

                        {/* TAB NAVIGATION */}
                        <div className="flex p-2 bg-white/80 border-b border-gray-100 overflow-x-auto gap-2 no-scrollbar">
                            <button
                                onClick={() => setActiveTab('overview')}
                                className={`px-4 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${activeTab === 'overview' ? 'bg-[#004A99] text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                            >
                                Overview
                            </button>
                            <button
                                onClick={() => { setActiveTab('schools'); setSearchTerm(''); }}
                                className={`px-4 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${activeTab === 'schools' ? 'bg-[#004A99] text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                            >
                                Schools
                            </button>
                            <button
                                onClick={() => { setActiveTab('school-management'); setSearchTerm(''); }}
                                className={`px-4 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${activeTab === 'school-management' ? 'bg-[#004A99] text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                            >
                                School Management
                                {pendingSchools.length > 0 && (
                                    <span className="ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{pendingSchools.length}</span>
                                )}
                            </button>
                            <button
                                onClick={() => { setActiveTab('projects'); setSearchTerm(''); }}
                                className={`px-4 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${activeTab === 'projects' ? 'bg-[#004A99] text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                            >
                                Projects
                            </button>
                            <button
                                onClick={() => { setActiveTab('audit'); setSearchTerm(''); }}
                                className={`px-4 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${activeTab === 'audit' ? 'bg-[#004A99] text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                            >
                                Audit Trail
                            </button>
                            <button
                                onClick={() => { setActiveTab('feedback'); setSearchTerm(''); }}
                                className={`px-4 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${activeTab === 'feedback' ? 'bg-[#004A99] text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                            >
                                App Feedback
                            </button>
                            <button
                                onClick={() => { setActiveTab('accounts'); setSearchTerm(''); }}
                                className={`px-4 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${activeTab === 'accounts' ? 'bg-[#004A99] text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                            >
                                Account Management
                            </button>
                            {/* Knowledge Base Tab Removed */}
                        </div>

                        {/* CONTENT AREA */}
                        <div className="p-4 bg-slate-50/50 flex-1">
                            {loading ? (
                                <div className="h-40 flex items-center justify-center">
                                    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                                </div>
                            ) : (
                                <>
                                    {activeTab === 'overview' && renderOverview()}
                                    {activeTab === 'schools' && renderSchoolsList()}
                                    {activeTab === 'school-management' && renderSchoolManagement()}
                                    {activeTab === 'projects' && renderProjectsList()}
                                    {activeTab === 'audit' && renderAuditTable()}
                                    {activeTab === 'feedback' && renderFeedbackView()}
                                    {activeTab === 'accounts' && renderAccountManagement()}
                                    {/* {activeTab === 'knowledge' && <KnowledgeManager />} Component Removed */}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <BottomNav userRole="Admin" />
            </div>
        </PageTransition>
    );
};

export default AdminDashboard;