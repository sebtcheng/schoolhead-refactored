import React from 'react';
import { motion } from 'framer-motion';
import insightedLogoCollapsed from '../../../../school-head/web/src/assets/insightedlogo2.png';

const SiifLoader = ({ text = "Loading..." }) => {
    return (
        <div className="flex items-center justify-center flex-col gap-6 min-h-screen bg-slate-50">
            <motion.div
                animate={{ 
                    scale: [1, 1.15, 1],
                    opacity: [0.7, 1, 0.7]
                }}
                transition={{ 
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
                className="relative flex items-center justify-center"
            >
                <div className="absolute inset-0 bg-blue-100 rounded-full blur-xl scale-150 opacity-50 animate-pulse" />
                <img 
                    src={insightedLogoCollapsed} 
                    alt="Loading..." 
                    className="w-20 h-20 object-contain relative z-10 drop-shadow-2xl" 
                />
            </motion.div>
            <p className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] animate-pulse">
                {text}
            </p>
        </div>
    );
};

export default SiifLoader;
