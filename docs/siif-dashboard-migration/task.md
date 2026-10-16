# Task Ledger: SIIF Dashboard Migration

See [implementation_plan.md](implementation_plan.md).

## 0. Decisions (2026-10-12)
- [x] Old Dashboard page: removed
- [x] Opening SIIF lands on Forms › Dashboard
- [x] KPI cards dropped (the donut shows the same numbers)
- [x] Dashboard numbers: saved figures + amber note (default)
- [x] Tab names: "Dashboard · Record Spending · History" / "Dashboard · Plan Form" (default)

## A. Utilization page
- [x] Tab `overview` → `dashboard` (old `?tab=overview` links still work)
- [x] Quarter filter + Spending by Intervention + Quarterly Disbursement moved under the charts
- [x] Donut, per-quarter chart and intervention charts all use the saved snapshot
- [x] Amber "Showing saved figures" note with a "Review changes" button
- [x] `UtilizationOverview`: KPI row removed; buttons open Record Spending

## B. Forms page
- [x] `PageTabs`: Dashboard · Plan Form (`?tab=`)
- [x] `PlanOverview` in the Dashboard tab; "Revise / View / Plan" buttons switch tabs
- [x] Dashboard refetches the plan each time it opens (`useSIIFPlan` refreshKey)
- [x] "Not yet open" lock shown only in the Plan Form tab; its button returns to the Dashboard tab

## C. Old Dashboard page
- [x] Sidebar item removed; `SIIFDashboard.jsx` deleted
- [x] `/siif/dashboard` redirects (`?view=utilization` → Utilization › Dashboard, else Forms › Dashboard)
- [x] `/siif` and unknown SIIF paths → Forms

## Verify
- [x] Lint: new/changed files clean; `SIIFFormsHub.jsx` has the same 20 earlier problems as before (no new ones)
- [x] `pnpm --filter @apps/school-head-web build` passes
- [ ] Manual browser test (checklist in the plan)
