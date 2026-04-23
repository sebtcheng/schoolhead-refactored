#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fix_pgbouncer_transaction_mode.py
==================================
Checks and switches PgBouncer pool_mode from 'session' to 'transaction'.

In SESSION mode:  each client holds a real Azure PG connection for the
                  entire HTTP session → 40 clients need 40 PG slots → timeouts.
In TRANSACTION mode: a real connection is only held during an active query →
                  40 clients can share 25 slots easily → no queueing.

Run:
  python fave_scripts/fix_pgbouncer_transaction_mode.py
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

def banner(title):
    print(f"\n{'='*72}\n  {title}\n{'='*72}")

def ssh_run(client, cmd, timeout=20):
    _, out, err = client.exec_command(cmd, timeout=timeout)
    stdout = out.read().decode('utf-8', errors='replace').strip()
    stderr = err.read().decode('utf-8', errors='replace').strip()
    if stdout: print(stdout)
    noise = {"WARNING", "NOTICE", "SSL connection"}
    errs = [l for l in stderr.splitlines() if l and not any(n in l for n in noise)]
    if errs: print(f"  [STDERR] {chr(10).join(errs)}")
    return stdout

def pgb_admin(client, cmd):
    esc = cmd.replace("'", "\\'")
    raw = f"PGPASSWORD='{PGB_PASS}' psql -h {PGB_HOST} -p {PGB_PORT} -U {PGB_USER} -d pgbouncer -c '{esc}' 2>&1"
    return ssh_run(client, raw)

def main():
    print(f"\n🔌 SSH → {SERVER_IP} …")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname=SERVER_IP, port=22, username=SSH_USER, password=SSH_PASS, timeout=15)
    print("✅ SSH connected.\n")

    try:
        # --- 1. Check current pool_mode ---
        banner("STEP 1 — CHECK CURRENT PGBOUNCER CONFIG")
        config_out = pgb_admin(client, "SHOW CONFIG;")

        pool_mode = None
        for line in config_out.splitlines():
            if 'pool_mode' in line and '|' in line:
                parts = [p.strip() for p in line.split('|')]
                if len(parts) >= 2:
                    pool_mode = parts[1].strip()
                    break

        print(f"\n  📊 Current pool_mode: {pool_mode or 'UNKNOWN'}")

        if pool_mode == 'transaction':
            print("  ✅ Already in transaction mode! The timeout errors have a different cause.")
            print("     Run the diagnostics again to check for slow queries.")
            return

        # --- 2. Find pgbouncer.ini ---
        banner("STEP 2 — FIND pgbouncer.ini PATH")
        proc_out = ssh_run(client, "ps aux | grep pgbouncer | grep -v grep")
        ini_path = "/etc/pgbouncer/pgbouncer.ini"  # default
        for part in proc_out.split():
            if part.endswith('.ini'):
                ini_path = part
                break

        print(f"\n  📁 pgbouncer.ini: {ini_path}")

        # --- 3. Show current pool_mode in file ---
        ssh_run(client, f"grep -i 'pool_mode' {ini_path}", timeout=5)

        # --- 4. Backup and patch pgbouncer.ini ---
        banner("STEP 3 — PATCH pgbouncer.ini: session → transaction")
        print(f"\n  Backing up {ini_path}…")
        ssh_run(client, f"sudo cp {ini_path} {ini_path}.bak.$(date +%Y%m%d_%H%M%S) && echo BACKUP_OK")

        print("  Patching pool_mode to 'transaction'…")
        result = ssh_run(client,
            f"sudo sed -i 's/pool_mode\\s*=\\s*session/pool_mode = transaction/g' {ini_path} && echo SED_OK")
        if "SED_OK" not in result:
            print("  ⚠️  sed may have failed. Checking if line exists…")
            check = ssh_run(client, f"grep -i 'pool_mode' {ini_path}")
            if 'transaction' not in check:
                print("  ➕ Adding pool_mode = transaction to ini…")
                ssh_run(client,
                    f"echo 'pool_mode = transaction' | sudo tee -a {ini_path} && echo ADDED")

        print("\n  Verifying patch in file:")
        ssh_run(client, f"grep -i 'pool_mode' {ini_path}")

        # --- 5. Reload PgBouncer (no downtime for ini changes) ---
        banner("STEP 4 — RELOAD PGBOUNCER (zero-downtime)")
        print("\n  Sending RELOAD to PgBouncer admin (picks up new config)…")
        pgb_admin(client, "RELOAD;")
        time.sleep(2)

        # --- 6. KILL+RESUME to drop old session-mode connections ---
        banner("STEP 5 — KILL + RESUME (drop old session connections)")
        print("  Dropping old session-mode server connections…")
        pgb_admin(client, 'KILL "insightEd";')
        time.sleep(2)
        pgb_admin(client, 'RESUME "insightEd";')
        time.sleep(3)

        # --- 7. Verify new mode ---
        banner("STEP 6 — VERIFY NEW CONFIG")
        verify_out = pgb_admin(client, "SHOW CONFIG;")
        new_mode = None
        for line in verify_out.splitlines():
            if 'pool_mode' in line and '|' in line:
                parts = [p.strip() for p in line.split('|')]
                if len(parts) >= 2:
                    new_mode = parts[1].strip()
                    break

        print(f"\n  📊 New pool_mode: {new_mode or 'UNKNOWN'}")

        if new_mode == 'transaction':
            print("\n  ✅ PgBouncer is now in TRANSACTION mode!")
            print("  → 40 client connections (8 workers × 5) now share 25 Azure PG slots efficiently.")
            print("  → Server errors should drop to near-zero in the next 30–60 seconds.")
        else:
            print(f"\n  ⚠️  pool_mode is still '{new_mode}'.")
            print("     Attempting full pgbouncer service restart…")
            ssh_run(client, "sudo systemctl restart pgbouncer && echo RESTART_OK", timeout=15)
            time.sleep(5)
            pgb_admin(client, "SHOW CONFIG;")

        pgb_admin(client, "SHOW POOLS;")

    finally:
        client.close()
        print("\n🔌 SSH closed.")

if __name__ == "__main__":
    main()
