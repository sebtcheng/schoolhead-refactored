#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
insight_diagnose.py
===================
THE UNIFIED DIAGNOSTIC SENTINEL (v1.0)
Consolidates knowledge from Master Tinkerer, Architect, and Librarian.

Diagnoses:
- Connection Pool Exhaustion (PgBouncer & Azure PG)
- Database Lock Cascades
- Sequential Scan Bottlenecks (activity_logs)
- Nginx/PM2 Environment Errors
- Infrastructure Resource Pressure

Output:
- Holistic System Dashboard
- Root Cause Analysis (RCA)
- Step-by-Step Recovery Guide
"""

import paramiko
import sys
import io
import time
import os

# Set encoding for Windows terminals
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# --- CONFIGURATION (CONSOLIDATED) ---
SERVER_IP = "20.24.58.49"
SSH_USER  = "Administrator1"
SSH_PASS  = "<REDACTED_SSH_PASS>"
PGB_PASS  = "<REDACTED_PGB_PASS>"
PGB_HOST  = "127.0.0.1"
PGB_PORT  = "6432"
PGB_USER  = "Administrator1"
APP_DB    = "insightEd"

def draw_header(title):
    width = 75
    print(f"\n{'═'*width}")
    print(f"  🚀 INSIGHTED SENTINEL: {title}")
    print(f"{'═'*width}\n")

class InsightSentinel:
    def __init__(self):
        self.client = None
        self.findings = []
        self.stats = {}

    def connect(self):
        print(f"[*] Establishing Secure Tunnel to {SERVER_IP} ...")
        self.client = paramiko.SSHClient()
        self.client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        try:
            self.client.connect(hostname=SERVER_IP, port=22,
                               username=SSH_USER, password=SSH_PASS, timeout=15)
            print("[OK] Sentinel Active.\n")
            return True
        except Exception as e:
            print(f"[ERROR] Connection Failed: {e}")
            return False

    def run_cmd(self, cmd, sudo=False, timeout=30):
        if sudo:
            cmd = f"echo '<REDACTED_SSH_PASS>' | sudo -S {cmd}"
        print(f"  [EXEC] {cmd[:60]}...")
        _, output, error = self.client.exec_command(cmd, timeout=timeout)
        try:
            return output.read().decode('utf-8', errors='replace').strip(), \
                   error.read().decode('utf-8', errors='replace').strip()
        except Exception as e:
            print(f"  [!] Command Timeout/Error: {e}")
            return "", str(e)

    def pgb_sql(self, sql, db="pgbouncer"):
        cmd = (
            f"PGPASSWORD='{PGB_PASS}' psql "
            f"-h {PGB_HOST} -p {PGB_PORT} -U {PGB_USER} -d {db} "
            f"-c \"{sql}\" 2>&1"
        )
        out, _ = self.run_cmd(cmd)
        return out

    def audit_environment(self):
        print("🔍 Auditing Runtime Environment...")
        # Check PM2 Status
        pm2_list, _ = self.run_cmd("pm2 jlist")
        import json
        try:
            apps = json.loads(pm2_list)
            self.stats['pm2_apps'] = {a['name']: a['pm2_env']['status'] for a in apps}
            self.stats['restarts'] = sum(a['pm2_env']['restart_time'] for a in apps)
        except:
            self.stats['pm2_apps'] = "Error reading PM2"

        # Check .env if possible (Staging)
        env_check, _ = self.run_cmd("grep 'DATABASE_URL' /var/www/html/InsightEd-Staging/.env || echo 'Missing'")
        self.stats['env_port_6432'] = "6432" in env_check

    def audit_infrastructure(self):
        print("🔍 Auditing System Resources...")
        mem, _ = self.run_cmd("free -m | grep Mem | awk '{print $3/$2 * 100.0}'")
        disk, _ = self.run_cmd("df -h / | tail -1 | awk '{print $5}'")
        self.stats['mem_usage'] = f"{float(mem):.1f}%" if mem else "Unknown"
        self.stats['disk_usage'] = disk.strip()

    def audit_database(self):
        print("🔍 Auditing Database & Connection Pool...")
        # 1. PgBouncer Pools
        pools = self.pgb_sql("SHOW POOLS;")
        self.stats['cl_waiting'] = 0
        if "cl_waiting" in pools:
            try:
                # Find the line for our app DB and sum cl_waiting
                for line in pools.split('\n'):
                    if APP_DB in line:
                        parts = line.split('|')
                        # Depending on psql output format (border or not)
                        # cl_waiting is usually around index 7-9
                        # This is a bit fragile, so let's check for any cl_waiting > 0
                        if any(p.strip().isdigit() and int(p.strip()) > 0 for p in parts):
                            self.stats['cl_waiting'] = self.stats.get('cl_waiting', 0) + 1
            except: pass

        # 2. PG Stat Activity
        activity = self.pgb_sql(f"SELECT state, count(*) FROM pg_stat_activity WHERE datname='{APP_DB}' GROUP BY state;", APP_DB)
        self.stats['pg_states'] = activity

        # 3. Locks
        locks = self.pgb_sql(f"SELECT pid FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND datid = (SELECT oid FROM pg_database WHERE datname='{APP_DB}');", APP_DB)
        self.stats['lock_count'] = len([l for l in locks.split('\n') if l.strip().isdigit()])

        # 4. Seq Scans on activity_logs
        scans = self.pgb_sql("SELECT seq_scan, idx_scan FROM pg_stat_user_tables WHERE relname = 'activity_logs';", APP_DB)
        self.stats['activity_scans'] = scans

    def analyze(self):
        draw_header("SYSTEM DASHBOARD")
        print(f"📡 PM2 Apps:   {self.stats.get('pm2_apps')}")
        print(f"🔄 Restarts:   {self.stats.get('restarts')}")
        print(f"🧠 Memory:      {self.stats.get('mem_usage')}")
        print(f"💽 Disk:        {self.stats.get('disk_usage')}")
        print(f"🔌 Port 6432:   {'✅ Valid' if self.stats.get('env_port_6432') else '⚠️ BYPASS DETECTED (Port 5432?)'}")
        print(f"⏳ cl_waiting:  {'✅ 0' if self.stats.get('cl_waiting') == 0 else f'🔥 {self.stats.get('cl_waiting')} QUEUED'}")
        print(f"🔒 Locks:       {'✅ 0' if self.stats.get('lock_count') == 0 else f'🔥 {self.stats.get('lock_count')} BLOCKED'}")

        draw_header("ROOT CAUSE ANALYSIS (RCA)")
        issues = []
        if self.stats.get('cl_waiting', 0) > 0:
            issues.append(("CRITICAL", "PgBouncer Queue Saturated", "Client requests are queuing because the backend pool is full or sessions are slow."))
        if self.stats.get('lock_count', 0) > 0:
            issues.append(("CRITICAL", "Database Lock Cascade", "Sessions are blocked waiting for database locks. This causes immediate 5xx errors."))
        if not self.stats.get('env_port_6432'):
            issues.append(("WARNING", "PgBouncer Bypass", "The application might be connecting directly to port 5432, exhausting Azure base connections."))
        
        scans = self.stats.get('activity_scans', "")
        if isinstance(scans, str) and "seq_scan" in scans:
            try:
                # Basic check for high seq_scan
                nums = [int(s) for s in scans.replace('|', ' ').split() if s.strip().isdigit()]
                if nums and nums[0] > 1000000:
                    issues.append(("SEVERE", "Sequential Scan Degradation", "The 'activity_logs' table is triggering millions of full-table scans. This drains pool capacity."))
            except Exception as e: 
                print(f"  [!] Scan Analysis Error: {e}")

        if not issues:
            print("✨ No critical issues identified. System is within nominal parameters.")
        else:
            for severity, title, desc in issues:
                print(f"[{severity}] {title}\n    -> {desc}\n")

        draw_header("RECOVERY GUIDE (STEP-BY-STEP)")
        if not issues:
            print("1. Monitor performance via 'pm2 monit'.")
            print("2. Audit slow routes using 'scripts/find_slow_routes.py'.")
        else:
            step = 1
            # Step-by-step logic
            if any(i[1] == "Database Lock Cascade" for i in issues):
                print(f"{step}. EMERGENCY LOCK RELIEF:")
                print(f"   Run: python fave_scripts/relief_db_locks.py")
                print(f"   Action: This will terminate long-running and blocking sessions.")
                step += 1
            
            if any(i[1] == "Sequential Scan Degradation" for i in issues):
                print(f"{step}. INDEX HARDENING:")
                print(f"   Run: python fave_scripts/fix_activity_logs_index.py")
                print(f"   Action: Creates concurrent indexes on activity_logs to stop full-table scans.")
                step += 1

            if any(i[1] == "PgBouncer Queue Saturated" for i in issues):
                print(f"{step}. POOL SCALING:")
                print(f"   - Open api/index.js")
                print(f"   - Ensure 'max: 100' is set for the Pool in non-local environments.")
                print(f"   - If needed, increase PgBouncer pool_size via 'fave_scripts/fix_pgbouncer_transaction_mode.py'.")
                step += 1

            if any(i[1] == "PgBouncer Bypass" for i in issues):
                print(f"{step}. PORT CONFIGURATION:")
                print(f"   - Check .env on the server. Ensure DATABASE_URL uses port :6432.")
                print(f"   - Restart app: 'pm2 restart insighted-backend'")
                step += 1

            print(f"\n{step}. VERIFICATION:")
            print(f"   Rerunning this script after fixes to confirm health.")

    def close(self):
        if self.client:
            self.client.close()

if __name__ == "__main__":
    sentinel = InsightSentinel()
    if sentinel.connect():
        sentinel.audit_environment()
        sentinel.audit_infrastructure()
        sentinel.audit_database()
        sentinel.analyze()
        sentinel.close()
    else:
        sys.exit(1)
