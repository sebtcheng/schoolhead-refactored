import React, { useMemo, useState } from 'react';
import {
    ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts';
import { TbTrendingUp } from 'react-icons/tb';
import { formatPeso } from '../utilization/utilizationUi';
import { formatPesoCompact, quarterIdsFor, DASH_QUARTERS } from './dashboardData';
import { DashCard } from './DashboardParts';
import { useIsDark } from '../../hooks/useIsDark';

// Ported from the RO/SDO "Quarterly Disbursement by Intervention" combo chart, scoped to one school
const THEME = {
    light: { line: '#08315F', surface: '#FFFFFF', grid: '#E2E8F0', ink: '#475569', muted: '#94A3B8' },
    dark: { line: '#E2E8F0', surface: '#0F172A', grid: '#1E293B', ink: '#CBD5E1', muted: '#64748B' },
};
const MIN_INSIDE_LABEL_PX = 16;
const CHART_HEIGHT = 360;

const ViewToggle = ({ view, onChange }) => (
    <div role="tablist" aria-label="View" className="inline-flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {['chart', 'table'].map(v => (
            <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => onChange(v)}
                className={`cursor-pointer rounded-lg border-0 px-3 py-1.5 text-xs font-black capitalize outline-none transition-all focus-visible:ring-2 focus-visible:ring-sky-300 ${
                    view === v
                        ? 'bg-white text-[#08315F] shadow-sm dark:bg-slate-900 dark:text-white'
                        : 'bg-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
            >
                {v}
            </button>
        ))}
    </div>
);

const QuarterlyDisbursementChart = ({ interventions, rankOrder, scope, scopeLabel }) => {
    const isDark = useIsDark();
    const t = isDark ? THEME.dark : THEME.light;
    const [view, setView] = useState('chart');
    const [hidden, setHidden] = useState(() => new Set());

    const quarters = useMemo(() => {
        const qIds = quarterIdsFor(scope);
        return DASH_QUARTERS.filter(q => qIds.includes(q.id));
    }, [scope]);

    // Series in the same rank order (and colors) as the Intervention Spending card
    const series = useMemo(
        () => rankOrder
            .map(id => interventions.find(iv => iv.id === id))
            .filter(iv => iv && iv.allTotal > 0),
        [interventions, rankOrder]
    );

    const data = useMemo(() => {
        const rows = quarters.map(q => {
            const amounts = Object.fromEntries(series.map(iv => [iv.id, iv.quarters.find(x => x.id === q.id).amount]));
            const values = Object.values(amounts);
            return {
                id: q.id,
                label: q.short,
                full: q.label,
                ...amounts,
                count: values.filter(v => v > 0).length,
                total: values.reduce((sum, v) => sum + v, 0),
            };
        });
        return rows.map((row, i) => ({
            ...row,
            cumulative: rows.slice(0, i + 1).reduce((sum, r) => sum + r.total, 0),
        }));
    }, [quarters, series]);

    const grandTotal = data.reduce((sum, r) => sum + r.total, 0);
    const visible = series.filter(iv => !hidden.has(iv.id));
    const topId = visible[visible.length - 1]?.id;

    const toggleSeries = (id) => setHidden(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const renderInsideLabel = ({ x, y, width, height, value }) => {
        if (!value || height < MIN_INSIDE_LABEL_PX || width < 36) return null;
        return (
            <text x={x + width / 2} y={y + height / 2} dy={3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill="#FFFFFF" style={{ pointerEvents: 'none' }}>
                {formatPesoCompact(value)}
            </text>
        );
    };

    const renderTick = ({ x, y, payload }) => {
        const row = data.find(d => d.label === payload.value);
        return (
            <g transform={`translate(${x},${y})`}>
                {/* Quarter total under the bar so the cumulative line's dot never covers it */}
                <text textAnchor="middle" fontSize={11} fontWeight={800} fill={t.ink} dy={14}>
                    {payload.value}{row ? ` · ${formatPesoCompact(row.total)}` : ''}
                </text>
                <text textAnchor="middle" fontSize={10} fontWeight={600} fill={t.muted} dy={28}>
                    {row ? `${row.count} intervention${row.count === 1 ? '' : 's'} with spending` : ''}
                </text>
            </g>
        );
    };

    const renderTooltip = ({ active, payload }) => {
        if (!active || !payload?.length) return null;
        const row = payload[0].payload;
        return (
            <div className="min-w-[230px] rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2.5 text-xs shadow-xl backdrop-blur-md dark:border-white/15 dark:bg-slate-900/90">
                <div className="mb-1.5 font-black text-slate-900 dark:text-white">{row.full}</div>
                {visible.map(iv => (
                    <div key={iv.id} className="flex items-center justify-between gap-4 py-0.5">
                        <span className="flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: iv.color }} /> {iv.label}
                        </span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{formatPeso(row[iv.id])}</span>
                    </div>
                ))}
                <div className="mt-1 flex items-center justify-between gap-4 border-t border-slate-100 pt-1.5 dark:border-slate-800">
                    <span className="font-bold text-slate-700 dark:text-slate-200">Quarter total</span>
                    <span className="font-mono font-black text-slate-900 dark:text-white">{formatPeso(row.total)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 py-0.5">
                    <span className="flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300">
                        <span className="h-0.5 w-3 rounded-full" style={{ background: t.line }} /> Cumulative
                    </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{formatPeso(row.cumulative)}</span>
                </div>
            </div>
        );
    };

    return (
        <DashCard
            icon={<TbTrendingUp />}
            title="Quarterly Disbursement by Intervention"
            subtitle={<>{scopeLabel} · <strong className="text-slate-800 dark:text-slate-100">{formatPeso(grandTotal)}</strong> declared</>}
            actions={<ViewToggle view={view} onChange={setView} />}
        >
            {series.length === 0 ? (
                <div className="py-16 text-center text-xs font-bold text-slate-400">
                    No spending declared yet. Amounts appear here once you enter them in the Utilization page.
                </div>
            ) : view === 'chart' ? (
                <>
                    {/* Legend: click an intervention to hide/show it */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                        {series.map(iv => {
                            const off = hidden.has(iv.id);
                            return (
                                <button
                                    key={iv.id}
                                    type="button"
                                    onClick={() => toggleSeries(iv.id)}
                                    aria-pressed={!off}
                                    className={`flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-transparent px-2 py-1 text-slate-600 transition-all hover:border-sky-300 dark:border-slate-700 dark:text-slate-300 ${off ? 'line-through opacity-40' : ''}`}
                                >
                                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: iv.color }} /> {iv.label}
                                </button>
                            );
                        })}
                        <span className="flex items-center gap-1.5 px-2 py-1 text-slate-600 dark:text-slate-300">
                            <span className="relative flex h-3 w-5 items-center">
                                <span className="h-0.5 w-full rounded-full" style={{ background: t.line }} />
                                <span className="absolute left-1/2 h-2 w-2 -translate-x-1/2 rounded-full" style={{ background: t.line }} />
                            </span>
                            Cumulative ₱ disbursed
                        </span>
                    </div>

                    <div className="w-full" style={{ height: CHART_HEIGHT }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={data} margin={{ top: 24, right: 24, left: 8, bottom: 20 }} barCategoryGap="28%">
                                <CartesianGrid vertical={false} stroke={t.grid} strokeDasharray="3 3" />
                                <XAxis dataKey="label" interval={0} tick={renderTick} tickLine={false} axisLine={{ stroke: t.grid }} height={44} />
                                <YAxis tickFormatter={formatPesoCompact} tick={{ fontSize: 10, fill: t.muted }} tickLine={false} axisLine={false} width={64} />
                                <Tooltip content={renderTooltip} cursor={{ fill: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(2,132,199,0.06)' }} />
                                {visible.map(iv => (
                                    <Bar
                                        key={iv.id}
                                        dataKey={iv.id}
                                        stackId="spend"
                                        fill={iv.color}
                                        stroke={t.surface}
                                        strokeWidth={2}
                                        radius={iv.id === topId ? [4, 4, 0, 0] : 0}
                                        maxBarSize={120}
                                        isAnimationActive={false}
                                    >
                                        <LabelList dataKey={iv.id} content={renderInsideLabel} />
                                    </Bar>
                                ))}
                                <Line
                                    type="linear"
                                    dataKey="cumulative"
                                    stroke={t.line}
                                    strokeWidth={2}
                                    dot={{ r: 4, fill: t.line, stroke: t.surface, strokeWidth: 2 }}
                                    activeDot={{ r: 6, fill: t.line, stroke: t.surface, strokeWidth: 2 }}
                                    isAnimationActive={false}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </>
            ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                    <table className="w-full min-w-[520px] text-xs">
                        <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-slate-800/80">
                            <tr>
                                <th className="px-3 py-2.5 text-left font-black">Intervention</th>
                                {quarters.map(q => <th key={q.id} className="px-3 py-2.5 text-right font-black">{q.short}</th>)}
                                <th className="px-3 py-2.5 text-right font-black">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {series.map(iv => (
                                <tr key={iv.id} className="text-slate-700 dark:text-slate-200">
                                    <td className="px-3 py-2 font-bold">
                                        <span className="flex items-center gap-1.5">
                                            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: iv.color }} /> {iv.label}
                                        </span>
                                    </td>
                                    {quarters.map(q => (
                                        <td key={q.id} className="px-3 py-2 text-right font-mono tabular-nums">{formatPeso(iv.quarters.find(x => x.id === q.id).amount)}</td>
                                    ))}
                                    <td className="px-3 py-2 text-right font-mono font-black tabular-nums">
                                        {formatPeso(quarters.reduce((sum, q) => sum + iv.quarters.find(x => x.id === q.id).amount, 0))}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-50 font-black text-slate-900 dark:bg-slate-800/60 dark:text-white">
                            <tr>
                                <td className="px-3 py-2">Total</td>
                                {data.map(r => <td key={r.id} className="px-3 py-2 text-right font-mono tabular-nums">{formatPeso(r.total)}</td>)}
                                <td className="px-3 py-2 text-right font-mono tabular-nums">{formatPeso(grandTotal)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </DashCard>
    );
};

export default QuarterlyDisbursementChart;
