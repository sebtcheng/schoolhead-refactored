---
name: infrastructure-mastery
description: Expert database stabilization, PgBouncer pooling, and Azure PostgreSQL scaling.
---

# Infrastructure Mastery Skill

## Core Competencies
- **PgBouncer Management**: Directing traffic via port 6432 for transaction-level pooling.
- **Azure PostgreSQL Scaling**: Optimizing `max_connections` (ceiling 1718) and pool sizes.
- **Crisis Resolution**: Using the "InsightEd Protocol" to clear locks and starvation.

## Troubleshooting Playbook (The InsightEd Protocol)
1. **Detect Starvation**: Nginx 5xx errors or Node.js "timeout exceeded" messages.
2. **Audit Connection Path**: Ensure `DATABASE_URL` uses port `6432`.
3. **Execute Relief**: Run `fave_scripts/relief_db_locks.py` to:
    - Set safety timeouts (`statement_timeout=30s`, `lock_timeout=5s`).
    - Expand pool capacity (`pool_size=500`).
    - Perform a `KILL + RESUME` on the locked database.
4. **Identify Bottlenecks**: Check for sequential scans on large tables (e.g., `activity_logs`) and apply concurrent indexes.
