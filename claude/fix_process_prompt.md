# Universal Infrastructure Stabilization: Resolving Dual-Key Index Collisions (Postgres 23505)

## 🔍 Problem Analysis (The "Why")
The `insighted-backend` and `stride-app` services were caught in a severe crash loop (414k+ restarts) due to a **Dual-Key Index Collision Trap**. 

### Root Cause:
1. **Conflicting Identifiers**: Many core tables (e.g., `ph_schools`, `ph_school_completion`) use `iern` as the Primary Key but also have a `UNIQUE` index on `school_id`.
2. **Conflict Target Mismatch**: The application logic frequently used `ON CONFLICT (iern) DO UPDATE`.
3. **The Trap**: If a row exists with `{iern: A, school_id: X}`, and a new request tries to insert `{iern: B, school_id: X}`, Postgres first checks the Primary Key `iern`. Since `B` is new, it proceeds to commit the insert. However, it then hits the `UNIQUE` index on `school_id`, which already has `X`.
4. **The result**: A fatal `23505` error that crashes the entire backend process during high-concurrency worker jobs (like `esf7-local-scan`).

## ✅ The Final Fix
To resolve this permanently, the architectural priority was shifted to treat `school_id` as the primary stable identifier for conflict resolution across all high-frequency tables.

### Shift in Logic:
- **Prioritize school_id**: All `INSERT` statements were refactored to `ON CONFLICT (school_id) DO UPDATE`.
- **Atomic Sync**: If `school_id` is the stable key, the `iern` is now updated as part of the `SET` clause rather than being the trigger for the conflict.

---

## 🛠️ Step-by-Step Fix Protocol

### 1. Database Schema Audit (Master Librarian)
Identify all tables with dual unique constraints (`iern` and `school_id`) where `school_id` is NOT the Primary Key but is marked `UNIQUE`.
- **Primary Targets:** `ph_schools`, `ph_school_completion`.
- **Secondary Targets:** `esf7_link`, `esf_link`, `esf7_resubmission_request`.

**Verification Query:**
```sql
SELECT table_name, constraint_name, column_name 
FROM information_schema.key_column_usage 
WHERE column_name = 'school_id';
```

### 2. Code Hardening (Master Tinkerer)
Scan `api/index.js` for all `INSERT INTO` statements targeting these tables. Update every instance to ensure the `ON CONFLICT` clause targets the **most stable persistent identifier** (usually `school_id` in this ecosystem) or handles both.

**Refactor Pattern:**
- **From:** `INSERT INTO ph_schools (...) ON CONFLICT (iern) DO UPDATE...`
- **To:** `INSERT INTO ph_schools (...) ON CONFLICT (school_id) DO UPDATE SET iern = EXCLUDED.iern, ...`
- **Note:** If `iern` is the Primary Key, using `ON CONFLICT (school_id)` requires the column to have a `UNIQUE` index/constraint.

### 3. Surgical Fix Locations (api/index.js)
Apply the following surgical edits to `api/index.js`:
- **Line 8850 (approx):** Modify `ph_schools` bulk insert/sync.
- **Line 14053 (approx):** Modify `ph_school_completion` unit-specific inserts.
- **Line 19597/19713:** Verify if already using `ON CONFLICT (school_id)`.
- **Worker Logic (line 21724):** Ensure `esf7_link` inserts are atomic and caught in a `try-catch` that logs the `school_id`.

### 4. Stride-App Recovery
The `stride-app` crash loop is likely caused by the same DB conflict during its own background tasks or boot-time registration.
- **Action:** Check `STRIDE-React/.env` and `shared/db_init.js` (if applicable) for the same `INSERT` patterns.
- **Reset:** After fixing the code, run `pm2 reset stride-app` and `pm2 reset insighted-backend` to clear the massive restart counters.

### 5. Post-Fix Verification (Hawkeye Protocol)
- **Log Monitor:** `pm2 logs --err --lines 50` should show 0 new `23505` errors.
- **Health Check:** `curl http://localhost:3001/api/ping` should return `v1.2.5-STAGING-OMEGA-TOP`.
- **Dashboard:** Confirm Nginx `error_log` (Gateway Timeout/Bad Gateway) ceases immediately following the backend stabilization.

---

## 📄 Prompt Instructions
"Act as a Senior Infrastructure Engineer. Analyze `api/index.js` and implement a system-wide hardening of all `school_id` related `INSERT` statements. Shift the conflict target to `school_id` to prevent fatal unique violations when `iern` mappings drift. Then, investigate the `stride-app` boot sequence to ensure its database interactions are equally resilient."
