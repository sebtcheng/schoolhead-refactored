# Implementation Plan: TLM Profile Column Expansion
**Feature:** Add Personnel Division profiling fields to `third_level_officials_masterlist` and `third_level_officials_updates`  
**Source:** `[Elements] Profile of Third-Level Officials (TLM).xlsx`  
**Date:** 2026-04-22  
**Status:** PLANNING

---

## 1. Gap Analysis — What's Missing

### Current columns (both tables share these):
`tlid`, `sort_index`, `strand`, `office`, `name`, `position`, `email`, `alt_email_1`, `alt_email_2`, `contact_details`, `alt_contact_details_1`, `alt_contact_details_2`, `assignment_date`, `status`, `created_at`, `updated_at`

### Excel categories → mapping decision:

| Category | Element | Status | Column Name |
|----------|---------|--------|-------------|
| Personal Info | Last Name | ❌ NEW | `last_name` |
| Personal Info | First Name | ❌ NEW | `first_name` |
| Personal Info | Middle Name | ❌ NEW | `middle_name` |
| Personal Info | Suffix | ❌ NEW | `suffix` |
| Personal Info | Gender | ❌ NEW | `gender` |
| Personal Info | Date of Birth | ❌ NEW | `date_of_birth` |
| Personal Info | Age | ❌ NEW — auto-computed from `date_of_birth`, then stored | `age` |
| Personal Info | Civil Status | ❌ NEW | `civil_status` |
| Current Designation | Designation (e.g. OIC-ASDS) | ✅ EXISTS | `position` |
| Current Designation | Assignment (e.g. SDO Pasig City) | ✅ EXISTS | `office` |
| Current Designation | Date of Assignment | ✅ EXISTS | `assignment_date` |
| Appointment Details | Position Title (e.g. Chief Education Supervisor) | ❌ NEW | `position_title` |
| Appointment Details | Date of Present Position | ❌ NEW | `appointment_date` |
| Eligibility | EMT Passer (Yes/No) | ❌ NEW | `emt_passer` |
| Eligibility | EMT Date Passed | ❌ NEW | `emt_date` |
| Eligibility | CES Stage Completed | ❌ NEW | `ces_stage` |
| Eligibility | CES Date of Conferment | ❌ NEW | `ces_conferment_date` |
| Managerial Exp. | Previous Positions Held | ❌ NEW sub-table | `third_level_officials_prev_positions` |
| Managerial Exp. | Total Years in 3rd Level | ❌ NEW | `total_years_third_level` |
| Contact Details | Mobile Contact | ✅ EXISTS | `contact_details` |
| Contact Details | Alt Contact 1 | ✅ EXISTS | `alt_contact_details_1` |
| Contact Details | Alt Contact 2 | ✅ EXISTS | `alt_contact_details_2` |
| Contact Details | DepEd Email | ✅ EXISTS | `email` |
| Contact Details | Alt Email 1 | ✅ EXISTS | `alt_email_1` |
| Contact Details | Alt Email 2 | ✅ EXISTS | `alt_email_2` |
| Contact Details | Permanent Address | ❌ NEW | `permanent_address` |
| Educational Attainment | Highest Education | ❌ NEW | `highest_education` |
| Educational Attainment | Program | ❌ NEW | `education_program` |
| Educational Attainment | Year Graduated | ❌ NEW | `education_year_graduated` |
| Educational Attainment | Relevant Trainings | ❌ NEW sub-table | `third_level_officials_trainings` |
| Performance | Notable Achievements | ❌ NEW | `notable_achievements` |
| Performance | Latest Rating (IPCRF/OPCRF) | ❌ NEW | `performance_rating_ipcrf` |
| Performance | Latest Rating (CESPES) | ❌ NEW | `performance_rating_cespes` |
| Documents | PDS (CSC Form 212) | ❌ NEW UUID ref | `pds_binary_id` |
| Documents | Profile (Word) | ❌ NEW UUID ref | `profile_word_binary_id` |
| Documents | Profile (PPT) | ❌ NEW UUID ref | `profile_ppt_binary_id` |
| Documents | Service Records | ❌ NEW UUID ref | `service_records_binary_id` |
| Documents | 2x2 ID Picture | ❌ NEW UUID ref | `photo_binary_id` |
| Legal Status | Pending Admin Case | ❌ NEW | `pending_admin_case` |
| Legal Status | Ombudsman/Sandiganbayan Case | ❌ NEW | `ombudsman_case` |

---

## 2. Architecture Decisions

### A. Name Split Strategy
Keep `name` (full name) as-is for backward compatibility. Add `last_name`, `first_name`, `middle_name`, `suffix` as separate columns. When a profile is saved, the backend will auto-compose `name = UPPER(last_name) || ', ' || first_name || ' ' || COALESCE(middle_name, '')`.

### B. Multi-value fields → Sub-tables (not JSONB)
Two fields require multiple rows per official:
- **Previous Positions Held** → `third_level_officials_prev_positions`
- **Relevant Trainings** → `third_level_officials_trainings`

Rationale: Sub-tables allow proper querying, sorting, and individual row edits. The applications schema already uses this pattern.

### C. Documents → UUID references to `unified_binaries`
All 5 document types store a UUID pointing to the existing `unified_binaries` table. This reuses the existing binary pipeline (no new storage infrastructure).

### D. Updates table scope
The `third_level_officials_updates` ledger captures operational snapshots (designation, contact, assignment changes). Add the same flat scalar profile columns to it so each ledger snapshot is self-contained. Sub-tables (prev positions, trainings) are **NOT** duplicated in updates — they have their own `tlid` FK and are queried directly.

### E. Column ordering in the migration
PostgreSQL `ADD COLUMN` always appends. The logical grouping is enforced in the migration script's comment structure so the schema is readable. Columns will be added in this semantic order:

```
--- Personal Info ---       last_name, first_name, middle_name, suffix, gender, date_of_birth, age, civil_status
--- Appointment ---         position_title, appointment_date
--- Eligibility ---         emt_passer, emt_date, ces_stage, ces_conferment_date
--- Experience ---          total_years_third_level
--- Contact Addendum ---    permanent_address
--- Education ---           highest_education, education_program, education_year_graduated
--- Performance ---         notable_achievements, performance_rating_ipcrf, performance_rating_cespes
--- Documents ---           photo_binary_id, pds_binary_id, profile_word_binary_id, profile_ppt_binary_id, service_records_binary_id
--- Legal ---               pending_admin_case, ombudsman_case
```

---

## 3. Migration Script

**File:** `api/db/20260422_add_tlm_profile_columns.cjs`

### Phase 1 — Add columns to `third_level_officials_masterlist`
```sql
-- Personal Info
ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS middle_name TEXT;
ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS suffix TEXT;
ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS age SMALLINT;        -- auto-computed from date_of_birth on save
ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS civil_status TEXT;

-- Appointment Details
ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS position_title TEXT;
ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS appointment_date DATE;

-- Eligibility
ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS emt_passer BOOLEAN;
ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS emt_date DATE;
ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS ces_stage TEXT;
ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS ces_conferment_date DATE;

-- Managerial Experience
ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS total_years_third_level NUMERIC(5,2);

-- Contact Addendum
ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS permanent_address TEXT;

-- Educational Attainment
ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS highest_education TEXT;
ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS education_program TEXT;
ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS education_year_graduated SMALLINT;

-- Performance and Recognition
ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS notable_achievements TEXT;
ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS performance_rating_ipcrf TEXT;
ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS performance_rating_cespes TEXT;

-- Documents (UUID refs to unified_binaries)
ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS photo_binary_id UUID;
ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS pds_binary_id UUID;
ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS profile_word_binary_id UUID;
ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS profile_ppt_binary_id UUID;
ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS service_records_binary_id UUID;

-- Legal Status
ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS pending_admin_case TEXT;
ALTER TABLE third_level_officials_masterlist ADD COLUMN IF NOT EXISTS ombudsman_case TEXT;
```

### Phase 2 — Add same scalar columns to `third_level_officials_updates`
Same column list as Phase 1 (minus document UUIDs — ledger entries don't need file refs, the masterlist holds those). Legal status also excluded from ledger (sensitive, not tracked in history).

```sql
-- Personal Info
ALTER TABLE third_level_officials_updates ADD COLUMN IF NOT EXISTS last_name TEXT;
... (same pattern for first_name, middle_name, suffix, gender, date_of_birth, age, civil_status)

-- Appointment
ALTER TABLE third_level_officials_updates ADD COLUMN IF NOT EXISTS position_title TEXT;
ALTER TABLE third_level_officials_updates ADD COLUMN IF NOT EXISTS appointment_date DATE;

-- Eligibility
ALTER TABLE third_level_officials_updates ADD COLUMN IF NOT EXISTS emt_passer BOOLEAN;
ALTER TABLE third_level_officials_updates ADD COLUMN IF NOT EXISTS emt_date DATE;
ALTER TABLE third_level_officials_updates ADD COLUMN IF NOT EXISTS ces_stage TEXT;
ALTER TABLE third_level_officials_updates ADD COLUMN IF NOT EXISTS ces_conferment_date DATE;

-- Experience / Contact / Education / Performance (same as masterlist scalars)
```

### Phase 3 — Create sub-tables

```sql
-- Previous Positions Held
CREATE TABLE IF NOT EXISTS third_level_officials_prev_positions (
  position_id   SERIAL PRIMARY KEY,
  tlid          TEXT NOT NULL REFERENCES third_level_officials_masterlist(tlid) ON DELETE CASCADE,
  position_name TEXT NOT NULL,
  office        TEXT,
  start_date    DATE,
  end_date      DATE,         -- NULL = current/ongoing
  is_oic        BOOLEAN DEFAULT FALSE,
  sort_order    INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tlpp_tlid ON third_level_officials_prev_positions(tlid);

-- Relevant Trainings
CREATE TABLE IF NOT EXISTS third_level_officials_trainings (
  training_id    SERIAL PRIMARY KEY,
  tlid           TEXT NOT NULL REFERENCES third_level_officials_masterlist(tlid) ON DELETE CASCADE,
  training_name  TEXT NOT NULL,
  date_completed DATE,
  sort_order     INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tltr_tlid ON third_level_officials_trainings(tlid);
```

---

## 4. Backend API Changes (`api/index.js`)

### New routes to add:

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/third-level/:tlid/profile` | Fetch full profile (masterlist + sub-tables) |
| `PUT` | `/api/third-level/:tlid/profile` | Update profile scalars |
| `POST` | `/api/third-level/:tlid/prev-positions` | Add a previous position row |
| `DELETE` | `/api/third-level/prev-positions/:id` | Remove a previous position |
| `POST` | `/api/third-level/:tlid/trainings` | Add a training row |
| `DELETE` | `/api/third-level/trainings/:id` | Remove a training |
| `POST` | `/api/third-level/:tlid/documents/:docType` | Upload a document via binaryPipeline |

### `db_init.js` boot migration
Add the Phase 1-3 DDL as an idempotent `initTLMProfileSchema()` function called at boot (following the existing `ADD COLUMN IF NOT EXISTS` pattern).

---

## 5. Frontend Changes (`src/modules/ThirdLevelDirectory.jsx`)

### Profile modal expansion
The existing `showProfileModal` should grow into a **tabbed detail panel** with these tabs:

| Tab | Fields |
|-----|--------|
| Overview | name split, gender, DOB + age (auto-computed from DOB, displayed as read-only, stored on save), civil status |
| Designation | position, position_title, assignment, assignment_date, appointment_date |
| Eligibility | EMT passer toggle + date, CES stage dropdown + conferment date |
| Experience | total_years_third_level + dynamic table for prev_positions |
| Contact | all contact fields + permanent_address |
| Education | highest_education (dropdown), program, year_graduated + trainings list |
| Performance | notable_achievements, ipcrf rating, cespes rating |
| Documents | upload cards for PDS, Profile-Word, Profile-PPT, Service Records, Photo |
| Legal | pending_admin_case, ombudsman_case (gated: sensitive fields, shown only to admin roles) |

### Dropdowns (from Excel suggestions):
- **Civil Status:** Single, Married, Widowed, Separated
- **Designation:** RD, ARD, SDS, ASDS, OIC-ARD, OIC-SDS, OIC-ASDS
- **CES Stage:** Stage 1 (CES Written Exam), Stage 2 (Assessment Center), Stage 3 (Performance Validation), Stage 4 (Board Interview), CES Eligible, CESO VI, CESO V, CESO IV, CESO III, CESO II, CESO I
- **Highest Education:** Post-Doctoral Studies, Doctorate Degree, Master's Degree, Bachelor's Degree

---

## 6. Execution Checklist

- [ ] **Step 1 — DB Migration:** Write and run `api/db/20260422_add_tlm_profile_columns.cjs`
- [ ] **Step 2 — Sub-tables:** Included in same migration script, Phase 3
- [ ] **Step 3 — Boot init:** Add `initTLMProfileSchema()` to `api/db_init.js`
- [ ] **Step 4 — Backend routes:** Add GET/PUT profile + sub-table CRUD in `api/index.js`
- [ ] **Step 5 — Document upload route:** Wire `binaryPipeline` for each document type
- [ ] **Step 6 — Frontend UI:** Expand `ThirdLevelDirectory.jsx` profile modal into tabs
- [ ] **Step 7 — Verify:** Confirm all new columns in DB, test profile save/fetch round-trip

---

## 7. What Is NOT in Scope (Intentionally Deferred)

- **Age auto-compute:** Frontend computes `age = today.year - date_of_birth.year` (with birthday boundary check) when `date_of_birth` is entered or changed, then writes both `date_of_birth` and `age` to the DB together on save. The backend also recalculates `age` server-side before INSERT/UPDATE as the single source of truth.
- **Application flow:** The separate `third_level_officials_applications` schema (created 2026-04-22) handles applicants. This plan is for **existing officials only**.
- **Name backfill:** Existing `name` records won't be auto-split into first/last/middle. The form just captures new data going forward.
