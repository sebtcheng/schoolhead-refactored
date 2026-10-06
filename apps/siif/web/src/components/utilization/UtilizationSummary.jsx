import React from 'react';
import { motion } from 'framer-motion';
import { TbWallet, TbReceipt2, TbPigMoney, TbAlertCircle } from 'react-icons/tb';
import { formatPeso, QUARTER_SWATCHES } from './utilizationUi';

const StatTile = ({ icon, label, value, hint, tone, delay }) => (
    <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay }}
        className="siif-card relative overflow-hidden p-4 sm:p-5"
    >
        <div className={`absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-60 blur-2xl ${tone.glow}`} />
        <div className="relative flex items-center gap-2.5 mb-3">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone.icon}`}>
                {icon}
            </span>
            <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {label}
            </span>
        </div>
        <p className={`relative text-xl sm:text-2xl font-black leading-none tabular-nums break-all ${tone.value}`}>
            {value}
        </p>
        {hint && (
            <p className="relative mt-2 text-[11px] font-bold text-slate-400 dark:text-slate-500">{hint}</p>
        )}
    </motion.div>
);

const UtilizationSummary = ({
    fiscalYear,
    totalAllocated,
    totalUtilized,
    remainingBalance,
    overallProgress,
    quarterTotals,
    remarks,
}) => {
    const isOver = totalAllocated > 0 && totalUtilized > totalAllocated;
    const hasAllocation = totalAllocated > 0;
    const scaleBase = hasAllocation ? Math.max(totalAllocated, totalUtilized) : (totalUtilized || 1);

    return (
        <section className="mb-6" aria-label="Utilization summary">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4">
                <StatTile
                    icon={<TbWallet size={18} />}
                    label="Official Allocation"
                    value={formatPeso(totalAllocated)}
                    hint={remarks || `FY ${fiscalYear}`}
                    tone={{
                        glow: 'bg-blue-200 dark:bg-blue-500/30',
                        icon: 'bg-[#08315F] text-white dark:bg-blue-500/20 dark:text-blue-300',
                        value: 'text-[#08315F] dark:text-white',
                    }}
                    delay={0}
                />
                <StatTile
                    icon={<TbReceipt2 size={18} />}
                    label="Total Utilized"
                    value={formatPeso(totalUtilized)}
                    hint={hasAllocation ? `${overallProgress.toFixed(1)}% of allocation` : 'Across all quarters'}
                    tone={isOver ? {
                        glow: 'bg-rose-200 dark:bg-rose-500/30',
                        icon: 'bg-rose-600 text-white',
                        value: 'text-rose-600 dark:text-rose-400',
                    } : {
                        glow: 'bg-sky-200 dark:bg-sky-500/30',
                        icon: 'bg-sky-500 text-white',
                        value: 'text-sky-700 dark:text-sky-300',
                    }}
                    delay={0.06}
                />
                <StatTile
                    icon={<TbPigMoney size={18} />}
                    label="Remaining Balance"
                    value={formatPeso(remainingBalance)}
                    hint={hasAllocation ? `${Math.max(0, 100 - overallProgress).toFixed(1)}% still available` : '—'}
                    tone={{
                        glow: 'bg-emerald-200 dark:bg-emerald-500/30',
                        icon: 'bg-emerald-500 text-white',
                        value: 'text-emerald-700 dark:text-emerald-300',
                    }}
                    delay={0.12}
                />
            </div>

            {/* Quarter-segmented progress */}
            <div className="siif-card p-4 sm:p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                    <h2 className="!text-base sm:!text-lg">
                        FY {fiscalYear} Utilization Progress
                    </h2>
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-black tabular-nums ${
                        isOver
                            ? 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300'
                            : 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300'
                    }`}>
                        {hasAllocation ? `${overallProgress.toFixed(1)}% utilized` : 'No allocation yet'}
                    </span>
                </div>

                <div
                    className={`flex h-3.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 ${isOver ? 'ring-2 ring-rose-400/70' : ''}`}
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(Math.min(overallProgress, 100))}
                >
                    {quarterTotals.map((q, i) => (
                        <motion.div
                            key={q.id}
                            className={`h-full ${isOver ? 'bg-rose-500' : QUARTER_SWATCHES[i]?.bar} ${i > 0 ? 'border-l-2 border-white/70 dark:border-slate-900/70' : ''}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${(q.amount / scaleBase) * 100}%` }}
                            transition={{ duration: 0.9, ease: 'easeOut', delay: 0.15 + i * 0.1 }}
                            title={`${q.label}: ${formatPeso(q.amount)}`}
                        />
                    ))}
                </div>

                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
                    {quarterTotals.map((q, i) => (
                        <div key={q.id} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            <span className={`h-2.5 w-2.5 rounded-full ${QUARTER_SWATCHES[i]?.dot}`} />
                            <span>{q.label}</span>
                            <span className="font-black tabular-nums text-slate-700 dark:text-slate-200">{formatPeso(q.amount)}</span>
                        </div>
                    ))}
                </div>
            </div>

            {!hasAllocation && (
                <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2.5 dark:border-blue-500/30 dark:bg-blue-500/10">
                    <TbAlertCircle className="mt-0.5 shrink-0 text-blue-500" size={16} />
                    <p className="text-xs font-medium leading-relaxed text-blue-800 dark:text-blue-200">
                        <strong className="font-black">No official allocation found yet.</strong>{' '}
                        You can still select interventions and record quarterly expenditures.
                    </p>
                </div>
            )}
        </section>
    );
};

export default UtilizationSummary;
