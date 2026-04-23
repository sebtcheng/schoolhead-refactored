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
        
        print("--- Global Nginx Audit ---")
        out, _ = run_remote_cmd(client, "grep -r 'real_ip' /etc/nginx/")
        print(out)
        
        print("--- Server-Side api/index.js Audit ---")
        out, _ = run_remote_cmd(client, "grep -C 5 'max: 12' /var/www/html/InsightEd-Mobile-PWA/api/index.js")
        print(out if out.strip() else "!!! NOT FOUND !!!")
        
        print("--- Server-Side src/App.jsx Audit ---")
        out, _ = run_remote_cmd(client, "grep -C 2 '300000' /var/www/html/InsightEd-Mobile-PWA/src/App.jsx")
        print(out if out.strip() else "!!! NOT FOUND !!!")

    finally:
        client.close()

if __name__ == "__main__":
    main()
