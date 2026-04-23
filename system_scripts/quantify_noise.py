import paramiko

SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "<REDACTED_SSH_PASS>"

def run_remote_cmd(client, cmd):
    stdin, stdout, stderr = client.exec_command(cmd)
    return stdout.read().decode('utf-8'), stderr.read().decode('utf-8')

def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, port=22, username=USER, password=PASS)
        
        print("--- Noise vs Genuine Analysis (Last 5000 lines) ---")
        
        # 1. Total Unique IPs
        cmd = "sudo tail -n 5000 /var/log/nginx/access.log | awk '{print $1}' | sort | uniq | wc -l"
        out, _ = run_remote_cmd(client, cmd)
        print(f"Total Unique IPs: {out.strip()}")
        
        # 2. Unique IPs hitting noise (sw.js, maintenance_mode, static assets)
        cmd = "sudo tail -n 5000 /var/log/nginx/access.log | grep -E 'sw.js|maintenance_mode|favicon.ico|\\.png|\\.jpg|\\.css|\\.js|\\.svg' | awk '{print $1}' | sort | uniq | wc -l"
        out, _ = run_remote_cmd(client, cmd)
        print(f"Unique IPs hitting noise: {out.strip()}")
        
        # 3. Unique IPs hitting GENUINE paths (POST/PUT/GET to API endpoints that aren't noise)
        # Assuming genuine users hit endpoints like /api/ph_schools, /api/save-physical-facilities, etc.
        cmd = "sudo tail -n 5000 /var/log/nginx/access.log | grep -E 'POST|PUT' | grep ' /api/' | awk '{print $1}' | sort | uniq | wc -l"
        out, _ = run_remote_cmd(client, cmd)
        print(f"Unique IPs performing Write Actions (POST/PUT /api/): {out.strip()}")
        
        # 4. Check for 'stride-dashboard' in paths
        cmd = "sudo tail -n 5000 /var/log/nginx/access.log | grep -i 'dashboard' | awk '{print $1}' | sort | uniq | wc -l"
        out, _ = run_remote_cmd(client, cmd)
        print(f"Unique IPs hitting 'dashboard': {out.strip()}")

    finally:
        client.close()

if __name__ == "__main__":
    main()
