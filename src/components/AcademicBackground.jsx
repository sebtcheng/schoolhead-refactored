import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const AcademicBackground = () => {
    // Generate some random coordinates and velocities for floating academic elements
    const [floatingElements, setFloatingElements] = useState([]);

    useEffect(() => {
        const elements = [
            { id: 1, type: 'laptop', x: 15, y: 30, scale: 0.8, rotate: 15, duration: 25 },
            { id: 2, type: 'pencil', x: 75, y: 15, scale: 0.9, rotate: -25, duration: 18 },
            { id: 3, type: 'ruler', x: 80, y: 70, scale: 0.85, rotate: 45, duration: 22 },
            { id: 4, type: 'book', x: 20, y: 75, scale: 0.9, rotate: -12, duration: 28 },
            { id: 5, type: 'calculator', x: 85, y: 40, scale: 0.75, rotate: 18, duration: 20 },
            { id: 6, type: 'notebook', x: 10, y: 55, scale: 0.8, rotate: -8, duration: 24 }
        ];
        setFloatingElements(elements);
    }, []);

    // SVG Icon Definitions
    const renderIcon = (type) => {
        switch (type) {
            case 'laptop':
                return (
                    <svg viewBox="0 0 24 24" className="w-14 h-14 text-blue-600/15" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="4" width="18" height="12" rx="2" />
                        <path d="M2 20h20a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v1a1 1 0 0 0 1 1z" />
                        <line x1="12" y1="12" x2="12" y2="12" strokeLinecap="round" strokeWidth="2" />
                    </svg>
                );
            case 'pencil':
                return (
                    <svg viewBox="0 0 24 24" className="w-10 h-10 text-indigo-600/15" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                    </svg>
                );
            case 'ruler':
                return (
                    <svg viewBox="0 0 24 24" className="w-12 h-12 text-blue-500/15" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="5" y="2" width="14" height="20" rx="2" transform="rotate(45 12 12)" />
                        <line x1="8" y1="7" x2="11" y2="7" />
                        <line x1="9" y1="10" x2="12" y2="10" />
                        <line x1="10" y1="13" x2="13" y2="13" />
                        <line x1="11" y1="16" x2="14" y2="16" />
                    </svg>
                );
            case 'book':
                return (
                    <svg viewBox="0 0 24 24" className="w-12 h-12 text-indigo-500/15" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    </svg>
                );
            case 'calculator':
                return (
                    <svg viewBox="0 0 24 24" className="w-11 h-11 text-blue-600/15" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="4" y="2" width="16" height="20" rx="2" />
                        <line x1="8" y1="6" x2="16" y2="6" />
                        <line x1="8" y1="10" x2="16" y2="10" />
                        <circle cx="8" cy="14" r="1" />
                        <circle cx="12" cy="14" r="1" />
                        <circle cx="16" cy="14" r="1" />
                        <circle cx="8" cy="18" r="1" />
                        <circle cx="12" cy="18" r="1" />
                        <circle cx="16" cy="18" r="1" />
                    </svg>
                );
            case 'notebook':
                return (
                    <svg viewBox="0 0 24 24" className="w-12 h-12 text-indigo-600/15" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M16 2v20M8 2v20M2 6h20M2 12h20M2 18h20" />
                    </svg>
                );
            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 w-full h-full overflow-hidden bg-[#f4f7fa] pointer-events-none z-0">
            
            {/* Corner Wave - Top Left */}
            <div className="absolute -top-12 -left-16 w-[450px] h-[380px] opacity-90">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                    {/* Darkest Wave */}
                    <path d="M0,0 L90,0 Q65,40 30,70 Q5,85 0,80 Z" fill="#083a74" />
                    {/* Mid Blue Wave */}
                    <path d="M0,0 L80,0 Q55,30 25,60 Q5,72 0,65 Z" fill="#1b5a9e" />
                    {/* Light Blue Wave */}
                    <path d="M0,0 L65,0 Q45,25 20,48 Q5,58 0,52 Z" fill="#4d8fcb" />
                </svg>
            </div>

            {/* Corner Wave - Bottom Right */}
            <div className="absolute -bottom-16 -right-16 w-[480px] h-[380px] opacity-90">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                    {/* Darkest Wave */}
                    <path d="M100,100 L100,10 Q70,40 35,68 Q10,88 15,100 Z" fill="#083a74" />
                    {/* Mid Blue Wave */}
                    <path d="M100,100 L100,25 Q75,50 45,75 Q20,92 25,100 Z" fill="#1b5a9e" />
                    {/* Light Blue Wave */}
                    <path d="M100,100 L100,42 Q82,62 58,82 Q35,95 40,100 Z" fill="#4d8fcb" />
                </svg>
            </div>

            {/* Geometric Details - Dots, Crosses, and Pills */}
            
            {/* Top Left Details */}
            <div className="absolute top-20 left-[350px] flex gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500/30" />
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500/20" />
            </div>
            
            {/* Cross marks */}
            <div className="absolute bottom-24 left-16 text-blue-900/35 font-mono text-xl font-bold flex gap-4">
                <span>✕</span>
                <span>✕</span>
            </div>

            {/* Circular arc and dot */}
            <div className="absolute bottom-16 left-32 w-16 h-16 border-2 border-blue-900/15 border-t-transparent rounded-full flex items-center justify-center">
                <span className="w-4 h-4 rounded-full bg-blue-900/30" />
            </div>

            {/* Floating Pills */}
            <div className="absolute top-10 right-96 w-14 h-32 border-2 border-blue-900/15 rounded-full" />
            <div className="absolute bottom-10 right-[350px] w-14 h-32 border-2 border-blue-900/15 rounded-full" />
            <div className="absolute top-36 right-16 w-32 h-10 border-2 border-blue-900/15 rounded-full" />

            {/* Grid dot arrays */}
            <div className="absolute top-20 right-28 grid grid-cols-8 gap-x-3 gap-y-2 opacity-35">
                {[...Array(16)].map((_, i) => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-blue-900" />
                ))}
            </div>
            <div className="absolute bottom-20 left-16 grid grid-cols-3 gap-x-4 gap-y-2 opacity-35">
                {[...Array(6)].map((_, i) => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-blue-900" />
                ))}
            </div>

            {/* Custom static academic vectors */}
            {floatingElements.map((el) => (
                <div
                    key={el.id}
                    className="absolute"
                    style={{
                        left: `${el.x}%`,
                        top: `${el.y}%`,
                        transform: `scale(${el.scale}) rotate(${el.rotate}deg)`,
                        transformOrigin: 'center center'
                    }}
                >
                    {renderIcon(el.type)}
                </div>
            ))}

        </div>
    );
};

export default AcademicBackground;
