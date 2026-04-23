import paramiko

SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "<REDACTED_SSH_PASS>"

def read_config():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, port=22, username=USER, password=PASS)
        
        # Get exact command line of pgbouncer
        stdin, stdout, stderr = client.exec_command("ps -ef | grep pgbouncer")
        print("PS_OUTPUT:")
        print(stdout.read().decode('utf-8'))
        
        # Read common config locations
        paths = ["/etc/pgbouncer/pgbouncer.ini", "/etc/pgbouncer.ini", "/etc/pgbouncer/pgb-staging.ini"]
        for p in paths:
            print(f"\nChecking {p}...")
            stdin, stdout, stderr = client.exec_command(f"cat {p}")
            content = stdout.read().decode('utf-8')
            if content:
                print(f"--- CONTENT OF {p} ---")
                print(content)

    finally:
        client.close()

if __name__ == "__main__":
    read_config()
