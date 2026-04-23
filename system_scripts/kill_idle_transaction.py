import paramiko

SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "<REDACTED_SSH_PASS>"

def kill_idle_transaction():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, port=22, username=USER, password=PASS)
        print("[Kill-Idle] Terminating idle-in-transaction blocker (pid 373608)...")

        # Kill the specific idle in transaction blocker
        cmd1 = "PGPASSWORD=<REDACTED_PGB_PASS> psql -h 127.0.0.1 -p 6432 -U Administrator1 -d insightEd -c \"SELECT pg_terminate_backend(373608);\""
        stdin, stdout, stderr = client.exec_command(cmd1)
        print(stdout.read().decode('utf-8', errors='replace'))

        # Kill ALL idle in transaction sessions older than 10 minutes
        cmd2 = """PGPASSWORD=<REDACTED_PGB_PASS> psql -h 127.0.0.1 -p 6432 -U Administrator1 -d insightEd -c "
SELECT pg_terminate_backend(pid), pid, state, left(query, 60)
FROM pg_stat_activity
WHERE state = 'idle in transaction'
  AND now() - query_start > interval '5 minutes'
  AND datname = 'insightEd';
" """
        stdin, stdout, stderr = client.exec_command(cmd2)
        print(stdout.read().decode('utf-8', errors='replace'))

        # Kill ALL remaining Lock waiters
        cmd3 = """PGPASSWORD=<REDACTED_PGB_PASS> psql -h 127.0.0.1 -p 6432 -U Administrator1 -d insightEd -c "
SELECT pg_terminate_backend(pid), pid, state
FROM pg_stat_activity
WHERE wait_event_type = 'Lock' AND datname = 'insightEd';
" """
        stdin, stdout, stderr = client.exec_command(cmd3)
        print(stdout.read().decode('utf-8', errors='replace'))
        
        print("[Kill-Idle] Checking final status...")
        cmd4 = """PGPASSWORD=<REDACTED_PGB_PASS> psql -h 127.0.0.1 -p 6432 -U Administrator1 -d insightEd -c "
SELECT count(*), state FROM pg_stat_activity WHERE datname='insightEd' GROUP BY state;
" """
        stdin, stdout, stderr = client.exec_command(cmd4)
        print(stdout.read().decode('utf-8', errors='replace'))
    finally:
        client.close()

if __name__ == "__main__":
    kill_idle_transaction()
