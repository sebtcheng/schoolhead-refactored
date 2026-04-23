# Historical Traceability & Maintenance: The Memory

This document tracks the technical evolution, incident resolutions, and maintenance logs of the InsightEd repository.

## 1. Application Fix History (Cumulative)
- **Hardening Local Deployment Scripts (2026-04-23)**: Sanitized configuration variables to eliminate CRLF contamination. Ensured `tmp_stride.conf` and other artifacts are included in deployment. Synchronized PM2 lifecycle management.
- **Locking ESF7 Hub Configuration (2026-04-23)**: Hardened school head node configurations to lock the ESF7 hub, preventing unauthorized modifications.
- **Unified Diagnostic Sentinel (2026-04-23)**: Created `insight_diagnose.py` as a holistic system audit tool for infrastructure, DB pools, and sequential scan bottlenecks.
- **ESF7 Job Queue Stall — pg-boss Recovery (2026-04-23)**: Resolved processing stall where jobs were stuck at `PENDING`. Fixed via connection adapter standardization, decoupling registration from DDL locks, and resolving ReferenceErrors in the bootstrap block. See RCA below.
- **School Head Registration — `ON CONFLICT` Constraint Failure (2026-04-23)**: Resolved "there is no unique or exclusion constraint matching the ON CONFLICT specification" error on `/api/register-beta`. See RCA below.
- **BEFF IPC Sync (2026-04-23)**: Automated identification of 251 missing projects using `check_missing_ipc_projects.cjs`.
- **Database Connection Hardening (2026-04-23)**: Resolved "Connection terminated unexpectedly" errors on localhost by expanding the PgBouncer pool (from 100 to 500) and optimizing local connection settings (max 20) in `api/index.js`.
- **Infrastructure Migration (2026-04-08)**: Shift from remote Azure to local STRIDE-PROD-VM. Reclaimed 5GB+ storage; implemented PgBouncer.
- **HRODI Normalization (2026-03-28)**: Categorized "Uncategorized" data to resolve bar graph discrepancies in Recharts.
- **Firebase Decoupling (2026-03-25)**: Surgical removal of `firebase-admin` in favor of Azure stubs and dummy objects.
- **Unit 7 Audit Refinements**: Standardized "Working/Not Working" UI for ICT assets and implemented mandatory utility status confirmations ("type confirm").

## 2. Root Cause Analysis & Incident Reports (RCA)

### RCA: School Head Registration — `ON CONFLICT` Constraint Failure (2026-04-23)
**Symptom:** `POST /api/register-beta` returned HTTP 500 — "Registration failed: there is no unique or exclusion constraint matching the ON CONFLICT specification."

**Affected Tables:** `ph_school_completion`

**Root Cause (Two-Layer):**

*Layer 1 — Missing unique constraint:*
`ph_school_completion` was created with `iern` as its `PRIMARY KEY`. The `school_id` column existed but had only a plain (non-unique) index named `idx_ph_school_completion_school_id`. PostgreSQL's `ON CONFLICT (school_id)` requires a true unique or exclusion constraint — a regular index does not qualify. This caused every upsert to `ph_school_completion` (registration, and all Unit 1-10 completion syncs) to fail.

*Layer 2 — Partial index does not satisfy an unqualified ON CONFLICT:*
The initial fix created a **partial** unique index: `CREATE UNIQUE INDEX ... WHERE school_id IS NOT NULL`. PostgreSQL requires an **exact predicate match** between the index and the `ON CONFLICT` clause. Because all code uses `ON CONFLICT (school_id)` with no `WHERE` predicate, even the partial unique index was rejected. Only a **full** (non-partial) unique index satisfies an unqualified `ON CONFLICT (school_id)`.

**Contrast with `ph_schools`:** The sibling table `ph_schools` had been correctly fixed earlier with a full unique index (`idx_ph_schools_school_id`, no WHERE clause), which is why its `ON CONFLICT (school_id)` clauses worked.

**Remediation Applied:**
1. Deduplicated `ph_school_completion` rows sharing the same `school_id` (kept row with highest `total_completion`; 2 rows removed on dev DB: school IDs `999111`, `121283`).
2. Dropped the existing regular/partial index `idx_ph_school_completion_school_id` on both dev and staging databases.
3. Created a full unique index: `CREATE UNIQUE INDEX idx_ph_school_completion_school_id ON ph_school_completion(school_id)` on both databases.
4. Updated `api/db_init.js` (lines ~306–326) to perform dedup → `DROP INDEX IF EXISTS` → `CREATE UNIQUE INDEX` (no WHERE clause) on every server startup, so this is idempotent for all future environments.

**Files Changed:** `api/db_init.js`

**Resilience Note:** When adding `ON CONFLICT (column)` on any table, verify the constraint with:
```sql
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = '<table>';
```
The `indexdef` must show `CREATE UNIQUE INDEX` and must have **no WHERE clause** to satisfy an unqualified `ON CONFLICT`. A partial index (`WHERE col IS NOT NULL`) requires a matching predicate in the SQL: `ON CONFLICT (col) WHERE col IS NOT NULL`.

### RCA: ESF7 Job Queue Stall — pg-boss Service Recovery (2026-04-23)
**Symptom:** XLSB uploads successfully queued (Job status: `PENDING`) but workers never accepted jobs (stuck at 0% progress).

**Affected System:** `pg-boss` (ESF7 Audit Pipeline)

**Root Cause (Three-Stage Failure):**

*Stage 1 — Port/Database Alias Mismatch:*
Initially, `pg-boss` attempted to open its own connection pool using default settings (Port 5432). The InsightEd staging environment uses **PgBouncer (Port 6432)** with specific database aliases. Bypassing PgBouncer led to "No such file or directory" or "Database <alias> does not exist" errors, preventing the `pg-boss` instance from ever starting.

*Stage 2 — Stale Advisory Lock Stalemate:*
After forcing `pg-boss` to use the application's shared connection pool via a custom `executeSql` adapter, the worker registration calls remained nested inside a DDL migration block gated by `pg_try_advisory_lock(6666666)`. Because a previous worker had crashed without releasing this advisory lock, all new PM2 instances saw the lock as held, logged a skip message, and returned early — **accidentally skipping the worker registration code entirely.**

*Stage 3 — Bootstrap ReferenceErrors:*
Upon decoupling the worker registration from the advisory lock gate, the primary worker process encountered `ReferenceError` exceptions. It attempted to call several undefined migration functions (`runAutoMigrations`, `initDB`, `initUnit7Schema`) and register auxiliary workers with undefined callback handlers (`handleEsf7ApproveJob`). These silent crashes prevented the script from reaching the final `esf7-local-scan` worker registration.

**Remediation Applied:**
1. **Adapter Fix**: Integrated `pg-boss` with the main `pool` using: `const boss = new PgBoss({ db: { executeSql: (text, values) => pool.query(text, values) } })`.
2. **Logic Decoupling**: Moved `boss.work()` calls outside the advisory lock check in `api/index.js` (~L21645) to ensure workers register regardless of migration status.
3. **Resilience Cleanup**: Added `await migClient.query('SELECT pg_advisory_unlock_all()')` at startup to forcibly clear stale locks from crashed sessions.
4. **Code Sanitization**: Linked `hardenSchoolsIernSchema_OLD` and commented out undefined placeholder functions to prevent reference crashes.
5. **Config Corrections**: Updated invalid `pg-boss` configuration keys: `noScheduling` -> `schedule` and `concurrency` -> `localConcurrency`.

**Files Changed:** `api/index.js`


- **Media Persistence Errors**: Resolved "disappearing" site photos by decoupling uploads from metadata saves and anchoring media to atomic IPC keys.
- **Printable Export Implementation**: Unified Units 1-9 into an HTML report optimized for `@media print`, bypassing heavy PDF dependencies.
- **Git Push Block Solution**: Documented the resolution of manifest errors and permissions (755 vs 775) during the migration from Vercel to Government-hosted VM environments.
- **PgBouncer Pool Saturation**: Identified that limited pool slots (100) were being monopolized by production traffic, causing "Connection terminated unexpectedly" for external developers. Implemented throughput expansion (500 slots) and right-sized the developer pool to alleviate pressure.

## 3. Maintenance Protocols
- **Storage Sanitization**: Regular truncation of Nginx logs and reclamation of redundant DB logs to maintain OS drive health.
- **Protocol Compliance**: Weekly updates ("Check for Updates") to ensure alignment with DepEd-mandated form templates and security patches.
- **Snapshot Forensic Logic**: Use of `bad_projects.json` and `missing_ipc_projects.json` for manual data correction of legacy records.

---
*Consolidated from: `APP_FIX_HISTORY.md`, `Resolving Git Push Block.md`, `RCA-Printable-School-Export.md`, and `media_resolution_documentary.md`.*
