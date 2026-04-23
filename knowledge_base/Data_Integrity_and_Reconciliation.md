# Data Integrity & Reconciliation: The Nerve Center

This document serves as the **Data Dictionary and Reconciliation Ledger** for all school and project data elements in the InsightEd ecosystem.

## 1. Modular Reporting Schema (Units 1-10)
InsightEd data collection is segmented into 10 fundamental units:
1.  **Identity & Profile**: Core school registry, location (IERN), leadership, and ownership records.
2.  **Learners**: Enrolment counts (Kinder to G12), multigrade configurations, and SNED/ARAL participation.
3.  **Organized Classes**: Section counts and class size distribution.
4.  **Learner Profile**: IP, Muslim, 4Ps demographics, and BMI/Nutritional status.
5.  **Shifting & Modality**: Double/triple shifting logs and distance learning (ADM) trackers.
6.  **Teaching Personnel**: Instructional roster, specialization, funding sources, and teaching loads.
7.  **School Resources**: Inventory of classrooms, ICT (Laptops/TVs), WASH (Water/Toilets), and Utilities.
8.  **Physical Facilities**: Building structural registry, room dimensions, and repair assessments.
9.  **Geography & Safety**: Hazardous terrain metrics, road accessibility, and calamity history.
10. **Verification**: Final attestations and contextual remarks before submission.

## 2. Infrastructure & Project Data (`engineer_form`)
Infrastructure tracking relies on strict field protocols:
- **Project IDs**: Unique identifiers for construction/repair projects.
- **Accomplishment %**: Real-time progress metric (0-100).
- **IPC (Internal Project Code)**: The primary link for reconciling active forms with the master BEFF registry.
- **Evidentiary Photos**: Categorized as Internal, External, or Defect.

## 3. Completion Tracking Ledger (`ph_school_completion`)
To provide an honest view of regional progress, tracking is decoupled from profile tables.
- **Initialization**: A record is created at 0% upon signup.
- **Progression**: Automatic updates trigger as each modular unit is successfully saved.
- **Syncing**: The `updateSchoolTotalCompletion` engine ensures 100% parity between the ledger and the dashboard.

**Schema Invariant (Critical):** The table uses `iern` as its `PRIMARY KEY` and `school_id` as a secondary unique key. All unit completion upserts use `ON CONFLICT (school_id)`, which requires a **full (non-partial) unique index** on `school_id`. The correct index is:
```sql
CREATE UNIQUE INDEX idx_ph_school_completion_school_id ON ph_school_completion(school_id);
```
A partial index (`WHERE school_id IS NOT NULL`) is **not sufficient** — PostgreSQL's unqualified `ON CONFLICT (school_id)` will reject it. This constraint is enforced idempotently at server startup in `api/db_init.js`. See [Historical Traceability](./Historical_Traceability_and_Maintenance.md) RCA for the 2026-04-23 incident.

## 4. Forensic Reconciliation & PIVOT Logic
- **Database Consolidation**: Inactive records are archived into `engineer_dump`, while all active official projects are consolidated in `engineer_form`.
- **IPC Realignment**: Historical identifiers (e.g., `INF-10`) are realigned to match official BEFF masterlists based on School ID, Funding Year, and Budget.
- **Schema Normalization**: All location and offering fields are passed through `normalizeOffering` and `normalizeLocationField` helpers to eliminate encoding artifacts.

---
*Consolidated from: `data_elements.md`, `data_variables_catalog.md`, `unit1-10-schema.md`, `ADR-011`, and `school_completion_synthesis.md`.*
