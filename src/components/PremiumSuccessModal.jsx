import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCheck, FiArrowRight, FiShield, FiZap } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

const PremiumSuccessModal = ({ 
    isOpen, 
    onClose, 
    title = "Submission Successful", 
    message = "Your data has been securely transmitted to the national registry.", 
    redirectUrl = "/nodes-dashboard",
    autoRedirectTime = 5000 
}) => {
    const navigate = useNavigate();
    const [countdown, setCountdown] = React.useState(Math.ceil(autoRedirectTime / 1000));

    useEffect(() => {
        if (isOpen) {
            setCountdown(Math.ceil(autoRedirectTime / 1000));
            const timer = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        navigate(redirectUrl);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [isOpen, navigate, redirectUrl, autoRedirectTime]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
                    {/* Backdrop */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
                    />

                    {/* Modal Content */}
                    <motion.div 
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="relative bg-white rounded-[3rem] shadow-2xl shadow-blue-500/20 w-full max-w-md overflow-hidden"
                    >
                        {/* Top Decorative Banner */}
                        <div className="h-32 bg-gradient-to-br from-blue-600 to-indigo-700 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-400/20 rounded-full -ml-12 -mb-12 blur-xl" />
                            
                            <div className="absolute inset-0 flex items-center justify-center">
                                <motion.div 
                                    initial={{ scale: 0, rotate: -45 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    transition={{ type: "spring", damping: 12, delay: 0.2 }}
                                    className="w-20 h-20 bg-white rounded-[2rem] shadow-xl flex items-center justify-center text-blue-600"
                                >
                                    <FiCheck size={40} strokeWidth={3} />
                                </motion.div>
                            </div>
                        </div>

                        <div className="p-10 pt-12 text-center space-y-6">
                            <div className="space-y-2">
                                <h3 className="text-3xl font-black text-slate-800 tracking-tighter uppercase italic">
                                    {title}
                                </h3>
                                <p className="text-sm font-bold text-slate-500 leading-relaxed max-w-[280px] mx-auto uppercase tracking-tight">
                                    {message}
                                </p>
                            </div>

                            <div className="flex items-center justify-center gap-4 py-4 border-y border-slate-50">
                                <div className="flex flex-col items-center gap-1">
                                    <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                                        <FiShield />
                                    </div>
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Secured</span>
                                </div>
                                <div className="w-px h-8 bg-slate-100" />
                                <div className="flex flex-col items-center gap-1">
                                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                                        <FiZap />
                                    </div>
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Instant</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => navigate(redirectUrl)}
                                    className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl shadow-xl shadow-slate-900/20 flex items-center justify-center gap-3 group transition-all"
                                >
                                    <span className="uppercase tracking-widest italic">Return to Nexus</span>
                                    <FiArrowRight className="group-hover:translate-x-1 transition-transform" />
                                </motion.button>

                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] animate-pulse italic">
                                    Auto-redirecting in {countdown}s
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default PremiumSuccessModal;
