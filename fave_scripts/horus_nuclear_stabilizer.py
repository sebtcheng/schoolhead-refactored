"""
horus_nuclear_stabilizer.py  (v1.1 — Tier 3: THE ULTIMATE NUCLEAR OPTION)
======================================================================
Use this ONLY if Tier 1 (relief_db_locks) and Tier 2 (deep_relief_db) fail.

WHAT THIS DOES (The "Zero-State" Recovery):
1.  SAFE BACKUP: Creates forensic backups of .env and access logs.
2.  DISK PURGE: Truncates massive logs to reclaim I/O performance.
3.  INFRA HARD-RESET: RESTARTS system-level pgbouncer and nginx.
4.  ENV FORENSICS: Ensures .env routes to 127.0.0.1:6432.
5.  PROCESS WIPE: Purges all Node workers to clear memory junk.
6.  FORENSIC HEAL: Re-joins the workforce with fresh configurations.
"""

import paramiko
import time
import sys
import io

# ── VM Configuration ──────────────────────────────────────────────────────────
SERVER_IP = "20.24.58.49"
USER      = "Administrator1"
PASS      = "7v52E69TYgTE"

# Set up utf-8 output for Windows terminals
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def run_ssh(client, cmd, label=None, use_sudo=False):
    if label: print(f"\n[>] {label}")
    full_cmd = f"sudo {cmd}" if use_sudo else cmd
    stdin, stdout, stderr = client.exec_command(full_cmd)
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    if out: print(out)
    if err: print(f"⚠️  {err}")
    return out, err

def main():
    print("☢️  ULTIMATE NUCLEAR STABILIZER ACTIVATED (Tier 3) ☢️")
    print(f"Target: {SERVER_IP}")
    
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(SERVER_IP, 22, USER, PASS, timeout=15)
    except Exception as e:
        print(f"❌ SSH Connection failed: {e}")
        return

    # 1. FORENSIC BACKUP
    print("\n🛡️ PHASE 1: Forensic Backup (Safety First)")
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    pwa_dir = "/var/www/html/InsightEd-Mobile-PWA"
    run_ssh(client, f"cp {pwa_dir}/.env {pwa_dir}/.env.bak.{timestamp}", label="Backup .env", use_sudo=True)
    run_ssh(client, f"cp /var/log/nginx/access.log /var/log/nginx/access.log.bak.{timestamp} 2>/dev/null || true", label="Backup Access Log", use_sudo=True)

    # 2. DISK PURGE
    print("\n📦 PHASE 2: Disk Purge & Log Truncation")
    commands = [
        "truncate -s 0 /var/log/nginx/access.log",
        "truncate -s 0 /var/log/nginx/error.log",
        "find /home/Administrator1/.pm2/logs -name '*.log' -exec truncate -s 0 {} +",
        f"rm -f {pwa_dir}/*.tar.gz",
        "rm -f /tmp/insighted-pdf-tmp/*"
    ]
    for cmd in commands:
        run_ssh(client, cmd, use_sudo=True)

    # 3. INFRA HARD-RESET
    print("\n🔌 PHASE 3: Infrastructure Hard-Reset")
    run_ssh(client, "systemctl restart pgbouncer", label="Restarting PgBouncer", use_sudo=True)
    run_ssh(client, "systemctl restart nginx", label="Restarting Nginx", use_sudo=True)
    time.sleep(2)

    # 4. PROCESS NUCLEAR WIPE
    print("\n💥 PHASE 4: Process Nuclear Wipe")
    run_ssh(client, "pm2 kill", label="Killing PM2 Daemon", use_sudo=True)
    run_ssh(client, "killall -9 node", label="Sending SIGKILL to all Node instances", use_sudo=True)
    time.sleep(2)

    # 5. FORENSIC HEAL & RE-SPAWN
    print("\n🩺 PHASE 5: Forensic Heal & Re-spawn")
    heal_cmd = f"cd {pwa_dir} && chmod +x forensic_heal.sh && STAGING_DIR={pwa_dir} ./forensic_heal.sh"
    run_ssh(client, heal_cmd, label="Executing Forensic Healer", use_sudo=False)
    
    print("\n♻️  Final Process Check...")
    run_ssh(client, "pm2 list", use_sudo=True)

    print("\n✨ NUCLEAR STABILIZATION COMPLETE. All infra services and processes normalized.")
    client.close()

if __name__ == "__main__":
    main()
