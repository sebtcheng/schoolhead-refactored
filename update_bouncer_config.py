import paramiko

SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "<REDACTED_SSH_PASS>"

def update_bouncer_config():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, port=22, username=USER, password=PASS)
        p = "/etc/pgbouncer/pgbouncer.ini"
        
        # 1. Read the file
        print(f"Reading {p}...")
        stdin, stdout, stderr = client.exec_command(f'sudo -S cat {p}', get_pty=True)
        stdin.write(PASS + '\n')
        stdin.flush()
        content = stdout.read().decode('utf-8')
        
        # 2. Modify the file (increase pool_size to 500)
        # Replacing 'pool_size=100' with 'pool_size=500' in the insightEd line
        if 'pool_size=100' in content:
            new_content = content.replace('pool_size=100', 'pool_size=500')
            print("Updating pool_size to 500...")
            
            # 3. Write it back
            # We use a temporary file to avoid partial write issues
            tmp_path = "/tmp/pgbouncer.ini.tmp"
            
            # Simple way to write: use a heredoc
            # Need to be careful with special characters in the config
            # Actually, I'll just use a more robust way: use sftp to upload
            sftp = client.open_sftp()
            with sftp.file(tmp_path, 'w') as f:
                f.write(new_content)
            
            # Move tmp to original via sudo
            client.exec_command(f"sudo -S mv {tmp_path} {p}")
            stdin, stdout, stderr = client.exec_command(f'sudo -S chown postgres:postgres {p}')
            
            # 4. Reload PgBouncer
            print("Reloading PgBouncer...")
            client.exec_command("sudo -S systemctl reload pgbouncer")
            print("✅ PgBouncer updated and reloaded.")
        else:
            print("⚠️ Could not find 'pool_size=100' in the config. Content might be different than expected.")

    finally:
        client.close()

if __name__ == "__main__":
    update_bouncer_config()
