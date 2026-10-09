# Task Ledger: SIIF Optional Forms

Branch: `feature/siif-optional-forms`

## Phase 0: Safety net
- [x] Take a `pg_dump` of the `siif_*`, `modified_siif_*` and `settings` tables (v2). Saved to `Documents\siif_backups\siif_database_v2_20261009_0952.dump` (11 tables, 11 MB)
- [ ] ICT confirms v2 storage is persistent and PITR/backups are enabled
- [x] Take a fresh `pg_dump` right before the production run: `siif_database_v2_20261009_1021_pre_repair.dump`

## Phase 1: DB schema repair
- [x] `apps/siif/api/sql/siif_v2_schema_repair.sql`: pre-flight checks, archives empty duplicates, adds sequences, defaults, PKs, unique rules and indexes
- [x] `apps/siif/api/sql/siif_v2_open_forms.sql`: D1 option B (clears `siif_form_end` and keeps `siif_form_end_original`)
- [x] Dry run on `siif_v2_staging` (4 s; a second run is a no-op)
- [x] **Ran on prod 2026-10-09 ~10:25.** The first attempt was stopped by pre-flight (14 beneficiary + 12 activity rows with NULL ids from test school 800009). The script was updated to backfill leaf-table ids, dry-run on prod with ROLLBACK, then committed (6 s). Verified: 5 sequences, 8 constraints, 13 indexes, row counts unchanged except the 1 archived empty duplicate (115195 → kept 29067). A rollback probe on prod confirmed ids are generated and duplicates are blocked.

## Phase 2: Backend
- [x] `helpers/parseLegacy.js`. Checked against every distinct value in v2 (27,649 values, 0 unparsed)
- [x] GET `/submission`: normalises legacy fields and status casing
- [x] POST `/submit`: type-safe writes, per-school advisory lock, loud failure if no ID is generated
- [x] PUT `/settings/deadline`: `Super User` only
- [x] `shared-db`: no SIIF fallback; the server refuses to start unless the URL points at `siif_database_v2`

- [x] `priority_improvement_area` is written in the restored Python format (`['a', 'b']`) via `toPythonList` (decision: option A). The `vw_siif_division_pia*` views split on `', '`, so JSON writes were miscounted as "Other / Unspecified". Checked: all 34,870 existing rows come out byte-for-byte identical after parse → write, and the view parses new values correctly
- [x] **Decision changed to option B (2026-10-09):** restore `priority_improvement_area` to `jsonb`. The API writes `JSON.stringify(...)` again (works for both text and jsonb); `toPythonList` removed
- [x] `sql/siif_v2_pia_jsonb.sql`: converts the column and recreates the 3 PIA views (only the unpacking changes). Originals saved in `sql/siif_v2_pia_views_original.sql`
- [x] Read-only per-row equivalence on prod: 34,877 plans, 0 filter / 0 item mismatches between old and new view parsing (2.6 s)
- [x] ⚠️ Incident 2026-10-09: the first prod dry run hashed full view output *inside* the locked section (minutes per pass), holding an ACCESS EXCLUSIVE lock on `siif_submissions` for ~3 min until cancelled. Rolled back, no data changed. Fixed: hashing removed, the equivalence check now runs before any lock
- [x] **Ran on prod 2026-10-09 ~11:02.** Dry run 13 s, backup `siif_database_v2_20261009_1102_pre_pia_jsonb.dump`, migration 15.5 s. Verified: column `jsonb DEFAULT '[]'`, all 34,877 values are arrays, 3 views recreated, no "Other / Unspecified" pillar, no lock waiters

## Phase 3: Frontend
- [x] `SIIFModule.jsx`: `forms` route. *The summary route is not needed: `SIIFSummary.jsx` is dead code, and submit lives in the FormsHub modal.*
- [x] `BottomNav.jsx`: Forms item with an "Optional" badge. Mobile: Dashboard · Forms · Nexus · Utilization · Settings (Logout is in Settings)
- [x] `SIIFFormsHub.jsx`: Optional banner, "Edit Plan" for submitted plans (D2), `/siif` → `/siif/dashboard`
- [ ] (Optional) Dashboard plan-status card

## Phase 4: Verify
- [x] `vite build` passes
- [x] E2E against `siif_v2_staging` with the real routers: 21/21 pass (new school, double-submit, restored-draft round-trip, For Revision, Reviewed, settings)
- [x] Control on an unrepaired copy: old code returns a 500 (`has_aral` type). New code refuses with a clear message and writes 0 rows
- [ ] Manual UI pass in the browser (desktop and 360px mobile) after the prod repair
- [x] Drop `siif_v2_staging` (done; testing uses the test accounts in v2)

## Phase 5 (later)
- [ ] `v_siif_plan_vs_actual` view and report

## Follow-ups (out of scope, flagged)
- Hardcoded prod credentials in the other `shared-db` pools, and a hardcoded `JWT_SECRET` fallback in `apps/siif/api/middleware/authenticate.js`. Rotate the password.
- `authenticate.js` logs the full decoded token on every request.
- Fiscal year is hardcoded to `new Date().getFullYear()`, so Forms will show empty from 2027-01-01.
- `vw_siif_division_*` views read the same retyped columns (owner: RO module).
