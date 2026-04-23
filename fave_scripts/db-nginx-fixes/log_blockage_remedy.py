#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
log_blockage_remedy.py
======================
Tier 4: DATABASE OPTIMIZATION (The "Slow-Killer" Remedy)
Target: activity_logs sequential scan eradication.

This script addresses the "62 Million Row Logjam" by creating critical 
indexes CONCURRENTLY. Use this when the connection is slow despite 
infrastructure resets (Tier 1-3).
"""

import paramiko, sys, io, time

# ── VM Configuration ──────────────────────────────────────────────────────────
SERVER_IP = "20.24.58.49"
SSH_USER  = "Administrator1"
SSH_PASS  = "<REDACTED_SSH_PASS>"

# ── Database Configuration (PgBouncer) ────────────────────────────────────────
PGB_HOST  = "127.0.0.1"
PGB_PORT  = "6432"
PGB_USER  = "Administrator1"
PGB_PASS  = "<REDACTED_PGB_PASS>"
APP_DB    = "insightEd"

# Set up utf-8 output for Windows terminals
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def banner(t):
    print(f"\n{'='*72}\n  {t}\n{'='*72}")

def ssh_run(client, cmd, timeout=300):
    stdin, stdout_chan, stderr_chan = client.exec_command(cmd, timeout=timeout)
    stdout = stdout_chan.read().decode('utf-8', errors='replace').strip()
    stderr = stderr_chan.read().decode('utf-8', errors='replace').strip()
    
    if stdout: print(stdout)
    
    # Filter noise from stderr
    noise = {"WARNING", "NOTICE", "SSL connection"}
    errs = [l for l in stderr.splitlines() if l and not any(n in l for n in noise)]
    if errs: print(f"  [ERR] {chr(10).join(errs[:5])}")
    return stdout

def pgb_sql(client, sql, label="", timeout=300):
    if label: banner(label)
    # Escape single quotes for the shell command
    esc_sql = sql.replace("'", "\\'")
    cmd = f"PGPASSWORD='{PGB_PASS}' psql -h {PGB_HOST} -p {PGB_PORT} -U {PGB_USER} -d {APP_DB} -c '{esc_sql}' 2>&1"
    return ssh_run(client, cmd, timeout=timeout)

def main():
    print(f"🚀 Initializing Log Blockage Remedy for {SERVER_IP}...")
    
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, port=22, username=SSH_USER, password=SSH_PASS, timeout=15)
        print("✅ SSH Connection Established.\n")
    except Exception as e:
        print(f"❌ SSH Connection failed: {e}")
        return

    try:
        # 1. PRE-AUDIT: Check current stats
        pgb_sql(client, """
            SELECT relname, seq_scan, idx_scan, n_live_tup as rows
            FROM pg_stat_user_tables
            WHERE relname = 'activity_logs'
        """, "PHASE 1: CURRENT activity_logs STATUS")

        # 2. THE REMEDY: Concurrent Indexing
        banner("PHASE 2: APPLYING CONCURRENT INDEXES (ZERO DOWNTIME)")
        
        indexes = [
            ("idx_activity_logs_user_uid", 
             "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_logs_user_uid ON activity_logs (user_uid)"),
            ("idx_activity_logs_timestamp", 
             "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs (timestamp DESC)"),
            ("idx_activity_logs_action_type", 
             "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_logs_action_type ON activity_logs (action_type)"),
            ("idx_activity_logs_uid_time", 
             "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_logs_uid_time ON activity_logs (user_uid, timestamp DESC)")
        ]

        for name, sql in indexes:
            print(f"\n⚡ Creating {name}... (may take up to 60s)")
            start = time.time()
            pgb_sql(client, sql, timeout=300)
            elapsed = round(time.time() - start, 1)
            print(f"✅ Success! ({elapsed}s)")

        # 3. VERIFICATION
        pgb_sql(client, """
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = 'activity_logs'
            ORDER BY indexname
        """, "PHASE 3: VERIFYING NEW INDEXES")

        banner("REMEDY COMPLETE")
        print("""
🎉 The Log blockage has been cleared. 
Next steps:
1. Run vm_diagnostics.py to see the CPU drop.
2. Monitor logActivity() latency in your backend logs.
        """)

    except Exception as e:
        print(f"❌ Operation failed: {e}")
    finally:
        client.close()
        print("🔌 SSH Connection Closed.")

if __name__ == "__main__":
    main()
