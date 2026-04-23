# ADR-005: School Conversion & Identity Lifecycle

## Status
Accepted

## Context
Educational institutions frequently undergo administrative changes (conversions, reclassifications, or transfers) that result in a change to their official **School ID**. However, the underlying physical and organizational entity—tracked via the **IERN (InsightEd Reference Number)**—remains the same. 

Previous registration logic only supported "New School" entries, which made it difficult to:
1. Track the lineage of a school as its ID changed.
2. Prevent "orphaned" audits and data if a School Head registered under an obsolete ID.
3. Reuse IDs that were technically retired but retained in the database for history.

## Decision
We implemented a **Versioned Identity Model** using an "Archive-and-Replace" workflow within the `schools_IERN` master registry.

### 1. Retention Model
Instead of modifying existing records, the system preserves the original identity but tags it as `Archived`. A new record is inserted for the new School ID, inheriting the **Permanent IERN** of its predecessor.

### 2. Partial Unique Indexing
To allow historical tracking while ensuring registry integrity, we replaced the table-wide unique constraint on `SchoolID` with a **Partial Unique Index**:
```sql
CREATE UNIQUE INDEX idx_schoolid_active 
ON "schools_IERN" ("SchoolID") 
WHERE status = 'Active';
```
This allows the same School ID to exist multiple times in the table (as legacy records), but guarantees that only one instance is ever `Active`.

### 3. IERN Mirroring
During a conversion, the system performs an atomic handshake:
- Fetch the original IERN.
- Set the original record's status to `Archived`.
- Insert the new record with the new ID and the **Old IERN**.

### 4. Visibility Filtering
All public-facing school selection APIs (e.g., `/api/locations/schools`) are now strictly filtered by `WHERE status = 'Active'`. This ensures School Heads only register under current identities.

## Consequences
- **Pros**: Full historical audit trail of School ID changes; prevents data fragmentation; allows ID reuse for versioned tracking.
- **Cons**: Increased table row count (negligible for the scale of school registries); requires explicit status checks in all identity-related queries.
- **Data Integrity**: The IERN is now the primary key for cross-modular data synchronization, while SchoolID remains the human-readable identifier for the current version.
