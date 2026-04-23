import paramiko

SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "<REDACTED_SSH_PASS>"

def read_userlist():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, port=22, username=USER, password=PASS)
        print("[Bouncer-Check] Reading /etc/pgbouncer/userlist.txt...")
        
        cmd = "sudo cat /etc/pgbouncer/userlist.txt"
        stdin, stdout, stderr = client.exec_command(cmd)
        
        print(stdout.read().decode())
        print(stderr.read().decode())

    finally:
        client.close()

if __name__ == "__main__":
    read_userlist()
