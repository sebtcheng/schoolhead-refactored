import paramiko

SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "<REDACTED_SSH_PASS>"

def check_azure_conn():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, port=22, username=USER, password=PASS)
        print("[DB-Check] Checking active connections via PgBouncer...")

        # Check active DB connections from the postgres side (through pgbouncer)
        cmds = [
            "PGPASSWORD=<REDACTED_PGB_PASS> psql -h 127.0.0.1 -p 6432 -U Administrator1 -d insightEd -c \"SELECT count(*), state FROM pg_stat_activity GROUP BY state;\"",
            "PGPASSWORD=<REDACTED_PGB_PASS> psql -h 127.0.0.1 -p 6432 -U Administrator1 -d insightEd -c \"SELECT count(*) AS active_conns, wait_event_type, wait_event FROM pg_stat_activity WHERE datname='insightEd' GROUP BY wait_event_type, wait_event ORDER BY active_conns DESC LIMIT 20;\"",
            "PGPASSWORD=<REDACTED_PGB_PASS> psql -h 127.0.0.1 -p 6432 -U Administrator1 -d insightEd -c \"SELECT pid, state, query_start, now() - query_start AS duration, left(query, 80) FROM pg_stat_activity WHERE datname='insightEd' AND state != 'idle' ORDER BY duration DESC LIMIT 10;\"",
        ]
        
        for cmd in cmds:
            stdin, stdout, stderr = client.exec_command(cmd)
            print(stdout.read().decode('utf-8', errors='replace'))
            print(stderr.read().decode('utf-8', errors='replace'))

    finally:
        client.close()

if __name__ == "__main__":
    check_azure_conn()
