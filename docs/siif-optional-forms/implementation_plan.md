# Implementation Plan: Restore the SIIF Forms tab (optional, no deadline)

**Branch:** `modified-siif-utilization-tool` (create `feature/siif-optional-forms` off it)
**Reference branch:** `klein-feature-siif-sh` (last state with the Forms tab)
**Target DB:** `siif_database_v2` (`SIIF_DATABASE_URL` in `.env`)
**Date:** 2026-10-09

---

## 1. Goal

Bring the **Forms** tab back to the School Head SIIF module as an **optional** way to submit a SIIF plan:

- For schools whose plan was lost in the 2026-09-18 wipe (the backup is from 2026-09-11) and for schools that never submitted.
- No deadline. Not required. It does **not** gate or feed the Utilization tool, which stays independent.
- Plans read from and write to `siif_database_v2`.
- Later analysis: **planned interventions (Forms) vs actual spending (Utilization)**.

## 2. What I found

### 2.1 Code: most of the Forms feature still exists in this branch
`SIIFFormsHub.jsx`, `SIIFSummary.jsx`, `pages/cards/*`, `useSIIFSubmission.js`, `routes/submission.js` and `submitPlan()` are all still here. Only the **route** and the **nav item** were removed:

| File | Change vs `klein-feature-siif-sh` |
|---|---|
| `apps/siif/web/src/SIIFModule.jsx` | `forms` route removed |
| `apps/siif/web/src/components/BottomNav.jsx` | `Forms` nav item removed (desktop and mobile) |

So the reference branch is useful for **diffing only**. We will not merge it, because that would undo the Utilization and Dashboard work.

### 2.2 Code bug that already existed: the Summary / final-submit page has no route
`SIIFFormsHub` "Review & Submit" calls `navigate('/siif/summary')`. `SIIFSummary.jsx` holds the actual **Submit** button. But neither branch registers a `summary` route: it was lost in the refactor (`b49414e`). Today that link falls through to the Dashboard.

### 2.3 Deadline blocks every save
`settings.siif_form_end = 2026-09-11T23:00:00+08:00`. This is enforced in two places:
- **Server:** `POST /siif/submit` returns **403 "Submission Window Closed"** (`routes/submission.js:298-314`).
- **Client:** `isExpired` makes the whole form read-only (`SIIFFormsHub.jsx`, `useSIIFSubmission.js`).

Only the SIIF API reads `siif_form_end` / `siif_form_start` (checked with grep).

### 2.4 🔴 BLOCKER: the restored `siif_database_v2` tables lost their schema
The backup was restored as raw data (pandas-style). The SIIF tables have **no primary keys, no sequences or defaults, no indexes, and no unique constraints**:

| Table | Problem | Effect |
|---|---|---|
| `siif_submissions.siif_sub_id` | `bigint`, no default | `INSERT ... RETURNING siif_sub_id` returns **NULL**, so a new school's interventions get linked to NULL |
| `siif_interventions.siif_int_id` | `bigint`, no default | Same: beneficiaries and activities get orphaned |
| `siif_beneficiaries`, `siif_activities`, `siif_utilization` ids | No defaults | NULL ids |
| `siif_submissions (school_id, fiscal_year)` | No unique constraint | Duplicates are possible. **One exists already:** school `115195` has `submitted` + `draft` |
| All SIIF tables | **0 indexes** | `GET /submission` sequential-scans 102k interventions. `db_init.js` has `CREATE INDEX IF NOT EXISTS` but it never ran against v2 |

Good news: all tables are `relpersistence = 'p'` in the default tablespace. **They are not temporary**, so the cause of the 09-18 wipe does not apply to them.

⚠️ The `trg_prevent_deletion_*` / `trg_block_truncate_*` triggers and the RLS `no_delete` policies **do not exist** on v2. The deletion lock described in `.agent/*.md` is not active for this database.

### 2.5 🔴 BLOCKER: column types changed during the restore

| Column | Was (expected by code) | Is now | Sample | Effect |
|---|---|---|---|---|
| `priority_improvement_area` | JSON array | `text`, **Python repr** | `"['[Access and Quality] IO3: ...', '...']"` | Frontend calls `.filter()` on a string, so **the Forms page crashes on hydrate** |
| `aral_sub_counts` | JSON object | `text`, Python repr | `"{'Others': '15', 'Mathematics': '13'}"` | ARAL counts don't parse |
| `aral_subjects` | array | `text` | — | Same |
| `has_aral` | boolean | `bigint` (102,405 × `0`, 1 × NULL, **zero `1`s**) | `"0"` | Writing JS `true` fails: `invalid input for type bigint`. ⚠️ No school has ARAL = yes, which suggests the restore may have lost those values |
| `for_revision` | boolean | `bigint` | `"0"` / `"1"` | `'0' ?? false` evaluates to `'0'`, which is truthy, so **every school would show "For Revision"** |
| `submitted_at`, `created_at`, `updated_at` | timestamptz | `text` | `'2026-09-10 01:30:14.066'` | Readable, but the timezone is lost and sorting is lexical |

### 2.6 Data snapshot (FY 2026, `siif_database_v2`)
- 34,877 submissions: 21,879 `Reviewed`, 7,006 `submitted`/`Submitted`, 811 `For Revision`, 5,181 `draft`
- 43,349 schools have an allocation; **8,824 of them have no plan row at all**. These are the main audience for the optional form.
- The newest `updated_at` is `2026-09-11 02:05`, which matches the backup date.
- Status casing is inconsistent (`submitted` vs `Submitted`).

### 2.7 Security note
`packages/shared-db/src/db.js:140` and the other pool definitions **hardcode the prod admin password** as a fallback. The SIIF fallback also points at **`siif_database` (v1)**, not v2. If `.env` is missing, the app silently writes to the old DB.

---

## 3. Design decisions

### D1: How to lift the deadline (needs your decision)
| Option | How | Pros | Cons |
|---|---|---|---|
| **A. Settings flag (recommended)** | New key `settings.siif_form_optional = 'true'`. The server and client skip the **end-date** check when it is set. The start-date check stays. | Admin can turn it on or off without a deploy. History (`siif_form_end`) is kept. Clear meaning. | Small code change in 3 places |
| B. Clear the deadline | `UPDATE settings SET value = NULL WHERE key = 'siif_form_end'` | No code change | The admin `PUT /settings/deadline` can bring the lock back by accident. Loses the record of the original window |

### D2: Which plans can be edited
| Status | Behaviour in the optional form |
|---|---|
| No row (8,824 schools) | Blank form → draft → submit |
| `draft` (5,181) | Continue editing the restored draft |
| `submitted` / `Submitted` | Read-only by default, with an **"Edit plan"** action that reopens it (status → `draft` until resubmitted). *Needs confirmation.* |
| `For Revision` | Editable (unchanged) |
| `Reviewed` (21,879) | **Read-only** (unchanged): the division already reviewed it |

### D3: Fixing the legacy data formats
- **Read path (required):** a tolerant parser in the API turns Python-repr / JSON / Postgres-array text into proper arrays and objects. `has_aral` and `for_revision` are coerced to real booleans. This changes **no stored data**.
- **Write path:** write proper JSON text going forward. Write `has_aral` / `for_revision` as `1`/`0`. Column types stay as they are, which respects the **Schema Lock rule**.
- One-time normalisation of stored rows: **optional, later**, and only after a backup snapshot.

### D4: Independence from Utilization
- Forms writes only to `siif_submissions`, `siif_interventions`, `siif_beneficiaries` and `siif_activities`.
- Utilization stays on `modified_siif_utilization`, so there is no coupling.
- In the Forms UI: an "**Optional**" badge plus a banner: *"For schools whose plan was lost on Sep 18 or not yet submitted. This does not affect your Utilization."*

---

## 4. Execution phases

### Phase 0: Safety net (before touching anything)
1. Take a `pg_dump` (schema and data) of the 8 `siif_*` tables plus `settings` from `siif_database_v2`, and store it off-server.
2. Ask ICT to confirm in writing that v2 is **not** on a temporary tablespace/storage and that **PITR / automated backups are on** for the Azure Flexible Server.

### Phase 1: DB schema repair (idempotent migration, `apps/siif/api/sql/siif_v2_schema_repair.sql`)
Expand-only. No drops, no renames, no type changes.
1. Fix the duplicate first: school `115195` has 2 rows. **You decide** which to keep (probably `submitted`). The other is moved to its own archive, not deleted.
2. For each id column (`siif_sub_id`, `siif_int_id`, `siif_ben_id`, `siif_act_id`, `siif_util_id`):
   `CREATE SEQUENCE IF NOT EXISTS …` → `setval(max(id))` → `ALTER COLUMN SET DEFAULT nextval(…)` → `SET NOT NULL` → `ADD PRIMARY KEY`.
3. `ADD CONSTRAINT uq_siif_sub_school_fy UNIQUE (school_id, fiscal_year)`.
4. Indexes: the 6 already listed in `db_init.js`.
5. Pre-flight checks inside the script: abort if any id is NULL or duplicated.
6. Run it on a **staging copy** first, then prod during low traffic.

### Phase 2: Backend (`apps/siif/api`)
1. `helpers/parseLegacy.js`: `parseList()`, `parseObject()`, `toBool()`. These handle JSON, Python repr (`'` → `"`, `True/False/None`), `{a,b}` arrays, and plain strings.
2. `routes/submission.js` **GET**: apply the parsers to `priority_improvement_area`, `aral_subjects`, `aral_sub_counts`, `has_aral` and `for_revision`. Normalise the `status` casing in the response.
3. `routes/submission.js` **POST /submit**:
   - Skip the end-date lock when `siif_form_optional = 'true'` (D1-A).
   - Write `has_aral` as `1`/`0`, `aral_subjects` / `aral_sub_counts` as JSON text.
   - Use `INSERT … ON CONFLICT (school_id, fiscal_year)` as a race guard (needs the Phase 1 unique constraint).
   - Bust the `siif_sub_*` cache after save (verify `cacheDel` is called).
4. `routes/settings.js` GET `/settings/deadline`: also return `optional: true|false`.
5. `packages/shared-db/src/db.js`: point the SIIF fallback at **v2**, or better, **fail fast** if `SIIF_DATABASE_URL` is missing. Remove the hardcoded credentials (and rotate that password with ICT).

### Phase 3: Frontend (`apps/siif/web`)
1. `SIIFModule.jsx`: add `forms` and `summary` routes.
2. `BottomNav.jsx`: add the **Forms** item with the `TbClipboardList` icon and an "Optional" label.
   - Desktop: Dashboard · Forms · Nexus · Utilization · Settings.
   - Mobile: 6 items will not fit. Proposal: `Dashboard · Forms · [Nexus] · Utilization · Settings`, with Sign Out moved into Settings. Or keep 5 slots and put Forms inside a Dashboard card. *(Your preference, see §6.)*
3. `useSIIFSubmission.js` / `useSIIFDeadline.js`: when `optional` is true, set `isExpired = false`. Read `for_revision` as a boolean.
4. `SIIFFormsHub.jsx`:
   - Fix `navigate('/siif')` → `/siif/dashboard`.
   - Add the Optional banner (D4).
   - Remove the deadline countdown UI when optional.
5. `SIIFSummary.jsx`: after submit, `navigate('/siif/forms')` with a success toast, not the Dashboard.
6. Optional: a small Dashboard card, "Your SIIF Plan: Submitted / Draft / Not submitted (optional)", that links to Forms.

### Phase 4: Verify
1. `pnpm build` for `apps/siif/web` and the school-head app.
2. Run the API locally against a **staging copy** of v2 and test these scenarios:
   - School with no row → draft → submit. Check that every id is non-NULL and the children are linked.
   - Restored `draft` school → form hydrates (PIA list renders, no crash) → submit.
   - `Reviewed` school → read-only.
   - `For Revision` school, and `for_revision = 0` school → the banner shows only for the right one.
   - Concurrent double-submit → no duplicate rows.
   - Utilization save still works and is unaffected.
3. Check mobile layout at 360px.

### Phase 5 (later): Planned vs Actual analysis
- View `v_siif_plan_vs_actual`: for each school and intervention, join the planned `siif_interventions.budget_estimate` with the actual spend from `modified_siif_utilization`.
- Flag each row as *planned & used* / *planned not used* / *used not planned* / *no plan submitted*.
- Feeds a Dashboard / RO report. It will be scoped separately once Forms is live.

---

## 5. Risks

| Risk | Mitigation |
|---|---|
| Schema DDL on a live prod DB | Idempotent script, pre-flight checks, staging first, off-hours, a dump beforehand |
| Legacy formats we haven't seen yet | The parser falls back to raw text and never throws. Log unparsed samples |
| `has_aral` values may have been lost in the restore | Compare against the 09-11 backup source / old `siif_database` if it still exists |
| Fiscal year is hardcoded to `new Date().getFullYear()` | Forms would show an empty plan from 2027-01-01. Tie it to `siif_allocations.fiscal_year` or a settings key (follow-up) |
| Division review dashboards (`vw_siif_division_*`) parse the same retyped columns | Out of scope. Flag them to whoever owns the RO module |

## 6. Decisions (2026-10-09)
1. **D1: Option B.** Clear `siif_form_end` (set it to NULL). The client and server already treat a NULL deadline as "no lock". Also stop the admin `PUT /settings/deadline` from bringing the lock back by accident (it should only be set on purpose).
2. **D2: As proposed.** Reviewed stays read-only. Submitted can be reopened through "Edit plan". Draft and For Revision are editable.
3. **Duplicate `115195`:** keep the `submitted` row and archive the `draft`.
4. **Mobile nav:** move Sign Out into Settings. Nav becomes Dashboard · Forms · [Nexus] · Utilization · Settings.
5. **DB connection:** **no fallback.** `poolSiif` uses only `SIIF_DATABASE_URL` (must be `siif_database_v2`) and the API refuses to start if it is missing. Remove the hardcoded credentials.
6. **Phase 1 DB repair:** *pending.* You want a fuller explanation before approving.

Note (checked 2026-10-09): the original `siif_database` (v1) still has a catalog entry, but its storage is gone (`pg_tblspc/16386/... is missing`). It was created in tablespace `temptblspace` (oid 16386, `/mnt/pg_tmp`, the server's temporary disk). `cloud_database`, `dpa_database` and `gmis_items` were created there too. `siif_database_v2` and every object in it are on `pg_default`. `default_tablespace` is empty, so new tables also go to `pg_default`. v2 is the only live copy.
