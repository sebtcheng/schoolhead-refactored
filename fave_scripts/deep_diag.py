#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
deep_diag.py
============
Deep diagnostic to find the actual source of timeout errors:
- PM2 error log tail (last 50 filtered lines)
- Active + waiting PG sessions
- Slow queries (>2s)
- Nginx 5xx breakdown by URL
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

def ssh_run(client, cmd, timeout=20):
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
    raw = f"PGPASSWORD='{PGB_PASS}' psql -h {PGB_HOST} -p {PGB_PORT} -U {PGB_USER} -d {APP_DB} -c '{esc}' 2>&1"
    return ssh_run(client, raw)

def main():
    print(f"\n🔌 SSH → {SERVER_IP} …")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname=SERVER_IP, port=22, username=SSH_USER, password=SSH_PASS, timeout=15)
    print("✅ SSH connected.\n")

    try:
        # 1. PM2 error log — timeout/error lines
        banner("1 · PM2 RECENT ERRORS (timeout, ERR, 500, statement_timeout, lock_timeout)")
        ssh_run(client,
            "pm2 logs --lines 200 --nostream 2>&1 "
            "| grep -iE 'timeout|ERR|500|statement_timeout|lock_timeout|canceling|too many|pool|ECON|Cannot connect' "
            "| tail -40",
            timeout=30)

        # 2. Current PG session state
        pgb_sql(client, f"""
            SELECT state, wait_event_type, wait_event, count(*) as cnt,
                   max(round(EXTRACT(EPOCH FROM (now()-query_start)))) as max_age_sec
            FROM pg_stat_activity
            WHERE datname='{APP_DB}'
            GROUP BY state, wait_event_type, wait_event
            ORDER BY cnt DESC
        """, "2 · CURRENT PG SESSION BREAKDOWN")

        # 3. Queries running >2s
        pgb_sql(client, f"""
            SELECT pid, state, wait_event_type, wait_event,
                   round(EXTRACT(EPOCH FROM (now()-query_start))) AS age_sec,
                   left(query, 300) AS query
            FROM pg_stat_activity
            WHERE datname='{APP_DB}'
              AND state != 'idle'
              AND query_start IS NOT NULL
              AND EXTRACT(EPOCH FROM (now()-query_start)) > 2
            ORDER BY age_sec DESC
            LIMIT 10
        """, "3 · SLOW QUERIES >2s RIGHT NOW")

        # 4. Nginx most-errored URLs
        banner("4 · TOP ERRORING URLS (Nginx 5xx last 500 requests)")
        ssh_run(client,
            "sudo tail -500 /var/log/nginx/access.log 2>/dev/null "
            "| awk '$9 ~ /^5/ {print $7}' | sort | uniq -c | sort -rn | head -20",
            timeout=15)

        # 5. PgBouncer pool state
        banner("5 · PGBOUNCER POOL STATE")
        esc = "SHOW POOLS;"
        raw = f"PGPASSWORD='{PGB_PASS}' psql -h {PGB_HOST} -p {PGB_PORT} -U {PGB_USER} -d pgbouncer -c '{esc}' 2>&1"
        ssh_run(client, raw)

    finally:
        client.close()
        print("\n🔌 SSH closed.")

if __name__ == "__main__":
    main()
