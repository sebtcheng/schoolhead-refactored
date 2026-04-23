import paramiko

SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "<REDACTED_SSH_PASS>"

def fix_env():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, port=22, username=USER, password=PASS)
        print("[Fix-Env] Stripping ?ssl=false from DATABASE_URL...")
        
        # Replace the DATABASE_URL to remove ?ssl=false
        env_cmd = "sed -i 's|DATABASE_URL=postgres://Administrator1:<REDACTED_PGB_PASS>@127.0.0.1:6432/insightEd?ssl=false|DATABASE_URL=postgres://Administrator1:<REDACTED_PGB_PASS>@127.0.0.1:6432/insightEd|' /var/www/html/InsightEd-Mobile-PWA/.env"
        stdin, stdout, stderr = client.exec_command(env_cmd)
        
        print("[Fix-Env] Restarting PM2...")
        stdin, stdout, stderr = client.exec_command("cd /var/www/html/InsightEd-Mobile-PWA && pm2 restart insighted-backend --update-env")
        print(stdout.read().decode())
        print(stderr.read().decode())

    finally:
        client.close()

if __name__ == "__main__":
    fix_env()
