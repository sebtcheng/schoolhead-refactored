import paramiko

SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "<REDACTED_SSH_PASS>"
DB_URL = "postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd"
SCHOOL_ID = "151006"

def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, port=22, username=USER, password=PASS)
        # Query ph_school_completion
        cmd = f'psql "{DB_URL}" -c "SELECT * FROM ph_school_completion WHERE school_id = \'{SCHOOL_ID}\'"'
        stdin, stdout, stderr = client.exec_command(cmd)
        print(f"--- ph_school_completion for {SCHOOL_ID} ---")
        print(stdout.read().decode('utf-8'))
        
        # Also check school_summary
        cmd = f'psql "{DB_URL}" -c "SELECT * FROM school_summary WHERE school_id = \'{SCHOOL_ID}\'"'
        stdin, stdout, stderr = client.exec_command(cmd)
        print(f"\n--- school_summary for {SCHOOL_ID} ---")
        print(stdout.read().decode('utf-8'))

    finally:
        client.close()

if __name__ == "__main__":
    main()
