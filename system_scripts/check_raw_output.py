import paramiko

SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "<REDACTED_SSH_PASS>"

def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, port=22, username=USER, password=PASS)
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
                echo "SHED_LIVE:"; sudo tail -n 1000 /var/log/nginx/access.log 2>/dev/null | grep ' 503 ' | wc -l;
                echo "PM2_LIVE:"; pm2 jlist 2>/dev/null;
                echo "DB_PING:"; sudo -u postgres psql -t -c "SELECT 1" 2>&1;
                echo "APP_AUDIT:"; grep -E 'LOOP_DELAY_THRESHOLD|heap_limit' e:/InsightEd-Mobile-PWA/api/index.js 2>/dev/null
            )
        """.strip()
        stdin, stdout, stderr = client.exec_command(infra_cmd)
        raw = stdout.read().decode('utf-8')
        print(f"--- RAW OUTPUT ---\n{raw}\n--- END RAW ---")

    finally:
        client.close()

if __name__ == "__main__":
    main()
