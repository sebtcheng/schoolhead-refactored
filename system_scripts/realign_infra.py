import paramiko

SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "<REDACTED_SSH_PASS>"

def realign_infra():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, port=22, username=USER, password=PASS)
        print("[Realign] Starting Infrastructure Realignment...")
        
        # 1. Update pgbouncer.ini
        pg_ini = """[databases]
insightEd = host=stride-posgre-prod-01.postgres.database.azure.com port=5432 dbname=insightEd user=Administrator1 password=<REDACTED_PGB_PASS> pool_size=100
insight_pooled = host=stride-posgre-prod-01.postgres.database.azure.com port=5432 dbname=insightEd user=Administrator1 password=<REDACTED_PGB_PASS> pool_size=100

[users]

[pgbouncer]
admin_users = Administrator1
listen_addr = 127.0.0.1
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 2000
default_pool_size = 100
reserve_pool_size = 20
reserve_pool_timeout = 3
server_tls_sslmode = require
log_connections = 1
log_disconnections = 1
log_stats = 1
stats_period = 60
server_idle_timeout = 600
server_connect_timeout = 15
server_login_retry = 15
query_timeout = 0
query_wait_timeout = 120
client_idle_timeout = 0
client_login_timeout = 60
"""
        # Save locally on server then move with sudo
        cmd_ini = f"echo '{pg_ini}' > /tmp/pgbouncer.ini && sudo mv /tmp/pgbouncer.ini /etc/pgbouncer/pgbouncer.ini && sudo chown root:postgres /etc/pgbouncer/pgbouncer.ini && sudo chmod 640 /etc/pgbouncer/pgbouncer.ini"
        stdin, stdout, stderr = client.exec_command(cmd_ini)
        print("[Realign] Updated pgbouncer.ini")
        
        # 2. Restart PgBouncer
        stdin, stdout, stderr = client.exec_command("sudo systemctl restart pgbouncer")
        print("[Realign] Restarted pgbouncer service")
        
        # 3. Update .env
        # Replace the DATABASE_URL with the local pooled version
        env_cmd = "sed -i 's|DATABASE_URL=.*|DATABASE_URL=postgres://Administrator1:<REDACTED_PGB_PASS>@127.0.0.1:6432/insightEd?ssl=false|' /var/www/html/InsightEd-Mobile-PWA/.env"
        stdin, stdout, stderr = client.exec_command(env_cmd)
        print("[Realign] Updated .env to use port 6432")
        
        # 4. Restart PM2 to pick up .env changes
        stdin, stdout, stderr = client.exec_command("cd /var/www/html/InsightEd-Mobile-PWA && pm2 restart insighted-backend --update-env")
        print("[Realign] Restarted insighted-backend with updated env")

    finally:
        client.close()

if __name__ == "__main__":
    realign_infra()
