#!/usr/bin/env python3
import subprocess
import os
import sys
import time
import shutil

# Handle Windows console encoding for emojis
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

### --- CONFIGURATION ---
SERVER_IP   = "20.24.58.49"
SERVER_DIR  = "/var/www/html/InsightED-SchoolHead/insighted-schoolhead"
BACKUP_DIR  = "/var/www/html/InsightED-SchoolHead/backups"
USER        = "Administrator1"
TAR_FILE    = "schoolhead-deploy.tmp.tar.gz"
PORT        = "5010"

# Production PM2 processes running from SERVER_DIR (reloaded by name; the
# on-server ecosystem file has a stale script path, so it is not used here)
PM2_SCHOOLHEAD = "insighted-schoolhead-backend"   # cluster x2, port 5010
PM2_SIIF       = "insighted-siif-backend"         # fork, port 5015

# Files/folders to bundle into the release tarball
INCLUDE = [
    "apps/school-head/api",
    "apps/siif/api",
    "dist",
    ".env",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "turbo.json",
    "packages/shared-auth",
    "packages/shared-db",
    "packages/shared-io",
    "packages/shared-types",
    "packages/shared-ui",
]

# SSH base options — always passed as a plain string so Windows shell parses them correctly
SSH_BASE   = f"ssh -o StrictHostKeyChecking=no -o ConnectTimeout=60 -o ServerAliveInterval=10 -o ServerAliveCountMax=6"
SSH_TARGET = f"{USER}@{SERVER_IP}"

### --- COLORS ---
GREEN  = '\033[0;32m'
RED    = '\033[0;31m'
CYAN   = '\033[0;36m'
YELLOW = '\033[1;33m'
NC     = '\033[0m'

def info(msg):    print(f"{CYAN}ℹ️  {msg}{NC}", flush=True)
def success(msg): print(f"{GREEN}✅ {msg}{NC}", flush=True)
def warn(msg):    print(f"{YELLOW}⚠️  {msg}{NC}", flush=True)
def error(msg):   print(f"{RED}❌ {msg}{NC}", flush=True)

def run_command(cmd_str, capture=False, env=None, retries=3, delay=8, timeout=300):
    """
    Runs cmd_str as a shell string.
    - Streams stdout/stderr live so the terminal never looks frozen.
    - Kills the process and retries if it exceeds `timeout` seconds.
    - Retries up to `retries` times with `delay` seconds between attempts.
    """
    if not capture:
        print(f"{CYAN}> {cmd_str}{NC}", flush=True)

    for attempt in range(1, retries + 1):
        try:
            proc = subprocess.Popen(
                cmd_str,
                shell=True,
                stdout=subprocess.PIPE if capture else None,
                stderr=subprocess.PIPE if capture else None,
                text=True,
                env=env,
            )

            stdout_data = ""
            if capture:
                try:
                    stdout_data, _ = proc.communicate(timeout=timeout)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    raise
            else:
                try:
                    proc.wait(timeout=timeout)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    raise

            if proc.returncode != 0:
                raise subprocess.CalledProcessError(proc.returncode, cmd_str)

            return stdout_data if capture else None

        except subprocess.TimeoutExpired:
            if attempt < retries:
                warn(f"⏱  Command timed out after {timeout}s (attempt {attempt}/{retries}). Retrying in {delay}s...")
                time.sleep(delay)
            else:
                error(f"Command timed out after {retries} attempts ({timeout}s each). Giving up.")
                sys.exit(1)
        except subprocess.CalledProcessError as e:
            if attempt < retries:
                warn(f"Attempt {attempt}/{retries} failed (exit {e.returncode}). Retrying in {delay}s...")
                time.sleep(delay)
            else:
                error(f"Command failed after {retries} attempts (exit {e.returncode}).")
                sys.exit(1)
        except KeyboardInterrupt:
            error("Deployment interrupted by user (Ctrl+C).")
            sys.exit(130)


# ─────────────────────────────────────────────────────────────────────────────
# Phase 1 — Build Frontend
# ─────────────────────────────────────────────────────────────────────────────
def build_frontend():
    print(f"\n{YELLOW}🏗️  Phase 1: Building Frontend (School Head)...{NC}", flush=True)

    info("Clearing legacy local build output directories...")
    shutil.rmtree("dist", ignore_errors=True)
    shutil.rmtree("apps/school-head/web/dist", ignore_errors=True)

    build_id = f"1.0.0-{int(time.time())}"
    info(f"Injecting cache-busting signature (VITE_APP_VERSION): {build_id}")

    env = os.environ.copy()
    env["VITE_APP_VERSION"] = build_id
    env["VITE_BASE_PATH"] = "/insighted-schoolhead/"

    info("Executing production workspace build via pnpm...")
    try:
        run_command("pnpm --filter school-head-web build", env=env, retries=1)
    except SystemExit:
        info("Targeted filter build failed. Falling back to global workspace build...")
        run_command("pnpm build", env=env, retries=1)

    if os.path.exists("apps/school-head/web/dist"):
        info("Copying compiled static assets to root distribution folder...")
        shutil.copytree("apps/school-head/web/dist", "dist")
    else:
        error("Vite build failed to generate apps/school-head/web/dist directory.")
        sys.exit(1)

    success("Frontend compilation and local mapping finalized.")

# ─────────────────────────────────────────────────────────────────────────────
# Phase 2 — Package Assets
# ─────────────────────────────────────────────────────────────────────────────
def package_assets():
    print(f"\n{YELLOW}📦 Phase 2: Packaging Assets...{NC}", flush=True)

    paths = [p for p in INCLUDE if os.path.exists(p)]
    skipped = [p for p in INCLUDE if not os.path.exists(p)]
    for p in skipped:
        warn(f"Path skipped (not present locally): {p}")

    # Exclude node_modules: pnpm junctions can't be archived by Windows bsdtar,
    # and the server rebuilds dependencies with `pnpm install --prod` anyway.
    run_command(f"tar --exclude=node_modules -czf {TAR_FILE} {' '.join(paths)}", retries=1)
    success(f"Workspace assets packaged into: {TAR_FILE}")

# ─────────────────────────────────────────────────────────────────────────────
# Phase 3 & 4 — Transfer + Atomic Remote Execution
# ─────────────────────────────────────────────────────────────────────────────
def deploy_remote():
    print(f"\n{YELLOW}🚀 Phase 3 & 4: Transferring & Atomic Remote Execution (Nginx Untouched){NC}", flush=True)

    # Step A: Ensure remote target directory exists
    info(f"Creating remote target directory on {SERVER_IP}...")
    run_command(
        f'{SSH_BASE} {SSH_TARGET} "mkdir -p {SERVER_DIR}"',
        retries=4, delay=8
    )

    # Step B: Stream tarball via SSH stdin pipe (avoids scp flag corruption on Windows)
    info(f"Streaming {TAR_FILE} to remote server ({SERVER_IP})...")
    run_command(
        f'type "{TAR_FILE}" | {SSH_BASE} {SSH_TARGET} "cat > {SERVER_DIR}/{TAR_FILE}"',
        retries=4, delay=8
    )

    # Step C: Backup current release, extract, pnpm install, reload PM2
    # (uploads/ and logs/ are never touched; nginx serves SERVER_DIR/dist directly)
    backup_file = f"{BACKUP_DIR}/schoolhead-{time.strftime('%Y%m%d-%H%M%S')}.tar.gz"
    info(f"Backing up current release to {backup_file}, then extracting and reloading PM2...")
    remote_script = " && ".join([
        f"mkdir -p {SERVER_DIR}/logs {BACKUP_DIR}",
        f"cd {SERVER_DIR}",
        f"tar -czf {backup_file} --ignore-failed-read dist apps .env package.json pnpm-lock.yaml",
        f"rm -rf {SERVER_DIR}/dist {SERVER_DIR}/apps/school-head/api {SERVER_DIR}/apps/siif/api",
        f"tar -xzf {TAR_FILE}",
        f"rm -f {TAR_FILE}",
        f"pnpm install --prod --frozen-lockfile --prefer-offline",
        f"pm2 reload {PM2_SCHOOLHEAD} --update-env",
        f"pm2 restart {PM2_SIIF} --update-env",
        f"pm2 save",
    ])

    # retries=1: the step is not idempotent (tarball is consumed on first run)
    run_command(
        f'{SSH_BASE} {SSH_TARGET} "{remote_script}"',
        retries=1
    )

    if os.path.exists(TAR_FILE):
        os.remove(TAR_FILE)

    success("Backup, extraction, and PM2 reload finalized.")
    info(f"Rollback: ssh {SSH_TARGET} \"cd {SERVER_DIR} && rm -rf dist apps/school-head/api apps/siif/api && tar -xzf {backup_file} && pm2 reload {PM2_SCHOOLHEAD} && pm2 restart {PM2_SIIF}\"")

# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────
def main():
    start_time = time.time()
    print(f"{CYAN}" + "="*60 + f"{NC}", flush=True)
    print(f"{GREEN}🚀 InsightEd School Head Cache-Busted Deployment Pipeline{NC}", flush=True)
    print(f"{CYAN}Server IP: {SERVER_IP} | Directory: {SERVER_DIR} | Lock: pnpm{NC}", flush=True)
    print(f"{CYAN}" + "="*60 + f"{NC}", flush=True)

    build_frontend()
    package_assets()
    deploy_remote()

    duration = time.time() - start_time
    print(f"{CYAN}" + "="*60 + f"{NC}", flush=True)
    success(f"Deployment completed flawlessly in {duration:.2f} seconds!")
    print(f"{CYAN}" + "="*60 + f"{NC}", flush=True)

if __name__ == "__main__":
    main()
