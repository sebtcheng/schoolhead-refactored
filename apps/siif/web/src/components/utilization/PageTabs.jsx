import React, { useRef } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';

/**
 * Tabs inside the main panel (the sidebar keeps the module-level tabs).
 * `tabs`: [{ id, label, icon, dot? }]; `dot` shows a small amber marker (e.g. unsaved edits).
 * Arrow keys / Home / End move between tabs, as in the WAI-ARIA tabs pattern.
 */
const PageTabs = ({ tabs, value, onChange, idPrefix = 'siif-tab' }) => {
    const refs = useRef({});

    const focusTab = (index) => {
        const tab = tabs[(index + tabs.length) % tabs.length];
        onChange(tab.id);
        refs.current[tab.id]?.focus();
    };

    const onKeyDown = (e, index) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); focusTab(index + 1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); focusTab(index - 1); }
        else if (e.key === 'Home') { e.preventDefault(); focusTab(0); }
        else if (e.key === 'End') { e.preventDefault(); focusTab(tabs.length - 1); }
    };

    return (
        <div className="siif-page-tabs mb-6 overflow-x-auto print:hidden">
            <div
                role="tablist"
                aria-label="Utilization sections"
                className="inline-flex min-w-full gap-1 rounded-2xl border border-slate-200/80 bg-white/80 p-1.5 shadow-sm backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/80 sm:min-w-0"
            >
                {tabs.map((tab, index) => {
                    const selected = tab.id === value;
                    return (
                        <button
                            key={tab.id}
                            ref={el => { refs.current[tab.id] = el; }}
                            type="button"
                            role="tab"
                            id={`${idPrefix}-${tab.id}`}
                            aria-selected={selected}
                            aria-controls={`${idPrefix}-panel-${tab.id}`}
                            tabIndex={selected ? 0 : -1}
                            onClick={() => onChange(tab.id)}
                            onKeyDown={(e) => onKeyDown(e, index)}
                            className={`relative flex flex-1 shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl border-0 bg-transparent px-4 py-2.5 text-xs font-black uppercase tracking-wider outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sky-300 sm:flex-none sm:px-5 ${
                                selected ? 'text-white' : 'text-slate-500 hover:text-[#08315F] dark:text-slate-400 dark:hover:text-white'
                            }`}
                        >
                            {selected && (
                                <motion.span
                                    layoutId={`${idPrefix}-pill`}
                                    className="absolute inset-0 rounded-xl bg-[#08315F] shadow-md shadow-[#08315F]/25 dark:bg-indigo-600"
                                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                                    aria-hidden="true"
                                />
                            )}
                            <span className="relative flex items-center gap-2">
                                {tab.icon}
                                {tab.label}
                                {tab.dot && (
                                    <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" aria-label="unsaved changes" />
                                )}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default PageTabs;
