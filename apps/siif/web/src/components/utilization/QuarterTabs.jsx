import React from 'react';
import { motion } from 'framer-motion';
import { TbLock } from 'react-icons/tb';
import { formatPeso, QUARTER_SHORT } from './utilizationUi';

const QuarterTabs = ({ periods, activeQuarter, viewingQuarter, onSelect, quarterStats, lockedPeriods = [] }) => (
    <div
        role="tablist"
        aria-label="Quarter"
        className="mb-6 grid grid-cols-3 gap-1 rounded-2xl bg-slate-200/60 p-1.5 shadow-inner dark:bg-slate-800/70"
    >
        {periods.map(p => {
            const isCurrent = p.id === activeQuarter;
            const isSelected = p.id === viewingQuarter;
            const isLocked = lockedPeriods.includes(p.id);
            const stats = quarterStats[p.id] || { amount: 0, recorded: 0, total: 0 };

            return (
                <button
                    key={p.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    title={isLocked ? 'Locked. Entries can be viewed but not changed.' : undefined}
                    onClick={() => onSelect(p.id)}
                    className="relative cursor-pointer rounded-xl border-0 bg-transparent px-1.5 py-2.5 sm:px-3 sm:py-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                    {isSelected && (
                        <motion.span
                            layoutId="siif-quarter-pill"
                            className="absolute inset-0 rounded-xl bg-white shadow-md dark:bg-slate-900"
                            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                        />
                    )}
                    <span className={`relative z-10 flex flex-col items-center gap-0.5 ${isLocked && !isSelected ? 'opacity-60' : ''}`}>
                        <span className={`flex items-center gap-1.5 text-[10px] sm:text-xs font-black uppercase tracking-wider ${
                            isSelected ? 'text-[#0038A8] dark:text-sky-300' : 'text-slate-500 dark:text-slate-400'
                        }`}>
                            {isLocked && <TbLock size={12} className="shrink-0" aria-label="Locked" />}
                            {isCurrent && !isLocked && (
                                <span className="relative flex h-2 w-2" title="Current quarter">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                                </span>
                            )}
                            <span className="sm:hidden">{QUARTER_SHORT[p.id] || p.label}</span>
                            <span className="hidden sm:inline">{p.label}</span>
                        </span>
                        <span className={`text-xs sm:text-sm font-extrabold tabular-nums ${
                            isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'
                        }`}>
                            {formatPeso(stats.amount, { decimals: 0 })}
                        </span>
                        <span className="text-[9px] sm:text-[10px] font-bold text-slate-400">
                            {isLocked ? (
                                <span className="text-slate-500 dark:text-slate-400">Locked</span>
                            ) : (
                                <>
                                    {stats.recorded}/{stats.total} recorded
                                    {isCurrent && <span className="hidden md:inline text-emerald-600 dark:text-emerald-400"> · Current</span>}
                                </>
                            )}
                        </span>
                    </span>
                </button>
            );
        })}
    </div>
);

export default QuarterTabs;
