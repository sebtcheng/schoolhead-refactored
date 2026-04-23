import paramiko

SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "<REDACTED_SSH_PASS>"

def read_config():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, port=22, username=USER, password=PASS)
        print("🔍 Searching for pgbouncer.ini...")
        
        # Try common locations
        locations = ["/etc/pgbouncer/pgbouncer.ini", "/etc/pgbouncer.ini", "/home/Administrator1/pgbouncer.ini"]
        for loc in locations:
            stdin, stdout, stderr = client.exec_command(f"cat {loc}")
            content = stdout.read().decode('utf-8', errors='replace')
            if content:
                print(f"--- Found at {loc} ---")
                print(content)
                break
        
        print("\n🔍 Checking PgBouncer process status...")
        stdin, stdout, stderr = client.exec_command("ps aux | grep pgbouncer")
        print(stdout.read().decode('utf-8', errors='replace'))

    finally:
        client.close()

if __name__ == "__main__":
    read_config()
