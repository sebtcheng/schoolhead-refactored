import paramiko

SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "7v52E69TYgTE"

def find_logs():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, username=USER, password=PASS)
        # Find where access.log is
        stdin, stdout, stderr = client.exec_command("find /var/log -name access.log 2>/dev/null")
        print("Found access.log files:")
        print(stdout.read().decode())
        
        # Check disk usage
        stdin, stdout, stderr = client.exec_command("df -h")
        print("Disk usage:")
        print(stdout.read().decode())
        
        # Check PgBouncer pools
        stdin, stdout, stderr = client.exec_command("PGPASSWORD='pRZTbQ2T1JD7' psql -h 127.0.0.1 -p 6432 -U Administrator1 -d pgbouncer -c 'SHOW POOLS;'")
        print("PgBouncer POOLS:")
        print(stdout.read().decode())
            
    finally:
        client.close()

if __name__ == "__main__":
    find_logs()
