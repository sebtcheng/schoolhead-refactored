# ADR-007: High-Concurrency Hardening and Transactional Integrity

## Status
Accepted

## Context
Following the local database migration (ADR-006), the system was capable of handling baseline traffic. However, anticipated "burst loads" during regional data submission windows (500+ concurrent users) posed a risk of:
1.  **Event Loop Saturation**: Nginx and Node.js potentially blocking under thousands of simultaneous socket requests.
2.  **WAL Sync Bottlenecks**: Frequent database checkpoints causing I/O wait spikes.
3.  **Data Inconsistency**: Multi-step survey updates (e.g., updating school completion after a form save) lacking atomicity, leading to race conditions or partial updates under high load.

## Decision
We implemented a comprehensive "Hardening Layer" across Nginx, PM2, and the Application Level to ensure stability under burst loads.

### 1. Nginx High-Concurrency Tuning
- Elevated `worker_connections` to `10240`.
- Enabled `multi_accept on` and `use epoll` for efficient socket handling.
- Implemented **Admission Control (Capping)**:
    - `limit_conn_zone` to cap connections per IP.
    - `limit_req_zone` to rate-limit aggressive burst requests.
- Optimized persistent connections with `keepalive_requests 10000`.

### 2. Application Admission Control (Load Shedding)
- Implemented **CORTEX Middleware** in `api/index.js` to monitor event loop delay and heap memory.
- If event loop delay exceeds **200ms**, the server returns `503 Service Unavailable` with a `Retry-After: 5` header. This "fail-fast" mechanism protects the process from total lock-ups and instructs the client to back off gracefully.

### 3. Database Write Smoothing (WAL/Checkpoints)
- Increased `max_wal_size` to `16GB` to reduce checkpoint frequency.
- Extended `checkpoint_timeout` to `15min`.
- Set `checkpoint_completion_target = 0.9` to spread I/O load evenly over the interval.
- Enabled `checkpoint_flush_after = '512kB'` to instruct the OS kernel to flush dirty pages incrementally, preventing unrecoverable fsync stalls.

### 4. Transactional Consolidation
- Refactored high-volume sync routines (e.g., `updateSchoolTotalCompletion`) to use internal transactions (`BEGIN/COMMIT`).
- Wrapped multi-query routes (e.g., `save-organized-classes`) in atomic transactions. This reduces the number of WAL synchronizations required per submission and ensures data integrity.

### 5. PM2 Cluster Resilience
- Optimized `ecosystem.config.cjs` for `cluster` mode with `instances: 'max'`.
- Added OOM protection with `max_memory_restart: '1G'`.
- Enabled zero-downtime restarts using `process.send('ready')` (readiness signal).

## Consequences
- **Pros**: The system can now shed load gracefully instead of crashing; write throughput is smoothed out to prevent I/O spikes; data integrity is guaranteed through atomicity.
- **Cons**: Users may occasionally see 503 errors during extreme peaks, though this is preferable to a backend crash.
- **Maintenance**: Requires monitoring of `vm_diagnostics.py` to tune the 503 thresholds if legitimate traffic is being rejected too aggressively.
