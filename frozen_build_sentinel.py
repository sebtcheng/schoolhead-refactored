import os
import sys
import subprocess
import time
import json
import tarfile
import argparse
from datetime import datetime

# --- Configuration ---
REMOTE_USER  = "Administrator1"
REMOTE_HOST  = "20.24.58.49"
REMOTE_ROOT  = "/var/www/html/InsightEd-Mobile-PWA/insighted-schoolhead"
SSH_KEY_PATH = os.path.expanduser("C:\\Users\\SebastianCheng\\.ssh\\id_rsa")
BACKUP_DIR   = "backups"
INDEX_FILE   = os.path.join(BACKUP_DIR, "index.json")
ECOSYSTEM_CONFIG = "ecosystem.schoolhead.config.cjs"
PM2_NAME     = "insighted-schoolhead-backend"

def run_local(cmd, env=None, capture=True):
    print(f"  [LOCAL] {cmd}")
    result = subprocess.run(cmd, shell=True, env=env, capture_output=capture, text=True, encoding="utf-8", errors="replace")
    if result.returncode != 0 and capture:
        print(f"  ❌ Error (Code {result.returncode}): {result.stderr.strip()}")
        if result.stdout:
            print(f"  Stdout: {result.stdout.strip()[:500]}")
    return result

def ssh(command: str):
    cmd = f'ssh -i "{SSH_KEY_PATH}" {REMOTE_USER}@{REMOTE_HOST} "{command}"'
    print(f"  [REMOTE] {command}")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, encoding="utf-8", errors="replace")
    return result

def scp(local_path: str, remote_path: str):
    cmd = f'scp -i "{SSH_KEY_PATH}" {local_path} {REMOTE_USER}@{REMOTE_HOST}:{remote_path}'
    print(f"  [SCP] {local_path} -> {remote_path}")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if result.returncode != 0:
        print(f"  ❌ SCP failed: {result.stderr.strip()}")
        sys.exit(1)

def get_git_info():
    try:
        branch = run_local("git rev-parse --abbrev-ref HEAD").stdout.strip()
        commit = run_local("git rev-parse HEAD").stdout.strip()
        message = run_local("git log -1 --pretty=%B").stdout.strip()
        return {"branch": branch, "commit": commit, "message": message}
    except:
        return {"branch": "unknown", "commit": "unknown", "message": "unknown"}

def init_index():
    if not os.path.exists(BACKUP_DIR):
        os.makedirs(BACKUP_DIR)
    if not os.path.exists(INDEX_FILE):
        with open(INDEX_FILE, 'w') as f:
            json.dump([], f)

def load_index():
    init_index()
    with open(INDEX_FILE, 'r') as f:
        return json.load(f)

def save_index(data):
    with open(INDEX_FILE, 'w') as f:
        json.dump(data, f, indent=2)

def freeze(label):
    print(f"\n❄️  Freezing Build: {label}")
    print("=" * 60)
    
    # 1. Build
    print("\n[1/4] 🏗️ Build frontend...")
    env = os.environ.copy()
    env["VITE_BASE_PATH"] = "/insighted-schoolhead/"
    if run_local("npm run build", env=env).returncode != 0:
        print("❌ Build failed. Aborting.")
        return

    # 2. Archive
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    archive_filename = f"frozen_{timestamp}.tar.gz"
    archive_path = os.path.join(BACKUP_DIR, archive_filename)
    
    print(f"\n[2/4] 📦 Creating archive: {archive_filename}...")
    files_to_include = ["api", "dist", "package.json", ECOSYSTEM_CONFIG, ".env"]
    with tarfile.open(archive_path, "w:gz") as tar:
        for f in files_to_include:
            if os.path.exists(f):
                tar.add(f)
                print(f"       + {f}")
            else:
                print(f"       ⚠ skipping: {f}")

    # 3. Git Info
    git_info = get_git_info()
    
    # 4. Update Index
    index = load_index()
    snapshot = {
        "id": timestamp,
        "label": label,
        "archive": archive_filename,
        "timestamp": datetime.now().isoformat(),
        "git": git_info
    }
    index.append(snapshot)
    save_index(index)
    
    print("\n✅ Build frozen successfully!")
    print(f"   ID: {timestamp}")
    print(f"   Archive: {archive_path}")

def list_builds():
    index = load_index()
    if not index:
        print("No frozen builds found.")
        return
    
    print(f"\n📋 Frozen Builds Index")
    print("-" * 80)
    print(f"{'ID':<16} | {'Label':<25} | {'Branch':<15} | {'Commit'}")
    print("-" * 80)
    for b in reversed(index):
        print(f"{b['id']:<16} | {b['label'][:25]:<25} | {b['git']['branch'][:15]:<15} | {b['git']['commit'][:8]}")

def restore(snapshot_id):
    index = load_index()
    snapshot = next((b for b in index if b['id'] == snapshot_id), None)
    
    if not snapshot:
        print(f"❌ Snapshot ID '{snapshot_id}' not found.")
        return

    print(f"\n🔥 Restoring Build: {snapshot['label']} (ID: {snapshot_id})")
    print("=" * 60)
    
    archive_path = os.path.join(BACKUP_DIR, snapshot['archive'])
    if not os.path.exists(archive_path):
        print(f"❌ Archive file not found: {archive_path}")
        return

    # 1. Upload
    print("\n[1/3] 🚚 Uploading archive to remote...")
    scp(archive_path, f"~/{snapshot['archive']}")

    # 2. Remote Extraction
    print("\n[2/3] 🌐 Extracting on remote...")
    remote_cmds = [
        f"mkdir -p {REMOTE_ROOT}",
        f"tar -xzf ~/{snapshot['archive']} -C {REMOTE_ROOT}",
        f"cd {REMOTE_ROOT} && npm install --legacy-peer-deps --prefer-offline 2>&1 | tail -5",
        f"rm ~/{snapshot['archive']}"
    ]
    res = ssh(" && ".join(remote_cmds))
    if res.returncode != 0:
        print(f"❌ Remote extraction failed: {res.stderr}")
        return

    # 3. Restart PM2
    print("\n[3/3] 🔄 Restarting PM2 process...")
    res = ssh(f"cd {REMOTE_ROOT} && pm2 delete {PM2_NAME} 2>/dev/null || true && pm2 start {ECOSYSTEM_CONFIG} && pm2 save")
    
    print("\n🚀 Restore Complete!")
    print(f"   Site should be live at: https://stride.deped.gov.ph/insighted-schoolhead/")

def delete_snapshot(snapshot_id):
    index = load_index()
    snapshot = next((b for b in index if b['id'] == snapshot_id), None)
    
    if not snapshot:
        print(f"❌ Snapshot ID '{snapshot_id}' not found.")
        return

    archive_path = os.path.join(BACKUP_DIR, snapshot['archive'])
    if os.path.exists(archive_path):
        os.remove(archive_path)
        print(f"🗑️  Deleted archive: {archive_path}")
    
    new_index = [b for b in index if b['id'] != snapshot_id]
    save_index(new_index)
    print(f"✅ Removed {snapshot_id} from index.")

def run_interactive():
    print("\n" + "=" * 60)
    print("🛡️  FROZEN BUILD SENTINEL - Interactive Mode")
    print("=" * 60)
    print("1. [F]reeze   - Capture current build as a 'golden' version")
    print("2. [L]ist     - View all available frozen builds")
    print("3. [R]estore  - Revert production to a specific frozen build")
    print("4. [D]elete   - Remove a frozen build to save space")
    print("5. [E]xit     - Close the sentinel")
    
    choice = input("\nSelect an action [1-5 or F/L/R/D/E]: ").strip().upper()
    
    if choice in ['1', 'F']:
        label = input("🏷️  Enter a label for this build (e.g. 'Stable v1'): ").strip()
        if label:
            freeze(label)
        else:
            print("❌ Label is required.")
            
    elif choice in ['2', 'L']:
        list_builds()
        
    elif choice in ['3', 'R']:
        list_builds()
        snapshot_id = input("\n🔥 Enter the Snapshot ID (Timestamp) to restore: ").strip()
        if snapshot_id:
            confirm = input(f"⚠️  Are you sure you want to overwrite production with {snapshot_id}? [y/N]: ").strip().lower()
            if confirm == 'y':
                restore(snapshot_id)
            else:
                print("Aborted.")
    
    elif choice in ['4', 'D']:
        list_builds()
        snapshot_id = input("\n🗑️  Enter the Snapshot ID to delete: ").strip()
        if snapshot_id:
            confirm = input(f"❓ Are you sure you want to delete {snapshot_id}? This cannot be undone. [y/N]: ").strip().lower()
            if confirm == 'y':
                delete_snapshot(snapshot_id)
            else:
                print("Aborted.")
                
    elif choice in ['5', 'E']:
        print("Goodbye!")
        sys.exit(0)
    else:
        print("Invalid choice.")

def main():
    parser = argparse.ArgumentParser(description="Frozen Build Sentinel - snapshot and restore production builds.")
    parser.add_argument("--freeze", help="Create a frozen build with the given label")
    parser.add_argument("--list", action="store_true", help="List all frozen builds")
    parser.add_argument("--restore", help="Restore a frozen build by ID (timestamp)")
    
    args = parser.parse_args()
    
    # If no arguments provided, enter interactive mode
    if len(sys.argv) == 1:
        while True:
            run_interactive()
            input("\nPress Enter to return to menu...")
    else:
        if args.freeze:
            freeze(args.freeze)
        elif args.list:
            list_builds()
        elif args.restore:
            restore(args.restore)
        else:
            parser.print_help()

if __name__ == "__main__":
    main()
