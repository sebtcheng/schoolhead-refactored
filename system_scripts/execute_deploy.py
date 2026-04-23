import paramiko
import sys

SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "<REDACTED_SSH_PASS>"

def deploy():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, port=22, username=USER, password=PASS)
        # Sync and reset to ensure we match the pushed state exactly
        print("[Deploy] Syncing with origin/main...")
        sync_cmd = "cd /var/www/html/InsightEd-Mobile-PWA && git fetch origin && git reset --hard origin/main"
        stdin, stdout, stderr = client.exec_command(sync_cmd)
        print(stdout.read().decode())
        print(stderr.read().decode())

        print("[Deploy] Executing remote deploy.sh...")
        cmd = "cd /var/www/html/InsightEd-Mobile-PWA && bash deploy.sh"
        stdin, stdout, stderr = client.exec_command(cmd)
        
        # Stream output
        for line in stdout:
            try:
                print(line.strip())
            except UnicodeEncodeError:
                print(line.encode('ascii', errors='replace').decode().strip())
        for line in stderr:
            try:
                print(line.strip())
            except UnicodeEncodeError:
                print(line.encode('ascii', errors='replace').decode().strip())
            
        print("[Deploy] Remote execution finished.")

    finally:
        client.close()

if __name__ == "__main__":
    deploy()
