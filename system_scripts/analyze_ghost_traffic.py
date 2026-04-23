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
        
        print("--- Analyzing Top IPs (Last 2000 lines) ---")
        cmd = "sudo tail -n 2000 /var/log/nginx/access.log | awk '{print $1}' | sort | uniq -c | sort -nr | head -n 20"
        out, err = run_remote_cmd(client, cmd)
        print(out)
        
        print("\n--- Analyzing Top Paths (Last 2000 lines) ---")
        cmd = "sudo tail -n 2000 /var/log/nginx/access.log | awk '{print $7}' | sort | uniq -c | sort -nr | head -n 20"
        out, err = run_remote_cmd(client, cmd)
        print(out)
        
        print("\n--- Checking for Health Checks / Bots ---")
        cmd = "sudo tail -n 100 /var/log/nginx/access.log"
        out, err = run_remote_cmd(client, cmd)
        print(out)

    finally:
        client.close()

if __name__ == "__main__":
    main()
