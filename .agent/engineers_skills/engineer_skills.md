# Skill: InsightEd Engineering Systems (Division, Architect, Regional, EFD)

## Objective
To preserve the operational workflows, technical guardrails, and historical evolution of order for the four core engineering roles in InsightEd. This documentation ensures data integrity, forensic transparency, and cross-account synchronization.

---

## 1. Role Map & Security Protocols
| Role | Normalized Role | Master Registration Key | Dashboard Route |
| :--- | :--- | :--- | :--- |
| **Division Engineer** | Division Engineer | `E5T8-B2W3` | `/engineer-dashboard` |
| **Architect** | Division Engineer | `E5T8-B2W3` | `/engineer-dashboard` |
| **Regional Engineer** | DepEd Engineer | `E5T8-B2W3` | `/regional-engineer-dashboard` |
| **EFD Engineer** | EFD Engineer | `EFD8-C1D9` | `/efd-dashboard` |

> [!IMPORTANT]
> Roles such as `HRODI`, `HRODI Engineer`, and `EFD` are automatically normalized to **EFD Engineer** for dashboard and navigation purposes.

---

## 2. Operational Workflows

### A. Division Engineer & Architect (Operational Lead)
- **Primary Task**: On-site field inspections and project milestone tracking.
- **Mandatory Photo Data**: COA requirements mandate categorized photos for EVERY update:
    - **Internal**: Structural integrity, ceiling, classroom finishings, electrical rough-ins.
    - **External**:Civil works, building facade, foundational civil works.
- **Procurement Gate**: Projects reaching "Procurement Complete" status MUST satisfy the `Procurement-First` validation gate.

### B. Regional Engineer (Regional Monitoring)
- **Primary Task**: Oversight of all divisions within their designated region.
- **Dashboard Features**:
    - **Project Monitor**: Aggregated statistics for total, ongoing, and completed projects by division.
    - **CO Approval Tracker**: Monitoring projects with "Pending CO Approval" status.
    - **Regional Analytics**: Bar charts showing progress distributions across the region.

### C. EFD Engineer (Central Administration)
- **Primary Task**: Data synchronization, master calibration, and approval of field updates.
- **Dashboard Features**:
    - **Master Dashboard**: Global view of all infrastructure projects (`EFDHome.jsx`, `EFDMonitoring.jsx`).
    - **Approval Logic**: Reviewing `Pending` updates from Division Engineers.

---

## 3. Technical Guardians (History & Blueprints)

### I. The Procurement-First Validation (April 2026)
To prevent construction starts without valid contracts, a strict validation gate was implemented in both frontend and backend.
- **Logic Rule**: If `procurement_status` == "Procurement Complete", the following fields are **MANDATORY**:
    1. `contract_id`
    2. `contractor_name`
    3. `date_notice_of_award` (NOA Date)

### II. Database Schema Evolution
- **Timezone Fix (April 11, 2026)**: All `TIMESTAMP` columns in `engineer_form` and `engineer_image` were migrated to `TIMESTAMPTZ` to resolve GMT-vs-Local time gallery discrepancies.
- **Deduplication Columns**: Added `superseded_by_id` and `archived_at` to the archive system.

### III. The Deduplication Engine (The "Magic Swap")
Forensic cleanup of thousand-record duplicates in `engineer_form` using the `Latest Survivor` protocol.

**SQL Blueprint (Redundant Record Identification):**
```sql
WITH ranked_records AS (
    SELECT 
        project_id,
        FIRST_VALUE(project_id) OVER (
            PARTITION BY school_name, project_name, school_id, region, division, status, accomplishment_percentage, ...
            ORDER BY created_at DESC, project_id DESC
        ) as survivor_id
    FROM engineer_form
)
SELECT project_id as orphan_id, survivor_id
FROM ranked_records
WHERE project_id != survivor_id;
```

---

## 4. UI Changelog (April 2026)

### IV. EFD Filter System Upgrade (April 16, 2026)
Upgraded the `FilterDrawer` component used by both `EFDHome.jsx` and `EFDMonitoring.jsx`.

**Files changed:**
- `src/components/FilterDrawer.jsx`
- `src/context/EFDFilterContext.jsx`
- `src/modules/EFDHome.jsx`
- `src/modules/EFDMonitoring.jsx`
- `api/index.js` (GET /api/projects)

**What changed:**
- Replaced pill/chip multi-select (`MultiSelectField`) with `MultiSelectDropdown` for: **Region, Project Category, Funding Year, Batch of Funds**. Each dropdown shows a badge count, Select All / Deselect All, and individual checkboxes.
- Added **Accomplishment % Range** filter: dual sliders (Min/Max) + direct number input fields with `onBlur`/`Enter` commit. Quick-select preset badges: Not Started, 1–25%, 26–50%, 51–75%, 76–99%, Completed.
- `EFDFilterContext` now stores `accomplishmentRange [0, 100]` persisted to `localStorage` key `efd_accomplishmentRange`.
- `EFDHome` filters client-side in `filteredProjects` useMemo using `acc >= range[0] && acc <= range[1]`.
- `EFDMonitoring` sends `acc_min` / `acc_max` as query params to `GET /api/projects` (server-side).
- Backend `GET /api/projects` upgraded: **year, batch, category** now support comma-separated multi-value using `ANY(ARRAY[...])` instead of single-value `ILIKE`. New `acc_min` / `acc_max` params added.

### V. EFD Monitoring Delete Button Resize (April 16, 2026)
**File changed:** `src/modules/EFDMonitoring.jsx` (card view, ~line 696)

- Removed `flex-1` width expansion and "Delete" text label
- Changed to icon-only: `p-2.5` padding, `rounded-xl`, `FiTrash2 size={14}`
- Table view delete button (line ~563) was already icon-only — left untouched.

---

## 5. Future System Guardrails (Compliance Checklist)
When modifying code for these accounts, the AI **MUST** verify:
1. **Photo Categorization**: Ensure updates are blocked if photos are not tagged as 'Internal' or 'External'.
2. **IPC Integrity**: Maintain the InsightEd Project Code (IPC) as the unique logical identifier during any data migrations.
3. **Role Normalization**: Never create ad-hoc dashboards for `hrodi_engineer`; always route to `EFD Engineer` endpoints.
4. **Timezone Preservation**: Always use `TIMESTAMPTZ` for any new project-related date columns.
