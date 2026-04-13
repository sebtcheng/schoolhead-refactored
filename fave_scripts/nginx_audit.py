#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
nginx_audit.py  —  nginx-pro.md SOP deep audit
Runs: nginx -T, error log, 5xx URL breakdown, disk usage, upstream health.
"""
import paramiko, sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(hostname="20.24.58.49", port=22, username="Administrator1", password="7v52E69TYgTE", timeout=15)

def run(cmd, t=30):
    _, o, e = c.exec_command(cmd, timeout=t)
    out = o.read().decode('utf-8', errors='replace')
    err = e.read().decode('utf-8', errors='replace')
    return (out + err).strip()

SEP = "=" * 70

# 1. Nginx version and status
print(f"\n{SEP}\n1. NGINX VERSION + STATUS\n{SEP}")
print(run("nginx -v 2>&1; sudo systemctl status nginx --no-pager | head -15"))

# 2. Upstream/proxy timeout config from nginx -T
print(f"\n{SEP}\n2. NGINX PROXY TIMEOUT CONFIG (from live config)\n{SEP}")
print(run("sudo nginx -T 2>&1 | grep -iE 'proxy_read_timeout|proxy_connect_timeout|proxy_send_timeout|keepalive|worker_processes|worker_connections|upstream|server 127' | head -40"))

# 3. EXACT 5xx URLs from access log (last 5000 requests)
print(f"\n{SEP}\n3. EXACT 5xx ENDPOINTS (last 5000 requests)\n{SEP}")
print(run(r"sudo tail -5000 /var/log/nginx/access.log 2>/dev/null | awk '$9~/^5/{print $9,$7}' | sort | uniq -c | sort -rn | head -35"))

# 4. Nginx error log - last 40 lines
print(f"\n{SEP}\n4. NGINX ERROR LOG (last 40 lines)\n{SEP}")
print(run("sudo tail -40 /var/log/nginx/error.log 2>/dev/null"))

# 5. Disk breakdown — what's eating the 23G root disk
print(f"\n{SEP}\n5. DISK USAGE BREAKDOWN (root disk filling up!)\n{SEP}")
print(run("df -h / 2>/dev/null"))
print(run("sudo du -sh /var/log/nginx/*.log 2>/dev/null"))
print(run("sudo du -sh ~/.pm2/logs/ 2>/dev/null"))
print(run("sudo du -sh /var/log/ 2>/dev/null"))
print(run("sudo du -sh /var/www/html/InsightEd-Mobile-PWA/ 2>/dev/null"))
print(run("sudo find /var/log -name '*.log' -size +50M 2>/dev/null | xargs ls -lh 2>/dev/null | head -10"))

# 6. upstream socket/port check
print(f"\n{SEP}\n6. BACKEND PORT HEALTH (is node listening on expected port?)\n{SEP}")
print(run("sudo netstat -tulnp 2>/dev/null | grep -E '3000|5000|5001|3001|node|pm2' | head -20"))

# 7. Nginx access log - what status codes are going out right now
print(f"\n{SEP}\n7. STATUS CODE DISTRIBUTION (last 2000 requests)\n{SEP}")
print(run(r"sudo tail -2000 /var/log/nginx/access.log 2>/dev/null | awk '{print $9}' | sort | uniq -c | sort -rn"))

# 8. Connection states
print(f"\n{SEP}\n8. NETWORK CONNECTION STATES\n{SEP}")
print(run("ss -s 2>/dev/null | head -20"))

c.close()
print("\n=== SSH CLOSED ===")
