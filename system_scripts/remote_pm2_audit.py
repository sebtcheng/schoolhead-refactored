#!/usr/bin/env python3
"""
Jarvis Protocol: Remote PM2 Audit (v1.0)
Specialized diagnostic for Staging and Production logs.
"""
import subprocess
import sys
import re

# Remote Configuration
SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "<REDACTED_SSH_PASS>"

# Apps to audit
APPS = {
    "staging": "insighted-staging",
    "production": "insighted-backend"
}

# Errors to flag
CRITICAL_PATTERNS = [
    r"EACCES",
    r"Hydra-Fail",
    r"ModuleNotFoundError",
    r"500 Error",
    r"Sync failed",
    r"column \".*\" does not exist",
    r"Permission denied",
    r"closed or encrypted"
]

def run_remote_command(command):
    """Executes a command via SSH on the remote server."""
    ssh_cmd = [
        "ssh", "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes",
        f"{USER}@{SERVER_IP}", command
    ]
    try:
        result = subprocess.run(ssh_cmd, capture_output=True, text=True, timeout=30)
        return result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return "", "SSH Timeout"
    except Exception as e:
        return "", str(e)

def audit_app(env_name, app_name):
    print(f"\n--- Auditing {env_name.upper()} ({app_name}) ---")
    
    # Get last 100 lines of logs
    stdout, stderr = run_remote_command(f"pm2 logs {app_name} --lines 100 --nostream")
    
    if not stdout and "not found" in stderr:
        print(f"❌ Process {app_name} not found or PM2 error.")
        return

    # Split logs into lines
    lines = stdout.splitlines()
    error_count = 0
    
    for line in lines:
        for pattern in CRITICAL_PATTERNS:
            if re.search(pattern, line, re.IGNORECASE):
                print(f"⚠️  [MATCH] {line.strip()}")
                error_count += 1
                break # Only flag once per line

    if error_count == 0:
        print(f"✅ No critical errors found in last 100 lines of {app_name}.")
    else:
        print(f"Total flags found: {error_count}")

def main():
    print("="*60)
    print("🚀 REMOTE PM2 FORENSIC AUDIT")
    print(f"Target: {SERVER_IP} ({USER})")
    print("="*60)

    for env, app in APPS.items():
        audit_app(env, app)

    print("\n" + "="*60)
    print("✅ Audit Complete.")
    print("="*60)

if __name__ == "__main__":
    main()
