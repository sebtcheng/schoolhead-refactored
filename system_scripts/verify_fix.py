import paramiko
import sys

SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "<REDACTED_SSH_PASS>"

def run_remote_cmd(client, cmd):
    stdin, stdout, stderr = client.exec_command(cmd)
    return stdout.read().decode('utf-8'), stderr.read().decode('utf-8')

def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, port=22, username=USER, password=PASS)
        
        print("Restarting insighted-backend via PM2...")
        # Use reload for zero-downtime if supported, or restart
        out, err = run_remote_cmd(client, "pm2 reload insighted-backend")
        print(out, err)
        
        import time
        print("Waiting 10s for instances to stabilize...")
        time.sleep(10)
        
        print("\nChecking current PM2 status...")
        out, err = run_remote_cmd(client, "pm2 list")
        print(out)
        
        print("\n--- Verifying Real-IP in Access Logs ---")
        # Check if the client IP in access log is still 10.103.1.4 or something else
        out, err = run_remote_cmd(client, "sudo tail -n 20 /var/log/nginx/access.log")
        print(out)
        
        print("\n--- Verifying Backend Thresholds ---")
        out, err = run_remote_cmd(client, "grep -E 'HEAP_THRESHOLD|DELAY_THRESHOLD' e:/InsightEd-Mobile-PWA/api/index.js")
        print(out)

    finally:
        client.close()

if __name__ == "__main__":
    main()
