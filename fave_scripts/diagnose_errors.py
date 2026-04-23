# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

"""
diagnose_errors.py
==================
Identify the ACTUAL root cause of persisting 5xx errors after DB lock relief.
Checks: PM2 error logs, Nginx 5xx breakdown, PgBouncer pool queue depth,
        PgBouncer effective config, Azure PG user connection limits,
        and all current Azure PG sessions with full query text.

Run:
  python fave_scripts/diagnose_errors.py
"""

import paramiko
import sys

SERVER_IP = "20.24.58.49"
SSH_USER  = "Administrator1"
SSH_PASS  = "<REDACTED_SSH_PASS>"
PGB_PASS  = "<REDACTED_PGB_PASS>"
PGB_HOST  = "127.0.0.1"
PGB_PORT  = "6432"
PGB_USER  = "Administrator1"
APP_DB    = "insightEd"

def banner(title, width=70):
    print(f"\n{'═'*width}")
    print(f"  {title}")
    print(f"{'═'*width}\n")

def run(client, cmd, label=None):
    if label:
        banner(label)
    _, out, err = client.exec_command(cmd, timeout=25)
    result = out.read().decode("utf-8", errors="replace").strip()
    error  = err.read().decode("utf-8", errors="replace").strip()
    if result:
        print(result)
    elif error and "WARNING" not in error and "NOTICE" not in error:
        print(f"  (no output — stderr: {error[:200]})")
    return result

def pgb_admin(client, sql, label=None):
    if label:
        banner(label)
    cmd = (
        f"PGPASSWORD='{PGB_PASS}' psql "
        f"-h {PGB_HOST} -p {PGB_PORT} -U {PGB_USER} -d pgbouncer "
        f"-c \"{sql}\" 2>&1"
    )
    return run(client, cmd)

def pgb_sql(client, sql, label=None):
    if label:
        banner(label)
    cmd = (
        f"PGPASSWORD='{PGB_PASS}' psql "
        f"-h {PGB_HOST} -p {PGB_PORT} -U {PGB_USER} -d {APP_DB} "
        f"-c \"{sql}\" 2>&1"
    )
    return run(client, cmd)

def main():
    print(f"\n[*] SSH -> {SERVER_IP} ...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname=SERVER_IP, port=22,
                   username=SSH_USER, password=SSH_PASS, timeout=15)
    print("[OK] Connected.\n")

    try:
        # ── 1. PM2 recent errors ───────────────────────────────────────────
        run(client,
            "pm2 logs --lines 80 --nostream 2>&1 "
            "| grep -iE 'error|ERR|500|50[0-9]|timeout|exceed|reject|ECON|Cannot|cannot|crash|heap|memory' "
            "| tail -50",
            "1 · PM2 RECENT ERRORS (last 80 lines, filtered)")

        # ── 2. Nginx 5xx status code breakdown ────────────────────────────
        run(client,
            "sudo tail -1000 /var/log/nginx/access.log 2>/dev/null "
            "| awk '{print $9}' | sort | uniq -c | sort -rn | head -20",
            "2 · NGINX HTTP STATUS BREAKDOWN (last 1000 requests)")

        run(client,
            "sudo tail -200 /var/log/nginx/error.log 2>/dev/null | tail -30",
            "3 · NGINX RECENT ERROR LOG (last 30 lines)")

        # ── 4. PgBouncer pool state ────────────────────────────────────────
        pgb_admin(client,
            "SHOW POOLS;",
            "4 · PGBOUNCER SHOW POOLS (cl_waiting=queue, sv_idle=free slots)")

        pgb_admin(client,
            "SHOW STATS;",
            "5 · PGBOUNCER SHOW STATS (avg_wait_time, avg_query_time in µs)")

        # ── 6. PgBouncer effective pool config ────────────────────────────
        pgb_admin(client,
            "SHOW CONFIG;",
            "6 · PGBOUNCER SHOW CONFIG (effective values — ground truth)")

        # ── 7. Azure PG: user connection limit ────────────────────────────
        pgb_sql(client,
            "SELECT rolname, rolconnlimit, "
            "rolcanlogin, rolsuper "
            "FROM pg_roles "
            "WHERE rolname NOT LIKE 'pg_%' "
            "ORDER BY rolname;",
            "7 · AZURE PG: USER ROLE CONNECTION LIMITS (rolconnlimit=-1 means unlimited)")

        # ── 8. Azure PG: ALL current sessions with full query ─────────────
        pgb_sql(client,
            f"SELECT pid, usename, application_name, "
            f"state, wait_event_type, wait_event, "
            f"round(EXTRACT(EPOCH FROM (now()-query_start))) AS age_sec, "
            f"query "
            f"FROM pg_stat_activity "
            f"WHERE datname='{APP_DB}' "
            f"ORDER BY age_sec DESC NULLS LAST;",
            "8 · AZURE PG: ALL CURRENT SESSIONS (full query text, sorted by age)")

        # ── 9. Azure PG: database-level settings (timeouts we set) ────────
        pgb_sql(client,
            f"SELECT unnest(setconfig) AS database_setting "
            f"FROM pg_database "
            f"WHERE datname = '{APP_DB}';",
            "9 · AZURE PG: DATABASE-LEVEL TIMEOUT DEFAULTS (our ALTER DATABASE settings)")

        # ── 10. Azure PG: blocked sessions ────────────────────────────────
        pgb_sql(client,
            f"SELECT blocked.pid, blocked.state, blocked.wait_event, "
            f"blocking.pid AS blocker_pid, "
            f"round(EXTRACT(EPOCH FROM (now()-blocking.query_start))) AS blocker_age, "
            f"left(blocking.query,120) AS blocker_query "
            f"FROM pg_stat_activity blocked "
            f"JOIN pg_stat_activity blocking "
            f"  ON blocking.pid = ANY(pg_blocking_pids(blocked.pid)) "
            f"WHERE blocked.datname='{APP_DB}';",
            "10 · AZURE PG: BLOCKED SESSIONS (should be empty)")

        # ── 11. Statement timeout hits (if available) ─────────────────────
        pgb_sql(client,
            "SELECT query, calls, mean_exec_time, max_exec_time "
            "FROM pg_stat_statements "
            "WHERE mean_exec_time > 5000 "
            "ORDER BY max_exec_time DESC LIMIT 10;",
            "11 · SLOW QUERIES (mean > 5s, if pg_stat_statements enabled)")

        # ── 12. PM2 process health ─────────────────────────────────────────
        run(client,
            "pm2 ls 2>&1",
            "12 · PM2 PROCESS LIST (status, restarts, memory)")

        # ── 13. System resources ──────────────────────────────────────────
        run(client,
            "free -h && echo '---' && df -h / /mnt 2>/dev/null",
            "13 · SYSTEM MEMORY + DISK")

    finally:
        client.close()
        print("\n[*] SSH closed.\n")

if __name__ == "__main__":
    main()
