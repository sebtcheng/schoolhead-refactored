# Implementation Prompt: Resolve schools_IERN Relation Missing Error (HTTP 500)

## 1. Feature Summary
The goal of this task is to resolve a critical database relation error throwing HTTP 500 crashes during Unit 1 (School Identity) registration and loading workflows. The error is caused by a mismatched PostgreSQL table reference: the backend endpoint `GET /api/schools_iern/:id` queries a non-existent `schools_IERN` relation (case-sensitively quoted or legacy-named), whereas the active schema stores these associations in the canonical **`ph_schools`** table. This fix aligns the endpoint's SQL queries with the verified schema, provides a fallback PostgreSQL VIEW compatibility shim, and introduces frontend error boundaries to prevent unhandled 500 exceptions from halting user progress on the portal.

## 2. Verified Facts
- **The Backend Crash Point:** The endpoint `/api/schools_iern/:id` is registered in `apps/school-head/api/units/dashboard/index.js` at line 186. It fails with `relation "schools_IERN" does not exist` when trying to query the database. — Source: User Statement & Verified API Endpoint Registry (`apps/school-head/api/units/dashboard/index.js`:L186).
- **The Correct Schema Table:** The canonical database table representing DepEd schools, mapping `iern` and `school_id`, is **`ph_schools`**. — Source: Verified — Domain Entity Registry (`packages/shared-db/src/db_init.js`:L847).
- **Frontend Trigger Context:** The frontend component `Unit1SchoolIdentity.jsx` launches the fallback request `GET /api/schools_iern/:id` inside the identity lookup pipeline during step initialization or submit. — Source: User Stack Trace & UI Component Symbol Map (`apps/school-head/web/src/components/modular/Unit1SchoolIdentity.jsx`:L1015).
- **Lack of schools_IERN in Schema:** The database initializer in `packages/shared-db/src/db_init.js` defines several tables and alterations but never instantiates a table or view named `schools_IERN` or `schools_iern`. — Source: Verified — Domain Entity Registry (`packages/shared-db/src/db_init.js`).

## 3. Assumptions and Unknowns
### Likely
- The lookup endpoint `GET /api/schools_iern/:id` was written during an earlier development phase when a table or view named `schools_IERN` was temporarily active or manually created in a local container, but was subsequently standardized to `ph_schools` without modifying the dashboard API controllers.
- Establishing a PostgreSQL compatibility VIEW that routes requests from `"schools_IERN"` to `ph_schools` is the safest, non-breaking fallback to protect any legacy modules.

### Unknown
- Whether other auxiliary reporting systems, background synchronizers, or analytics cron-jobs continue to query `"schools_IERN"` directly in production.

---

## 4. Affected Surfaces
| Surface | Status | Expected Role | Blueprint Source |
|---|---|---|---|
| `apps/school-head/api/units/dashboard/index.js` | **Verified** | Update the query in the `GET /api/schools_iern/:id` endpoint handler to query `ph_schools` instead of the non-existent `schools_IERN` relation. | API Endpoint Registry |
| `packages/shared-db/src/db_init.js` | **Verified** | Add a migration-safe DDL fallback step establishing a SQL VIEW `"schools_IERN"` for backwards-compatibility. | Domain Entity Registry |
| `apps/school-head/web/src/components/modular/Unit1SchoolIdentity.jsx` | **Verified** | Refactor safety catches around line 1015 (`iern-fallback` handler) to gracefully catch 500 errors and avoid rendering lockups. | State / Handler Registry |

---

## 5. Data Model and Contract Requirements
- **Relational Mapping Contract:**
  - Database lookup must map `school_id` input parameter directly to the primary identity fields in `ph_schools` [12, 116]:
    ```sql
    SELECT iern, school_id FROM ph_schools WHERE school_id = $1 OR iern = $1;
    ```
- **DDL Compatibility Shim (PostgreSQL VIEW):**
  - To prevent regressions across hidden unread files or older clients, the database initializer must register a VIEW [12]:
    ```sql
    CREATE OR REPLACE VIEW "schools_IERN" AS 
    SELECT iern, school_id 
    FROM ph_schools;
    ```

---

## 6. File-by-File Implementation Plan

### `apps/school-head/api/units/dashboard/index.js`
- **Current role:** Manages administrative reporting, statistics, progress tracking, and validation queries.
- **Required changes:**
  - Navigate to the `GET /api/schools_iern/:id` endpoint handler (around L186) [15].
  - Locate the database query referencing the non-existent `schools_IERN` table.
  - Refactor the SQL query string to reference `ph_schools` [12, 116]:
    ```javascript
    // Before:
    const result = await db.query('SELECT iern FROM "schools_IERN" WHERE school_id = $1', [id]);
    
    // After:
    const result = await db.query('SELECT iern FROM ph_schools WHERE school_id = $1', [id]);
    ```
  - Ensure standard database response checking is applied: if no rows are found, return a clean `200` with `{ iern: null }` or a standard `404` error payload, rather than letting pg exceptions cause unhandled Express server crashes.

### `packages/shared-db/src/db_init.js`
- **Current role:** Schema definition, table initialization, and index setups on bootstrap.
- **Required changes:**
  - Add a compatibility definition block inside the migration bootstrap process (e.g., within `runMigrations()` or after `ph_schools` is created) [53, 117].
  - Execute a secure query setting up a fallback view:
    ```javascript
    await client.query(`
      CREATE OR REPLACE VIEW "schools_IERN" AS 
      SELECT iern, school_id 
      FROM ph_schools;
    `);
    ```
  - Ensure the view creation is wrapped in a standard `try/catch` safety log to prevent boot blockages if a table named `schools_IERN` already exists locally.

### `apps/school-head/web/src/components/modular/Unit1SchoolIdentity.jsx`
- **Current role:** Unit 1 Form controls, handling DepEd registration steps, identity verification, and SDO metadata loads.
- **Required changes:**
  - Inspect `handleSubmit` and fallback lookup blocks (around line 1015 and line 1126) [user query].
  - In `handleSubmit` (around L1127), ensure the code intercepts API network codes gracefully:
    ```javascript
    try {
      const response = await api.get(`/schools_iern/${schoolId}`);
      if (response && response.iern) {
        setFormData(prev => ({ ...prev, iern: response.iern }));
      }
    } catch (err) {
      console.warn("[schools_iern] Fallback error caught gracefully:", err);
      // Let the flow continue or alert the user cleanly instead of throwing a raw, unhandled crash
    }
    ```

---

## 7. UI / UX Behavior
- **Graceful Fault Presentation:** If a 500 error is caught, the component should show a clean notification banner or a retry dialog instead of rendering a blank screen or a raw developer stack trace [user query].
- **Retained State Preservation:** Prevents users from losing filled-out forms if the backend fails to resolve an IERN fallback.

## 8. Backend / Persistence Behavior
- **Error Traps:** Ensure pg query drivers catch exceptions gracefully and return structured JSON blocks containing `{ error: "relation does not exist" }` with an HTTP 404/500 code, rather than crashing the PM2 worker thread.

---

## 9. Test Plan
### Manual Verification Scenarios
1. **Direct API Lookup Probe:**
   - **Action:** Send a `GET` request using an API client (like cURL or Postman) targeting:
     `http://localhost:3000/api/schools_iern/999009`
   - **Expected result:** Server responds with `200 OK` and a structured payload: `{ iern: "..." }` or `{ iern: null }` without triggering database relation exceptions.

2. **VIEW Compatibility Verification:**
   - **Action:** Connect to the PostgreSQL database console and run:
     `SELECT * FROM "schools_IERN" LIMIT 1;`
   - **Expected result:** Command completes successfully, returning mapped school identities from the view.

---

## 10. Acceptance Criteria
- Direct database query calls targeting `GET /api/schools_iern/:id` do not throw database errors.
- Both `ph_schools` table queries and `schools_IERN` fallback views resolve successfully.
- React Unit 1 form submissions complete successfully without halting on 500 error popups.

---

## 11. Final AI Coding Prompt

```text
You are a Senior SQL Database Architect and Full-Stack Developer. Resolve the database relation error throwing HTTP 500 crashes during School Head registrations.

### Grounding Rule
Only edit the files and routing parameters specified in this plan. Ensure any queries follow PostgreSQL case-sensitivity rules and cascade controls safely.

### Tasks to Perform:

1. **Align Database Queries:**
   - Open "apps/school-head/api/units/dashboard/index.js".
   - Locate the endpoint handler for "GET /api/schools_iern/:id" (around line 186).
   - Find the SQL query searching the non-existent table "schools_IERN".
   - Refactor this database query to target the verified master table "ph_schools" instead:
     `SELECT iern FROM ph_schools WHERE school_id = $1`
   - Wrap this query inside a robust try-catch block. If an error occurs or the school is not found, return a clean JSON payload with `{ iern: null }` instead of crashing with HTTP 500.

2. **Establish DDL VIEW Shim:**
   - Open "packages/shared-db/src/db_init.js".
   - Locate the migration bootstrap routine "runMigrations()" or schema creations.
   - Right after the "ph_schools" table creation and alteration blocks, add an idempotent VIEW creation script to support backwards-compatibility:
     `CREATE OR REPLACE VIEW "schools_IERN" AS SELECT iern, school_id FROM ph_schools;`
   - Wrap the VIEW execution in a try-catch block to prevent bootstrap failures on standard local runs.

3. **Improve React Fallback Resilience:**
   - Open "apps/school-head/web/src/components/modular/Unit1SchoolIdentity.jsx".
   - Refactor "handleSubmit" (around line 1127) and the fallback lookup block (around line 1015).
   - Wrap the "api.get" requests targeting `/schools_iern/` in a try-catch pattern. Catch HTTP 500 errors gracefully, log a clean warnings line instead of throw-crashing, and ensure the form submission flow can bypass or fallback safely if a lookup fails.
```
