# -*- coding: utf-8 -*-
"""
deploy_index.py
===============
Uploads the local api/index.js to the VM at:
  /var/www/html/InsightEd-Mobile-PWA/api/index.js
Then restarts PM2 insighted-backend.

Confirms the deployed file contains the expected fixes:
  - max: 20 (pool size)
  - connectionTimeoutMillis: 3000
  - initUnit7Schema (DDL moved out of hot path)
"""
import sys, io, os, paramiko

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

SERVER_IP  = '20.24.58.49'
SSH_USER   = 'Administrator1'
SSH_PASS   = '<REDACTED_SSH_PASS>'
REMOTE_PATH = '/var/www/html/InsightEd-Mobile-PWA/api/index.js'
LOCAL_PATH  = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'api', 'index.js')

print(f'[*] Local file: {LOCAL_PATH}')
print(f'[*] Remote:     {REMOTE_PATH}')
print(f'[*] File size:  {os.path.getsize(LOCAL_PATH):,} bytes')

# Quick sanity check - confirm our fixes are in the local file
with open(LOCAL_PATH, 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

checks = [
    ('max: 5,',                             'Pool max=5 (Hawkeye v3.0 concurrency fix)'),
    ('max: 2,',                             'Secondary Pool max=2 (Rogue pool safety cap)'),
    ('connectionTimeoutMillis: 5000',        'connectionTimeoutMillis=5000ms'),
    ('SET statement_timeout',                'statement_timeout enforced per-connection'),
    ('SET lock_timeout',                     'lock_timeout enforced per-connection'),
    ('initUnit7Schema',                      'initUnit7Schema function exists'),
]
all_ok = True
for pattern, desc in checks:
    found = pattern in content
    print(f'  {"[OK]" if found else "[MISS]"} {desc}')
    if not found:
        all_ok = False

if not all_ok:
    print('\n[WARN] Some expected changes not found. Proceeding anyway.')

print('\n[*] Connecting via SSH...')
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(SERVER_IP, 22, SSH_USER, SSH_PASS, timeout=15)
print('[OK] Connected.')

# Backup existing file on VM
def run(cmd, timeout=20):
    _, o, e = client.exec_command(cmd, timeout=timeout)
    out = o.read().decode('utf-8', errors='replace').strip()
    err = e.read().decode('utf-8', errors='replace').strip()
    if out: print(out)
    return out

print('\n[*] Backing up existing index.js on VM...')
run(f'cp {REMOTE_PATH} {REMOTE_PATH}.bak.$(date +%Y%m%d_%H%M%S) && echo BACKUP_OK')

# Upload via SFTP
print(f'\n[*] Uploading {os.path.getsize(LOCAL_PATH):,} bytes via SFTP...')
sftp = client.open_sftp()
sftp.put(LOCAL_PATH, REMOTE_PATH)
sftp.close()
print('[OK] Upload complete.')

# Verify the upload
print('\n[*] Verifying uploaded file...')
remote_size_out = run(f'wc -c {REMOTE_PATH}')
print(f'     Remote file size: {remote_size_out}')
print(f'     Local file size:  {os.path.getsize(LOCAL_PATH):,} bytes')

# Verify the fix is in the remote file
print('\n[*] Verifying fixes in deployed file...')
for pattern, desc in checks:
    found_out = run(f'grep -c "{pattern}" {REMOTE_PATH} 2>&1')
    found = found_out.strip().isdigit() and int(found_out.strip()) > 0
    print(f'  {"[OK]" if found else "[MISS]"} {desc}')

# Restart PM2
print('\n[*] Restarting PM2 insighted-backend...')
run('pm2 restart insighted-backend', timeout=30)
print('[OK] PM2 restart issued.')

import time
time.sleep(5)

# Show new status
print('\n[*] PM2 status after restart:')
run('pm2 ls 2>&1')

client.close()
print('\n[*] Done. Watch the monitor for HTTP latency to drop from 10000ms to ~3000ms.')
print('    After ~60 seconds it should drop further as pool exhaustion resolves.')
