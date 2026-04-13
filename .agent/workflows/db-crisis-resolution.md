---
description: How to resolve a 5xx database connection crisis
---

# Database Crisis Resolution (InsightEd Protocol)

// turbo-all

1. Audit the `.env` on the VM to ensure `DATABASE_URL` points to port `6432`.
2. Run the diagnostics to check `cl_waiting` in PgBouncer.
3. If `cl_waiting > 0`, run `& C:/Users/SebastianCheng/AppData/Local/Microsoft/WindowsApps/python3.13.exe fave_scripts/relief_db_locks.py` to clear the logjam.
4. Check for sequential scans: `PGPASSWORD="..." psql -h 127.0.0.1 -p 6432 -U Administrator1 -d insight_pooled -c "SELECT relname, seq_scan, seq_tup_read FROM pg_stat_user_tables ORDER BY seq_tup_read DESC LIMIT 5;"`
5. Apply missing indexes concurrently.
6. Verify Nginx `access.log` size and truncate if > 500MB.
7. Restart Nginx and PM2 to normalize the workers.
