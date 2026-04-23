import paramiko

SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "<REDACTED_SSH_PASS>"

def read_env():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, port=22, username=USER, password=PASS)
        print("[Env-Check] Reading /var/www/html/InsightEd-Mobile-PWA/.env...")
        
        cmd = "cat /var/www/html/InsightEd-Mobile-PWA/.env"
        stdin, stdout, stderr = client.exec_command(cmd)
        
        print(stdout.read().decode())
        print(stderr.read().decode())

    finally:
        client.close()

if __name__ == "__main__":
    read_env()
