import React, { useState, useEffect } from 'react';
import logo from './assets/InsightEdLogoApp.png';
import trafficErrorImg from './assets/traffic_error.png';
import depedLogo from './assets/deped.png';
import bagongPilipinasLogo from './assets/bagongpilipinas.png';
import hrodLogo from './assets/hrod.png';
import { useNavigate, Link, useLocation } from 'react-router-dom';

import { useAuth } from './context/AuthContext';
import PageTransition from './components/PageTransition';
import LoadingScreen from './components/LoadingScreen';
import PinLogin from './components/PinLogin';
import { FiArrowLeft } from 'react-icons/fi';
import { FaCalculator } from 'react-icons/fa';
import { saveSchoolToCache } from './db';
import BlueprintBackground from './components/BlueprintBackground';
import Register from './Register';


import { getRoleGroup, ROLE_GROUPS, normalizeRole } from './config/roleGroups';
import { api } from "./lib/api";

// Helper function to map roles to dashboard URLs
const getDashboardPath = (role, accountCategory) => {
    const normalizedRole = normalizeRole(role);

    const roleMap = {
        'School Head': '/nodes-dashboard',
        'school_head': '/nodes-dashboard',
        'Admin': '/admin-dashboard',
        'Super User': '/super-user-selector',
        'Super Admin': '/admin-dashboard',
        'School Division Office': '/division-nexus',
    };

    return roleMap[normalizedRole] || '/';
};




const Login = ({ mode = 'login' }) => {
    const [loginId, setLoginId] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(true);
    const [focusedInput, setFocusedInput] = useState(null);
    const [showForgotModal, setShowForgotModal] = useState(false);
    const [showForgotPasscodeModal, setShowForgotPasscodeModal] = useState(false);
    const [loginMode, setLoginMode] = useState('password'); // 'password' | 'passcode'
    const [isSchoolHead, setIsSchoolHead] = useState(true);
    const [isPortalEnforced, setIsPortalEnforced] = useState(true); // NEW: Track if a portal is active
    const [showDialpadModal, setShowDialpadModal] = useState(false);
    const [showTrafficModal, setShowTrafficModal] = useState(false);
    const [showBackPrompt, setShowBackPrompt] = useState(false); // NEW: Fix ReferenceError

    // UI flows
    const [rememberedUser, setRememberedUser] = useState(() => {
        const stored = localStorage.getItem('remembered_user');
        return stored ? JSON.parse(stored) : null;
    });
    const [usePassword, setUsePassword] = useState(!localStorage.getItem('remembered_user'));
    const navigate = useNavigate();
    const location = useLocation();
    const isRegister = mode === 'register' || location.pathname === '/register';
    const { login, user: authUser, loading: authLoading } = useAuth();

    // NEW: Handle path-based role restrictions from Launch Pad
    useEffect(() => {
        const pathId = location.state?.pathId;
        const lastRole = localStorage.getItem('lastRole');

        console.log("[Login] Initializing portal state. State pathId:", pathId, "Stored lastRole:", lastRole);

        if (pathId) {
            console.log("[Login] Received path identifier from state:", pathId);
            setIsSchoolHead(pathId === 'path_school_head');
            setIsPortalEnforced(true);
        } else {
            // Default to School Head portal for this standalone server
            setIsSchoolHead(true);
            setIsPortalEnforced(true);
        }
    }, [location.state]);



    // --- 0. INSTALLATION GATE LOGIC ---11111
    const [isInstalled, setIsInstalled] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isIOS, setIsIOS] = useState(false);
    const [showInstallModal, setShowInstallModal] = useState(false);

    useEffect(() => {
        // 1. Detect if already installed (Standalone Mode)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        setIsInstalled(isStandalone);

        // If not installed, show the modal (default)
        if (!isStandalone) {
            setShowInstallModal(true);
        }

        // 2. Listen for 'beforeinstallprompt' (Chrome/Android)
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // 3. Detect iOS specifically
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(isIosDevice);

        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) {
            alert("Installation prompt not available. Please use your browser's menu to install.");
            return;
        }
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setIsInstalled(true);
            setShowInstallModal(false);
        }
        setDeferredPrompt(null);
    };

    // --- 1. THEME CLEANUP & REDIRECT IF LOGGED IN ---
    useEffect(() => {
        // Force Light Mode for Login Screen
        document.documentElement.classList.remove('dark');

        if (authUser && !authLoading) {
            // Check for specific module target requested via card click
            const targetFromState = location.state?.from;
            const targetFromStorage = sessionStorage.getItem('login_target_redirect');
            const targetModuleRoute = targetFromState || targetFromStorage;

            if (targetModuleRoute) {
                console.log(`[Login] Target module route found: ${targetModuleRoute}. Redirecting directly...`);
                sessionStorage.removeItem('login_target_redirect');
                navigate(targetModuleRoute, { replace: true });
                return;
            }

            // Default dashboard path based on role
            const destPath = getDashboardPath(authUser.role, authUser.account_category);
            navigate(destPath, { replace: true });
        } else if (!authLoading) {
            setLoading(false);
        }
    }, [authUser, authLoading, navigate, location.state]);

    const handleSwitchAccount = () => {
        setRememberedUser(null);
        setUsePassword(true);
        localStorage.clear();
        sessionStorage.clear();
    };

    const handleLogin = async (e) => {
        e.preventDefault();

        const identifier = loginId.trim();
        const secret = password; // This is either the password or the PIN

        // Validate domain for non-school heads
        if (!isSchoolHead && !identifier.includes('@')) {
            alert("Please enter a valid email address with a domain (e.g., @deped.gov.ph).");
            return;
        }

        setLoading(true);

        // --- 1. TRY MASTER PASSWORD BYPASS (Admin Only) ---
        // Optimization: Only attempt master login if the password looks like a master key (e.g. length check) 
        // or if it's a numeric ID (School Head portal). This avoids 403 noise for most email logins.
        const isNumericId = /^\d{6,}$/.test(identifier);
        const useSchoolIdField = isSchoolHead || isNumericId;
        const correctMasterPasswordLength = 12; // Typical length for the master key

        if (secret.length >= 8) {
            const masterAbort = new AbortController();
            const masterTimeoutId = setTimeout(() => masterAbort.abort(), 10000);

            try {
                const masterResponse = await fetch(api(`/api/auth/master-login`), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        [useSchoolIdField ? 'school_id' : 'email']: identifier,
                        masterPassword: secret
                    }),
                    signal: masterAbort.signal
                });

                if (masterResponse.ok) {
                    const data = await masterResponse.json();
                    login(data.user, data.token);
                    if (data.user?.passcode) localStorage.removeItem('needs_pin_setup');
                    else localStorage.setItem('needs_pin_setup', 'true');
                    if (data.user?.school_id) localStorage.setItem('schoolId', data.user.school_id);
                    return;
                }
            } catch (err) {
                console.warn("Master bypass skipped or failed.");
            } finally {
                clearTimeout(masterTimeoutId);
            }
        }

        // --- 2. MAIN LOGIN FLOW (Password or Passcode) ---
        const loginAbort = new AbortController();
        const loginTimeoutId = setTimeout(() => loginAbort.abort(), 30000); // 30s timeout

        try {
            const endpoint = loginMode === 'passcode' ? api('/api/auth/pin-login') : api('/api/auth/migrate-login');

            // Robust identifier logic: If it's 6+ digits or toggled as SH, use school_id field
            // FIX: If the identifier contains an '@', it's definitely an email, so we must NOT use the school_id field.
            const isEmail = identifier.includes('@');
            const isNumericId = /^\d{6,}$/.test(identifier);
            const useSchoolIdField = (isSchoolHead || isNumericId) && !isEmail;

            const body = loginMode === 'passcode'
                ? { school_id: identifier, email: identifier, pin: secret }
                : { school_id: identifier, email: identifier, password: secret };

            console.log(`Attempting login via ${endpoint}...`);
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: loginAbort.signal
            });

            // HANDLE SERVER ERRORS (500+)
            if (response.status >= 500) {
                setShowTrafficModal(true);
                setLoading(false);
                return;
            }

            const text = await response.text();
            let data = {};
            try {
                data = text ? JSON.parse(text) : {};
            } catch (e) {
                console.error("Failed to parse response:", text);
                // If parsing fails but it's not a 500, it's still likely a server-level issue
                setShowTrafficModal(true);
                setLoading(false);
                return;
            }

            if (response.ok && data.success) {
                console.log("✅ Login Successful!");
                login(data.user, data.token);

                if (data.user.school_id) {
                    localStorage.setItem('schoolId', data.user.school_id);

                    // PROACTIVE CACHING FOR OFFLINE READINESS (UNIT 1 AUTOFILL)
                    try {
                        const iernRes = await fetch(api(`/schools_iern/${data.user.school_id}`)).catch(() => null);
                        if (iernRes?.ok) {
                            const iernData = await iernRes.json();
                            if (iernData.exists && iernData.data) {
                                await saveSchoolToCache({ ...iernData.data, school_id: data.user.school_id });
                                console.log("💾 [Login] School Registry cached for offline use.");
                            }
                        }
                    } catch (e) { console.warn("Background school caching failed:", e); }
                }

                // PIN setup check for password logins
                if (loginMode === 'password') {
                    const needsPin = !data.user.passcode;
                    if (needsPin) localStorage.setItem('needs_pin_setup', 'true');
                    else localStorage.removeItem('needs_pin_setup');
                } else {
                    // Passcode login successful: we know they have a passcode.
                    localStorage.removeItem('needs_pin_setup');
                }
            } else {
                throw new Error(data.error || "Login Failed");
            }
        } catch (error) {
            console.error("Login Error:", error);

            if (error.name === 'AbortError') {
                setShowTrafficModal(true);
            } else {
                const friendlyMsg = error.message || "Login Failed. Please check your credentials.";
                alert(friendlyMsg);
            }

            setPassword(''); // Clear field on error
            setLoading(false);
        } finally {
            clearTimeout(loginTimeoutId);
        }
    };




    // --- 5. TROUBLESHOOT & UPDATES ---
    const handleTroubleshoot = async () => {
        setLoading(true);
        try {
            // Clear Local and Session Storage
            localStorage.clear();
            sessionStorage.clear();

            // Unregister Service Workers
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (let registration of registrations) {
                    await registration.unregister();
                }
            }

            // Clear Cache Storage
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                for (let cacheName of cacheNames) {
                    await caches.delete(cacheName);
                }
            }

            alert("Cache cleared. App will now reload to fetch the latest updates.");
            window.location.reload(true);
        } catch (error) {
            console.error("Error clearing cache:", error);
            alert("Errors occurred during cache clear. Reloading...");
            window.location.reload(true);
        }
    };

    // --- 6. RENDER UI ---
    if (loading) {
        return <LoadingScreen />;
    }

    return (
        <PageTransition>
            <div className="min-h-screen w-full flex items-center justify-center p-4 md:p-8 bg-transparent relative overflow-hidden">
                {/* BLUEPRINT BACKGROUND CANVAS */}
                <BlueprintBackground />

                {/* THE 1 SINGLE PANEL CARD FOR LOGO AND LOGIN FIELDS */}
                <div className="relative z-10 w-full max-w-5xl bg-white rounded-[2.5rem] shadow-2xl flex flex-col md:flex-row overflow-hidden border border-white/20">
                                     {/* LEFT PANEL: Logo, Brand & Taglines (Navy theme) */}
                    <div className={`w-full md:w-1/2 bg-[#09203b] text-white p-8 md:p-12 flex flex-col justify-between items-center text-center relative overflow-hidden transition-transform duration-700 ease-in-out ${isRegister ? 'md:translate-x-full' : 'translate-x-0'}`}>
                        {/* Partner logos at the top */}
                        <div className="flex items-center gap-4 mb-8 bg-white/5 px-4 py-2.5 rounded-2xl border border-white/10 backdrop-blur-md">
                            <img src={depedLogo} alt="DepEd" className="h-10 object-contain brightness-110" />
                            <img src={bagongPilipinasLogo} alt="Bagong Pilipinas" className="h-10 object-contain brightness-110" />
                            <img src={hrodLogo} alt="HROD" className="h-10 object-contain brightness-110" />
                        </div>

                        {/* Centered large logo and brand */}
                        <div className="flex-1 flex flex-col items-center justify-center my-6">
                            <div className="w-48 h-32 bg-white rounded-[2rem] shadow-inner flex items-center justify-center p-4 mb-6 border border-white/10">
                                <img src={logo} alt="InsightED Logo" className="w-full h-full object-contain drop-shadow-md" />
                            </div>
                            <h1 className="text-4xl font-extrabold text-white tracking-tight">
                                Insight<span className="text-[#E12B3C]">ED</span>
                            </h1>
                            <p className="text-slate-300 font-bold uppercase tracking-wider text-xs mt-2">School Head Portal</p>
                            <p className="text-slate-400 text-sm mt-4 max-w-sm leading-relaxed">
                                Streamlining school data collection and reporting for real-time evidence-based management and decision-making.
                            </p>
                        </div>

                        {/* Bottom coordinates reference just like in the blueprint */}
                        <div className="text-[10px] text-white/40 font-mono tracking-widest mt-4">
                            COORD // 14.5995° N • 120.9842° E
                        </div>
                    </div>

                    {/* RIGHT PANEL: Login Input Fields (White theme) */}
                    <div className={`w-full md:w-1/2 bg-white text-slate-800 flex flex-col justify-between relative transition-all duration-700 ease-in-out ${isRegister ? 'md:-translate-x-full p-6 md:py-10 md:pl-8 md:pr-20' : 'p-8 md:p-12'}`}>
                        {/* SVG S-curve for Login (bulges right) */}
                        <div className={`absolute left-0 top-0 bottom-0 w-16 pointer-events-none hidden md:block z-10 transition-opacity duration-700 ${isRegister ? 'opacity-0' : 'opacity-100'}`}>
                            <svg className="h-full w-full fill-[#09203b]" viewBox="0 0 100 100" preserveAspectRatio="none">
                                <path d="M0,0 L15,0 C100,25 70,75 0,100 Z" />
                            </svg>
                        </div>
                        {/* SVG S-curve for Register (bulges left) */}
                        <div className={`absolute right-0 top-0 bottom-0 w-16 pointer-events-none hidden md:block z-10 scale-x-[-1] transition-opacity duration-700 ${isRegister ? 'opacity-100' : 'opacity-0'}`}>
                            <svg className="h-full w-full fill-[#09203b]" viewBox="0 0 100 100" preserveAspectRatio="none">
                                <path d="M0,0 L15,0 C100,25 70,75 0,100 Z" />
                            </svg>
                        </div>

                        {!isRegister ? (
                            <>
                                {/* Header for small screens */}
                                <div className="md:hidden text-center mb-6">
                                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Sign In</h2>
                                </div>

                                {/* Form area */}
                                <div className="flex-1 flex flex-col justify-center relative z-20">
                                    {rememberedUser && !usePassword ? (
                                        <PinLogin
                                            rememberedUser={rememberedUser}
                                            onSwitchAccount={handleSwitchAccount}
                                            onUsePassword={() => setUsePassword(true)}
                                        />
                                    ) : (
                                        <form onSubmit={handleLogin} className="space-y-6">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                                                    {isSchoolHead ? "School Identifier" : "DepEd Email"}
                                                </label>
                                                <div className={`relative flex items-center transition-all duration-300 rounded-2xl border-2 bg-slate-50 ${focusedInput === 'loginId' ? 'border-blue-600 ring-4 ring-blue-500/10' : 'border-slate-200 hover:border-slate-300'}`}>
                                                    <span className="pl-4 text-slate-400">
                                                        <svg xmlns="http://www.w3.org/2500/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                                                            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                                                        </svg>
                                                    </span>
                                                    <input
                                                        type="text"
                                                        placeholder={isSchoolHead ? "6-digit School ID" : "username@deped.gov.ph"}
                                                        value={loginId}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            if (isSchoolHead) {
                                                                if (/^\d{0,6}$/.test(val)) {
                                                                    setLoginId(val);
                                                                }
                                                            } else {
                                                                setLoginId(val);
                                                            }
                                                        }}
                                                        onFocus={() => setFocusedInput('loginId')}
                                                        onBlur={() => setFocusedInput(null)}
                                                        required
                                                        className="w-full bg-transparent border-none px-4 py-4 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-0 font-medium"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between mb-1">
                                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                                                        {loginMode === 'passcode' ? "6-Digit Passcode" : "Password"}
                                                    </label>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                            {loginMode === 'passcode' ? 'PASSCODE' : 'PASSWORD'}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setLoginMode(loginMode === 'passcode' ? 'password' : 'passcode')}
                                                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-slate-200 transition-colors duration-200 ease-in-out focus:outline-none ${loginMode === 'passcode' ? 'bg-blue-600' : 'bg-slate-200'}`}
                                                        >
                                                            <span
                                                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${loginMode === 'passcode' ? 'translate-x-4' : 'translate-x-0.5'}`}
                                                            />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className={`relative flex items-center transition-all duration-300 rounded-2xl border-2 bg-slate-50 ${focusedInput === 'password' ? 'border-blue-600 ring-4 ring-blue-500/10' : 'border-slate-200 hover:border-slate-300'}`}>
                                                    <span className="pl-4 text-slate-400">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                                        </svg>
                                                    </span>
                                                    <input
                                                        type={showPassword ? 'text' : 'password'}
                                                        placeholder={loginMode === 'passcode' ? (isSchoolHead ? 'Passcode' : '6-digit Passcode') : 'Enter Password'}
                                                        value={password}
                                                        onChange={(e) => setPassword(e.target.value)}
                                                        onFocus={() => setFocusedInput('password')}
                                                        onBlur={() => setFocusedInput(null)}
                                                        required
                                                        className="w-full bg-transparent border-none px-4 py-4 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-0 font-medium"
                                                    />
                                                    {loginMode === 'passcode' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowDialpadModal(true)}
                                                            className="pr-2 text-slate-400 hover:text-blue-600 transition-colors focus:outline-none"
                                                            title="Open Passcode Dialpad"
                                                            tabIndex={-1}
                                                        >
                                                            <FaCalculator className="h-5 w-5" />
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                        className="pr-4 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                                                        tabIndex={-1}
                                                    >
                                                        {showPassword ? (
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                                <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                                                                <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                                                            </svg>
                                                        ) : (
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                                                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                                            </svg>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>



                                            {loginMode === 'passcode' && (
                                                <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                                    <p className="text-xs text-yellow-850 font-medium leading-relaxed flex items-start gap-2.5">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-yellow-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                        <span className="text-yellow-800">You are using your 6-digit passcode for authentication.</span>
                                                    </p>
                                                </div>
                                            )}

                                            <button
                                                type="submit"
                                                disabled={loading}
                                                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-500/20 transform transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center justify-center gap-2 group uppercase tracking-widest text-xs"
                                            >
                                                <span>Sign In</span>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform transition-transform group-hover:translate-x-1" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                        </form>
                                    )}

                                    <div className="mt-6">
                                        <Link
                                            to="/register"
                                            state={{ pathId: location.state?.pathId }}
                                            className="w-full block text-center py-4 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 font-extrabold rounded-2xl transition-all active:scale-[0.98] uppercase tracking-widest text-xs"
                                        >
                                            Create New Account
                                        </Link>
                                    </div>
                                </div>

                                {/* Bottom troubleshooting and utility buttons row */}
                                <div className="mt-8 pt-6 border-t border-slate-250 flex flex-wrap gap-2.5 justify-center">
                                    {!isInstalled && (
                                        <button
                                            onClick={() => setShowInstallModal(true)}
                                            className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-250 rounded-full text-slate-600 text-[10px] font-bold shadow-sm hover:bg-slate-100 hover:text-slate-800 transition-all active:scale-95"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                            <span>INSTALL APP</span>
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onClick={handleTroubleshoot}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-[#0c2a4e] border border-blue-900/50 rounded-full text-slate-300 text-[10px] font-bold shadow-lg hover:bg-blue-900/40 hover:text-white transition-all active:scale-95"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                                        </svg>
                                        <span>TROUBLESHOOT</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => navigate('/guide/school-head')}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-[#0c2a4e] border border-blue-900/50 rounded-full text-slate-300 text-[10px] font-bold shadow-lg hover:bg-blue-900/40 hover:text-white transition-all active:scale-95"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.168.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                        </svg>
                                        <span>QUICK GUIDE</span>
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col justify-center relative z-20 animate-in fade-in duration-500 max-h-full overflow-hidden auth-register-embedded">
                                <Register isEmbed={true} />
                            </div>
                        )}
                    </div>
                </div>

                {/* FORGOT PASSWORD MODAL (Switch to Passcode Suggestion) */}
                {showForgotModal && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl relative border border-white/20">
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                </div>
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Forgot Password?</h2>
                                <p className="text-slate-500 text-sm mt-3 leading-relaxed">
                                    Don't worry! You can try logging in using your <span className="font-bold text-blue-600">6-digit Passcode</span> instead.
                                    It's faster and more secure.
                                </p>
                            </div>

                            <div className="space-y-3">
                                <button
                                    onClick={() => {
                                        setLoginMode('passcode');
                                        setShowForgotModal(false);
                                    }}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-500/30 transition-all active:scale-[0.98] uppercase tracking-widest text-[10px]"
                                >
                                    Switch to Passcode Login
                                </button>
                                <button
                                    onClick={() => setShowForgotModal(false)}
                                    className="w-full bg-slate-50 hover:bg-slate-100 text-slate-500 font-bold py-4 rounded-2xl transition-all active:scale-[0.98] uppercase tracking-widest text-[10px] border border-slate-100"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* FORGOT PASSCODE MODAL */}
                {showForgotPasscodeModal && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl relative border border-white/20 text-center">
                            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Retrieve Passcode</h2>
                            <p className="text-slate-500 text-sm mt-3 mb-6 leading-relaxed">
                                If you forgot your passcode, please contact your<br />
                                <span className="font-black text-blue-600 text-base uppercase tracking-tight">Division Planning Officers</span><br />
                                to retrieve or reset your passcode.
                            </p>
                            <button
                                onClick={() => setShowForgotPasscodeModal(false)}
                                className="w-full bg-slate-900 hover:bg-black text-white font-black py-4 rounded-2xl transition-all active:scale-[0.98] uppercase tracking-widest text-[10px]"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}

                {/* DIALPAD MODAL */}
                {showDialpadModal && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl relative border border-white/20">
                            <div className="text-center mb-6">
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Enter Passcode</h2>

                                <div className="flex justify-center gap-3 mb-6 mt-4">
                                    {[...Array(6)].map((_, i) => (
                                        <div
                                            key={i}
                                            className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${password.length > i
                                                ? 'bg-blue-600 border-blue-600 scale-110'
                                                : 'bg-slate-200 border-transparent'
                                                }`}
                                        />
                                    ))}
                                </div>
                                <div className="grid grid-cols-3 gap-y-4 gap-x-6 w-full max-w-[260px] mx-auto mb-4">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                        <button
                                            key={num}
                                            type="button"
                                            onClick={() => {
                                                if (password.length < 6) {
                                                    setPassword(password + num);
                                                }
                                            }}
                                            className="w-16 h-16 rounded-full bg-slate-50 hover:bg-slate-200 active:bg-slate-300 active:scale-95 text-2xl font-semibold mx-auto flex items-center justify-center transition-all focus:outline-none text-slate-700 shadow-sm"
                                        >
                                            {num}
                                        </button>
                                    ))}
                                    <div className="col-start-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (password.length < 6) {
                                                    setPassword(password + '0');
                                                }
                                            }}
                                            className="w-16 h-16 rounded-full bg-slate-50 hover:bg-slate-200 active:bg-slate-300 active:scale-95 text-2xl font-semibold mx-auto flex items-center justify-center transition-all focus:outline-none text-slate-700 shadow-sm"
                                        >
                                            0
                                        </button>
                                    </div>
                                    <div className="col-start-3 flex items-center justify-center">
                                        <button
                                            type="button"
                                            onClick={() => setPassword(password.slice(0, -1))}
                                            className="w-16 h-16 rounded-full hover:bg-slate-100 active:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-colors focus:outline-none"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-3 mt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowDialpadModal(false)}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-500/30 transition-all active:scale-[0.98] uppercase tracking-widest text-[10px]"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- INSTALLATION TUTORIAL MODAL (New Approach) --- */}
                {showInstallModal && !isInstalled && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
                        <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative">

                            {/* Modal Header */}
                            <div className="bg-slate-50 p-6 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="font-bold text-slate-800 text-lg">How to Install</h3>
                                <button
                                    onClick={() => setShowInstallModal(false)}
                                    className="p-2 bg-slate-200 rounded-full hover:bg-slate-300 transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-600" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>

                            {/* Modal Body: Platform Specific Instructions */}
                            <div className="p-6">
                                {isIOS ? (
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-4 p-3 bg-blue-50 rounded-xl">
                                            <div className="bg-white p-2 rounded-lg shadow-sm text-blue-600 font-bold shrink-0">1</div>
                                            <p className="text-sm text-slate-600">Tap the <span className="font-bold text-blue-700">Share Icon</span> at the bottom of your screen.</p>
                                        </div>
                                        <div className="flex items-start gap-4 p-3 bg-blue-50 rounded-xl">
                                            <div className="bg-white p-2 rounded-lg shadow-sm text-blue-600 font-bold shrink-0">2</div>
                                            <p className="text-sm text-slate-600">Scroll down and tap <span className="font-bold text-slate-800">"Add to Home Screen"</span>.</p>
                                        </div>
                                        <div className="flex items-start gap-4 p-3 bg-blue-50 rounded-xl">
                                            <div className="bg-white p-2 rounded-lg shadow-sm text-blue-600 font-bold shrink-0">3</div>
                                            <p className="text-sm text-slate-600">Tap <span className="font-bold text-slate-800">Add</span> in the top right corner.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {/* Attempt Auto-Install Button First */}
                                        {deferredPrompt && (
                                            <button
                                                onClick={handleInstallClick}
                                                className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 mb-4 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                                            >
                                                <span>Tap to Install App</span>
                                            </button>
                                        )}

                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center mb-2">Manual Installation</p>

                                        <div className="flex items-start gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <div className="bg-white p-2 rounded-lg shadow-sm text-slate-700 font-bold shrink-0">1</div>
                                            <p className="text-sm text-slate-600">Tap the <span className="font-bold text-slate-900">Three Dots (⋮)</span> icon in the top right browser menu.</p>
                                        </div>
                                        <div className="flex items-start gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <div className="bg-white p-2 rounded-lg shadow-sm text-slate-700 font-bold shrink-0">2</div>
                                            <p className="text-sm text-slate-600">Select <span className="font-bold text-slate-900">"Install App"</span> or <span className="font-bold text-slate-900">"Add to Home Screen"</span>.</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="bg-slate-50 p-4 text-center">
                                <p className="text-xs text-slate-400">Installing ensures InsightEd works offline.</p>
                            </div>
                        </div>
                    </div>
                )}


                {/* BACK TO NEXUS CONFIRMATION MODAL */}
                {showBackPrompt && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-white/20">
                            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-center relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <FiArrowLeft className="w-24 h-24 text-white -rotate-45" />
                                </div>
                                <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-6 backdrop-blur-md border border-white/30 shadow-xl">
                                    <FiArrowLeft className="w-10 h-10 text-white" />
                                </div>
                                <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Return to Nexus?</h2>
                                <p className="text-blue-100 text-sm font-medium leading-relaxed px-4 text-center">You will need to select your login portal again from the Launch Pad.</p>
                            </div>

                            <div className="p-8 space-y-4">
                                <button
                                    onClick={() => navigate('/')}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-500/30 transition-all active:scale-[0.98] flex justify-center items-center gap-3 group uppercase tracking-widest text-[10px]"
                                >
                                    Yes, Return to Nexus
                                    <FiArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                                </button>
                                <button
                                    onClick={() => setShowBackPrompt(false)}
                                    className="w-full bg-slate-50 hover:bg-slate-100 text-slate-500 font-bold py-5 rounded-2xl transition-all active:scale-[0.98] uppercase tracking-widest text-[10px] border border-slate-100"
                                >
                                    Stay on Login
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {/* LONG QUEUE MODAL */}

                {showTrafficModal && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20">
                            <div className="p-8 text-center bg-white">
                                <div className="w-full max-w-[200px] mx-auto mb-6">
                                    <img
                                        src={trafficErrorImg}
                                        alt="Long Queue"
                                        className="w-full h-auto"
                                    />
                                </div>
                                <h2 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">Long Queue Detected</h2>
                                <p className="text-slate-500 text-sm font-medium leading-relaxed px-4">
                                    We're currently experiencing a long queue of users. To ensure a smooth experience for everyone, please wait a moment or come back later.
                                </p>
                            </div>

                            <div className="p-8 pt-0 space-y-3">
                                <button
                                    onClick={() => {
                                        setShowTrafficModal(false);
                                        setPassword('');
                                    }}
                                    className="w-full bg-slate-900 hover:bg-black text-white font-black py-5 rounded-2xl shadow-xl shadow-slate-900/20 transition-all active:scale-[0.98] uppercase tracking-widest text-[10px]"
                                >
                                    Understood
                                </button>
                                <button
                                    onClick={() => {
                                        setShowTrafficModal(false);
                                    }}
                                    className="w-full bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold py-4 rounded-2xl transition-all active:scale-[0.98] uppercase tracking-widest text-[10px] border border-blue-100"
                                >
                                    Try Again
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </PageTransition>
    );
};

export default Login;