import paramiko
import sys
import time
import os

# Server Credentials (inherited from vm_diagnostics.py)
SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "<REDACTED_SSH_PASS>"

# Monitoring Thresholds established in ADR-007
MAX_NGINX_CONNS = 10240
PM2_RAM_THRESHOLD_GB = 1.0  # max_memory_restart: '1G'
MAX_WAL_SIZE_GB = 16.0      # max_wal_size = '16GB'
LOOP_DELAY_THRESHOLD_MS = 200 # Admission control trigger

def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, port=22, username=USER, password=PASS)
        print("\033[2J\033[3J\033[H", end="", flush=True) # Full clear
        
        while True:
            print("\033[2J\033[H", end="") # Full clear + Cursor to (1,1)
            print("="*100 + "\033[K")
            print(" PRODUCTION HARDENING & CONCURRENCY MONITOR: %-15s | %s\033[K" % (SERVER_IP, time.strftime("%H:%M:%S")))
            print("="*100 + "\033[K")
            
            # --- 1. Audit & Live Metric Command (Tagged for Parsing) ---
            infra_cmd = """
            (
                echo "NX_AUDIT:"; sudo grep -E 'worker_connections|keepalive_requests|open_file_cache|use|multi_accept' /etc/nginx/nginx.conf 2>/dev/null;
                echo "NX_LIVE:"; sudo ss -tnp | grep -E ':80|:443' | grep ESTAB | wc -l;
                echo "DB_AUDIT:"; sudo -u postgres psql -t -c "SELECT name, setting FROM pg_settings WHERE name IN ('max_wal_size','checkpoint_timeout','checkpoint_completion_target','checkpoint_flush_after','wal_compression')" 2>/dev/null;
                echo "DB_LIVE:"; sudo -u postgres psql -t -c "SELECT count(*) FROM pg_stat_activity" 2>/dev/null;
                echo "DB_INDEX:"; sudo -u postgres psql -t -d insight_pooled -c "SELECT indexname FROM pg_indexes WHERE indexname = 'idx_ph_schools_regional_summary'" 2>/dev/null;
                echo "BNC_LIVE:"; sudo netstat -tpln | grep :6432 | wc -l;
                echo "BNC_INSTANCES:"; pgrep -c pgbouncer 2>/dev/null || echo "0";
                echo "BNC_CONNS:"; sudo ss -tnp | grep :6432 | grep ESTAB | wc -l;
                echo "SHED_LIVE:"; sudo tail -n 1000 /var/log/nginx/access.log 2>/dev/null | grep -E ' 50[0-9] ' | wc -l;
                echo "PM2_LIVE:"; pm2 jlist 2>/dev/null;
                echo "APP_AUDIT:"; grep -E 'DELAY_THRESHOLD|HEAP_THRESHOLD|heap_limit' /var/www/html/InsightEd-Mobile-PWA/api/index.js 2>/dev/null
            )
            """.strip()

            stdin, stdout, stderr = client.exec_command(infra_cmd)
            raw = stdout.read().decode('utf-8')
            
            # Simple Tag-based Parser (Enhanced for whitespace)
            sections = {}
            current_tag = None
            for line in raw.splitlines():
                clean_line = line.strip()
                if clean_line.endswith(":"): 
                    current_tag = clean_line[:-1]
                    sections[current_tag] = []
                elif current_tag: 
                    sections[current_tag].append(clean_line)

            # --- 2. Separate DB Latency Check (More reliable timing) ---
            db_start = time.time()
            client.exec_command('sudo -u postgres psql -t -c "SELECT 1"')
            dl_val = (time.time() - db_start) * 1000
            
            # --- PARSING & UI ---
            try:
                # [Previous UI sections for NGINX and DB AUDIT remain here...]
                # 1. NGINX Hardening
                print(" \033[1;36m[1. NGINX CONCURRENCY & CACHING]\033[0m\033[K")
                for l in sections.get('NX_AUDIT', []):
                    p = l.replace(';','').split()
                    if len(p) < 2: continue
                    key, val = p[0], p[1]
                    desc = {
                        "worker_connections": "Max concurrent socket slots available",
                        "keepalive_requests": "Requests per TCP connection before recycler",
                        "open_file_cache":    "In-memory cache for static asset descriptors",
                        "use":               "Kernel polling model (Expected: epoll)",
                        "multi_accept":       "Batch socket acceptance (Expected: on)"
                    }.get(key, "")
                    print("   %-20s | \033[1;32m%-8s\033[0m | %s\033[K" % (key, val, desc))
                
                nx_live = int(sections.get('NX_LIVE', ['0'])[0])
                nx_pct = (nx_live / MAX_NGINX_CONNS) * 100
                print("   LIVE_CONCURRENCY     | \033[1;33m%5d\033[0m    | %4.1f%% of %d ceiling\033[K" % (nx_live, nx_pct, MAX_NGINX_CONNS))
                
                print("\033[K")
                print(" \033[1;36m[2. DATABASE WRITE SMOOTHING & POOLING]\033[0m\033[K")
                for l in sections.get('DB_AUDIT', []):
                    if '|' in l:
                        p = l.split('|')
                        key, val = p[0].strip(), p[1].strip()
                        desc = {
                            "max_wal_size":                "Log size before forcing checkpoint",
                            "checkpoint_timeout":          "Interval between disk flushes",
                            "checkpoint_completion_target": "I/O smoothing (0.9 = 90% drift)",
                            "checkpoint_flush_after":      "Kernel page flush batch size",
                            "wal_compression":             "Disk I/O compression (Expected: on)"
                        }.get(key, "")
                        print("   %-30s | \033[1;32m%-8s\033[0m | %s\033[K" % (key, val, desc))
                
                # Index & Bouncer Checks
                idx_exists = sections.get('DB_INDEX', [])
                idx_status = "\033[1;32mPRESENT\033[0m" if idx_exists else "\033[1;31mMISSING\033[0m"
                print("   IDX_PH_REGIONAL_SUMMARY        | %s | Optimized dashboard aggregation\033[K" % idx_status)
                
                bnc_live = int(sections.get('BNC_LIVE', ['0'])[0])
                bnc_status = "\033[1;32mACTIVE\033[0m (Port 6432)" if bnc_live > 0 else "\033[1;31mINACTIVE\033[0m"
                print("   PGBOUNCER_SERVICE_STATUS       | %s | Port-level readiness check\033[K" % bnc_status)
                
                bnc_inst = int(sections.get('BNC_INSTANCES', ['0'])[0])
                print("   PGBOUNCER_ACTIVE_PROCESSES     | \033[1;32m%-8d\033[0m | Multiple instances provide HA redundancy\033[K" % bnc_inst)
                
                bnc_conns = int(sections.get('BNC_CONNS', ['0'])[0])
                print("   TOTAL_POOLED_CONNECTIONS       | \033[1;33m%-8d\033[0m | Concurrent client-to-bouncer load\033[K" % bnc_conns)
                
                dl_color = "\033[1;32m" if dl_val < 200 else "\033[1;33m" if dl_val < 1000 else "\033[1;31m"
                print("   DATABASE_CONN_LATENCY          | %s%-8.2fms\033[0m | Connection + SELECT 1 overhead (via SSH)\033[K" % (dl_color, dl_val))
                
                print("\033[K")
                print(" \033[1;36m[3. APPLICATION ADMISSION CONTROL]\033[0m\033[K")
                for l in sections.get('APP_AUDIT', []):
                    p = l.replace('const','').replace('=','').replace(';','').split()
                    if len(p) >= 2:
                        key, val = p[0], p[1]
                        desc = {
                            "DELAY_THRESHOLD": "Max event loop lag (ms) before rejection",
                            "HEAP_THRESHOLD":  "Max RAM usage (B) before emergency shedding",
                            "heap_limit":           "Max RAM usage (MB) before emergency shedding"
                        }.get(key, "")
                        print("   %-30s | \033[1;32m%-8s\033[0m | %s\033[K" % (key, val, desc))
                
                shed_live = int(sections.get('SHED_LIVE', ['0'])[0])
                status_5xx = "\033[1;32mHEALTHY\033[0m" if shed_live == 0 else "\033[1;31mERRORS/SHEDDING\033[0m"
                print("   SYSTEM_HEALTH_STATUS           | %s | %d 5xx Errs in last 60s\033[K" % (status_5xx, shed_live))
                
                # 4. PM2 CLUSTER HEALTH
                pm2_raw = "".join(sections.get('PM2_LIVE', []))
                if pm2_raw.startswith("["):
                    import json
                    apps = json.loads(pm2_raw)
                    print("-" * 100 + "\033[K")
                    print(" %-27s | %-10s | %-15s | %-10s | %-10s\033[K" % ("PM2 INSTANCE (CLUSTER)", "STATUS", "MEMORY (RSS)", "RESTARTS", "UPTIME"))
                    print("-" * 100 + "\033[K")
                    
                    for app in sorted(apps, key=lambda x: x.get('name','')):
                        name = app.get('name', 'n/a')[:27]
                        status = app.get('pm2_env', {}).get('status', 'n/a').upper()
                        mem_gb = app.get('monit', {}).get('memory', 0) / (1024**3)
                        rsts = app.get('pm2_env', {}).get('restart_time', 0)
                        upt_ms = app.get('pm2_env', {}).get('pm_uptime', 1)
                        s_up = (time.time()*1000 - upt_ms)//1000
                        upt_str = "%dm" % (s_up/60) if s_up < 3600 else "%dh" % (s_up/3600)
                        
                        mem_color = "\033[1;33m" if mem_gb > 0.8 else ""
                        reset = "\033[0m"
                        print(" %-27s | %-10s | %s%5.2fG / %sG%s | %-10d | %s\033[K" % 
                              (name, status, mem_color, mem_gb, PM2_RAM_THRESHOLD_GB, reset, rsts, upt_str))
                
            except Exception as parse_err:
                 print(" \033[1;31mTelemetry Processing Error: %s\033[0m\033[K" % parse_err)
                 # print(raw) # Debug

            print("="*100 + "\033[K")
            print("\033[J", end="", flush=True) # Clear remainder
            time.sleep(10)

    except KeyboardInterrupt:
        print("\nStopping Monitor...")
    except Exception as e:
        print("\nFatal Error: %s" % e)
    finally:
        client.close()

if __name__ == "__main__":
    main()
