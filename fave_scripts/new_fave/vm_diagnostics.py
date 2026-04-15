import paramiko
import sys
import time
import os

SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "7v52E69TYgTE"

metrics = [
    ("CPU Utilization", "cores=$(nproc 2>/dev/null || echo 1); grep 'cpu ' /proc/stat | awk -v c=$cores '{u=($2+$4)*100/($2+$4+$5); printf \"%.1f%% (%.2f Cores / %s Cores)\", u, (u*c)/100, c}'"),
    ("Root Disk Used", "df -h / | awk 'NR==2 {print $5 \" (\" $3 \" / \" $2 \")\"}'"),
    ("Mnt Disk Used", "df -h /mnt | awk 'NR==2 {print $5 \" (\" $3 \" / \" $2 \")\"}'"),
    ("RAM Used", "free -b | awk '/Mem:/ {printf \"%.1f%% (%.2fG / %.2fG)\", $3/$2*100, $3/1073741824, $2/1073741824}'"),
    ("PostgreSQL Data Used", """PG_SIZE=$(sudo du -sb /var/lib/postgresql 2>/dev/null | awk 'NR==1{print $1}'); if [ -z "$PG_SIZE" ]; then PG_SIZE=0; fi; TOT_SIZE=$(df -B1 / | awk 'NR==2 {print $2}'); awk -v pg="$PG_SIZE" -v tot="$TOT_SIZE" 'BEGIN { if(tot>0) printf "%.2f%% (%.2fG / %.2fG)", (pg/tot)*100, pg/1073741824, tot/1073741824; else print "0%" }'"""),
    ("PostgreSQL Sessions", """sudo -u postgres psql -t -c "SELECT count(*) || ' / ' || (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') FROM pg_stat_activity" 2>/dev/null | awk '{print $1 \" / \" $3 \" (\" $1/$3*100 \"% Cap)\"}'"""),
    ("PM2 CPU Used", """cores=$(nproc 2>/dev/null || echo 1); pm2 jlist 2>/dev/null | python3 -c "import sys,json; d=sys.stdin.read().strip(); print(sum([x.get('monit',{}).get('cpu',0) for x in json.loads(d)]) if d.startswith('[') else 0)" 2>/dev/null | awk -v c=$cores '{if($1>0){printf "%.1f%% (%.2f Cores / %s Cores)", ($1/(c*100))*100, $1/100, c} else print "0%"}'"""),
    ("PM2 RAM Used", """pm2 jlist 2>/dev/null | python3 -c "import sys,json; d=sys.stdin.read().strip(); print(sum([x.get('monit',{}).get('memory',0) for x in json.loads(d)]) if d.startswith('[') else 0)" 2>/dev/null | awk '{if($1>0){"free -b | grep Mem:" | getline f; split(f,a); tot=a[2]; if(tot>0) printf "%.1f%% (%.2fG / %.2fG)", ($1/tot)*100, $1/1073741824, tot/1073741824; else print "0%"} else print "0%"}'""")
]

def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, port=22, username=USER, password=PASS)
        print("\033[2J\033[3J\033[H", end="", flush=True) # Full clear
        
        while True:
            print("\033[H", end="") # Cursor to (1,1)
            print("="*80 + "\033[K")
            print(" REAL-TIME INFRASTRUCTURE AUDIT: %-15s | %s\033[K" % (SERVER_IP, time.strftime("%H:%M:%S")))
            print("="*80 + "\033[K")
            
            # --- System Health ---
            for name, cmd in metrics:
                stdin, stdout, stderr = client.exec_command(cmd)
                stdout.channel.recv_exit_status()
                res = stdout.read().decode('utf-8').strip() or "0%"
                print(" %-27s | %s\033[K" % (name, res))

            # --- PM2 & Nginx Log Telemetry ---
            pm2_cmd = """
            (sudo tail -n 1000 /var/log/nginx/access.log 2>/dev/null; echo "---LOG_SEP---"; sudo ss -tnp 2>/dev/null | grep ESTAB; sudo ss -xnp 2>/dev/null | grep ESTAB; echo "---DATA_SEP---"; pm2 jlist 2>/dev/null) | python3 -c '
import sys, json, time
from datetime import datetime

raw_full = sys.stdin.read().split("---DATA_SEP---")
if len(raw_full) < 2: sys.exit(0)
parts_upper = raw_full[0].split("---LOG_SEP---")
logs_raw = parts_upper[0].strip() if len(parts_upper) > 1 else ""
conns_raw = parts_upper[1].strip() if len(parts_upper) > 1 else parts_upper[0].strip()

# 1. Parse Logs
now = time.time()
u_staging, u_prod, u_dash = set(), set(), set()
err_5xx = 0

def is_noise(path):
    p = path.lower()
    if any(x in p for x in ["sw.js", "favicon.ico", "maintenance_mode", "health"]): return True
    if any(p.endswith(x) for x in [".png", ".jpg", ".jpeg", ".css", ".js", ".svg", ".ico", ".json", ".map"]): return True
    return False

for line in logs_raw.splitlines():
    try:
        if "health" in line.lower() or "urllib" in line.lower(): continue
        p = line.split()
        if len(p) < 9: continue
        
        ip, path = p[0], p[6]
        if is_noise(path): continue
        
        dt = datetime.strptime(p[3].strip("["), "%d/%b/%Y:%H:%M:%S")
        if (now - dt.timestamp()) < 60:
            if p[8].startswith("5"): err_5xx += 1
            if "/insighted-staging/" in line: u_staging.add(ip)
            elif "/dashboard/" in line or "/stride-dashboard/" in line: u_dash.add(ip)
            else: u_prod.add(ip)
    except: continue

# 2. Parse Connections
db_stats = {}
for line in conns_raw.splitlines():
    if "pid=" not in line: continue
    try:
        pid = line.split("pid=")[1].split(",")[0]
        if pid not in db_stats: db_stats[pid] = 0
        if any(x in line for x in [":5432", ".5432", ":6432", "/postgresql"]): db_stats[pid] += 1
    except: continue

data = json.loads(raw_full[1]) if raw_full[1].strip().startswith("[") else []
print("-" * 80 + "\\033[K")
print(" Global Nginx (60s)         | %d Pure Users (Filtered Noise) / %d Server Errors\\033[K" % (len(u_prod)+len(u_staging)+len(u_dash), err_5xx))
print("-" * 80 + "\\033[K")
print(" PM2 SERVICE BREAKDOWN      | CPU   | RAM   | USR | DB | RST | UPTIME\\033[K")
print("-" * 80 + "\\033[K")

def fmt_up(ms):
    s = (time.time()*1000 - ms)//1000
    if s < 60: return "%ds" % s
    if s < 3600: return "%dm" % (s/60)
    if s < 86400: return "%dh" % (s/3600)
    return "%dd" % (s/86400)

for p in sorted(data, key=lambda x: x.get("name","")):
    n = p.get("name", "n/a")[:25]
    cpu = p.get("monit", {}).get("cpu", 0)
    mem = p.get("monit", {}).get("memory", 0) / 1073741824
    rst = p.get("pm2_env", {}).get("restart_time", 0)
    upt = fmt_up(p.get("pm2_env", {}).get("pm_uptime", 0))
    
    # Precise Attribution
    if "staging" in n.lower(): usr = len(u_staging)
    elif "dashboard" in n.lower(): usr = len(u_dash)
    else: usr = len(u_prod)
    
    db = db_stats.get(str(p.get("pid","")), 0)
    print(" %-26s | %4.1f%% | %4.2fG | %3d | %2d | %3d | %s\\033[K" % (n, cpu, mem, usr, db, rst, upt))
'
            """.strip()
            stdin, stdout, stderr = client.exec_command(pm2_cmd)
            res = stdout.read().decode('utf-8').strip()
            if res: print(res)
            
            print("\033[J", end="", flush=True)
            time.sleep(3)

    except KeyboardInterrupt:
        print("\nStopping Monitor...")
    except Exception as e:
        print("\nFatal Error: %s" % e)
    finally:
        client.close()

if __name__ == "__main__":
    main()
