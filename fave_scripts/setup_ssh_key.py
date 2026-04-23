import paramiko
import os

# Configuration
remote_host = "20.24.58.49"
remote_user = "Administrator1"
remote_pass = "<REDACTED_SSH_PASS>"

# Local public key path
pub_key_path = os.path.expanduser("~/.ssh/id_rsa.pub")

if not os.path.exists(pub_key_path):
    print(f"Error: Public key not found at {pub_key_path}")
    exit(1)

with open(pub_key_path, "r") as f:
    pub_key_content = f.read().strip()

print(f"Connecting to {remote_host}...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect(remote_host, username=remote_user, password=remote_pass, timeout=15)
    
    # Commands to setup .ssh and authorized_keys
    setup_commands = [
        "mkdir -p ~/.ssh",
        "chmod 700 ~/.ssh",
        f"echo '{pub_key_content}' >> ~/.ssh/authorized_keys",
        "chmod 600 ~/.ssh/authorized_keys",
        "sort -u -o ~/.ssh/authorized_keys ~/.ssh/authorized_keys" # Remove potential duplicates
    ]
    
    for cmd in setup_commands:
        print(f"Executing: {cmd[:50]}...")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        err = stderr.read().decode()
        if err:
            print(f"Warning/Error: {err}")
            
    print("\n[SUCCESS] SSH key has been authorized on the remote server.")
    print("You should now be able to run deploy scripts without entering a password.")
    
except Exception as e:
    print(f"Failed to setup SSH key: {e}")
finally:
    ssh.close()
