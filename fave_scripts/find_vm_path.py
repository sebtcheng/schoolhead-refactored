# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
import paramiko, os

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('20.24.58.49', 22, 'Administrator1', '<REDACTED_SSH_PASS>', timeout=15)

def run(cmd):
    _, o, e = c.exec_command(cmd, timeout=20)
    return o.read().decode('utf-8', errors='replace').strip()

print('=== PM2 SHOW (exec path, cwd) ===')
print(run('pm2 show insighted-backend 2>&1'))

print()
print('=== FIND api/index.js on VM ===')
print(run('find /home /opt /srv /root -name "index.js" 2>/dev/null | grep "api/index.js" | head -10'))

c.close()
print('Done.')
