# ADR-008: Content-Addressed Three-Tier Ledger Architecture

## Status
**Proposed / Accepted** (2026-04-19)

## Context
The previous "Monitoring-First" approach to project ingestion led to two critical failure modes:
1.  **Digital Clones**: Identical project snapshots saved across different IPCs, decimation of authoritative history, and audit-script fragility.
2.  **Ledger Pollution**: Higher-percentage authoritative records were being downgraded if a lower-percentage update arrived with a new IPC.
3.  **Lifecycle Coupling**: Initial creation events were stored alongside ongoing monitoring, complicating the data pipeline for newly registered projects.

## Decision
We transitioned to a **Content-Addressed Three-Tier Ledger Architecture** to enforce strict data isolation and identity integrity.

### 1. Unified Identity Shield (CPK)
- **Conceptual Project Key (CPK)**: Projects are identified by a weighted combination of `School ID + Project Name + Category + Budget`.
- **IPC Reuse**: Before generating a new IPC, the system checks for an existing CPK. If found, the existing IPC is reused to preserve vertical history.

### 2. Three-Tier Isolation
We decoupled the project lifecycle into three distinct storage tiers:
- **Tier 1: Creation (`engineer_create`)**: Exclusively stores the initial high-level registration record.
- **Tier 2: Creation Updates (`engineer_create_updates`)**: Houses all subsequent updates for projects originating in Tier 1.
- **Tier 3: Monitoring (`engineer_form`)**: The canonical, hardened ledger for legacy projects and pre-cleansed monitoring data.

### 3. Content-Level Deduplication
- **MD5 Content Hashing**: Every record generates a deterministic `content_hash` across all significant data fields.
- **Atomic Ingestion**: `ON CONFLICT (content_hash) DO NOTHING` prevents duplicate snapshots from ever entering the database, regardless of the IPC used.

## Consequences
- **Correctness**: "Digital Clones" are blocked at the database level. Authoritative history is preserved via mandatory IPC reuse.
- **Performance**: High-performance composite indexes on `(school_id, project_name)` reduced deduplication lookup latency from 11.5ms to **0.25ms**.
- **Isolation**: New projects remain decoupled from the monitoring ledger until they mature, keeping the primary tracking dashboard clean and authoritative.
- **Maintenance**: Forensic cleanup is automated via the `engr_duplicate_fix.py` utility.
