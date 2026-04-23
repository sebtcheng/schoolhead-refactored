# ADR-006: PostgreSQL Local Migration & Infrastructure Optimization

## Status
Accepted

## Context
The InsightEd PWA was previously utilizing a remote Azure PostgreSQL instance. As the project prepares for a nationwide rollout to 2,000+ concurrent users, the remote database introduced significant network latency and potential bottlenecks during high-load periods (e.g., synchronized teacher data entry).

Additionally, the primary OS partition on the production VM (`STRIDE-PROD-VM-01`) was reaching 100% capacity, posing a risk of system lockups and database corruption.

## Decision
We migrated the PostgreSQL database to a local environment on the production server and implemented a high-concurrency architecture.

### 1. Local Database Migration
The database was moved from the remote Azure instance to the local loopback (`127.0.0.1`) to achieve near-zero network latency.

### 2. Dedicated Storage Architecture
To resolve the storage crisis and ensure data persistence:
- Provisioned a **295GB managed disk**.
- Mounted the disk at `/mnt` to physically separate application data from the Operating System.
- Successfully relocated the PostgreSQL data directory from `/var/lib/postgresql/16/main` to `/mnt/postgres_data`.

### 3. PostgreSQL Performance Tuning
Based on the server's 16GB RAM profile, the following parameters were optimized:
| Parameter | Value | Rationale |
| :--- | :--- | :--- |
| `shared_buffers` | `4GB` | Allocates 25% of RAM to keep frequently accessed inventory data in memory. |
| `work_mem` | `16MB` | Handles complex sorting and joins without disk swapping. |
| `effective_cache_size` | `12GB` | Informs the optimizer of available OS cache for aggressive read strategies. |

### 4. Middleware Connection Pooling (PgBouncer)
To prevent "Too many connections" errors during peak usage by thousands of teachers:
- Configured **PgBouncer** on port `6432`.
- Acts as a session recycler, maintaining a small pool of persistent DB processes while handling thousands of client connections.

### 5. Storage Sanitization
- Reclaimed **5GB+** from redundant database files.
- Truncated **233MB** of Nginx logs on the `/dev/root` partition.
- Stabilized OS drive utilization at **84%** (down from 100%).

## Consequences
- **Pros**: Drastic reduction in query response times due to local data access; significantly higher concurrency limit; improved system stability through storage decoupling.
- **Cons**: Requires manual management of the `/mnt` volume; local database backup strategy must now be strictly enforced on the VM itself.
- **Maintenance**: Added a maintenance cheat sheet (using `df -h`, `htop`, and `truncate`) to the administrative protocols.
