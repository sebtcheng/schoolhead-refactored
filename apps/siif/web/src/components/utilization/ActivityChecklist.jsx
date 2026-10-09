import React, { useState } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { TbCheck, TbChevronDown, TbChecklist, TbAlertTriangle } from 'react-icons/tb';
import { UTILIZATION_ACTIVITY_GROUPS, OTHER_ACTIVITY } from '../../constants/siifConstants';

const MAX_OTHER_LENGTH = 300;

/**
 * Activities an intervention's funds were spent on in one quarter.
 * `planned` holds the labels chosen in the school's SIIF plan.
 */
const ActivityChecklist = ({ fieldId, caption, activities = [], otherActivity = '', planned = [], readOnly, missing, onChange }) => {
    const [userOpen, setUserOpen] = useState(() => !readOnly && activities.length === 0);
    // Stays open while Save flags it as required
    const open = userOpen || !!missing;

    const otherChecked = activities.includes(OTHER_ACTIVITY);
    const count = activities.length;
    const listId = `${fieldId}-activities`;

    const toggle = (label) => {
        if (readOnly) return;
        const next = activities.includes(label)
            ? activities.filter(a => a !== label)
            : [...activities, label];
        onChange({
            activities: next,
            other_activity: label === OTHER_ACTIVITY && !next.includes(OTHER_ACTIVITY) ? '' : otherActivity,
        });
    };

    const renderRow = (label) => {
        const checked = activities.includes(label);
        const isPlanned = planned.includes(label);
        if (readOnly && !checked) return null;
        return (
            <li key={label}>
                <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    aria-disabled={readOnly || undefined}
                    onClick={() => toggle(label)}
                    className={`flex min-h-[44px] w-full items-start gap-2.5 rounded-xl border px-2.5 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-indigo-300 ${
                        readOnly ? 'cursor-default' : 'cursor-pointer'
                    } ${
                        checked
                            ? 'border-indigo-200 bg-indigo-50/80 dark:border-indigo-500/40 dark:bg-indigo-500/10'
                            : 'border-transparent bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                >
                    <span className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-colors ${
                        checked
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900'
                    }`}>
                        {checked && <TbCheck size={12} strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1 text-xs font-semibold leading-snug text-slate-700 dark:text-slate-200">
                        {label}
                        {isPlanned && (
                            <span
                                className="ml-1.5 inline-flex translate-y-[-1px] items-center rounded-full bg-sky-100 px-1.5 py-px text-[9px] font-black uppercase tracking-wider text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
                                title="Chosen in your school's SIIF plan"
                            >
                                Planned
                            </span>
                        )}
                    </span>
                </button>
            </li>
        );
    };

    return (
        <div className={`rounded-2xl border transition-colors ${
            missing
                ? 'border-rose-300 bg-rose-50/40 dark:border-rose-500/40 dark:bg-rose-500/5'
                : 'border-slate-200 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-800/40'
        }`}>
            <button
                type="button"
                onClick={() => setUserOpen(!open)}
                aria-expanded={open}
                aria-controls={listId}
                className="flex min-h-[44px] w-full cursor-pointer items-center gap-2.5 rounded-2xl border-0 bg-transparent px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
            >
                <TbChecklist size={16} className="shrink-0 text-indigo-500" />
                <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Activities Funded
                    </span>
                    <span className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                        {caption}
                    </span>
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums ${
                    count > 0
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
                        : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                }`}>
                    {count} {count === 1 ? 'activity' : 'activities'}
                </span>
                <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="flex text-slate-400">
                    <TbChevronDown size={16} />
                </motion.span>
            </button>

            {missing && (
                <p className="flex items-center gap-1 px-3 pb-2 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                    <TbAlertTriangle size={13} /> Check at least one activity this amount was spent on.
                </p>
            )}

            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        id={listId}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        className="overflow-hidden"
                    >
                        <div className="space-y-3 px-2 pb-3">
                            {readOnly && count === 0 && (
                                <p className="px-1 text-xs italic text-slate-400">No activities recorded.</p>
                            )}
                            {UTILIZATION_ACTIVITY_GROUPS.map(group => {
                                const rows = group.items.map(renderRow).filter(Boolean);
                                if (rows.length === 0) return null;
                                return (
                                    <div key={group.id}>
                                        <p className="mb-1 px-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
                                            {group.label}
                                        </p>
                                        <ul className="m-0 list-none space-y-1 p-0">{rows}</ul>
                                    </div>
                                );
                            })}

                            {(!readOnly || otherChecked) && (
                                <div>
                                    <ul className="m-0 list-none p-0">{renderRow(OTHER_ACTIVITY)}</ul>
                                    {otherChecked && (
                                        <input
                                            type="text"
                                            value={otherActivity}
                                            readOnly={readOnly}
                                            maxLength={MAX_OTHER_LENGTH}
                                            onChange={(e) => onChange({ activities, other_activity: e.target.value })}
                                            placeholder="Specify the other activity…"
                                            aria-label="Other activity"
                                            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 read-only:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-indigo-500/20"
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ActivityChecklist;
