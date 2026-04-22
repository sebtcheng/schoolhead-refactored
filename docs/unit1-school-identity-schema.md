# Unit 1: School Identity — Database Schema Reference

**Table:** `ph_schools`  
**Source:** `api/db_init.js` — migration block lines 1113–1163  
**Description:** Captures the core identity, location, leadership, and ownership information for each Philippine DepEd school. Completed by the School Head during initial data collection.

---

## Table Identity (Base Columns)

These columns are created with the table itself and are shared across all units.

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `iern` | `TEXT` | — | **Primary Key.** Integrated Education Reference Number — the national unique identifier for the school. |
| `school_id` | `TEXT` | — | Unique secondary identifier. Used as the login key for School Head accounts. |
| `created_at` | `TIMESTAMPTZ` | `CURRENT_TIMESTAMP` | Record creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | `CURRENT_TIMESTAMP` | Last record update timestamp. |

---

## School Location

Geographic and administrative placement of the school within the Philippine administrative hierarchy.

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `region` | `TEXT` | — | DepEd region (e.g., `Region IV-A`). |
| `province` | `TEXT` | — | Province name. |
| `municipality` | `TEXT` | — | Municipality or city name. |
| `barangay` | `TEXT` | — | Barangay (village) where the school is located. |
| `division` | `TEXT` | — | Schools Division Office (SDO) that supervises the school. |
| `district` | `TEXT` | — | Congressional or school district. |
| `leg_district` | `TEXT` | — | Legislative district number. |
| `latitude` | `TEXT` | — | GPS latitude coordinate (stored as text to preserve precision). |
| `longitude` | `TEXT` | — | GPS longitude coordinate (stored as text to preserve precision). |

---

## School Profile

Core descriptive attributes of the school as an institution.

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `school_name` | `TEXT` | — | Full official name of the school. |
| `school_type` | `TEXT` | — | Classification: `Regular`, `Extension`, `Annex`, etc. |
| `curricular_offering` | `TEXT` | — | Normalized offering level: `Elementary`, `Secondary`, `Integrated`, etc. Processed via `normalizeOffering()`. |
| `established_month` | `TEXT` | — | Month the school was established. |
| `established_year` | `TEXT` | — | Year the school was established. |
| `mother_school_id` | `TEXT` | — | `school_id` of the parent/mother school (for Extension and Annex types). |
| `extension_mother_school_name` | `TEXT` | — | Display name of the mother school, captured at the time of form submission. |

---

## School Head Information

Details about the designated School Head at the time of submission.

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `school_head` | `TEXT` | — | Full name of the School Head (legacy composite field). |
| `contact_number` | `TEXT` | — | School Head's contact number. |
| `head_first_name` | `TEXT` | — | School Head's given name. |
| `head_middle_name` | `TEXT` | — | School Head's middle name. |
| `head_last_name` | `TEXT` | — | School Head's surname. |
| `head_sex` | `TEXT` | — | School Head's sex (`Male` / `Female`). |
| `head_position_title` | `TEXT` | — | Official position title (e.g., `Principal I`, `Teacher-in-Charge`). |
| `head_date_of_birth` | `TEXT` | — | School Head's date of birth (ISO date string). |
| `head_date_hired` | `TEXT` | — | Date the School Head was hired into service. Composed from `head_hired_month`, `head_hired_day`, `head_hired_year` in the form (UI-only fields, not stored separately). |

---

## Ownership & Documents

Land/property ownership classification and supporting document metadata.

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `ownership` | `TEXT` | — | Primary ownership type (e.g., `Owned`, `Leased`, `Government`). May represent a comma-delimited list when multiple types apply. |
| `ownership_document_path` | `TEXT` | — | Azure Blob Storage path for the uploaded ownership document. |
| `ownership_document_type` | `TEXT` | — | Document category (e.g., `TCT`, `Deed of Donation`, `MOA`). |
| `ownership_na_reason` | `TEXT` | — | Reason provided when ownership documentation is not available/applicable. |
| `google_drive_link` | `TEXT` | — | Public Google Drive share link for the ownership document (alternative upload path). |
| `google_drive_file_id` | `TEXT` | — | Extracted Google Drive file ID parsed from `google_drive_link`. |
| `google_drive_file_name` | `TEXT` | — | Filename as reported by Google Drive API. |
| `google_drive_thumbnail_url` | `TEXT` | — | Thumbnail preview URL returned by the Google Drive API. |

---

## Unit Completion Tracking

Flags and timestamps used by the dashboard and sync pipeline to track Unit 1 progress.

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `unit1` | `INTEGER` | `0` | Completion score / progress counter for Unit 1. Incremented as steps are saved. |
| `unit1_completed` | `BOOLEAN` | `FALSE` | `TRUE` when the School Head has fully submitted Unit 1. |
| `unit1_updated_at` | `TIMESTAMPTZ` | — | Timestamp of the most recent Unit 1 save. |
| `submitted_by` | `TEXT` | — | `user_id` or email of the account that last submitted Unit 1 data. Shared across units; last-writer wins. |
| `verified_as_of` | `TIMESTAMPTZ` | — | Timestamp set when a Super User or Admin verifies/audits the school's Unit 1 data. |

---

## Form-Only Fields (Not Persisted as Separate Columns)

These fields exist in the `Unit1SchoolIdentity.jsx` form state but are **not** stored as independent database columns.

| Form Field | Purpose |
|------------|---------|
| `head_hired_month` | UI helper — combined with `head_hired_day` and `head_hired_year` to build `head_date_hired` before saving. |
| `head_hired_day` | UI helper — see above. |
| `head_hired_year` | UI helper — see above. |
| `ownership_multiple` | Array of selected ownership types in the multi-select UI — serialized into the `ownership` text column on save. |
| `ownership_document_multiple` | Array of locally queued document uploads — resolved to `ownership_document_path` / `google_drive_*` columns after upload. |
| `annex_details` | Structured list of annex school entries — managed client-side; not a standalone DB column. |
| `local_file_path` | Temporary local file URI for offline document queue — not persisted to `ph_schools`. |
| `local_file_name` | Temporary local file name for offline document queue. |
| `local_file_size` | Temporary local file size for offline document queue. |
| `ownership_doc_id` | Foreign key reference to `unified_binaries.id` — used to link the document after upload, not stored on `ph_schools` directly. |
