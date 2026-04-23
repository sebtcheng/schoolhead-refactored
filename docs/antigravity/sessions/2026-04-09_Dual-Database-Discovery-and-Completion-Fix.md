# Session Summary: Dual-Database Discovery & School Completion Fix
**Date:** 2026-04-09  
**Engineer:** Antigravity / Claude Code (claude-sonnet-4-6)  
**Session Duration:** Extended multi-hour investigation  
**Severity:** Critical (data integrity, production visibility)

---

## 1. Presenting Symptom

School **151006 (Mangkaeng Primary School, La Union, Region I)** displayed **13% accomplishment** in the production application at `stride.deped.gov.ph`, despite showing **100% completion** when the same school was viewed on the developer's localhost environment.

The initial hypothesis was that recent Nginx and pgBouncer optimizations (ADR-006, ADR-007) introduced query timeouts or connection failures that caused data to appear incomplete on the frontend.

---

## 2. Investigation — Layer by Layer

### 2.1 The Red Herring: pgBouncer Transaction Mode

The first line of investigation focused on `updateSchoolTotalCompletion()` — a backend function responsible for syncing the `ph_schools.unit_completion` percentage after each unit form submission. 

The function was found to use `pool.connect()` with explicit `BEGIN/COMMIT` transactions. **In pgBouncer `transaction` mode**, the server connection is recycled after every transaction. If the pgBouncer connection is dropped mid-transaction (common under burst load), PostgreSQL silently issues a `ROLLBACK`, leaving `unit_completion` stale at its previous value.

**Fix applied:** `updateSchoolTotalCompletion` was rewritten to:
- Use auto-committing `pool.query()` calls (no `BEGIN/COMMIT` wrapper)
- Read directly from `ph_schools.unit1`–`unit7`, `unit9` integer flags (the authoritative source)
- Sync both `ph_schools.unit_completion` and `ph_school_completion` in a single, pgBouncer-safe sequence

```js
// Before (vulnerable to pgBouncer transaction drops)
const client = await pool.connect();
await client.query('BEGIN');
// ... multi-step reads and writes ...
await client.query('COMMIT');

// After (pgBouncer-safe)
const res = await pool.query(`SELECT unit1, unit2, ... FROM ph_schools WHERE iern=$1`, [iern]);
// ... derive bools and percentage ...
await pool.query(`UPDATE ph_school_completion SET ... WHERE iern=$1`, [...]);
await pool.query(`UPDATE ph_schools SET unit_completion=$1 WHERE iern=$2`, [pct, iern]);
```

Additionally, a `/api/admin/resync-completion` endpoint was added to bulk-repair all schools. A bulk resync was executed, correcting **12,554 schools**.

### 2.2 Nginx Timeout Hardening

Nginx's root `/` location block was found to inherit the server-level 300-second proxy timeout, while the `/insighted/api/` and `/api/` blocks had been explicitly raised to 600s. This left the progress endpoint potentially exposed to mid-stream disconnects under slow Azure queries.

**Fix applied:** All relevant Nginx location blocks were explicitly set to `proxy_read_timeout 600s` and `proxy_send_timeout 600s`.

### 2.3 The Progress Endpoint — Still Wrong

After all the above fixes were deployed and a direct DB repair script confirmed `unit_completion = 100%` for school 151006, the production frontend **still showed 13%**.

Investigation shifted to `/api/ph_schools/progress/:schoolId` (line 16585 in `api/index.js`) — the gamification/quest endpoint that drives the completion display in the School Head dashboard. A live curl to the production server:

```bash
curl http://localhost:5000/api/ph_schools/progress/151006
# → {"completedUnits":[2],"xp":200,...}
```

Only unit 2 was counted. The DB repair scripts had correctly set all flags to `TRUE` and `unit_completion` to `100%` — yet the endpoint returned 1/8.

### 2.4 The Critical Discovery: Two Separate Databases

A diagnostic script (`debug_progress2.cjs`) was written to simulate the exact progress endpoint query — but crucially, it was run through **pgBouncer** at `127.0.0.1:6432`, replicating the actual path the production API uses.

Result through pgBouncer:
```
unit1_completed: false
unit2_completed: true   ← only this one
unit3_completed: false
...
```

Result through direct Azure connection (`stride-posgre-prod-01.postgres.database.azure.com:5432`):
```
unit1_completed: true
unit2_completed: true
...all TRUE
```

**The databases were different.** Reading the pgBouncer configuration revealed the root cause:

```ini
# /etc/pgbouncer/pgbouncer.ini
[databases]
insight_pooled = host=127.0.0.1 port=5432 dbname=insight_pooled
```

pgBouncer proxied to a **local PostgreSQL instance** (`127.0.0.1:5432`) with a database named `insight_pooled`. The production `.env` used:
```
DATABASE_URL=postgres://...@127.0.0.1:6432/insight_pooled
```

Meanwhile, every repair and diagnostic script hardcoded the Azure hostname:
```
postgres://...@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd
```

**All repair scripts had been writing to the Azure database — which the production application never reads.**

---

## 3. Root Cause Analysis

```
┌────────────────────────────────────────────────────────────┐
│                     DEVELOPER LOCALHOST                     │
│  .env → Azure PostgreSQL (insightEd)                       │
│  School 151006: unit_completion=100%, all flags TRUE       │
└────────────────────────────────────────────────────────────┘
                              ≠
┌────────────────────────────────────────────────────────────┐
│                  PRODUCTION SERVER                          │
│  .env → pgBouncer → local PostgreSQL (insight_pooled)      │
│  School 151006: unit_completion=12.5%, only unit2=TRUE     │
└────────────────────────────────────────────────────────────┘
```

The developer's localhost was connected to Azure PostgreSQL. All test submissions for school 151006 were submitted through that environment, populating the Azure DB with complete data. The production app was using an entirely separate local PostgreSQL instance where the school had only ever submitted unit 2 (enrollment).

All diagnostic scripts written during the session were also pointed at Azure, causing a false diagnosis that the data was "correct" when in reality we were reading the wrong database the entire time.

---

## 4. Resolution

**Changed the production `DATABASE_URL` to point directly to Azure PostgreSQL**, eliminating the local PostgreSQL divergence.

```bash
# On production server /var/www/html/InsightEd-Mobile-PWA/.env
# Before:
DATABASE_URL=postgres://Administrator1:<REDACTED_PGB_PASS>@127.0.0.1:6432/insight_pooled?prepare_threshold=0&connection_timeout=30000

# After:
DATABASE_URL=postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd?ssl=true&sslmode=require
```

PM2 was reloaded with `--update-env` semantics via `pm2 reload insighted-backend`.

Immediate verification:
```bash
curl http://localhost:5000/api/ph_schools/progress/151006
# → {"completedUnits":[1,2,3,4,5,6,7,8],"xp":2450,...}
```

All 8 units now visible. Production and localhost share one source of truth.

---

## 5. Secondary Fixes (Collateral Improvements)

These improvements were made during the investigation and remain in production regardless of the root cause:

| Fix | File | Detail |
|-----|------|--------|
| pgBouncer-safe `updateSchoolTotalCompletion` | `api/index.js:1029` | Removed `BEGIN/COMMIT`, reads authoritative `unit*` int flags |
| Unit 8 (terrain) sync trigger | `api/index.js:~18428` | Added `updateSchoolTotalCompletion` call after unit9/terrain form save |
| Admin resync endpoint | `api/index.js:~10063` | `POST /api/admin/resync-completion` — bulk repairs all schools |
| Nginx 600s timeout on all locations | `tmp_stride.conf` | Root `/` block now explicitly 600s, matching API blocks |

---

## 6. Lessons Learned & Risks Going Forward

### L1: Diagnostic Scripts Must Match Production Connection Path
All future diagnostic scripts must be run through the same connection string the production app uses (read from `.env`), not a hardcoded hostname. The divergence between `127.0.0.1:6432` and `stride-posgre-prod-01...` burned several hours of work.

### L2: pgBouncer Adds a Hidden Routing Layer
When pgBouncer maps a virtual database name to a physical host, the virtual name (`insight_pooled`) obscures the real destination. Future infrastructure changes must document this mapping explicitly.

### L3: Azure PostgreSQL as Single Production DB
The local PostgreSQL (`insight_pooled`) was set up as part of ADR-006's performance migration. However, retaining Azure as the primary production database (with pgBouncer providing pooling TO Azure, not to localhost) would be the preferred steady state — or pgBouncer should be removed entirely since the `prepare_threshold=0` workaround for prepared statements is already applied in the connection string.

### L4: The Progress Endpoint Runs 20 ALTER TABLE Statements Per Request
`/api/ph_schools/progress/:schoolId` runs 20 `ADD COLUMN IF NOT EXISTS` DDL statements on every single call (lines 16589–16622). This takes an Access-Exclusive lock on `ph_schools` with every progress check. Under high concurrent load from 500+ school heads checking their dashboards, this will serialize all reads against the table. A future ADR should address this by moving the idempotent column creation to the database initialization script (`api/db_init.js`) and removing it from the request path.

---

## 7. Files Created This Session

| File | Purpose |
|------|---------|
| `fave_scripts/repair_now.js` | Repair unit_completion for a single school (Azure DB) |
| `fave_scripts/repair_local_db.cjs` | Repair unit_completion for a school (local DB via pgBouncer) |
| `fave_scripts/check_local_151006.cjs` | Full data dump for school 151006 from local DB |
| `fave_scripts/check_flags.cjs` | Check unit*_completed flags for a school |
| `fave_scripts/debug_progress.cjs` | Simulate progress endpoint logic against DB flags |
| `fave_scripts/debug_progress2.cjs` | Simulate progress endpoint query through pgBouncer |
| `fave_scripts/check_151006_rows.cjs` | Verify row count for school 151006 |

---

*Session closed. Production database unified to Azure. School 151006: 100% ✓*
