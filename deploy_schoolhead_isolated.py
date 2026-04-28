import subprocess
import os
import sys
import tarfile

# --- Configuration ---
REMOTE_USER  = "Administrator1"
REMOTE_HOST  = "20.24.58.49"
REMOTE_ROOT  = "/var/www/html/InsightEd-Mobile-PWA/insighted-schoolhead"
SSH_KEY_PATH = os.path.expanduser("~/.ssh/id_rsa")
ARCHIVE_NAME = "schoolhead-isolated-deploy.tar.gz"
ECOSYSTEM_CONFIG = "ecosystem.schoolhead.config.cjs"
PM2_NAME     = "insighted-schoolhead-backend"

# -------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------
def ssh(command: str) -> str:
    """Run a command on the remote server via SSH."""
    cmd = f'ssh -i "{SSH_KEY_PATH}" {REMOTE_USER}@{REMOTE_HOST} "{command}"'
    print(f"  → {command}")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if result.stdout.strip():
        print(result.stdout.strip())
    if result.returncode != 0 and result.stderr.strip():
        print(f"  ⚠  stderr: {result.stderr.strip()}")
    return result.stdout

def scp(local_path: str, remote_path: str):
    """Transfer a file to the remote server via SCP."""
    cmd = f'scp -i "{SSH_KEY_PATH}" {local_path} {REMOTE_USER}@{REMOTE_HOST}:{remote_path}'
    print(f"  → scp {local_path} → {remote_path}")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if result.returncode != 0:
        print(f"  ❌ scp failed: {result.stderr.strip()}")
        sys.exit(1)

def run(cmd: str, env=None):
    """Run a local command and fail on non-zero exit."""
    print(f"  → {cmd}")
    result = subprocess.run(cmd, shell=True, env=env, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if result.stdout.strip():
        print(result.stdout.strip())
    if result.returncode != 0:
        print(f"  ❌ Error: {result.stderr.strip()}")
        sys.exit(1)
    return result.stdout

# -------------------------------------------------------------------
# Main
# -------------------------------------------------------------------
def main():
    print("\n✨  Starting Comprehensive Isolated SchoolHead Deployment")
    print("=" * 60)

    # ------------------------------------------------------------------
    # STEP 1 : Build frontend
    # ------------------------------------------------------------------
    print("\n[1/6] 🏗️  Building frontend with base path /insighted-schoolhead/ ...")
    env = os.environ.copy()
    env["VITE_BASE_PATH"] = "/insighted-schoolhead/"
    run("npm run build", env=env)

    # ------------------------------------------------------------------
    # STEP 2 : Create archive  (api + dist + public + configs + .env)
    # ------------------------------------------------------------------
    print(f"\n[2/6] 📦  Archiving deployment payload → {ARCHIVE_NAME} ...")
    files_to_include = ["api", "dist", "public", "package.json", ECOSYSTEM_CONFIG, ".env"]
    with tarfile.open(ARCHIVE_NAME, "w:gz") as tar:
        for f in files_to_include:
            if os.path.exists(f):
                tar.add(f)
                print(f"       + {f}")
            else:
                print(f"       ⚠  skipping (not found): {f}")

    # ------------------------------------------------------------------
    # STEP 3 : Transfer archive
    # ------------------------------------------------------------------
    print(f"\n[3/6] 🚚  Uploading {ARCHIVE_NAME} to remote server ...")
    scp(ARCHIVE_NAME, "~/")

    # ------------------------------------------------------------------
    # STEP 4 : Remote extraction + npm install
    # ------------------------------------------------------------------
    print(f"\n[4/6] 🌐  Extracting on remote & installing dependencies ...")
    ssh(f"mkdir -p {REMOTE_ROOT}")
    ssh(f"tar -xzf ~/{ARCHIVE_NAME} -C {REMOTE_ROOT}")
    ssh(f"sudo chown -R {REMOTE_USER}:{REMOTE_USER} {REMOTE_ROOT}")
    # Install Node deps on the remote (skips if node_modules already fresh)
    ssh(f"cd {REMOTE_ROOT} && npm install --legacy-peer-deps --prefer-offline 2>&1 | tail -5")
    ssh(f"rm ~/{ARCHIVE_NAME}")

    # ------------------------------------------------------------------
    # STEP 5 : Hard reset PM2 process so it picks up new code path
    # ------------------------------------------------------------------
    print(f"\n[5/6] 🔄  Resetting PM2 process '{PM2_NAME}' ...")
    # Delete first (ignore errors if it doesn't exist yet)
    ssh(f"pm2 delete {PM2_NAME} 2>/dev/null || true")
    ssh(f"cd {REMOTE_ROOT} && pm2 start {ECOSYSTEM_CONFIG}")
    ssh("pm2 save")

    # ------------------------------------------------------------------
    # STEP 6 : Verify the API is responding correctly
    # ------------------------------------------------------------------
    print(f"\n[6/6] ✅  Verifying remote API ...")
    api_response = ssh(f"curl -s http://127.0.0.1:5010/api/ph_schools/progress/999009 2>&1 | cut -c1-200")
    if '"data"' in api_response:
        print("      ✅  API returns nested 'data' wrapper — schema correct!")
    else:
        print(f"      ⚠   API response doesn't match expected schema. Response: {api_response}")

    # ------------------------------------------------------------------
    # Local cleanup
    # ------------------------------------------------------------------
    if os.path.exists(ARCHIVE_NAME):
        os.remove(ARCHIVE_NAME)

    print("\n" + "=" * 60)
    print("🚀  Deployment Complete!")
    print("    Visit: https://stride.deped.gov.ph/insighted-schoolhead/")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
