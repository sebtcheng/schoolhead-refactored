#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fix_activity_logs_index_v3.py
===========================
Creates missing indexes on activity_logs CONCURRENTLY (no table lock, zero downtime).
Fixed escaping for PSQL commands.
"""
import paramiko, sys, io, time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

SERVER_IP = "20.24.58.49"
SSH_USER  = "Administrator1"
SSH_PASS  = "<REDACTED_SSH_PASS>"
PGB_HOST  = "127.0.0.1"
PGB_PORT  = "6432"
PGB_USER  = "Administrator1"
PGB_PASS  = "<REDACTED_PGB_PASS>"
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

def pgb_sql(client, sql, label="", timeout=600):
    if label: banner(label)
    # Use triple-double-quotes for the psql command to avoid shell escaping issues with single quotes
    sql_escaped = sql.replace('"', '\\"')
    raw = f'PGPASSWORD="{PGB_PASS}" psql -h {PGB_HOST} -p {PGB_PORT} -U {PGB_USER} -d {APP_DB} -c "{sql_escaped}" 2>&1'
    return ssh_run(client, raw, timeout=timeout)

def main():
    print(f"\n🔌 SSH → {SERVER_IP} …")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname=SERVER_IP, port=22, username=SSH_USER, password=SSH_PASS, timeout=15)
    print("✅ SSH connected.\n")

    try:
        # 1. Create indexes CONCURRENTLY
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
            print(f"\n  Creating {name}… (may take 10-600s on a large table)")
            start = time.time()
            pgb_sql(client, sql, timeout=600)
            elapsed = round(time.time() - start, 1)
            print(f"  ✅ Done in {elapsed}s")

        # 2. Verify
        pgb_sql(client, "SELECT indexname FROM pg_indexes WHERE tablename = 'activity_logs' ORDER BY indexname", "4 · VERIFY — INDEXES ON activity_logs NOW")

        banner("DONE")
    finally:
        client.close()
        print("🔌 SSH closed.")

if __name__ == "__main__":
    main()
