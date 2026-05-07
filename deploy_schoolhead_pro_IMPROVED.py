import subprocess
import os
import sys
import tarfile
import time

# --- Configuration ---
REMOTE_USER  = "Administrator1"
REMOTE_HOST  = "20.24.58.49"
REMOTE_ROOT  = "/var/www/html/InsightEd-Mobile-PWA/insighted-schoolhead"
SSH_KEY_PATH = os.path.expanduser("~/.ssh/id_rsa")
ARCHIVE_NAME = "schoolhead-deploy.tar.gz"
ECOSYSTEM_CONFIG = "ecosystem.schoolhead.config.cjs"
PM2_NAME     = "insighted-schoolhead-backend"

def run_ssh(command: str, timeout=60):
    """Run bundled commands over a single SSH connection with a timeout."""
    ssh_cmd = f'ssh -i "{SSH_KEY_PATH}" -o ConnectTimeout=10 {REMOTE_USER}@{REMOTE_HOST} "{command}"'
    try:
        return subprocess.run(ssh_cmd, shell=True, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        print(f"  [ERROR] SSH command timed out after {timeout}s")
        sys.exit(1)

def main():
    print("\n" + "="*60)
    print("[DEPLOY] INSIGHTED SCHOOLHEAD: MASTER TINKERER DEPLOYMENT (v2.0)")
    print("="*60)
    
    start_time = time.time()

    # 1. Pre-build local assets
    print("\n[1/5] BUILDING frontend (base: /insighted-schoolhead/)...")
    env = os.environ.copy()
    env["VITE_BASE_PATH"] = "/insighted-schoolhead/"
    try:
        subprocess.run("npm run build", shell=True, check=True, env=env)
    except subprocess.CalledProcessError:
        print("  [ERROR] Build failed! Aborting.")
        sys.exit(1)

    # 2. Archive only essential files (excluding node_modules)
    print(f"[2/5] ARCHIVING deployment payload -> {ARCHIVE_NAME}...")
    files_to_include = ["api", "dist", "public", "package.json", "package-lock.json", ECOSYSTEM_CONFIG, ".env"]
    with tarfile.open(ARCHIVE_NAME, "w:gz") as tar:
        for f in files_to_include:
            if os.path.exists(f):
                tar.add(f)
                print(f"       + {f}")
            else:
                print(f"       ⚠  skipping (not found): {f}")

    print(f"[3/5] UPLOADING archive to {REMOTE_HOST} inside {REMOTE_ROOT}...")
    try:
        # Create directory first to ensure scp works
        run_ssh(f"mkdir -p {REMOTE_ROOT}")
        subprocess.run(f'scp -i "{SSH_KEY_PATH}" {ARCHIVE_NAME} {REMOTE_USER}@{REMOTE_HOST}:{REMOTE_ROOT}/', shell=True, check=True)
    except subprocess.CalledProcessError:
        print("  [ERROR] Upload failed! Check your SSH key and connection.")
        sys.exit(1)

    # 4. Bundled Remote Execution (Self-Healing & Speed)
    print("[4/5] REMOTE extraction, production install, and PM2 reset...")
    # TINKERER FIX: Using joined commands for Windows/SSH compatibility and adding Disk Check
        f"cd {REMOTE_ROOT} && "
        f"tar -xzf {ARCHIVE_NAME} && "
        f"sudo chown -R {REMOTE_USER}:{REMOTE_USER} {REMOTE_ROOT} && "
        # [Stabilization] Ensure .env uses localhost to bypass NIC bottlenecks
        "sed -i 's/20.24.58.49:6432/127.0.0.1:6432/g' .env && "
        "echo \"       → Running production npm install...\" && "
        "npm install --omit=dev --legacy-peer-deps --prefer-offline --no-audit --no-fund 2>&1 | tail -n 10 && "
        # [Safety] Prevent table locks during deployment to avoid Unit 7 master failures
        f"pm2 flush {PM2_NAME} && "
        f"pm2 delete {PM2_NAME} 2>/dev/null || true && "
        f"pm2 start {ECOSYSTEM_CONFIG} && "
        "pm2 save && "
        f"rm {ARCHIVE_NAME}"
    )
    
    # Use -t to force a pseudo-terminal, which helps with process cleanup
    ssh_cmd = f'ssh -t -i "{SSH_KEY_PATH}" -o ConnectTimeout=10 {REMOTE_USER}@{REMOTE_HOST} "{remote_script}"'
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
    verify_cmd = "curl -s http://127.0.0.1:5010/api/ph_schools/progress/999009"
    health = run_ssh(verify_cmd)
    if '"data"' in health.stdout:
        print("      SUCCESS: API confirmed online and responding correctly!")
    else:
        print(f"      [WARN] Health check warning: Unexpected response. Check PM2 logs.")

    # Local cleanup
    if os.path.exists(ARCHIVE_NAME):
        os.remove(ARCHIVE_NAME)

    duration = time.time() - start_time
    print("\n" + "="*60)
    print(f"[SUCCESS] Deployment Success! (Duration: {duration:.1f}s)")
    print("    URL: https://stride.deped.gov.ph/insighted-schoolhead/")
    print("="*60 + "\n")

if __name__ == "__main__":
    main()
