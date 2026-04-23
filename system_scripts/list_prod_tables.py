import paramiko

SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "<REDACTED_SSH_PASS>"
DB_URL = "postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd"

def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, port=22, username=USER, password=PASS)
        stdin, stdout, stderr = client.exec_command(f'psql "{DB_URL}" -c "\\dt"')
        print(stdout.read().decode('utf-8'))
        print(stderr.read().decode('utf-8'))
    finally:
        client.close()

if __name__ == "__main__":
    main()
