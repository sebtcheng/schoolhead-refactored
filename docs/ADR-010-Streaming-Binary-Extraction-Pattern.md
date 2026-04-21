# ADR-010: Streaming Binary Extraction Pattern

## Status
Proposed / Implemented (2026-04-21)

## Context
Large-scale binary data extraction (photos, documents) from the `unified_binaries` table was previously using `fetchall()` or unbounded queries. This led to:
1.  **Database Connection Satiation**: Excessive connections held while transferring large payloads.
2.  **Memory Exhaustion**: Worker nodes attempted to load millions of bytes of image data into RAM simultaneously.
3.  **System Instability**: 502/504 Gateway errors as backend processes crashed or became unresponsive during long-running extractions.

## Decision
We moved to a **Streaming Binary Extraction Pattern** for all resource-intensive data exports.

### Key Implementation Details:
1.  **Server-Side Cursors**: Utilize named cursors (e.g., `psycopg2.connect().cursor('name')`) to stream rows one-by-one from the PostgreSQL database.
2.  **Mandatory Safety Limits**: Implement a default row limit (e.g., 50) for all extraction scripts, requiring an explicit `--all` flag for full exports.
3.  **Preliminary Counting**: Pre-fetch total row counts to provide accurate progress monitoring without loading the actual binary content.
4.  **Graceful Backoff**: Ensure connection pooling (PgBouncer) is respected and that heavy background tasks do not block the transient application pool.

## Consequences
- **Pros**: 
    - Dramatically reduced memory footprint on worker nodes.
    - Improved database stability during heavy exports.
    - Real-time progress feedback for administrators.
- **Cons**: 
    - Slightly higher complexity in script implementation (named cursors, count-then-fetch logic).
    - Requires explicit flags for large exports, creating a minor extra step for users.

## Stabilization Gotchas (Retrospective)
During the April 21 restoration, standard stabilization scripts were insufficient because:
1. **Orphaned Port Listeners**: Port 3002 remained held by zombie processes.
2. **Nginx Conf Duplication**: Backup files in `sites-enabled` caused fatal configuration errors.
3. **PM2 User context**: Root-level restarts did not automatically revive user-level application processes.

## Resolution Actions Taken
1. **Port Reclamation**: `sudo fuser -k 3002/tcp` used to clear zombie ports.
2. **Nginx Cleanup**: Moved backups out of `sites-enabled` and de-duplicated `include` directives.
3. **PM2 Contextual Restart**: Hard restart of the `Administrator1` PM2 instance.
4. **Enforced Telemetry**: Injected explicit `access_log` to enable the Eye of Horus monitor.
