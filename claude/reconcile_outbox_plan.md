# Plan: IPC Reconciliation — Outbox Migration Hardening

**Feature:** reconcile_new_construction_ipc
**Date:** 2026-04-21
**Author:** Senior SDE Audit

## Problem Statement

The existing `reconcile_new_construction_ipc.cjs` script has three correctness gaps
in Phase 4 (outbox migration) that risk orphaning photo and document records:

### Gap 1 — DDL inside a SERIALIZABLE transaction
`CREATE TABLE engineer_form_outbox` and all `ALTER TABLE ... ADD COLUMN` calls are
inside the `BEGIN ISOLATION LEVEL SERIALIZABLE` block. DDL acquires
`AccessExclusiveLock`, which is incompatible with serializable isolation and will
stall all concurrent reads/writes on those tables for the duration. Per senior-dev
protocol, DDL must not execute on hot paths and must be separated from DML.

**Fix:** Move all DDL (table creation, column additions) to a dedicated pre-flight
block that runs **before** `BEGIN`. The DDL is already idempotent (`IF NOT EXISTS`),
so this is safe.

### Gap 2 — Child retag sweep only covers `project_id`, misses IPC-linked rows
Phase 4e updates `engineer_image` and `engineer_documents` only with
`WHERE project_id = $2`. However, both tables carry a denormalized `ipc` column.
Legacy or backfill rows where `project_id IS NULL` (but `ipc` is set) will not be
retagged and will become silently orphaned after `engineer_form` is deleted.

**Fix:** After the project_id sweep, run a secondary IPC-keyed sweep:
```sql
UPDATE engineer_image
SET outbox_project_id = $1
WHERE ipc = $2 AND project_id IS NULL AND outbox_project_id IS NULL;
```

### Gap 3 — No verification before hard DELETE
The script deletes from `engineer_form` immediately after the retag loop with no
confirmation that all child rows were successfully retagged. If the loop were to
miss any rows (due to the Gap 2 issue or a partial failure), the DELETE would
proceed and leave orphaned child rows with a dangling FK or no reference at all.

**Fix:** Before the DELETE, run a COUNT check:
```sql
SELECT COUNT(*) FROM engineer_image
WHERE project_id = ANY($1::int[]);
-- Must be 0. If not, abort with an error.
```

## Execution Sequence

1. Write plan (this file) ✓
2. Write task.md ✓
3. Refactor script:
   a. Extract DDL into `ensureSchema()` helper — runs before BEGIN
   b. Add IPC sweep in Phase 4e
   c. Add pre-DELETE verification guard in Phase 4f
   d. Add `phase4_verification` block to JSON report
4. Syntax check
5. Dry-run — review report
6. Live run
