# Architectural Synthesis: School Completion Tracking System

This document outlines the finalized functional architecture of the `ph_school_completion` tracking system, which ensures accurate, real-time monitoring of school progress across the InsightEd platform.

## 1. System Objective
To decouple progress tracking from the primary `ph_schools` profile table, providing a dedicated, high-performance ledger for reporting school readiness and completion metrics without impacting profile data integrity.

## 2. Core Components

### A. Database Schema (`ph_school_completion`)
The tracking table is anchored by the permanent `iern` (Identity/Enrolment Reference Number) and synchronized with the `school_id`.
- **Primary Key:** `iern`
- **Fields:** `unit1_completion` through `unit8_completion` (Booleans)
- **Calculated Metric:** `total_completion` (Numeric percentage)
- **Metadata:** `registration_date` (Initial signup) and `updated_at` (Last activity)

### B. The 0% Initialization Logic (New Standard)
To ensure the Monitoring Dashboard reflects realistic activity, the system distinguishes between **Account Creation** and **Task Completion**:
1.  **Registration:** Creates a skeleton record in `ph_school_completion` with `total_completion = 0` and captures the `registration_date`.
2.  **Unit 1 Activation:** Progress only advances to **12.5%** once the School Head successfully saves their first form in the Unit 1 Identity module.

---

## 3. Request Lifecycle & Synchronization

### Phase 1: Identity Creation (Registration)
Two entry points are synchronized to initialize the tracking record at 0%:
- **Endpoint:** `/api/register-school` (Generic)
- **Endpoint:** `/api/register-beta` (School Head specific)
- **Action:** Atomic `INSERT` into `ph_school_completion` alongside user creation.

### Phase 2: Real-Time Progression (Saving Units)
Progress is recalculated and updated dynamically through specific hooks in the backend:

1.  **Unit 1 (Identity):** On `POST /api/ph_schools/unit1`, `unit1_completion` is set to `true`.
2.  **Unit 2 (Learners):** On `PUT /api/ph_schools/unit2/:schoolId`, `unit2_completion` is set to `true`.
3.  **Unit 3 (Classes):** On `PUT /api/ph_schools/unit3/:schoolId`, `unit3_completion` is set to `true`.
4.  **Generic Save (Units 4-8):** On `PUT /api/ph_schools/:schoolId`, the presence of a `unitId` in the request body triggers the corresponding completion flag.

### Phase 3: The Calculation Engine (`updateSchoolTotalCompletion`)
A centralized helper function ensures consistent math across the platform:
- Scans `unit1` through `unit8` flags.
- Calculates `(count / 8) * 100`.
- Syncs the result back to both the tracking table AND the legacy `ph_schools.unit_completion` column for backward compatibility with existing front-end dashboard components.

---

## 4. Maintenance & Reliability
- **Auto-Initialization:** `db_init.js` ensures table existence and schema alignment (`registration_date` & `school_id` columns) on every server restart.
- **Repair Utility:** `sync_missing.js` provides a standalone method to backfill records if any school bypasses the standard registration hooks.

---
> [!IMPORTANT]
> This architecture ensures that the Monitoring Dashboard provides an honest view of regional progress, separating "Registered Users" from "Active Contributors."
