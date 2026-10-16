# Task Ledger: SIIF Utilization Charts + Tabs

See [implementation_plan.md](implementation_plan.md).

## 0. Decisions (2026-10-12)
- [x] Pie: Utilized vs Remaining
- [x] Bar chart: toggle between "Over time" and "Pareto"
- [x] 3 bars (one per quarter)
- [x] Tabs on Utilization only, names: Overview · Record Spending · History

## 3. In-page tabs
- [x] `PageTabs.jsx` (animated pill, arrow keys, `?tab=` in URL)
- [x] Overview / Record Spending / History panels in `SIIFUtilization.jsx`
- [x] Save bar shows on every tab; Record tab gets an amber dot when unsaved
- [x] A save blocked by missing activities jumps to Record Spending

## 1. Donut chart
- [x] `UtilizationDonut.jsx` (centre %, over-budget red, no-allocation grey)
- [x] Replaces the 3 stat cards; 30% column on desktop, stacked on mobile

## 2. Bar chart + `recorded_at`
- [x] API: `sanitizeExpenses` keeps `recorded_at` / `updated_at`
- [x] API: `stampExpenses` sets them on the server (client values ignored) (verified)
- [x] `QuarterParetoChart.jsx`: bars + running-total line, 100% / 80% reference, entry tooltip
- [x] 70% column

## History tab
- [x] `UtilizationHistory.jsx`: spending entries timeline + save log (paged)

## Verify
- [x] Lint clean on new/changed files
- [x] `pnpm --filter @apps/school-head-web build` passes
- [ ] Manual browser test (checklist in the plan)
