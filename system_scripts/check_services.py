import paramiko

SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "<REDACTED_SSH_PASS>"

def check_services():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, port=22, username=USER, password=PASS)
        print("[Service-Check] Checking ports 5432 and 6432...")
        
        cmd = "sudo netstat -tpln | grep -E '5432|6432'"
        stdin, stdout, stderr = client.exec_command(cmd)
        
        print(stdout.read().decode())
        print(stderr.read().decode())

    finally:
        client.close()

if __name__ == "__main__":
    check_services()
