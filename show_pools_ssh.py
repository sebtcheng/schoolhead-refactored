import paramiko

SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "<REDACTED_SSH_PASS>"

def show_pools():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, port=22, username=USER, password=PASS)
        
        # Connect to pgbouncer admin console via psql locally on the VM
        # Note: PgBouncer admin console usually doesn't require a password for local connections if configured
        cmd = "PGPASSWORD=<REDACTED_PGB_PASS> psql -h 127.0.0.1 -p 6432 -U pgbouncer -d pgbouncer -c 'SHOW POOLS;'"
        stdin, stdout, stderr = client.exec_command(cmd)
        print("POOLS_OUTPUT:")
        print(stdout.read().decode('utf-8'))
        print(stderr.read().decode('utf-8'))

    finally:
        client.close()

if __name__ == "__main__":
    show_pools()
