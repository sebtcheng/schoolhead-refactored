#!/usr/bin/env python3
"""
InsightEd SchoolHead — STAGING deployment
  URL : https://stride.deped.gov.ph/insighted-schoolhead-staging/
  Dir : /mnt/insighted-schoolhead-staging   (releases/<id>, current -> releases/<id>, dist -> current/dist)
  PM2 : insighted-schoolhead-staging-backend  (port 5020)
  DB  : SIIF  -> insighted-staging.siif_staging_v2
        Users -> insighted-staging.users_staging_v2   (see .env.staging)

Usage:
  py deploy_schoolhead_staging.py             # preflight -> build -> package -> upload -> activate -> verify
  py deploy_schoolhead_staging.py --sync-db   # same, but first refresh SIIF + users copies from production
                                              #   (RESETS staging data, e.g. passwords changed on staging)
  py deploy_schoolhead_staging.py --check     # preflight only (changes nothing)
  py deploy_schoolhead_staging.py --rollback  # switch back to the previous release
  py deploy_schoolhead_staging.py --logs      # last 80 lines of staging PM2 logs

Never touches: Nginx, /var/www/html (production), other PM2 processes, database schema.
"""
import os
import re
import shutil
import ssl
import subprocess
import sys
import tarfile
import time
import urllib.error
import urllib.request

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

### --- CONFIGURATION ---
SERVER_IP   = "20.24.58.49"
USER        = "Administrator1"
REMOTE_ROOT = "/mnt/insighted-schoolhead-staging"
PM2_NAME    = "insighted-schoolhead-staging-backend"
PM2_CONFIG  = "ecosystem.schoolhead-staging.config.cjs"
PORT        = "5020"
BASE_PATH   = "/insighted-schoolhead-staging/"
PUBLIC_URL  = f"https://stride.deped.gov.ph{BASE_PATH}"
ENV_FILE    = ".env.staging"
WEB_DIST    = "apps/school-head/web/dist"
PNPM_STORE  = "/mnt/.pnpm-store"
KEEP        = 3   # releases kept on the server (current + 2 for rollback)

# Bundled into the release tarball (node_modules and build caches are excluded)
INCLUDE = [
    "apps/school-head/api",
    "apps/siif/api",
    "apps/school-head/web/package.json",   # manifests only — keeps the pnpm workspace
    "apps/siif/web/package.json",          # in sync with pnpm-lock.yaml
    "packages/shared-auth",
    "packages/shared-db",
    "packages/shared-io",
    "packages/shared-types",
    "packages/shared-ui",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    ".npmrc",
    PM2_CONFIG,
]
EXCLUDE_DIRS = {"node_modules", ".turbo", "dist", "uploads", "__pycache__", ".git"}

SSH_BASE = ["ssh", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=no", "-o", "ControlMaster=no",
            "-o", "ConnectTimeout=60", "-o", "ServerAliveInterval=10", "-o", "ServerAliveCountMax=6",
            f"{USER}@{SERVER_IP}"]

### --- COLORS ---
GREEN, RED, CYAN, YELLOW, NC = "\033[0;32m", "\033[0;31m", "\033[0;36m", "\033[1;33m", "\033[0m"

def info(msg):    print(f"{CYAN}ℹ️  {msg}{NC}", flush=True)
def success(msg): print(f"{GREEN}✅ {msg}{NC}", flush=True)
def warn(msg):    print(f"{YELLOW}⚠️  {msg}{NC}", flush=True)
def error(msg):   print(f"{RED}❌ {msg}{NC}", flush=True)
def phase(msg):   print(f"\n{YELLOW}{msg}{NC}", flush=True)

def die(msg):
    error(msg)
    sys.exit(1)


def run_local(cmd, env=None, timeout=900):
    print(f"{CYAN}> {cmd}{NC}", flush=True)
    try:
        subprocess.run(cmd, shell=True, check=True, env=env, timeout=timeout)
    except subprocess.CalledProcessError as e:
        die(f"Command failed (exit {e.returncode}): {cmd}")
    except subprocess.TimeoutExpired:
        die(f"Command timed out after {timeout}s: {cmd}")


def remote(script, capture=False, retries=3, delay=8, timeout=900, check=True):
    """Run a bash script on the server over one SSH session (script sent via stdin, no quoting issues)."""
    # Sent as bytes with LF endings — Windows text mode would turn \n into \r\n and break bash
    body = ("set -euo pipefail\n" + script).replace("\r\n", "\n").encode("utf-8")
    for attempt in range(1, retries + 1):
        try:
            res = subprocess.run(SSH_BASE + ["bash -s"], input=body, capture_output=capture, timeout=timeout)
            if capture:
                res.stdout = res.stdout.decode("utf-8", "replace")
                res.stderr = res.stderr.decode("utf-8", "replace")
        except subprocess.TimeoutExpired:
            res = None
        if res is not None and (res.returncode == 0 or not check):
            return res
        # exit 255 = SSH/network failure -> retry; anything else is a real script failure
        if res is not None and res.returncode != 255:
            if capture and res.stderr:
                print(res.stderr, file=sys.stderr)
            die(f"Remote step failed (exit {res.returncode}).")
        if attempt < retries:
            warn(f"SSH attempt {attempt}/{retries} failed. Retrying in {delay}s...")
            time.sleep(delay)
    die(f"SSH failed after {retries} attempts.")


def read_env(path):
    env = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            m = re.match(r"^([A-Z_][A-Z0-9_]*)=(.*)$", line.rstrip("\r\n"))
            if m:
                env[m.group(1)] = m.group(2).strip().strip("\"'")
    return env


def git(*args):
    try:
        return subprocess.run(["git", *args], capture_output=True, text=True).stdout.strip()
    except OSError:
        return ""


# ─────────────────────────────────────────────────────────────────────────────
# Phase 0 — Preflight (read-only)
# ─────────────────────────────────────────────────────────────────────────────
def preflight():
    phase("🔎 Phase 0: Preflight checks (nothing is changed)")

    branch, commit = git("rev-parse", "--abbrev-ref", "HEAD"), git("rev-parse", "--short", "HEAD")
    info(f"Branch: {branch or '?'} @ {commit or '?'}")
    if git("status", "--porcelain", "--untracked-files=no"):
        warn("Working tree has uncommitted changes — they WILL be deployed to staging.")

    missing = [p for p in INCLUDE + [ENV_FILE] if not os.path.exists(p)]
    if missing:
        die(f"Missing local files: {', '.join(missing)}")

    env = read_env(ENV_FILE)
    rules = {
        "PORT": lambda v: v == PORT,
        "NODE_ENV": lambda v: v == "production",
        "SKIP_BOOT_MIGRATIONS": lambda v: v == "true",
        "DISABLE_CHAT_CLEANUP": lambda v: v == "true",
        "SIIF_DB_NAME": lambda v: v == "insighted-staging",
        "SIIF_DATABASE_URL": lambda v: "/insighted-staging" in v and "siif_staging_v2" in v,
        "DATABASE_URL": lambda v: v.split("?")[0].endswith("/insighted-staging"),
        "USERS_DATABASE_URL": lambda v: "/insighted-staging" in v and "users_staging_v2" in v,
        "UPLOAD_DIR": lambda v: v.startswith(REMOTE_ROOT),
    }
    bad = [k for k, ok in rules.items() if not ok(env.get(k, ""))]
    if bad:
        die(f"{ENV_FILE} is not a safe staging config. Check: {', '.join(bad)}")
    success(f"{ENV_FILE} points SIIF + users to insighted-staging (*_staging_v2), port {PORT}, migrations off.")

    info(f"Checking server {SERVER_IP} (SSH, port {PORT}, disk)...")
    res = remote(f"""
        echo "SSH_OK"
        node -v >/dev/null && pnpm -v >/dev/null && pm2 -v >/dev/null && echo "TOOLS_OK"
        owner=$(pm2 jlist 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{{try{{const p=JSON.parse(s).find(x=>x.name==="{PM2_NAME}");console.log(p?p.pid:"")}}catch{{console.log("")}}}})')
        listen=$(ss -ltnpH "sport = :{PORT}" 2>/dev/null || true)
        if [ -z "$listen" ]; then echo "PORT_FREE"
        elif [ -n "$owner" ] && echo "$listen" | grep -q "pid=$owner,"; then echo "PORT_OURS"
        elif [ -n "$owner" ] && echo "$listen" | grep -q "PM2"; then echo "PORT_OURS"
        else echo "PORT_TAKEN: $listen"; fi
        echo "FREE_MB=$(df -Pm /mnt | awk 'NR==2{{print $4}}')"
        if [ -e {REMOTE_ROOT}/dist ] && [ ! -L {REMOTE_ROOT}/dist ]; then echo "DIST_NOT_SYMLINK"; fi
    """, capture=True)
    out = res.stdout
    if "SSH_OK" not in out:
        die("SSH check failed. Is your key loaded / VPN on?")
    if "TOOLS_OK" not in out:
        die("node / pnpm / pm2 missing on server.")
    if "PORT_TAKEN" in out:
        die(f"Port {PORT} is used by something other than {PM2_NAME}: {out.split('PORT_TAKEN:')[1].splitlines()[0]}")
    if "DIST_NOT_SYMLINK" in out:
        die(f"{REMOTE_ROOT}/dist exists as a real folder. Move it aside manually before the first deploy.")
    free_mb = int(re.search(r"FREE_MB=(\d+)", out).group(1))
    if free_mb < 3000:
        die(f"Only {free_mb} MB free on /mnt.")
    success(f"Server OK — port {PORT} {'free' if 'PORT_FREE' in out else 'owned by staging'}, /mnt free: {free_mb // 1024} GB")
    return branch, commit


# ─────────────────────────────────────────────────────────────────────────────
# Phase 1 — Build frontend
# ─────────────────────────────────────────────────────────────────────────────
def build_frontend(commit):
    phase(f"🏗️  Phase 1: Building frontend (base {BASE_PATH})")
    shutil.rmtree(WEB_DIST, ignore_errors=True)

    env = os.environ.copy()
    env["VITE_BASE_PATH"] = BASE_PATH
    env["VITE_APP_VERSION"] = f"staging-{commit}-{int(time.time())}"
    env["NODE_OPTIONS"] = "--max-old-space-size=4096"
    info(f"VITE_APP_VERSION={env['VITE_APP_VERSION']}")
    run_local("pnpm --filter @apps/school-head-web build", env=env)

    index = os.path.join(WEB_DIST, "index.html")
    if not os.path.exists(index):
        die(f"Build did not produce {index}")
    html = open(index, encoding="utf-8").read()
    assets = re.findall(r'(?:src|href)="(' + re.escape(BASE_PATH) + r'assets/[^"]+)"', html)
    if not assets:
        die(f"index.html does not reference {BASE_PATH}assets/ — wrong base path.")
    for a in assets:
        if not os.path.exists(os.path.join(WEB_DIST, a[len(BASE_PATH):])):
            die(f"index.html references a missing asset: {a}")
    success(f"Frontend built — {len(assets)} entry assets verified.")
    return assets


# ─────────────────────────────────────────────────────────────────────────────
# Phase 2 — Package
# ─────────────────────────────────────────────────────────────────────────────
def package(release_id, branch, commit):
    phase("📦 Phase 2: Packaging release")
    tar_path = f"schoolhead-staging-{release_id}.tar.gz"

    def skip(ti):
        parts = ti.name.replace("\\", "/").split("/")
        return None if any(p in EXCLUDE_DIRS for p in parts) or ti.name.endswith(".log") else ti

    with tarfile.open(tar_path, "w:gz") as tar:
        for p in INCLUDE:
            tar.add(p, arcname=p, filter=skip)
        tar.add(WEB_DIST, arcname="dist")
        tar.add(ENV_FILE, arcname=".env")
        meta = f"release={release_id}\nbranch={branch}\ncommit={commit}\nbuilt={time.strftime('%Y-%m-%d %H:%M:%S')}\n"
        meta_path = "RELEASE.tmp"
        with open(meta_path, "w", encoding="utf-8") as f:
            f.write(meta)
        tar.add(meta_path, arcname="RELEASE")
        os.remove(meta_path)
    success(f"{tar_path} ({os.path.getsize(tar_path) / 1024 / 1024:.1f} MB)")
    return tar_path


# ─────────────────────────────────────────────────────────────────────────────
# Phase 3 — Upload
# ─────────────────────────────────────────────────────────────────────────────
def upload(tar_path, release_id):
    phase("🚀 Phase 3: Uploading")
    remote(f"mkdir -p {REMOTE_ROOT}/releases {REMOTE_ROOT}/uploads {REMOTE_ROOT}/logs {REMOTE_ROOT}/tmp")
    dest = f"{REMOTE_ROOT}/releases/{release_id}.tar.gz"
    for attempt in range(1, 5):
        with open(tar_path, "rb") as f:
            res = subprocess.run(SSH_BASE + [f"cat > {dest}"], stdin=f, timeout=900)
        if res.returncode == 0:
            break
        warn(f"Upload attempt {attempt}/4 failed. Retrying in 8s...")
        time.sleep(8)
    else:
        die("Upload failed.")
    size = remote(f"stat -c %s {dest}", capture=True).stdout.strip()
    if size != str(os.path.getsize(tar_path)):
        die(f"Upload size mismatch (local {os.path.getsize(tar_path)} vs remote {size}).")
    success(f"Uploaded to {dest}")


# ─────────────────────────────────────────────────────────────────────────────
# Phase 4 — Activate (install -> switch symlinks -> restart staging PM2 only)
# ─────────────────────────────────────────────────────────────────────────────
SWITCH_TO = f"""
switch_to() {{
    target="$1"
    ln -sfn "$target" {REMOTE_ROOT}/current.new && mv -Tf {REMOTE_ROOT}/current.new {REMOTE_ROOT}/current
    ln -sfn current/dist {REMOTE_ROOT}/dist.new && mv -Tf {REMOTE_ROOT}/dist.new {REMOTE_ROOT}/dist
    pm2 delete {PM2_NAME} >/dev/null 2>&1 || true
    pm2 start {REMOTE_ROOT}/current/{PM2_CONFIG} --only {PM2_NAME}
}}
"""

def activate(release_id):
    phase("🔁 Phase 4: Install & activate (only the staging process is restarted)")
    remote(f"""
        ROOT={REMOTE_ROOT}
        [ "$ROOT" = "/mnt/insighted-schoolhead-staging" ] || {{ echo "Refusing: unexpected root $ROOT"; exit 1; }}
        R=$ROOT/releases/{release_id}
        mkdir -p "$R"
        tar -xzf "$R.tar.gz" -C "$R"
        rm -f "$R.tar.gz"
        cd "$R"
        export npm_config_manage_package_manager_versions=false TMPDIR=$ROOT/tmp
        echo "→ pnpm install (prod) ..."
        if ! pnpm install --prod --frozen-lockfile --store-dir {PNPM_STORE} --reporter=append-only 2>&1 | tail -n 15; then
            echo "⚠️  frozen-lockfile install failed — retrying without --frozen-lockfile"
            pnpm install --prod --no-frozen-lockfile --store-dir {PNPM_STORE} --reporter=append-only 2>&1 | tail -n 15
        fi
        [ -d node_modules ] || {{ echo "node_modules missing after install"; exit 1; }}
        prev=$(readlink -f $ROOT/current 2>/dev/null || true)
        {SWITCH_TO}
        switch_to "$R"
        [ -n "$prev" ] && [ "$prev" != "$R" ] && echo "$prev" > $ROOT/.previous_release
        echo "{release_id}" > $ROOT/.current_release
        # keep the newest {KEEP} releases (never the current or previous one)
        keep_prev=$(cat $ROOT/.previous_release 2>/dev/null || true)
        ls -1dt $ROOT/releases/*/ 2>/dev/null | tail -n +{KEEP + 1} | while read -r d; do
            d=${{d%/}}
            case "$d" in $ROOT/releases/*) ;; *) continue ;; esac
            [ "$d" = "$R" ] || [ "$d" = "$keep_prev" ] || rm -rf "$d"
        done
    """, retries=1, timeout=1200)
    success(f"Release {release_id} is live on PM2 '{PM2_NAME}'.")


# ─────────────────────────────────────────────────────────────────────────────
# Phase 5 — Verify (auto-rollback on failure)
# ─────────────────────────────────────────────────────────────────────────────
def verify(assets):
    phase("🩺 Phase 5: Health checks")
    res = remote(f"""
        ok=""
        for i in $(seq 1 20); do
            code=$(curl -s -o /dev/null -w '%{{http_code}}' http://127.0.0.1:{PORT}/api/ping || true)
            [ "$code" = "200" ] && {{ ok=1; break; }}
            sleep 2
        done
        echo "PING=${{ok:-FAIL}}"
        echo "SIIF=$(curl -s -o /dev/null -w '%{{http_code}}' http://127.0.0.1:{PORT}/api/siif/health || true)"
        pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{{const p=JSON.parse(s).find(x=>x.name==="{PM2_NAME}");console.log("PM2="+(p?p.pm2_env.status+":"+p.pm2_env.restart_time:"missing"))}})'
        echo "----- last log lines -----"
        tail -n 20 {REMOTE_ROOT}/logs/out.log 2>/dev/null || true
        tail -n 10 {REMOTE_ROOT}/logs/error.log 2>/dev/null || true
    """, capture=True, check=False)
    out = res.stdout
    print(out.split("----- last log lines -----")[-1].rstrip())

    pm2 = re.search(r"PM2=(\S+)", out)
    pm2_state = pm2.group(1) if pm2 else "unknown"
    if "PING=1" not in out or not pm2_state.startswith("online"):
        error(f"Loopback health failed (ping={'ok' if 'PING=1' in out else 'fail'}, pm2={pm2_state}). Rolling back...")
        rollback(auto=True)
        die("Deployment failed and was rolled back. Check logs above.")
    success(f"API /api/ping OK on 127.0.0.1:{PORT} (pm2 {pm2_state})")

    siif = re.search(r"SIIF=(\d+)", out)
    if siif and siif.group(1) == "200":
        success("SIIF /api/siif/health OK")
    else:
        warn(f"SIIF health returned {siif.group(1) if siif else '?'} — check SIIF logs.")

    for url in [PUBLIC_URL, PUBLIC_URL.rstrip("/") + assets[0][len(BASE_PATH) - 1:], PUBLIC_URL + "api/ping"]:
        code = http_status(url)
        (success if code == 200 else warn)(f"Public {code}: {url}")


def http_status(url):
    req = urllib.request.Request(url, headers={"Cache-Control": "no-cache", "User-Agent": "staging-deploy"})
    for ctx in (None, ssl._create_unverified_context()):
        try:
            with urllib.request.urlopen(req, timeout=20, context=ctx) as r:
                return r.status
        except urllib.error.HTTPError as e:
            return e.code
        except (ssl.SSLError, urllib.error.URLError) as e:
            if ctx is None and "CERTIFICATE" in str(e).upper():
                continue
            return f"ERR {e}"
    return "ERR"


# ─────────────────────────────────────────────────────────────────────────────
# Extra modes
# ─────────────────────────────────────────────────────────────────────────────
def rollback(auto=False):
    if not auto:
        phase("⏪ Rolling back to previous release")
    remote(f"""
        ROOT={REMOTE_ROOT}
        prev=$(cat $ROOT/.previous_release 2>/dev/null || true)
        if [ -z "$prev" ] || [ ! -d "$prev" ]; then echo "No previous release to roll back to."; exit 1; fi
        cur=$(readlink -f $ROOT/current)
        {SWITCH_TO}
        switch_to "$prev"
        echo "$cur" > $ROOT/.previous_release
        basename "$prev" > $ROOT/.current_release
        echo "Now serving: $(basename "$prev")"
    """, retries=1)
    success("Rollback complete.")


def logs():
    remote(f"pm2 logs {PM2_NAME} --nostream --lines 80", retries=1, check=False)


def main():
    args = set(sys.argv[1:])
    if "--logs" in args:
        return logs()
    if "--rollback" in args:
        return rollback()

    start = time.time()
    print(f"{CYAN}{'=' * 64}\n🧪 InsightEd SchoolHead — STAGING deploy\n   {PUBLIC_URL}\n   {USER}@{SERVER_IP}:{REMOTE_ROOT} | PM2 {PM2_NAME} | port {PORT}\n{'=' * 64}{NC}", flush=True)

    branch, commit = preflight()
    if "--check" in args:
        success("Preflight passed. Nothing was changed (--check).")
        return

    if "--sync-db" in args:
        phase("🗄️  Refreshing staging databases from production (read-only on prod)")
        run_local("node scripts/staging/sync_staging_db.cjs", timeout=1800)

    release_id = time.strftime("%Y%m%d-%H%M%S")
    assets = build_frontend(commit)
    tar_path = package(release_id, branch, commit)
    try:
        upload(tar_path, release_id)
    finally:
        if os.path.exists(tar_path):
            os.remove(tar_path)
    activate(release_id)
    verify(assets)

    print(f"{CYAN}{'=' * 64}{NC}")
    success(f"Staging release {release_id} ({branch}@{commit}) deployed in {time.time() - start:.1f}s")
    print(f"   🌐 {PUBLIC_URL}")
    print(f"{CYAN}{'=' * 64}{NC}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        die("Interrupted by user (Ctrl+C).")
