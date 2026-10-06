import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TbLayersLinked, TbCheck, TbPlus, TbTarget, TbAdjustmentsHorizontal } from 'react-icons/tb';

const InterventionSelector = ({ interventions, icons, selected, expanded, onToggleExpanded, onToggle }) => {
    const activeItems = interventions.filter(i => selected.includes(i.id));

    return (
        <section className="siif-card mb-6 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
                        <TbLayersLinked size={22} />
                    </div>
                    <div className="min-w-0">
                        <h2 className="!text-base sm:!text-lg">
                            Interventions
                        </h2>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            <span className="font-black text-indigo-600 dark:text-indigo-300">{selected.length}</span> of {interventions.length} being tracked
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onToggleExpanded}
                    aria-expanded={expanded}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-black transition-all focus-visible:ring-2 focus-visible:ring-indigo-300 outline-none ${
                        expanded
                            ? 'border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                >
                    {expanded ? <TbCheck size={15} /> : <TbAdjustmentsHorizontal size={15} />}
                    {expanded ? 'Done' : 'Manage'}
                </button>
            </div>

            {/* Collapsed: active chips */}
            {!expanded && activeItems.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                    {activeItems.map(item => (
                        <span
                            key={item.id}
                            className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50/70 py-1 pl-1.5 pr-3 text-xs font-bold text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200"
                        >
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white [&>svg]:h-3.5 [&>svg]:w-3.5">
                                {icons[item.id] || <TbTarget />}
                            </span>
                            {item.label}
                        </span>
                    ))}
                </div>
            )}

            <AnimatePresence initial={false}>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                    >
                        <p className="mt-4 mb-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                            Tap an intervention to turn tracking on or off.
                        </p>
                        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                            {interventions.map(item => {
                                const isSelected = selected.includes(item.id);
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        aria-pressed={isSelected}
                                        onClick={() => onToggle(item.id)}
                                        title={item.desc}
                                        className={`group relative flex cursor-pointer flex-col justify-between gap-3 overflow-hidden rounded-2xl border p-3 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-indigo-300 active:scale-[0.98] ${
                                            isSelected
                                                ? 'border-indigo-300 bg-gradient-to-br from-indigo-50 to-sky-50 shadow-sm shadow-indigo-100 dark:border-indigo-500/50 dark:from-indigo-500/15 dark:to-sky-500/5 dark:shadow-none'
                                                : 'border-slate-200 bg-slate-50/80 hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        <div className="flex w-full items-center justify-between">
                                            <div className={`rounded-xl p-2 transition-colors ${
                                                isSelected
                                                    ? 'bg-indigo-600 text-white shadow-sm'
                                                    : 'border border-slate-200 bg-white text-slate-400 group-hover:text-indigo-500 dark:border-slate-600 dark:bg-slate-900'
                                            }`}>
                                                {icons[item.id] || <TbTarget size={18} />}
                                            </div>
                                            <span className={`flex h-5 w-5 items-center justify-center rounded-full transition-all ${
                                                isSelected
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'bg-slate-200 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-500 dark:bg-slate-700'
                                            }`}>
                                                {isSelected ? <TbCheck size={12} /> : <TbPlus size={12} />}
                                            </span>
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className={`truncate text-xs font-black leading-tight ${isSelected ? 'text-indigo-950 dark:text-indigo-100' : 'text-slate-700 dark:text-slate-300'}`}>
                                                {item.label}
                                            </h3>
                                            <span className={`mt-0.5 block text-[10px] font-bold uppercase tracking-widest ${isSelected ? 'text-indigo-500 dark:text-indigo-300' : 'text-slate-400'}`}>
                                                {isSelected ? 'Tracking' : 'Add'}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
};

export default InterventionSelector;
