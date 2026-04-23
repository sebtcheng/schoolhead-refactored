import paramiko

SERVER_IP = "20.24.58.49"
USER = "Administrator1"
PASS = "<REDACTED_SSH_PASS>"

def test_pg_node():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, port=22, username=USER, password=PASS)
        print("[Node-Test] Testing pg-pool without URL params...")
        
        node_script_mjs = """
import pg from 'pg';
const { Pool } = pg;
const dbUrl = 'postgres://Administrator1:<REDACTED_PGB_PASS>@127.0.0.1:6432/insightEd'; // no ?ssl=false
const isLocal = true;

const pool = new Pool({
  connectionString: dbUrl,
  ssl: false
});

pool.query('SELECT 1', (err, res) => {
  if (err) {
    console.error('Error:', err.message);
  } else {
    console.log('Success:', res.rows);
  }
  pool.end();
});
"""
        cmd2 = f"cd /var/www/html/InsightEd-Mobile-PWA && echo \"{node_script_mjs}\" > test_pg.js && node test_pg.js"
        stdin, stdout, stderr = client.exec_command(cmd2)
        
        print(stdout.read().decode())
        print(stderr.read().decode())

    finally:
        client.close()

if __name__ == "__main__":
    test_pg_node()
