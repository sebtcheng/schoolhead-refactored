import paramiko

SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "<REDACTED_SSH_PASS>"

def kill_locks():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, port=22, username=USER, password=PASS)
        print("[Kill-Locks] Checking and terminating blocking transactions...")

        # Step 1: Kill the root blocker (the TRUNCATE)
        kill_blocker = """
PGPASSWORD=<REDACTED_PGB_PASS> psql -h 127.0.0.1 -p 6432 -U Administrator1 -d insightEd -c "
SELECT pg_terminate_backend(pid), pid, state, left(query, 80) AS query
FROM pg_stat_activity 
WHERE datname='insightEd'
  AND state IN ('active', 'idle in transaction')
  AND now() - query_start > interval '5 minutes'
ORDER BY duration DESC;
"
"""
        # Step 2: Kill ALL blocked (Lock wait) connections
        kill_blocked = """
PGPASSWORD=<REDACTED_PGB_PASS> psql -h 127.0.0.1 -p 6432 -U Administrator1 -d insightEd -c "
SELECT pg_terminate_backend(pid), pid, state
FROM pg_stat_activity
WHERE datname='insightEd'
  AND wait_event_type = 'Lock';
"
"""
        cmds = [kill_blocker, kill_blocked]
        for cmd in cmds:
            stdin, stdout, stderr = client.exec_command(cmd)
            print(stdout.read().decode('utf-8', errors='replace'))
            print(stderr.read().decode('utf-8', errors='replace'))

        print("[Kill-Locks] Done. Checking connection status...")
        check_cmd = """
PGPASSWORD=<REDACTED_PGB_PASS> psql -h 127.0.0.1 -p 6432 -U Administrator1 -d insightEd -c "
SELECT count(*), state FROM pg_stat_activity WHERE datname='insightEd' GROUP BY state;
"
"""
        stdin, stdout, stderr = client.exec_command(check_cmd)
        print(stdout.read().decode('utf-8', errors='replace'))

    finally:
        client.close()

if __name__ == "__main__":
    kill_locks()
