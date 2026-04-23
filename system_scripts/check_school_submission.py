import paramiko
import json

SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "<REDACTED_SSH_PASS>"
DB_URL = "postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd"
SCHOOL_ID = "151006"

def run_db_query(client, query):
    # Use psql via SSH
    cmd = f'psql "{DB_URL}" -c "{query}"'
    stdin, stdout, stderr = client.exec_command(cmd)
    return stdout.read().decode('utf-8'), stderr.read().decode('utf-8')

def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, port=22, username=USER, password=PASS)
        
        tables = [
            "unit1_school_identity", "unit2_learners", "unit3_organized_classes",
            "unit4_learner_profile", "unit5_shifting_modality", "unit6_school_resources",
            "unit7_physical_facilities", "unit8_school_location"
        ]
        
        print(f"--- Auditing School ID: {SCHOOL_ID} ---")
        for table in tables:
            # Check if table exists first (some might be named differently)
            out, err = run_db_query(client, f"SELECT count(*) FROM {table} WHERE school_id = '{SCHOOL_ID}'")
            if "does not exist" in err:
                print(f"Table {table}: [MISSING]")
            else:
                count = out.strip().splitlines()[-1].strip() if out.strip() else "0"
                print(f"Table {table}: {count} records")

    finally:
        client.close()

if __name__ == "__main__":
    main()
