# Architecture Decision & Post-Mortem: Preventing Severe PostgreSQL Connection Locks

## 1. The Incident Context & Symptoms
The production system began experiencing catastrophic connection starvation and **"500 Internal Server Error"** cascades, accompanied by massive latency spikes (HTTP mean latency hitting the hard 10,000ms timeout ceiling limit). The end-user manifestation was a completely bricked UI during dashboard loading and saving.

**Initial Diagnostics:**
* PM2 logs showed hundreds of continuous errors: `timeout exceeded when trying to connect`.
* Nginx logged over **371** 500 errors per minute.
* Database connections pooling reached the maximum ceiling (`100/100` active Azure limit), with PM2 workers stacking long queues (60+ waiting clients per worker). 

## 2. Step-by-Step Investigation & Identification 

### Phase 1: Addressing the Pool Limits (Symptomatic Relief)
Initially, we hypothesized the Node.js database pool limits were too small to handle the concurrent HTTP requests.
* **Findings:** The Node.js PM2 workers were configured with a strict `max: 12` connection limit and a `connectionTimeoutMillis: 10000ms`. When traffic spiked, queries banked up for 10 seconds per worker, eventually starving the network completely.
* **Attempted Solution:** We scaled the connection pool to `max: 20` per worker and implemented a "Fail-Fast" threshold logic (`connectionTimeoutMillis: 3000ms`) to preemptively shed loads and clear dead queue spots faster.
* **Result / Deadlock:** While this marginally improved throughput (preventing the 10-second request queueing), the 500 errors rapidly returned. The database was still saturated, suggesting a severe internal lock.

### Phase 2: Analyzing `pg_stat_activity`
We utilized Python parameter scripts (`diagnose_queries.py`) to bypass the blocked API layer and directly interrogate Azure's `pg_stat_activity` view to isolate long-running queries holding locks longer than 1,000ms.
* **Critical Discovery:** We caught over 40 distinct `ALTER TABLE ph_schools ADD COLUMN IF NOT EXISTS ...` queries executing continuously during standard HTTP traffic, taking significant fractions of a second and causing massive transaction queues.

### Phase 3: Root Cause Analysis in the Codebase
A grep analysis over the API repository (`api/index.js`) revealed multiple severe architecture anti-patterns:
1. **Synchronous DDL on Hot Paths:** The `/api/ph_schools/unit1`, `/unit2`, and `/unit3` endpoints were executing structural Auto-Migrations (`ALTER TABLE`) directly inside every request body.
2. **The "Progress" Avalanche:** The `/api/ph_schools/progress/:schoolId` endpoint, which is polled heavily by the Dashboard, included a 30-query `ensureCols` loop executing `ALTER TABLE ph_schools` on every load attempt. 
   - *Why this is fatal:* `ALTER TABLE` operations in PostgreSQL acquire a table-level `AccessExclusiveLock`. This forced all 160 connections cluster-wide to wait in a single file queue to read from `ph_schools`, completely starving the database pool.
3. **Pendant Backend Triggers:** The `updateSchoolTotalCompletion()` function executes 3 consecutive read and write operations. It was being `await`-ed at the end of 17 different API routes, locking connection pools open while completing complex secondary analytics.

## 3. Implementation of the Final Fix

To definitively eradicate the locking issues, we performed a multi-tier decoupling strategy:

1. **Surgical DDL Extraction:** 
   * Stripped out all 47 dynamic `ALTER TABLE` statements scattered across the API request handlers.
   * Relocated all schema validation queries into the vertical boot-level initialization (`initUnit7Schema` / `runAutoMigrations`).
   * Boot migrations are protected by `pg_try_advisory_lock` to ensure only 1 PM2 cluster worker manages DDL operations at boot, eliminating race conditions.

2. **Analytics Decoupling:**
   * Transitioned all 17 implementations of `await updateSchoolTotalCompletion()` to pure asynchronous execution (fire-and-forget). The HTTP connection finishes and frees the database socket back to the pool instantly, while the completion percentages compile safely in vertical background Node.js threads.

3. **Pool Refinement Deployed:**
   * Using automated `deploy_index.py` and `deploy-local.sh`, we deployed the localized refactorings securely. We ensured the SSH connections had bypass protocols so the PM2 environment accurately flushed old process states and instantiated the new event loop.

## 4. System Improvements & Latency Results

The post-deployment benchmarks observed via Nginx/Postgres diagnostics confirmed staggering efficiency improvements:

| Metric | Pre-Fix (Critical Failure) | Post-Fix (Optimized) | Net Improvement |
| :--- | :--- | :--- | :--- |
| **Nginx 500 Error Rate** | ~371 exceptions / minute | 4 - 9 / minute | **>97% Reduction** |
| **PostgreSQL `sv_active`** | Blocked at 100/100 (Ceiling) | 0 Active / 71 Idle | **Zero Locking Constraints** |
| **Longest Query Exec Time** | > 10,000+ ms | `0.069 sec` (69ms) | **Lightning Latency** |
| **PM2 Pool Queue (`cl_wait`)**| > 60 Pending Tasks per worker | 0 Queue Depth | **Instant Dispatching** |

By restricting structural `AccessExclusiveLock`s to application initialization and leveraging asynchronous calculation shedding, the system successfully regained its scalability against heavy region-wide administrative traffic.
