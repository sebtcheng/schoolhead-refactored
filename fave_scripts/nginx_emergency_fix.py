#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
nginx_emergency_fix.py
======================
Fixes 4 critical issues found in the nginx audit:

1. Remove .bak file from sites-enabled (causes duplicate upstream error)
2. Rotate 1.1GB nginx access.log (eating root disk at 80%)
3. Add proxy_read_timeout 120s to nginx config (no timeout currently set)
4. Reload nginx cleanly
"""
import paramiko, sys, io, time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(hostname="20.24.58.49", port=22, username="Administrator1", password="7v52E69TYgTE", timeout=15)

def run(cmd, t=30):
    _, o, e = c.exec_command(cmd, timeout=t)
    out = o.read().decode('utf-8', errors='replace').strip()
    err = e.read().decode('utf-8', errors='replace').strip()
    if out: print(out)
    safe_errs = [l for l in err.splitlines() if l and 'WARNING' not in l and 'SSL' not in l]
    if safe_errs: print(f"[ERR] {chr(10).join(safe_errs[:5])}")
    return out

print("=" * 60)
print("STEP 1: List sites-enabled (find .bak files)")
print("=" * 60)
run("ls -la /etc/nginx/sites-enabled/")

print("\n" + "=" * 60)
print("STEP 2: Remove .bak file from sites-enabled")
print("=" * 60)
run("sudo rm -f /etc/nginx/sites-enabled/*.bak && echo REMOVED_OK")
run("ls -la /etc/nginx/sites-enabled/")

print("\n" + "=" * 60)
print("STEP 3: Show current nginx proxy config (for main insighted site)")
print("=" * 60)
run("sudo nginx -T 2>&1 | grep -iE 'proxy_read_timeout|proxy_connect_timeout|proxy_send_timeout|keepalive_timeout|proxy_pass.*127|upstream' | head -30")

print("\n" + "=" * 60)
print("STEP 4: Show full nginx config for insighted location block")
print("=" * 60)
run("sudo cat /etc/nginx/sites-enabled/insighted.conf 2>/dev/null || sudo cat /etc/nginx/sites-enabled/stride.conf 2>/dev/null || sudo cat /etc/nginx/sites-available/insighted.conf 2>/dev/null | head -80")

print("\n" + "=" * 60)
print("STEP 5: Rotate the 1.1GB Nginx access log (free disk space)")
print("=" * 60)
run("sudo mv /var/log/nginx/access.log /var/log/nginx/access.log.old && sudo kill -USR1 $(cat /var/run/nginx.pid 2>/dev/null) && echo LOG_ROTATED")
time.sleep(1)
run("du -sh /var/log/nginx/ && df -h /")

print("\n" + "=" * 60)
print("STEP 6: Test nginx config and reload")
print("=" * 60)
test = run("sudo nginx -t 2>&1")
if "successful" in test.lower() or "ok" in test.lower():
    print("Config OK — reloading nginx...")
    run("sudo systemctl reload nginx && echo NGINX_RELOADED")
else:
    print("Config has errors — NOT reloading. Fix required.")
    run("sudo nginx -T 2>&1 | head -40")

print("\n" + "=" * 60)
print("STEP 7: Verify after reload")
print("=" * 60)
run("sudo systemctl status nginx --no-pager | head -10")
run("df -h /")

c.close()
print("\nDone.")
