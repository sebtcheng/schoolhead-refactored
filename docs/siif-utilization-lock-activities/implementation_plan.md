# Implementation Plan: Per-quarter locks and an Activity Checklist for SIIF Utilization

**Branch:** `feature/siif-optional-forms` (or a new `feature/siif-utilization-locks` off it)
**Target DB:** `siif_database_v2` (`SIIF_DATABASE_URL` in `.env`)
**Date:** 2026-10-09 · **Rev 3:** every quarter has its own lock; **activities are recorded per quarter**; implementation status removed

---

## 1. Goal

1. **Each utilization quarter (July–September, October–December, January–March) can be locked or opened separately** using a row in the `settings` table of `siif_database_v2`. `false` means locked and `true` means open.
   - Initial values: **July–September open, October–December open, January–March locked.**
2. **Add an activity checklist to each quarter of each intervention**, so school heads record what they spent each quarter's money on. Save it inside `modified_siif_utilization.selected_interventions` (JSONB). No new columns.

## 2. What I found

### 2.1 The `settings` table (v2, checked read-only)
Columns: `key text`, `value text`, `created_at text` and `updated_at text`. `key` is unique, since `settings.js` already upserts with `ON CONFLICT (key)`.

| key | value | used by code? |
|---|---|---|
| `siif_form_start` / `siif_form_end` / `siif_form_end_original` | dates | yes |
| `siif_review_start` / `siif_review_deadline` | dates | yes |
| `siif_active_utilization_period` | `July-September` | **no, nothing reads it** (left alone) |
| `nexus_module_locks` | JSON | school-head API |

There are no lock keys for quarters yet.

### 2.2 How quarters work today
- `PERIODS` is hard-coded in `hooks/useModifiedSIIFUtilization.js`. The current quarter comes from the browser date.
- Every tab and every input can be edited at any time. `POST /modified-utilization` saves the incoming `quarters` as-is, so **the lock must be enforced on the server**, not just in the UI.

### 2.3 Live data (3 rows in `modified_siif_utilization`)
```json
{ "id": "remediation", "title": "Remediation", "total_spent": 1500,
  "quarters": {
    "July-September":   { "amount": "1000", "status": "Ongoing", "justification": "test 1" },
    "October-December": { "amount": "500",  "status": "Ongoing", "justification": "" },
    "January-March":    { "amount": "",     "status": "Not Yet Started", "justification": "" } } }
```
July–September and October–December **already have data**. That's why a locked quarter must stay **viewable, read-only**, not hidden (§3.1).

### 2.4 An official activity list already exists
`siifConstants.jsx` has `SIP_AIP_ACTIVITIES`, `ACTION_RESEARCH_ACTIVITY` and `REMAINING_ACTIVITIES`, which the planning form already uses. The school's plan stores the chosen activities **as label strings** per intervention. If the checklist reuses the same labels, planned vs actual activities is a simple string match.

---

## 3. Design

### 3.1 Per-quarter locks

**Settings: one boolean row per quarter, matching your "false = locked" rule**

| key | initial value |
|---|---|
| `siif_utilization_jul_sep_open` | `'true'` |
| `siif_utilization_oct_dec_open` | `'true'` |
| `siif_utilization_jan_mar_open` | `'false'` |

- **Fail-closed:** a missing key, an empty value or anything other than `'true'` counts as **locked**.
  - ⚠️ So the seed SQL **must run before** the code is deployed. Otherwise all three quarters would lock.
- To open or close a quarter, run something like:
  ```sql
  UPDATE settings SET value = 'true', updated_at = NOW()::text
  WHERE key = 'siif_utilization_jan_mar_open';
  ```
  It takes effect on the next page load, with no deploy.
- In code, the keys are kept in one map in `helpers/utilizationPeriods.js`:
  ```js
  export const PERIOD_LOCK_KEYS = {
    'July-September':   'siif_utilization_jul_sep_open',
    'October-December': 'siif_utilization_oct_dec_open',
    'January-March':    'siif_utilization_jan_mar_open',
  };
  ```

**What "locked" means**

| | Open quarter | Locked quarter |
|---|---|---|
| Tab | normal | 🔒 icon + "Locked" label. **Still clickable**, so past entries can be viewed |
| Amount / status / remarks | editable | **read-only** (inputs disabled), with a banner: "This quarter is locked. Entries can't be changed." |
| Server | saves what's sent | **ignores what's sent and keeps the stored values** |

**Server (the real lock):** `getLockedPeriods(client)` returns e.g. `['January-March']`.
- `GET /modified-utilization/:schoolId` adds `lockedPeriods` to its response. No extra request is needed.
- `POST /modified-utilization`: locked quarters are copied from the stored row, which is read with the existing `FOR UPDATE`. `spent_amount` is calculated *after* that. To do this, the normalization block moves inside the transaction, after the locked read.
- **Removing an intervention that has amounts in a locked quarter is blocked** (409, "has entries in a locked quarter"). Otherwise a removal would quietly erase locked data. In the UI, the ✕ button on such a card is disabled and shows a tooltip explaining why.
- Adding a new intervention while some quarters are locked is fine. Its locked quarters just stay empty.

**Client**
- The hook returns `lockedPeriods`.
- If today's quarter is locked, the page opens on the latest open quarter. If every quarter is locked, it opens on today's quarter (read-only), and a page banner says "Utilization entry is currently closed". Save is disabled.
- `persistUtilization` doesn't write carried-over statuses into locked quarters. The server would ignore them anyway.
- Summary and Dashboard math need no change.

### 3.2 Activity checklist: per quarter

**Where it's stored:** inside each quarter of `selected_interventions`, next to that quarter's amount:
```json
{ "id": "remediation", "title": "Remediation", "total_spent": 1500,
  "quarters": {
    "July-September":   { "amount": "1000", "justification": "",
                          "activities": ["Conduct of school-level Learning Action Cell (LAC) sessions"],
                          "other_activity": "" },
    "October-December": { "amount": "500", "justification": "",
                          "activities": ["Printing or reproduction of learning materials", "Others (specify)"],
                          "other_activity": "Snacks for reading camp" },
    "January-March":    { "amount": "", "justification": "", "activities": [], "other_activity": "" } } }
```
- Old rows without `activities` just show an empty checklist. Implementation status is no longer saved (see `task.md`, Phase 3b).
- The audit table's `after_interventions` records it automatically.

**Editing rules**
- The checklist follows the quarter tab, like the amount. On a locked quarter it's read-only, and the server keeps the stored list.
- **Required (D3):** every **open** quarter with an amount above ₱0 needs at least one activity, or "Others" with text. On Save, the page jumps to the first quarter that's missing one and the toast names each intervention and quarter. Locked quarters never block a save.

**UI:** `components/utilization/ActivityChecklist.jsx` inside `InterventionCard` (caption "For Jul – Sep", etc.). It's collapsible, grouped (SIP/AIP · Action Research · Operational), has "Others (specify)" and the "Planned" badge, uses 44 px rows and supports dark mode.

**Server validation:** each quarter is rebuilt as `{ amount, justification, activities, other_activity }`. Activities: unique trimmed strings, at most 15, each at most 200 characters. `other_activity`: at most 300 characters. Any other field (including `status`) is dropped.

---

## 4. Decisions

| # | Question | Status |
|---|---|---|
| **D1** | Per quarter or per intervention? | ✅ **Per quarter** (changed from "per intervention" on 2026-10-09 so spending and activities line up by quarter) |
| **D2** | Full official list + a "Planned" badge for activities from the school's SIIF plan? | ✅ **yes** |
| **D3** | Required? Block Save when the intervention's total amount is above ₱0 and nothing is checked | ✅ **yes** |
| **D4** | Toggle locks by DB `UPDATE` only, or also add a `Super User` endpoint? | ✅ **DB only** for now |

## 5. Risks and guardrails
- **Deletion lock:** no `DELETE`, `TRUNCATE` or `DROP`. The only DB write is an idempotent `INSERT … ON CONFLICT DO NOTHING`.
- **Schema lock:** no column changes. Everything lives in the existing JSONB.
- **Deploy order:** seed first, then code (fail-closed, see §3.1).
- **Label drift:** activities are stored as label text, the same as the plan.
- **Clock skew:** locks come from the DB, not the device date.
- **Backup:** `pg_dump` `settings` and `modified_siif_utilization` before the prod seed.

## 6. Files

| File | Change |
|---|---|
| `apps/siif/api/sql/siif_v2_utilization_quarter_locks.sql` | **new**: seeds the 3 keys (idempotent) |
| `apps/siif/api/helpers/utilizationPeriods.js` | **new**: `PERIOD_IDS`, `PERIOD_LOCK_KEYS`, `getLockedPeriods()`, `sanitizeIntervention()` |
| `apps/siif/api/routes/modifiedUtilization.js` | GET: `lockedPeriods` and `activityData`. POST: lock enforcement, locked-removal guard, sanitizing |
| `apps/siif/web/src/hooks/useModifiedSIIFUtilization.js` | `lockedPeriods`, `activityData`, choice of starting quarter |
| `apps/siif/web/src/components/utilization/QuarterTabs.jsx` | locked state |
| `apps/siif/web/src/components/utilization/ActivityChecklist.jsx` | **new** |
| `apps/siif/web/src/components/utilization/InterventionCard.jsx` | read-only mode, checklist, remove guard |
| `apps/siif/web/src/components/utilization/SaveBar.jsx` | disabled when every quarter is locked |
| `apps/siif/web/src/pages/SIIFUtilization.jsx` | `handleUpdateActivities`, locked banner, payload, D3 validation |
| `apps/siif/web/src/constants/siifConstants.jsx` | `UTILIZATION_ACTIVITY_GROUPS` built from the existing arrays |

## 7. Verification
1. Run the seed twice. The second run changes nothing. (`siif_v2_staging` was dropped earlier, so this was a ROLLBACK dry run on v2 followed by the real run.)
2. API: with Jan–Mar locked, a POST with a Jan–Mar amount of ₱5,000 is saved **without** it and `spent_amount` doesn't change. Lock Oct–Dec; the edited Oct–Dec amount is ignored and the stored ₱500 stays. Removing `remediation` while Oct–Dec is locked returns 409.
3. Unlock and relock each key; GET `lockedPeriods` follows each change.
4. UI: a locked tab shows its data read-only. All quarters locked shows the banner and disables Save. Checking activities, saving and reloading keeps them, and the audit row contains `activities`. Check 375 px and dark mode.
5. The web build passes with no new lint errors.
