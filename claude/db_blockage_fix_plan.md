# DB Blockage Fix Plan
**Date:** 2026-04-13  
**Severity:** Critical — AccessExclusiveLock cascade on every server restart

## Root Causes (see full diagnosis in conversation)

| # | Location | Issue |
|---|----------|-------|
| 1 | `api/index.js:1246` | 10 concurrent TIMESTAMP→TIMESTAMPTZ rewrites on `ph_schools` run on every restart |
| 2 | `api/db_init.js:1687` | `initUnit7Schema` called twice within `runMigrations` |
| 3 | `api/index.js:19338` | `initFinanceDB`/`initMasterlistDB` run AFTER advisory lock is released, creating a race window in cluster mode |
| 4 | `api/index.js:19326` | `initUnit7Schema` (index.js local version) runs unconditionally on every restart |

## Fixes

### Fix 1 — TIMESTAMPTZ Conversions (api/index.js ~L1241)
- Separate TYPE conversions from ADD COLUMN operations in `runAutoMigrations`
- Wrap in `hasMigrationRun('timestamptz_migration_v1')` + `markMigrationDone` so they run once ever

### Fix 2 — Duplicate initUnit7Schema (api/db_init.js L1687)
- Remove the second `await initUnit7Schema(client, dbLabel)` at the bottom of `runMigrations`
- The first call at line 205 (`await initUnit7Schema(client, dbLabel)`) is the canonical one

### Fix 3 — Advisory Lock Window (api/index.js ~L19332)
- Move `initFinanceDB()` and `initMasterlistDB()` calls to BEFORE `migClient.release()`
- They use `pool.query()` internally so no signature change needed
- This ensures all DDL is complete before another cluster worker can acquire the lock

### Fix 4 — Unconditional initUnit7Schema (api/index.js ~L19326)
- Wrap the `await initUnit7Schema()` call in `startServer()` with `hasMigrationRun('unit7_schema_v1')` guard
- Mark done with `markMigrationDone` after first successful run
