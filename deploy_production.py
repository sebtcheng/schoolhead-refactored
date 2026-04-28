import os
import subprocess
import time

# Configuration for Production Deployment
VM_IP = "20.24.58.49"
VM_USER = "Administrator1"
SSH_KEY = r"C:\Users\SebastianCheng\.ssh\id_rsa"
REMOTE_PATH = "/var/www/html/InsightEd-Mobile-PWA"  # Root directory for production
BACKEND_PM2_NAME = "insighted-backend"
ARCHIVE_NAME = "prod-deploy.tar.gz"

def run_cmd(cmd, shell=True):
    print(f"🚀 Running: {cmd}")
    result = subprocess.run(cmd, shell=shell, text=True, capture_output=True)
    if result.returncode != 0:
        print(f"❌ Error: {result.stderr}")
        return False
    return True

def deploy():
    print("✨ Starting Production Deployment...")
    
    # 1. Build frontend with root base path
    print("🏗️ Building frontend with root base path...")
    os.environ["VITE_BASE_PATH"] = "/"
    if not run_cmd("npm run build"):
        return

    # 2. Archive the build and API
    print("📦 Creating deployment archive...")
    # We include 'dist' and 'api'
    if not run_cmd(f"tar -czf {ARCHIVE_NAME} dist api"):
        return

    # 3. Transfer to VM
    print("🚚 Transferring archive to server...")
    scp_cmd = f"scp -i \"{SSH_KEY}\" {ARCHIVE_NAME} {VM_USER}@{VM_IP}:~/"
    if not run_cmd(scp_cmd):
        return

    # 4. Remote Extraction and Restart
    print("🔧 Extracting and restarting backend on server...")
    remote_cmds = [
        f"sudo tar -xzf ~/{ARCHIVE_NAME} -C {REMOTE_PATH} --strip-components=0",
        f"pm2 restart {BACKEND_PM2_NAME}",
        f"rm ~/{ARCHIVE_NAME}"
    ]
    
    ssh_cmd = f"ssh -i \"{SSH_KEY}\" {VM_USER}@{VM_IP} \"{' && '.join(remote_cmds)}\""
    if not run_cmd(ssh_cmd):
        return

    # 5. Cleanup local archive
    os.remove(ARCHIVE_NAME)
    print("✅ Production Deployment Complete!")

if __name__ == "__main__":
    deploy()
