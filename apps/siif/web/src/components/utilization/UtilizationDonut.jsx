import React from 'react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { TbChartDonut3 } from 'react-icons/tb';
import { formatPeso } from './utilizationUi';
import { useIsDark } from '../../hooks/useIsDark';

const COLORS = {
    utilized: '#0EA5E9',   // sky-500, same as the old "Total Utilized" tile
    remaining: '#10B981',  // emerald-500, same as the old "Remaining Balance" tile
    over: '#E11D48',       // rose-600
    empty: { light: '#E2E8F0', dark: '#1E293B' },
};

const LegendRow = ({ color, label, value, strong = false }) => (
    <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
            {color ? <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} /> : <span className="w-2.5" />}
            <span className="truncate">{label}</span>
        </span>
        <span className={`shrink-0 tabular-nums ${strong ? 'text-sm font-black text-[#08315F] dark:text-white' : 'text-xs font-black text-slate-700 dark:text-slate-200'}`}>
            {value}
        </span>
    </div>
);

const DonutTooltip = ({ active, payload }) => {
    if (!active || !payload?.length || payload[0].payload.placeholder) return null;
    const { name, value } = payload[0].payload;
    return (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <p className="font-black text-slate-800 dark:text-slate-100">{name}</p>
            <p className="font-bold tabular-nums text-slate-500 dark:text-slate-400">{formatPeso(value)}</p>
        </div>
    );
};

/**
 * Utilized vs Remaining of the school's official allocation, with the % in the centre.
 * Replaces the Allocation / Utilized / Remaining tiles; their amounts live in the legend.
 */
const UtilizationDonut = ({ fiscalYear, totalAllocated, totalUtilized, remainingBalance, overallProgress, remarks }) => {
    const dark = useIsDark();
    const hasAllocation = totalAllocated > 0;
    const isOver = hasAllocation && totalUtilized > totalAllocated;

    let data;
    if (!hasAllocation) {
        data = [{ name: 'No allocation', value: 1, color: COLORS.empty[dark ? 'dark' : 'light'], placeholder: true }];
    } else if (isOver) {
        data = [{ name: 'Utilized', value: totalUtilized, color: COLORS.over }];
    } else {
        data = [
            { name: 'Utilized', value: totalUtilized, color: COLORS.utilized },
            { name: 'Remaining', value: remainingBalance, color: COLORS.remaining },
        ].filter(d => d.value > 0);
        if (!data.length) data = [{ name: 'Remaining', value: 1, color: COLORS.remaining, placeholder: true }];
    }

    return (
        <motion.article
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="siif-card flex h-full flex-col p-4 sm:p-5"
            aria-label="Allocation used versus remaining"
        >
            <div className="mb-2 flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#08315F] text-white dark:bg-blue-500/20 dark:text-blue-300">
                    <TbChartDonut3 size={18} />
                </span>
                <div className="min-w-0">
                    <h2 className="!text-base sm:!text-lg">Allocation Used</h2>
                    <p className="truncate text-[11px] font-bold text-slate-400">{remarks || `FY ${fiscalYear}`}</p>
                </div>
            </div>

            {/* Donut beside its legend while the card spans the row (sm–lg); stacked on phones and in the lg side column */}
            <div className="flex flex-1 flex-col sm:flex-row sm:items-center sm:gap-8 lg:flex-col lg:items-stretch lg:justify-center lg:gap-0">
                <div className="relative mx-auto h-[200px] w-full max-w-[240px] sm:mx-0 sm:shrink-0 lg:mx-auto">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                dataKey="value"
                                nameKey="name"
                                innerRadius="68%"
                                outerRadius="92%"
                                startAngle={90}
                                endAngle={-270}
                                paddingAngle={data.length > 1 ? 2 : 0}
                                stroke="none"
                                animationDuration={800}
                            >
                                {data.map(d => <Cell key={d.name} fill={d.color} />)}
                            </Pie>
                            <Tooltip content={<DonutTooltip />} />
                        </PieChart>
                    </ResponsiveContainer>
                    {/* Centre label */}
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                        {hasAllocation ? (
                            <>
                                <span className={`text-2xl font-black tabular-nums leading-none ${isOver ? 'text-rose-600 dark:text-rose-400' : 'text-[#08315F] dark:text-white'}`}>
                                    {overallProgress.toFixed(1)}%
                                </span>
                                <span className="mt-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                                    {isOver ? `Over by ${formatPeso(totalUtilized - totalAllocated)}` : 'utilized'}
                                </span>
                            </>
                        ) : (
                            <span className="px-6 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">No allocation yet</span>
                        )}
                    </div>
                </div>

                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800 sm:mt-0 sm:max-w-md sm:flex-1 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0 lg:mt-3 lg:max-w-none lg:flex-none lg:border-l-0 lg:border-t lg:pl-0 lg:pt-3">
                    <LegendRow label="Official Allocation" value={formatPeso(totalAllocated)} strong />
                    <LegendRow color={isOver ? COLORS.over : COLORS.utilized} label="Utilized" value={formatPeso(totalUtilized)} />
                    <LegendRow color={COLORS.remaining} label="Remaining" value={formatPeso(remainingBalance)} />
                </div>
            </div>
        </motion.article>
    );
};

export default UtilizationDonut;
