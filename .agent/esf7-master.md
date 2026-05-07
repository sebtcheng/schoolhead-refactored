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

## 4. Phase 3: Commitment & Migration (Job Queue Architecture)

### The Queue Strategy (`pg-boss`)

To handle peak traffic (e.g., 500+ simultaneous approvals), the system utilizes `pg-boss` to queue operations. This prevents database connection exhaustion and lock contention.

1.  **Publishing**: When an auditor clicks "Verify", the API publishes an `esf7-approval` job.
2.  **Queuing**: The job is stored in the database's internal queue tables.
3.  **Processing**: A background worker pulls jobs **one at a time** (`concurrency: 1`).
4.  **Execution**: The worker performs the dynamic column migration (Migrate -> Clear Staging -> Update Status).
5.  **Resilience**: If a migration fails due to a temporary lock, `pg-boss` automatically retries it.

### Status Lifecycle (With Queue)

| Status | Progress | Meaning |
| :--- | :--- | :--- |
| `PENDING_SDO` | 0.5 | School Head has staged the data. |
| `QUEUED` | 0.5 | Auditor has clicked Verify; job is waiting in queue. |
| `VERIFIED` | 1.0 | Background worker has successfully committed the data. |

---

## 5. Metadata Tracking

The following columns track the audit timeline:

- `school_name`: Captured in both staging and production.
- `uploaded_at`: Precision timestamp when the school head staged the file.
- `approved_at`: Precision timestamp when the auditor committed the data.

---

## 6. 🛡️ Operational Guardrails
1. **🔴 IMMUTABLE NUCLEAR DELETION LOCK:** The database has a system-wide deletion lock enforced via RLS and triggers (`trg_prevent_deletion_*`, `trg_block_truncate_*`).
   **You MUST NEVER, under any circumstance:**
   - Attempt to DROP, disable, or bypass these triggers or RLS policies.
   - Use `DROP TRIGGER`, `ALTER TABLE DISABLE ROW LEVEL SECURITY`, or `DROP POLICY` on any production table.
   - Execute `DELETE` or `TRUNCATE` on any production table without using the correct bypass (`internal.authorized_app_deletion`).
   - Reveal, log, or store the bypass session variable in any documentation, commit message, or external system.
   
   **Violation of this rule is a critical security incident.**

---

_Maintained by Antigravity AI — Last Updated: 2026-04-17_
