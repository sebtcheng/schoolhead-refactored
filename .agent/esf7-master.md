# ESF7 Master Workflow: Technical Implementation Guide

This document defines the high-integrity process for the **Personnel Services Itemization (ESF7)** module in InsightEd. It covers the end-to-end lifecycle from School Head submission to SDO verification.

## 1. Architectural Overview

The process follows a **Staging-and-Commit** pattern to ensure data integrity during the audit phase.

- **Staging Table (`esf7_staging`)**: Holds "draft" records during the SDO review period.
- **Production Table (`esf7_database`)**: Holds the final, verified records after SDO commit.
- **Progress Tracking**:
  - `0.5` (50%): Staged / Pending Audit.
  - `1.0` (100%): Verified / Committed to Database.

---

## 2. Phase 1: Submission & Staging (`ESF7Draft.jsx`)

### User Experience

School Heads can choose between two upload methods:

1.  **Direct Upload**: Local parsing of `.xlsb` or `.xlsx` files using `SheetJS` (XLSX). It targets the hidden technical sheet `DB_USER`.
2.  **Cloud Link**: Extraction of Google Drive hosted files via the backend extraction service.

### Technical Flow

1.  **Parsing**: The hidden `DB_USER` sheet is filtered and mapped to JSON objects.
2.  **API Call (`/api/esf7/stage`)**: Sent as a POST request with the records array.
3.  **Backend Logic**:
    - **Schema Hardening**: Ensures `ESF7_Staging` exists as a replica of the database.
    - **Cleanup**: Deletes any previous staging or database records for that school to prevent partial duplicates.
    - **Batch Ingestion**: Rows are normalized (lowercased keys, sanitized column names) and inserted into `ESF7_Staging`.
    - **Status Update**: `ph_schools.unit7` is set to `0.5` and `unit7_completed` to `false`.

---

## 3. Phase 2: Audit & Review (`ESF7Review.jsx`)

### Access Controls

- **Auditors**: Must have the `School Division Office` role and belong to the `SGOD` office.
- **Scoping**: Auditors only see schools within their assigned division.

### Auditor Actions

- **Records Preview**: Fetches data from `/api/esf7/records/:school_id` (fallback logic checks staging first, then database).
- **Download for Audit**: Generates a clean Excel file from live staging data for offline verification.
- **Verify & Commit**: Finalizes the data.
- **Return (Reject)**: Returns the module to the school for corrections.

---

## 4. Phase 3: Commitment & Migration (`api/index.js`)

### Approval Logic (`/api/esf7/approve`)

1.  **Validation**: Ensures staging records exist for the `school_id`.
2.  **Column Discovery**: Dynamically queries the database schema to find all valid columns (excluding internal IDs).
3.  **Migration**:
    - Executes a `DELETE` on any existing production records for the school.
    - Executes `INSERT INTO ... SELECT` to move data from `ESF7_Staging` to `ESF7_Database` with a `VERIFIED` status.
4.  **Finalization**:
    - Purges staging data.
    - Sets `ph_schools.unit7 = 1.0` and `unit7_completed = true`.
    - Triggers `updateSchoolTotalCompletion` to recalculate the global progress.

### Rejection Logic (`/api/esf7/reject`)

- **Action**: Resets the school's unit status to `NOT_STARTED` or `REJECTED`.
- **Result**: Unlocks the `ESF7Draft` component for the school head to allow a new upload.

---

## 5. Metadata Tracking (Recent Update)

The following columns have been added to track the audit timeline:

- `school_name`: Captured in both staging and production for readable reporting.
- `uploaded_at`: Precision timestamp when the school head staged the file.
- `approved_at`: Precision timestamp when the auditor committed the data.

---

_Maintained by Antigravity AI — Last Updated: 2026-04-16_
