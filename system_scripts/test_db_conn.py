import paramiko

SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "<REDACTED_SSH_PASS>"

def test_db_conn():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, port=22, username=USER, password=PASS)
        print("[Test] Connecting to insightEd via pgbouncer...")
        
        # We'll use PGPASSWORD to pass the password
        cmd = "PGPASSWORD=<REDACTED_PGB_PASS> psql -h 127.0.0.1 -p 6432 -U Administrator1 -d insightEd -c 'SELECT 1;'"
        stdin, stdout, stderr = client.exec_command(cmd)
        
        print("STDOUT:")
        print(stdout.read().decode())
        print("STDERR:")
        print(stderr.read().decode())

    finally:
        client.close()

if __name__ == "__main__":
    test_db_conn()
