import React, { useEffect } from 'react';
import { useServiceWorker } from '../context/ServiceWorkerContext';
import { FiRefreshCw, FiArrowUpCircle } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

const ForceUpdateModal = () => {
    const { isUpdateAvailable, updateApp } = useServiceWorker();

    // Prevent scrolling when update is available
    useEffect(() => {
        if (isUpdateAvailable) {
            document.body.style.overflow = 'hidden';
            // Force scroll to top to ensure modal is center of viewport if they were scrolled down
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isUpdateAvailable]);

    return (
        <AnimatePresence>
            {isUpdateAvailable && (
                <div 
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xl touch-none"
                    onWheel={(e) => e.preventDefault()}
                    onTouchMove={(e) => e.preventDefault()}
                >
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl relative overflow-hidden border border-blue-100 dark:border-blue-900/30 text-center"
                    >
                        {/* Decorative Background Elements */}
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
                        <div className="absolute -top-12 -right-12 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl"></div>
                        <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-indigo-500/5 rounded-full blur-3xl"></div>

                        {/* Icon Container */}
                        <div className="relative mb-6">
                            <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-3xl flex items-center justify-center mx-auto text-[#004A99] dark:text-blue-400 rotate-12 group">
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                                >
                                    <FiRefreshCw size={40} />
                                </motion.div>
                            </div>
                            <div className="absolute top-0 right-1/4 translate-x-1/2 -translate-y-1/2">
                                <div className="bg-emerald-500 text-white p-1.5 rounded-full shadow-lg border-2 border-white dark:border-slate-800">
                                    <FiArrowUpCircle size={16} />
                                </div>
                            </div>
                        </div>

                        {/* Text Content */}
                        <div className="space-y-3 mb-8">
                            <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                                Update Required
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed px-2">
                                A newer, faster version of <span className="font-bold text-[#004A99] dark:text-blue-400">InsightEd</span> is ready. Please update now to continue using the application with the latest features and security fixes.
                            </p>
                        </div>

                        {/* Action Button */}
                        <button
                            onClick={() => updateApp()}
                            className="w-full py-4 bg-[#004A99] hover:bg-blue-800 text-white font-bold rounded-2xl shadow-xl shadow-blue-900/20 hover:shadow-2xl hover:scale-[1.02] flex items-center justify-center gap-3 transition-all active:scale-95 group"
                        >
                            <span className="tracking-wide text-base">Update & Restart</span>
                            <FiRefreshCw className="group-hover:rotate-180 transition-transform duration-500" />
                        </button>

                        <p className="mt-4 text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-widest">
                            Estimated time: &lt; 5 seconds
                        </p>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ForceUpdateModal;
