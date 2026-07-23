import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX } from 'react-icons/fi';

const ActionModal = ({ isOpen, onClose, title, subtitle, icon: Icon, children, maxWidth = 'max-w-4xl' }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-900/80 backdrop-blur-md"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className={`bg-white dark:bg-slate-800 w-full ${maxWidth} rounded-[2.5rem] shadow-[0_32px_128px_-12px_rgba(0,0,0,0.5)] relative z-20 overflow-hidden border border-white/10 my-auto`}
                    >
                        <div className="absolute top-0 right-0 p-6 z-30">
                            <motion.button
                                whileHover={{ rotate: 90, scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={onClose}
                                className="p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                            >
                                <FiX size={18} />
                            </motion.button>
                        </div>

                        <div className="p-6 sm:p-10">
                            <div className="flex items-center gap-5 mb-8">
                                <div className="p-4 bg-[#004A99]/10 text-[#004A99] dark:bg-blue-400/10 dark:text-blue-400 rounded-[1.4rem]">
                                    <Icon size={24} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight leading-none mb-1">
                                        {title}
                                    </h2>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{subtitle}</p>
                                </div>
                            </div>
                            
                            <div className="max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                                {children}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ActionModal;
