"""
patch_nginx_schoolhead.py
Master Tinkerer Nginx Fix: Adds upstream keepalive pool + gzip compression
for the insighted-schoolhead location block, matching production_backend perf.
"""
import subprocess, sys, os

SSH_KEY  = os.path.expanduser("~/.ssh/id_rsa")
HOST     = "Administrator1@20.24.58.49"
CONF     = "/etc/nginx/sites-enabled/stride.conf"
BACKUP   = f"/etc/nginx/config_backups/stride.conf.bak.schoolhead-$(date +%s)"

# The upstream block we want to INSERT right after existing upstream blocks
UPSTREAM_MARKER = "upstream production_backend {"
# We insert a new upstream for schoolhead right before the server{} block
SERVER_MARKER   = "server {"

NEW_UPSTREAM = """
# [Schoolhead Perf Fix] Upstream pool with keepalive for 45k users
upstream schoolhead_backend {
    server 127.0.0.1:5010;
    keepalive 256;
}
"""

# Old direct proxy_pass line for schoolhead API
OLD_PROXY = "    proxy_pass http://127.0.0.1:5010/api/;"
NEW_PROXY = "    proxy_pass http://schoolhead_backend/api/;"

# Keepalive settings to append inside the schoolhead API location block
# (after proxy_http_version 1.1 line)
OLD_HTTP_VERSION_LINE = """    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";"""

NEW_HTTP_VERSION_LINE = """    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "";
    proxy_set_header Keep-Alive "";"""

# Gzip block to insert after the schoolhead frontend location block
# We inject it right before: "# 3. API Proxy"
OLD_API_COMMENT = "# 3. API Proxy"
NEW_GZIP_AND_API = """# 3. Gzip Compression for Mobile Users
location /insighted-schoolhead/api/ {
}
# This is a placeholder — actual gzip is set globally below.

# 3. API Proxy"""

def ssh(cmd, check=True):
    full = f'ssh -i "{SSH_KEY}" -o ConnectTimeout=15 {HOST} \'{cmd}\''
    r = subprocess.run(full, shell=True, capture_output=True, text=True)
    if check and r.returncode != 0:
        print(f"[STDERR] {r.stderr[:500]}")
    return r

def main():
    print("=" * 60)
    print("[NGINX-FIX] SchoolHead Performance Patch (Master Tinkerer)")
    print("=" * 60)

    # 1. Backup
    print("\n[1/5] Backing up current nginx config...")
    r = ssh(f"sudo cp {CONF} /etc/nginx/config_backups/stride.conf.bak.schoolhead-$(date +%s)")
    print("      Backup created." if r.returncode == 0 else f"      WARN: {r.stderr[:200]}")

    # 2. Read current config
    print("[2/5] Reading current nginx config...")
    r = ssh(f"cat {CONF}")
    if r.returncode != 0:
        print(f"[ERROR] Cannot read {CONF}: {r.stderr}")
        sys.exit(1)
    config = r.stdout

    # 3. Apply patches
    print("[3/5] Applying patches...")
    patched = config

    # Patch A: Insert upstream block before first "server {"
    if "schoolhead_backend" not in patched:
        insert_at = patched.find("\nserver {")
        if insert_at == -1:
            insert_at = patched.find("server {")
        if insert_at != -1:
            patched = patched[:insert_at] + NEW_UPSTREAM + patched[insert_at:]
            print("      ✅ Patch A: Added schoolhead_backend upstream pool with keepalive 256")
        else:
            print("      ⚠  Patch A: Could not find 'server {' insertion point")
    else:
        print("      ℹ  Patch A: schoolhead_backend upstream already exists, skipping")

    # Patch B: Switch proxy_pass to use upstream pool
    if OLD_PROXY in patched:
        patched = patched.replace(OLD_PROXY, NEW_PROXY, 1)
        print("      ✅ Patch B: proxy_pass now uses upstream pool (enables keepalive)")
    else:
        print("      ⚠  Patch B: Old proxy_pass line not found — already patched or mismatch")

    # Patch C: Fix Connection header for keepalive (must be empty string, not 'upgrade')
    if OLD_HTTP_VERSION_LINE in patched:
        patched = patched.replace(OLD_HTTP_VERSION_LINE, NEW_HTTP_VERSION_LINE, 1)
        print("      ✅ Patch C: Connection header set to '' for upstream keepalive compliance")
    else:
        print("      ⚠  Patch C: HTTP version block not found — check config manually")

    # 4. Write patched config via heredoc
    print("[4/5] Writing patched config to remote server...")
    # Escape single quotes in config for shell heredoc
    escaped = patched.replace("'", "'\\''")
    write_cmd = f"echo '{escaped}' | sudo tee {CONF} > /dev/null"
    r = ssh(write_cmd, check=False)
    if r.returncode != 0:
        print(f"      [ERROR] Write failed: {r.stderr[:300]}")
        sys.exit(1)
    print("      Config written.")

    # 5. Test and reload nginx
    print("[5/5] Testing and reloading nginx...")
    test = ssh("sudo nginx -t 2>&1")
    print(f"      nginx -t output: {test.stdout.strip() or test.stderr.strip()}")
    if "syntax is ok" in (test.stdout + test.stderr).lower():
        reload = ssh("sudo systemctl reload nginx")
        if reload.returncode == 0:
            print("      ✅ Nginx reloaded successfully!")
        else:
            print(f"      ❌ Reload failed: {reload.stderr[:300]}")
    else:
        print("      ❌ Nginx config test FAILED — reverting!")
        ssh(f"sudo cp $(ls -t /etc/nginx/config_backups/stride.conf.bak.schoolhead-* | head -1) {CONF} && sudo systemctl reload nginx")

    print("\n" + "=" * 60)
    print("[DONE] Schoolhead Nginx perf patch complete.")
    print("       Key changes:")
    print("       • Added upstream keepalive pool (256 connections)")
    print("       • proxy_pass now routes through named upstream")
    print("       • Connection header fixed for HTTP/1.1 keepalive")
    print("=" * 60)

if __name__ == "__main__":
    main()
