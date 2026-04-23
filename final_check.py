import paramiko

SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "<REDACTED_SSH_PASS>"

def final_check():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, username=USER, password=PASS)
        
        # Check cl_waiting specifically
        cmd = "PGPASSWORD='<REDACTED_PGB_PASS>' psql -h 127.0.0.1 -p 6432 -U Administrator1 -d pgbouncer -c 'SHOW POOLS;' | grep insightEd"
        stdin, stdout, stderr = client.exec_command(cmd)
        print("PgBouncer POOLS (insightEd):")
        print(stdout.read().decode())
        
        # Check disk space on root
        stdin, stdout, stderr = client.exec_command("df -h /")
        print("Disk space on /:")
        print(stdout.read().decode())
        
        # Check for any large logs
        stdin, stdout, stderr = client.exec_command("find /var/log -type f -size +100M -exec ls -lh {} +")
        print("Large logs (>100MB):")
        print(stdout.read().decode())
            
    finally:
        client.close()

if __name__ == "__main__":
    final_check()
