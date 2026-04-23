"""
deep_relief_db.py  (v1.0 — The "Nuclear Option")
======================================================================
Use this when fave_scripts/relief_db_locks.py fails to resolve 5xx errors.

WHAT THIS DOES:
1. Audits .env for PgBouncer bypass (port 6432 vs Azure Host).
2. Fixes .env to use 127.0.0.1:6432 if misconfigured.
3. Identifies and SIGKILLs "Zombie" PM2 processes that won't restart.
4. Triggers relief_db_locks.py for final pool stabilization.
"""

import paramiko
import json
import time
import sys
import io

# ── VM Configuration ──────────────────────────────────────────────────────────
SERVER_IP = "20.24.58.49"
USER      = "Administrator1"
PASS      = "<REDACTED_SSH_PASS>"

# Set up utf-8 output for Windows terminals
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def run_ssh(client, cmd, label=None):
    if label: print(f"\n[>] {label}")
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    return out, err

def main():
    print(f"🚀 Initializing Deep Relief for {SERVER_IP}...")
    
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(SERVER_IP, 22, USER, PASS, timeout=15)
    except Exception as e:
        print(f"❌ SSH Connection failed: {e}")
        return

    # STEP 1: Audit & Fix .env
    print("\n--- STEP 1: Auditing .env Configuration ---")
    dot_env_path = "/var/www/html/InsightEd-Mobile-PWA/.env"
    out, _ = run_ssh(client, f"cat {dot_env_path} | grep DATABASE_URL")
    
    if "127.0.0.1:6432" not in out:
        print(f"⚠️  BYPASS DETECTED: {out}")
        print("🔧 Re-routing DATABASE_URL to local PgBouncer (127.0.0.1:6432)...")
        fix_cmd = f"sudo sed -i 's|DATABASE_URL=.*|DATABASE_URL=postgres://Administrator1:<REDACTED_PGB_PASS>@127.0.0.1:6432/insightEd|' {dot_env_path}"
        run_ssh(client, fix_cmd)
        print("✅ .env updated.")
    else:
        print("✅ .env is correctly routing through local PgBouncer.")

    # STEP 2: Handle Zombie PM2 Processes
    print("\n--- STEP 2: Detecting Zombie PM2 Processes ---")
    out, _ = run_ssh(client, "pm2 jlist")
    try:
        data = json.loads(out)
        now = time.time() * 1000
        zombies = []
        for p in data:
            name = p.get('name')
            pid = p.get('pid')
            uptime = p.get('pm2_env', {}).get('pm_uptime', 0)
            age_sec = (now - uptime) // 1000
            if age_sec > 300: 
                print(f"⚠️  Likely Zombie: {name} (PID {pid}, Uptime {age_sec}s)")
                zombies.append(pid)
            else:
                print(f"🟢 Healthy-ish: {name} (PID {pid}, Uptime {age_sec}s)")

        if zombies:
            print(f"⚡ Killing {len(zombies)} zombie processes...")
            for pid in zombies:
                if pid: run_ssh(client, f"sudo kill -9 {pid}")
            print("⌛ Waiting for PM2 to respawn workers...")
            time.sleep(5)
        else:
            print("✅ No long-running zombies detected. Performing standard restart.")
            run_ssh(client, "pm2 restart all")
            time.sleep(3)
    except Exception as e:
        print(f"❌ Failed to parse PM2 list: {e}")

    # STEP 3: Final Stabilization
    print("\n--- STEP 3: Triggering Standard Relief Protocol ---")
    import os
    try:
        os.system("python fave_scripts/relief_db_locks.py")
    except Exception as e:
        print(f"⚠️  Could not trigger relief_db_locks.py automatically: {e}")

    print("\n✨ Deep Relief Complete. Check vm_diagnostics.py for results.")
    client.close()

if __name__ == "__main__":
    main()
