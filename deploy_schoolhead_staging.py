#!/usr/bin/env python3
import subprocess
import os
import sys
import tarfile
import time

# --- Configuration ---
REMOTE_USER  = "Administrator1"
REMOTE_HOST  = "20.24.58.49"
REMOTE_ROOT  = "/mnt/insighted-schoolhead-staging"
SSH_KEY_PATH = os.path.expanduser("~/.ssh/id_rsa").replace("\\", "/")
# Check if key file exists locally, otherwise omit -i from SSH commands
SSH_KEY_OPT = f'-i "{SSH_KEY_PATH}"' if os.path.exists(SSH_KEY_PATH) else ""
ARCHIVE_NAME = "schoolhead-staging-deploy.tar.gz"
ECOSYSTEM_CONFIG = "ecosystem.schoolhead-staging.config.cjs"
PM2_NAME     = "insighted-schoolhead-staging-backend"

def run_ssh(command: str, timeout=60):
    """Run bundled commands over a single SSH connection with a timeout."""
    # Use BatchMode=yes for connection check to prevent hangs
    ssh_cmd = f'ssh -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=10 {SSH_KEY_OPT} {REMOTE_USER}@{REMOTE_HOST} "{command}"'
    try:
        return subprocess.run(ssh_cmd, shell=True, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        print(f"  [ERROR] SSH command timed out after {timeout}s")
        sys.exit(1)

def main():
    print("\n" + "="*60)
    print("[DEPLOY] INSIGHTED SCHOOLHEAD: STAGING DEPLOYMENT (v2.0)")
    print("="*60)
    
    start_time = time.time()

    # 1. Pre-build local assets
    print("\n[1/5] BUILDING frontend (base: /insighted-schoolhead-staging/)...")
    env = os.environ.copy()
    env["VITE_BASE_PATH"] = "/insighted-schoolhead-staging/"
    env["NODE_OPTIONS"] = "--max-old-space-size=4096"
    try:
        subprocess.run("npx turbo run build --filter=@apps/school-head-web", shell=True, check=True, env=env)
    except subprocess.CalledProcessError:
        print("  [ERROR] Build failed! Aborting.")
        sys.exit(1)

    # 2. Archive only essential files (excluding node_modules)
    print(f"[2/5] ARCHIVING deployment payload -> {ARCHIVE_NAME}...")
    files_to_include = [
        "apps/school-head/api", 
        "apps/siif/api",
        "packages/shared-auth",
        "packages/shared-db",
        "packages/shared-io",
        "packages/shared-types",
        "public", 
        "package.json", 
        "pnpm-lock.yaml", 
        "pnpm-workspace.yaml", 
        ".npmrc",
        ECOSYSTEM_CONFIG, 
        ".env"
    ]
    with tarfile.open(ARCHIVE_NAME, "w:gz") as tar:
        for f in files_to_include:
            if os.path.exists(f):
                tar.add(f)
                print(f"       + {f}")
            else:
                print(f"       [SKIP] not found: {f}")
        
        # Inject the built frontend dist folder directly into the root as "dist" for Nginx
        frontend_dist = "apps/school-head/web/dist"
        if os.path.exists(frontend_dist):
            tar.add(frontend_dist, arcname="dist")
            print(f"       + {frontend_dist} -> (archived as dist/)")
        else:
            print(f"       [WARN] Frontend dist not found at {frontend_dist}!")

    print(f"[3/5] UPLOADING archive to {REMOTE_HOST} inside {REMOTE_ROOT}...")
    try:
        # Create directory first to ensure scp works
        run_ssh(f"sudo mkdir -p {REMOTE_ROOT} && sudo chown -R {REMOTE_USER}:{REMOTE_USER} {REMOTE_ROOT}")
        scp_cmd = f'scp -o StrictHostKeyChecking=no -o ConnectTimeout=10 {SSH_KEY_OPT} {ARCHIVE_NAME} {REMOTE_USER}@{REMOTE_HOST}:{REMOTE_ROOT}/'
        subprocess.run(scp_cmd, shell=True, check=True)
    except subprocess.CalledProcessError:
        print("  [ERROR] Upload failed! Check your SSH key and connection.")
        sys.exit(1)

    # 4. Bundled Remote Execution (Self-Healing & Speed)
    print("[4/5] REMOTE extraction, production install, and PM2 reset...")
    remote_script = (
        f"cd {REMOTE_ROOT} && "
        f"pm2 stop {PM2_NAME} 2>/dev/null || true && "
        f"sudo rm -rf apps packages node_modules && "
        f"mkdir -p dist && sudo rm -rf dist/* && "
        f"tar -xzf {ARCHIVE_NAME} && "
        f"sudo chown -R {REMOTE_USER}:{REMOTE_USER} {REMOTE_ROOT} && "
        f"find . -name 'node_modules' -type d -prune -exec rm -rf {{}} + 2>/dev/null || true && "
        # [Stabilization] Ensure .env uses localhost to bypass NIC bottlenecks
        "sed -i 's/20.24.58.49:6432/127.0.0.1:6432/g' .env && "
        "echo \"       → Running production pnpm install...\" && "
        "pnpm install --shamefully-hoist 2>&1 | tail -n 10 && "
        f"pm2 flush {PM2_NAME} && "
        f"pm2 delete {PM2_NAME} 2>/dev/null || true && "
        f"pm2 start {ECOSYSTEM_CONFIG} && "
        f"rm -f {ARCHIVE_NAME}"
    )
    
    # Use -t to force a pseudo-terminal, which helps with process cleanup
    ssh_cmd = f'ssh -t -o StrictHostKeyChecking=no {SSH_KEY_OPT} -o ConnectTimeout=10 {REMOTE_USER}@{REMOTE_HOST} "{remote_script}"'
    try:
        # We don't use capture_output here so the user can see the progress (echoes, etc.)
        subprocess.run(ssh_cmd, shell=True, check=True)
    except subprocess.CalledProcessError as e:
        print(f"  [ERROR] Remote setup failed with exit code {e.returncode}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n  [WARN] Deployment interrupted by user.")
        sys.exit(1)

    # 5. Final Health Check
    print("[5/5] VERIFYING remote API health...")
    verify_cmd = "curl -s http://127.0.0.1:5020/api/ph_schools/progress/999009"
    health = run_ssh(verify_cmd)
    if '"data"' in health.stdout:
        print("      SUCCESS: API confirmed online and responding correctly on port 5020!")
    else:
        print(f"      [WARN] Health check warning: Unexpected response. Check PM2 logs.")

    # Local cleanup
    if os.path.exists(ARCHIVE_NAME):
        os.remove(ARCHIVE_NAME)

    duration = time.time() - start_time
    print("\n" + "="*60)
    print(f"[SUCCESS] Staging Deployment Success! (Duration: {duration:.1f}s)")
    print("    URL: https://stride.deped.gov.ph/insighted-schoolhead-staging/")
    print("="*60 + "\n")

if __name__ == "__main__":
    main()
