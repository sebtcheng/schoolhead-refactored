# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('20.24.58.49', 22, 'Administrator1', '<REDACTED_SSH_PASS>', timeout=15)

def run(cmd):
    _, o, e = client.exec_command(cmd, timeout=20)
    return o.read().decode('utf-8', errors='replace').strip()

print('=== 1. NGINX HTTP STATUS CODE BREAKDOWN (last 2000 lines) ===')
print(run("sudo tail -2000 /var/log/nginx/access.log 2>/dev/null | awk '{print $9}' | sort | uniq -c | sort -rn | head -20"))

print()
print('=== 2. NGINX RECENT ERROR LOG ===')
print(run('sudo tail -20 /var/log/nginx/error.log 2>/dev/null'))

print()
print('=== 3. PM2 ADMISSION CONTROL REJECTIONS ===')
print(run('pm2 logs --lines 100 --nostream 2>&1 | grep "Admission-Control" | tail -20'))

print()
print('=== 4. PM2 ERROR LOG FILTERED ===')
print(run('pm2 logs --lines 80 --nostream 2>&1 | grep -i "error" | grep -v "Dual-Write" | tail -25'))

print()
print('=== 5. PGBOUNCER SHOW POOLS ===')
print(run("PGPASSWORD='<REDACTED_PGB_PASS>' psql -h 127.0.0.1 -p 6432 -U Administrator1 -d pgbouncer -c 'SHOW POOLS;' 2>&1"))

print()
print('=== 6. PGBOUNCER CONFIG (pool_size, max_db) ===')
print(run("PGPASSWORD='<REDACTED_PGB_PASS>' psql -h 127.0.0.1 -p 6432 -U Administrator1 -d pgbouncer -c 'SHOW CONFIG;' 2>&1"))

client.close()
print('\nDone.')
