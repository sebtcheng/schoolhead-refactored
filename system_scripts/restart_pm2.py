import paramiko

SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "<REDACTED_SSH_PASS>"

def restart_pm2():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, port=22, username=USER, password=PASS)
        print("[PM2-Restart] Restarting all PM2 instances...")

        # Restart all instances cleanly
        cmd = "pm2 restart all --update-env"
        stdin, stdout, stderr = client.exec_command(cmd)
        out = stdout.read().decode('utf-8', errors='replace')
        err = stderr.read().decode('utf-8', errors='replace')
        print(out[:3000])
        print(err[:500])
        
        print("[PM2-Restart] Checking pm2 list...")
        stdin, stdout, stderr = client.exec_command("pm2 list")
        print(stdout.read().decode('utf-8', errors='replace')[:2000])
    finally:
        client.close()

if __name__ == "__main__":
    restart_pm2()
