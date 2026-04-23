# ADR-0012: Production Database Unification — Azure PostgreSQL as Single Source of Truth

**Date:** 2026-04-09  
**Status:** Accepted  
**Deciders:** Antigravity / Engineering Team

---

## Context

During a critical investigation into school completion data discrepancies (school 151006 showing 13% in production vs. 100% on localhost), it was discovered that the production server and the developer's localhost were connected to **two entirely separate PostgreSQL databases**:

| Environment | Connection Path | Physical Database |
|-------------|----------------|-------------------|
| Developer Localhost | Direct Azure hostname, port 5432 | `insightEd` on Azure PostgreSQL |
| Production Server | `127.0.0.1:6432` → pgBouncer → `127.0.0.1:5432` | `insight_pooled` on local PostgreSQL |

This divergence was introduced during the April 8 infrastructure hardening (ADR-006), where pgBouncer was deployed with `pool_mode = transaction` pointing to a **local** PostgreSQL instance. The intent was to improve connection pooling performance. However, the local database was either not properly seeded with current production data, or diverged over time as submissions from actual school users went to local while developer testing went to Azure.

The consequence was severe: all diagnostic and repair scripts written to investigate production issues were — unknowingly — running against Azure, giving false confirmation that data was correct while the actual production database remained unrepaired.

---

## Decision

**Revert the production `DATABASE_URL` to point directly to Azure PostgreSQL**, bypassing the local PostgreSQL entirely.

```bash
# Production server: /var/www/html/InsightEd-Mobile-PWA/.env
DATABASE_URL=postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd?ssl=true&sslmode=require
```

pgBouncer remains running on the server but is no longer in the production data path. The `insight_pooled` local database is abandoned.

---

## Rationale

### Why Azure over Local?

1. **Azure is the developer's source of truth.** All localhost testing, development, and form submissions go to Azure. It has the most complete and up-to-date data.
2. **Data fidelity.** The Azure DB had school 151006 fully complete (100%). The local DB had only unit2. Azure data was authoritative.
3. **Single source of truth.** Both production and localhost now read/write the same database. Debugging is reliable — you see the same data everywhere.
4. **The local DB had unknown divergence.** It is unclear how many other schools had incomplete or stale data in the local DB due to the split-brain period.

### Why Not Keep Local + Migrate Data?

Migrating the Azure data to local PostgreSQL would require:
- A full pg_dump/pg_restore with schema reconciliation
- Verifying all 12,554+ schools across both databases
- Re-validating every table for data consistency

The risk of partial migration creating a third inconsistent state outweighed the performance benefit of local pooling, especially since Azure PostgreSQL (Flexible Server) handles pooling at the PaaS level.

---

## Consequences

### Positive
- Production and localhost share identical data — no more split-brain debugging.
- All future diagnostic scripts that read from `process.env.DATABASE_URL` will automatically target the correct database.
- Repair scripts and admin endpoints now work correctly against production data.

### Negative / Risks
- **Latency:** Queries now traverse the network to Azure (typically 2–10ms from the same Azure region) rather than hitting localhost. Under burst load, this adds up.
- **pgBouncer bypass:** The connection pooling benefit of pgBouncer is lost. Azure's Flexible Server has built-in PgBouncer support (PgBouncer as a service) — this should be evaluated as a future hardening step.
- **SSL overhead:** `ssl=true&sslmode=require` adds TLS handshake cost per connection. This is mitigated by connection reuse in the `pg.Pool` instance.

---

## Migration Note

The local `insight_pooled` database on the server remains intact but is no longer used by any application process. It should be decommissioned or kept as a cold backup with a clear label to prevent future confusion.

---

## Related ADRs
- [ADR-006: VM PostgreSQL Optimization](../../../docs/ADR-006-VM-Postgre%20Optimization(April8).md) — Introduced local PostgreSQL and pgBouncer
- [ADR-007: High-Concurrency Hardening](../../../docs/ADR-007-High-Concurrency-Hardening-and-Transactional-Integrity.md) — pgBouncer transaction mode safety

---

*ADR maintained by Antigravity — InsightEd PWA Engineering Log*
