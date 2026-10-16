# Task Ledger: SIIF Utilization – Per-quarter Locks & Activity Checklist

Plan: [implementation_plan.md](implementation_plan.md)

## Phase 0: Decisions & safety net
- [x] D1: **per quarter** (first built per intervention, switched 2026-10-09)
- [x] D2: full list + "Planned" badge · D3: required when amount > 0 · D4: DB `UPDATE` only
- [x] `pg_dump` before the seed: `Documents\siif_backups\siif_database_v2_20261009_1339_pre_quarter_locks.dump` (`settings`, `modified_siif_utilization`, `_audit`, `siif_allocations`)

## Phase 1: Quarter locks (DB + API)
- [x] `sql/siif_v2_utilization_quarter_locks.sql`: Jul–Sep `true`, Oct–Dec `true`, Jan–Mar `false`
- [x] **Ran on v2 prod 2026-10-09 ~13:45.** `siif_v2_staging` no longer exists, so it was dry-run on v2 with ROLLBACK first. Run 1: `INSERT 0 3`; run 2: `INSERT 0 0`. No code read the keys until this branch ships.
- [x] `helpers/utilizationPeriods.js`: `PERIOD_LOCK_KEYS`, `getLockedPeriods()` (fail-closed), sanitizers
- [x] GET returns `lockedPeriods` and `plannedActivities` (from `siif_activities` of the latest plan); saved activities come back inside each quarter of `utilizationData`
- [x] POST: normalization moved after the `FOR UPDATE` read; locked quarters keep their stored values; `spent_amount` uses the enforced data
- [x] POST: 409 when removing an intervention that has entries in a locked quarter; 423 when every quarter is locked

## Phase 2: Quarter locks (UI)
- [x] Hook exposes `lockedPeriods`; starting quarter = today's if open, else the latest earlier open quarter
- [x] `QuarterTabs`: lock icon + "Locked", still clickable
- [x] `InterventionCard`: read-only on locked quarters; ✕ disabled when locked entries exist
- [x] Lock banner; SaveBar "Utilization is closed" state when every quarter is locked
- [x] `persistUtilization` leaves locked quarters alone

## Phase 3: Activity checklist (per quarter)
- [x] `OTHER_ACTIVITY` + `UTILIZATION_ACTIVITY_GROUPS` in `siifConstants.jsx` (reuse the plan-form arrays)
- [x] `ActivityChecklist.jsx`: collapsible, grouped, "Others (specify)" text, "Planned" badge, 44 px rows
- [x] `activities` and `other_activity` saved inside each quarter of `selected_interventions`
- [x] D3: Save blocked when an **open** quarter has an amount but no activity; jumps to that quarter; toast lists intervention + quarter (client-side; a removal is not blocked by it)

## Phase 3b: Remove implementation status (SIIF team request, 2026-10-09)
- [x] Scope: Utilization **and** Dashboard; saved statuses are **cleared on each school's next save** (the audit `before_interventions` keeps the history)
- [x] Utilization: status picker, card status chip and "Same as …" carry-over removed; card accent now shows "has an amount this quarter"; tabs show "x/y recorded" instead of "x/y completed"
- [x] `utilizationUi.js`: `STATUS_OPTIONS`, `statusStyle`, `effectiveStatus`, `isUntouchedQuarter` removed
- [x] Dashboard: school status pill, per-intervention status pills and `StatusDonut` (file deleted) removed; Intervention Spending is now full width
- [x] Server: `sanitizeQuarter()` / `emptyQuarter()` save `{ amount, justification, activities, other_activity }` only (no `status`)
- [ ] Follow-up: `v_modified_siif_interventions` still has `q*_status` columns; after saves they read `'Not Yet Started'` (COALESCE). Check whether the RO/SDO dashboard (InsightED-ROSDO) uses them

## Phase 4: Verify
- [x] E2E with the real router on v2, inside one rolled-back transaction: **26/26 pass** (re-run after the status removal and the per-quarter switch; includes "locked quarter keeps its activities") (locked-quarter ignore, 409, 423, fail-closed parsing, unlock round trip, sanitizing, legacy payload, audit row). Confirmed afterwards: settings and school 800013's row and audit untouched.
- [x] `vite build` (school-head web) passes; no new lint errors in changed files
- [ ] Manual UI pass in the browser (locked tab, banner, checklist save/reload, 375 px, dark mode)
- [ ] Deploy (the seed is already on prod, so code can ship any time)
