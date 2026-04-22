# Task: IPC Reconciliation — Outbox Migration Hardening

**Script:** `api/scripts/reconcile_new_construction_ipc.cjs`
**Plan:** `claude/reconcile_outbox_plan.md`

## Checklist

- [x] Audit script for tagging correctness
- [x] Identify Gap 1: DDL inside SERIALIZABLE transaction
- [x] Identify Gap 2: child retag misses IPC-only linked rows (project_id IS NULL)
- [x] Identify Gap 3: no verification guard before hard DELETE
- [x] Write plan (reconcile_outbox_plan.md)
- [x] Write task (this file)
- [x] Fix Gap 1 — extract DDL into ensureSchema() before BEGIN
- [x] Fix Gap 2 — add IPC-keyed secondary sweep in Phase 4e
- [x] Fix Gap 3 — add pre-DELETE verification guard in Phase 4f
- [x] Syntax check
- [ ] Dry-run — review JSON report
- [ ] Live run
