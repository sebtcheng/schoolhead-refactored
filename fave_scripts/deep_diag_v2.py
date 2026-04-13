#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
deep_diag_v2.py
===============
Focused diagnostic on top 5xx endpoints and slow query patterns.
"""
import paramiko, sys, io

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

def ssh_run(client, cmd, timeout=30):
    _, out, err = client.exec_command(cmd, timeout=timeout)
    stdout = out.read().decode('utf-8', errors='replace').strip()
    stderr = err.read().decode('utf-8', errors='replace').strip()
    if stdout: print(stdout)
    noise = {"WARNING","NOTICE","SSL connection"}
    errs = [l for l in stderr.splitlines() if l and not any(n in l for n in noise)]
    if errs: print(f"  [ERR] {chr(10).join(errs[:5])}")
    return stdout

def pgb_sql(client, sql, label=""):
    if label: banner(label)
    esc = sql.replace("'", "\\'")
    raw = f"PGPASSWORD='{PGB_PASS}' psql -h {PGB_HOST} -p {PGB_PORT} -U {PGB_USER} -d {APP_DB} -x -c '{esc}' 2>&1"
    return ssh_run(client, raw)

def main():
    print(f"\n🔌 SSH → {SERVER_IP} …")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname=SERVER_IP, port=22, username=SSH_USER, password=SSH_PASS, timeout=15)
    print("✅ SSH connected.\n")

    try:
        # 1. Top 5xx endpoints by count
        banner("1 · TOP 5xx ENDPOINTS (last 2000 nginx requests)")
        ssh_run(client,
            "sudo tail -2000 /var/log/nginx/access.log 2>/dev/null "
            r"| awk '$9 ~ /^5/ {print $9, $7}' | sort | uniq -c | sort -rn | head -20")

        # 2. PM2 errors - filter for timeout/connection keywords
        banner("2 · PM2 ERROR KEYWORDS (last 300 log lines)")
        ssh_run(client,
            "pm2 logs insighted-backend --lines 300 --nostream 2>&1 "
            "| grep -vE '^\\[|PM2\\[' "
            "| grep -iE 'timeout|statement_timeout|lock_timeout|connection|pool|ERR_|500|canceling|too many|ETIMEDOUT|ECONNREFUSED' "
            "| tail -30",
            timeout=30)

        # 3. Slow queries in pg_stat_statements if enabled
        pgb_sql(client, f"""
            SELECT round(mean_exec_time::numeric, 0) as mean_ms,
                   round(max_exec_time::numeric, 0) as max_ms,
                   calls,
                   left(query, 250) as query
            FROM pg_stat_statements
            WHERE mean_exec_time > 1000
              AND dbid = (SELECT oid FROM pg_database WHERE datname='{APP_DB}')
            ORDER BY max_exec_time DESC
            LIMIT 10
        """, "3 · SLOWEST QUERIES (pg_stat_statements, mean>1s)")

        # 4. Tables with high sequential scans (missing index candidates)
        pgb_sql(client, f"""
            SELECT relname AS table,
                   seq_scan,
                   seq_tup_read,
                   idx_scan,
                   n_live_tup AS rows
            FROM pg_stat_user_tables
            WHERE seq_scan > 100
            ORDER BY seq_tup_read DESC
            LIMIT 15
        """, "4 · HIGH SEQ SCAN TABLES (missing index candidates)")

    finally:
        client.close()
        print("\n🔌 SSH closed.")

if __name__ == "__main__":
    main()
