import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiDownload, FiChevronLeft, FiChevronRight, FiMaximize2, FiMinimize2 } from 'react-icons/fi';
import { resolveAssetUrl } from '../utils/assetHelper';

const HydraDocViewer = ({ manifest, fileName, onClose, onDownload }) => {
    const [currentPage, setCurrentPage] = useState(0);
    const [isMaximized, setIsMaximized] = useState(false);
    const [loadedPages, setLoadedPages] = useState({});

    // Preload next page
    useEffect(() => {
        if (currentPage < manifest.length - 1) {
            const nextPage = manifest[currentPage + 1];
            const img = new Image();
            img.src = resolveAssetUrl(`api/asset/${nextPage.binary_id}`);
        }
    }, [currentPage, manifest]);

    const handlePageChange = (direction) => {
        if (direction === 'next' && currentPage < manifest.length - 1) {
            setCurrentPage(prev => prev + 1);
        } else if (direction === 'prev' && currentPage > 0) {
            setCurrentPage(prev => prev - 1);
        }
    };

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center p-4 md:p-8"
        >
            {/* Header */}
            <div className="w-full max-w-5xl flex items-center justify-between mb-4 text-white">
                <div className="flex flex-col">
                    <h3 className="text-lg font-bold tracking-tight truncate max-w-[200px] md:max-w-md">{fileName}</h3>
                    <p className="text-[10px] uppercase tracking-widest text-blue-400 font-black">Hydra Optimized | Page {currentPage + 1} of {manifest.length}</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={onDownload} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors" title="Download Full PDF">
                        <FiDownload size={20} />
                    </button>
                    <button onClick={() => setIsMaximized(!isMaximized)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
                        {isMaximized ? <FiMinimize2 size={20} /> : <FiMaximize2 size={20} />}
                    </button>
                    <button onClick={onClose} className="p-2 bg-red-500/20 hover:bg-red-500/40 text-red-500 rounded-full transition-colors">
                        <FiX size={20} />
                    </button>
                </div>
            </div>

            {/* Viewer Area */}
            <div className={`relative flex items-center justify-center w-full max-w-5xl ${isMaximized ? 'h-full' : 'h-[75vh]'} bg-black/40 rounded-[2rem] overflow-hidden shadow-2xl border border-white/5`}>
                <AnimatePresence mode="wait">
                    <motion.img
                        key={currentPage}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        src={resolveAssetUrl(`api/asset/${manifest[currentPage].binary_id}`)}
                        className="max-h-full max-w-full object-contain shadow-2xl"
                        alt={`Page ${currentPage + 1}`}
                        onLoad={() => setLoadedPages(prev => ({ ...prev, [currentPage]: true }))}
                    />
                </AnimatePresence>

                {/* Navigation Overlay */}
                <div className="absolute inset-x-0 bottom-8 flex items-center justify-center gap-6 pointer-events-none">
                    <button 
                        onClick={() => handlePageChange('prev')}
                        disabled={currentPage === 0}
                        className={`pointer-events-auto w-12 h-12 rounded-full flex items-center justify-center bg-white/10 backdrop-blur-md text-white transition-all ${currentPage === 0 ? 'opacity-20 cursor-not-allowed' : 'hover:bg-white/30 hover:scale-110 active:scale-95'}`}
                    >
                        <FiChevronLeft size={24} />
                    </button>
                    
                    <div className="px-6 py-2 bg-white/10 backdrop-blur-md rounded-full text-white text-xs font-black tracking-widest border border-white/5">
                        {currentPage + 1} / {manifest.length}
                    </div>

                    <button 
                        onClick={() => handlePageChange('next')}
                        disabled={currentPage === manifest.length - 1}
                        className={`pointer-events-auto w-12 h-12 rounded-full flex items-center justify-center bg-white/10 backdrop-blur-md text-white transition-all ${currentPage === manifest.length - 1 ? 'opacity-20 cursor-not-allowed' : 'hover:bg-white/30 hover:scale-110 active:scale-95'}`}
                    >
                        <FiChevronRight size={24} />
                    </button>
                </div>
            </div>

            {/* Thumbnails (Optional/Mobile Scroll) */}
            <div className="mt-6 flex gap-2 overflow-x-auto max-w-full pb-2 scrollbar-hide no-scrollbar">
                {manifest.map((page, idx) => (
                    <button
                        key={idx}
                        onClick={() => setCurrentPage(idx)}
                        className={`flex-shrink-0 w-12 h-16 rounded-lg border-2 transition-all overflow-hidden ${currentPage === idx ? 'border-blue-500 scale-105 shadow-lg shadow-blue-500/20' : 'border-transparent opacity-40 hover:opacity-100'}`}
                    >
                        <img src={resolveAssetUrl(`api/asset/${page.binary_id}`)} className="w-full h-full object-cover" alt="" />
                    </button>
                ))}
            </div>
        </motion.div>
    );
};

export default HydraDocViewer;
