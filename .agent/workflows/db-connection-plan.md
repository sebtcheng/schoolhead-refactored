---
description: Trigger this workflow when the site returns HTTP 500/503/504 errors, logs show "timeout exceeded", "remaining connection slots" errors, PgBouncer pooler failures, or any database lock-up and connection bottleneck symptoms.
---

# DB Connection & Server Error Resolution Workflow

This workflow provides an exhaustive, graduated response to database lock cascades, pool saturation, and "500 Internal Server Error" outages. 

## Phase 1: High-Response Emergency Relief
Perform these actions immediately to shed load and restore basic service.

// turbo
1. **Kill Long-Running & Waiting Sessions**
   Run the emergency relief script to terminate sessions holding locks for >5m or idle-in-transaction.
   ```powershell
   python fave_scripts/relief_db_locks.py
   ```

2. **Verify PgBouncer Health**
   Check the current client and pool counts in PgBouncer.
   ```powershell
   # Connect to PgBouncer admin console (e.g., psql -p 6432 -U pgbouncer pgbouncer)
   # Run: SHOW POOLS; SHOW CLIENTS;
   ```

## Phase 2: Diagnostic Deep-Dive
Isolate the root cause of the current bottleneck.

3. **Identify "Root Blocker" Queries**
   Audit `pg_stat_activity` for any query older than 1,000ms holding a lock.
   ```sql
   SELECT pid, now() - query_start AS duration, wait_event_type, wait_event, state, query 
   FROM pg_stat_activity 
   WHERE state != 'idle' 
     AND (now() - query_start) > interval '1 second'
     AND wait_event_type = 'Lock'
   ORDER BY duration DESC;
   ```

4. **Check for "Zombie" Connections**
   Verify if the number of backends in Postgres exceeds the allowed pool size, indicating a failure in connection recycling.
   ```sql
   SELECT count(*), application_name FROM pg_stat_activity GROUP BY application_name;
   ```

## Phase 3: Infrastructure Hardening & Verification
Ensure all architectural guardrails from the April 2026 remediation are active.

5. **Verify Pool & SSL Thresholds**
   Ensure `api/index.js` is utilizing:
   - `connectionTimeoutMillis: 10000` (Harden against Azure VM/Proxy latency)
   - `maxUses: 7500`
   - `ssl: false` for Azure Proxy IP `20.24.58.49` (Handshake failure if enabled, as the proxy handles SSL terminating downstream).

6. **Verify Auth Recovery Logic**
   Confirm that the `migrate-login` endpoint includes an automatic retry for "Connection terminated unexpectedly" errors.

7. **Audit Binary Streaming**
   Confirm that high-traffic binary routes (e.g., `/api/asset/:id`) are using `pg-query-stream` rather than buffering full blobs in RAM.

8. **Verify Migration Locks**
   Check logs for `🔒 [Cluster] Migration lock (6666666) acquired.` to verify migrations aren't causing startup deadlocks. Ensure that no "SSL not supported" errors are present in the migration logs.

## Phase 4: Resolution & Reporting
Finalize the fix and document the incident.

8. **Restabilize Infrastructure**
   If table bloat is suspected, run relevant parts of `system_scripts/tune_db_infrastructure.sql`.
   
9. **Notify User**
   Provide a concise summary of the terminated PIDs, identified slow queries, and current system health status.
