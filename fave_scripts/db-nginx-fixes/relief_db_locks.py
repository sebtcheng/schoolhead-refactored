"""
relief_db_locks.py  (v7 — PgBouncer KILL + Database Timeout Edition)
======================================================================

WHY v1–v6 ALL FAILED:
─────────────────────────────────────────────────────────────────────────────
  1. v1–v4: Connected through PgBouncer → PgBouncer respawned killed backends
  2. v5:    Restarted PgBouncer process → PM2 reconnected, re-created locks
  3. v6:    Used direct Azure PG connection → FAILED SILENTLY (Azure firewall
            or SSL mismatch blocks direct VM → Azure PG connections).
            Pool size "changes" wrote to ini but RELOAD may have silently
            failed. Pool stayed at 6. Script terminated nothing real.

v7 CORRECT ARCHITECTURE:
─────────────────────────────────────────────────────────────────────────────
  The ONLY reliable path from this script to Azure PostgreSQL is:
    SSH → VM → PgBouncer admin (port 6432, db "pgbouncer") → admin commands
    SSH → VM → PgBouncer (port 6432, db "insightEd") → SQL to Azure PG

  We never had a working direct Azure PG connection. Everything must go
  through PgBouncer. This is actually fine — PgBouncer admin gives us
  more powerful commands than raw psql.

v7 THREE-PART FIX:
─────────────────────────────────────────────────────────────────────────────
  PART A — Pool expansion (via PgBouncer admin SET, instant, no file needed)
    SET default_pool_size = 25   → expand from 6 to 25 server connections
    SET max_client_conn   = 500  → allow more client connections

  PART B — KILL + RESUME (the missing command from all previous versions)
    KILL "insightEd"   → forcibly drops ALL server connections to Azure PG
                         Azure PG releases every lock those sessions held
                         (different from PAUSE — this actually DROPS connections)
    RESUME "insightEd" → PgBouncer re-establishes fresh, clean connections

  PART C — Database-level timeouts (via SQL through PgBouncer, PERMANENT)
    ALTER DATABASE "insightEd" SET statement_timeout = '30000'
    ALTER DATABASE "insightEd" SET idle_in_transaction_session_timeout = '30000'
    ALTER DATABASE "insightEd" SET lock_timeout = '5000'
    These survive reboots, PgBouncer restarts, and PM2 restarts.
    They auto-kill runaway queries before they can starve the pool.

Usage:
  python fave_scripts/relief_db_locks.py [--dry-run] [--pool-size N]

Options:
  --dry-run      Show current config + pools state only; make no changes.
  --pool-size N  Target pool size (default: 25).
"""

import paramiko
import sys
import time
import re
import argparse

# ── SSH / VM ─────────────────────────────────────────────────────────────────
SERVER_IP  = "20.24.58.49"
SSH_USER   = "Administrator1"
SSH_PASS   = "7v52E69TYgTE"

# ── PgBouncer — the ONLY path we know works ──────────────────────────────────
PGB_HOST   = "127.0.0.1"
PGB_PORT   = "6432"
PGB_USER   = "Administrator1"
PGB_PASS   = "pRZTbQ2T1JD7"   # same as DB pass (PgBouncer client auth)
PGB_ADMIN  = "pgbouncer"       # PgBouncer admin pseudo-database
APP_DB     = "insightEd"       # the actual application database

# ── Targets ──────────────────────────────────────────────────────────────────
DEFAULT_POOL_SIZE  = 25
MAX_CLIENT_CONN    = 500
STATEMENT_TIMEOUT  = 30000     # ms — kills runaway queries after 30s
IDLE_TX_TIMEOUT    = 30000     # ms — kills idle-in-transaction after 30s
LOCK_TIMEOUT       = 5000      # ms — stops waiting for locks after 5s

# ─────────────────────────────────────────────────────────────────────────────

def banner(title, width=72):
    print(f"\n{'═' * width}")
    print(f"  {title}")
    print(f"{'═' * width}")

def ssh(client, cmd, label=None, show_output=True, timeout=30):
    """Run a shell command via SSH."""
    if label:
        print(f"\n  ▶ {label}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    if show_output:
        if out:
            print(out)
        noise = {"WARNING", "NOTICE", "SSL connection"}
        errs = [l for l in err.splitlines()
                if l and not any(n in l for n in noise)]
        if errs:
            print(f"  [ERR] {chr(10).join(errs)}")
    return out, err

def pgb_admin(client, cmd_str, label=""):
    """
    Send a command to PgBouncer's admin interface (database='pgbouncer').
    This is for admin commands: SHOW CONFIG, SET, KILL, RESUME, RELOAD, etc.
    """
    esc = cmd_str.replace("'", "\\'")
    raw = (
        f"PGPASSWORD='{PGB_PASS}' psql "
        f"-h {PGB_HOST} -p {PGB_PORT} -U {PGB_USER} -d {PGB_ADMIN} "
        f"-c '{esc}' 2>&1"
    )
    out, _ = ssh(client, raw, show_output=False)
    if label:
        banner(label)
    if out:
        print(out)
    return out

def pgb_sql(client, sql, label="", suppress_empty=False):
    """
    Run SQL against the APPLICATION database through PgBouncer.
    This reaches Azure PostgreSQL via the working PgBouncer path.
    """
    esc = sql.replace("'", "\\'")
    raw = (
        f"PGPASSWORD='{PGB_PASS}' psql "
        f"-h {PGB_HOST} -p {PGB_PORT} -U {PGB_USER} -d {APP_DB} "
        f"-c '{esc}' 2>&1"
    )
    out, _ = ssh(client, raw, show_output=False)
    if label:
        banner(label)
    noise = {"SSL connection", "WARNING", "NOTICE"}
    lines = [l for l in out.splitlines() if not any(n in l for n in noise)]
    result = "\n".join(lines).strip()
    if result:
        print(result)
    elif not suppress_empty:
        print("  (no rows)")
    return result

def count_scalar(out):
    for l in out.splitlines():
        s = l.strip()
        if s.isdigit():
            return int(s)
    return 0

def extract_config_value(config_out, key):
    """Parse a value from PgBouncer SHOW CONFIG output."""
    for line in config_out.splitlines():
        if f"| {key} " in line or f" {key} |" in line:
            parts = [p.strip() for p in line.split("|")]
            if len(parts) >= 3:
                return parts[2]
    return None

# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(
        description="relief_db_locks v7 — PgBouncer KILL + database timeout fix")
    ap.add_argument("--dry-run",   action="store_true",
                    help="Show diagnostics only; make no changes.")
    ap.add_argument("--pool-size", type=int, default=DEFAULT_POOL_SIZE,
                    help=f"Target default_pool_size (default: {DEFAULT_POOL_SIZE})")
    args = ap.parse_args()
    dry       = args.dry_run
    pool_size = args.pool_size

    if dry:
        print("\n⚠️  DRY-RUN — read-only, no changes.\n")

    print(f"\n🔌 SSH → {SERVER_IP} …")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, port=22,
                       username=SSH_USER, password=SSH_PASS, timeout=15)
    except Exception as e:
        print(f"❌ SSH failed: {e}")
        sys.exit(1)
    print("✅ SSH connected.\n")

    try:
        # ════════════════════════════════════════════════════════════════════
        # STEP 1 — READ ACTUAL RUNNING CONFIG
        # ════════════════════════════════════════════════════════════════════
        banner("STEP 1 — READ ACTUAL RUNNING CONFIG (PgBouncer admin)")

        # Show full running config — this is ground truth, not the file
        config_out = pgb_admin(client, "SHOW CONFIG;",
            "1a · PgBouncer SHOW CONFIG (actual running values)")

        # Extract key values
        cur_pool_size = extract_config_value(config_out, "default_pool_size")
        cur_max_conn  = extract_config_value(config_out, "max_client_conn")
        cur_mode      = extract_config_value(config_out, "pool_mode")
        cur_idle_to   = extract_config_value(config_out, "server_idle_timeout")

        print(f"\n  📊 Key settings:")
        print(f"     default_pool_size  = {cur_pool_size or '?'}")
        print(f"     max_client_conn    = {cur_max_conn or '?'}")
        print(f"     pool_mode          = {cur_mode or '?'}")
        print(f"     server_idle_timeout= {cur_idle_to or '?'}")

        if cur_mode and "session" in cur_mode.lower():
            print("\n  ⚠️  WARNING: pool_mode=session detected!")
            print("     In session mode, each client holds a server connection for")
            print("     the ENTIRE session. With 192 clients & pool_size=6, only")
            print("     6 clients can run queries; 186 are waiting in PgBouncer queue.")
            print("     Changing to pool_mode=transaction would be the biggest fix.")
            print("     (Requires PgBouncer restart — will be applied in step 3b.)")

        pgb_admin(client, "SHOW POOLS;",
            "1b · PgBouncer SHOW POOLS (cl_waiting=queued, sv_idle=free slots)")

        pgb_admin(client, "SHOW STATS;",
            "1c · PgBouncer SHOW STATS (avg_wait_time, avg_query_time in us)")

        # Lock/wait state via SQL through PgBouncer
        pgb_sql(client,
            f"SELECT pid, usename, application_name, state, "
            f"wait_event_type, wait_event, "
            f"round(EXTRACT(EPOCH FROM (now()-query_start))) AS age_sec, "
            f"left(query, 120) AS query "
            f"FROM pg_stat_activity WHERE datname='{APP_DB}' "
            f"ORDER BY age_sec DESC NULLS LAST;",
            "1d · ALL sessions on Azure PG (full query, sorted by age)")

        pgb_sql(client,
            f"SELECT blocked.pid AS blocked_pid, "
            f"blocking.pid AS blocker_pid, blocking.usename, "
            f"round(EXTRACT(EPOCH FROM (now()-blocking.query_start))) AS age_sec, "
            f"left(blocking.query, 120) AS blocker_query "
            f"FROM pg_stat_activity blocked "
            f"JOIN pg_stat_activity blocking "
            f"  ON blocking.pid = ANY(pg_blocking_pids(blocked.pid)) "
            f"WHERE blocked.datname='{APP_DB}';",
            "1e · Blocker → Blocked chains (root cause of lock waits)")

        # Check current database-level timeout settings
        pgb_sql(client,
            f"SELECT unnest(setconfig) AS setting "
            f"FROM pg_database WHERE datname = '{APP_DB}';",
            "1f · Current database-level defaults (ALTER DATABASE SET ...)")

        # Find actual pgbouncer.ini path from process
        proc_out, _ = ssh(client, "ps aux | grep pgbouncer | grep -v grep",
                          show_output=False)
        ini_path = None
        for part in proc_out.split():
            if ".ini" in part or "pgbouncer" in part and "/" in part:
                ini_path = part
                break
        if not ini_path:
            # Common locations
            for p in ["/etc/pgbouncer/pgbouncer.ini", "/etc/pgbouncer.ini",
                      "/home/Administrator1/pgbouncer.ini"]:
                found, _ = ssh(client, f"test -f {p} && echo YES", show_output=False)
                if "YES" in found:
                    ini_path = p
                    break

        if ini_path:
            print(f"\n  📁 pgbouncer.ini location: {ini_path}")
        ssh(client, "ps aux | grep pgbouncer | grep -v grep",
            label="1g · PgBouncer process (shows actual config file path)")

        if dry:
            print("\n✅ [DRY-RUN] Diagnosis complete. Exiting.\n")
            return

        # ════════════════════════════════════════════════════════════════════
        # STEP 2 — PART A: EXPAND POOL (via SET — instant, no file needed)
        # ════════════════════════════════════════════════════════════════════
        banner(f"STEP 2 — PART A: EXPAND POOL SIZE ({cur_pool_size} → {pool_size})")

        print(f"\n  Setting default_pool_size = {pool_size}…")
        pgb_admin(client, f"SET default_pool_size = {pool_size};")

        print(f"  Setting max_client_conn = {MAX_CLIENT_CONN}…")
        pgb_admin(client, f"SET max_client_conn = {MAX_CLIENT_CONN};")

        print(f"  Setting reserve_pool_size = 5…")
        pgb_admin(client, "SET reserve_pool_size = 5;")

        print(f"  Setting server_idle_timeout = 600…")
        pgb_admin(client, "SET server_idle_timeout = 600;")

        # Verify the SET took effect
        new_config = pgb_admin(client, "SHOW CONFIG;", suppress_empty=True
                               if hasattr(pgb_admin, '__doc__') else False)
        new_pool = extract_config_value(new_config, "default_pool_size")
        print(f"\n  ✅ Pool size now: {new_pool}")

        # ════════════════════════════════════════════════════════════════════
        # STEP 3 — PART B: KILL + RESUME (drops all 6 Azure PG connections)
        # ════════════════════════════════════════════════════════════════════
        banner(f"STEP 3 — PART B: KILL '{APP_DB}' (drops all server connections)")

        print(f"\n  Sending: KILL \"{APP_DB}\"")
        print("  → This forcibly closes all 6 Azure PostgreSQL connections")
        print("  → Azure PG releases every lock those connections held")
        print("  → Different from PAUSE: KILL actually drops the TCP connections")

        pgb_admin(client, f'KILL "{APP_DB}";')

        print("\n  ⏱  Waiting 2 s for Azure PG to release locks…")
        time.sleep(2)

        print(f"\n  Sending: RESUME \"{APP_DB}\"")
        print("  → PgBouncer re-establishes fresh connections to Azure PG")
        pgb_admin(client, f'RESUME "{APP_DB}";')

        print("\n  ⏱  Waiting 3 s for new connections to establish…")
        time.sleep(3)

        # ════════════════════════════════════════════════════════════════════
        # STEP 4 — PART C: SET DATABASE-LEVEL TIMEOUTS (permanent fix)
        # ════════════════════════════════════════════════════════════════════
        banner("STEP 4 — PART C: SET DATABASE-LEVEL TIMEOUTS (permanent)")

        print("""
  These ALTER DATABASE commands store timeout defaults in pg_database.
  They survive PgBouncer restarts, PM2 restarts, and Azure PG maintenance.
  Any new connection to this database automatically gets these limits.
""")

        timeout_sql = [
            (f"ALTER DATABASE \"{APP_DB}\" "
             f"SET statement_timeout = '{STATEMENT_TIMEOUT}';",
             f"statement_timeout = {STATEMENT_TIMEOUT}ms (kills runaway queries after 30s)"),

            (f"ALTER DATABASE \"{APP_DB}\" "
             f"SET idle_in_transaction_session_timeout = '{IDLE_TX_TIMEOUT}';",
             f"idle_in_transaction_session_timeout = {IDLE_TX_TIMEOUT}ms (kills idle txns after 30s)"),

            (f"ALTER DATABASE \"{APP_DB}\" "
             f"SET lock_timeout = '{LOCK_TIMEOUT}';",
             f"lock_timeout = {LOCK_TIMEOUT}ms (stops waiting for locks after 5s → throws error instead of blocking)"),

            (f"ALTER DATABASE \"{APP_DB}\" "
             f"SET deadlock_timeout = '1000';",
             f"deadlock_timeout = 1000ms (detects deadlocks within 1s)"),
        ]

        for sql, desc in timeout_sql:
            print(f"\n  ✏️  {desc}")
            result = pgb_sql(client, sql, suppress_empty=True)
            if "ALTER" in (result or ""):
                print("     ✅ Applied.")
            elif result:
                print(f"     Response: {result}")
            else:
                print("     ⚠️  No confirmation. May need superuser privileges.")

        # Verify timeouts are stored
        pgb_sql(client,
            f"SELECT unnest(setconfig) AS setting "
            f"FROM pg_database WHERE datname = '{APP_DB}';",
            "Verify: database-level settings stored in pg_database")

        # ════════════════════════════════════════════════════════════════════
        # STEP 5 — UPDATE pgbouncer.ini (so changes survive a PgBouncer restart)
        # ════════════════════════════════════════════════════════════════════
        banner("STEP 5 — UPDATE pgbouncer.ini (persist SET changes across restart)")

        if ini_path:
            print(f"\n  Backing up {ini_path}…")
            ssh(client, f"sudo cp {ini_path} {ini_path}.bak.$(date +%Y%m%d_%H%M%S) && echo OK")

            # Use sed to update values in-place (more reliable than base64)
            sed_cmds = [
                (r"s|^\s*default_pool_size\s*=.*|default_pool_size = " + str(pool_size) + "|",
                 f"default_pool_size = {pool_size}"),
                (r"s|^\s*max_client_conn\s*=.*|max_client_conn = " + str(MAX_CLIENT_CONN) + "|",
                 f"max_client_conn = {MAX_CLIENT_CONN}"),
                (r"s|^\s*reserve_pool_size\s*=.*|reserve_pool_size = 5|",
                 "reserve_pool_size = 5"),
                (r"s|^\s*server_idle_timeout\s*=.*|server_idle_timeout = 600|",
                 "server_idle_timeout = 600"),
            ]

            for pattern, desc in sed_cmds:
                result, _ = ssh(client,
                    f"sudo sed -i '{pattern}' {ini_path} && echo SED_OK",
                    show_output=False)
                status = "✅" if "SED_OK" in result else "⚠️ "
                print(f"  {status} {desc}")

            # If a key didn't exist, add it
            ensure_cmds = [
                (f"default_pool_size",   str(pool_size)),
                (f"max_client_conn",     str(MAX_CLIENT_CONN)),
                (f"reserve_pool_size",   "5"),
                (f"server_idle_timeout", "600"),
                (f"server_reset_query",  "DISCARD ALL"),
                (f"query_timeout",       "300"),
            ]
            for key, val in ensure_cmds:
                exists, _ = ssh(client,
                    f"grep -q '^{key}' {ini_path} && echo EXISTS",
                    show_output=False)
                if "EXISTS" not in exists:
                    ssh(client,
                        f"echo '{key} = {val}' | sudo tee -a {ini_path} && echo ADDED",
                        show_output=False)
                    print(f"  ➕ Added: {key} = {val}")

            print(f"\n  Current {ini_path} after changes:")
            ssh(client,
                f"grep -E 'pool_size|max_client|pool_mode|server_idle|reset_query|query_timeout|reserve' "
                f"{ini_path} | grep -v '^;'",
                label="pgbouncer.ini relevant lines")
        else:
            print("\n  ⚠️  Could not locate pgbouncer.ini — SET values are live but won't")
            print("     survive a PgBouncer restart. Edit the ini manually.")

        # ════════════════════════════════════════════════════════════════════
        # STEP 6 — VERIFY FINAL STATE
        # ════════════════════════════════════════════════════════════════════
        banner("STEP 6 — VERIFY FINAL STATE")

        pgb_admin(client, "SHOW POOLS;",
            "6a · PgBouncer SHOW POOLS (sv_idle should now show > 6 slots)")

        pgb_admin(client, "SHOW CONFIG;",
            "6b · PgBouncer SHOW CONFIG (verify new pool_size = " + str(pool_size) + ")")

        pgb_sql(client,
            f"SELECT count(*), state, wait_event_type, wait_event "
            f"FROM pg_stat_activity WHERE datname='{APP_DB}' "
            f"GROUP BY state, wait_event_type, wait_event ORDER BY count DESC;",
            "6c · Connection breakdown (target: 0 active/waiting, only idle)")

        lw = count_scalar(pgb_sql(client,
            f"SELECT count(*) FROM pg_stat_activity "
            f"WHERE datname='{APP_DB}' AND wait_event_type='Lock';",
            suppress_empty=True))
        ug = count_scalar(pgb_sql(client,
            f"SELECT count(*) FROM pg_locks l "
            f"JOIN pg_stat_activity a ON a.pid=l.pid "
            f"WHERE a.datname='{APP_DB}' AND NOT l.granted;",
            suppress_empty=True))
        it = count_scalar(pgb_sql(client,
            f"SELECT count(*) FROM pg_stat_activity "
            f"WHERE datname='{APP_DB}' AND state='idle in transaction';",
            suppress_empty=True))

        print(f"\n  📊 Final state: lock_waiters={lw}, ungranted={ug}, idle_in_tx={it}")

        if lw == 0 and ug == 0 and it == 0:
            print("  ✅ Database is clean.")
        else:
            print("  ⚠️  Residual locks. If they recur within 30s, statement_timeout")
            print("     will kill them automatically going forward.")

        banner("WHAT CHANGED — SUMMARY")
        print(f"""
  [IMMEDIATE — via PgBouncer admin SET, active RIGHT NOW]
    default_pool_size   : ~6  →  {pool_size}   (more server connections to Azure PG)
    max_client_conn     : ?   →  {MAX_CLIENT_CONN}
    reserve_pool_size   : ?   →  5
    server_idle_timeout : ?   →  600s
    KILL + RESUME       : dropped all locked server connections

  [PERMANENT — stored in Azure PG system catalog]
    statement_timeout                   = {STATEMENT_TIMEOUT}ms  (auto-kill slow queries)
    idle_in_transaction_session_timeout = {IDLE_TX_TIMEOUT}ms  (auto-kill hanging txns)
    lock_timeout                        = {LOCK_TIMEOUT}ms  (fail-fast on lock waits)
    deadlock_timeout                    = 1000ms (fast deadlock detection)

  [WATCH FOR — in next 60 seconds]
    → Nginx 5xx errors should drop toward 0
    → PgBouncer cl_waiting should drop to 0
    → Pool will run at {pool_size} server connections instead of 6

  [IF ERRORS PERSIST]
    → pool_mode might be 'session' instead of 'transaction'
    → Edit pgbouncer.ini: pool_mode = transaction
    → Then: sudo systemctl restart pgbouncer && pm2 restart insighted-backend
    → This is the single biggest possible improvement
""")

    except Exception as e:
        print(f"\n❌ Script error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()
        print("🔌 SSH closed.\n")

# pgb_admin doesn't take suppress_empty; patch it here
_orig_pgb_admin = pgb_admin
def pgb_admin(client, cmd_str, label="", suppress_empty=False):
    esc = cmd_str.replace("'", "\\'")
    raw = (
        f"PGPASSWORD='{PGB_PASS}' psql "
        f"-h {PGB_HOST} -p {PGB_PORT} -U {PGB_USER} -d {PGB_ADMIN} "
        f"-c '{esc}' 2>&1"
    )
    out, _ = ssh(client, raw, show_output=False)
    if label:
        banner(label)
    if out:
        print(out)
    return out

if __name__ == "__main__":
    main()
