import paramiko
import sys

# Ensure stdout uses UTF-8 to avoid encoding errors on Windows
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

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
        
        print("\n--- Site Configurations ---")
        out, err = run_remote_cmd(client, "sudo ls /etc/nginx/sites-enabled/")
        sites = out.split()
        for site in sites:
            print(f"\n--- /etc/nginx/sites-enabled/{site} ---")
            out, err = run_remote_cmd(client, f"sudo cat /etc/nginx/sites-enabled/{site}")
            # Filter out any non-ascii characters if they still cause issues, but utf-8 should handle it now
            print(out)

    finally:
        client.close()

if __name__ == "__main__":
    main()
