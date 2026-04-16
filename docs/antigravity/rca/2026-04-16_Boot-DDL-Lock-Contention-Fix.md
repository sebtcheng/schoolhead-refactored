### 🐛 Incident Report: Post-Fix Total DB Connectivity Loss
**Date:** 2026-04-16 | **Status:** Resolved

**🏷️ Clustering Metadata:**
* **Theme:** Infrastructure | **Aspect:** Boot-time DDL Race Condition | **Complexity:** High | **Priority:** P0

#### 1. The Problem & Symptom
* No users could connect to the application after deploying the DDL-extraction fix (docs/preventing_db_locks.md).
* `app.listen()` was never reached — port 3000 never opened — because `startServer()` hung on boot-time DDL.
* Symptom on VM: `connection refused` on port 3000; PM2 logs showed workers stalling on `ALTER TABLE` and `CREATE INDEX`.

#### 2. Root Cause Analysis (The "Why")

**Root Cause 1 — Advisory lock broken by PgBouncer transaction mode:**
`pg_try_advisory_lock(654321)` is a **session-level** lock. In PgBouncer **transaction mode**, each `await pool.query()` may land on a different backend connection because the backend-to-client binding only lasts for the duration of one transaction. The advisory lock was acquired on backend B1, but all subsequent migration queries ran on B2, B3, etc. Every PM2 worker called `pg_try_advisory_lock(654321)` on its own backend and each returned `true`. **All 8 workers ran all DDL migrations simultaneously**, creating massive `AccessExclusiveLock` contention.

**Root Cause 2 — `initFinanceDB` and `initMasterlistDB` outside the advisory lock block:**
These two functions were called after `migClient.release()`, meaning they ran unconditionally on **all workers in parallel**. They contain:
- `DROP TABLE IF EXISTS lgu_forms CASCADE` (AccessExclusiveLock on related tables)
- `CREATE INDEX` without `CONCURRENTLY` (blocks all writes on table)
- `ALTER TABLE masterlist_26_30 RENAME COLUMN` (AccessExclusiveLock)

Even if the advisory lock had worked, these functions would still have caused boot-time contention.

**Root Cause 3 — `SET lock_timeout = 15000` on a pooled connection:**
`initMasterlistDB` called `await pool.query('SET lock_timeout = 15000')` on a shared pool connection. In PgBouncer transaction mode, `SET` parameters persist on the backend connection for its lifetime. Subsequent unrelated queries routed to that same backend inherited the 15-second lock timeout, causing legitimate fast queries to fail with timeout errors.

#### 3. The Final Fix

**Fix 1 — Replace advisory lock with `NODE_APP_INSTANCE` PM2 guard** (`api/index.js`, `startServer()`):
```js
const isPrimaryWorker = !process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === '0';
if (isPrimaryWorker) {
  // all DDL migrations run here — only one worker
}
```
`NODE_APP_INSTANCE` is injected by PM2 cluster mode. It is reliably `'0'` for the first worker and `'1'`–`'7'` for the rest. Non-cluster/dev runs have it undefined → treated as primary. This is immune to PgBouncer backend routing.

**Fix 2 — Move `initFinanceDB` + `initMasterlistDB` inside the primary-worker gate:**
Both functions now execute only when `isPrimaryWorker === true`, eliminating concurrent DDL from multiple workers.

**Fix 3 — Remove `SET lock_timeout = 15000` from pooled connection:**
The `SET` statement in `initMasterlistDB` was removed. Lock timeout governance is delegated to PgBouncer's `server_idle_timeout` and Azure's server-level statement timeout config.

#### 4. Observability & Resiliency
* `app.listen()` is now guaranteed to be reached quickly by all workers — primary does DDL, others skip it entirely.
* Boot DDL contention is eliminated: 0 concurrent `AccessExclusiveLock` operations at startup.
* Pool connections are no longer poisoned with session-level `SET` statements.
* **Future rule:** Any `initXxxDB()` function that contains DDL (`CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`, `CREATE INDEX`) **must** be gated behind `isPrimaryWorker`, not called unconditionally in `startServer()`.
