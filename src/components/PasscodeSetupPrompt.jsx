import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiShield, FiLock, FiCheckCircle, FiArrowLeft, FiX } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

const PasscodeSetupPrompt = () => {
    const { user, setUser, isPasscodeSetupOpen, setIsPasscodeSetupOpen } = useAuth();
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState('prompt'); // 'prompt' | 'setup' | 'confirm' | 'success'
    const [tempPasscode, setTempPasscode] = useState('');
    const [confirmPasscode, setConfirmPasscode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Public paths where the prompt should NOT appear automatically
        const publicPaths = ['/', '/login', '/register', '/adminlogin', '/chat', '/guide/school-head'];
        const isPublicPath = publicPaths.includes(location.pathname);

        // Check if user is logged in but has no passcode
        let needsSetup = (user && !user.passcode && localStorage.getItem('needs_pin_setup') === 'true') || isPasscodeSetupOpen;
        
        // Block auto-trigger on public paths
        if (isPublicPath && !isPasscodeSetupOpen) {
            needsSetup = false;
        }

        if (user && user.passcode && !isPasscodeSetupOpen) {
            localStorage.removeItem('needs_pin_setup');
        }

        if (needsSetup) {
            // If it's a manual trigger (isPasscodeSetupOpen), we might want to skip the 'prompt' step
            // or just start from the beginning.
            setStep(isPasscodeSetupOpen ? 'setup' : 'prompt');
            setTempPasscode('');
            setConfirmPasscode('');
            setError('');
            
            if (isPasscodeSetupOpen) {
                setIsOpen(true);
            } else {
                // Slight delay to ensure other welcome modals (like Nexus) don't overlap immediately
                const timer = setTimeout(() => {
                    setIsOpen(true);
                }, 800);
                return () => clearTimeout(timer);
            }
        } else {
            setIsOpen(false);
        }
    }, [user, isPasscodeSetupOpen, location.pathname]);

    const handleKeyPress = (num) => {
        setError('');
        const current = step === 'setup' ? tempPasscode : confirmPasscode;
        if (current.length < 6) {
            if (step === 'setup') setTempPasscode(prev => prev + num);
            else setConfirmPasscode(prev => prev + num);
        }
    };

    const handleDelete = () => {
        setError('');
        if (step === 'setup') setTempPasscode(prev => prev.slice(0, -1));
        else setConfirmPasscode(prev => prev.slice(0, -1));
    };

    const handleNext = () => {
        if (tempPasscode.length === 6) {
            setStep('confirm');
        } else {
            setError('Please enter a 6-digit passcode');
        }
    };

    const handleFinalize = async () => {
        if (confirmPasscode.length !== 6) {
            setError('Please re-enter your 6-digit passcode');
            return;
        }
        if (tempPasscode !== confirmPasscode) {
            setError('Passcodes do not match. Try again.');
            setTempPasscode('');
            setConfirmPasscode('');
            setStep('setup');
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/auth/setup-passcode', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ passcode: tempPasscode })
            });

            if (res.ok) {
                // Update local user state
                setUser(prev => ({ ...prev, passcode: tempPasscode }));
                // Reset everything
                localStorage.removeItem('needs_pin_setup');
                setIsPasscodeSetupOpen(false);
                setTempPasscode('');
                setConfirmPasscode('');
                setError('');
                setStep('success');
                setTimeout(() => {
                    setIsOpen(false);
                }, 2500);
            } else {
                const data = await res.json();
                setError(data.error || 'Failed to save passcode');
                setTempPasscode('');
                setConfirmPasscode('');
                setStep('setup');
            }
        } catch (err) {
            console.error("Passcode setup error:", err);
            setError('Connection error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const modalVariants = {
        hidden: { opacity: 0, scale: 0.9, y: 20 },
        visible: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.9, y: 20 }
    };

    const stepVariants = {
        initial: { x: 50, opacity: 0 },
        enter: { x: 0, opacity: 1 },
        exit: { x: -50, opacity: 0 }
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden relative"
            >
                {/* Decorative Blobs */}
                <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-blue-100 rounded-full blur-3xl opacity-60"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-40 h-40 bg-indigo-50 rounded-full blur-3xl opacity-60"></div>

                <div className="relative z-10">
                    <AnimatePresence mode="wait">
                        {step === 'prompt' && (
                            <motion.div 
                                key="prompt"
                                variants={stepVariants}
                                initial="initial"
                                animate="enter"
                                exit="exit"
                                className="p-8 text-center"
                            >
                                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-white shadow-xl shadow-blue-200">
                                    <FiShield size={40} className="animate-pulse" />
                                </div>
                                <h2 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">Secure Your Account</h2>
                                <p className="text-slate-500 text-sm mb-8 leading-relaxed font-medium">
                                    Final step to protect your data. Setup a 6-digit passcode to enable secure features and account protection.
                                </p>
                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={() => setStep('setup')}
                                        className="w-full bg-[#004A99] hover:bg-blue-800 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-900/20 transition-all active:scale-[0.98] group flex items-center justify-center gap-2"
                                    >
                                        Protect My Account
                                        <span className="group-hover:translate-x-1 transition-transform">→</span>
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {(step === 'setup' || step === 'confirm') && (
                            <motion.div 
                                key={step}
                                variants={stepVariants}
                                initial="initial"
                                animate="enter"
                                exit="exit"
                                className="p-8"
                            >
                                <div className="text-center mb-8">
                                    <h2 className="text-xl font-black text-slate-800 mb-1 tracking-tight">
                                        {step === 'setup' ? 'Create Passcode' : 'Confirm Passcode'}
                                    </h2>
                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                                        {step === 'setup' ? 'Choose 6 Digits' : 'One more time'}
                                    </p>
                                </div>

                                <div className="flex justify-center gap-3 mb-8">
                                    {[...Array(6)].map((_, i) => (
                                        <div 
                                            key={i} 
                                            className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-300 ${
                                                (step === 'setup' ? tempPasscode : confirmPasscode).length > i 
                                                    ? 'bg-[#004A99] border-[#004A99] scale-125 shadow-sm' 
                                                    : 'bg-transparent border-slate-200'
                                            }`}
                                        />
                                    ))}
                                </div>

                                <div className="h-6 mb-4 text-center">
                                    {error ? (
                                        <p className="text-red-500 text-xs font-black animate-shake">{error}</p>
                                    ) : (
                                        <div className="flex items-center justify-center gap-1 text-slate-300">
                                            <FiLock size={10} />
                                            <span className="text-[10px] font-bold uppercase tracking-widest">End-to-End Encrypted</span>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-3 gap-y-4 gap-x-3 mb-10">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                        <button
                                            key={num}
                                            type="button"
                                            onClick={() => handleKeyPress(num.toString())}
                                            className="w-14 h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-xl font-black mx-auto flex items-center justify-center transition-all focus:outline-none text-slate-700 hover:scale-105"
                                        >
                                            {num}
                                        </button>
                                    ))}
                                    <div />
                                    <button
                                        type="button"
                                        onClick={() => handleKeyPress('0')}
                                        className="w-14 h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-xl font-black mx-auto flex items-center justify-center transition-all focus:outline-none text-slate-700 hover:scale-105"
                                    >
                                        0
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDelete}
                                        className="w-14 h-14 rounded-2xl text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors focus:outline-none hover:bg-slate-50"
                                    >
                                        <FiX size={20} />
                                    </button>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={step === 'setup' ? handleNext : handleFinalize}
                                        disabled={loading || (step === 'setup' ? tempPasscode : confirmPasscode).length !== 6}
                                        className="w-full bg-[#004A99] text-white rounded-2xl py-4 font-bold shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {loading ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            step === 'setup' ? 'Next →' : 'Complete Setup'
                                        )}
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (step === 'confirm') setStep('setup');
                                            else setStep('prompt');
                                            setTempPasscode('');
                                            setConfirmPasscode('');
                                            setError('');
                                        }}
                                        className="w-full text-slate-400 py-2 hover:text-slate-600 text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1"
                                    >
                                        <FiArrowLeft size={12} /> Back
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {step === 'success' && (
                            <motion.div 
                                key="success"
                                variants={stepVariants}
                                initial="initial"
                                animate="enter"
                                exit="exit"
                                className="p-10 text-center"
                            >
                                <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 text-white shadow-xl shadow-green-100 scale-110">
                                    <FiCheckCircle size={50} />
                                </div>
                                <h2 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">Setup Complete</h2>
                                <p className="text-emerald-600 text-[10px] font-black uppercase tracking-[0.2em] mb-4">Account Secured</p>
                                <p className="text-slate-500 text-sm leading-relaxed font-black">
                                    Your passcode is active.
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
};

export default PasscodeSetupPrompt;
