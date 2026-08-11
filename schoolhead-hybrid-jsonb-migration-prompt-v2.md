# Implementation Prompt: SchoolHead Hybrid JSONB-First Consolidated Database Migration (v2 - SDO Validation & Remarks Edition)

## 1. Feature Summary
The goal of this task is to refactor the database initialization routines and Modular Units 1–9 endpoint handlers in the SchoolHead portal from a purely relational flat-table layout into an optimized **Hybrid JSONB-First Consolidated Schema**. This version (v2) incorporates a complete **Schools Division Office (SDO) Validation and Feedback Workflow** [user query]. SDO users can review submitted modules, transition their state between `'draft'`, `'submitted'`, `'validated'`, `'returned'`, or `'rejected'`, and attach persistent **validation remarks** for corrective action [user query]. API-layer schema validations (using Zod or Joi) and role-based route protection are introduced to guarantee transaction-level security.

## 2. Verified Facts
- **Existing Relational Modular Tables:**
  - `unit1_school_identity` — Source: `packages/shared-db/src/db_init.js`:L1442
  - `unit2_school_learners` — Source: `packages/shared-db/src/db_init.js`:L1491
  - `unit3_organized_classes` — Source: `packages/shared-db/src/db_init.js`:L916
  - `unit4_learner_profile` — Source: `packages/shared-db/src/db_init.js`:L981
  - `unit5_shifting_modality` — Source: `packages/shared-db/src/db_init.js`:L1590
  - `unit6_school_resources`, `unit6_furniture_grades`, `unit6_ecart_batches` — Source: `packages/shared-db/src/db_init.js`:L1621-1695
  - `unit7_facilities`, `ph_school_buildable_spaces`, `facility_inventory`, `facility_rooms`, `facility_repairs` — Source: `packages/shared-db/src/db_init.js`:L168-189, L748-819
  - `unit8_location` (or `school_location_profiles`) — Source: `packages/shared-db/src/db_init.js`:L226-270
- **Parent Identity Structure:** `ph_schools` hosts unique constraints on `iern` and `school_id` with timezone-aware tracking fields. — Source: `packages/shared-db/src/db_init.js`:L847
- **Workflows & Progress Sync:** Completion statuses are tied to `ph_school_completion` and validation rules in `ph_schools_validate` containing boolean values mapping modules. — Source: `packages/shared-db/src/db_init.js`:L538, L1717
- **Offline Outbox Hooks:** Client-side draft forms are queued offline in an IndexedDB buffer context (`db.js`, `sw.js`) and pushed as JSON blocks to the backend via POST/PUT actions. — Source: `apps/school-head/web/src/db.js`:L111, `apps/school-head/web/src/sw.js`:L55
- **Unit Feedback Registry:** Feedback loops utilize `UnitRemarkAlert.jsx` to fetch and render division comments, while audit tracks previously mapped details inside `audit_feedback_tasks`. — Source: `apps/school-head/web/src/components/modular/UnitRemarkAlert.jsx`:L6, `packages/shared-db/src/db_init.js`:L461
- **Role Configurations:** Roles and email permissions are categorized in `roleGroups.js` under authorized namespaces. — Source: `apps/school-head/web/src/config/roleGroups.js`:L1

## 3. Assumptions and Unknowns
### Likely
- SDO users carry distinct role groups (e.g. `'SDO'`, `'auditor'`, or `'Admin'`) that grant them authorization to update the validation states of submission cards.
- The client-side `UnitRemarkAlert.jsx` component [49] currently fetches remarks from legacy feedback tables. In the new hybrid model, it should pull `validation_remarks` directly from the `ph_school_unit_submissions` table.

### Unknown
- The exact authorization middleware identifiers for SDO role checks. We will standardise on checking if the authenticated user's role is `'SDO'`, `'Admin'`, or `'auditor'`.

---\

## 4. Affected Surfaces
| Surface | Status | Expected Role | Source |
|---|---|---|---|
| `packages/shared-db/src/db_init.js` | **Verified** | Update initial SQL triggers, schema creations, and establish the hybrid database tables, including explicit `validation_remarks` column constraints. | Domain Entity Registry |
| `apps/school-head/api/units/unit1/index.js` to `.../unit9/index.js` | **Verified** | Refactor specific route controller verbs (GET/PUT) to handle upsert workflows and validation checks. | API Endpoint Registry |
| `apps/school-head/api/units/dashboard/index.js` | **Verified** | Integrate SDO validation routes to allow division officers to update status and remarks. | API Endpoint Registry |
| `apps/school-head/web/src/components/modular/UnitRemarkAlert.jsx` | **Verified** | Pull active SDO validation remarks directly from the unified JSONB submission schema. | Shared UI components |

---\

## 5. Data Model and Contract Requirements

### Relational Schema Blueprint
Enforce the following normalized schemas during database initialization, featuring the new explicit **`validation_remarks`** and workflow fields:

```sql
CREATE TABLE IF NOT EXISTS ph_schools (
    iern TEXT PRIMARY KEY,
    school_id TEXT UNIQUE NOT NULL,
    school_name TEXT,
    region TEXT,
    division TEXT,
    district TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ph_school_unit_submissions (
    iern TEXT NOT NULL REFERENCES ph_schools(iern) ON DELETE CASCADE,
    unit_number INTEGER NOT NULL CHECK (unit_number BETWEEN 1 AND 9),

    payload JSONB NOT NULL DEFAULT '{}',

    schema_version TEXT NOT NULL DEFAULT 'v1',
    is_completed BOOLEAN DEFAULT FALSE,
    
    -- Main state machine fields
    validation_status TEXT NOT NULL DEFAULT 'draft'
        CHECK (validation_status IN ('draft', 'submitted', 'validated', 'returned', 'rejected')),
    validation_remarks TEXT,                     -- Added (v2) for SDO feedback / change requests
    
    submitted_at TIMESTAMPTZ,
    validated_by TEXT,                           -- UID or name of the SDO officer
    validated_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (iern, unit_number)
);
```

### High-Performance JSONB Indices
```sql
-- Workflow state lookup optimizations (crucial for SDO dashboards)
CREATE INDEX idx_school_unit_status ON ph_school_unit_submissions (unit_number, validation_status);
CREATE INDEX idx_school_unit_completed ON ph_school_unit_submissions (unit_number, is_completed);

-- GIN index for search coverage across arbitrary nested properties
CREATE INDEX idx_school_unit_payload_gin ON ph_school_unit_submissions USING gin (payload);

-- Targeted Expression Indexes for critical division/learner counts
CREATE INDEX idx_unit1_division ON ph_school_unit_submissions ((payload->>'division')) WHERE unit_number = 1;
CREATE INDEX idx_unit2_total_learners ON ph_school_unit_submissions (((payload->>'total_learners')::int)) WHERE unit_number = 2;
```

---\

## 6. File-by-File Implementation Plan

### `packages/shared-db/src/db_init.js`
- **Required changes:**
  - Standardize `ph_school_unit_submissions` with the explicit `validation_remarks TEXT` column [user query].
  - Create the B-Tree index on `idx_school_unit_status` to optimize real-time SDO monitoring queries.

### `apps/school-head/api/units/dashboard/index.js`
- **Required changes:**
  - Build a brand-new, secure SDO review API route: `PUT /api/schools/:iern/unit/:unit_number/validate`
  - **Security Gate:** Apply role checks (verify the requester is of group `'SDO'`, `'Admin'`, or `'auditor'`).
  - **Handler Logic:**
    ```javascript
    router.put('/api/schools/:iern/unit/:unit_number/validate', authMiddleware, async (req, res) => {
      const { iern, unit_number } = req.params;
      const { status, remarks } = req.body; // status: 'validated', 'returned', 'rejected'
      const sdoUser = req.user.name || req.user.email;

      if (!['validated', 'returned', 'rejected', 'draft'].includes(status)) {
        return res.status(400).json({ error: 'Invalid validation status value.' });
      }

      const query = `
        UPDATE ph_school_unit_submissions
        SET 
          validation_status = $1,
          validation_remarks = $2,
          validated_by = $3,
          validated_at = NOW(),
          updated_at = NOW()
        WHERE iern = $4 AND unit_number = $5
        RETURNING *;
      `;
      
      const result = await db.query(query, [status, remarks || null, sdoUser, iern, unit_number]);
      
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Submission target not found.' });
      }

      // Also trigger parent progress update triggers if status is 'validated' vs 'returned'
      res.json({ success: true, submission: result.rows[0] });
    });
    ```

### `apps/school-head/api/units/unit1/index.js` to `.../unit9/index.js`
- **Required changes:**
  - Revise the `PUT` endpoints. If a school head submits a draft or resubmits a previously returned form:
    1. Verify that `validation_status` is *not* currently `'validated'`. (Lock the form out from updates if SDO has already validated it).
    2. When resubmitted, the controller should transition `validation_status` to `'submitted'` and can optionally clear or archive old `validation_remarks` so SDO knows a correction has occurred.

### `apps/school-head/web/src/components/modular/UnitRemarkAlert.jsx`
- **Required changes:**
  - Refactor `fetchRemarks` and standard render fields. Rather than fetching tasks from legacy tables, fetch `validation_remarks` directly from `/api/ph_schools/progress/:schoolId` or `ph_school_unit_submissions` state properties.
  - Render the alert with a prominent yellow banner if `validation_status` is `'returned'` or a red banner if `'rejected'`, displaying SDO remarks directly.

---\

## 7. UI / UX Behavior
- **Validation Ban / Form Locks:** When a module's status is `'submitted'` or `'validated'`, client side forms hide inputs and save options completely, setting inputs to read-only.
- **Revision Action Items:** If status is `'returned'`, render the form in an editable draft state but header a global sticky container pointing to the SDO remarks: `"Revisions Requested by Division Office: [remarks]"`.

## 8. Backend / Persistence Behavior
- **Lock Integrity:** Backend endpoints must strictly assert:
  ```javascript
  const target = await db.query('SELECT validation_status FROM ph_school_unit_submissions WHERE iern=$1 AND unit_number=$2', [iern, unit_number]);
  if (target.rows[0]?.validation_status === 'validated') {
    return res.status(403).json({ error: 'This module is validated and locked.' });
  }
  ```

---\

## 9. Test Plan
### Verification Scenarios
1. **Validation State Transition Test:**
   - **Action:** School Head saves a draft, submits it, then SDO executes `PUT /validate` with status `'returned'` and remarks `'Please update enrollment figures for grade 3.'`.
   - **Expected result:** Submission state updates, remarks are written, and School Head's frontend rendering shows the warning banner containing the precise remark string.

2. **Access Protection Test:**
   - **Action:** A standard school head user account attempts to POST to the SDO endpoint `/api/schools/:iern/unit/:unit_number/validate`.
   - **Expected result:** Request is intercepted by role-based security and fails with HTTP 403 (Unauthorized).

---\

## 10. Acceptance Criteria
- Legacy flat modular structures are fully removed.
- `validation_remarks` is persisted safely on the database layer within `ph_school_unit_submissions`.
- SDO users can review, approve, or return any of the 1 to 9 modular sheets, inputting structured comments that render in real-time on client modules.

---\

## 11. Final AI Coding Prompt
*(Copy and paste this block into your coding assistant to trigger the changes.)*

```text
You are an expert Database Architect and Node.js Developer. Refactor the backend schema initialization and modular Unit 1-9 Express endpoint handlers in the SchoolHead portal into a Hybrid JSONB-First Consolidated Database setup that fully incorporates an SDO Validation and Feedback Remarks Workflow.

### Grounding and Code Guidelines
Only write files, schemas, and routes mapped in the active codebase. Follow standard formatting, use timezone-aware timestamps, and enforce cascading database constraints. Do not invent custom database structures outside this instruction.

### Tasks to Perform
1. Open \"packages/shared-db/src/db_init.js\". Strip legacy modular tables (unit1_school_identity up to unit8_location, including secondary grading grids and comput batches).
2. Configure the consolidated tables using these DDL constraints:
   - \"ph_schools\": Parent tracking `iern` (TEXT, PK), `school_id` (TEXT, UNIQUE), and timestamps.
   - \"ph_school_unit_submissions\": Primary key is composite `(iern, unit_number)`. Foreign key `iern` references `ph_schools(iern)` ON DELETE CASCADE.
   - Core workflow columns:
     * `validation_status` (TEXT): Must include CHECK constraint ('draft', 'submitted', 'validated', 'returned', 'rejected').
     * `validation_remarks` (TEXT): Houses SDO validation remarks and changes request feedback.
     * `validated_by` (TEXT) and `validated_at` (TIMESTAMPTZ).
3. Create performance B-Tree indices on idx_school_unit_status and composite indices, plus a GIN index on raw payloads.
4. Open \"apps/school-head/api/units/dashboard/index.js\". Establish a protected SDO submission review route:
   - Route: `PUT /api/schools/:iern/unit/:unit_number/validate`
   - Gate with role-group authentication (allow only roles 'SDO', 'Admin', or 'auditor').
   - Update `validation_status`, `validation_remarks`, and auditor meta in the database.
5. In your modular save handlers (\"unit1/index.js\" to \"unit9/index.js\"):
   - Add state checks: Reject save attempts (HTTP 403) on any module that already has a validation_status of 'validated'.
   - When a school head resubmits a 'returned' or 'rejected' module, transition the validation_status back to 'submitted' and clear or archive old validation_remarks.
6. Modify \"apps/school-head/web/src/components/modular/UnitRemarkAlert.jsx\" to pull remarks directly from \"ph_school_unit_submissions\" statuses so schools can see and resolve division requests.
```
