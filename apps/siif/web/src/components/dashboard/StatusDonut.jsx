import React from 'react';
import { TbChartDonut } from 'react-icons/tb';
import { STATUS_KEYS, STATUS_COLORS } from './dashboardData';
import { DashCard } from './DashboardParts';

const RING_R = 15.9155; // circumference = 100, so dash lengths are percentages
const LABEL_RADIUS_PCT = 33;

/** Interventions by implementation status (same ring as the RO/SDO dashboard). */
const StatusDonut = ({ counts, scopeLabel }) => {
    const total = STATUS_KEYS.reduce((sum, k) => sum + counts[k], 0);
    const pctOf = (key) => (total > 0 ? (counts[key] / total) * 100 : 0);
    const segments = STATUS_KEYS.map((key, i) => ({
        key,
        count: counts[key],
        pct: pctOf(key),
        start: STATUS_KEYS.slice(0, i).reduce((sum, k) => sum + pctOf(k), 0),
        color: STATUS_COLORS[key],
    }));

    return (
        <DashCard icon={<TbChartDonut />} title="Implementation Status" subtitle={`Interventions by status · ${scopeLabel}`} className="h-full">
            <div className="my-auto flex flex-col items-center gap-5 py-2">
                <div className="relative flex h-44 w-44 shrink-0 items-center justify-center p-2">
                    <svg viewBox="-4 -4 44 44" className="h-full w-full -rotate-90 overflow-visible" role="img" aria-label={segments.map(s => `${s.key}: ${s.count}`).join(', ')}>
                        <circle cx="18" cy="18" r={RING_R} fill="none" strokeWidth="4.5" className="stroke-slate-200 dark:stroke-slate-700" />
                        {segments.filter(s => s.pct > 0).map(s => (
                            <circle
                                key={s.key}
                                cx="18" cy="18" r={RING_R} fill="none" stroke={s.color} strokeWidth="5.5"
                                strokeDasharray={`${s.pct} 100`}
                                strokeDashoffset={-s.start}
                                className="transition-all duration-500"
                            />
                        ))}
                    </svg>

                    {/* Count badge at the middle of each slice */}
                    {segments.filter(s => s.count > 0).map(s => {
                        const angle = ((s.start + s.pct / 2) / 100) * 2 * Math.PI;
                        return (
                            <span
                                key={s.key}
                                className="absolute flex h-[22px] min-w-[22px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full px-1 text-[10px] font-black tabular-nums text-white shadow-sm ring-2 ring-white dark:ring-slate-900"
                                style={{
                                    left: `${50 + LABEL_RADIUS_PCT * Math.sin(angle)}%`,
                                    top: `${50 - LABEL_RADIUS_PCT * Math.cos(angle)}%`,
                                    background: s.color,
                                }}
                                title={`${s.key}: ${s.count} (${s.pct.toFixed(1)}%)`}
                            >
                                {s.count}
                            </span>
                        );
                    })}

                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Interventions</span>
                        <span className="mt-0.5 text-2xl font-black leading-none text-[#08315F] dark:text-white">{total}</span>
                    </div>
                </div>

                <div className="w-full space-y-2 text-xs">
                    {segments.map(s => (
                        <div key={s.key} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-2.5 dark:border-slate-700/60 dark:bg-slate-800/40">
                            <span className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                                {s.key}
                            </span>
                            <span className="font-mono font-bold tabular-nums text-slate-700 dark:text-slate-200">
                                {s.count} <span className="text-slate-400">· {s.pct.toFixed(0)}%</span>
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </DashCard>
    );
};

export default StatusDonut;
