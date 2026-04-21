import React from 'react';
import { FiXCircle, FiAlertCircle } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

const FailureModal = ({ isOpen, onClose, title = "Submission Failed", message = "There was an error processing your request. Please try again." }) => {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 bg-slate-900/60 z-[1000] flex items-center justify-center p-6 backdrop-blur-sm">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm shadow-[0_32px_128px_-12px_rgba(0,0,0,0.4)] transform text-center relative overflow-hidden border border-slate-100"
                >
                    {/* Decorative Background Blob */}
                    <div className="absolute top-[-50px] right-[-50px] w-32 h-32 bg-rose-50 rounded-full blur-3xl opacity-60"></div>
                    
                    <div className="relative z-10">
                        <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-rose-500 shadow-sm border border-rose-100">
                            <FiAlertCircle size={40} className="animate-pulse" />
                        </div>

                        <h3 className="text-2xl font-black text-slate-800 tracking-tighter uppercase italic mb-2">{title}</h3>
                        <p className="text-[11px] font-bold text-slate-500 uppercase leading-relaxed mb-8 italic">
                            {message}
                        </p>

                        <button
                            onClick={onClose}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-2xl shadow-xl shadow-slate-900/20 transition-all active:scale-[0.98] uppercase tracking-widest text-[10px] italic"
                        >
                            Try again
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default FailureModal;
