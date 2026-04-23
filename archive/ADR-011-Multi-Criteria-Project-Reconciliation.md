# ADR-011: Multi-Criteria Project Reconciliation and IPC Recovery

## Status
Proposed

## Context
During the data migration of "New Construction" projects from legacy systems to the `engineer_form` table, a significant identification gap was discovered. Approximately 18.84% (9,339 records) of the projects lacked matching Individual Project Codes (IPCs) when compared against the `import_beff_projects` reference table. To ensure data integrity and prevent record duplication, a robust secondary identification mechanism was required to recover these identities.

## Decision
We decided to implement a multi-tiered reconciliation strategy that leverages alternative project descriptors to uniquely identify and link records that fail primary IPC matching. 

### 1. Secondary Identification Criteria
The reconciliation engine uses a 4-point composite key to match records:
- **School ID**: Direct mapping of the Department of Education school identifier.
- **Funding Year**: Fiscal year of the project appropriation.
- **Project Category Mapping**: Normalized mapping between `engineer_form` ("New Construction") and `import_beff_projects` ("NC" or "New Construction").
- **Financial ABC (Approved Budget for Contract)**: A threshold-based match on the approved contract amount (using a $1 rounding buffer to account for data type precision differences).

### 2. Transactional Update Logic
For the 9,245 recovered projects, the following update protocol was established:
- **Primary Table Update**: Update the `ipc` column in `engineer_form` to the correct value found in `import_beff_projects`.
- **Child Table Propagation**: Cascade the IPC update across all public schema base tables possessing an `ipc` column (e.g., `engineer_projects_inventory`, `ph_schools_completion`, `engineer_image`).
- **Conflict Management**: In tables where `ipc` is a primary or unique key (like `engineer_projects_inventory`), the system performs a "Verify-then-Merge" operation, deleting the legacy IPC record if the new IPC already exists.

## Consequences

### Positive
- **Near-Total Recovery**: Increased the project reconciliation rate from 81.16% to 99.81%.
- **Data Integrity**: Restored the historical link between engineering forms and central BEFF project tracking.
- **Auditability**: All 9,245 changes are traceable through the generated `scratch/final_recovery_map.json`.

### Negative
- **Many-to-One Risks**: Discovered cases where multiple legacy engineering forms might map to a single central BEFF project, requiring manual review for consolidation.
- **Performance**: Transactional updates across 31 base tables for thousands of records required careful staging to prevent database lock contention.
