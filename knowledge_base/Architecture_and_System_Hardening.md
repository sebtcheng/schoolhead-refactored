# Architecture & System Hardening: The Spine of InsightEd

This document details the architectural decisions and infrastructure optimizations that ensure InsightEd's stability, scalability, and resilience.

## 1. High-Concurrency Architecture (STRIDE)
To support 2,000+ concurrent users, the infrastructure was migrated to a local-first production environment on `STRIDE-PROD-VM-01`.
- **Local Database**: Migrated from remote Azure to `127.0.0.1` on the production VM to achieve near-zero latency.
- **Dedicated Storage**: Data is stored on a **295GB managed disk** mounted at `/mnt`, decoupled from the OS partition.
- **Connection Pooling**: **PgBouncer** (port 6432) acts as a session recycler, preventing backend saturation.

## 2. PostgreSQL Performance Tuning
Based on a 16GB RAM profile, the following optimizations are implemented:
- `shared_buffers`: 4GB (25% of RAM) for inventory data caching.
- `work_mem`: 16MB for complex joins/sorting.
- `effective_cache_size`: 12GB for aggressive OS-level read strategies.
- `TOAST Tuning`: Large columns (e.g., `unified_binaries.content`) are set to `STORAGE EXTERNAL` to keep main indices slim.

## 3. Resilience & Lock Prevention
To prevent "Connection Timeout" and "500 Error" cascades:
- **DDL Extraction**: structural `ALTER TABLE` queries are strictly limited to application initialization (`api/db_init.js`).
- **AccessExclusiveLock Prevention**: No DDL operations are allowed inside standard HTTP request handlers.
- **Asynchronous Analytics**: Secondary calculations (e.g., `updateSchoolTotalCompletion`) are fire-and-forget, freeing DB sockets immediately.
- **Throttled Polling**: Frontend maintenance checks are limited to 5-minute intervals.

## 4. Nginx Environment Mapping
A unified `stride.conf` manages multiple environments:
- **Production**: `/insighted/` (Port 5000)
- **Staging**: `/insighted-staging/` (Port 5001)
- **Asset Pattern**: All `/uploads/` requests fall through to the API to be served directly from the PostgreSQL binary registry (Database-First Assets).

## 5. Storage & Analysis Strategies
- **XLSB Handling**: Binary Excel files are stored in `unified_binaries`. Analysis is performed via an asynchronous ETL pipeline that flattens data into `JSONB` for fast querying.
- **R Integration**: Secure connection protocols (via `RPostgres` and `dbplyr`) enable high-performance data analysis for regional dashboards.

---
*Consolidated from: `ADR-006`, `infrastructure_hardening_report.md`, `preventing_db_locks.md`, `nginx_multi_site_config.md`, `R-Connection-Guide.md`, and `xlsb-storage-strategy.md`.*
