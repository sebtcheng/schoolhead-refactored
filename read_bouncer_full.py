import paramiko

SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "<REDACTED_SSH_PASS>"

def read_config_full():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, port=22, username=USER, password=PASS)
        p = "/etc/pgbouncer/pgbouncer.ini"
        stdin, stdout, stderr = client.exec_command(f'sudo -S cat {p}', get_pty=True)
        stdin.write(PASS + '\n')
        stdin.flush()
        
        content = stdout.read().decode('utf-8')
        print(content)

    finally:
        client.close()

if __name__ == "__main__":
    read_config_full()
