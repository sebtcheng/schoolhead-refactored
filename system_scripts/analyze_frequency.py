import paramiko
from collections import Counter

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
        
        print("--- Frequency Analysis (Last 2000 lines) ---")
        out, _ = run_remote_cmd(client, "sudo tail -n 2000 /var/log/nginx/access.log | awk '{print $1, $7}'")
        
        lines = out.strip().splitlines()
        ip_path_counts = Counter(lines)
        
        print("\nTop 20 IP + Path combinations (Frequency):")
        for (line, count) in ip_path_counts.most_common(20):
            print(f"{count:4} | {line}")
            
        print("\n--- Summary of High Frequency Paths ---")
        path_counts = Counter([line.split()[1] for line in lines if len(line.split()) > 1])
        for (path, count) in path_counts.most_common(10):
            print(f"{count:4} | {path}")

    finally:
        client.close()

if __name__ == "__main__":
    main()
