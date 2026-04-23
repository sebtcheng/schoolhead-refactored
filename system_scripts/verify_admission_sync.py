import paramiko
import time
import sys

SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "<REDACTED_SSH_PASS>"

def verify():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, port=22, username=USER, password=PASS)
        print("[Verification] Checking Admission Control Sync...")
        
        # 1. Check if DELAY_THRESHOLD is correctly identified
        cmd_grep = "grep -E 'DELAY_THRESHOLD|HEAP_THRESHOLD' /var/www/html/InsightEd-Mobile-PWA/api/index.js"
        stdin, stdout, stderr = client.exec_command(cmd_grep)
        print("\n--- Current API Thresholds ---")
        print(stdout.read().decode().strip())
        
        # 2. Check for recent rejections in PM2 logs
        cmd_logs = "pm2 logs insighted-backend --lines 50 --nostream | grep 'Admission-Control'"
        stdin, stdout, stderr = client.exec_command(cmd_logs)
        rejections = stdout.read().decode().strip()
        print("\n--- Recent Rejections (PM2) ---")
        if rejections:
            print(rejections)
        else:
            print("No recent rejections found in logs.")
            
        # 3. Check for 5xx in Nginx logs
        cmd_nx = "sudo tail -n 100 /var/log/nginx/access.log | grep -E ' 50[0-9] '"
        stdin, stdout, stderr = client.exec_command(cmd_nx)
        nginx_errs = stdout.read().decode().strip()
        print("\n--- Recent 5xx Errors (Nginx) ---")
        if nginx_errs:
            print(nginx_errs)
        else:
            print("No recent 5xx errors found in logs.")

    finally:
        client.close()

if __name__ == "__main__":
    verify()
