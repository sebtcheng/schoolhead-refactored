import React from 'react';

/** White rounded card used by every dashboard section. */
export const DashCard = ({ icon, title, subtitle, actions, children, className = '' }) => (
    <article className={`flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6 ${className}`}>
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800 lg:flex-row lg:items-center">
            <div className="min-w-0">
                <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-tight text-[#08315F] dark:text-white">
                    <span className="text-[#0284C7]">{icon}</span> {title}
                </h3>
                {subtitle && <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">{subtitle}</p>}
            </div>
            {actions}
        </div>
        {children}
    </article>
);
