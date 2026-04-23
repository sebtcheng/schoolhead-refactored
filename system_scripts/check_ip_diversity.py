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
        
        print("Checking recent IPs in access log...")
        cmd = "sudo tail -n 50 /var/log/nginx/access.log | awk '{print $1}' | sort | uniq -c"
        out, err = run_remote_cmd(client, cmd)
        print(out)

    finally:
        client.close()

if __name__ == "__main__":
    main()
