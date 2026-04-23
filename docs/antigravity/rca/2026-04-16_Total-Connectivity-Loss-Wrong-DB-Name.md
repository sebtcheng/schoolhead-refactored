### 🐛 Incident Report: Total DB Connectivity Loss — Wrong Database Name in .env
**Date:** 2026-04-16 | **Status:** Resolved

**🏷️ Clustering Metadata:**
* **Theme:** Infrastructure | **Aspect:** Configuration Drift / Restart Loop Cascade | **Complexity:** High | **Priority:** P0

#### 1. The Problem & Symptoms
* "password authentication failed for user Administrator1" on all requests
* Pool showing 0 active connections across all workers
* 1000+ PM2 restarts accumulated: `insighted-backend` workers at 1017 / 1008 / 988 / 417 / 418 / 411 / 410 / 407 restarts; `insighted-staging` at 1222 restarts

#### 2. Root Cause Analysis (The "Why")

**Root Cause 1 — Wrong database name in .env (Primary Cause):**
The VM's `.env` had:
```
DATABASE_URL=postgres://Administrator1:<REDACTED_PGB_PASS>@127.0.0.1:6432/insight_pooled
```
The database name was `insight_pooled` instead of `insightEd`. PgBouncer had no entry for `insight_pooled` in its routing config and returned an authentication/connection error on every attempt. This was set during a previous database blockage fix as a temporary local-pooled-mode test and was never reverted to the correct Azure PG entry.

**Root Cause 2 — listen_timeout: 10000ms killing instance 0 in a restart loop:**
With the wrong DB name, the primary worker (instance 0) could not complete the `pool.connect()` call inside `startServer()`. PM2's `listen_timeout: 10000ms` killed instance 0 before it reached `app.listen()`. PM2 immediately restarted it. Over hundreds of hours, this produced 1000+ restarts.

**Root Cause 3 — Zombie connection accumulation (Cascade):**
Each restart created `min: 5` pool connection attempts (all failing with auth errors) and abandoned them via SIGKILL without calling `pool.end()`. These accumulated as zombie sessions in PgBouncer's client queue, eventually exhausting `max_client_conn` and blocking even the non-primary workers that had correct logic.

#### 3. The Final Fix

**Fix 1 — Patch .env DATABASE_URL:**
Corrected on VM via `fix_db_credentials.py` (fave_scripts):
```
DATABASE_URL=postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:6432/insightEd
```
Key differences: `127.0.0.1` → `stride-posgre-prod-01.postgres.database.azure.com`, database `insight_pooled` → `insightEd`.

**Fix 2 — Listen-First startup architecture (api/index.js `startServer`):**
Decoupled `app.listen()` + `process.send('ready')` from migrations. All workers now call `app.listen()` immediately (< 1 second). PM2's `listen_timeout: 10000ms` is never triggered. Primary worker (NODE_APP_INSTANCE === '0') runs migrations in background via `setImmediate`.

**Fix 3 — Removed `SET lock_timeout = 15000` from pooled connections:**
Removed from `initDB` (line 1702) and `initMasterlistDB` — these `SET` statements poisoned PgBouncer backend connections for all future queries routed to those backends.

**Fix 4 — KILL + RESUME PgBouncer to clear zombie connections:**
Cleared all accumulated zombie sessions instantly. Followed by `pm2 delete all && pm2 start ecosystem.config.cjs` for a clean restart.

#### 4. Observability & Resiliency

**Post-fix state:**
| Metric | Value |
|---|---|
| insighted-backend workers (6) | online, 0 restarts |
| insighted-staging workers (2) | online, 0 restarts |
| HTTP port 5000 health | 200 OK |
| HTTP port 5001 health | 200 OK |
| PgBouncer cl_waiting | 0 |

**Future prevention rules:**
1. **NEVER change `DATABASE_URL` to a local/test database name without a rollback plan.** Always verify with `curl http://127.0.0.1:5000/api/settings/maintenance_mode` before closing the session.
2. **Run `fix_db_credentials.py`** as the first diagnostic step whenever "password authentication failed" or "0 connections" appears — it reads the live `.env`, compares against known-good credentials, patches and restarts automatically.
3. **The correct DATABASE_URL** always points to `stride-posgre-prod-01.postgres.database.azure.com:6432/insightEd` (port 6432, PgBouncer, database `insightEd`). Any deviation from this exact string requires explicit justification.
4. **`listen_timeout` in ecosystem.config.cjs** should never be less than 30000ms. The listen-first architecture makes it irrelevant, but it is a safety net.
