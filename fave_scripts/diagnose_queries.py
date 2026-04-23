import paramiko, sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('20.24.58.49', 22, 'Administrator1', '<REDACTED_SSH_PASS>', timeout=15)

cmd = """PGPASSWORD='<REDACTED_PGB_PASS>' psql -h 127.0.0.1 -p 6432 -U Administrator1 -d 'insightEd' -c "SELECT EXTRACT(EPOCH FROM now() - query_start) AS sec, state, substring(query, 1, 150) as q FROM pg_stat_activity WHERE state != 'idle' AND pid <> pg_backend_pid() ORDER BY sec DESC LIMIT 30;" 2>&1"""
_, o, _ = c.exec_command(cmd, timeout=20)
print(o.read().decode('utf-8'))
c.close()
