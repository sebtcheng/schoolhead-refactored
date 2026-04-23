import paramiko

SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "<REDACTED_SSH_PASS>"

def check_db_limit():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, port=22, username=USER, password=PASS)
        
        # Connect through pgbouncer to the real DB to check its limits
        cmd = "PGPASSWORD=<REDACTED_PGB_PASS> psql -h 127.0.0.1 -p 6432 -U Administrator1 -d insightEd -c 'SHOW max_connections;'"
        stdin, stdout, stderr = client.exec_command(cmd)
        print("MAX_CONNECTIONS:")
        print(stdout.read().decode('utf-8'))
        
        # Also check current usage on the backend
        cmd = "PGPASSWORD=<REDACTED_PGB_PASS> psql -h 127.0.0.1 -p 6432 -U Administrator1 -d insightEd -c \"SELECT count(*) FROM pg_stat_activity WHERE state != 'idle';\""
        stdin, stdout, stderr = client.exec_command(cmd)
        print("\nACTIVE_BACKEND_CONNS:")
        print(stdout.read().decode('utf-8'))

    finally:
        client.close()

if __name__ == "__main__":
    check_db_limit()
