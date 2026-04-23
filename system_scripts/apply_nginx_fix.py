import paramiko
import sys

SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "<REDACTED_SSH_PASS>"

def run_remote_cmd(client, cmd):
    stdin, stdout, stderr = client.exec_command(cmd)
    return stdout.read().decode('utf-8'), stderr.read().decode('utf-8')

def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, port=22, username=USER, password=PASS)
        
        # 1. Backup nginx.conf
        run_remote_cmd(client, "sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak")
        
        # 2. Prepare real_ip config
        # We trust 10.103.1.0/24 which contains 10.103.1.4
        real_ip_config = """
    ##
    # Real IP Configuration (Hawkeye Proxy Fix)
    ##
    set_real_ip_from  10.103.1.0/24;
    real_ip_header    X-Forwarded-For;
    real_ip_recursive on;
"""
        
        # 3. Read nginx.conf
        out, err = run_remote_cmd(client, "cat /etc/nginx/nginx.conf")
        
        if "set_real_ip_from" in out:
            print("Real IP config already exists. Skipping.")
        else:
            # Insert after the opening 'http {'
            new_conf = out.replace("http {", "http {" + real_ip_config)
            
            # Write back
            # To write a file with sudo, we can use a temp file then move it
            temp_file = "/tmp/nginx.conf.new"
            sftp = client.open_sftp()
            with sftp.file(temp_file, 'w') as f:
                f.write(new_conf)
            sftp.close()
            
            run_remote_cmd(client, f"sudo mv {temp_file} /etc/nginx/nginx.conf")
            print("Updated nginx.conf with real_ip settings.")
            
            # 4. Test and Reload
            out, err = run_remote_cmd(client, "sudo nginx -t")
            print(out, err)
            if "test is successful" in err or "test is successful" in out:
                run_remote_cmd(client, "sudo systemctl reload nginx")
                print("Nginx reloaded successfully.")
            else:
                print("Nginx config test failed! Rolling back.")
                run_remote_cmd(client, "sudo cp /etc/nginx/nginx.conf.bak /etc/nginx/nginx.conf")

    finally:
        client.close()

if __name__ == "__main__":
    main()
