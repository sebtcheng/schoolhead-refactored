// src/modules/UserProfile.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BottomNav from './BottomNav';

import PageTransition from '../components/PageTransition';
import { useTheme } from '../context/ThemeContext'; // Import Hook
import { useServiceWorker } from '../context/ServiceWorkerContext'; // Import SW Hook

// Icons
import { FiUser, FiInfo, FiMoon, FiLogOut, FiChevronRight, FiChevronLeft, FiSave, FiEdit3, FiHelpCircle, FiChevronDown, FiChevronUp, FiStar, FiMessageSquare, FiCheckCircle, FiRefreshCw, FiDownloadCloud, FiTool, FiShield, FiLock } from "react-icons/fi"; // Added FiShield and FiLock
import { TbAlertTriangle } from "react-icons/tb";

const FAQ_DATA = [
    {
        question: "How do I sync my data when back online?",
        answer: "The app automatically syncs when it detects an internet connection. If 'Pending Sync' persists, pull down on your dashboard to force a refresh.",
        roles: ['School Head', 'DepEd Engineer', 'Division Engineer', 'Admin']
    },
    {
        question: "Why is the 'Submit' button disabled?",
        answer: "Ensure all required fields (marked with *) are filled. Also, check if your geolocation is enabled, as some forms require location tagging.",
        roles: ['School Head', 'DepEd Engineer', 'Division Engineer']
    },
    {
        question: "How do I attach photos to a report?",
        answer: "Tap the 'Upload Photo' icon in the form. You can select from your gallery or take a new photo. Please use landscape mode for better visibility.",
        roles: ['DepEd Engineer', 'Division Engineer', 'School Head']
    },
    {
        question: "Can I edit a report after submission?",
        answer: "Submitted reports enter a 'Processing' state. You cannot edit them directly. Please contact your Division Office Admin to request changes.",
        roles: ['School Head', 'DepEd Engineer', 'Division Engineer']
    },
    {
        question: "Where can I see the status of my funding request?",
        answer: "Navigate to the 'Projects' tab. The status bar (Proposed → Approved → Ongoing) shows the current stage of your request.",
        roles: ['School Head', 'Admin']
    }
];

// --- HELPERS (Moved outside to prevent re-initialization and infinite loops) ---
const getDashboardPath = (role) => {
    const roleMap = {
        'DepEd Engineer': '/engineer-projects',
        'Division Engineer': '/engineer-projects',
        'Non-DepEd Engineer': '/non-deped-dashboard',
        'Engineer': '/engineer-projects',
        'Local Government Unit': '/lgu-dashboard',
        'School Head': '/my-activity',
        'Human Resource': '/hr-dashboard',
        'Regional Office': '/monitoring-dashboard',
        'School Division Office': '/monitoring-dashboard',
        'Admin': '/admin-dashboard',
        'Super Admin': '/super-user-selector',
        'Super User': '/super-user-selector',
        'Central Office': '/monitoring-dashboard',
        'Central Office Finance': '/finance-dashboard',
        'EFD': '/efd-dashboard',
        'EFD Engineer': '/efd-dashboard',
    };
    return roleMap[role] || '/';
};

const getInitials = (first, last) => {
    return `${first?.charAt(0) || ''}${last?.charAt(0) || ''}`.toUpperCase();
};

const UserProfile = () => {
    const navigate = useNavigate();
    const auth = useAuth();
    const { user, authLoading, setIsPasscodeSetupOpen } = useAuth();
    const { isDarkMode, toggleTheme } = useTheme();
    const { checkForUpdates, isUpdateAvailable, updateApp, hardReset } = useServiceWorker(); // Added hardReset

    // --- STATE MANAGEMENT ---
    const [userData, setUserData] = useState(null);
    const [schoolId, setSchoolId] = useState(null);
    const [iern, setIern] = useState(null);
    const [homeRoute, setHomeRoute] = useState('/');

    // UI State
    const [activeTab, setActiveTab] = useState('settings'); // 'settings', 'profile', 'about', 'faq'
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);

    // Update Check State
    const [checkingForUpdate, setCheckingForUpdate] = useState(false);
    const [showUpdateModal, setShowUpdateModal] = useState(false);

    // Optimize App Modal State
    const [showOptimizeConfirm, setShowOptimizeConfirm] = useState(false);
    const [showOptimizeSuccess, setShowOptimizeSuccess] = useState(false);

    // FAQ Accordion State
    const [openFaqIndex, setOpenFaqIndex] = useState(null);

    // Form State for Editing (Restricted to specific fields)
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: ''
    });

    const [securityData, setSecurityData] = useState({
        password: '',
        passcode: '',
        confirmText: ''
    });
    const [showSecurityModal, setShowSecurityModal] = useState(false);
    const [emailChangeStatus, setEmailChangeStatus] = useState(null); // 'idle', 'verifying', 'success', 'error'

    // Feedback State
    const [feedbackRatings, setFeedbackRatings] = useState({
        easeOfUse: 0,
        aesthetics: 0,
        functionality: 0
    });
    const [feedbackComment, setFeedbackComment] = useState('');

    // Password Change State
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [passwordError, setPasswordError] = useState('');

    // Passcode Reset State
    const [showPasscodeResetModal, setShowPasscodeResetModal] = useState(false);
    const [resetPasscodeData, setResetPasscodeData] = useState({
        currentPasscode: '',
        newPasscode: '',
        confirmPasscode: ''
    });
    const [passcodeResetError, setPasscodeResetError] = useState('');

    // Success Modal State
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successConfig, setSuccessConfig] = useState({ title: '', message: '' });
    useEffect(() => {
        const syncUserData = async () => {
            // Priority 1: User object from AuthContext
            // Priority 2: localStorage fallbacks
            const currentUid = user?.uid || user?.school_id || localStorage.getItem('uid') || localStorage.getItem('userId') || localStorage.getItem('schoolId');
            const currentRole = user?.account_category || user?.role || localStorage.getItem('userRole') || 'User';
            const cachedEmail = user?.email || localStorage.getItem('userEmail');
            
            let fallbackFirstName = "User";
            let fallbackLastName = "";
            let fallbackEmail = cachedEmail || "";

            // Try to get more info from remembered_user (often set during login)
            try {
                const remStr = localStorage.getItem('remembered_user');
                if (remStr) {
                    const parsed = JSON.parse(remStr);
                    if (parsed.firstName || parsed.first_name) fallbackFirstName = parsed.firstName || parsed.first_name;
                    if (parsed.lastName || parsed.last_name) fallbackLastName = parsed.lastName || parsed.last_name;
                    if ((parsed.email || parsed.email_address) && !fallbackEmail) fallbackEmail = parsed.email || parsed.email_address;
                }
            } catch (e) {
                // Ignore parse errors
            }

            if (user) {
                // Support both snake_case (from /api/auth/me) and camelCase (from login/register)
                const mappedUser = {
                    ...user,
                    firstName: user.first_name || user.firstName || fallbackFirstName,
                    lastName: user.last_name || user.lastName || fallbackLastName,
                    email: user.email || user.email_address || fallbackEmail,
                    role: user.role || user.account_category || currentRole || 'User'
                };
                
                setUserData(mappedUser);
                setFormData({
                    firstName: mappedUser.firstName,
                    lastName: mappedUser.lastName,
                    email: mappedUser.email
                });
                setHomeRoute(getDashboardPath(mappedUser.role));

                // School ID check (if missing, fetch it)
                const currentSchoolId = mappedUser.school_id || mappedUser.schoolId;
                if (currentSchoolId) {
                    setSchoolId(currentSchoolId);
                } else if (mappedUser.uid) {
                    try {
                        const response = await fetch(`api/school-by-user/${mappedUser.uid}`, {
                            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                        });
                        if (response.ok) {
                            const result = await response.json();
                            if (result.exists) {
                                setSchoolId(result.data.school_id);
                                setIern(result.data.iern);
                            }
                        }
                    } catch (error) {
                        // Silent error
                    }
                }
            } else if (!authLoading) {
                // Initial/Logout state fallbacks from localStorage
                setUserData({
                    role: currentRole,
                    firstName: fallbackFirstName,
                    lastName: fallbackLastName,
                    email: fallbackEmail
                });
                setHomeRoute(getDashboardPath(currentRole));
            }
        };

        syncUserData();
    }, [user, user?.uid, authLoading]); 

    // --- SCROLL LOCK FOR OPTIMIZE MODALS ---
    useEffect(() => {
        if (showOptimizeConfirm || showOptimizeSuccess) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [showOptimizeConfirm, showOptimizeSuccess]);


    // --- HANDLERS ---
    const handleLogout = () => {
        auth?.confirmLogout();
    };

    const handleSaveProfile = async (bypassSecurity = false) => {
        // Handle domain restriction
        const currentEmail = userData.email || '';
        const currentDomain = currentEmail.split('@')[1];
        const newDomain = formData.email.split('@')[1];

        if (currentDomain && newDomain && currentDomain.toLowerCase() !== newDomain.toLowerCase()) {
            alert(`Domain restricted: You can only change the part before the @ symbol. Your email must end with @${currentDomain}`);
            return;
        }

        // If email is changed and we haven't verified security, show modal
        if (!bypassSecurity && formData.email.toLowerCase() !== currentEmail.toLowerCase()) {
            setShowSecurityModal(true);
            return;
        }

        setLoading(true);
        try {
            const uid = localStorage.getItem('uid');
            if (!uid) return;

            const payload = {
                ...formData,
                currentPasscode: securityData.passcode
            };

            const response = await fetch('api/users/update', {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Update failed");

            // Update local and global state
            const updatedUser = { ...userData, ...formData };
            setUserData(updatedUser);
            if (auth?.setUser) auth.setUser(updatedUser);

            setIsEditing(false);
            setShowSecurityModal(false);
            setSecurityData({ passcode: '', confirmText: '' });
            alert("Profile updated successfully!");
            
            if (result.emailChanged) {
                // If email changed, we might want to update stored email
                localStorage.setItem('userEmail', formData.email);
            }
        } catch (error) {
            console.error("Error updating profile:", error);
            alert(error.message || "Failed to update profile.");
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePasswordUpdate = async () => {
        setPasswordError('');
        const { currentPassword, newPassword, confirmPassword } = passwordData;

        if (!currentPassword || !newPassword || !confirmPassword) {
            setPasswordError("All password fields are required.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError("New passwords do not match.");
            return;
        }

        if (newPassword.length < 6) {
            setPasswordError("Password must be at least 6 characters.");
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('api/auth/change-password', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Failed to update password");

            setSuccessConfig({
                title: 'Password Updated',
                message: 'Your account password has been changed successfully. Please use your new password next time you sign in.'
            });
            setShowSuccessModal(true);
            
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setIsEditing(false);
        } catch (error) {
            console.error("Password Update Error:", error);
            if (error.code === 'auth/wrong-password') {
                setPasswordError("Incorrect current password.");
            } else {
                setPasswordError("Failed to update password: " + error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handlePasscodeReset = async () => {
        setPasscodeResetError('');
        const { currentPasscode, newPasscode, confirmPasscode } = resetPasscodeData;

        // Validation
        if (userData?.passcode && !currentPasscode) {
            setPasscodeResetError("Current passcode is required.");
            return;
        }

        if (!newPasscode || !confirmPasscode) {
            setPasscodeResetError("New passcode fields are required.");
            return;
        }

        if (newPasscode.length !== 6) {
            setPasscodeResetError("Passcode must be exactly 6 digits.");
            return;
        }

        if (newPasscode !== confirmPasscode) {
            setPasscodeResetError("Passcodes do not match.");
            return;
        }

        setLoading(true);
        try {
            // If user has a passcode, we should ideally verify it first or pass it to the setup endpoint
            const response = await fetch('api/auth/setup-passcode', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    passcode: newPasscode,
                    oldPasscode: currentPasscode // Backend should handle verification if oldPasscode is provided
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Failed to update passcode");

            setSuccessConfig({
                title: 'Passcode Secured',
                message: 'Your 6-digit passcode has been successfully updated and is now active for secure actions.'
            });
            setShowSuccessModal(true);

            setResetPasscodeData({ currentPasscode: '', newPasscode: '', confirmPasscode: '' });
            setShowPasscodeResetModal(false);
            
            // Sync local user state
            const updatedUser = { ...(userData || {}), passcode: newPasscode };
            setUserData(updatedUser);
            if (auth?.setUser) {
                auth.setUser(updatedUser);
            }
        } catch (error) {
            console.error("Passcode Reset Error:", error);
            setPasscodeResetError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitFeedback = async () => {
        if (feedbackRatings.easeOfUse === 0 || feedbackRatings.aesthetics === 0 || feedbackRatings.functionality === 0) {
            alert("Please rate all categories before submitting.");
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('api/feedback', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    userName: userData?.firstName ? `${userData.firstName} ${userData.lastName}` : (userData?.first_name ? `${userData.first_name} ${userData.last_name}` : 'Anonymous'),
                    role: userData?.role || 'User',
                    ratings: feedbackRatings,
                    comment: feedbackComment,
                    appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0'
                })
            });

            if (!response.ok) throw new Error("Submission failed");

            alert("Thank you for your feedback! We appreciate your input.");
            // Reset form and go back
            setFeedbackRatings({ easeOfUse: 0, aesthetics: 0, functionality: 0 });
            setFeedbackComment('');
            setActiveTab('settings');
        } catch (error) {
            console.error("Error submitting feedback:", error);
            alert(`Failed to submit feedback: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleCheckUpdate = async () => {
        setCheckingForUpdate(true);
        setTimeout(async () => {
            const updateFound = await checkForUpdates();
            setCheckingForUpdate(false);
            
            // If no update was found, show a toast or alert. 
            // If it WAS found, the global ForceUpdateModal in App.jsx will trigger automatically via isUpdateAvailable context
            if (!updateFound) {
                alert("You're up to date! You are using the latest version of InsightEd.");
            }
        }, 1500);
    };


    // --- SUB-VIEWS RENDERERS ---    // 1. REDESIGNED PROFILE EDIT VIEW
    const renderProfileEdit = () => (
        <div className="p-4 sm:p-6 animate-in fade-in slide-in-from-right-4 duration-500 pb-24">
            {/* --- PROFILE HEADER CARD --- */}
            <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 mb-6 shadow-xl shadow-blue-900/5 dark:shadow-none border border-transparent dark:border-slate-700/50 text-center relative overflow-hidden group">
                {/* Subtle background decoration */}
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-50 dark:bg-blue-900/10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
                <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-indigo-50 dark:bg-indigo-900/10 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-700"></div>

                <div className="relative z-10">
                    <div className="w-24 h-24 bg-gradient-to-br from-[#004A99] to-indigo-600 dark:from-blue-600 dark:to-indigo-500 text-white rounded-[2rem] flex justify-center items-center text-3xl font-black mx-auto mb-4 shadow-xl shadow-blue-500/30 rotate-3 group-hover:rotate-0 transition-transform duration-500">
                        {userData?.firstName ? getInitials(formData.firstName || userData.firstName, formData.lastName || userData.lastName) : "..."}
                    </div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white m-0">
                        {formData.firstName ? `${formData.firstName} ${formData.lastName}` : (userData?.firstName ? `${userData.firstName} ${userData.lastName}` : "Authenticated User")}
                    </h3>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 rounded-full mt-2">
                        <FiShield size={12} className="text-[#004A99] dark:text-blue-400" />
                        <span className="text-[10px] font-bold text-[#004A99] dark:text-blue-300 uppercase tracking-wider">{userData?.role || "Resident User"}</span>
                    </div>
                </div>
            </div>

            {/* --- IDENTITY SECTION --- */}
            <h4 className="px-2 text-[10px] uppercase tracking-[0.2em] font-black text-slate-400 dark:text-slate-500 mb-3 flex items-center justify-between">
                <span>Personal Identity</span>
                {!isEditing && (
                    <button onClick={() => setIsEditing(true)} className="flex items-center gap-1 text-[#004A99] dark:text-blue-400 bg-transparent border-0 cursor-pointer p-0 normal-case tracking-normal">
                        <FiEdit3 size={14} /> <span className="text-xs font-bold">Edit</span>
                    </button>
                )}
            </h4>

            <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 mb-6 shadow-sm border border-transparent dark:border-slate-700/50 space-y-4">
                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1.5 ml-1">First Name</label>
                        <input
                            className={`w-full p-4 rounded-2xl text-[15px] font-medium outline-none transition-all ${isEditing
                                ? "border-2 border-[#004A99] bg-white dark:bg-slate-800 dark:text-white dark:border-blue-400"
                                : "border-2 border-transparent bg-slate-50 dark:bg-slate-700/30 text-slate-700 dark:text-slate-300"
                                }`}
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleInputChange}
                            disabled={!isEditing}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1.5 ml-1">Last Name</label>
                        <input
                            className={`w-full p-4 rounded-2xl text-[15px] font-medium outline-none transition-all ${isEditing
                                ? "border-2 border-[#004A99] bg-white dark:bg-slate-800 dark:text-white dark:border-blue-400"
                                : "border-2 border-transparent bg-slate-50 dark:bg-slate-700/30 text-slate-700 dark:text-slate-300"
                                }`}
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleInputChange}
                            disabled={!isEditing}
                        />
                    </div>
                </div>

                {/* Email (Special Verification logic) */}
                <div className="pt-2">
                    <label className="block text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1.5 ml-1">Registered Email</label>
                    <div className="relative group">
                        <input
                            className={`w-full p-4 rounded-2xl text-[15px] font-medium outline-none transition-all pr-12 ${isEditing
                                ? "border-2 border-[#004A99] bg-white dark:bg-slate-800 dark:text-white dark:border-blue-400"
                                : "border-2 border-transparent bg-slate-50 dark:bg-slate-700/30 text-slate-700 dark:text-slate-300"
                                }`}
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            disabled={!isEditing}
                        />
                        {isEditing && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                                <FiLock size={16} title="Secure Field" />
                            </div>
                        )}
                    </div>
                    {isEditing && (
                        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/50">
                            <p className="text-[11px] text-blue-600 dark:text-blue-300 leading-relaxed m-0 flex gap-2 font-medium">
                                <FiInfo className="shrink-0 mt-0.5" size={14} />
                                <span>Domain restriction: You can only change the part before <strong>@{userData?.email?.split('@')[1]}</strong>. Security verification required on save.</span>
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* --- CAMPUS / OFFICE SECTION --- */}
            <h4 className="px-2 text-[10px] uppercase tracking-[0.2em] font-black text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-2">
                <FiTool size={12} /> <span>Official Credentials</span>
            </h4>

            <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 mb-6 shadow-sm border border-transparent dark:border-slate-700/50 flex flex-wrap gap-3">
                {/* READ ONLY MASTER CREDENTIALS */}
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-100 dark:border-slate-700 flex flex-col flex-1 min-w-[140px]">
                    <span className="text-[10px] uppercase font-bold text-slate-400 mb-1">School ID</span>
                    <span className="text-sm font-black text-[#004A99] dark:text-blue-300">{userData?.school_id || "DEPED-ADMIN"}</span>
                </div>
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-100 dark:border-slate-700 flex flex-col flex-1 min-w-[140px]">
                    <span className="text-[10px] uppercase font-bold text-slate-400 mb-1">IERN</span>
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{userData?.iern || "NOT-GEN-SYS"}</span>
                </div>
            </div>

            {/* --- SECURITY SECTION --- */}
            <h4 className="px-2 text-[10px] uppercase tracking-[0.2em] font-black text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-2">
                <FiLock size={12} /> <span>Account Security</span>
            </h4>

            <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 mb-8 shadow-sm border border-transparent dark:border-slate-700/50">
                <div className="flex flex-col gap-4">
                    {isEditing ? (
                        /* PASSWORD FIELDS (Only when editing) */
                        <>
                            {passwordError && (
                                <div className="mb-2 p-3 bg-red-50 text-red-600 text-xs rounded-xl flex items-center gap-2 border border-red-100">
                                    <TbAlertTriangle /> {passwordError}
                                </div>
                            )}
                            <div>
                                <label className="block text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1.5 ml-1">Current Password</label>
                                <input
                                    type="password"
                                    className="w-full p-3.5 rounded-2xl text-[14px] font-medium bg-slate-50 dark:bg-slate-700/30 border border-transparent focus:border-[#004A99] focus:bg-white dark:text-white transition-all outline-none"
                                    placeholder="Confirm existing password"
                                    value={passwordData.currentPassword}
                                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1.5 ml-1">New Password</label>
                                    <input
                                        type="password"
                                        className="w-full p-3.5 rounded-2xl text-[14px] font-medium bg-slate-50 dark:bg-slate-700/30 border border-transparent focus:border-[#004A99] focus:bg-white dark:text-white transition-all outline-none"
                                        placeholder="Min 6 chars"
                                        value={passwordData.newPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1.5 ml-1">Confirm New</label>
                                    <input
                                        type="password"
                                        className="w-full p-3.5 rounded-2xl text-[14px] font-medium bg-slate-50 dark:bg-slate-700/30 border border-transparent focus:border-[#004A99] focus:bg-white dark:text-white transition-all outline-none"
                                        placeholder="Repeat new password"
                                        value={passwordData.confirmPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                    />
                                </div>
                            </div>
                            <button
                                onClick={handlePasswordUpdate}
                                className="w-full py-3.5 bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border-0 cursor-pointer"
                                disabled={loading}
                            >
                                {loading ? "Updating..." : "Process Credentials Update"}
                            </button>
                        </>
                    ) : (
                        /* QUICK ACTIONS WHEN NOT EDITING */
                        <div className="flex flex-col gap-3">
                            <div className="flex justify-between items-center p-3.5 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border border-transparent">
                                <div>
                                    <p className="m-0 text-[10px] uppercase font-bold text-slate-400">Password</p>
                                    <p className="m-0 text-sm font-medium text-slate-700 dark:text-slate-200 tracking-widest mt-0.5">••••••••</p>
                                </div>
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 text-[#004A99] dark:text-blue-400 cursor-pointer"
                                >
                                    <FiEdit3 size={18} />
                                </button>
                            </div>

                            {/* PASSCODE RESET QUICK ACTION */}
                            <div className="flex justify-between items-center p-3.5 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border border-transparent">
                                <div>
                                    <p className="m-0 text-[10px] uppercase font-bold text-slate-400">Passcode Protection</p>
                                    <p className="m-0 text-sm font-medium text-slate-700 dark:text-slate-200 tracking-[0.5em] mt-0.5">
                                        {userData?.passcode ? '••••••' : 'Not Configured'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowPasscodeResetModal(true)}
                                    className="p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 text-[#004A99] dark:text-blue-400 cursor-pointer flex items-center gap-2"
                                >
                                    <span className="text-[10px] font-bold uppercase">{userData?.passcode ? 'Reset' : 'Setup'}</span>
                                    <FiLock size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* --- FLOAT SAVE BUTTON (Only when editing) --- */}
            {isEditing && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-[60] flex gap-3 animate-in fade-in slide-in-from-bottom-10 duration-500">
                    <button
                        onClick={() => {
                            setIsEditing(false);
                            // Reset form data from userData
                            setFormData({
                                firstName: userData.firstName,
                                lastName: userData.lastName,
                                email: userData.email
                            });
                        }}
                        className="flex-1 py-4 bg-white dark:bg-slate-800 text-slate-500 rounded-[1.8rem] font-bold shadow-2xl border border-slate-100 dark:border-slate-700 cursor-pointer active:scale-95 transition-all"
                    >
                        Discard
                    </button>
                    <button
                        onClick={() => handleSaveProfile()}
                        className="flex-[2] py-4 bg-gradient-to-br from-[#004A99] to-indigo-700 dark:from-blue-600 dark:to-indigo-500 text-white rounded-[1.8rem] font-black shadow-2xl shadow-blue-500/40 cursor-pointer active:scale-95 transition-all flex justify-center items-center gap-2"
                        disabled={loading}
                    >
                        {loading ? <FiRefreshCw className="animate-spin" /> : <FiSave size={18} />}
                        Save Changes
                    </button>
                </div>
            )}
        </div>
    );

    // 2. ABOUT VIEW
    const renderAbout = () => (
        <div className="p-5 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl shadow-blue-900/5 dark:shadow-none border border-transparent dark:border-slate-700/50 text-center relative overflow-hidden">
                {/* Branding Logo */}
                <div className="w-[80px] h-[80px] bg-[#004A99] dark:bg-blue-600 rounded-[2rem] mx-auto mb-6 flex items-center justify-center text-white font-black text-3xl shadow-xl shadow-blue-500/30">
                    IE
                </div>
                
                <h2 className="text-[#004A99] dark:text-blue-400 mb-1 text-2xl font-black tracking-tight">InsightED</h2>
                <p className="text-gray-400 dark:text-gray-500 text-sm font-medium mb-8">Version {import.meta.env.VITE_APP_VERSION || '1.0.0'} (Beta)</p>

                <div className="space-y-6 text-left">
                    <p className="text-slate-600 dark:text-slate-300 text-[15px] leading-relaxed font-medium">
                        <strong className="text-slate-800 dark:text-white font-black">InsightED</strong> is a mobile-first data collection application for real-time field data collection, designed to transform raw school-level data into actionable organizational strategies. By serving as the digital conduit to the STRIDE Dashboard, the application enables the Department to perform proactive management towards strategic use of critical education resources.
                    </p>
                    
                    <p className="text-slate-600 dark:text-slate-300 text-[15px] leading-relaxed font-medium">
                        With high-fidelity data captured directly from the source, the Department can execute informed, evidence-based actions with unprecedented speed. This modernization of education management ensures that the Department can identify and address the unique needs of every school, guaranteeing that resources and support are deployed precisely where they will most improve the quality of education for our learners.
                    </p>
                </div>

                <div className="h-px bg-slate-100 dark:bg-slate-700/50 my-8"></div>
                
                <p className="text-center text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] leading-relaxed">
                    © 2024 INSIGHTED DEVELOPMENT TEAM.<br />ALL RIGHTS RESERVED.
                </p>
            </div>
        </div>
    );

    // 4. FAQ VIEW (NEW)
    const renderFAQ = () => {
        const userRole = userData?.role || 'User';
        const filteredQuestions = FAQ_DATA.filter(q => q.roles.includes(userRole));

        return (
            <div className="p-5 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-3 mb-6 border-b border-gray-100 dark:border-slate-700 pb-4">
                        <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-900/40 flex items-center justify-center text-orange-500 dark:text-orange-400">
                            <FiHelpCircle size={20} />
                        </div>
                        <div>
                            <h3 className="text-base text-gray-800 dark:text-white font-bold m-0">Help Center</h3>
                            <p className="text-xs text-gray-400 dark:text-gray-500 m-0">Showing FAQs for {userRole}</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {filteredQuestions.map((item, idx) => {
                            const isOpen = openFaqIndex === idx;
                            return (
                                <div key={idx} className="border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden transition-all">
                                    <button
                                        onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                                        className={`w-full p-4 flex justify-between items-center bg-transparent border-0 cursor-pointer text-left transition-colors ${isOpen ? 'bg-orange-50 dark:bg-orange-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                                    >
                                        <span className={`text-sm font-semibold ${isOpen ? 'text-orange-700 dark:text-orange-300' : 'text-gray-700 dark:text-gray-200'}`}>
                                            {item.question}
                                        </span>
                                        {isOpen ? <FiChevronUp className="text-orange-500" /> : <FiChevronDown className="text-gray-400" />}
                                    </button>

                                    {isOpen && (
                                        <div className="p-4 pt-2 bg-orange-50/50 dark:bg-slate-800/50 text-sm text-gray-600 dark:text-gray-300 leading-relaxed animate-in fade-in duration-200">
                                            {item.answer}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {filteredQuestions.length === 0 && (
                            <p className="text-center text-gray-400 text-sm py-8">No specific questions found for your role.</p>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // 5. FEEDBACK VIEW (NEW)
    const renderFeedback = () => {
        const categories = [
            { id: 'easeOfUse', label: 'Ease of Use' },
            { id: 'aesthetics', label: 'Aesthetics / Design' },
            { id: 'functionality', label: 'Functionality' }
        ];

        return (
            <div className="p-5 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm">
                    <div className="text-center mb-6">
                        <div className="w-12 h-12 bg-pink-50 dark:bg-pink-900/30 rounded-full flex items-center justify-center text-pink-500 mx-auto mb-3">
                            <FiStar size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Rate Our App</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Your feedback helps us improve.</p>
                    </div>

                    <div className="space-y-6 mb-6">
                        {categories.map((cat) => (
                            <div key={cat.id} className="text-center">
                                <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2">{cat.label}</label>
                                <div className="flex justify-center gap-2">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            onClick={() => setFeedbackRatings(prev => ({ ...prev, [cat.id]: star }))}
                                            className="bg-transparent border-0 cursor-pointer focus:outline-none transition-transform active:scale-90 hover:scale-110"
                                        >
                                            <FiStar
                                                size={28}
                                                className={`transition-colors duration-200 ${star <= feedbackRatings[cat.id]
                                                    ? 'fill-amber-400 text-amber-400'
                                                    : 'text-slate-200 dark:text-slate-600'
                                                    }`}
                                            />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2">Comments & Suggestions</label>
                        <textarea
                            className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                            rows="4"
                            placeholder="Tell us what you like or what needs improvement..."
                            value={feedbackComment}
                            onChange={(e) => setFeedbackComment(e.target.value)}
                        />
                    </div>

                    <button
                        onClick={handleSubmitFeedback}
                        disabled={loading}
                        className="w-full py-3 bg-[#004A99] hover:bg-blue-800 text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 active:scale-95 transition-all disabled:opacity-70 flex justify-center items-center gap-2"
                    >
                        {loading ? 'Submitting...' : (
                            <>
                                <FiMessageSquare /> Submit Feedback
                            </>
                        )}
                    </button>
                </div>
            </div>
        );
    };


    // 6. SECURITY CONFIRMATION MODAL (For Email Changes)
    const renderSecurityModal = () => {
        if (!showSecurityModal) return null;

        return (
            <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 pb-10 sm:pb-6 animate-in slide-in-from-bottom-10 duration-500">
                    <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-6 sm:hidden"></div>
                    
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/40 rounded-2xl flex items-center justify-center text-orange-600 dark:text-orange-400">
                            <FiShield size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white m-0">Security Verification</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 m-0">Confirm your identity to change your email.</p>
                        </div>
                    </div>

                    <div className="space-y-4 mb-8">
                        <div>
                            <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-1.5">New Email Address</label>
                            <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200">
                                {formData.email}
                            </div>
                        </div>


                        <div>
                            <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-1.5">6-Digit Passcode</label>
                            <input
                                type="password"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength="6"
                                placeholder="••••••"
                                className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-sm text-center tracking-[1em] font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white transition-all"
                                value={securityData.passcode}
                                onChange={(e) => setSecurityData({ ...securityData, passcode: e.target.value.replace(/\D/g, '') })}
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-1.5 text-center">Type <span className="text-blue-600 dark:text-blue-400">CONFIRM</span> to proceed</label>
                            <input
                                type="text"
                                placeholder="CONFIRM"
                                className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white transition-all uppercase"
                                value={securityData.confirmText}
                                onChange={(e) => setSecurityData({ ...securityData, confirmText: e.target.value.toUpperCase() })}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => handleSaveProfile(true)}
                            disabled={loading || securityData.passcode.length < 6 || securityData.confirmText.toUpperCase().trim() !== 'CONFIRM'}
                            className="w-full py-4 bg-[#004A99] hover:bg-blue-800 text-white rounded-2xl font-bold shadow-lg shadow-blue-900/20 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale disabled:scale-100 flex justify-center items-center gap-2"
                        >
                            {loading ? <FiRefreshCw className="animate-spin" /> : <FiCheckCircle />}
                            Confirm & Update
                        </button>
                        
                        <button
                            onClick={() => {
                                setShowSecurityModal(false);
                                setSecurityData({ passcode: '', confirmText: '' });
                            }}
                            className="w-full py-4 bg-transparent text-slate-500 dark:text-slate-400 font-bold hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        );
    };


    // 3. MAIN SETTINGS MENU
    const renderSettingsMenu = () => (
        <div className="p-5">
            {/* User Mini Summary */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl flex items-center mb-6 shadow-sm transition-colors border border-transparent dark:border-slate-700">
                <div className="w-12 h-12 bg-[#004A99] text-white rounded-full flex justify-center items-center text-xl font-bold mr-4 shrink-0 shadow-md">
                    {userData?.firstName ? getInitials(userData.firstName, userData.lastName) : "..."}
                </div>
                <div className="flex flex-col">
                    <h3 className="m-0 text-base font-bold text-gray-800 dark:text-white">
                        {userData?.firstName ? `${userData.firstName} ${userData.lastName}` : "Loading..."}
                    </h3>
                    <div className="flex flex-col">
                        <span className="text-xs text-gray-500 dark:text-gray-400">{userData?.role || "User"}</span>
                        {iern && (
                            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter mt-0.5">
                                IERN: {iern}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Menu Items */}
            <div className="bg-white dark:bg-slate-800 rounded-xl py-2 mb-5 shadow-sm overflow-hidden transition-colors border border-transparent dark:border-slate-700">
                <h4 className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2.5 px-5 pt-3 font-bold">Account</h4>
                <button className="w-full flex justify-between items-center px-5 py-4 border-b border-gray-50 dark:border-slate-700 bg-transparent cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors" onClick={() => setActiveTab('profile')}>
                    <div className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-lg flex justify-center items-center bg-blue-50 dark:bg-blue-900/30 text-[#004A99] dark:text-blue-300">
                            <FiUser size={20} />
                        </div>
                        <span className="text-[15px] font-medium text-gray-700 dark:text-gray-200">My Profile</span>
                    </div>
                    <FiChevronRight size={20} className="text-gray-300 dark:text-gray-500" />
                </button>
                
                {/* Passcode Protection */}
                <button 
                    onClick={() => setShowPasscodeResetModal(true)}
                    className="w-full flex justify-between items-center px-5 py-4 border-b border-gray-50 dark:border-slate-700 bg-transparent cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-lg flex justify-center items-center bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300">
                            <FiLock size={20} />
                        </div>
                        <div className="text-left">
                            <span className="text-[15px] font-medium text-gray-700 dark:text-gray-200 block">Passcode Protection</span>
                            <span className={`text-[10px] font-semibold uppercase tracking-wide ${userData?.passcode ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                                {userData?.passcode ? 'Active' : 'Secure Now'}
                            </span>
                        </div>
                    </div>
                    <FiChevronRight size={20} className="text-gray-300 dark:text-gray-500" />
                </button>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl py-2 mb-5 shadow-sm overflow-hidden transition-colors border border-transparent dark:border-slate-700">
                <h4 className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2.5 px-5 pt-3 font-bold">General</h4>

                {/* Dark Mode Toggle */}
                <div className="w-full flex justify-between items-center px-5 py-4 border-b border-gray-50 dark:border-slate-700 bg-transparent">
                    <div className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-lg flex justify-center items-center bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                            <FiMoon size={20} />
                        </div>
                        <span className="text-[15px] font-medium text-gray-700 dark:text-gray-200">Dark Mode</span>
                    </div>
                    {/* Toggle Switch UI */}
                    <div
                        onClick={toggleTheme}
                        className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors duration-300 ${isDarkMode ? 'bg-[#004A99] dark:bg-blue-600' : 'bg-gray-300'}`}
                    >
                        <div className={`w-[18px] h-[18px] bg-white rounded-full absolute top-[3px] transition-all duration-300 shadow-sm ${isDarkMode ? 'left-[23px]' : 'left-[3px]'}`} />
                    </div>
                </div>

                {/* Optimize App - Merged Update & Troubleshoot */}
                <button
                    disabled={checkingForUpdate}
                    onClick={() => setShowOptimizeConfirm(true)}
                    className="w-full flex justify-between items-center px-5 py-4 border-b border-gray-50 dark:border-slate-700 bg-transparent cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-lg flex justify-center items-center bg-blue-50 dark:bg-blue-900/30 text-[#004A99] dark:text-blue-300">
                            {checkingForUpdate ? (
                                <FiRefreshCw size={20} className="animate-spin" />
                            ) : (
                                <FiRefreshCw size={20} />
                            )}
                        </div>
                        <div className="text-left">
                            <span className="text-[15px] font-bold text-gray-700 dark:text-gray-200 block">
                                Optimize App
                            </span>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wide">
                                Check for Updates & Repair
                            </span>
                        </div>
                    </div>
                    {checkingForUpdate ? (
                        <span className="text-xs text-gray-400">Optimizing...</span>
                    ) : (
                        <FiChevronRight size={20} className="text-gray-300 dark:text-gray-500" />
                    )}
                </button>

                {/* FAQ Menu Item */}
                <button className="w-full flex justify-between items-center px-5 py-4 border-b border-gray-50 dark:border-slate-700 bg-transparent cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors" onClick={() => setActiveTab('faq')}>
                    <div className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-lg flex justify-center items-center bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300">
                            <FiHelpCircle size={20} />
                        </div>
                        <span className="text-[15px] font-medium text-gray-700 dark:text-gray-200">FAQ & Help</span>
                    </div>
                    <FiChevronRight size={20} className="text-gray-300 dark:text-gray-500" />
                </button>

                <button className="w-full flex justify-between items-center px-5 py-4 border-b border-gray-50 dark:border-slate-700 bg-transparent cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors" onClick={() => setActiveTab('feedback')}>
                    <div className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-lg flex justify-center items-center bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-300">
                            <FiStar size={20} />
                        </div>
                        <span className="text-[15px] font-medium text-gray-700 dark:text-gray-200">Rate & Feedback</span>
                    </div>
                    <FiChevronRight size={20} className="text-gray-300 dark:text-gray-500" />
                </button>

                <button className="w-full flex justify-between items-center px-5 py-4 bg-transparent cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors" onClick={() => setActiveTab('about')}>
                    <div className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-lg flex justify-center items-center bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300">
                            <FiInfo size={20} />
                        </div>
                        <span className="text-[15px] font-medium text-gray-700 dark:text-gray-200">About InsightEd</span>
                    </div>
                    <FiChevronRight size={20} className="text-gray-300 dark:text-gray-500" />
                </button>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl py-2 mb-5 shadow-sm overflow-hidden border border-transparent dark:border-slate-700">
                <button className="w-full flex justify-between items-center px-5 py-4 bg-transparent cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" onClick={handleLogout}>
                    <div className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-lg flex justify-center items-center bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                            <FiLogOut size={20} />
                        </div>
                        <span className="text-[15px] font-bold text-red-600 dark:text-red-400">Logout</span>
                    </div>
                </button>
            </div>

            <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-8">InsightEd Mobile app v{import.meta.env.VITE_APP_VERSION || '1.0.0'}</p>
        </div>
    );

    // --- MAIN RENDER ---
    if (authLoading) {
        return (
            <div className="min-h-screen bg-[#f5f7fa] dark:bg-[#1a202c] flex items-center justify-center p-6">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-500 font-bold">Verifying Identity...</p>
                </div>
            </div>
        );
    }
    
    return (
        <PageTransition>
            <div className={`min-h-screen font-sans pb-20 transition-colors duration-300 ${isDarkMode ? 'bg-[#1a202c]' : 'bg-[#f5f7fa]'}`}>

                {/* DYNAMIC HEADER */}
                <div className="bg-gradient-to-br from-[#004A99] to-[#003366] dark:from-slate-900 dark:to-slate-800 p-5 h-20 flex items-center justify-between text-white rounded-b-3xl shadow-lg transition-all duration-300">
                    {activeTab !== 'settings' && (
                        <button className="bg-transparent border-0 text-white cursor-pointer flex items-center" onClick={() => {
                            setActiveTab('settings');
                            setIsEditing(false); // Reset edit mode on back
                        }}>
                            <FiChevronLeft size={24} />
                        </button>
                    )}
                    <h2 className="m-0 text-lg font-semibold flex-1 text-center">
                        {activeTab === 'settings' ? 'Settings' :
                            activeTab === 'profile' ? 'Edit Profile' :
                                activeTab === 'faq' ? 'FAQ' : 'About'}
                    </h2>
                    {/* Spacer to balance header if back button exists */}
                    {activeTab !== 'settings' && <div className="w-6"></div>}
                </div>

                {/* CONTENT AREA */}
                <div className="">
                    {activeTab === 'settings' && renderSettingsMenu()}
                    {activeTab === 'profile' && renderProfileEdit()}
                    {activeTab === 'faq' && renderFAQ()}
                    {activeTab === 'feedback' && renderFeedback()}
                    {activeTab === 'about' && renderAbout()}

                </div>

                <BottomNav homeRoute={homeRoute} userRole={userData?.role || user?.account_category || user?.role || localStorage.getItem('userRole')} />
                
                {/* Security Verification Modal (Generic for Email/Profile Updates) */}
                {renderSecurityModal()}

                {/* Success Modal */}
                {showSuccessModal && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                        <div className="bg-white dark:bg-slate-800 w-full max-w-xs rounded-[2.5rem] shadow-2xl p-8 text-center animate-in zoom-in-95 duration-500 relative overflow-hidden">
                            {/* Confetti-like decorative elements */}
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-400 via-emerald-500 to-teal-400"></div>
                            
                            <div className="mb-6 relative">
                                <div className="w-20 h-20 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-green-100 dark:border-green-800/30">
                                    <FiCheckCircle size={40} className="text-green-500 animate-bounce" />
                                </div>
                                <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full blur-xl opacity-50 animate-pulse"></div>
                            </div>

                            <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2 tracking-tight">
                                {successConfig.title}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-8 font-medium">
                                {successConfig.message}
                            </p>

                            <button
                                onClick={() => setShowSuccessModal(false)}
                                className="w-full py-4 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-2xl font-black shadow-xl shadow-slate-900/20 active:scale-[0.98] transition-all"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                )}

                {/* Passcode Reset Modal */}
                {showPasscodeResetModal && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in-95 duration-500 relative overflow-hidden">
                            {/* Decorative Blobs */}
                            <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-blue-50 dark:bg-blue-900/10 rounded-full blur-2xl"></div>
                            
                            <div className="relative z-10 text-center">
                                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-5 text-white shadow-xl shadow-blue-200 dark:shadow-none">
                                    <FiLock size={30} />
                                </div>
                                
                                <h3 className="text-xl font-black text-slate-800 dark:text-white mb-1">
                                    {userData?.passcode ? 'Reset Passcode' : 'Setup Passcode'}
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                                    {userData?.passcode 
                                        ? 'Enter your current passcode to authorize a change.'
                                        : 'Set a 6-digit passcode for faster, secure logins.'}
                                </p>

                                {passcodeResetError && (
                                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs rounded-xl flex items-center gap-2 border border-red-100 dark:border-red-800/50">
                                        <TbAlertTriangle /> {passcodeResetError}
                                    </div>
                                )}

                                <div className="space-y-4 mb-8">
                                    {userData?.passcode && (
                                        <div className="text-left animate-in fade-in slide-in-from-top-2 duration-300">
                                            <label className="block text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1.5 ml-1">Current Passcode</label>
                                            <input
                                                type="password"
                                                inputMode="numeric"
                                                maxLength="6"
                                                className="w-full p-4 rounded-2xl text-[14px] font-medium bg-slate-50 dark:bg-slate-700/30 border border-transparent focus:border-[#004A99] focus:bg-white dark:text-white transition-all outline-none text-center tracking-[0.3em]"
                                                placeholder="••••••"
                                                value={resetPasscodeData.currentPasscode}
                                                onChange={(e) => setResetPasscodeData({ ...resetPasscodeData, currentPasscode: e.target.value.replace(/\D/g, '') })}
                                            />
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-3 text-left">
                                        <div>
                                            <label className="block text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1.5 ml-1">New Passcode</label>
                                            <input
                                                type="password"
                                                inputMode="numeric"
                                                maxLength="6"
                                                className="w-full p-4 rounded-2xl text-[14px] font-medium bg-slate-50 dark:bg-slate-700/30 border border-transparent focus:border-[#004A99] focus:bg-white dark:text-white transition-all outline-none text-center tracking-[0.3em]"
                                                placeholder="••••••"
                                                value={resetPasscodeData.newPasscode}
                                                onChange={(e) => setResetPasscodeData({ ...resetPasscodeData, newPasscode: e.target.value.replace(/\D/g, '') })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1.5 ml-1">Confirm</label>
                                            <input
                                                type="password"
                                                inputMode="numeric"
                                                maxLength="6"
                                                className="w-full p-4 rounded-2xl text-[14px] font-medium bg-slate-50 dark:bg-slate-700/30 border border-transparent focus:border-[#004A99] focus:bg-white dark:text-white transition-all outline-none text-center tracking-[0.3em]"
                                                placeholder="••••••"
                                                value={resetPasscodeData.confirmPasscode}
                                                onChange={(e) => setResetPasscodeData({ ...resetPasscodeData, confirmPasscode: e.target.value.replace(/\D/g, '') })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={handlePasscodeReset}
                                        disabled={loading}
                                        className="w-full py-4 bg-gradient-to-br from-[#004A99] to-indigo-700 dark:from-blue-600 dark:to-indigo-500 text-white rounded-2xl font-black shadow-lg shadow-blue-500/30 active:scale-95 transition-all flex justify-center items-center gap-2"
                                    >
                                        {loading ? <FiRefreshCw className="animate-spin" /> : <FiSave size={18} />}
                                        Update Passcode
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowPasscodeResetModal(false);
                                            setResetPasscodeData({ currentPasscode: '', newPasscode: '', confirmPasscode: '' });
                                            setPasscodeResetError('');
                                        }}
                                        className="w-full py-4 bg-transparent text-slate-500 dark:text-slate-400 font-bold hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Optimize App — Confirm Modal */}
                {showOptimizeConfirm && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-3xl shadow-2xl p-6 pb-6 animate-in zoom-in-95 duration-500">

                            {/* Icon */}
                            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-5">
                                <FiRefreshCw size={30} className="text-[#004A99] dark:text-blue-400" />
                            </div>

                            <h3 className="text-xl font-black text-slate-800 dark:text-white text-center mb-2">Optimize App?</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 text-center leading-relaxed mb-8">
                                This will clear the temporary system cache and fetch the latest version.
                                The app will <strong className="text-slate-700 dark:text-slate-200">automatically restart</strong> after optimization.
                            </p>

                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={async () => {
                                        setShowOptimizeConfirm(false);
                                        setCheckingForUpdate(true);
                                        // Show success modal briefly before reload
                                        setShowOptimizeSuccess(true);
                                        
                                        try {
                                            // 1. Remote Repair Protocol: Align Unit 8 JSONB
                                            await fetch('api/system/align-unit8', {
                                                method: 'POST',
                                                headers: {
                                                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                                                    'Content-Type': 'application/json'
                                                }
                                            });
                                        } catch (err) {
                                            console.warn("Failed to reach align-unit8 endpoint:", err);
                                        }
                                        
                                        setTimeout(async () => {
                                            await hardReset();
                                        }, 2000);
                                    }}
                                    className="w-full py-4 bg-gradient-to-br from-[#004A99] to-indigo-700 dark:from-blue-600 dark:to-indigo-500 text-white rounded-2xl font-black shadow-lg shadow-blue-500/30 active:scale-95 transition-all flex justify-center items-center gap-2"
                                >
                                    <FiRefreshCw size={18} />
                                    Yes, Optimize Now
                                </button>
                                <button
                                    onClick={() => setShowOptimizeConfirm(false)}
                                    className="w-full py-4 bg-transparent text-slate-500 dark:text-slate-400 font-bold hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Optimize App — Success Modal */}
                {showOptimizeSuccess && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white dark:bg-slate-800 w-full max-w-xs rounded-3xl shadow-2xl p-8 text-center animate-in zoom-in-95 duration-500">
                            {/* Spinning loader */}
                            <div className="relative w-20 h-20 mx-auto mb-5">
                                <div className="absolute inset-0 rounded-full border-4 border-blue-100 dark:border-blue-900/40" />
                                <div className="absolute inset-0 rounded-full border-4 border-t-[#004A99] dark:border-t-blue-400 animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <FiRefreshCw size={24} className="text-[#004A99] dark:text-blue-400" />
                                </div>
                            </div>
                            <h3 className="text-lg font-black text-slate-800 dark:text-white mb-1">Optimizing System...</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Clearing cache, fetching updates, and <strong className="text-blue-600 dark:text-blue-400">aligning Unit 8 JSONB data</strong>. Restarting shortly.</p>
                        </div>
                    </div>
                )}
            </div>
        </PageTransition>
    );
};

// --- STYLING (Converting to classes for easier dark mode maintenance) ---
// Note: I have replaced inline styles with Tailwind classes in the render methods above
// for better maintainability and cleaner code.

export default UserProfile;