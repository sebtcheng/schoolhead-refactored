# -*- coding: utf-8 -*-
"""Verify the deployed code is correct and check live PM2 HTTP latency post-deploy."""
import sys, io, paramiko

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('20.24.58.49', 22, 'Administrator1', '<REDACTED_SSH_PASS>', timeout=15)

def run(cmd, timeout=20):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode('utf-8', errors='replace').strip()

REMOTE = '/var/www/html/InsightEd-Mobile-PWA/api/index.js'

print('=== VERIFY DEPLOYED FIXES ===')
checks = [
    ('max: 20,'                       , 'pool max=20'),
    ('connectionTimeoutMillis: 3000'  , 'connectionTimeout=3000ms'),
    ('initUnit7Schema'                , 'initUnit7Schema function'),
    ('Unit 7 schema DDL runs ONCE'    , 'ALTER TABLE removed from hot path'),
    ('ALTER TABLE ph_buildings_repairs ADD COLUMN', 'Old DDL in hot path (should be 0)'),
]
for pattern, desc in checks:
    count = run(f'grep -c "{pattern}" {REMOTE} 2>&1 || echo 0')
    try:
        n = int(count.strip())
    except:
        n = -1
    if pattern == 'ALTER TABLE ph_buildings_repairs ADD COLUMN':
        # Should be 0 in hot path (request handler), ok if in initUnit7Schema
        status = '[OK]' if n == 0 else f'[WARN] found {n} times'
    else:
        status = '[OK]' if n > 0 else '[MISS]'
    print(f'  {status} {desc}')

print()
print('=== PM2 HTTP LATENCY (current) ===')
print(run('pm2 show insighted-backend 2>&1 | grep -A 30 "Code metrics"'))

print()
print('=== RECENT PM2 TIMEOUT ERRORS ===')
print(run('pm2 logs --lines 30 --nostream 2>&1 | grep "timeout exceeded" | wc -l'))
print('timeout errors in last 30 log lines')

print()
print('=== NGINX 5xx IN LAST 60s (quick count) ===')
print(run('sudo tail -500 /var/log/nginx/access.log | awk \'{print $9}\' | sort | uniq -c | sort -rn | head -8'))

c.close()
