import paramiko
import json

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
        
        print("--- PM2 Dashboard Info ---")
        out, _ = run_remote_cmd(client, "pm2 jlist")
        if out.strip():
            apps = json.loads(out)
            for app in apps:
                if "dashboard" in app['name'].lower():
                    print(f"Name: {app['name']}")
                    print(f"Path: {app['pm2_env']['pm_exec_path']}")
                    print(f"Env: {app['pm2_env'].get('env', {})}")
        
        print("\n--- Finding pgbouncer.ini ---")
        out, _ = run_remote_cmd(client, "sudo find /etc -name 'pgbouncer.ini' 2>/dev/null")
        paths = out.strip().splitlines()
        for p in paths:
            print(f"Found: {p}")
            content, _ = run_remote_cmd(client, f"sudo cat {p}")
            print(f"--- Content of {p} ---")
            # Filter for pool settings to avoid huge output
            for line in content.splitlines():
                if any(x in line for x in ["pool_size", "max_client_conn", "pool_mode", "reserve_pool"]):
                    print(line)

    finally:
        client.close()

if __name__ == "__main__":
    main()
