# -*- coding: utf-8 -*-
"""Find slowest endpoints from Nginx access log and remaining timeout errors from PM2."""
import sys, io, paramiko

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('20.24.58.49', 22, 'Administrator1', '<REDACTED_SSH_PASS>', timeout=15)

def run(cmd, timeout=20):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode('utf-8', errors='replace').strip()

print('=== 1. NGINX 500 ENDPOINTS (which routes are still failing?) ===')
print(run('sudo tail -1000 /var/log/nginx/access.log | awk \'$9=="500" {print $7}\' | sort | uniq -c | sort -rn | head -20'))

print()
print('=== 2. NGINX SLOW REQUESTS (response time > 3s, if $10 is the response time) ===')
# Nginx log format: check what field is request time
print(run('sudo tail -5 /var/log/nginx/access.log'))

print()
print('=== 3. PM2 TIMEOUT ERROR ROUTES ===')
print(run('pm2 logs --lines 80 --nostream 2>&1 | grep "timeout exceeded" | head -20'))

print()
print('=== 4. LIVE DB POOL STATE on Workers ===')
# Check active connections in postgres right now
print(run("""PGPASSWORD='<REDACTED_PGB_PASS>' psql -h 127.0.0.1 -p 6432 -U Administrator1 -d pgbouncer -c 'SHOW POOLS;' 2>&1"""))

print()
print('=== 5. CURRENT ACTIVE/WAITING PG SESSIONS ===')
print(run("""PGPASSWORD='<REDACTED_PGB_PASS>' psql -h 127.0.0.1 -p 6432 -U Administrator1 -d 'insightEd' -c "SELECT state, count(*) FROM pg_stat_activity WHERE datname='insightEd' AND pid <> pg_backend_pid() GROUP BY state ORDER BY count DESC;" 2>&1"""))

c.close()
