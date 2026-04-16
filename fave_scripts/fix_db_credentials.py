"""
fix_db_credentials.py
=====================
Diagnoses and fixes "password authentication failed for Administrator1"
by inspecting the live .env and PgBouncer userlist on the VM.

Phase 1: DIAGNOSE  — reads .env DATABASE_URL, PgBouncer userlist, PM2 state
Phase 2: FIX       — patches DATABASE_URL to the correct port-6432 value
Phase 3: CLEAR     — kills zombie PgBouncer connections (KILL + RESUME)
Phase 4: RESTART   — PM2 delete all + start
"""

import sys, io, time, re, os, paramiko

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# ── VM SSH ────────────────────────────────────────────────────────────────────
SERVER_IP  = "20.24.58.49"
SSH_USER   = "Administrator1"
SSH_PASS   = "7v52E69TYgTE"

# ── Project paths ─────────────────────────────────────────────────────────────
PROJECT_ROOT = "/var/www/html/InsightEd-Mobile-PWA"
ENV_PATH     = f"{PROJECT_ROOT}/.env"
LOCAL_INDEX  = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "api", "index.js")

# ── Known-good credentials ────────────────────────────────────────────────────
CORRECT_DB_PASS = "pRZTbQ2T1JD7"
CORRECT_DB_HOST = "stride-posgre-prod-01.postgres.database.azure.com"
CORRECT_PORT    = "6432"
CORRECT_DB_NAME = "insightEd"
CORRECT_URL     = f"postgres://Administrator1:{CORRECT_DB_PASS}@{CORRECT_DB_HOST}:{CORRECT_PORT}/{CORRECT_DB_NAME}"

# ── PgBouncer admin ────────────────────────────────────────────────────────────
PGB_HOST  = "127.0.0.1"
PGB_PORT  = "6432"
PGB_USER  = "Administrator1"
PGB_PASS  = CORRECT_DB_PASS
APP_DB    = "insightEd"

def divider(title=""):
    print(f"\n{'═'*72}")
    if title: print(f"  {title}")
    print(f"{'═'*72}")

def run(client, cmd, timeout=30):
    _, o, e = client.exec_command(cmd, timeout=timeout)
    out = o.read().decode("utf-8", errors="replace").strip()
    err = e.read().decode("utf-8", errors="replace").strip()
    return out, err

def pgb(client, sql, db=APP_DB):
    cmd = (f"PGPASSWORD='{PGB_PASS}' psql "
           f"-h {PGB_HOST} -p {PGB_PORT} -U {PGB_USER} -d {db} "
           f"-c \"{sql}\" 2>&1")
    out, _ = run(client, cmd)
    return out

def main():
    print(f"\n🔌 Connecting to VM {SERVER_IP} …")
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
        # ════════════════════════════════════════════════════════════
        # PHASE 1 — DIAGNOSE
        # ════════════════════════════════════════════════════════════
        divider("PHASE 1 — DIAGNOSE: Reading live .env on VM")

        env_out, _ = run(client, f"cat {ENV_PATH} 2>&1")
        if "No such file" in env_out:
            print(f"❌ .env not found at {ENV_PATH}")
            sys.exit(1)

        # Extract DATABASE_URL
        current_url = None
        for line in env_out.splitlines():
            if line.strip().startswith("DATABASE_URL"):
                current_url = line.split("=", 1)[1].strip().strip('"').strip("'")
                break

        print(f"\n  Current DATABASE_URL: {current_url or '(not set)'}")
        if current_url:
            # Parse it
            port_match  = re.search(r':(\d+)/', current_url)
            pass_match  = re.search(r'://[^:]+:([^@]+)@', current_url)
            host_match  = re.search(r'@([^:/]+)', current_url)
            current_port = port_match.group(1)  if port_match  else "?"
            current_pass = pass_match.group(1)  if pass_match  else "?"
            current_host = host_match.group(1)  if host_match  else "?"

            print(f"  Parsed → host: {current_host}  port: {current_port}  pass: {current_pass}")

            if current_port == "5432":
                print("  ❌ PROBLEM: port 5432 detected — bypassing PgBouncer entirely!")
                print("              Azure PG rejects direct connections or uses different auth.")
            elif current_pass != CORRECT_DB_PASS:
                print(f"  ❌ PROBLEM: password mismatch (got '{current_pass}', expected '{CORRECT_DB_PASS}')")
            else:
                print("  ✅ URL looks correct. Checking other causes...")

        # PgBouncer userlist
        divider("PHASE 1b — PgBouncer userlist & config")
        ul_path_out, _ = run(client, "sudo find /etc /home -name 'userlist.txt' 2>/dev/null | head -3")
        ul_path = ul_path_out.strip().splitlines()[0] if ul_path_out.strip() else None
        if ul_path:
            print(f"  userlist.txt: {ul_path}")
            ul_content, _ = run(client, f"sudo cat {ul_path}")
            print(ul_content)
        else:
            print("  ⚠️  userlist.txt not found — PgBouncer may use HBA/MD5 auth")

        pgbouncer_ini, _ = run(client, "cat /etc/pgbouncer/pgbouncer.ini 2>/dev/null | grep -E 'pool_mode|auth_type|listen_addr|logfile|auth_file'")
        print(f"\n  pgbouncer.ini (key lines):\n{pgbouncer_ini}")

        # PM2 state
        divider("PHASE 1c — PM2 status")
        pm2_out, _ = run(client, "pm2 list 2>&1")
        print(pm2_out)

        restart_counts, _ = run(client, "pm2 jlist 2>/dev/null | python3 -c \"import sys,json; d=json.load(sys.stdin); [print(p['name'], 'restarts:', p['pm2_env']['restart_time']) for p in d]\" 2>&1")
        print(f"\n  Restart counts:\n{restart_counts}")

        # ════════════════════════════════════════════════════════════
        # PHASE 2 — FIX .env
        # ════════════════════════════════════════════════════════════
        divider("PHASE 2 — FIX: Patching DATABASE_URL on VM")

        needs_fix = (
            current_url != CORRECT_URL and (
                current_url is None
                or ":5432/" in (current_url or "")
                or (pass_match and pass_match.group(1) != CORRECT_DB_PASS)
            )
        )

        if needs_fix or current_url != CORRECT_URL:
            print(f"\n  Old: {current_url}")
            print(f"  New: {CORRECT_URL}")

            # Backup
            run(client, f"sudo cp {ENV_PATH} {ENV_PATH}.bak.$(date +%Y%m%d_%H%M%S)")

            if current_url:
                # Escape for sed
                old_esc = re.escape(current_url).replace("/", r"\/")
                new_esc = CORRECT_URL.replace("/", r"\/").replace("&", r"\&")
                sed_cmd = f"sudo sed -i 's|DATABASE_URL=.*|DATABASE_URL={CORRECT_URL}|' {ENV_PATH}"
            else:
                sed_cmd = f"echo 'DATABASE_URL={CORRECT_URL}' | sudo tee -a {ENV_PATH}"

            out, err = run(client, sed_cmd)
            verify, _ = run(client, f"grep DATABASE_URL {ENV_PATH}")
            print(f"\n  Verified .env: {verify}")
            print("  ✅ DATABASE_URL patched.")
        else:
            print("  ✅ DATABASE_URL is already correct. Issue is elsewhere.")

        # ════════════════════════════════════════════════════════════
        # PHASE 3 — DEPLOY latest index.js
        # ════════════════════════════════════════════════════════════
        divider("PHASE 3 — Deploy latest api/index.js")

        if os.path.exists(LOCAL_INDEX):
            print(f"  Uploading {LOCAL_INDEX} → {PROJECT_ROOT}/api/index.js")
            sftp = client.open_sftp()
            sftp.put(LOCAL_INDEX, f"{PROJECT_ROOT}/api/index.js")
            sftp.close()
            print("  ✅ index.js deployed.")
        else:
            print(f"  ⚠️  Local index.js not found at {LOCAL_INDEX} — skipping deploy.")

        # ════════════════════════════════════════════════════════════
        # PHASE 4 — CLEAR zombie PgBouncer connections
        # ════════════════════════════════════════════════════════════
        divider("PHASE 4 — Clear zombie connections: KILL + RESUME")

        print("\n  Checking PgBouncer connectivity...")
        pools_before = pgb(client, "SHOW POOLS;", db="pgbouncer")
        print(pools_before)

        print(f"\n  Sending KILL \"{APP_DB}\" (drops all zombie server connections)...")
        kill_out = pgb(client, f'KILL "{APP_DB}";', db="pgbouncer")
        print(f"  {kill_out}")

        print("  Waiting 2s for Azure PG to release locks...")
        time.sleep(2)

        print(f"  Sending RESUME \"{APP_DB}\"...")
        resume_out = pgb(client, f'RESUME "{APP_DB}";', db="pgbouncer")
        print(f"  {resume_out}")

        time.sleep(2)

        pools_after = pgb(client, "SHOW POOLS;", db="pgbouncer")
        print(f"\n  Pools after resume:\n{pools_after}")

        # ════════════════════════════════════════════════════════════
        # PHASE 5 — PM2 hard restart
        # ════════════════════════════════════════════════════════════
        divider("PHASE 5 — PM2 hard restart (delete all + start)")

        print("\n  Deleting all PM2 processes...")
        out, _ = run(client, "pm2 delete all 2>&1", timeout=30)
        print(out)

        time.sleep(2)

        print(f"\n  Starting from {PROJECT_ROOT}/ecosystem.config.cjs ...")
        out, _ = run(client, f"cd {PROJECT_ROOT} && pm2 start ecosystem.config.cjs 2>&1", timeout=60)
        print(out)

        time.sleep(5)

        # ════════════════════════════════════════════════════════════
        # PHASE 6 — VERIFY
        # ════════════════════════════════════════════════════════════
        divider("PHASE 6 — VERIFY")

        pm2_final, _ = run(client, "pm2 list 2>&1")
        print(pm2_final)

        # Quick pool check via PgBouncer
        pool_check = pgb(client, "SHOW POOLS;", db="pgbouncer")
        print(f"\n  PgBouncer pools:\n{pool_check}")

        # Check if app responds
        curl_out, _ = run(client, "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5000/api/settings/maintenance_mode 2>&1", timeout=15)
        print(f"\n  HTTP health check (port 5000): {curl_out}")
        curl_staging, _ = run(client, "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5001/api/settings/maintenance_mode 2>&1", timeout=15)
        print(f"  HTTP health check (port 5001): {curl_staging}")

        divider("DONE")
        print("""
  If HTTP returns 200 → app is healthy, DB connected.
  If HTTP returns 500 → check: pm2 logs insighted-backend --lines 30
  If HTTP returns 000 → app not listening yet (still starting up, wait 10s and retry)
""")

    finally:
        client.close()
        print("🔌 SSH disconnected.")

if __name__ == "__main__":
    main()
