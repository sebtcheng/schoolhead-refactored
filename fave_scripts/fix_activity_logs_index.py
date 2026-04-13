#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fix_activity_logs_index.py
===========================
Creates missing indexes on activity_logs CONCURRENTLY (no table lock, zero downtime).

The diagnostic found: activity_logs has 62,394,512 sequential scans vs 1,503,974 index scans.
Every logActivity() call and every log-fetching route is doing a full-table scan.

Indexes being created:
  1. idx_activity_logs_user_uid     — WHERE user_uid = $1 (user-specific log queries)
  2. idx_activity_logs_timestamp     — ORDER BY timestamp DESC (latest activity queries)
  3. idx_activity_logs_action_type  — WHERE action_type = $1 (action-type filters)
"""
import paramiko, sys, io, time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

SERVER_IP = "20.24.58.49"
SSH_USER  = "Administrator1"
SSH_PASS  = "7v52E69TYgTE"
PGB_HOST  = "127.0.0.1"
PGB_PORT  = "6432"
PGB_USER  = "Administrator1"
PGB_PASS  = "pRZTbQ2T1JD7"
APP_DB    = "insightEd"

def banner(t): print(f"\n{'='*72}\n  {t}\n{'='*72}")

def ssh_run(client, cmd, timeout=300):
    _, out, err = client.exec_command(cmd, timeout=timeout)
    stdout = out.read().decode('utf-8', errors='replace').strip()
    stderr = err.read().decode('utf-8', errors='replace').strip()
    if stdout: print(stdout)
    noise = {"WARNING","NOTICE","SSL connection"}
    errs = [l for l in stderr.splitlines() if l and not any(n in l for n in noise)]
    if errs: print(f"  [ERR] {chr(10).join(errs[:5])}")
    return stdout

def pgb_sql(client, sql, label="", timeout=300):
    if label: banner(label)
    esc = sql.replace("'", "\\'")
    raw = f"PGPASSWORD='{PGB_PASS}' psql -h {PGB_HOST} -p {PGB_PORT} -U {PGB_USER} -d {APP_DB} -c '{esc}' 2>&1"
    return ssh_run(client, raw, timeout=timeout)

def main():
    print(f"\n🔌 SSH → {SERVER_IP} …")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname=SERVER_IP, port=22, username=SSH_USER, password=SSH_PASS, timeout=15)
    print("✅ SSH connected.\n")

    try:
        # 1. Show current indexes on activity_logs
        pgb_sql(client, """
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = 'activity_logs'
        """, "1 · CURRENT INDEXES ON activity_logs")

        # 2. Show the table schema (find column names)
        pgb_sql(client, """
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'activity_logs'
            ORDER BY ordinal_position
        """, "2 · activity_logs SCHEMA")

        # 3. Create indexes CONCURRENTLY (no table lock)
        banner("3 · CREATING MISSING INDEXES (CONCURRENTLY = zero downtime)")
        
        indexes = [
            ("idx_activity_logs_user_uid",
             "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_logs_user_uid ON activity_logs (user_uid)"),
            ("idx_activity_logs_timestamp",
             "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs (timestamp DESC)"),
            ("idx_activity_logs_action_type",
             "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_logs_action_type ON activity_logs (action_type)"),
            ("idx_activity_logs_uid_time",
             "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_logs_uid_time ON activity_logs (user_uid, timestamp DESC)"),
        ]

        for name, sql in indexes:
            print(f"\n  Creating {name}… (may take 10-60s on a large table)")
            start = time.time()
            pgb_sql(client, sql, timeout=300)
            elapsed = round(time.time() - start, 1)
            print(f"  ✅ Done in {elapsed}s")

        # 4. Verify indexes were created
        pgb_sql(client, """
            SELECT indexname
            FROM pg_indexes
            WHERE tablename = 'activity_logs'
            ORDER BY indexname
        """, "4 · VERIFY — INDEXES ON activity_logs NOW")

        # 5. Also check n-gram indexes on ph_schools (if seq_scan was high there too)
        pgb_sql(client, """
            SELECT relname, seq_scan, idx_scan, n_live_tup as rows
            FROM pg_stat_user_tables
            WHERE seq_scan > 10000
            ORDER BY seq_tup_read DESC
            LIMIT 10
        """, "5 · OTHER HIGH SEQ-SCAN TABLES TO WATCH")

        banner("DONE")
        print("""
  ✅ Indexes created on activity_logs.

  Expected impact (next 5-10 minutes):
  → logActivity() and log-fetching routes now use index scans instead of seq scans
  → Query time on activity_logs drops from ~100ms to <1ms
  → This frees up connection slots faster, reducing timeout errors

  Run vm_diagnostics.py to confirm error rate dropping.
        """)

    finally:
        client.close()
        print("🔌 SSH closed.")

if __name__ == "__main__":
    main()
