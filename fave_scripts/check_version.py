# -*- coding: utf-8 -*-
"""Check if we deployed an older version over a newer VM file."""
import sys, io, paramiko

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('20.24.58.49', 22, 'Administrator1', '<REDACTED_SSH_PASS>', timeout=15)

def run(cmd, timeout=20):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode('utf-8', errors='replace').strip()

REMOTE  = '/var/www/html/InsightEd-Mobile-PWA/api/index.js'
BACKUP_CMD = 'ls -lt /var/www/html/InsightEd-Mobile-PWA/api/index.js.bak.* 2>/dev/null | head -1'

print('=== BACKUP FILE ===')
backup = run(BACKUP_CMD)
print(backup)

# Extract backup path
backup_path = backup.split()[-1] if backup else None
print(f'Backup: {backup_path}')

print()
print('=== FEATURE COMPARISON: LOCAL (deployed) vs BACKUP (old VM) ===')
features = [
    'updateSchoolTotalCompletion',
    'DB Migration Warning for Unit',
    'connectionTimeoutMillis',
    'max: 20',
    'max: 12',
    'initUnit7Schema',
    'ALTER TABLE ph_buildings_repairs ADD COLUMN',
    'Unit 7 schema DDL runs ONCE',
]

if backup_path:
    for feat in features:
        in_deployed = run(f'grep -c "{feat}" {REMOTE} 2>/dev/null || echo 0').strip()
        in_backup   = run(f'grep -c "{feat}" {backup_path} 2>/dev/null || echo 0').strip()
        print(f'  [{in_deployed:>3} deployed | {in_backup:>3} backup] {feat}')

print()
print('=== LINE COUNT COMPARISON ===')
print(f'Deployed: {run(f"wc -l {REMOTE}")}')
if backup_path:
    print(f'Backup:   {run(f"wc -l {backup_path}")}')

c.close()
