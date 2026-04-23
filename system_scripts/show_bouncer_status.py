import paramiko

SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "<REDACTED_SSH_PASS>"

def show_pools():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, port=22, username=USER, password=PASS)
        print("[Bouncer-Status] Running SHOW POOLS...")
        
        # Connect to pgbouncer database on port 6432 as Administrator1
        # No password needed if auth_type = trust for Administrator1
        cmd = 'psql -h 127.0.0.1 -p 6432 -U Administrator1 -d pgbouncer -c "SHOW POOLS"'
        stdin, stdout, stderr = client.exec_command(cmd)
        
        print(stdout.read().decode())
        print(stderr.read().decode())
        
        print("[Bouncer-Status] Running SHOW STATS...")
        cmd2 = 'psql -h 127.0.0.1 -p 6432 -U Administrator1 -d pgbouncer -c "SHOW STATS"'
        stdin, stdout, stderr = client.exec_command(cmd2)
        print(stdout.read().decode())

    finally:
        client.close()

if __name__ == "__main__":
    show_pools()
