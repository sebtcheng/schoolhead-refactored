# ADR-011: Database Consolidation & IPC Realignment

## Status
Approved

## Context
The `engineer_form` table serves as the primary registry for infrastructure projects. Over time, discrepancies emerged between this table and the official `import_beff_projects` masterlist. Many projects used non-standard identifiers (IPCs), and the table was cluttered with tens of thousands of records that did not require active management (no media or updates).

## Decision
We decided to consolidate the database by:
1.  Archiving inactive records into a secondary `engineer_dump` table.
2.  Realigning identifiers for 'New Construction' projects to match official records.
3.  Backfilling missing projects from the masterlist to ensure 100% coverage in the active table.

## Implementation Details

### 1. Archival of Clean Projects
Calculated records without media or duplicate updates and moved them to `engineer_dump`.
- **Count**: 56,043 records.
- **Security Bypass**: Utilized session-level bypass for the `DocLock` trigger policy to allow deletions from `engineer_form`.

### 2. IPC Realignment Logic
Updated identifiers for 85 'New Construction' projects where data matched official records but the IPC was historical (e.g., `INF-10` prefix).
- **Matching Pattern**: School ID + Funding Year + Unified Budget Value.
- **Cascading Updates**: Applied to all downstream dependency tables (Images, Documents, Inventory, Finance, HRODI).

### 3. Masterlist Consolidation
Merged all remaining records from `import_beff_projects` into `engineer_form`.
- **Restored**: 40,199 records (from Dump).
- **Backfilled**: 4,171 records (from Masterlist).

## Consequences

### Positive
- **Integrity**: `engineer_form` now contains all official projects with synchronized IPCs.
- **Organization**: Active projects are consolidated, while legacy records remain accessible in `engineer_dump`.
- **Reliability**: Cascading updates ensure media and documents remain linked regardless of identifier changes.

### Neutral
- **Volume**: `engineer_form` row count increased to 44,829 to provide full masterlist visibility.

## Final Reconciliation
- Total `engineer_form` rows: **44,829**
- Total `engineer_dump` rows: **15,844**
- Total Masterlist coverage: **100%**
