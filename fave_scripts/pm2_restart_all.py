import paramiko
import sys
import time

# Configuration
SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "<REDACTED_SSH_PASS>"

# Colors
RED = '\033[0;31m'
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
CYAN = '\033[0;36m'
NC = '\033[0m'

def header(text):
    print(f"\n{CYAN}{'='*60}{NC}")
    print(f"{CYAN}  PM2 Multi-Service Recovery — {text}{NC}")
    print(f"{CYAN}{'='*60}{NC}")

def main():
    header("Initializing Restart Cycle")
    
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print(f"{YELLOW}Connecting to {SERVER_IP}...{NC}")
        client.connect(hostname=SERVER_IP, port=22, username=USER, password=PASS, timeout=15)
        print(f"{GREEN}Connection established.{NC}")

        # 1. PM2 Restart All
        print(f"\n{YELLOW}[1/2] Executing: pm2 restart all{NC}")
        stdin, stdout, stderr = client.exec_command("pm2 restart all")
        exit_status = stdout.channel.recv_exit_status()
        
        output = stdout.read().decode('utf-8').strip()
        if exit_status == 0:
            print(f"{GREEN}Restart command accepted by PM2.{NC}")
            if output:
                print(output)
        else:
            print(f"{RED}Restart failed with exit code: {exit_status}{NC}")
            print(stderr.read().decode('utf-8'))
            return

        # Wait a few seconds for apps to attempt startup
        print(f"\n{YELLOW}Waiting 5s for services to initialize...{NC}")
        time.sleep(5)

        # 2. Fetch and Check Logs
        print(f"{YELLOW}[2/2] Fetching recent logs for diagnostic audit...{NC}")
        stdin, stdout, stderr = client.exec_command("pm2 logs --lines 100 --nostream")
        logs_output = stdout.read().decode('utf-8', errors='replace')
        
        if not logs_output:
            print(f"{RED}No log output received. Services might be failing at the process level.{NC}")
            return

        print(f"\n{NC}{logs_output}")
        
        # 3. Diagnostic Audit
        header("Diagnostic Summary")
        error_keywords = ["error", "exception", "failed", "unhandled", "denied", "500", "sigkill", "panic"]
        found_errors = []
        
        for line in logs_output.split('\n'):
            if any(key in line.lower() for key in error_keywords):
                found_errors.append(line.strip())
        
        if not found_errors:
            print(f"{GREEN}Status: [CLEAN RESTART]{NC}")
            print("No critical error signatures found in the immediate logs.")
            print("The ecosystem appears stable.")
        else:
            print(f"{RED}Status: [POTENTIAL ISSUES DETECTED]{NC}")
            print(f"Located {len(found_errors)} log lines containing error signatures:")
            limit = min(8, len(found_errors))
            for i in range(limit):
                print(f"  - {found_errors[i]}")
            if len(found_errors) > 8:
                print(f"  ... and {len(found_errors) - 8} more.")
            print(f"\n{YELLOW}Recommendation:{NC} Run 'pm2 logs' manually for deeper inspection.")

    except KeyboardInterrupt:
        print(f"\n{YELLOW}Aborted by user.{NC}")
    except Exception as e:
        print(f"\n{RED}Fatal Error: {e}{NC}")
    finally:
        client.close()
        print(f"\n{CYAN}Session Closed.{NC}")

if __name__ == "__main__":
    main()
