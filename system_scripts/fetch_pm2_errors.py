import paramiko

SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "<REDACTED_SSH_PASS>"

def fetch_errors():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, port=22, username=USER, password=PASS)
        print("[Log-Analyzer] Fetching last 100 lines of error logs...")
        
        # Check stderr logs for insighted-backend
        cmd = "pm2 logs insighted-backend --err --lines 100 --nostream"
        stdin, stdout, stderr = client.exec_command(cmd)
        
        # Stream output
        out = stdout.read().decode('utf-8', errors='replace')
        try:
            print(out)
        except UnicodeEncodeError:
            print(out.encode('ascii', errors='replace').decode())
            
        err = stderr.read().decode('utf-8', errors='replace')
        try:
            print(err)
        except UnicodeEncodeError:
            print(err.encode('ascii', errors='replace').decode())

    finally:
        client.close()

if __name__ == "__main__":
    fetch_errors()
