import paramiko
import sys

SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "7v52E69TYgTE"

def check_remote_status():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        print(f"Connecting to {SERVER_IP}...")
        client.connect(hostname=SERVER_IP, port=22, username=USER, password=PASS, timeout=15)
        print("Connected!")

        # Check PgBouncer process
        stdin, stdout, stderr = client.exec_command("ps aux | grep pgbouncer")
        print("\n--- PgBouncer Processes ---")
        print(stdout.read().decode())

        # Check if port 6432 is listening
        stdin, stdout, stderr = client.exec_command("netstat -tuln | grep 6432")
        print("\n--- Port 6432 Status ---")
        print(stdout.read().decode())

        # Check PM2 status
        stdin, stdout, stderr = client.exec_command("pm2 status")
        print("\n--- PM2 Status ---")
        print(stdout.read().decode())

    except Exception as e:
        print(f"Error: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    check_remote_status()
