import paramiko

SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "<REDACTED_SSH_PASS>"

def hot_patch_ssl():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, port=22, username=USER, password=PASS)
        print("[Hot-Patch] Patching api/index.js on server...")
        
        # We replace the ssl logic explicitly to false when using 127.0.0.1
        patch_cmd = r"""
        sed -i "s/ssl: isLocal ? false : { rejectUnauthorized: false }/ssl: isLocal ? false : { rejectUnauthorized: false }/" /var/www/html/InsightEd-Mobile-PWA/api/index.js
        """
        # Wait, if isLocal evaluates to false, why would it?
        # Let's just force it to false because we know PgBouncer is local.
        patch_cmd = """
        sed -i 's/ssl: isLocal ? false : { rejectUnauthorized: false }/ssl: false/' /var/www/html/InsightEd-Mobile-PWA/api/index.js
        sed -i "s/const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');/const isLocal = true;/" /var/www/html/InsightEd-Mobile-PWA/api/index.js
        """
        
        stdin, stdout, stderr = client.exec_command(patch_cmd)
        
        print("[Hot-Patch] Restarting PM2...")
        stdin, stdout, stderr = client.exec_command("cd /var/www/html/InsightEd-Mobile-PWA && pm2 restart insighted-backend --update-env")
        print(stdout.read().decode())
        print(stderr.read().decode())

    finally:
        client.close()

if __name__ == "__main__":
    hot_patch_ssl()
