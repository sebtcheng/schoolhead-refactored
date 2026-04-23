import paramiko

SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "<REDACTED_SSH_PASS>"

def run_remote_cmd(client, cmd):
    stdin, stdout, stderr = client.exec_command(cmd)
    return stdout.read().decode('utf-8'), stderr.read().decode('utf-8')

def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, port=22, username=USER, password=PASS)
        
        print("--- Top Active Queries ---")
        cmd = """sudo -u postgres psql -t -c "SELECT pid, state, now() - query_start as duration, query FROM pg_stat_activity WHERE state != 'idle' ORDER BY duration DESC LIMIT 10" 2>/dev/null"""
        out, _ = run_remote_cmd(client, cmd)
        print(out)
        
        print("\n--- Idle Connection Count by State ---")
        cmd = """sudo -u postgres psql -t -c "SELECT state, count(*) FROM pg_stat_activity GROUP BY state" 2>/dev/null"""
        out, _ = run_remote_cmd(client, cmd)
        print(out)
        
        print("\n--- PgBouncer Stats ---")
        # Assuming pgbouncer is on port 6432
        cmd = """sudo -u postgres psql -h 127.0.0.1 -p 6432 -U pgbouncer pgbouncer -c "SHOW POOLS" 2>/dev/null"""
        # Note: might need password or be configured for peer auth on localhost
        out, _ = run_remote_cmd(client, cmd)
        print(out)

    finally:
        client.close()

if __name__ == "__main__":
    main()
